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
  jsonb_build_object('full_name', u.full_name, 'phone', u.phone), now(), now(),
  '', '', '', ''
from (values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'owner@aura.local', 'Chủ shop', '0900000000',
    '{"role": "owner"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'nv.cs1@aura.local', 'Nhân viên CS1', '0901000001',
    '{"role": "staff", "branch_id": "11111111-1111-4111-8111-111111111111"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'nv.cs2@aura.local', 'Nhân viên CS2', '0901000002',
    '{"role": "staff", "branch_id": "22222222-2222-4222-8222-222222222222"}'::jsonb)
) as u (id, email, full_name, phone, app_meta);

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
  base_price, rental_days, extra_day_price, deposit_amount, security_amount, status,
  hourly_price, hourly_hours, extra_hour_price
) values
  ('c0000000-0000-4000-8000-000000000001', 'Đầm lụa Aurora', 'dam-lua-aurora',
    'Đầm lụa dáng suông, cổ yếm, dài qua gối.', 'Champagne', '{"tiệc cưới", "sự kiện"}',
    450000, 3, 100000, 200000, 1000000, 'active', 200000, 3, 50000),
  ('c0000000-0000-4000-8000-000000000001', 'Đầm xoè Rosie', 'dam-xoe-rosie',
    'Đầm xoè tầng voan, tay phồng.', 'Hồng phấn', '{"sinh nhật", "chụp ảnh"}',
    350000, 3, 80000, 150000, 800000, 'active', 150000, 3, 40000),
  ('c0000000-0000-4000-8000-000000000002', 'Đầm dạ hội Celeste', 'dam-da-hoi-celeste',
    'Đầm dạ hội đính kết, xẻ tà.', 'Xanh navy', '{"dạ tiệc", "sự kiện"}',
    900000, 3, 200000, 400000, 3000000, 'active', null, 3, 0),
  ('c0000000-0000-4000-8000-000000000002', 'Đầm đuôi cá Selene', 'dam-duoi-ca-selene',
    'Đầm đuôi cá satin, cúp ngực.', 'Đỏ rượu', '{"dạ tiệc"}',
    750000, 3, 150000, 300000, 2000000, 'active', null, 3, 0),
  ('c0000000-0000-4000-8000-000000000003', 'Váy cưới Luna', 'vay-cuoi-luna',
    'Váy cưới công chúa, ren Pháp, tùng phồng.', 'Trắng ngà', '{"cưới", "chụp ảnh cưới"}',
    2500000, 3, 500000, 1000000, 5000000, 'active', 900000, 4, 150000),
  ('c0000000-0000-4000-8000-000000000001', 'Đầm satin Iris', 'dam-satin-iris',
    'Mẫu mới, đang chụp ảnh.', 'Tím khói', '{"tiệc cưới"}',
    500000, 3, 100000, 200000, 1000000, 'draft', null, 3, 0);

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
  -- Đã cọc, khách nhận tại cơ sở 1 hôm nay
  b := public.create_booking(
    cs1,
    '{"full_name": "Nguyễn Thị Lan", "phone": "0912345678", "facebook_url": "https://facebook.com/lan.nguyen"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'dam-lua-aurora'), 'size', 'M')),
    d, d + 2, p_source => 'facebook'
  );
  update public.bookings set status = 'confirmed' where id = b.id;
  insert into public.payments (booking_id, kind, method, amount, note)
  values (b.id, 'payment', 'bank', b.deposit_required, 'Cọc giữ chỗ');

  -- Đã cọc, 2 váy cho 2 chị em, nhận tại cơ sở 2 hôm nay
  b := public.create_booking(
    cs2,
    '{"full_name": "Đỗ Quỳnh Anh", "phone": "0905111222", "zalo": "0905111222"}',
    jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where slug = 'dam-duoi-ca-selene'), 'size', 'M'),
      jsonb_build_object('product_id', (select id from public.products where slug = 'dam-xoe-rosie'), 'size', 'S')
    ),
    d, d + 1, p_source => 'zalo'
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

  -- Thuê theo giờ: chụp ảnh chiều mai ở cơ sở 1, đã cọc
  b := public.create_booking(
    cs1,
    '{"full_name": "Vũ Ngọc Hân", "phone": "0976111333", "facebook_url": "https://facebook.com/han.vu"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'dam-xoe-rosie'), 'size', 'L')),
    null, null, p_source => 'facebook', p_unit => 'hour',
    p_pickup_at => ((d + 1) + time '14:00') at time zone 'Asia/Ho_Chi_Minh',
    p_return_at => ((d + 1) + time '18:00') at time zone 'Asia/Ho_Chi_Minh'
  );
  update public.bookings set status = 'confirmed' where id = b.id;
  insert into public.payments (booking_id, kind, method, amount, note)
  values (b.id, 'payment', 'bank', b.deposit_required, 'Cọc giữ chỗ');

  -- Thuê theo giờ, chờ cọc: váy cưới chụp ngoại cảnh
  b := public.create_booking(
    cs1,
    '{"full_name": "Hoàng Bảo Trâm", "phone": "0968222444", "zalo": "0968222444"}',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'vay-cuoi-luna'), 'size', 'M')),
    null, null, p_source => 'zalo', p_unit => 'hour',
    p_pickup_at => ((d + 4) + time '07:00') at time zone 'Asia/Ho_Chi_Minh',
    p_return_at => ((d + 4) + time '12:00') at time zone 'Asia/Ho_Chi_Minh'
  );

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

-- Lịch sử 4 tháng (đơn đã hoàn tất / đã hủy) để biểu đồ doanh thu, nguồn đơn có dữ liệu ---------

do $$
declare
  names text[] := array[
    'Vũ Thảo Vy', 'Hoàng Ngọc Hân', 'Bùi Phương Linh', 'Đặng Khánh Ly', 'Ngô Bảo Trân', 'Phan Mỹ Duyên',
    'Trịnh Gia Hân', 'Lý Thanh Trúc', 'Đinh Hồng Nhung', 'Mai Anh Thư', 'Võ Kim Ngân', 'Tô Diễm My',
    'Lâm Tuyết Nhi', 'Cao Minh Châu', 'Dương Thu Trang', 'Hà Lan Chi', 'Kiều Bích Ngọc', 'Quách Ngọc Mai',
    'Trương Yến Nhi', 'La Thùy Dung'
  ];
  sources public.booking_source[] := array[
    'facebook', 'facebook', 'facebook', 'facebook', 'zalo', 'zalo', 'zalo', 'walk_in', 'walk_in', 'web', 'phone'
  ]::public.booking_source[];
  branches uuid[] := array(select id from public.branches order by code);
  d date := private.today_vn();
  i int;
  v_pickup date;
  v_days int;
  v_product record;
  v_branch uuid;
  v_created timestamptz;
  b public.bookings;
begin
  perform setseed(0.26);

  for i in 1..90 loop
    v_pickup := d - 125 + floor(random() * 120)::int;
    v_days := 1 + floor(random() * 3)::int;
    v_branch := branches[1 + floor(random() * array_length(branches, 1))::int];

    select p.id, i2.size into v_product
    from public.products p
    join public.inventory_items i2 on i2.product_id = p.id and i2.status = 'active'
    where p.status = 'active'
    order by random()
    limit 1;

    begin
      b := public.create_booking(
        v_branch,
        jsonb_build_object(
          'full_name', names[1 + floor(random() * array_length(names, 1))::int],
          'phone', '09' || lpad((10000000 + floor(random() * 89999999))::bigint::text, 8, '0')
        ),
        jsonb_build_array(jsonb_build_object('product_id', v_product.id, 'size', v_product.size)),
        v_pickup, v_pickup + v_days - 1,
        p_source => sources[1 + floor(random() * array_length(sources, 1))::int]
      );
    exception when others then
      continue; -- váy đã kín lịch ngày đó, bỏ qua
    end;

    v_created := (v_pickup - (2 + floor(random() * 10))::int + time '10:00') at time zone 'Asia/Ho_Chi_Minh'
      + make_interval(mins => floor(random() * 600)::int);
    update public.bookings set created_at = v_created where id = b.id;

    if random() < 0.08 then
      update public.bookings set status = 'cancelled', cancel_reason = 'Khách đổi lịch' where id = b.id;
      continue;
    end if;

    update public.bookings set status = 'confirmed' where id = b.id;
    insert into public.payments (booking_id, kind, method, amount, paid_at, note)
    values (b.id, 'payment', 'bank', b.deposit_required, v_created + interval '2 hours', 'Cọc giữ chỗ');

    update public.bookings set status = 'picked_up' where id = b.id;
    select * into b from public.bookings where id = b.id;
    insert into public.payments (booking_id, kind, method, amount, paid_at, note) values
      (b.id, 'payment', (array['cash', 'bank', 'momo'])[1 + floor(random() * 3)::int]::public.payment_method,
        b.total - b.deposit_required, (v_pickup + time '17:00') at time zone 'Asia/Ho_Chi_Minh', 'Thanh toán khi nhận váy'),
      (b.id, 'security_hold', 'cash', b.security_deposit, (v_pickup + time '17:05') at time zone 'Asia/Ho_Chi_Minh', 'Thế chấp');

    update public.bookings set status = 'returned' where id = b.id;
    insert into public.payments (booking_id, kind, method, amount, paid_at, note)
    values (b.id, 'security_return', 'cash', b.security_deposit,
      (b.return_date + time '18:00') at time zone 'Asia/Ho_Chi_Minh', 'Hoàn thế chấp');
    update public.bookings set status = 'completed' where id = b.id;

    -- Váy đã chuyển qua lại xong từ lâu
    update public.transfers set status = 'in_transit' where booking_id = b.id and status = 'pending';
    update public.transfers set status = 'received' where booking_id = b.id and status = 'in_transit';
    update public.transfers
    set sent_at = (due_date - 1 + time '09:00') at time zone 'Asia/Ho_Chi_Minh',
        received_at = (due_date + time '09:00') at time zone 'Asia/Ho_Chi_Minh',
        created_at = v_created
    where booking_id = b.id;
  end loop;

  -- Mốc thời gian của đơn lịch sử theo đúng ngày thuê
  update public.bookings bk
  set picked_up_at = (bk.pickup_date + time '17:00') at time zone 'Asia/Ho_Chi_Minh',
      returned_at = (bk.return_date + time '18:00') at time zone 'Asia/Ho_Chi_Minh',
      completed_at = (bk.return_date + time '19:00') at time zone 'Asia/Ho_Chi_Minh'
  where bk.status = 'completed' and bk.created_at < (d - 1)::timestamptz;

  update public.booking_events e
  set created_at = case
    when e.event = 'created' then bk.created_at
    when e.to_status = 'confirmed' then bk.created_at + interval '2 hours'
    when e.to_status = 'picked_up' then coalesce(bk.picked_up_at, bk.created_at)
    when e.to_status = 'returned' then coalesce(bk.returned_at, bk.created_at)
    when e.to_status = 'completed' then coalesce(bk.completed_at, bk.created_at)
    else bk.created_at + interval '1 day'
  end
  from public.bookings bk
  where bk.id = e.booking_id and bk.created_at < (d - 1)::timestamptz;

  -- Mã đơn theo ngày tạo, đánh số lại trong từng ngày
  update public.bookings bk
  set code = x.code
  from (
    select id,
      'AR-' || to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-'
        || lpad(row_number() over (partition by (created_at at time zone 'Asia/Ho_Chi_Minh')::date order by created_at)::text, 2, '0') as code
    from public.bookings
    where created_at < (d - 1)::timestamptz
  ) x
  where bk.id = x.id;

  update private.booking_code_counters
  set last_value = (select count(*) from public.bookings where code like 'AR-' || to_char(d, 'YYMMDD') || '-%')
  where day = d;
  update public.customers c set created_at = sub.first
  from (select customer_id, min(created_at) as first from public.bookings group by customer_id) sub
  where sub.customer_id = c.id and sub.first < c.created_at;
end;
$$;
