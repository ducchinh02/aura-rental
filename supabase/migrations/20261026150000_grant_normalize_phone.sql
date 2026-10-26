-- Trigger chuẩn hoá SĐT (khách, nhân viên) chạy với quyền người sửa, nên người dùng đăng nhập
-- cần quyền gọi hàm này. Thiếu quyền thì nhân viên sửa SĐT khách / chủ shop sửa SĐT nhân viên bị lỗi
-- "permission denied for function normalize_phone". Hàm chỉ định dạng chuỗi, không đọc dữ liệu.
grant execute on function private.normalize_phone(text) to authenticated;
