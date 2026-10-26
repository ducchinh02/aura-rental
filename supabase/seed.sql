-- Dữ liệu mẫu cho môi trường local (supabase db reset). Không chạy trên production.
-- Tài khoản (mật khẩu: aura123456):
--   owner@aura.local   chủ shop
--   nv.cs1@aura.local  nhân viên cơ sở 1
--   nv.cs2@aura.local  nhân viên cơ sở 2

insert into public.branches (id, code, name, address, phone, fitting_slot_minutes, fitting_capacity) values
  ('11111111-1111-4111-8111-111111111111', 'CS1', 'Aura Rental - Cơ sở 1', 'Địa chỉ cơ sở 1 (cập nhật sau)', '0900000001', 60, 2),
  ('22222222-2222-4222-8222-222222222222', 'CS2', 'Aura Rental - Cơ sở 2', 'Địa chỉ cơ sở 2 (cập nhật sau)', '0900000002', null, null);

update public.settings
set bank_bin = '970436', bank_account = '0000000000', bank_holder = 'AURA RENTAL';

-- Tài khoản nhân viên -----------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('aura123456', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')) || u.app_meta,
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'owner@aura.local', 'Chủ shop',
    '{"role": "owner"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'nv.cs1@aura.local', 'Nhân viên CS1',
    '{"role": "staff", "branch_id": "11111111-1111-4111-8111-111111111111"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'nv.cs2@aura.local', 'Nhân viên CS2',
    '{"role": "staff", "branch_id": "22222222-2222-4222-8222-222222222222"}'::jsonb)
) as u (id, email, full_name, app_meta);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users
where email like '%@aura.local';

-- Danh mục & váy ------------------------------------------------------------------

insert into public.categories (id, name, slug, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'Đầm dự tiệc', 'dam-du-tiec', 1),
  ('c0000000-0000-4000-8000-000000000002', 'Đầm dạ hội', 'dam-da-hoi', 2),
  ('c0000000-0000-4000-8000-000000000003', 'Váy cưới', 'vay-cuoi', 3);

insert into public.products (
  category_id, name, slug, description, color, occasions,
  base_price, rental_days, extra_day_price, deposit_amount, security_amount, status
) values
  ('c0000000-0000-4000-8000-000000000001', 'Đầm lụa Aurora', 'dam-lua-aurora',
    'Đầm lụa dáng suông, cổ yếm, dài qua gối.', 'Champagne', '{"tiệc cưới", "sự kiện"}',
    450000, 3, 100000, 200000, 1000000, 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'Đầm xoè Rosie', 'dam-xoe-rosie',
    'Đầm xoè tầng voan, tay phồng.', 'Hồng phấn', '{"sinh nhật", "chụp ảnh"}',
    350000, 3, 80000, 150000, 800000, 'active'),
  ('c0000000-0000-4000-8000-000000000002', 'Đầm dạ hội Celeste', 'dam-da-hoi-celeste',
    'Đầm dạ hội đính kết, xẻ tà.', 'Xanh navy', '{"dạ tiệc", "sự kiện"}',
    900000, 3, 200000, 400000, 3000000, 'active'),
  ('c0000000-0000-4000-8000-000000000002', 'Đầm đuôi cá Selene', 'dam-duoi-ca-selene',
    'Đầm đuôi cá satin, cúp ngực.', 'Đỏ rượu', '{"dạ tiệc"}',
    750000, 3, 150000, 300000, 2000000, 'active'),
  ('c0000000-0000-4000-8000-000000000003', 'Váy cưới Luna', 'vay-cuoi-luna',
    'Váy cưới công chúa, ren Pháp, tùng phồng.', 'Trắng ngà', '{"cưới", "chụp ảnh cưới"}',
    2500000, 3, 500000, 1000000, 5000000, 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'Đầm satin Iris', 'dam-satin-iris',
    'Mẫu mới, đang chụp ảnh.', 'Tím khói', '{"tiệc cưới"}',
    500000, 3, 100000, 200000, 1000000, 'draft');

-- Giá riêng cơ sở 2 cho Aurora
insert into public.product_branch_prices (product_id, branch_id, price)
select id, '22222222-2222-4222-8222-222222222222', 500000
from public.products where slug = 'dam-lua-aurora';

with plan (slug, prefix, size, branch_code) as (values
  ('dam-lua-aurora', 'AUR', 'S', 'CS1'),
  ('dam-lua-aurora', 'AUR', 'M', 'CS1'),
  ('dam-lua-aurora', 'AUR', 'M', 'CS2'),
  ('dam-lua-aurora', 'AUR', 'L', 'CS2'),
  ('dam-xoe-rosie', 'ROS', 'S', 'CS2'),
  ('dam-xoe-rosie', 'ROS', 'M', 'CS2'),
  ('dam-xoe-rosie', 'ROS', 'L', 'CS1'),
  ('dam-da-hoi-celeste', 'CEL', 'S', 'CS1'),
  ('dam-da-hoi-celeste', 'CEL', 'M', 'CS1'),
  ('dam-duoi-ca-selene', 'SEL', 'S', 'CS2'),
  ('dam-duoi-ca-selene', 'SEL', 'M', 'CS2'),
  ('vay-cuoi-luna', 'LUN', 'M', 'CS1'),
  ('dam-satin-iris', 'IRI', 'M', 'CS1')
)
insert into public.inventory_items (product_id, size, code, home_branch_id)
select p.id, plan.size, plan.prefix || '-' || plan.size || '-' || plan.branch_code, b.id
from plan
join public.products p on p.slug = plan.slug
join public.branches b on b.code = plan.branch_code;

-- Đơn thuê & lịch thử (ngày tính theo hôm nay để lịch luôn có dữ liệu) ------------

do $$
declare
  cs1 uuid := '11111111-1111-4111-8111-111111111111';
  cs2 uuid := '22222222-2222-4222-8222-222222222222';
  d date := private.today_vn();
  b public.bookings;
begin
  -- Đã cọc, nhận tại cơ sở 1
  b := public.create_booking(
    cs1,
    '{"full_name": "Nguyễn Thị Lan", "phone": "0912345678", "facebook_url": "https://facebook.com/lan.nguyen"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'dam-lua-aurora'), 'size', 'M')),
    d + 2, d + 4, p_source => 'facebook'
  );
  update public.bookings set status = 'confirmed' where id = b.id;
  insert into public.payments (booking_id, kind, method, amount, note)
  values (b.id, 'payment', 'bank', b.deposit_required, 'Cọc giữ chỗ');

  -- Đã cọc, ship nội thành từ cơ sở 2, váy có kho gốc ở cơ sở 1 → có phiếu chuyển
  b := public.create_booking(
    cs2,
    '{"full_name": "Trần Minh Anh", "phone": "0987654321", "zalo": "0987654321"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'dam-da-hoi-celeste'), 'size', 'S')),
    d + 5, d + 7, 'ship', 'local', '12 Đường Mẫu, Quận Mẫu', 'zalo'
  );
  update public.bookings set status = 'confirmed', shipping_fee = 30000 where id = b.id;
  insert into public.payments (booking_id, kind, method, amount, note)
  values (b.id, 'payment', 'momo', b.deposit_required, 'Cọc giữ chỗ');

  -- Khách đang giữ váy
  b := public.create_booking(
    cs1,
    '{"full_name": "Lê Hoàng Mai", "phone": "0901234567"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'vay-cuoi-luna'), 'size', 'M')),
    d - 1, d + 1, p_source => 'walk_in'
  );
  update public.bookings set status = 'confirmed' where id = b.id;
  update public.bookings set status = 'picked_up' where id = b.id;
  insert into public.payments (booking_id, kind, method, amount, note) values
    (b.id, 'payment', 'cash', b.total, 'Thanh toán đủ khi nhận váy'),
    (b.id, 'security_hold', 'cash', b.security_deposit, 'Thế chấp');

  -- Đơn web đang chờ cọc
  b := public.create_booking(
    cs2,
    '{"full_name": "Phạm Thu Hà", "phone": "0934567890", "email": "ha.pham@example.com"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'dam-xoe-rosie'), 'size', 'M')),
    d + 10, d + 12, p_customer_note => 'Em cần thêm thắt lưng nếu có ạ'
  );

  -- Đơn đã hoàn tất
  b := public.create_booking(
    cs2,
    '{"full_name": "Nguyễn Thị Lan", "phone": "0912345678"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'dam-duoi-ca-selene'), 'size', 'S')),
    d - 12, d - 10, p_source => 'facebook'
  );
  update public.bookings set status = 'confirmed' where id = b.id;
  update public.bookings set status = 'picked_up' where id = b.id;
  update public.bookings set status = 'returned' where id = b.id;
  insert into public.payments (booking_id, kind, method, amount, note) values
    (b.id, 'payment', 'bank', b.total, 'Thanh toán đủ'),
    (b.id, 'security_hold', 'cash', b.security_deposit, 'Thế chấp'),
    (b.id, 'security_return', 'cash', b.security_deposit, 'Hoàn thế chấp');
  update public.bookings set status = 'completed' where id = b.id;

  -- Lịch thử đồ ngày mai ở cơ sở 1
  perform public.create_fitting(
    cs1,
    '{"full_name": "Phạm Thu Hà", "phone": "0934567890"}',
    ((d + 1) + time '10:00') at time zone 'Asia/Ho_Chi_Minh',
    jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where slug = 'dam-lua-aurora'), 'size', 'S'),
      jsonb_build_object('product_id', (select id from public.products where slug = 'dam-duoi-ca-selene'), 'size', 'S')
    ),
    'Muốn thử 2 mẫu cho tiệc cưới bạn thân',
    'facebook'
  );
end;
$$;
