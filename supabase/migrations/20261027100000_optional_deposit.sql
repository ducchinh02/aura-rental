-- Tuỳ chọn cọc theo mẫu váy
--   products.requires_deposit = false: khách đặt mẫu này không phải chuyển cọc.
--   Đơn có tổng cọc = 0 vẫn giữ váy ở trạng thái chờ (pending) cho tới khi shop gọi khách và
--   bấm xác nhận; không có hạn giữ chỗ nên không bị cron tự huỷ.
--   Mỗi SĐT vẫn tối đa 2 đơn web đang chờ (bookings_guard_web) nên không ai giữ hết váy được.

alter table public.products
  add column requires_deposit boolean not null default true;

comment on column public.products.requires_deposit is
  'false = đặt mẫu này không cần cọc giữ chỗ; đơn chờ shop xác nhận, không tự huỷ';

-- Bật / tắt cọc cũng là chính sách giá: chỉ chủ shop sửa
drop trigger products_guard_price on public.products;
create trigger products_guard_price
  before update on public.products
  for each row
  when (
    (new.base_price, new.rental_days, new.extra_day_price, new.deposit_amount, new.security_amount,
      new.hourly_price, new.hourly_hours, new.extra_hour_price, new.requires_deposit)
    is distinct from
    (old.base_price, old.rental_days, old.extra_day_price, old.deposit_amount, old.security_amount,
      old.hourly_price, old.hourly_hours, old.extra_hour_price, old.requires_deposit)
  )
  execute function private.products_guard_price();

-- Cọc của đơn = tổng cọc các mẫu cần cọc. Hạn giữ chỗ chỉ có khi đơn chờ còn cần cọc:
-- đổi váy làm đơn hết cần cọc thì bỏ hạn; thêm váy cần cọc vào đơn đang chờ thì bắt đầu tính hạn.
create or replace function private.refresh_booking_deposits(p_booking_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.bookings b
  set
    deposit_required = x.deposit,
    security_deposit = x.security,
    hold_expires_at = case
      when b.status <> 'pending' then b.hold_expires_at
      when x.deposit = 0 then null
      else coalesce(b.hold_expires_at, now() + make_interval(hours => s.hold_hours))
    end
  from (
    select
      coalesce(sum(case when p.requires_deposit then p.deposit_amount else 0 end), 0) as deposit,
      coalesce(sum(p.security_amount), 0) as security
    from public.booking_items bi
    join public.inventory_items i on i.id = bi.item_id
    join public.products p on p.id = i.product_id
    where bi.booking_id = p_booking_id
  ) x,
  public.settings s
  where b.id = p_booking_id
$$;

-- Chỉ tự huỷ đơn chờ còn cần cọc (đơn không cần cọc không có hạn giữ chỗ)
create or replace function private.expire_pending_bookings()
returns int
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.bookings b
    set status = 'cancelled', cancel_reason = 'Hết hạn giữ chỗ chưa cọc'
    where b.status = 'pending'
      and b.deposit_required > 0
      and b.hold_expires_at < now()
      and not exists (
        select 1 from public.payments p where p.booking_id = b.id and p.kind = 'payment'
      )
    returning 1
  )
  select count(*)::int from expired
$$;

-- Báo giá: cọc = 0 với mẫu không cần cọc
create or replace function public.quote_rental(
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
    case when p.requires_deposit then p.deposit_amount else 0 end,
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
