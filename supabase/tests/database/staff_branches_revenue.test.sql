-- SĐT nhân viên, thêm / ngưng cơ sở, báo cáo doanh thu. Chạy: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.branches (id, code, name) values
  ('f1000000-0000-4000-8000-000000000001', 'TA', 'Test A'),
  ('f2000000-0000-4000-8000-000000000002', 'TB', 'Test B');

-- ---------------------------------------------------------------------------
-- SĐT nhân viên
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('f9000000-0000-4000-8000-000000000001', 'owner@t.local', '{"role": "owner"}', '{"full_name": "Chủ", "phone": "+84 912 111 222"}'),
  ('f9000000-0000-4000-8000-000000000002', 'staff@t.local',
    '{"role": "staff", "branch_id": "f1000000-0000-4000-8000-000000000001"}', '{"full_name": "NV A"}');

select is(
  (select phone from public.profiles where id = 'f9000000-0000-4000-8000-000000000001'),
  '0912111222',
  'tạo tài khoản: SĐT trong user_metadata được chuẩn hoá vào hồ sơ'
);
select is(
  (select phone from public.profiles where id = 'f9000000-0000-4000-8000-000000000002'),
  null,
  'không nhập SĐT thì để trống'
);
select throws_ok(
  $$ update public.profiles set phone = '123' where id = 'f9000000-0000-4000-8000-000000000002' $$,
  '23514',
  null,
  'chặn SĐT sai định dạng'
);

-- ---------------------------------------------------------------------------
-- Cơ sở
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.branches (code, name) values ('cs 3', 'Sai mã') $$,
  '23514',
  null,
  'mã cơ sở phải là chữ in hoa / số'
);

select throws_like(
  $$ update public.branches set is_active = false where id = 'f1000000-0000-4000-8000-000000000001' $$,
  '%còn nhân viên%',
  'không ngưng được cơ sở còn nhân viên'
);

update public.profiles set is_active = false where id = 'f9000000-0000-4000-8000-000000000002';

insert into public.products (id, name, slug, base_price, status)
values ('f5000000-0000-4000-8000-000000000001', 'Váy test', 'vay-test-dt', 300000, 'active');
insert into public.inventory_items (id, product_id, size, code, home_branch_id)
values ('f6000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'M', 'VT-M-TA',
  'f1000000-0000-4000-8000-000000000001');

select throws_like(
  $$ update public.branches set is_active = false where id = 'f1000000-0000-4000-8000-000000000001' $$,
  '%còn váy%',
  'không ngưng được cơ sở còn váy'
);

update public.inventory_items set status = 'retired' where id = 'f6000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ update public.branches set is_active = false where id = 'f1000000-0000-4000-8000-000000000001' $$,
  'ngưng được khi không còn váy, đơn, nhân viên'
);

-- Nhân viên không thêm được cơ sở
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "f9000000-0000-4000-8000-000000000002"}', true);
update public.profiles set is_active = true where id = 'f9000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok(
  $$ insert into public.branches (code, name) values ('TC', 'Test C') $$,
  '42501',
  null,
  'nhân viên không thêm được cơ sở'
);
insert into public.customers (full_name, phone) values ('Khách sửa SĐT', '0912888000');
select lives_ok(
  $$ update public.customers set phone = '+84 912 888 001' where phone = '0912888000' $$,
  'nhân viên sửa được SĐT khách (trigger chuẩn hoá chạy với quyền nhân viên)'
);
reset role;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "f9000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.profiles set phone = '0912 777 666' where id = 'f9000000-0000-4000-8000-000000000002' $$,
  'chủ shop sửa được SĐT nhân viên'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Báo cáo doanh thu
-- ---------------------------------------------------------------------------

update public.inventory_items set status = 'active' where id = 'f6000000-0000-4000-8000-000000000001';
update public.branches set is_active = true where id = 'f1000000-0000-4000-8000-000000000001';

do $$
declare
  b public.bookings;
begin
  b := public.create_booking(
    'f2000000-0000-4000-8000-000000000002',
    '{"full_name": "Khách DT", "phone": "0912999000"}',
    '[{"product_id": "f5000000-0000-4000-8000-000000000001", "size": "M"}]',
    current_date + 40, current_date + 42
  );
  insert into public.payments (booking_id, kind, method, amount, paid_at) values
    (b.id, 'payment', 'bank', 200000, now()),
    (b.id, 'payment', 'cash', 100000, now()),
    (b.id, 'refund', 'cash', 50000, now()),
    (b.id, 'security_hold', 'cash', 999000, now());
end;
$$;

select is(
  (public.revenue_report(private.today_vn(), private.today_vn(), 'f2000000-0000-4000-8000-000000000002') ->> 'collected')::bigint,
  250000::bigint,
  'đã thu = tiền trả − tiền hoàn, không tính thế chấp'
);
select is(
  (public.revenue_report(private.today_vn(), private.today_vn(), 'f2000000-0000-4000-8000-000000000002') -> 'by_method' -> 0 ->> 'method'),
  'bank',
  'gom theo hình thức thanh toán'
);
select is(
  (public.revenue_report(private.today_vn(), private.today_vn(), 'f1000000-0000-4000-8000-000000000001') ->> 'collected')::bigint,
  0::bigint,
  'lọc theo cơ sở'
);

select * from finish();
rollback;
