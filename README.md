# Aura Rental

Web quản lý đặt thuê váy cho Aura Rental (nhiều cơ sở): trang khách xem váy, đặt lịch thuê, đặt lịch thử; trang quản trị cho nhân viên và chủ shop.

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
- **Thuê theo giờ:** đơn có `rental_unit = 'hour'` với `pickup_at` / `return_at`. Chỉ mẫu có `hourly_price` mới thuê giờ được; giá = gói `hourly_hours` giờ + mỗi giờ vượt gói (làm tròn lên) × `extra_hour_price`, cơ sở có thể đặt giá giờ riêng. Khách nhận và trả tại shop, tối đa 24 giờ; đơn từ web phải trong giờ mở cửa. Một chiếc váy nhận nhiều lượt giờ trong ngày, giữa hai lượt cách nhau `settings.hourly_buffer_minutes` (mặc định 120 phút). Lịch dùng `booking_items.blocked_range` (tstzrange); `blocked_period` theo ngày vẫn được giữ để đơn theo ngày không chồng lên ngày đã có đơn giờ. Trả trễ gợi ý phụ thu theo số giờ × giá giờ thêm.
- **Phân quyền:** chủ shop toàn quyền; nhân viên xem dữ liệu mọi cơ sở nhưng chỉ tạo/sửa đơn, thu tiền ở cơ sở mình (bảng chi tiết ở Cài đặt → Phân quyền). Khách đặt đơn/lịch thử qua Server Action (kiểm tra captcha) gọi RPC bằng service role; khách không gọi thẳng được RPC tạo đơn.

## Trang quản trị

| Đường dẫn | Việc |
|---|---|
| `/admin` | Việc hôm nay: khách nhận/trả váy, đơn cần gửi ship, quá hạn trả, chờ cọc, lịch thử, chuyển váy, doanh thu tháng |
| `/admin/don` | Danh sách đơn; `/admin/don/moi` tạo đơn theo ngày hoặc theo giờ (`?unit=hour`); `/admin/don/[mã]` đổi trạng thái, ngày/giờ, váy, phí, thu/hoàn tiền |
| `/admin/lich` | Lịch váy: chế độ Ngày (trạng thái từng chiếc hôm nay) và Tuần / 2 tuần / Tháng (dòng thời gian, số chiếc còn trống mỗi ngày); bấm ô trống để tạo đơn |
| `/admin/thu-do` | Lịch thử 7 ngày, cảnh báo váy chưa có ở cơ sở hẹn, tạo đơn từ buổi thử |
| `/admin/chuyen-vay` | Phiếu chuyển váy giữa các cơ sở: cơ sở gửi bấm "Đã gửi", cơ sở nhận bấm "Đã nhận" |
| `/admin/vay` | Mẫu váy, ảnh, từng chiếc theo size/kho gốc, giá riêng theo cơ sở |
| `/admin/khach` | Khách hàng, lịch sử thuê, danh sách đen |
| `/admin/doanh-thu` | Doanh thu theo kỳ: đã thu, doanh thu đơn, công nợ, theo cơ sở / hình thức / nguồn / danh mục, top mẫu váy, xuất CSV |
| `/admin/cai-dat` | Thông số vận hành, thêm / ngưng cơ sở, danh mục, tài khoản nhân viên (có SĐT), bảng phân quyền |

Ô chọn cơ sở trên thanh bên lọc dữ liệu đang xem (lưu trong cookie). Quyền sửa vẫn do RLS quyết định.

Next.js 16 bật `cacheComponents`: trang đọc dữ liệu theo phiên phải nằm trong `<Suspense>` (mỗi route có `loading.tsx`), và `createClient()` gọi `connection()` trước khi chạm vào Supabase.

## Cấu trúc

```
src/
  app/admin/      các trang quản trị; mỗi khu có actions.ts (Server Action) cạnh page.tsx
  app/login/      đăng nhập nhân viên
  components/admin/   khung trang, dòng đơn, ô nhập tiền, chọn mẫu váy…
  components/ui/  shadcn/ui (Radix)
  lib/            auth, cơ sở đang xem, ngày giờ VN, định dạng tiền, nhãn tiếng Việt
  lib/supabase/   client.ts (browser) · server.ts (theo phiên) · admin.ts (service role, server-only) · proxy.ts
  proxy.ts        làm mới phiên + chặn /admin khi chưa đăng nhập
  types/database.ts   sinh tự động
supabase/
  migrations/     schema · nghiệp vụ đặt váy · lịch thử · RLS · cron
  seed.sql        dữ liệu mẫu local
  tests/database/ test pgTAP cho quy tắc đặt váy
```
