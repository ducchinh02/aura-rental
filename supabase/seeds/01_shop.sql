-- Thông tin thật của shop, lấy từ bio Instagram @aurarental.hn và @aurarental.sg (26/10/2026).
-- Chạy khi `pnpm db:reset` ở local. Trên production nhập qua trang Cài đặt (hoặc chạy file này một lần).

insert into public.branches (id, code, name, address, phone, map_url, open_time, close_time) values
  -- Chủ nhật đóng cửa sớm lúc 17:00; hệ thống mới có một khung giờ chung cho mọi ngày
  ('11111111-1111-4111-8111-111111111111', 'HN', 'Aura Rental Hà Nội',
    '46 Hoà Bình 3, Minh Khai, Hai Bà Trưng, Hà Nội', '0976804384',
    'https://maps.app.goo.gl/W6ZwKZG69yeTWoi77', '10:00', '19:00'),
  ('22222222-2222-4222-8222-222222222222', 'SG', 'Aura Rental Sài Gòn',
    'Tầng 3, 87B Đặng Dung, Quận 1, TP. Hồ Chí Minh', '0976382901',
    'https://maps.app.goo.gl/pUUr3xjoXiLKsAMH8', '14:00', '19:00');

-- Tài khoản nhận cọc (bank_bin, bank_account, bank_holder): chủ shop điền ở Cài đặt.
-- Chưa điền thì trang khách báo "shop sẽ nhắn số tài khoản" thay cho mã QR.

-- Danh mục theo mục nổi bật trên Instagram của shop
insert into public.categories (name, slug, sort_order) values
  ('Váy thiết kế', 'vay-thiet-ke', 1),
  ('Áo dài', 'ao-dai', 2),
  ('Phụ kiện', 'phu-kien', 3);
