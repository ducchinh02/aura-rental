-- Thuê theo giờ.
--   - Mẫu váy có giá gói N giờ + phụ thu mỗi giờ thêm (trống = không cho thuê theo giờ); cơ sở đặt giá riêng được.
--   - Đơn có rental_unit 'day' | 'hour'. Đơn giờ có pickup_at / return_at; pickup_date / return_date tự lấy theo giờ VN.
--   - Váy giữ theo khoảng thời điểm (blocked_range) để một chiếc cho thuê được nhiều lượt trong ngày,
--     cách nhau settings.hourly_buffer_minutes để là / hấp váy. blocked_period (ngày) vẫn giữ, tính từ blocked_range.

create type public.rental_unit as enum ('day', 'hour');

-- ---------------------------------------------------------------------------
-- Giá theo giờ
-- ---------------------------------------------------------------------------

alter table public.products
  add column hourly_price bigint check (hourly_price >= 0),
  add column hourly_hours int not null default 3 check (hourly_hours > 0),
  add column extra_hour_price bigint not null default 0 check (extra_hour_price >= 0);

comment on column public.products.hourly_price is 'Giá gói hourly_hours giờ; để trống = mẫu không cho thuê theo giờ';

alter table public.product_branch_prices
  alter column price drop not null,
  add column hourly_price bigint check (hourly_price >= 0),
  add column extra_hour_price bigint check (extra_hour_price >= 0);

alter table public.settings
  add column hourly_buffer_minutes int not null default 120 check (hourly_buffer_minutes between 0 and 1440);

-- Giá theo giờ cũng chỉ chủ shop được sửa
drop trigger products_guard_price on public.products;
create trigger products_guard_price
  before update on public.products
  for each row
  when (
    (new.base_price, new.rental_days, new.extra_day_price, new.deposit_amount, new.security_amount,
      new.hourly_price, new.hourly_hours, new.extra_hour_price)
    is distinct from
    (old.base_price, old.rental_days, old.extra_day_price, old.deposit_amount, old.security_amount,
      old.hourly_price, old.hourly_hours, old.extra_hour_price)
  )
  execute function private.products_guard_price();

-- Giá thuê giờ: gói N giờ + phụ thu mỗi giờ vượt gói (làm tròn lên). Null nếu mẫu không cho thuê theo giờ.
create function private.calc_hourly_price(
  p_product_id uuid,
  p_branch_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(bp.hourly_price, p.hourly_price)
    + greatest(0, ceil(extract(epoch from (p_return_at - p_pickup_at)) / 3600)::int - p.hourly_hours)
      * coalesce(bp.extra_hour_price, p.extra_hour_price)
  from public.products p
  left join public.product_branch_prices bp
    on bp.product_id = p.id and bp.branch_id = p_branch_id
  where p.id = p_product_id
$$;

-- Giá ngày: giá chung khi cơ sở chỉ đặt giá giờ riêng (price để trống)
create or replace function private.calc_rental_price(
  p_product_id uuid,
  p_branch_id uuid,
  p_pickup date,
  p_return date
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(bp.price, p.base_price)
    + greatest(0, (p_return - p_pickup + 1) - p.rental_days)
      * coalesce(bp.extra_day_price, p.extra_day_price)
  from public.products p
  left join public.product_branch_prices bp
    on bp.product_id = p.id and bp.branch_id = p_branch_id
  where p.id = p_product_id
$$;

-- ---------------------------------------------------------------------------
-- Đơn thuê theo giờ
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column rental_unit public.rental_unit not null default 'day',
  add column pickup_at timestamptz,
  add column return_at timestamptz,
  add constraint bookings_hourly_times check (
    rental_unit = 'day'
    or (
      pickup_at is not null
      and return_at > pickup_at
      and return_at <= pickup_at + interval '24 hours'
      and delivery_method = 'pickup'
    )
  );

create function private.bookings_sync_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rental_unit = 'hour' then
    new.pickup_date := (new.pickup_at at time zone 'Asia/Ho_Chi_Minh')::date;
    new.return_date := (new.return_at at time zone 'Asia/Ho_Chi_Minh')::date;
  else
    new.pickup_at := null;
    new.return_at := null;
  end if;
  return new;
end;
$$;

create trigger bookings_sync_times
  before insert or update of rental_unit, pickup_at, return_at, pickup_date, return_date on public.bookings
  for each row execute function private.bookings_sync_times();

-- Không đổi giờ thuê của đơn đã kết thúc (thêm các cột giờ vào kiểm tra cũ)
create or replace function private.bookings_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('picked_up', 'cancelled'))
      or (old.status = 'picked_up' and new.status = 'returned')
      or (old.status = 'returned' and new.status = 'completed')
    ) then
      raise exception 'Không thể chuyển đơn % từ "%" sang "%"', old.code, old.status, new.status
        using hint = 'invalid_status_transition';
    end if;

    case new.status
      when 'confirmed' then new.hold_expires_at := null;
      when 'picked_up' then new.picked_up_at := now();
      when 'returned' then new.returned_at := now();
      when 'completed' then new.completed_at := now();
      when 'cancelled' then new.cancelled_at := now();
      else null;
    end case;
  end if;

  if new.branch_id <> old.branch_id and old.status <> 'pending' then
    raise exception 'Chỉ đổi được cơ sở khi đơn còn chờ cọc' using hint = 'branch_locked';
  end if;

  if (new.pickup_date, new.return_date, new.delivery_method, new.ship_zone, new.rental_unit, new.pickup_at, new.return_at)
       is distinct from
     (old.pickup_date, old.return_date, old.delivery_method, old.ship_zone, old.rental_unit, old.pickup_at, old.return_at)
     and old.status in ('returned', 'completed', 'cancelled') then
    raise exception 'Đơn % đã kết thúc, không đổi được thời gian thuê', old.code using hint = 'booking_closed';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Giữ váy theo khoảng thời điểm
-- ---------------------------------------------------------------------------

-- Đơn ngày: đúng như blocked_period cũ, từ 0h ngày đầu tới 0h sau ngày cuối (giờ VN).
-- Đơn giờ: [nhận − ngày chuyển cơ sở, trả + thời gian chuẩn bị + ngày chuyển cơ sở).
create function private.calc_block_range(
  p_home_branch_id uuid,
  p_branch_id uuid,
  p_unit public.rental_unit,
  p_pickup date,
  p_return date,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_delivery public.delivery_method,
  p_ship_zone public.ship_zone
)
returns tstzrange
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.settings;
  v_transfer interval := interval '0';
  v_days daterange;
begin
  select * into s from public.settings;
  if p_home_branch_id <> p_branch_id then
    v_transfer := make_interval(days => s.transfer_days);
  end if;

  if p_unit = 'hour' then
    return tstzrange(
      p_pickup_at - v_transfer,
      p_return_at + make_interval(mins => s.hourly_buffer_minutes) + v_transfer,
      '[)'
    );
  end if;

  v_days := private.calc_blocked_period(p_home_branch_id, p_branch_id, p_pickup, p_return, p_delivery, p_ship_zone);
  return tstzrange(
    lower(v_days)::timestamp at time zone 'Asia/Ho_Chi_Minh',
    upper(v_days)::timestamp at time zone 'Asia/Ho_Chi_Minh',
    '[)'
  );
end;
$$;

-- Các ngày (giờ VN) mà khoảng thời điểm chạm tới, dạng daterange nửa mở như blocked_period
create function private.range_days(p_range tstzrange)
returns daterange
language sql
stable
set search_path = ''
as $$
  select daterange(
    (lower(p_range) at time zone 'Asia/Ho_Chi_Minh')::date,
    ((upper(p_range) - interval '1 microsecond') at time zone 'Asia/Ho_Chi_Minh')::date,
    '[]'
  )
$$;

alter table public.booking_items add column blocked_range tstzrange;

update public.booking_items
set blocked_range = tstzrange(
  lower(blocked_period)::timestamp at time zone 'Asia/Ho_Chi_Minh',
  upper(blocked_period)::timestamp at time zone 'Asia/Ho_Chi_Minh',
  '[)'
);

alter table public.booking_items alter column blocked_range set not null;

-- Chặn trùng lịch theo thời điểm thay vì theo ngày
alter table public.booking_items drop constraint booking_items_no_overlap;
alter table public.booking_items
  add constraint booking_items_no_overlap
  exclude using gist (item_id with =, blocked_range with &&) where (is_active);

-- Giá một chiếc váy trong đơn theo hình thức thuê
create function private.calc_item_price(p_product_id uuid, b public.bookings)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  v_price bigint;
begin
  if b.rental_unit = 'hour' then
    v_price := private.calc_hourly_price(p_product_id, b.branch_id, b.pickup_at, b.return_at);
    if v_price is null then
      raise exception '% chưa có giá thuê theo giờ', (select name from public.products where id = p_product_id)
        using hint = 'hourly_not_available';
    end if;
    return v_price;
  end if;
  return private.calc_rental_price(p_product_id, b.branch_id, b.pickup_date, b.return_date);
end;
$$;

create or replace function private.booking_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  i public.inventory_items;
begin
  select * into b from public.bookings where id = new.booking_id;
  select * into i from public.inventory_items where id = new.item_id;

  new.blocked_range := private.calc_block_range(
    i.home_branch_id, b.branch_id, b.rental_unit, b.pickup_date, b.return_date,
    b.pickup_at, b.return_at, b.delivery_method, b.ship_zone
  );
  new.blocked_period := private.range_days(new.blocked_range);

  if new.price is null then
    new.price := private.calc_item_price(i.product_id, b);
  end if;

  return new;
end;
$$;

create or replace function private.bookings_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.settings;
begin
  select * into s from public.settings;

  -- Đổi thời gian / cơ sở / cách giao: tính lại lịch giữ, giá (trừ giá đã sửa tay) và hạn chuyển váy
  if (new.branch_id, new.pickup_date, new.return_date, new.delivery_method, new.ship_zone,
      new.rental_unit, new.pickup_at, new.return_at)
       is distinct from
     (old.branch_id, old.pickup_date, old.return_date, old.delivery_method, old.ship_zone,
      old.rental_unit, old.pickup_at, old.return_at) then
    update public.booking_items bi
    set
      blocked_range = r.block,
      blocked_period = private.range_days(r.block),
      price = case when bi.is_price_custom then bi.price else private.calc_item_price(i.product_id, new) end
    from public.inventory_items i,
      lateral (
        select private.calc_block_range(
          i.home_branch_id, new.branch_id, new.rental_unit, new.pickup_date, new.return_date,
          new.pickup_at, new.return_at, new.delivery_method, new.ship_zone
        ) as block
      ) r
    where i.id = bi.item_id and bi.booking_id = new.id;

    update public.transfers t
    set due_date = lower(bi.blocked_period) + s.transfer_days
    from public.booking_items bi
    where bi.booking_id = new.id
      and t.booking_id = new.id
      and t.item_id = bi.item_id
      and t.status = 'pending'
      and t.to_branch_id = new.branch_id;
  end if;

  if new.status is distinct from old.status then
    insert into public.booking_events (booking_id, event, from_status, to_status, actor_id)
    values (new.id, 'status_changed', old.status, new.status, auth.uid());

    if new.status = 'confirmed' then
      -- Váy có kho gốc ở cơ sở kia: chuyển tới cơ sở thuê trước ngày nhận
      insert into public.transfers (item_id, booking_id, from_branch_id, to_branch_id, due_date)
      select bi.item_id, new.id, i.home_branch_id, new.branch_id, lower(bi.blocked_period) + s.transfer_days
      from public.booking_items bi
      join public.inventory_items i on i.id = bi.item_id
      where bi.booking_id = new.id and bi.is_active and i.home_branch_id <> new.branch_id;

    elsif new.status = 'returned' then
      -- Khách trả tại cơ sở thuê: chuyển váy về kho gốc
      insert into public.transfers (item_id, booking_id, from_branch_id, to_branch_id, due_date)
      select bi.item_id, new.id, new.branch_id, i.home_branch_id, upper(bi.blocked_period) - 1
      from public.booking_items bi
      join public.inventory_items i on i.id = bi.item_id
      where bi.booking_id = new.id and bi.is_active and i.home_branch_id <> new.branch_id;

    elsif new.status = 'cancelled' then
      update public.booking_items set is_active = false where booking_id = new.id;

      update public.transfers set status = 'cancelled'
      where booking_id = new.id and status = 'pending';

      -- Váy đã gửi đi rồi thì phải chuyển về
      insert into public.transfers (item_id, booking_id, from_branch_id, to_branch_id, due_date)
      select t.item_id, new.id, t.to_branch_id, t.from_branch_id, private.today_vn() + s.transfer_days
      from public.transfers t
      where t.booking_id = new.id
        and t.status in ('in_transit', 'received')
        and t.to_branch_id = new.branch_id;
    end if;
  end if;

  return null;
end;
$$;

-- Chiếc còn trống cho kỳ thuê (ngày hoặc giờ), ưu tiên chiếc có kho gốc tại cơ sở thuê
drop function private.find_free_item(uuid, text, uuid, date, date, public.delivery_method, public.ship_zone);

create function private.find_free_item(
  p_product_id uuid,
  p_size text,
  p_branch_id uuid,
  p_unit public.rental_unit,
  p_pickup date,
  p_return date,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_delivery public.delivery_method,
  p_ship_zone public.ship_zone
)
returns uuid
language sql
stable
set search_path = ''
as $$
  select i.id
  from public.inventory_items i
  where i.product_id = p_product_id
    and i.size = p_size
    and i.status = 'active'
    and not exists (
      select 1 from public.booking_items bi
      where bi.item_id = i.id
        and bi.is_active
        and bi.blocked_range && private.calc_block_range(
          i.home_branch_id, p_branch_id, p_unit, p_pickup, p_return, p_pickup_at, p_return_at, p_delivery, p_ship_zone
        )
    )
  order by (i.home_branch_id = p_branch_id) desc, i.code
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- RPC: tạo đơn (thêm thuê theo giờ)
-- ---------------------------------------------------------------------------

drop function public.create_booking(
  uuid, jsonb, jsonb, date, date, public.delivery_method, public.ship_zone, text, public.booking_source, text
);

create function public.create_booking(
  p_branch_id uuid,
  p_customer jsonb,
  p_items jsonb,
  p_pickup_date date,
  p_return_date date,
  p_delivery public.delivery_method default 'pickup',
  p_ship_zone public.ship_zone default null,
  p_shipping_address text default null,
  p_source public.booking_source default 'web',
  p_customer_note text default null,
  p_unit public.rental_unit default 'day',
  p_pickup_at timestamptz default null,
  p_return_at timestamptz default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jwt_role text := private.jwt_role();
  v_is_staff boolean := v_jwt_role is null or private.can_manage_branch(p_branch_id);
  v_booking public.bookings;
  v_item jsonb;
  v_item_id uuid;
  v_product public.products;
  v_size text;
  v_attempts int;
  v_period text := case when p_unit = 'hour' then 'khung giờ' else 'khoảng ngày' end;
  br public.branches;
  s public.settings;
begin
  if not v_is_staff and v_jwt_role is distinct from 'service_role' then
    raise exception 'Bạn không có quyền tạo đơn ở cơ sở này' using errcode = '42501';
  end if;

  if not v_is_staff then
    p_source := 'web';
  end if;

  select * into br from public.branches where id = p_branch_id and is_active;
  if br.id is null then
    raise exception 'Cơ sở không tồn tại' using hint = 'invalid_branch';
  end if;

  if p_unit = 'hour' then
    if p_pickup_at is null or p_return_at is null or p_return_at <= p_pickup_at then
      raise exception 'Giờ trả phải sau giờ nhận' using hint = 'invalid_times';
    end if;
    if p_return_at > p_pickup_at + interval '24 hours' then
      raise exception 'Thuê theo giờ tối đa 24 giờ. Thuê lâu hơn hãy chọn thuê theo ngày.' using hint = 'invalid_times';
    end if;
    if p_delivery = 'ship' then
      raise exception 'Thuê theo giờ chỉ nhận và trả váy tại shop' using hint = 'hourly_pickup_only';
    end if;
    if not v_is_staff then
      if p_pickup_at < now() then
        raise exception 'Giờ nhận đã qua' using hint = 'invalid_times';
      end if;
      if (p_pickup_at at time zone 'Asia/Ho_Chi_Minh')::time < br.open_time
         or (p_return_at at time zone 'Asia/Ho_Chi_Minh')::time > br.close_time
         or (p_return_at at time zone 'Asia/Ho_Chi_Minh')::date <> (p_pickup_at at time zone 'Asia/Ho_Chi_Minh')::date then
        raise exception 'Giờ nhận và trả phải trong giờ mở cửa (% – %)', to_char(br.open_time, 'HH24:MI'), to_char(br.close_time, 'HH24:MI')
          using hint = 'invalid_times';
      end if;
    end if;
    p_pickup_date := (p_pickup_at at time zone 'Asia/Ho_Chi_Minh')::date;
    p_return_date := (p_return_at at time zone 'Asia/Ho_Chi_Minh')::date;
  else
    p_pickup_at := null;
    p_return_at := null;
  end if;

  if p_return_date < p_pickup_date then
    raise exception 'Ngày trả phải sau ngày nhận' using hint = 'invalid_dates';
  end if;
  if not v_is_staff and p_pickup_date < private.today_vn() then
    raise exception 'Ngày nhận đã qua' using hint = 'invalid_dates';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Đơn chưa có váy nào' using hint = 'no_items';
  end if;
  if jsonb_array_length(p_items) > 10 then
    raise exception 'Mỗi đơn tối đa 10 váy' using hint = 'too_many_items';
  end if;

  if p_delivery = 'pickup' then
    p_ship_zone := null;
    p_shipping_address := null;
  elsif p_ship_zone is null or nullif(trim(p_shipping_address), '') is null then
    raise exception 'Vui lòng nhập địa chỉ và khu vực giao hàng' using hint = 'missing_shipping';
  end if;

  select * into s from public.settings;

  insert into public.bookings (
    code, branch_id, customer_id, source, rental_unit, pickup_date, return_date, pickup_at, return_at,
    delivery_method, ship_zone, shipping_address, hold_expires_at, customer_note, created_by
  )
  values (
    private.next_booking_code(), p_branch_id, private.upsert_customer(p_customer), p_source, p_unit,
    p_pickup_date, p_return_date, p_pickup_at, p_return_at, p_delivery, p_ship_zone, trim(p_shipping_address),
    now() + make_interval(hours => s.hold_hours), nullif(trim(p_customer_note), ''), auth.uid()
  )
  returning * into v_booking;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item ? 'item_id' then
      if not v_is_staff then
        raise exception 'Không được chọn chiếc váy cụ thể' using errcode = '42501';
      end if;

      v_item_id := (v_item ->> 'item_id')::uuid;
      if not exists (select 1 from public.inventory_items where id = v_item_id and status = 'active') then
        raise exception 'Không tìm thấy váy hoặc váy đang bảo trì' using hint = 'item_not_found';
      end if;

      begin
        insert into public.booking_items (booking_id, item_id) values (v_booking.id, v_item_id);
      exception when exclusion_violation then
        raise exception 'Váy % đã có lịch trong % này',
          (select code from public.inventory_items where id = v_item_id), v_period
          using hint = 'item_unavailable';
      end;
    else
      v_size := v_item ->> 'size';
      select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;

      if v_product.id is null or (not v_is_staff and v_product.status <> 'active') then
        raise exception 'Không tìm thấy mẫu váy' using hint = 'product_not_found';
      end if;
      if p_unit = 'hour' and private.calc_hourly_price(v_product.id, p_branch_id, p_pickup_at, p_return_at) is null then
        raise exception '% chưa cho thuê theo giờ', v_product.name using hint = 'hourly_not_available';
      end if;

      -- Chiếc vừa chọn có thể bị đơn khác giữ cùng lúc: thử chiếc khác vài lần
      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_item_id := private.find_free_item(
          v_product.id, v_size, p_branch_id, p_unit, p_pickup_date, p_return_date,
          p_pickup_at, p_return_at, p_delivery, p_ship_zone
        );
        if v_item_id is null or v_attempts > 5 then
          raise exception '% (size %) đã kín lịch trong % này', v_product.name, v_size, v_period
            using hint = 'item_unavailable';
        end if;

        begin
          insert into public.booking_items (booking_id, item_id) values (v_booking.id, v_item_id);
          exit;
        exception when exclusion_violation then
          null;
        end;
      end loop;
    end if;
  end loop;

  perform private.refresh_booking_deposits(v_booking.id);

  select * into v_booking from public.bookings where id = v_booking.id;
  return v_booking;
end;
$$;

revoke execute on function public.create_booking from public, anon;

-- Thêm váy vào đơn: tìm chiếc trống theo đúng hình thức thuê của đơn
create or replace function public.add_booking_item(p_booking_id uuid, p_product_id uuid, p_size text)
returns public.booking_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_product public.products;
  v_item_id uuid;
  v_row public.booking_items;
  v_attempts int := 0;
  s public.settings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Không tìm thấy đơn' using hint = 'booking_not_found';
  end if;
  if private.jwt_role() is not null and not private.can_manage_branch(b.branch_id) then
    raise exception 'Bạn không có quyền sửa đơn ở cơ sở này' using errcode = '42501';
  end if;
  if b.status not in ('pending', 'confirmed') then
    raise exception 'Chỉ đổi váy được khi khách chưa nhận váy' using hint = 'booking_locked';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null then
    raise exception 'Không tìm thấy mẫu váy' using hint = 'product_not_found';
  end if;
  if b.rental_unit = 'hour' and private.calc_hourly_price(v_product.id, b.branch_id, b.pickup_at, b.return_at) is null then
    raise exception '% chưa cho thuê theo giờ', v_product.name using hint = 'hourly_not_available';
  end if;

  loop
    v_attempts := v_attempts + 1;
    v_item_id := private.find_free_item(
      p_product_id, p_size, b.branch_id, b.rental_unit, b.pickup_date, b.return_date,
      b.pickup_at, b.return_at, b.delivery_method, b.ship_zone
    );
    if v_item_id is null or v_attempts > 5 then
      raise exception '% (size %) đã kín lịch trong thời gian này', v_product.name, p_size
        using hint = 'item_unavailable';
    end if;

    begin
      insert into public.booking_items (booking_id, item_id) values (b.id, v_item_id)
      returning * into v_row;
      exit;
    exception when exclusion_violation then
      null;
    end;
  end loop;

  -- Đơn đã cọc: váy ở kho gốc khác cần phiếu chuyển ngay
  if b.status = 'confirmed' then
    select * into s from public.settings;
    insert into public.transfers (item_id, booking_id, from_branch_id, to_branch_id, due_date)
    select v_row.item_id, b.id, i.home_branch_id, b.branch_id, lower(v_row.blocked_period) + s.transfer_days
    from public.inventory_items i
    where i.id = v_row.item_id and i.home_branch_id <> b.branch_id;
  end if;

  perform private.refresh_booking_deposits(b.id);
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: báo giá (thêm thuê theo giờ)
-- ---------------------------------------------------------------------------

drop function public.quote_rental(uuid, text, uuid, date, date, public.delivery_method, public.ship_zone);

create function public.quote_rental(
  p_product_id uuid,
  p_size text,
  p_branch_id uuid,
  p_pickup_date date,
  p_return_date date,
  p_delivery public.delivery_method default 'pickup',
  p_ship_zone public.ship_zone default null,
  p_unit public.rental_unit default 'day',
  p_pickup_at timestamptz default null,
  p_return_at timestamptz default null
)
returns table (available boolean, price bigint, deposit bigint, rental_days int, hours int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.find_free_item(
      p.id, p_size, p_branch_id, p_unit, d.pickup, d.ret, p_pickup_at, p_return_at, p_delivery, p_ship_zone
    ) is not null,
    case
      when p_unit = 'hour' then private.calc_hourly_price(p.id, p_branch_id, p_pickup_at, p_return_at)
      else private.calc_rental_price(p.id, p_branch_id, d.pickup, d.ret)
    end,
    p.deposit_amount,
    d.ret - d.pickup + 1,
    case when p_unit = 'hour' then ceil(extract(epoch from (p_return_at - p_pickup_at)) / 3600)::int end
  from public.products p,
    lateral (
      select
        case when p_unit = 'hour' then (p_pickup_at at time zone 'Asia/Ho_Chi_Minh')::date else p_pickup_date end as pickup,
        case when p_unit = 'hour' then (p_return_at at time zone 'Asia/Ho_Chi_Minh')::date else p_return_date end as ret
    ) d
  where p.id = p_product_id
    and d.ret >= d.pickup
    and (p_unit = 'day' or p_return_at > p_pickup_at)
    and (p.status = 'active' or private.is_staff())
$$;

-- Tra cứu đơn: thêm hình thức thuê và giờ
create or replace function public.lookup_booking(p_code text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', b.code,
    'status', b.status,
    'rental_unit', b.rental_unit,
    'pickup_date', b.pickup_date,
    'return_date', b.return_date,
    'pickup_at', b.pickup_at,
    'return_at', b.return_at,
    'delivery_method', b.delivery_method,
    'total', b.total,
    'deposit_required', b.deposit_required,
    'amount_paid', t.amount_paid,
    'hold_expires_at', b.hold_expires_at,
    'branch', jsonb_build_object(
      'name', br.name, 'address', br.address, 'phone', br.phone, 'map_url', br.map_url
    ),
    'items', (
      select jsonb_agg(jsonb_build_object('product_name', p.name, 'size', i.size, 'price', bi.price) order by p.name)
      from public.booking_items bi
      join public.inventory_items i on i.id = bi.item_id
      join public.products p on p.id = i.product_id
      where bi.booking_id = b.id
    )
  )
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  join public.branches br on br.id = b.branch_id
  join public.booking_payment_totals t on t.booking_id = b.id
  where upper(b.code) = upper(trim(p_code))
    and c.phone = private.normalize_phone(p_phone)
$$;

-- Hàm mới trong schema private chỉ dùng nội bộ
revoke all on function
  private.calc_hourly_price(uuid, uuid, timestamptz, timestamptz),
  private.calc_block_range(uuid, uuid, public.rental_unit, date, date, timestamptz, timestamptz, public.delivery_method, public.ship_zone),
  private.range_days(tstzrange),
  private.calc_item_price(uuid, public.bookings),
  private.find_free_item(uuid, text, uuid, public.rental_unit, date, date, timestamptz, timestamptz, public.delivery_method, public.ship_zone),
  private.bookings_sync_times()
from public;
