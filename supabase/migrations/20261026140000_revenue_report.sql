-- Báo cáo doanh thu cho trang /admin/doanh-thu.
-- Tính trong database để không vướng giới hạn số dòng của API. Chạy với quyền người gọi (RLS áp dụng).
--
--   "Đã thu"         = tiền khách trả (payment) trừ tiền hoàn (refund) theo ngày ghi nhận, không tính thế chấp.
--   "Doanh thu đơn"  = tổng tiền các đơn không hủy có ngày nhận váy trong kỳ.
--   "Còn phải thu"   = phần khách còn thiếu của các đơn đang xử lý (không phụ thuộc kỳ).

create function public.revenue_report(
  p_from date,
  p_to date,
  p_branch_id uuid default null,
  p_bucket text default 'day' -- 'day' | 'month'
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with pay as (
    select
      p.kind,
      p.method,
      p.amount * case p.kind when 'refund' then -1 else 1 end as signed,
      (p.paid_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
      b.branch_id
    from public.payments p
    join public.bookings b on b.id = p.booking_id
    where p.kind in ('payment', 'refund')
      and (p.paid_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
      and (p_branch_id is null or b.branch_id = p_branch_id)
  ),
  bk as (
    select b.id, b.branch_id, b.source, b.total
    from public.bookings b
    where b.status <> 'cancelled'
      and b.pickup_date between p_from and p_to
      and (p_branch_id is null or b.branch_id = p_branch_id)
  ),
  items as (
    select bi.price, pr.id as product_id, pr.name, pr.color, c.name as category,
      (select pi.storage_path from public.product_images pi
        where pi.product_id = pr.id order by pi.is_cover desc, pi.sort_order limit 1) as image
    from bk
    join public.booking_items bi on bi.booking_id = bk.id
    join public.inventory_items ii on ii.id = bi.item_id
    join public.products pr on pr.id = ii.product_id
    left join public.categories c on c.id = pr.category_id
  ),
  open_balance as (
    select t.balance_due, t.security_held
    from public.bookings b
    join public.booking_payment_totals t on t.booking_id = b.id
    where b.status in ('pending', 'confirmed', 'picked_up', 'returned')
      and (p_branch_id is null or b.branch_id = p_branch_id)
  )
  select jsonb_build_object(
    'collected', coalesce((select sum(signed) from pay), 0),
    'payments_count', (select count(*) from pay where kind = 'payment'),
    'refunds', coalesce((select -sum(signed) from pay where kind = 'refund'), 0),
    'bookings_count', (select count(*) from bk),
    'bookings_total', coalesce((select sum(total) from bk), 0),
    'outstanding', coalesce((select sum(balance_due) from open_balance where balance_due > 0), 0),
    'outstanding_count', (select count(*) from open_balance where balance_due > 0),
    'security_held', coalesce((select sum(security_held) from open_balance), 0),
    'by_period', coalesce((
      select jsonb_agg(x order by x.bucket)
      from (
        select
          case when p_bucket = 'month' then to_char(day, 'YYYY-MM') else to_char(day, 'YYYY-MM-DD') end as bucket,
          branch_id,
          sum(signed) as amount
        from pay
        group by 1, 2
      ) x
    ), '[]'::jsonb),
    'by_branch', coalesce((
      select jsonb_agg(x)
      from (
        select br.id as branch_id,
          coalesce((select sum(signed) from pay where pay.branch_id = br.id), 0) as collected,
          (select count(*) from bk where bk.branch_id = br.id) as bookings,
          coalesce((select sum(total) from bk where bk.branch_id = br.id), 0) as booked
        from public.branches br
        where p_branch_id is null or br.id = p_branch_id
      ) x
    ), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(x order by x.amount desc)
      from (select method, sum(signed) as amount from pay group by 1) x
    ), '[]'::jsonb),
    'by_source', coalesce((
      select jsonb_agg(x order by x.total desc)
      from (select source, count(*) as bookings, sum(total) as total from bk group by 1) x
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(x order by x.revenue desc)
      from (select coalesce(category, 'Chưa phân loại') as category, count(*) as rentals, sum(price) as revenue from items group by 1) x
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(x order by x.revenue desc)
      from (
        select product_id, name, color, category, image, count(*) as rentals, sum(price) as revenue
        from items
        group by product_id, name, color, category, image
        order by sum(price) desc
        limit 10
      ) x
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.revenue_report from public, anon;
grant execute on function public.revenue_report to authenticated;
