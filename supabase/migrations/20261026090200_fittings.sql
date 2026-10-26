-- Lịch thử đồ. Mỗi cơ sở tự đặt độ dài khung giờ và số khách thử cùng lúc;
-- để trống = khung 30 phút gợi ý, khách chọn giờ tự do / không giới hạn số khách.

-- Các khung giờ còn đặt được trong 1 ngày; remaining = null nghĩa là không giới hạn
create function public.get_fitting_slots(p_branch_id uuid, p_date date)
returns table (starts_at timestamptz, remaining int)
language sql
stable
security definer
set search_path = ''
as $$
  with br as (
    select
      b.*,
      make_interval(mins => coalesce(b.fitting_slot_minutes, 30)) as slot
    from public.branches b
    where b.id = p_branch_id and b.is_active
  ),
  slots as (
    select gs as starts_at, br.slot, br.fitting_capacity as capacity
    from br,
      generate_series(
        (p_date + br.open_time) at time zone 'Asia/Ho_Chi_Minh',
        (p_date + br.close_time) at time zone 'Asia/Ho_Chi_Minh' - br.slot,
        br.slot
      ) gs
  )
  select
    s.starts_at,
    case
      when s.capacity is null then null
      else s.capacity - (
        select count(*)::int
        from public.fitting_appointments f
        where f.branch_id = p_branch_id
          and f.status = 'booked'
          and tstzrange(f.starts_at, f.starts_at + s.slot) && tstzrange(s.starts_at, s.starts_at + s.slot)
      )
    end
  from slots s
  where s.starts_at > now()
  order by s.starts_at
$$;

-- Đặt lịch thử. Trang khách gọi qua server bằng service role (đã kiểm tra captcha);
-- nhân viên được đặt ngoài khung giờ / vượt số phòng thử khi cần.
-- p_items: [{ "product_id": uuid, "size": text }]
create function public.create_fitting(
  p_branch_id uuid,
  p_customer jsonb,
  p_starts_at timestamptz,
  p_items jsonb default '[]',
  p_customer_note text default null,
  p_source public.booking_source default 'web'
)
returns public.fitting_appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jwt_role text := private.jwt_role();
  v_is_staff boolean := v_jwt_role is null or private.can_manage_branch(p_branch_id);
  v_local timestamp := p_starts_at at time zone 'Asia/Ho_Chi_Minh';
  v_slot interval;
  br public.branches;
  v_appt public.fitting_appointments;
begin
  if not v_is_staff and v_jwt_role is distinct from 'service_role' then
    raise exception 'Bạn không có quyền đặt lịch ở cơ sở này' using errcode = '42501';
  end if;

  select * into br from public.branches where id = p_branch_id and is_active;
  if br.id is null then
    raise exception 'Cơ sở không tồn tại' using hint = 'invalid_branch';
  end if;

  v_slot := make_interval(mins => coalesce(br.fitting_slot_minutes, 30));

  if not v_is_staff then
    p_source := 'web';

    if p_starts_at <= now() then
      raise exception 'Giờ hẹn đã qua' using hint = 'invalid_time';
    end if;
    if v_local::time < br.open_time or v_local::time + v_slot > br.close_time then
      raise exception 'Giờ hẹn nằm ngoài giờ mở cửa' using hint = 'invalid_time';
    end if;
    if br.fitting_slot_minutes is not null
       and (extract(epoch from v_local::time - br.open_time) / 60)::int % br.fitting_slot_minutes <> 0 then
      raise exception 'Giờ hẹn không đúng khung giờ' using hint = 'invalid_time';
    end if;

    -- Khoá theo cơ sở + ngày để 2 khách không cùng giành chỗ cuối
    perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text || v_local::date::text, 0));

    if br.fitting_capacity is not null and (
      select count(*)
      from public.fitting_appointments f
      where f.branch_id = p_branch_id
        and f.status = 'booked'
        and tstzrange(f.starts_at, f.starts_at + v_slot) && tstzrange(p_starts_at, p_starts_at + v_slot)
    ) >= br.fitting_capacity then
      raise exception 'Khung giờ này đã kín, vui lòng chọn giờ khác' using hint = 'slot_full';
    end if;
  end if;

  insert into public.fitting_appointments (branch_id, customer_id, starts_at, source, customer_note, created_by)
  values (
    p_branch_id, private.upsert_customer(p_customer), p_starts_at, p_source,
    nullif(trim(p_customer_note), ''), auth.uid()
  )
  returning * into v_appt;

  insert into public.fitting_items (appointment_id, product_id, size)
  select v_appt.id, (x ->> 'product_id')::uuid, nullif(trim(x ->> 'size'), '')
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
  limit 10;

  return v_appt;
end;
$$;

revoke execute on function public.create_fitting from public, anon;
