-- Lõi dữ liệu Aura Rental: cơ sở, nhân viên, kho váy, khách, đơn thuê,
-- thanh toán, điều chuyển váy giữa cơ sở, lịch thử đồ.
-- Tiền lưu theo đồng (bigint). Ngày thuê lưu kiểu date theo giờ Việt Nam.

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('owner', 'staff');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.item_status as enum ('active', 'maintenance', 'retired');
create type public.booking_status as enum (
  'pending',    -- chờ cọc, đang giữ chỗ
  'confirmed',  -- đã cọc
  'picked_up',  -- khách đang giữ váy
  'returned',   -- khách đã trả váy
  'completed',  -- đã quyết toán / hoàn thế chấp
  'cancelled'
);
create type public.booking_source as enum ('web', 'facebook', 'zalo', 'phone', 'walk_in');
create type public.delivery_method as enum ('pickup', 'ship');
create type public.ship_zone as enum ('local', 'province');
create type public.payment_kind as enum (
  'payment',         -- khách trả tiền đơn (cọc, tiền thuê, phí)
  'refund',          -- shop hoàn tiền đơn
  'security_hold',   -- nhận tiền thế chấp khi giao váy
  'security_return'  -- hoàn tiền thế chấp
);
create type public.payment_method as enum ('cash', 'bank', 'momo');
create type public.transfer_status as enum ('pending', 'in_transit', 'received', 'cancelled');
create type public.fitting_status as enum ('booked', 'done', 'no_show', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tiện ích chung
-- ---------------------------------------------------------------------------

create function private.today_vn()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;

-- Chuẩn hoá SĐT về dạng 0xxxxxxxxx (bỏ ký tự thừa, đổi +84/84 thành 0)
create function private.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when d ~ '^84\d{9,10}$' then '0' || substr(d, 3) else d end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) s
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cơ sở & nhân viên
-- ---------------------------------------------------------------------------

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  map_url text,
  open_time time not null default '09:00',
  close_time time not null default '21:00',
  -- Lịch thử đồ: để trống = khách chọn giờ tự do / không giới hạn số khách
  fitting_slot_minutes int check (fitting_slot_minutes > 0),
  fitting_capacity int check (fitting_capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (close_time > open_time)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'staff',
  -- Nhân viên làm cố định 1 cơ sở; chủ shop để trống
  branch_id uuid references public.branches (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tài khoản do chủ shop tạo qua Admin API, vai trò & cơ sở nằm trong app_metadata
-- (người dùng không tự sửa được app_metadata)
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, branch_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'staff'),
    (new.raw_app_meta_data ->> 'branch_id')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Cài đặt chung (1 dòng duy nhất)
-- ---------------------------------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  cleaning_days int not null default 1 check (cleaning_days >= 0),
  transfer_days int not null default 1 check (transfer_days >= 0),
  ship_days_local int not null default 1 check (ship_days_local >= 0),
  ship_days_province int not null default 3 check (ship_days_province >= 0),
  hold_hours int not null default 24 check (hold_hours > 0),
  late_fee_per_day bigint not null default 0 check (late_fee_per_day >= 0),
  bank_bin text,
  bank_account text,
  bank_holder text,
  updated_at timestamptz not null default now()
);

insert into public.settings default values;

create trigger settings_updated_at
  before update on public.settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Kho váy
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  color text,
  occasions text[] not null default '{}',
  -- Giá chung cho gói rental_days ngày; mỗi cơ sở có thể đặt giá riêng
  base_price bigint not null check (base_price >= 0),
  rental_days int not null default 3 check (rental_days > 0),
  extra_day_price bigint not null default 0 check (extra_day_price >= 0),
  deposit_amount bigint not null default 0 check (deposit_amount >= 0),
  security_amount bigint not null default 0 check (security_amount >= 0),
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_status_idx on public.products (status);

create trigger products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create table public.product_branch_prices (
  product_id uuid not null references public.products (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  price bigint not null check (price >= 0),
  extra_day_price bigint check (extra_day_price >= 0), -- trống = dùng phụ thu chung
  primary key (product_id, branch_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);
create unique index product_images_one_cover on public.product_images (product_id) where is_cover;

-- Mỗi chiếc váy thật có 1 kho gốc; khi có đơn ở cơ sở kia thì được chuyển qua rồi chuyển về
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  size text not null,
  code text not null unique,
  home_branch_id uuid not null references public.branches (id),
  status public.item_status not null default 'active',
  condition_note text,
  created_at timestamptz not null default now()
);

create index inventory_items_product_size_idx on public.inventory_items (product_id, size);
create index inventory_items_home_branch_idx on public.inventory_items (home_branch_id);

-- ---------------------------------------------------------------------------
-- Khách hàng
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique check (phone ~ '^0\d{9,10}$'),
  email text,
  facebook_url text,
  zalo text,
  address text,
  note text,
  is_blacklisted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.customers_normalize_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone := private.normalize_phone(new.phone);
  return new;
end;
$$;

create trigger customers_normalize_phone
  before insert or update of phone on public.customers
  for each row execute function private.customers_normalize_phone();

create trigger customers_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Đơn thuê
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  branch_id uuid not null references public.branches (id),
  customer_id uuid not null references public.customers (id),
  status public.booking_status not null default 'pending',
  source public.booking_source not null default 'web',
  -- Ngày khách nhận / trả váy (tính cả 2 đầu). Khách trả tại đúng cơ sở đã thuê.
  pickup_date date not null,
  return_date date not null,
  delivery_method public.delivery_method not null default 'pickup',
  ship_zone public.ship_zone,
  shipping_address text,
  subtotal bigint not null default 0 check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  shipping_fee bigint not null default 0 check (shipping_fee >= 0),
  late_fee bigint not null default 0 check (late_fee >= 0),
  damage_fee bigint not null default 0 check (damage_fee >= 0),
  total bigint generated always as (subtotal - discount + shipping_fee + late_fee + damage_fee) stored,
  deposit_required bigint not null default 0 check (deposit_required >= 0),
  security_deposit bigint not null default 0 check (security_deposit >= 0),
  hold_expires_at timestamptz,
  customer_note text,
  internal_note text,
  cancel_reason text,
  created_by uuid references public.profiles (id),
  picked_up_at timestamptz,
  returned_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (return_date >= pickup_date),
  check (
    delivery_method = 'pickup'
    or (ship_zone is not null and nullif(trim(shipping_address), '') is not null)
  )
);

create index bookings_branch_pickup_idx on public.bookings (branch_id, pickup_date);
create index bookings_branch_return_idx on public.bookings (branch_id, return_date);
create index bookings_status_idx on public.bookings (status);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_pending_hold_idx on public.bookings (hold_expires_at) where status = 'pending';

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function private.set_updated_at();

-- Mỗi dòng giữ 1 chiếc váy trong blocked_period
-- (= kỳ thuê + ngày ship + ngày chuyển cơ sở + ngày giặt), do trigger tính.
create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  price bigint not null check (price >= 0),
  is_price_custom boolean not null default false, -- nhân viên đã sửa giá, không tự tính lại khi đổi ngày
  blocked_period daterange not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Không bao giờ cho 1 chiếc váy 2 đơn chồng ngày
  constraint booking_items_no_overlap
    exclude using gist (item_id with =, blocked_period with &&) where (is_active)
);

create index booking_items_booking_idx on public.booking_items (booking_id);

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  event text not null, -- created | status_changed | price_changed
  from_status public.booking_status,
  to_status public.booking_status,
  data jsonb,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind public.payment_kind not null,
  method public.payment_method not null,
  amount bigint not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text,
  recorded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index payments_booking_idx on public.payments (booking_id);
create index payments_paid_at_idx on public.payments (paid_at);

-- ---------------------------------------------------------------------------
-- Điều chuyển váy giữa cơ sở
-- ---------------------------------------------------------------------------

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id),
  booking_id uuid references public.bookings (id) on delete set null,
  from_branch_id uuid not null references public.branches (id),
  to_branch_id uuid not null references public.branches (id),
  due_date date not null, -- ngày váy phải có mặt ở cơ sở nhận
  status public.transfer_status not null default 'pending',
  sent_at timestamptz,
  sent_by uuid references public.profiles (id),
  received_at timestamptz,
  received_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now(),
  check (from_branch_id <> to_branch_id)
);

create index transfers_open_idx on public.transfers (status, due_date) where status in ('pending', 'in_transit');
create index transfers_item_idx on public.transfers (item_id);
create index transfers_booking_idx on public.transfers (booking_id);

-- ---------------------------------------------------------------------------
-- Lịch thử đồ
-- ---------------------------------------------------------------------------

create table public.fitting_appointments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id),
  customer_id uuid not null references public.customers (id),
  starts_at timestamptz not null,
  status public.fitting_status not null default 'booked',
  source public.booking_source not null default 'web',
  booking_id uuid references public.bookings (id) on delete set null, -- đơn thuê chốt được sau buổi thử
  customer_note text,
  internal_note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fitting_appointments_branch_time_idx on public.fitting_appointments (branch_id, starts_at);

create trigger fitting_appointments_updated_at
  before update on public.fitting_appointments
  for each row execute function private.set_updated_at();

create table public.fitting_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.fitting_appointments (id) on delete cascade,
  product_id uuid not null references public.products (id),
  size text
);

create index fitting_items_appointment_idx on public.fitting_items (appointment_id);
