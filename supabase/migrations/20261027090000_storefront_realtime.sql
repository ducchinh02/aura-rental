-- Trang khách đặt váy
--   1. Realtime: lịch một mẫu váy vừa đổi (có đơn mới, đơn huỷ, đổi ngày, váy bảo trì) thì DB phát
--      tin lên kênh "availability:<product_id>" để mọi khách đang mở mẫu đó tải lại lịch ngay.
--      Kênh private: khách chỉ được nghe và báo "đang xem" (presence), không tự phát tin được.
--   2. Khung giờ còn trống cho thuê theo giờ.
--   3. Chặn đơn web từ khách trong danh sách đen và khách giữ quá nhiều đơn chưa cọc.
--
-- Chống 2 khách đặt cùng 1 chiếc váy vẫn do exclusion constraint booking_items_no_overlap:
-- giao dịch đến sau bị chặn, create_booking thử chiếc khác cùng size rồi mới báo hết váy.

-- ---------------------------------------------------------------------------
-- 1. Realtime
-- ---------------------------------------------------------------------------

-- Chỉ gửi size và khoảng ngày bị ảnh hưởng, không có thông tin khách
create function private.notify_item_availability(p_item_id uuid, p_period daterange)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.inventory_items;
begin
  select * into i from public.inventory_items where id = p_item_id;
  if i.id is null then
    return;
  end if;

  perform realtime.send(
    jsonb_build_object('size', i.size, 'from', lower(p_period), 'to', upper(p_period)),
    'changed',
    'availability:' || i.product_id,
    true
  );
exception when others then
  -- Realtime lỗi không được làm hỏng việc đặt / sửa đơn; khách vẫn thấy lịch đúng khi tải lại
  raise warning 'notify_item_availability: %', sqlerrm;
end;
$$;

create function private.booking_items_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.notify_item_availability(new.item_id, new.blocked_period);
  end if;
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and (old.item_id, old.blocked_period) is distinct from (new.item_id, new.blocked_period)) then
    perform private.notify_item_availability(old.item_id, old.blocked_period);
  end if;
  return null;
end;
$$;

create trigger booking_items_notify
  after insert or delete or update of item_id, blocked_range, blocked_period, is_active on public.booking_items
  for each row execute function private.booking_items_notify();

-- Thêm chiếc, đổi size, cho vào / lấy ra khỏi bảo trì cũng làm đổi số chiếc trống
create function private.inventory_items_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('size', old.size), 'changed', 'availability:' || old.product_id, true);
  else
    perform realtime.send(jsonb_build_object('size', new.size), 'changed', 'availability:' || new.product_id, true);
    if tg_op = 'UPDATE' and (old.product_id, old.size) is distinct from (new.product_id, new.size) then
      perform realtime.send(jsonb_build_object('size', old.size), 'changed', 'availability:' || old.product_id, true);
    end if;
  end if;
  return null;
exception when others then
  raise warning 'inventory_items_notify: %', sqlerrm;
  return null;
end;
$$;

create trigger inventory_items_notify
  after insert or delete or update of status, size, product_id, home_branch_id on public.inventory_items
  for each row execute function private.inventory_items_notify();

-- Kênh availability:* : ai cũng nghe được tin và danh sách người đang xem;
-- khách chỉ được ghi presence của mình, tin "changed" chỉ DB phát (realtime.send bỏ qua RLS)
create policy "availability_listen" on realtime.messages
  for select to anon, authenticated
  using (
    realtime.topic() like 'availability:%'
    and realtime.messages.extension in ('broadcast', 'presence')
  );

create policy "availability_presence_track" on realtime.messages
  for insert to anon, authenticated
  with check (
    realtime.topic() like 'availability:%'
    and realtime.messages.extension = 'presence'
  );

-- ---------------------------------------------------------------------------
-- 2. Khung giờ còn trống (thuê theo giờ)
-- ---------------------------------------------------------------------------

-- Mỗi mốc 30 phút trong giờ mở cửa của ngày p_date: giờ trả muộn nhất còn thuê được nếu nhận
-- váy lúc đó (null = mọi chiếc size này đều bận). Thuê tối thiểu 1 giờ, trả trước giờ đóng cửa.
-- Cùng cách tính với calc_block_range: [nhận - chuyển cơ sở, trả + chuẩn bị + chuyển cơ sở)
create function public.get_hourly_slots(
  p_product_id uuid,
  p_size text,
  p_branch_id uuid,
  p_date date
)
returns table (start_at timestamptz, max_end_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with br as (
    select * from public.branches where id = p_branch_id and is_active
  ),
  s as (
    select hourly_buffer_minutes, transfer_days from public.settings
  ),
  starts as (
    select
      (t at time zone 'Asia/Ho_Chi_Minh') as start_at,
      ((p_date + br.close_time) at time zone 'Asia/Ho_Chi_Minh') as close_at
    from br,
      generate_series(p_date + br.open_time, p_date + br.close_time - interval '1 hour', interval '30 minutes') t
  ),
  item_ends as (
    select
      st.start_at,
      least(
        st.close_at,
        nb.next_lower - make_interval(mins => s.hourly_buffer_minutes) - tr.v
      ) as end_at
    from starts st
    cross join s
    join public.inventory_items i
      on i.product_id = p_product_id and i.size = p_size and i.status = 'active'
    cross join lateral (
      select case when i.home_branch_id <> p_branch_id then make_interval(days => s.transfer_days) else interval '0' end as v
    ) tr
    cross join lateral (
      -- Lượt giữ váy sớm nhất còn chưa kết thúc tính từ lúc váy phải rời kho
      select coalesce(min(lower(bi.blocked_range)), 'infinity'::timestamptz) as next_lower
      from public.booking_items bi
      where bi.item_id = i.id
        and bi.is_active
        and upper(bi.blocked_range) > st.start_at - tr.v
    ) nb
  )
  select st.start_at, max(ie.end_at) as max_end_at
  from starts st
  left join item_ends ie
    on ie.start_at = st.start_at and ie.end_at >= st.start_at + interval '1 hour'
  where st.start_at > now()
    and exists (
      select 1 from public.products p
      where p.id = p_product_id and (p.status = 'active' or private.is_staff())
    )
    and private.calc_hourly_price(p_product_id, p_branch_id, st.start_at, st.start_at + interval '1 hour') is not null
  group by st.start_at
  order by st.start_at
$$;

-- ---------------------------------------------------------------------------
-- 3. Chặn đơn web bất thường
-- ---------------------------------------------------------------------------

-- Đơn web (server gọi bằng service role sau captcha). Mỗi đơn chờ cọc giữ váy hold_hours giờ,
-- nên giới hạn số đơn chưa cọc của một SĐT để không ai giữ hết váy mà không cọc.
create function private.bookings_guard_web()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.jwt_role() is distinct from 'service_role' then
    return new;
  end if;

  if exists (select 1 from public.customers where id = new.customer_id and is_blacklisted) then
    raise exception 'Số điện thoại này chưa đặt online được. Bạn nhắn shop qua Facebook hoặc Zalo nhé.'
      using hint = 'customer_blocked';
  end if;

  if (
    select count(*) from public.bookings
    where customer_id = new.customer_id and status = 'pending' and source = 'web'
  ) >= 2 then
    raise exception 'Bạn đang có 2 đơn chờ cọc. Chuyển cọc cho các đơn đó hoặc nhắn shop trước khi đặt thêm.'
      using hint = 'too_many_pending';
  end if;

  return new;
end;
$$;

create trigger bookings_guard_web
  before insert on public.bookings
  for each row execute function private.bookings_guard_web();

revoke all on function
  private.notify_item_availability(uuid, daterange),
  private.booking_items_notify(),
  private.inventory_items_notify(),
  private.bookings_guard_web()
from public;
