-- Mỗi 10 phút huỷ các đơn chờ cọc đã quá hạn giữ chỗ để nhả lịch váy
create extension if not exists pg_cron;

select cron.schedule(
  'expire-pending-bookings',
  '*/10 * * * *',
  $$select private.expire_pending_bookings()$$
);
