-- Tuỳ chọn cọc theo mẫu váy. Chạy: pnpm db:test
--   Mẫu C cần cọc 100.000; mẫu N không cần cọc (deposit_amount 50.000 bị bỏ qua). Giữ chỗ 24 giờ.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

update public.settings set hold_hours = 24;

insert into public.branches (id, code, name) values
  ('c1000000-0000-4000-8000-000000000001', 'DA', 'Cọc A');

insert into auth.users (id, email, raw_app_meta_data) values
  ('c9000000-0000-4000-8000-000000000001', 'staff-coc@test.local',
    '{"role": "staff", "branch_id": "c1000000-0000-4000-8000-000000000001"}');

insert into public.products (id, name, slug, base_price, rental_days, deposit_amount, security_amount, requires_deposit, status) values
  ('c5000000-0000-4000-8000-000000000001', 'Váy cần cọc', 'vay-can-coc', 400000, 3, 100000, 500000, true, 'active'),
  ('c5000000-0000-4000-8000-000000000002', 'Váy không cọc', 'vay-khong-coc', 300000, 3, 50000, 200000, false, 'active');

insert into public.inventory_items (product_id, size, code, home_branch_id) values
  ('c5000000-0000-4000-8000-000000000001', 'M', 'COC-M-1', 'c1000000-0000-4000-8000-000000000001'),
  ('c5000000-0000-4000-8000-000000000002', 'M', 'KCOC-M-1', 'c1000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims', '{"role": "service_role"}', true);

create function pg_temp.web_order(p_phone text, p_items jsonb, p_day int) returns public.bookings language sql as $$
  select public.create_booking(
    'c1000000-0000-4000-8000-000000000001',
    jsonb_build_object('full_name', 'Khách cọc', 'phone', p_phone),
    p_items, current_date + p_day, current_date + p_day + 1
  )
$$;

create temp table b as
  select * from pg_temp.web_order('0915000001', '[{"product_id": "c5000000-0000-4000-8000-000000000002", "size": "M"}]', 30);

select results_eq(
  $$ select status::text, deposit_required, security_deposit, hold_expires_at is null from b $$,
  $$ values ('pending', 0::bigint, 200000::bigint, true) $$,
  'mẫu không cần cọc: đơn chờ xác nhận, cọc 0, vẫn tính thế chấp, không có hạn giữ chỗ'
);

select set_config('request.jwt.claims', '', true);

select is(private.expire_pending_bookings() >= 0, true, 'chạy huỷ đơn quá hạn');
select is(
  (select status::text from public.bookings where id = (select id from b)),
  'pending',
  'đơn không cần cọc không bị cron tự huỷ'
);

-- Thêm váy cần cọc vào đơn đang chờ: bắt đầu tính cọc và hạn giữ chỗ; bỏ ra thì về như cũ
select public.add_booking_item((select id from b), 'c5000000-0000-4000-8000-000000000001', 'M');
select results_eq(
  $$ select deposit_required, hold_expires_at between now() + interval '23 hours' and now() + interval '25 hours'
     from public.bookings where id = (select id from b) $$,
  $$ values (100000::bigint, true) $$,
  'thêm váy cần cọc: cọc 100.000 và bắt đầu giữ chỗ 24 giờ'
);

select public.remove_booking_item(
  (select bi.id from public.booking_items bi join public.inventory_items i on i.id = bi.item_id
   where bi.booking_id = (select id from b) and i.code = 'COC-M-1')
);
select results_eq(
  $$ select deposit_required, hold_expires_at is null from public.bookings where id = (select id from b) $$,
  $$ values (0::bigint, true) $$,
  'bỏ váy cần cọc: đơn lại không cần cọc, không có hạn'
);

-- Đơn có cả 2 mẫu: chỉ cộng cọc của mẫu cần cọc
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select results_eq(
  $$ select deposit_required, hold_expires_at is not null
     from pg_temp.web_order('0915000002',
       '[{"product_id": "c5000000-0000-4000-8000-000000000001", "size": "M"},
         {"product_id": "c5000000-0000-4000-8000-000000000002", "size": "M"}]', 40) $$,
  $$ values (100000::bigint, true) $$,
  'đơn có cả 2 mẫu: cọc chỉ tính mẫu cần cọc và có hạn giữ chỗ'
);
select set_config('request.jwt.claims', '', true);

select results_eq(
  $$ select deposit from public.quote_rental('c5000000-0000-4000-8000-000000000002', 'M',
       'c1000000-0000-4000-8000-000000000001', current_date + 50, current_date + 51) $$,
  $$ values (0::bigint) $$,
  'báo giá mẫu không cần cọc: cọc 0'
);

-- Nhân viên không bật / tắt cọc được, chủ shop thì được (qua quyền sửa giá)
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "c9000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.products set requires_deposit = true where id = 'c5000000-0000-4000-8000-000000000002' $$,
  '42501',
  'Chỉ chủ shop được sửa giá',
  'nhân viên không tắt / bật cọc được'
);
select lives_ok(
  $$ update public.products set description = 'Sửa mô tả' where id = 'c5000000-0000-4000-8000-000000000002' $$,
  'nhân viên vẫn sửa được thông tin khác của mẫu'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- Xác nhận đơn không cần cọc như bình thường
update public.bookings set status = 'confirmed' where id = (select id from b);
select is(
  (select status::text from public.bookings where id = (select id from b)),
  'confirmed',
  'shop xác nhận đơn không cần cọc'
);

select * from finish();
rollback;
