-- Kiểm thử quy tắc đặt váy. Chạy: pnpm exec supabase test db
-- Dữ liệu riêng của test, rollback khi xong.
--   T1 = e1000000-0000-4000-8000-000000000001 (khung thử 60 phút, 1 phòng)
--   T2 = e2000000-0000-4000-8000-000000000002
--   Mẫu váy P = e5000000-0000-4000-8000-000000000001, mỗi size 1 chiếc, kho gốc T1
--   D = current_date + 30

begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

update public.settings
set cleaning_days = 1, transfer_days = 1, ship_days_local = 1, ship_days_province = 3, hold_hours = 24;

insert into public.branches (id, code, name, fitting_slot_minutes, fitting_capacity) values
  ('e1000000-0000-4000-8000-000000000001', 'T1', 'Test 1', 60, 1),
  ('e2000000-0000-4000-8000-000000000002', 'T2', 'Test 2', null, null);

insert into auth.users (id, email, raw_app_meta_data) values
  ('e9000000-0000-4000-8000-000000000001', 'owner@test.local', '{"role": "owner"}'),
  ('e9000000-0000-4000-8000-000000000002', 'staff1@test.local',
    '{"role": "staff", "branch_id": "e1000000-0000-4000-8000-000000000001"}'),
  ('e9000000-0000-4000-8000-000000000003', 'staff2@test.local',
    '{"role": "staff", "branch_id": "e2000000-0000-4000-8000-000000000002"}');

insert into public.products (id, name, slug, base_price, rental_days, extra_day_price, deposit_amount, security_amount, status)
values ('e5000000-0000-4000-8000-000000000001', 'Đầm test', 'dam-test', 400000, 3, 100000, 100000, 500000, 'active');

insert into public.product_branch_prices (product_id, branch_id, price)
values ('e5000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 450000);

insert into public.inventory_items (product_id, size, code, home_branch_id) values
  ('e5000000-0000-4000-8000-000000000001', 'M', 'TST-M-1', 'e1000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000001', 'S', 'TST-S-1', 'e1000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Đơn web (server gọi bằng service role)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select lives_ok(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách A", "phone": "+84 912 000 001"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 30, current_date + 33, p_source => 'facebook') $$,
  'web: tạo đơn thành công'
);

select results_eq(
  $$ select b.source::text, b.status::text, b.subtotal, b.deposit_required, b.security_deposit, b.hold_expires_at is not null
     from public.bookings b join public.customers c on c.id = b.customer_id
     where c.phone = '0912000001' $$,
  $$ values ('web', 'pending', 500000::bigint, 100000::bigint, 500000::bigint, true) $$,
  'web: luôn là đơn web chờ cọc, SĐT chuẩn hoá, 4 ngày = giá gói + 1 ngày phụ thu'
);

select is(
  (select bi.blocked_period from public.booking_items bi
   join public.bookings b on b.id = bi.booking_id
   join public.customers c on c.id = b.customer_id
   where c.phone = '0912000001'),
  daterange(current_date + 30, current_date + 34, '[]'),
  'khoá lịch = kỳ thuê + 1 ngày giặt'
);

select throws_like(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách X", "phone": "0912000099"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 34, current_date + 34) $$,
  '%kín lịch%',
  'không cho nhận váy vào ngày đang giặt'
);

select lives_ok(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách B", "phone": "0912000002"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 35, current_date + 36) $$,
  'đặt được ngay sau ngày giặt'
);

select ok(
  (select array_agg(d order by d) from public.get_unavailable_dates(
     'e5000000-0000-4000-8000-000000000001', 'M', 'e1000000-0000-4000-8000-000000000001',
     current_date + 28, current_date + 39) d)
  = (select array_agg(d::date) from generate_series(current_date + 29, current_date + 37, interval '1 day') d),
  'lịch kín: ngày trước kỳ thuê (cần giặt), kỳ thuê, ngày giặt'
);

select throws_like(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách X", "phone": "0912000099"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date - 1, current_date) $$,
  '%Ngày nhận đã qua%',
  'web: không đặt được ngày đã qua'
);

select throws_like(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách X", "phone": "0912000099"}',
       format('[{"item_id": "%s"}]', (select id from public.inventory_items where code = 'TST-S-1'))::jsonb,
       current_date + 50, current_date + 51) $$,
  '%chiếc váy cụ thể%',
  'web: không được chọn chiếc cụ thể'
);

select throws_like(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách X", "phone": "12345"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 50, current_date + 51) $$,
  '%Số điện thoại%',
  'web: chặn SĐT sai'
);

-- ---------------------------------------------------------------------------
-- Thuê ở cơ sở khác kho gốc: cộng ngày chuyển, dùng giá riêng của cơ sở
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', true);

select lives_ok(
  $$ select public.create_booking(
       'e2000000-0000-4000-8000-000000000002',
       '{"full_name": "Khách C", "phone": "0912000003"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "S"}]',
       current_date + 40, current_date + 42, p_source => 'zalo') $$,
  'tạo đơn ở T2 cho váy có kho gốc T1'
);

select results_eq(
  $$ select bi.blocked_period, bi.price, b.source::text
     from public.booking_items bi
     join public.bookings b on b.id = bi.booking_id
     join public.customers c on c.id = b.customer_id
     where c.phone = '0912000003' $$,
  $$ values (daterange(current_date + 39, current_date + 44, '[]'), 450000::bigint, 'zalo') $$,
  'khoá thêm 1 ngày chuyển đi + 1 ngày chuyển về; giá riêng T2'
);

update public.bookings set status = 'confirmed'
where customer_id = (select id from public.customers where phone = '0912000003');

select results_eq(
  $$ select t.from_branch_id, t.to_branch_id, t.due_date, t.status::text
     from public.transfers t
     join public.bookings b on b.id = t.booking_id
     join public.customers c on c.id = b.customer_id
     where c.phone = '0912000003' $$,
  $$ values ('e1000000-0000-4000-8000-000000000001'::uuid, 'e2000000-0000-4000-8000-000000000002'::uuid,
             current_date + 40, 'pending') $$,
  'xác nhận cọc → tạo phiếu chuyển T1 → T2, hạn trước ngày nhận'
);

select throws_like(
  $$ update public.bookings set status = 'completed'
     where customer_id = (select id from public.customers where phone = '0912000003') $$,
  '%Không thể chuyển đơn%',
  'chặn nhảy trạng thái sai'
);

update public.bookings set status = 'cancelled'
where customer_id = (select id from public.customers where phone = '0912000003');

select results_eq(
  $$ select bi.is_active, t.status::text
     from public.bookings b
     join public.customers c on c.id = b.customer_id
     join public.booking_items bi on bi.booking_id = b.id
     join public.transfers t on t.booking_id = b.id
     where c.phone = '0912000003' $$,
  $$ values (false, 'cancelled') $$,
  'huỷ đơn → nhả lịch váy, huỷ phiếu chuyển chưa gửi'
);

-- ---------------------------------------------------------------------------
-- Huỷ đơn nhả lịch, đổi ngày tính lại giá
-- ---------------------------------------------------------------------------

update public.bookings set status = 'cancelled'
where customer_id = (select id from public.customers where phone = '0912000001');

select lives_ok(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách D", "phone": "0912000004"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 30, current_date + 31) $$,
  'đơn bị huỷ không còn giữ váy'
);

update public.bookings set return_date = current_date + 38
where customer_id = (select id from public.customers where phone = '0912000002');

select results_eq(
  $$ select bi.price, bi.blocked_period
     from public.booking_items bi
     join public.bookings b on b.id = bi.booking_id
     join public.customers c on c.id = b.customer_id
     where c.phone = '0912000002' $$,
  $$ values (500000::bigint, daterange(current_date + 35, current_date + 39, '[]')) $$,
  'đổi ngày trả → tính lại giá và lịch khoá'
);

update public.booking_items set price = 420000, is_price_custom = true
where booking_id = (select b.id from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0912000002');

update public.bookings set return_date = current_date + 36
where customer_id = (select id from public.customers where phone = '0912000002');

select results_eq(
  $$ select b.subtotal, (select count(*) from public.booking_events e where e.booking_id = b.id and e.event = 'price_changed')
     from public.bookings b join public.customers c on c.id = b.customer_id
     where c.phone = '0912000002' $$,
  $$ values (420000::bigint, 1::bigint) $$,
  'giá sửa tay được giữ khi đổi ngày và được ghi lịch sử'
);

-- ---------------------------------------------------------------------------
-- Tự huỷ đơn chờ cọc quá hạn
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select lives_ok(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách E", "phone": "0912000005"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 60, current_date + 61) $$,
  'đơn web thứ 2 chờ cọc'
);

select set_config('request.jwt.claims', '', true);

insert into public.payments (booking_id, kind, method, amount)
select b.id, 'payment', 'bank', 100000
from public.bookings b join public.customers c on c.id = b.customer_id
where c.phone = '0912000005';

update public.bookings set hold_expires_at = now() - interval '1 minute'
where customer_id in (select id from public.customers where phone in ('0912000002', '0912000005'));

select is(private.expire_pending_bookings(), 1, 'huỷ đúng 1 đơn quá hạn');

select results_eq(
  $$ select c.phone, b.status::text
     from public.bookings b join public.customers c on c.id = b.customer_id
     where c.phone in ('0912000002', '0912000005')
     order by c.phone $$,
  $$ values ('0912000002', 'cancelled'), ('0912000005', 'pending') $$,
  'đơn quá hạn chưa trả tiền bị huỷ, đơn đã trả tiền được giữ'
);

-- ---------------------------------------------------------------------------
-- Khách tra cứu đơn
-- ---------------------------------------------------------------------------

select is(
  public.lookup_booking(
    (select b.code from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0912000005'),
    '0912 000 005'
  ) ->> 'status',
  'pending',
  'tra cứu đúng mã + SĐT'
);

select is(
  public.lookup_booking(
    (select b.code from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0912000005'),
    '0912000001'
  ),
  null,
  'sai SĐT thì không trả về gì'
);

-- ---------------------------------------------------------------------------
-- Điều chuyển & kho gốc
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.create_booking(
       'e2000000-0000-4000-8000-000000000002',
       '{"full_name": "Khách F", "phone": "0912000006"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "S"}]',
       current_date + 20, current_date + 21) $$,
  'đơn T2 dùng váy kho T1'
);

update public.bookings set status = 'confirmed'
where customer_id = (select id from public.customers where phone = '0912000006');

select throws_like(
  $$ update public.inventory_items set home_branch_id = 'e2000000-0000-4000-8000-000000000002' where code = 'TST-S-1' $$,
  '%còn đơn sắp tới%',
  'không đổi kho gốc khi váy còn đơn'
);

-- ---------------------------------------------------------------------------
-- Đổi váy trong đơn đã cọc
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.add_booking_item(
       (select b.id from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0912000006'),
       'e5000000-0000-4000-8000-000000000001', 'M') $$,
  'thêm váy vào đơn đã cọc'
);

select results_eq(
  $$ select b.deposit_required, (select count(*) from public.transfers t where t.booking_id = b.id and t.status = 'pending')
     from public.bookings b join public.customers c on c.id = b.customer_id
     where c.phone = '0912000006' $$,
  $$ values (200000::bigint, 2::bigint) $$,
  'thêm váy → cộng cọc, tạo phiếu chuyển cho váy mới'
);

select lives_ok(
  $$ select public.remove_booking_item(
       (select bi.id from public.booking_items bi
        join public.inventory_items i on i.id = bi.item_id
        join public.bookings b on b.id = bi.booking_id
        join public.customers c on c.id = b.customer_id
        where c.phone = '0912000006' and i.code = 'TST-M-1')) $$,
  'bỏ váy vừa thêm'
);

select throws_like(
  $$ select public.remove_booking_item(
       (select bi.id from public.booking_items bi
        join public.bookings b on b.id = bi.booking_id
        join public.customers c on c.id = b.customer_id
        where c.phone = '0912000006')) $$,
  '%ít nhất 1 váy%',
  'không bỏ được váy cuối cùng'
);

-- ---------------------------------------------------------------------------
-- Phân quyền
-- ---------------------------------------------------------------------------

-- Nhân viên T2
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "e9000000-0000-4000-8000-000000000003"}', true);
set local role authenticated;

select throws_like(
  $$ update public.transfers set status = 'in_transit'
     where booking_id = (select b.id from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0912000006') and status = 'pending' $$,
  '%Chỉ cơ sở gửi%',
  'cơ sở nhận không bấm "đã gửi" thay cơ sở gửi'
);

select ok(
  (select count(*) from public.bookings where branch_id = 'e1000000-0000-4000-8000-000000000001') > 0,
  'nhân viên xem được đơn cơ sở kia'
);

update public.bookings set internal_note = 'staff2 sửa'
where branch_id = 'e1000000-0000-4000-8000-000000000001';

select throws_like(
  $$ update public.products set base_price = 1 where id = 'e5000000-0000-4000-8000-000000000001' $$,
  '%Chỉ chủ shop%',
  'nhân viên không sửa được giá'
);

select throws_ok(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách X", "phone": "0912000099"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 70, current_date + 71) $$,
  '42501',
  null,
  'nhân viên không tạo đơn ở cơ sở khác'
);

-- Nhân viên T1 bấm đã gửi, rồi nhân viên T2 bấm đã nhận
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "e9000000-0000-4000-8000-000000000002"}', true);

select lives_ok(
  $$ update public.transfers set status = 'in_transit'
     where booking_id = (select b.id from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0912000006') and status = 'pending' $$,
  'cơ sở gửi xác nhận đã gửi'
);

select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "e9000000-0000-4000-8000-000000000003"}', true);

select lives_ok(
  $$ update public.transfers set status = 'received'
     where booking_id = (select b.id from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0912000006') and status = 'in_transit' $$,
  'cơ sở nhận xác nhận đã nhận'
);

-- Chủ shop
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "e9000000-0000-4000-8000-000000000001"}', true);

select lives_ok(
  $$ update public.products set base_price = 420000 where id = 'e5000000-0000-4000-8000-000000000001' $$,
  'chủ shop sửa được giá'
);

-- Khách chưa đăng nhập
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select is_empty($$ select 1 from public.bookings $$, 'khách không đọc được đơn');
select is_empty($$ select 1 from public.customers $$, 'khách không đọc được danh sách khách');

select throws_ok(
  $$ select public.create_booking(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách X", "phone": "0912000099"}',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 70, current_date + 71) $$,
  '42501',
  null,
  'khách không gọi thẳng create_booking (phải qua server có captcha)'
);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*) from public.bookings
   where branch_id = 'e1000000-0000-4000-8000-000000000001' and internal_note = 'staff2 sửa'),
  0::bigint,
  'nhân viên không sửa được đơn cơ sở kia'
);

-- ---------------------------------------------------------------------------
-- Lịch thử đồ (T1: khung 60 phút, 1 phòng thử)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select lives_ok(
  $$ select public.create_fitting(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách G", "phone": "0912000007"}',
       ((current_date + 30) + time '10:00') at time zone 'Asia/Ho_Chi_Minh',
       '[{"product_id": "e5000000-0000-4000-8000-000000000001", "size": "M"}]') $$,
  'đặt lịch thử đúng khung giờ'
);

select throws_like(
  $$ select public.create_fitting(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách H", "phone": "0912000008"}',
       ((current_date + 30) + time '10:00') at time zone 'Asia/Ho_Chi_Minh') $$,
  '%đã kín%',
  'khung giờ hết phòng thử'
);

select throws_like(
  $$ select public.create_fitting(
       'e1000000-0000-4000-8000-000000000001',
       '{"full_name": "Khách H", "phone": "0912000008"}',
       ((current_date + 30) + time '10:30') at time zone 'Asia/Ho_Chi_Minh') $$,
  '%không đúng khung giờ%',
  'giờ lẻ không khớp khung'
);

select is(
  (select remaining from public.get_fitting_slots('e1000000-0000-4000-8000-000000000001', current_date + 30)
   where starts_at = ((current_date + 30) + time '10:00') at time zone 'Asia/Ho_Chi_Minh'),
  0,
  'khung 10:00 còn 0 chỗ'
);

select * from finish();
rollback;
