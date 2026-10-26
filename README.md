# Aura Rental

Web quản lý đặt thuê váy cho Aura Rental (2 cơ sở): trang khách xem váy, đặt lịch thuê, đặt lịch thử; trang quản trị cho nhân viên và chủ shop.

Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage, pg_cron) · Tailwind CSS v4

## Chạy local

Cần Node 22+, pnpm, Docker Desktop đang chạy.

```bash
pnpm install
pnpm db:start            # khởi động Supabase local (lần đầu tải image khá lâu)
cp .env.example .env.local
pnpm exec supabase status -o env   # điền API_URL, PUBLISHABLE_KEY, SECRET_KEY vào .env.local
pnpm db:reset            # tạo lại DB từ migrations + supabase/seed.sql
pnpm dev
```

- Supabase Studio: http://127.0.0.1:54323
- Tài khoản mẫu (mật khẩu `aura123456`): `owner@aura.local` (chủ shop), `nv.cs1@aura.local`, `nv.cs2@aura.local`

## Lệnh hay dùng

| Lệnh | Việc |
|---|---|
| `pnpm db:reset` | Áp lại toàn bộ migration + dữ liệu mẫu |
| `pnpm db:test` | Chạy test pgTAP trong `supabase/tests` |
| `pnpm db:types` | Sinh lại `src/types/database.ts` sau khi đổi schema |
| `pnpm typecheck` / `pnpm lint` | Kiểm tra TypeScript / ESLint |

Đổi schema: tạo file mới bằng `pnpm exec supabase migration new <ten>`, không sửa migration đã chạy trên production.

## Quy tắc nghiệp vụ chính

- **Kho gốc:** mỗi chiếc váy thuộc 1 cơ sở. Đơn ở cơ sở kia vẫn thuê được; hệ thống tự tạo phiếu chuyển đi khi đơn được xác nhận cọc và phiếu chuyển về khi khách trả.
- **Khoá lịch:** mỗi chiếc bị khoá `[nhận − ship − chuyển, trả + ship + giặt + chuyển]`, số ngày lấy từ bảng `settings`. Database chặn trùng lịch bằng exclusion constraint, không chỉ ở giao diện.
- **Trạng thái đơn:** `pending → confirmed → picked_up → returned → completed`, huỷ được khi `pending`/`confirmed`. Đơn chờ cọc quá `hold_hours` mà chưa ghi nhận tiền sẽ tự huỷ (pg_cron, 10 phút/lần).
- **Khách trả váy tại đúng cơ sở đã thuê.**
- **Giá:** giá gói `rental_days` ngày + phụ thu mỗi ngày vượt gói; mỗi cơ sở có thể đặt giá riêng. Nhân viên sửa được giá trên đơn (được ghi lịch sử), chỉ chủ shop sửa giá mẫu váy.
- **Phân quyền:** nhân viên xem dữ liệu cả 2 cơ sở nhưng chỉ tạo/sửa đơn ở cơ sở mình. Khách đặt đơn/lịch thử qua Server Action (kiểm tra captcha) gọi RPC bằng service role; khách không gọi thẳng được RPC tạo đơn.

## Cấu trúc

```
src/
  lib/supabase/   client.ts (browser) · server.ts (theo phiên) · admin.ts (service role, server-only) · proxy.ts
  proxy.ts        làm mới phiên + chặn /admin khi chưa đăng nhập
  types/database.ts   sinh tự động
supabase/
  migrations/     schema · nghiệp vụ đặt váy · lịch thử · RLS · cron
  seed.sql        dữ liệu mẫu local
  tests/database/ test pgTAP cho quy tắc đặt váy
```
