-- Trang khách: khung giờ trống, tin Realtime, chặn đơn web. Chạy: pnpm db:test
--   Mẫu S: gói 3 giờ 150.000; một chiếc size M ở SA (mở 08:00 – 21:00). Chuẩn bị giữa 2 lượt: 120 phút.
--   D = current_date + 30 (giờ VN).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

update public.settings set transfer_days = 1, hourly_buffer_minutes = 120;

insert into public.branches (id, code, name, open_time, close_time) values
  ('b1000000-0000-4000-8000-000000000001', 'SA', 'Shop A', '08:00', '21:00');

insert into public.products (id, name, slug, base_price, rental_days, extra_day_price, hourly_price, hourly_hours, extra_hour_price, deposit_amount, status) values
  ('b5000000-0000-4000-8000-000000000001', 'Váy shop', 'vay-shop', 400000, 3, 100000, 150000, 3, 50000, 100000, 'active');

insert into public.inventory_items (id, product_id, size, code, home_branch_id) values
  ('b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'M', 'SHOP-M-1', 'b1000000-0000-4000-8000-000000000001');

create function pg_temp.at(h text) returns timestamptz language sql as $$
  select ((current_date + 30) + h::time) at time zone 'Asia/Ho_Chi_Minh'
$$;

create function pg_temp.slot_end(h text) returns timestamptz language sql as $$
  select max_end_at from public.get_hourly_slots(
    'b5000000-0000-4000-8000-000000000001', 'M', 'b1000000-0000-4000-8000-000000000001', current_date + 30)
  where start_at = pg_temp.at(h)
$$;

-- Ngày còn trống: nhận lúc 09:00 thì trả muộn nhất lúc đóng cửa
select is(pg_temp.slot_end('09:00'), pg_temp.at('21:00'), 'khung giờ: ngày trống thuê được đến giờ đóng cửa');

select public.create_booking(
  'b1000000-0000-4000-8000-000000000001',
  '{"full_name": "Khách giờ", "phone": "0914000001"}',
  '[{"product_id": "b5000000-0000-4000-8000-000000000001", "size": "M"}]',
  null, null, p_unit => 'hour', p_pickup_at => pg_temp.at('14:00'), p_return_at => pg_temp.at('17:00')
);

select is(pg_temp.slot_end('09:00'), pg_temp.at('12:00'), 'khung giờ: phải trả trước lượt 14:00 đủ 120 phút chuẩn bị');
select is(pg_temp.slot_end('15:00'), null, 'khung giờ: đang có khách thuê thì không nhận được');
select is(pg_temp.slot_end('19:00'), pg_temp.at('21:00'), 'khung giờ: nhận lại được sau 17:00 + 120 phút');
select is(pg_temp.slot_end('12:00'), null, 'khung giờ: không đủ tối thiểu 1 giờ trước lượt sau');

-- Realtime: đơn mới phát tin lên kênh của mẫu váy, chỉ có size và khoảng ngày
select results_eq(
  $$ select event, extension, private, payload ->> 'size', (payload ->> 'from')::date
     from realtime.messages
     where topic = 'availability:b5000000-0000-4000-8000-000000000001'
     order by inserted_at desc limit 1 $$,
  $$ values ('changed', 'broadcast', true, 'M', current_date + 30) $$,
  'realtime: đơn mới phát tin "changed" lên availability:<mẫu>'
);

-- Khách (anon) chỉ được ghi presence, không tự phát tin "changed"
select set_config('realtime.topic', 'availability:b5000000-0000-4000-8000-000000000001', true);
set local role anon;
select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('availability:b5000000-0000-4000-8000-000000000001', 'broadcast', 'changed', '{}', true) $$,
  '42501',
  null,
  'realtime: khách không tự phát tin lên kênh lịch váy'
);
select lives_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('availability:b5000000-0000-4000-8000-000000000001', 'presence', 'presence', '{}', true) $$,
  'realtime: khách được báo đang xem (presence)'
);
reset role;

-- Đơn web: tối đa 2 đơn chờ cọc mỗi SĐT, khách danh sách đen không đặt online được
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

create function pg_temp.web_order(p_phone text, p_day int) returns public.bookings language sql as $$
  select public.create_booking(
    'b1000000-0000-4000-8000-000000000001',
    jsonb_build_object('full_name', 'Khách web', 'phone', p_phone),
    '[{"product_id": "b5000000-0000-4000-8000-000000000001", "size": "M"}]',
    current_date + p_day, current_date + p_day
  )
$$;

select pg_temp.web_order('0914000002', 40);
select pg_temp.web_order('0914000002', 45);
select throws_like(
  $$ select pg_temp.web_order('0914000002', 50) $$,
  '%2 đơn chờ cọc%',
  'web: SĐT đã có 2 đơn chờ cọc không đặt thêm được'
);

reset role;
select set_config('request.jwt.claims', '', true);
insert into public.customers (full_name, phone, is_blacklisted) values ('Khách xấu', '0914000003', true);
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_like(
  $$ select pg_temp.web_order('0914000003', 55) $$,
  '%chưa đặt online được%',
  'web: khách trong danh sách đen bị chặn'
);

select * from finish();
rollback;
