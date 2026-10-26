-- Phân quyền (RLS)
--   Khách (anon): chỉ đọc cơ sở, danh mục, váy đang hiển thị. Đặt đơn / tra cứu qua RPC.
--   Nhân viên: xem dữ liệu cả 2 cơ sở; tạo/sửa đơn, thu tiền ở cơ sở mình.
--   Chủ shop: toàn quyền; riêng giá, cài đặt, tài khoản nhân viên chỉ chủ shop sửa.

-- Hàm trong schema private chỉ dùng nội bộ; mở riêng các hàm mà policy cần gọi
revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated;
grant execute on function
  private.is_staff(),
  private.is_owner(),
  private.can_manage_branch(uuid),
  private.can_manage_booking(uuid)
to anon, authenticated;

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_branch_prices enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory_items enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_events enable row level security;
alter table public.payments enable row level security;
alter table public.transfers enable row level security;
alter table public.fitting_appointments enable row level security;
alter table public.fitting_items enable row level security;

-- Cơ sở -----------------------------------------------------------------------

create policy "branches_select" on public.branches
  for select to anon, authenticated
  using (is_active or (select private.is_staff()));

create policy "branches_owner_write" on public.branches
  for all to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

-- Nhân viên -------------------------------------------------------------------

create policy "profiles_select" on public.profiles
  for select to authenticated
  using ((select private.is_staff()));

create policy "profiles_owner_update" on public.profiles
  for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

-- Cài đặt (thông tin ngân hàng hiện cho khách để chuyển cọc) -------------------

create policy "settings_select" on public.settings
  for select to anon, authenticated
  using (true);

create policy "settings_owner_update" on public.settings
  for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

-- Danh mục & mẫu váy ----------------------------------------------------------

create policy "categories_select" on public.categories
  for select to anon, authenticated
  using (true);

create policy "categories_staff_write" on public.categories
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "products_select" on public.products
  for select to anon, authenticated
  using (status = 'active' or (select private.is_staff()));

create policy "products_staff_insert" on public.products
  for insert to authenticated
  with check ((select private.is_staff()));

-- Sửa giá bị chặn thêm bởi trigger products_guard_price
create policy "products_staff_update" on public.products
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "products_owner_delete" on public.products
  for delete to authenticated
  using ((select private.is_owner()));

create policy "product_branch_prices_select" on public.product_branch_prices
  for select to anon, authenticated
  using (true);

create policy "product_branch_prices_owner_write" on public.product_branch_prices
  for all to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

create policy "product_images_select" on public.product_images
  for select to anon, authenticated
  using (true);

create policy "product_images_staff_write" on public.product_images
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Từng chiếc váy --------------------------------------------------------------

create policy "inventory_items_select" on public.inventory_items
  for select to anon, authenticated
  using (
    (select private.is_staff())
    or (
      status = 'active'
      and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    )
  );

create policy "inventory_items_staff_insert" on public.inventory_items
  for insert to authenticated
  with check ((select private.can_manage_branch(home_branch_id)));

-- Nhân viên cơ sở đang giữ váy được chuyển kho gốc sang cơ sở kia
create policy "inventory_items_staff_update" on public.inventory_items
  for update to authenticated
  using ((select private.can_manage_branch(home_branch_id)))
  with check ((select private.is_staff()));

create policy "inventory_items_owner_delete" on public.inventory_items
  for delete to authenticated
  using ((select private.is_owner()));

-- Khách hàng ------------------------------------------------------------------

create policy "customers_staff_select" on public.customers
  for select to authenticated
  using ((select private.is_staff()));

create policy "customers_staff_insert" on public.customers
  for insert to authenticated
  with check ((select private.is_staff()));

create policy "customers_staff_update" on public.customers
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "customers_owner_delete" on public.customers
  for delete to authenticated
  using ((select private.is_owner()));

-- Đơn thuê (tạo đơn chỉ qua RPC create_booking) --------------------------------

create policy "bookings_staff_select" on public.bookings
  for select to authenticated
  using ((select private.is_staff()));

create policy "bookings_branch_update" on public.bookings
  for update to authenticated
  using ((select private.can_manage_branch(branch_id)))
  with check ((select private.can_manage_branch(branch_id)));

create policy "bookings_owner_delete" on public.bookings
  for delete to authenticated
  using ((select private.is_owner()));

create policy "booking_items_staff_select" on public.booking_items
  for select to authenticated
  using ((select private.is_staff()));

create policy "booking_items_branch_write" on public.booking_items
  for all to authenticated
  using ((select private.can_manage_booking(booking_id)))
  with check ((select private.can_manage_booking(booking_id)));

create policy "booking_events_staff_select" on public.booking_events
  for select to authenticated
  using ((select private.is_staff()));

-- Thanh toán ------------------------------------------------------------------

create policy "payments_staff_select" on public.payments
  for select to authenticated
  using ((select private.is_staff()));

create policy "payments_branch_insert" on public.payments
  for insert to authenticated
  with check ((select private.can_manage_booking(booking_id)));

create policy "payments_owner_update" on public.payments
  for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

create policy "payments_owner_delete" on public.payments
  for delete to authenticated
  using ((select private.is_owner()));

-- Điều chuyển váy (hướng gửi/nhận do trigger kiểm tra) --------------------------

create policy "transfers_staff_select" on public.transfers
  for select to authenticated
  using ((select private.is_staff()));

create policy "transfers_staff_insert" on public.transfers
  for insert to authenticated
  with check (
    (select private.can_manage_branch(from_branch_id))
    or (select private.can_manage_branch(to_branch_id))
  );

create policy "transfers_staff_update" on public.transfers
  for update to authenticated
  using (
    (select private.can_manage_branch(from_branch_id))
    or (select private.can_manage_branch(to_branch_id))
  )
  with check ((select private.is_staff()));

-- Lịch thử đồ (tạo lịch qua RPC create_fitting) --------------------------------

create policy "fitting_appointments_staff_select" on public.fitting_appointments
  for select to authenticated
  using ((select private.is_staff()));

create policy "fitting_appointments_branch_update" on public.fitting_appointments
  for update to authenticated
  using ((select private.can_manage_branch(branch_id)))
  with check ((select private.can_manage_branch(branch_id)));

create policy "fitting_appointments_owner_delete" on public.fitting_appointments
  for delete to authenticated
  using ((select private.is_owner()));

create policy "fitting_items_staff_select" on public.fitting_items
  for select to authenticated
  using ((select private.is_staff()));

create policy "fitting_items_branch_write" on public.fitting_items
  for all to authenticated
  using (
    exists (
      select 1 from public.fitting_appointments f
      where f.id = appointment_id and (select private.can_manage_branch(f.branch_id))
    )
  )
  with check (
    exists (
      select 1 from public.fitting_appointments f
      where f.id = appointment_id and (select private.can_manage_branch(f.branch_id))
    )
  );

-- Ảnh váy: bucket public để hiển thị, chỉ nhân viên được upload/sửa/xoá ---------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "product_images_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select private.is_staff()));

create policy "product_images_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select private.is_staff()));

create policy "product_images_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select private.is_staff()));
