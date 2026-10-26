-- Thuê theo giờ. Chạy: pnpm db:test
--   Mẫu H: gói 3 giờ 150.000, mỗi giờ thêm 50.000; một chiếc size M, kho gốc HA.
--   Thời gian chuẩn bị giữa 2 lượt giờ: 120 phút. D = current_date + 30 (giờ VN).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

update public.settings set cleaning_days = 1, transfer_days = 1, hourly_buffer_minutes = 120;

insert into public.branches (id, code, name, open_time, close_time) values
  ('a1000000-0000-4000-8000-000000000001', 'HA', 'Giờ A', '08:00', '21:00'),
  ('a2000000-0000-4000-8000-000000000002', 'HB', 'Giờ B', '08:00', '21:00');

insert into public.products (id, name, slug, base_price, rental_days, extra_day_price, hourly_price, hourly_hours, extra_hour_price, status) values
  ('a5000000-0000-4000-8000-000000000001', 'Váy giờ', 'vay-gio', 400000, 3, 100000, 150000, 3, 50000, 'active'),
  ('a5000000-0000-4000-8000-000000000002', 'Váy chỉ ngày', 'vay-chi-ngay', 400000, 3, 100000, null, 3, 0, 'active');

insert into public.inventory_items (product_id, size, code, home_branch_id) values
  ('a5000000-0000-4000-8000-000000000001', 'M', 'GIO-M-1', 'a1000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-4000-8000-000000000002', 'M', 'NGAY-M-1', 'a1000000-0000-4000-8000-000000000001');

create function pg_temp.at(h text) returns timestamptz language sql as $$
  select ((current_date + 30) + h::time) at time zone 'Asia/Ho_Chi_Minh'
$$;

create function pg_temp.book(p_phone text, p_from text, p_to text, p_product uuid default 'a5000000-0000-4000-8000-000000000001')
returns public.bookings language sql as $$
  select public.create_booking(
    'a1000000-0000-4000-8000-000000000001',
    jsonb_build_object('full_name', 'Khách giờ', 'phone', p_phone),
    jsonb_build_array(jsonb_build_object('product_id', p_product, 'size', 'M')),
    null, null,
    p_unit => 'hour', p_pickup_at => pg_temp.at(p_from), p_return_at => pg_temp.at(p_to)
  )
$$;

-- ---------------------------------------------------------------------------
-- Giá và ngày
-- ---------------------------------------------------------------------------

select lives_ok($$ select pg_temp.book('0913000001', '08:00', '12:00') $$, 'tạo đơn thuê giờ 8h–12h');

select results_eq(
  $$ select b.rental_unit::text, b.pickup_date, b.return_date, b.subtotal
     from public.bookings b join public.customers c on c.id = b.customer_id where c.phone = '0913000001' $$,
  $$ values ('hour', current_date + 30, current_date + 30, 200000::bigint) $$,
  '4 giờ = gói 3 giờ 150.000 + 1 giờ thêm 50.000; ngày nhận / trả lấy từ giờ'
);

select is(
  (select bi.blocked_range from public.booking_items bi
   join public.bookings b on b.id = bi.booking_id join public.customers c on c.id = b.customer_id
   where c.phone = '0913000001'),
  tstzrange(pg_temp.at('08:00'), pg_temp.at('14:00'), '[)'),
  'giữ váy tới giờ trả + 120 phút chuẩn bị'
);

-- ---------------------------------------------------------------------------
-- Nhiều lượt trong ngày
-- ---------------------------------------------------------------------------

select throws_like(
  $$ select pg_temp.book('0913000002', '13:00', '16:00') $$,
  '%kín lịch trong khung giờ%',
  'chưa đủ thời gian chuẩn bị thì không nhận lượt kế tiếp'
);

select lives_ok($$ select pg_temp.book('0913000003', '14:00', '17:00') $$, 'lượt thứ hai cùng ngày sau thời gian chuẩn bị');

select throws_like(
  $$ select public.create_booking(
       'a1000000-0000-4000-8000-000000000001', '{"full_name": "Khách ngày", "phone": "0913000004"}',
       '[{"product_id": "a5000000-0000-4000-8000-000000000001", "size": "M"}]',
       current_date + 30, current_date + 30) $$,
  '%kín lịch%',
  'đơn ngày không chồng lên ngày đã có đơn giờ'
);

select is(
  (select array_agg(d) from public.get_unavailable_dates(
     'a5000000-0000-4000-8000-000000000001', 'M', 'a1000000-0000-4000-8000-000000000001',
     current_date + 30, current_date + 30) d),
  array[current_date + 30],
  'lịch theo ngày coi ngày có đơn giờ là đã kín'
);

-- ---------------------------------------------------------------------------
-- Ràng buộc
-- ---------------------------------------------------------------------------

select throws_like(
  $$ select pg_temp.book('0913000005', '09:00', '11:00', 'a5000000-0000-4000-8000-000000000002') $$,
  '%chưa cho thuê theo giờ%',
  'mẫu không có giá giờ thì không thuê theo giờ'
);

select throws_like(
  $$ select public.create_booking(
       'a1000000-0000-4000-8000-000000000001', '{"full_name": "Khách", "phone": "0913000006"}',
       '[{"product_id": "a5000000-0000-4000-8000-000000000001", "size": "M"}]',
       null, null, 'ship', 'local', '1 Đường A',
       p_unit => 'hour', p_pickup_at => pg_temp.at('18:00'), p_return_at => pg_temp.at('20:00')) $$,
  '%tại shop%',
  'thuê giờ không giao ship'
);

select throws_like(
  $$ select pg_temp.book('0913000007', '18:00', '17:00') $$,
  '%Giờ trả phải sau giờ nhận%',
  'giờ trả phải sau giờ nhận'
);

-- Khách đặt qua web: phải trong giờ mở cửa
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_like(
  $$ select pg_temp.book('0913000008', '20:00', '22:00') $$,
  '%giờ mở cửa%',
  'web: không nhận giờ trả sau giờ đóng cửa'
);
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Đổi giờ, quá giờ, báo giá
-- ---------------------------------------------------------------------------

update public.bookings set return_at = pg_temp.at('11:00')
where customer_id = (select id from public.customers where phone = '0913000001');

select results_eq(
  $$ select b.subtotal, upper(bi.blocked_range)
     from public.bookings b join public.booking_items bi on bi.booking_id = b.id
     join public.customers c on c.id = b.customer_id where c.phone = '0913000001' $$,
  $$ values (150000::bigint, pg_temp.at('13:00')) $$,
  'đổi giờ trả → tính lại giá (3 giờ = giá gói) và khoảng giữ'
);

select throws_like(
  $$ update public.bookings set return_at = pg_temp.at('13:00')
     where customer_id = (select id from public.customers where phone = '0913000001') $$,
  '%booking_items_no_overlap%',
  'không kéo dài đè lên lượt sau'
);

select results_eq(
  $$ select available, price, hours from public.quote_rental(
       'a5000000-0000-4000-8000-000000000001', 'M', 'a1000000-0000-4000-8000-000000000001', null, null,
       p_unit => 'hour', p_pickup_at => pg_temp.at('19:00'), p_return_at => pg_temp.at('21:00')) $$,
  $$ values (true, 150000::bigint, 2) $$,
  'báo giá giờ: dưới gói vẫn tính giá gói, còn trống buổi tối'
);

select * from finish();
rollback;
