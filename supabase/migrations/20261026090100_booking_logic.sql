-- Nghiệp vụ đặt váy: quyền, tính giá, khoá lịch, luồng trạng thái đơn,
-- phiếu chuyển váy giữa cơ sở và các RPC cho trang khách / trang quản trị.

-- ---------------------------------------------------------------------------
-- Quyền
-- ---------------------------------------------------------------------------

-- Vai trò trong JWT của request; null khi chạy thẳng trong DB (migration, seed, cron)
create function private.jwt_role()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
  )
$$;

create function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active and role = 'owner'
  )
$$;

-- Chủ shop quản lý mọi cơ sở; nhân viên chỉ cơ sở của mình
create function private.can_manage_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active
      and (role = 'owner' or branch_id = p_branch_id)
  )
$$;

create function private.can_manage_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_branch(
    (select branch_id from public.bookings where id = p_booking_id)
  )
$$;

-- ---------------------------------------------------------------------------
-- Tính giá & khoảng ngày khoá
-- ---------------------------------------------------------------------------

-- Giá thuê 1 chiếc: giá gói (giá riêng của cơ sở nếu có) + phụ thu mỗi ngày vượt gói.
-- Số ngày thuê tính cả ngày nhận và ngày trả.
create function private.calc_rental_price(
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

-- Váy bị khoá từ lúc rời cơ sở/kho gốc tới khi giặt xong và về lại kho gốc:
--   [nhận − ship − chuyển cơ sở, trả + ship + giặt + chuyển cơ sở]
create function private.calc_blocked_period(
  p_home_branch_id uuid,
  p_branch_id uuid,
  p_pickup date,
  p_return date,
  p_delivery public.delivery_method,
  p_ship_zone public.ship_zone
)
returns daterange
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.settings;
  v_ship int := 0;
  v_transfer int := 0;
begin
  select * into s from public.settings;

  if p_delivery = 'ship' then
    v_ship := case p_ship_zone when 'province' then s.ship_days_province else s.ship_days_local end;
  end if;

  if p_home_branch_id <> p_branch_id then
    v_transfer := s.transfer_days;
  end if;

  return daterange(
    p_pickup - v_ship - v_transfer,
    p_return + v_ship + s.cleaning_days + v_transfer,
    '[]'
  );
end;
$$;

-- Chiếc váy còn trống cho kỳ thuê, ưu tiên chiếc có kho gốc tại cơ sở thuê
create function private.find_free_item(
  p_product_id uuid,
  p_size text,
  p_branch_id uuid,
  p_pickup date,
  p_return date,
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
        and bi.blocked_period && private.calc_blocked_period(
          i.home_branch_id, p_branch_id, p_pickup, p_return, p_delivery, p_ship_zone
        )
    )
  order by (i.home_branch_id = p_branch_id) desc, i.code
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Mã đơn: AR-YYMMDD-NN, đánh số lại mỗi ngày
-- ---------------------------------------------------------------------------

create table private.booking_code_counters (
  day date primary key,
  last_value int not null
);

create function private.next_booking_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_day date := private.today_vn();
  v_n int;
begin
  insert into private.booking_code_counters as c (day, last_value)
  values (v_day, 1)
  on conflict (day) do update set last_value = c.last_value + 1
  returning last_value into v_n;

  return 'AR-' || to_char(v_day, 'YYMMDD') || '-' || lpad(v_n::text, 2, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Khách hàng: tìm theo SĐT, chưa có thì tạo; không ghi đè thông tin đã có
-- ---------------------------------------------------------------------------

create function private.upsert_customer(p_customer jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_phone text := private.normalize_phone(p_customer ->> 'phone');
  v_name text := trim(p_customer ->> 'full_name');
  v_id uuid;
begin
  if v_phone !~ '^0\d{9,10}$' then
    raise exception 'Số điện thoại không hợp lệ' using hint = 'invalid_phone';
  end if;
  if coalesce(v_name, '') = '' then
    raise exception 'Vui lòng nhập tên khách' using hint = 'missing_name';
  end if;

  insert into public.customers as c (full_name, phone, email, facebook_url, zalo, address)
  values (
    v_name,
    v_phone,
    nullif(trim(p_customer ->> 'email'), ''),
    nullif(trim(p_customer ->> 'facebook_url'), ''),
    nullif(trim(p_customer ->> 'zalo'), ''),
    nullif(trim(p_customer ->> 'address'), '')
  )
  on conflict (phone) do update set
    email = coalesce(c.email, excluded.email),
    facebook_url = coalesce(c.facebook_url, excluded.facebook_url),
    zalo = coalesce(c.zalo, excluded.zalo),
    address = coalesce(c.address, excluded.address)
  returning id into v_id;

  return v_id;
end;
$$;

-- Cọc giữ chỗ và thế chấp của đơn = tổng theo các mẫu váy trong đơn
create function private.refresh_booking_deposits(p_booking_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.bookings b
  set deposit_required = x.deposit, security_deposit = x.security
  from (
    select coalesce(sum(p.deposit_amount), 0) as deposit, coalesce(sum(p.security_amount), 0) as security
    from public.booking_items bi
    join public.inventory_items i on i.id = bi.item_id
    join public.products p on p.id = i.product_id
    where bi.booking_id = p_booking_id
  ) x
  where b.id = p_booking_id
$$;

-- ---------------------------------------------------------------------------
-- Trigger: booking_items
-- ---------------------------------------------------------------------------

create function private.booking_items_before_write()
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

  new.blocked_period := private.calc_blocked_period(
    i.home_branch_id, b.branch_id, b.pickup_date, b.return_date, b.delivery_method, b.ship_zone
  );

  if new.price is null then
    new.price := private.calc_rental_price(i.product_id, b.branch_id, b.pickup_date, b.return_date);
  end if;

  return new;
end;
$$;

create trigger booking_items_before_write
  before insert or update of item_id on public.booking_items
  for each row execute function private.booking_items_before_write();

create function private.booking_items_sync_subtotal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid := coalesce(new.booking_id, old.booking_id);
begin
  update public.bookings
  set subtotal = coalesce((select sum(price) from public.booking_items where booking_id = v_booking_id), 0)
  where id = v_booking_id;
  return null;
end;
$$;

create trigger booking_items_sync_subtotal
  after insert or update of price or delete on public.booking_items
  for each row execute function private.booking_items_sync_subtotal();

create function private.booking_items_log_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_events (booking_id, event, data, actor_id)
  values (
    new.booking_id,
    'price_changed',
    jsonb_build_object('item_id', new.item_id, 'from', old.price, 'to', new.price),
    auth.uid()
  );
  return null;
end;
$$;

create trigger booking_items_log_price
  after update of price on public.booking_items
  for each row
  when (new.price is distinct from old.price and new.is_price_custom)
  execute function private.booking_items_log_price();

-- ---------------------------------------------------------------------------
-- Trigger: bookings
-- ---------------------------------------------------------------------------

create function private.bookings_before_update()
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

  if (new.pickup_date, new.return_date, new.delivery_method, new.ship_zone)
       is distinct from (old.pickup_date, old.return_date, old.delivery_method, old.ship_zone)
     and old.status in ('returned', 'completed', 'cancelled') then
    raise exception 'Đơn % đã kết thúc, không đổi được ngày', old.code using hint = 'booking_closed';
  end if;

  return new;
end;
$$;

create trigger bookings_before_update
  before update on public.bookings
  for each row execute function private.bookings_before_update();

create function private.bookings_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_events (booking_id, event, to_status, actor_id)
  values (new.id, 'created', new.status, auth.uid());
  return null;
end;
$$;

create trigger bookings_after_insert
  after insert on public.bookings
  for each row execute function private.bookings_after_insert();

create function private.bookings_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.settings;
begin
  select * into s from public.settings;

  -- Đổi ngày / cơ sở / cách giao: tính lại lịch khoá, giá (trừ giá đã sửa tay) và hạn chuyển váy
  if (new.branch_id, new.pickup_date, new.return_date, new.delivery_method, new.ship_zone)
       is distinct from (old.branch_id, old.pickup_date, old.return_date, old.delivery_method, old.ship_zone) then
    update public.booking_items bi
    set
      blocked_period = private.calc_blocked_period(
        i.home_branch_id, new.branch_id, new.pickup_date, new.return_date, new.delivery_method, new.ship_zone
      ),
      price = case
        when bi.is_price_custom then bi.price
        else private.calc_rental_price(i.product_id, new.branch_id, new.pickup_date, new.return_date)
      end
    from public.inventory_items i
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

create trigger bookings_after_update
  after update on public.bookings
  for each row execute function private.bookings_after_update();

-- ---------------------------------------------------------------------------
-- Trigger: transfers (cơ sở gửi bấm "đã gửi", cơ sở nhận bấm "đã nhận")
-- ---------------------------------------------------------------------------

create function private.transfers_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('in_transit', 'cancelled'))
    or (old.status = 'in_transit' and new.status = 'received')
  ) then
    raise exception 'Không thể chuyển phiếu từ "%" sang "%"', old.status, new.status
      using hint = 'invalid_transfer_transition';
  end if;

  if new.status = 'in_transit' then
    if auth.uid() is not null and not private.can_manage_branch(new.from_branch_id) then
      raise exception 'Chỉ cơ sở gửi mới xác nhận đã gửi váy' using errcode = '42501';
    end if;
    new.sent_at := now();
    new.sent_by := auth.uid();
  elsif new.status = 'received' then
    if auth.uid() is not null and not private.can_manage_branch(new.to_branch_id) then
      raise exception 'Chỉ cơ sở nhận mới xác nhận đã nhận váy' using errcode = '42501';
    end if;
    new.received_at := now();
    new.received_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger transfers_before_update
  before update on public.transfers
  for each row execute function private.transfers_before_update();

-- ---------------------------------------------------------------------------
-- Trigger: chặn đổi kho gốc khi váy còn đơn sắp tới, chặn nhân viên sửa giá
-- ---------------------------------------------------------------------------

create function private.inventory_items_guard_home()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.booking_items bi
    where bi.item_id = new.id
      and bi.is_active
      and upper(bi.blocked_period) > private.today_vn()
  ) then
    raise exception 'Váy % còn đơn sắp tới, chưa đổi được kho gốc', new.code using hint = 'item_has_bookings';
  end if;
  return new;
end;
$$;

create trigger inventory_items_guard_home
  before update of home_branch_id on public.inventory_items
  for each row
  when (new.home_branch_id is distinct from old.home_branch_id)
  execute function private.inventory_items_guard_home();

create function private.products_guard_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.is_owner() then
    raise exception 'Chỉ chủ shop được sửa giá' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger products_guard_price
  before update on public.products
  for each row
  when (
    (new.base_price, new.rental_days, new.extra_day_price, new.deposit_amount, new.security_amount)
    is distinct from
    (old.base_price, old.rental_days, old.extra_day_price, old.deposit_amount, old.security_amount)
  )
  execute function private.products_guard_price();

-- ---------------------------------------------------------------------------
-- Tự huỷ đơn chờ cọc quá hạn giữ chỗ (đơn đã ghi nhận tiền thì giữ lại)
-- ---------------------------------------------------------------------------

create function private.expire_pending_bookings()
returns int
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.bookings b
    set status = 'cancelled', cancel_reason = 'Hết hạn giữ chỗ chưa cọc'
    where b.status = 'pending'
      and b.hold_expires_at < now()
      and not exists (
        select 1 from public.payments p where p.booking_id = b.id and p.kind = 'payment'
      )
    returning 1
  )
  select count(*)::int from expired
$$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create view public.booking_payment_totals
with (security_invoker = true) as
select
  b.id as booking_id,
  b.total,
  coalesce(sum(p.amount) filter (where p.kind = 'payment'), 0)
    - coalesce(sum(p.amount) filter (where p.kind = 'refund'), 0) as amount_paid,
  b.total
    - coalesce(sum(p.amount) filter (where p.kind = 'payment'), 0)
    + coalesce(sum(p.amount) filter (where p.kind = 'refund'), 0) as balance_due,
  coalesce(sum(p.amount) filter (where p.kind = 'security_hold'), 0)
    - coalesce(sum(p.amount) filter (where p.kind = 'security_return'), 0) as security_held
from public.bookings b
left join public.payments p on p.booking_id = b.id
group by b.id;

-- Vị trí hiện tại của từng chiếc: theo phiếu chuyển gần nhất, hoặc đang ở chỗ khách
create view public.item_locations
with (security_invoker = true) as
select
  i.id as item_id,
  i.home_branch_id,
  case when t.status = 'in_transit' then null else coalesce(t.to_branch_id, i.home_branch_id) end as current_branch_id,
  coalesce(t.status = 'in_transit', false) as in_transit,
  r.booking_id as rented_booking_id
from public.inventory_items i
left join lateral (
  select tr.status, tr.to_branch_id
  from public.transfers tr
  where tr.item_id = i.id and tr.status in ('in_transit', 'received')
  order by coalesce(tr.received_at, tr.sent_at) desc
  limit 1
) t on true
left join lateral (
  select bi.booking_id
  from public.booking_items bi
  join public.bookings b on b.id = bi.booking_id
  where bi.item_id = i.id and b.status = 'picked_up'
  limit 1
) r on true;

-- ---------------------------------------------------------------------------
-- RPC: tạo đơn
--   - Nhân viên (đăng nhập): tạo đơn ở cơ sở mình, được chọn chiếc cụ thể ({item_id}).
--   - Trang khách: server gọi bằng service role sau khi kiểm tra captcha; luôn là đơn web.
-- p_items: [{ "product_id": uuid, "size": text }] hoặc [{ "item_id": uuid }]
-- ---------------------------------------------------------------------------

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
  p_customer_note text default null
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
  s public.settings;
begin
  if not v_is_staff and v_jwt_role is distinct from 'service_role' then
    raise exception 'Bạn không có quyền tạo đơn ở cơ sở này' using errcode = '42501';
  end if;

  if not v_is_staff then
    p_source := 'web';
  end if;

  if not exists (select 1 from public.branches where id = p_branch_id and is_active) then
    raise exception 'Cơ sở không tồn tại' using hint = 'invalid_branch';
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
    code, branch_id, customer_id, source, pickup_date, return_date,
    delivery_method, ship_zone, shipping_address, hold_expires_at, customer_note, created_by
  )
  values (
    private.next_booking_code(), p_branch_id, private.upsert_customer(p_customer), p_source,
    p_pickup_date, p_return_date, p_delivery, p_ship_zone, trim(p_shipping_address),
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
        raise exception 'Váy % đã có lịch trong khoảng ngày này',
          (select code from public.inventory_items where id = v_item_id)
          using hint = 'item_unavailable';
      end;
    else
      v_size := v_item ->> 'size';
      select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;

      if v_product.id is null or (not v_is_staff and v_product.status <> 'active') then
        raise exception 'Không tìm thấy mẫu váy' using hint = 'product_not_found';
      end if;

      -- Chiếc vừa chọn có thể bị đơn khác giữ cùng lúc: thử chiếc khác vài lần
      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_item_id := private.find_free_item(
          v_product.id, v_size, p_branch_id, p_pickup_date, p_return_date, p_delivery, p_ship_zone
        );
        if v_item_id is null or v_attempts > 5 then
          raise exception '% (size %) đã kín lịch trong khoảng ngày này', v_product.name, v_size
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

-- ---------------------------------------------------------------------------
-- RPC: đổi váy trong đơn chưa giao (thêm theo mẫu + size, bỏ 1 chiếc)
-- ---------------------------------------------------------------------------

create function public.add_booking_item(p_booking_id uuid, p_product_id uuid, p_size text)
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

  loop
    v_attempts := v_attempts + 1;
    v_item_id := private.find_free_item(
      p_product_id, p_size, b.branch_id, b.pickup_date, b.return_date, b.delivery_method, b.ship_zone
    );
    if v_item_id is null or v_attempts > 5 then
      raise exception '% (size %) đã kín lịch trong khoảng ngày này', v_product.name, p_size
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

revoke execute on function public.add_booking_item from public, anon;

create function public.remove_booking_item(p_booking_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bi public.booking_items;
  b public.bookings;
begin
  select * into bi from public.booking_items where id = p_booking_item_id;
  select * into b from public.bookings where id = bi.booking_id;
  if b.id is null then
    raise exception 'Không tìm thấy váy trong đơn' using hint = 'booking_not_found';
  end if;
  if private.jwt_role() is not null and not private.can_manage_branch(b.branch_id) then
    raise exception 'Bạn không có quyền sửa đơn ở cơ sở này' using errcode = '42501';
  end if;
  if b.status not in ('pending', 'confirmed') then
    raise exception 'Chỉ đổi váy được khi khách chưa nhận váy' using hint = 'booking_locked';
  end if;
  if (select count(*) from public.booking_items where booking_id = b.id) <= 1 then
    raise exception 'Đơn phải còn ít nhất 1 váy. Muốn bỏ hết thì hủy đơn.' using hint = 'last_item';
  end if;

  delete from public.booking_items where id = bi.id;

  update public.transfers set status = 'cancelled'
  where booking_id = b.id and item_id = bi.item_id and status = 'pending';

  perform private.refresh_booking_deposits(b.id);
end;
$$;

revoke execute on function public.remove_booking_item from public, anon;

-- ---------------------------------------------------------------------------
-- RPC công khai cho trang khách
-- ---------------------------------------------------------------------------

-- Báo giá + kiểm tra còn váy cho 1 kỳ thuê
create function public.quote_rental(
  p_product_id uuid,
  p_size text,
  p_branch_id uuid,
  p_pickup_date date,
  p_return_date date,
  p_delivery public.delivery_method default 'pickup',
  p_ship_zone public.ship_zone default null
)
returns table (available boolean, price bigint, deposit bigint, rental_days int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.find_free_item(
      p.id, p_size, p_branch_id, p_pickup_date, p_return_date, p_delivery, p_ship_zone
    ) is not null,
    private.calc_rental_price(p.id, p_branch_id, p_pickup_date, p_return_date),
    p.deposit_amount,
    p_return_date - p_pickup_date + 1
  from public.products p
  where p.id = p_product_id
    and p_return_date >= p_pickup_date
    and (p.status = 'active' or private.is_staff())
$$;

-- Những ngày không thể nhận váy (mọi chiếc của size đó đều bận), tối đa 180 ngày
create function public.get_unavailable_dates(
  p_product_id uuid,
  p_size text,
  p_branch_id uuid,
  p_from date,
  p_to date,
  p_delivery public.delivery_method default 'pickup',
  p_ship_zone public.ship_zone default null
)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select d::date
  from generate_series(p_from::timestamp, least(p_to, p_from + 180)::timestamp, interval '1 day') d
  where exists (
      select 1 from public.products
      where id = p_product_id and (status = 'active' or private.is_staff())
    )
    and not exists (
      select 1
      from public.inventory_items i
      where i.product_id = p_product_id
        and i.size = p_size
        and i.status = 'active'
        and not exists (
          select 1 from public.booking_items bi
          where bi.item_id = i.id
            and bi.is_active
            and bi.blocked_period && private.calc_blocked_period(
              i.home_branch_id, p_branch_id, d::date, d::date, p_delivery, p_ship_zone
            )
        )
    )
  order by 1
$$;

-- Khách tra cứu đơn bằng mã đơn + SĐT
create function public.lookup_booking(p_code text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', b.code,
    'status', b.status,
    'pickup_date', b.pickup_date,
    'return_date', b.return_date,
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
