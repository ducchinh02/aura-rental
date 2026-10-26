# Hướng dẫn bàn giao: cài đặt và phát triển tiếp Aura Rental

Tài liệu này dành cho người **không chuyên lập trình** nhận lại mã nguồn. Làm lần lượt từ trên xuống: phần 1–4 làm **một lần** khi nhận máy, phần 5 là việc **hằng ngày**, các phần sau dùng khi cần.

Bạn không cần tự viết code. Cách làm được khuyến nghị: mô tả việc muốn sửa bằng tiếng Việt cho trợ lý AI **Claude Code**, rồi kiểm tra kết quả trên trình duyệt (phần 7).

---

## Mục lục

1. [Dự án gồm những gì](#1-dự-án-gồm-những-gì)
2. [Vài từ cần biết](#2-vài-từ-cần-biết)
3. [Cài phần mềm (một lần)](#3-cài-phần-mềm-một-lần)
4. [Chạy dự án lần đầu](#4-chạy-dự-án-lần-đầu)
5. [Mỗi ngày làm việc](#5-mỗi-ngày-làm-việc)
6. [Muốn sửa chỗ nào thì xem file nào](#6-muốn-sửa-chỗ-nào-thì-xem-file-nào)
7. [Phát triển tiếp với Claude Code](#7-phát-triển-tiếp-với-claude-code)
8. [Lưu và quay lại phiên bản cũ (Git)](#8-lưu-và-quay-lại-phiên-bản-cũ-git)
9. [Sửa database](#9-sửa-database)
10. [Nhập dữ liệu thật của shop](#10-nhập-dữ-liệu-thật-của-shop)
11. [Đưa web lên mạng](#11-đưa-web-lên-mạng)
12. [Lỗi hay gặp](#12-lỗi-hay-gặp)
13. [Việc còn dang dở](#13-việc-còn-dang-dở)
14. [Bảng lệnh nhanh](#14-bảng-lệnh-nhanh)

---

## 1. Dự án gồm những gì

Aura Rental là web quản lý cho thuê váy của shop, có 3 phần:

| Phần | Ai dùng | Địa chỉ khi chạy trên máy |
|---|---|---|
| **Trang khách** | Khách xem váy, chọn ngày, đặt giữ váy, tra cứu đơn | http://localhost:3000 |
| **Trang quản trị** | Chủ shop và nhân viên: đơn thuê, lịch váy, kho váy, khách, doanh thu, cài đặt | http://localhost:3000/admin |
| **Database** | Nơi lưu toàn bộ dữ liệu: váy, đơn, khách, tiền | Xem bằng Supabase Studio: http://127.0.0.1:54323 |

Công nghệ (chỉ cần biết tên để tra cứu khi cần):

- **Next.js 16**: khung làm web (cả trang khách lẫn trang quản trị).
- **Supabase**: database Postgres, đăng nhập, lưu ảnh, cập nhật trực tiếp (Realtime). Khi làm trên máy, Supabase chạy bên trong **Docker**.
- **Tailwind CSS** + **shadcn/ui**: giao diện.

Tài liệu khác trong dự án:

- [`README.md`](../README.md): tổng quan, **quy tắc nghiệp vụ** (cọc, khoá lịch, thuê theo giờ, phân quyền). Đọc mục "Quy tắc nghiệp vụ chính" trước khi sửa logic đặt váy.
- [`AGENTS.md`](../AGENTS.md): lưu ý cho trợ lý AI về Next.js 16. Không cần đọc, AI tự đọc.
- [`.claude/skills/aura-ui/SKILL.md`](../.claude/skills/aura-ui/SKILL.md): quy tắc giao diện (màu, chữ, component). Claude Code tự dùng khi sửa giao diện.

---

## 2. Vài từ cần biết

| Từ | Nghĩa |
|---|---|
| **Terminal** | Cửa sổ gõ lệnh. Trong VS Code: menu **Terminal → New Terminal**. Gõ lệnh rồi nhấn Enter. |
| **Lệnh** | Dòng chữ trong khung xám của tài liệu này, ví dụ `pnpm dev`. Copy nguyên dòng, dán vào Terminal, nhấn Enter. |
| **Dừng lệnh đang chạy** | Bấm vào Terminal rồi nhấn **Ctrl + C** (cả Mac lẫn Windows). |
| **Repo** | Thư mục mã nguồn được quản lý bằng Git, lưu trên GitHub. |
| **Commit** | Một lần "lưu phiên bản" có ghi chú. Có thể quay lại bất kỳ commit nào. |
| **Migration** | File `.sql` mô tả một lần thay đổi cấu trúc database. Chạy theo thứ tự tên file. |
| **Seed** | Dữ liệu ban đầu nạp vào database khi tạo lại database trên máy. |
| **Local** | Chạy trên máy của bạn, chỉ bạn thấy. Đối lập với **production** (web thật trên mạng). |

---

## 3. Cài phần mềm (một lần)

Máy cần: macOS hoặc Windows 10/11, **RAM từ 8 GB** (Docker khá nặng), còn trống **khoảng 15 GB** ổ cứng.

Cài lần lượt:

1. **Git**: https://git-scm.com/downloads (Mac thường có sẵn; nếu Terminal hỏi cài "command line developer tools" thì bấm Cài).
2. **Node.js 22 (bản LTS)**: https://nodejs.org → tải bản **22.x LTS** → cài như phần mềm thường.
3. **pnpm** (công cụ cài thư viện): mở Terminal, chạy

   ```bash
   corepack enable
   ```

   Nếu báo lỗi quyền (thường trên Windows), chạy lệnh này thay thế:

   ```bash
   npm install -g pnpm@10
   ```

4. **Docker Desktop**: https://www.docker.com/products/docker-desktop → cài → **mở lên và để chạy** (biểu tượng cá voi trên thanh menu / khay hệ thống).
   - Windows: lúc cài nếu được hỏi bật **WSL 2** thì đồng ý, rồi khởi động lại máy.
5. **VS Code**: https://code.visualstudio.com
6. **Claude Code** trong VS Code: mở VS Code → biểu tượng Extensions (4 ô vuông bên trái) → tìm **"Claude Code"** → Install → đăng nhập tài khoản Claude.

Kiểm tra đã cài đủ: mở Terminal, chạy từng dòng, mỗi dòng phải in ra số phiên bản (không báo lỗi):

```bash
git --version
node -v
pnpm -v
docker --version
```

`node -v` phải bắt đầu bằng `v22`; `pnpm -v` bắt đầu bằng `10`.

---

## 4. Chạy dự án lần đầu

### 4.1. Lấy mã nguồn

Mã nguồn nằm ở GitHub: `https://github.com/ducchinh02/aura-rental`. Nhờ chủ dự án **mời tài khoản GitHub của bạn** vào repo trước.

Trong Terminal, đi tới thư mục muốn để dự án (ví dụ Documents) rồi tải về:

```bash
cd ~/Documents
git clone https://github.com/ducchinh02/aura-rental.git
```

Mở VS Code → **File → Open Folder** → chọn thư mục `aura-rental`. Từ đây trở đi, mọi lệnh đều chạy trong Terminal của VS Code (Terminal → New Terminal), nó tự đứng đúng thư mục dự án.

### 4.2. Cài thư viện

```bash
pnpm install
```

Chờ tới khi hiện `Done`. Mất 1–3 phút.

### 4.3. Khởi động database trên máy

Đảm bảo **Docker Desktop đang mở**, rồi chạy:

```bash
pnpm db:start
```

Lần đầu Docker phải tải khá nhiều (vài GB), có thể mất 5–15 phút. Xong sẽ in ra một bảng có các dòng như `API URL`, `Studio URL`… là được.

### 4.4. Tạo file cấu hình `.env.local`

File này chứa "chìa khoá" để web nói chuyện với database. **Không bao giờ đưa file này lên GitHub** (dự án đã tự chặn sẵn).

1. Trong cột file bên trái của VS Code, chuột phải `.env.example` → **Copy**, rồi chuột phải chỗ trống → **Paste**. Đổi tên file vừa dán thành `.env.local`.
2. Chạy lệnh để xem các khoá của database trên máy:

   ```bash
   pnpm exec supabase status -o env
   ```

3. Mở `.env.local`, điền theo bảng (copy phần sau dấu `=` của từng dòng tương ứng, **bỏ dấu ngoặc kép** nếu có):

   | Dòng trong `.env.local` | Lấy từ dòng trong kết quả lệnh trên |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL=` | `API_URL=` (thường là `http://127.0.0.1:54321`) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` | `PUBLISHABLE_KEY=` (bắt đầu bằng `sb_publishable_`) |
   | `SUPABASE_SECRET_KEY=` | `SECRET_KEY=` (bắt đầu bằng `sb_secret_`) |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY=` | **để trống** khi chạy trên máy |
   | `TURNSTILE_SECRET_KEY=` | **để trống** khi chạy trên máy |

4. Lưu file (Cmd + S trên Mac, Ctrl + S trên Windows).

### 4.5. Tạo database và dữ liệu ban đầu

```bash
pnpm db:reset
```

Lệnh này **xoá sạch database trên máy** rồi tạo lại từ đầu: cấu trúc bảng (thư mục `supabase/migrations`) + dữ liệu ban đầu (thư mục `supabase/seeds`): 2 cơ sở Hà Nội, Sài Gòn, danh mục váy và 3 tài khoản chạy thử.

### 4.6. Chạy web

```bash
pnpm dev
```

Khi Terminal hiện `Local: http://localhost:3000` là xong. Mở trình duyệt:

- Trang khách: http://localhost:3000
- Trang quản trị: http://localhost:3000/admin (sẽ chuyển sang trang đăng nhập)

Tài khoản chạy thử (chỉ có trên máy, mật khẩu đều là `aura123456`):

| Email | Vai trò |
|---|---|
| `owner@aura.local` | Chủ shop: toàn quyền, sửa giá, cài đặt, tạo tài khoản |
| `nv.hn@aura.local` | Nhân viên cơ sở Hà Nội |
| `nv.sg@aura.local` | Nhân viên cơ sở Sài Gòn |

Xem dữ liệu dạng bảng như Excel: **Supabase Studio** http://127.0.0.1:54323 → mục **Table Editor**.

> Lúc mới bàn giao, kho **chưa có váy** (đang chờ danh sách váy thật, xem phần 10). Muốn thử đặt đơn thì vào trang quản trị → **Kho váy** → thêm vài mẫu và vài chiếc váy.

---

## 5. Mỗi ngày làm việc

Bắt đầu:

1. Mở **Docker Desktop**, chờ nó chạy xong.
2. Mở VS Code (dự án `aura-rental`), mở Terminal.
3. Lấy bản mới nhất nếu có người khác cùng làm: `git pull`
4. `pnpm db:start` (nếu Docker vừa khởi động lại máy)
5. `pnpm dev` → mở http://localhost:3000

Kết thúc:

1. Bấm vào Terminal đang chạy `pnpm dev`, nhấn **Ctrl + C**.
2. Tắt database cho nhẹ máy (dữ liệu vẫn giữ nguyên): `pnpm exec supabase stop`

Sau mỗi lần `git pull` có thay đổi thư viện hoặc database, chạy thêm:

```bash
pnpm install
pnpm exec supabase migration up
```

Lệnh thứ hai áp các thay đổi database mới **mà không xoá dữ liệu** đang có.

---

## 6. Muốn sửa chỗ nào thì xem file nào

Không cần nhớ, nhưng biết để mô tả cho AI chính xác hơn (ví dụ: "sửa chữ trong form đặt váy ở `order-form.tsx`").

**Trang khách** (thư mục `src/app/(shop)/`):

| Muốn sửa | File |
|---|---|
| Trang chủ: khối giới thiệu, danh sách váy, bộ lọc | `src/app/(shop)/page.tsx`, `src/app/(shop)/catalog-grid.tsx` |
| Thanh trên cùng, chân trang (địa chỉ cơ sở) | `src/app/(shop)/layout.tsx` |
| Trang chi tiết váy | `src/app/(shop)/vay/[slug]/page.tsx` |
| Form đặt giữ váy, màn "đã giữ váy", mã QR | `src/app/(shop)/vay/[slug]/order-form.tsx`, `src/components/shop/deposit-payment.tsx` |
| Trang tra cứu đơn | `src/app/(shop)/tra-cuu/` |
| Kiểm tra dữ liệu khi khách bấm đặt (captcha, thông báo lỗi) | `src/app/(shop)/actions.ts` |

**Trang quản trị** (thư mục `src/app/admin/`):

| Mục trên menu | Thư mục |
|---|---|
| Hôm nay | `src/app/admin/page.tsx` |
| Đơn thuê (danh sách, tạo đơn, chi tiết đơn) | `src/app/admin/don/` |
| Lịch váy | `src/app/admin/lich/` |
| Thử đồ | `src/app/admin/thu-do/` |
| Chuyển váy giữa cơ sở | `src/app/admin/chuyen-vay/` |
| Kho váy | `src/app/admin/vay/` |
| Khách hàng | `src/app/admin/khach/` |
| Doanh thu | `src/app/admin/doanh-thu/` |
| Cài đặt | `src/app/admin/cai-dat/` |
| Các mục trên menu bên trái | `src/components/admin/nav-config.ts` |

**Dùng chung:**

| Muốn sửa | File |
|---|---|
| Màu chủ đạo, font chữ | `src/app/globals.css`, `src/app/layout.tsx` |
| Logo, biểu tượng tab trình duyệt | `public/brand/`, `src/app/icon.png` |
| Tên trạng thái đơn, nguồn đơn bằng tiếng Việt ("Chờ cọc", "Đã cọc"…) | `src/lib/labels.ts` |
| Quy tắc đặt váy: tính giá, khoá lịch, cọc, tự huỷ đơn, phân quyền | Database: `supabase/migrations/*.sql` (xem phần 9) |
| Dữ liệu ban đầu (cơ sở, danh mục, váy) | `supabase/seeds/` |

Mỗi khu trong `src/app/admin/` có file `actions.ts`: đó là nơi xử lý khi bấm nút lưu / gửi trong khu đó.

---

## 7. Phát triển tiếp với Claude Code

Mở khung Claude Code trong VS Code (biểu tượng Claude ở thanh bên hoặc góc trên). Claude đọc được toàn bộ dự án, tự chạy lệnh kiểm tra và tự đọc các file hướng dẫn `AGENTS.md`, `.claude/skills/aura-ui`.

### Cách nhờ cho hiệu quả

- **Một việc mỗi lần.** "Thêm ô Số đo vòng eo vào form đặt váy" tốt hơn "sửa form cho đẹp và thêm vài thứ".
- **Nói rõ ở đâu, cho ai, kết quả mong muốn.** Ví dụ:
  > Ở trang chi tiết đơn trong quản trị, thêm nút "Gửi Zalo" cạnh nút Gọi, bấm vào mở Zalo tới số điện thoại của khách.
- **Đưa ảnh chụp màn hình** khi muốn sửa giao diện: kéo ảnh vào khung chat và ghi "chỗ này bị lệch / quá nhỏ…".
- **Hỏi trước khi làm** với việc lớn: "Mình muốn thêm X, bạn đề xuất cách làm và nói sẽ sửa những file nào, chưa sửa vội."
- Việc đụng tới **tiền, cọc, khoá lịch, phân quyền** thì yêu cầu thêm: "viết test cho quy tắc mới và chạy `pnpm db:test`".

### Sau mỗi thay đổi

1. Nhờ Claude chạy kiểm tra (hoặc tự chạy):

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm db:test
   ```

   Cả ba không được báo lỗi (`error`). Một cảnh báo `warning` về TanStack Table là cũ, bỏ qua được.

2. **Tự mở trình duyệt xem lại** đúng chỗ vừa sửa, thử bấm như người dùng thật. Thử cả trên điện thoại: trong Chrome nhấn F12 → biểu tượng điện thoại.
3. Ổn thì **lưu phiên bản** (phần 8).

### Những điều nên tránh

- Không sửa file trong `supabase/migrations/` đã có từ trước: muốn đổi database thì tạo migration mới (phần 9).
- Không dán **khoá bí mật của web thật** (production) vào chat hay vào code. Khoá trên máy (local) thì không sao.
- Không chạy `pnpm db:reset` khi đang có dữ liệu thử muốn giữ: lệnh này xoá sạch database trên máy.

---

## 8. Lưu và quay lại phiên bản cũ (Git)

Dùng bảng **Source Control** trong VS Code (biểu tượng nhánh cây bên trái), không cần gõ lệnh:

- **Lưu phiên bản (commit):** ô Message ghi ngắn gọn đã làm gì (ví dụ "Thêm nút Gửi Zalo ở chi tiết đơn") → bấm **Commit** → bấm **Sync Changes** để đẩy lên GitHub.
- **Bỏ thay đổi chưa lưu của một file:** chuột phải file trong danh sách Changes → **Discard Changes**.
- **Thử nghiệm việc lớn mà không sợ hỏng bản chính:** bấm tên nhánh `main` ở góc dưới trái → **Create new branch** → đặt tên (ví dụ `them-zalo`). Làm xong, ổn thì nhờ Claude: "gộp nhánh này vào main".
- **Quay lại phiên bản trước khi lỡ commit sai:** nhờ Claude: "hoàn tác commit gần nhất" (Claude dùng `git revert`, an toàn vì không xoá lịch sử).

Nên commit **sau mỗi việc nhỏ đã chạy ổn**, để lúc hỏng chỉ mất ít công.

---

## 9. Sửa database

Mọi quy tắc quan trọng (tính giá, chặn 2 khách đặt trùng một chiếc váy, cọc, tự huỷ đơn chưa cọc, phân quyền) nằm **trong database**, không chỉ ở giao diện. Vì vậy khi đổi quy tắc:

1. Nhờ Claude: "tạo migration mới để …". Claude tạo file mới trong `supabase/migrations/`, tên bắt đầu bằng ngày giờ.
2. Áp lên database trên máy, giữ dữ liệu:

   ```bash
   pnpm exec supabase migration up
   ```

3. Cập nhật kiểu dữ liệu cho code:

   ```bash
   pnpm db:types
   ```

4. Chạy test database: `pnpm db:test`. Test nằm trong `supabase/tests/database/`.

Khi đã có web thật, migration mới phải được đẩy lên database thật (phần 11.6).

---

## 10. Nhập dữ liệu thật của shop

Đã có sẵn trong `supabase/seeds/01_shop.sql` (lấy từ Instagram của shop):

| | Hà Nội | Sài Gòn |
|---|---|---|
| Địa chỉ | 46 Hoà Bình 3, Minh Khai, Hai Bà Trưng | Tầng 3, 87B Đặng Dung, Quận 1 |
| Hotline | 0976 804 384 | 0976 382 901 |
| Giờ mở cửa | 10:00 – 19:00 (Chủ nhật thật ra đóng lúc 17:00) | 14:00 – 19:00 |

**Chưa có:** danh sách váy, ảnh váy, số tài khoản nhận cọc.

Hai cách thêm váy:

- **Qua trang quản trị** (dễ nhất, dùng được cả trên web thật): đăng nhập chủ shop → **Kho váy** → **Thêm mẫu váy** → điền tên, giá, cọc, thuê theo giờ… → tab **Từng chiếc** thêm từng chiếc theo size và kho gốc → tab **Ảnh** tải ảnh lên → chuyển **Hiển thị** sang "Đang hiển thị".
- **Qua file seed** (khi muốn nạp cả loạt trên máy): mở `supabase/seeds/02_dresses.sql`, làm theo hướng dẫn trong file (hoặc gửi Claude bảng Excel danh sách váy và nhờ "điền vào 02_dresses.sql"), rồi chạy `pnpm db:reset`.

Số tài khoản nhận cọc: đăng nhập chủ shop → **Cài đặt** → tab **Vận hành** → điền Ngân hàng, Số tài khoản, Tên chủ tài khoản → Lưu. Có thông tin này thì trang khách mới hiện **mã QR chuyển cọc**.

---

## 11. Đưa web lên mạng

> Phần này **chưa làm lần nào** cho dự án. Các bước dưới là cách làm chuẩn cho Next.js + Supabase; làm lần đầu nên nhờ Claude Code đi cùng từng bước.

Cần 3 tài khoản (đều đăng ký bằng email / GitHub):

- **Supabase** (https://supabase.com): database thật.
- **Vercel** (https://vercel.com): chạy web thật, tự cập nhật mỗi khi đẩy code lên GitHub.
- **Cloudflare** (https://dash.cloudflare.com): captcha **Turnstile** chống spam cho form đặt váy của khách. Gói miễn phí là đủ.

Kiểm tra bảng giá trước khi dùng cho shop thật: gói miễn phí của Vercel (Hobby) không dành cho mục đích thương mại, gói miễn phí của Supabase có giới hạn và tự tạm dừng nếu lâu không dùng.

### 11.1. Tạo database thật (Supabase)

1. supabase.com → **New project** → đặt tên `aura-rental`, đặt mật khẩu database (lưu lại cẩn thận), **Region: Southeast Asia (Singapore)**.
2. Trong Terminal của VS Code, đăng nhập và nối dự án với database thật:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <mã-dự-án>
   ```

   `<mã-dự-án>` là đoạn chữ trong địa chỉ trang Supabase: `supabase.com/dashboard/project/<mã-dự-án>`.

3. Tạo toàn bộ bảng và quy tắc trên database thật:

   ```bash
   pnpm exec supabase db push
   ```

4. Nạp thông tin cơ sở: trang Supabase → **SQL Editor** → dán toàn bộ nội dung `supabase/seeds/01_shop.sql` → **Run**. (Nếu đã điền váy vào `02_dresses.sql` thì làm tương tự với file đó.) **Không** chạy `90_dev_accounts.sql` trên web thật.

### 11.2. Cài đặt đăng nhập trên Supabase

Trang Supabase → **Authentication**:

- **Sign In / Providers**: tắt "Allow new users to sign up" (chỉ chủ shop tạo tài khoản cho nhân viên); bật **Email**; tắt "Confirm email".
- **URL Configuration** → **Site URL**: địa chỉ web thật (ví dụ `https://aurarental.vn`). Lúc đầu chưa có tên miền thì dùng địa chỉ Vercel cấp ở bước 11.4, sau đổi lại.

### 11.3. Tạo tài khoản chủ shop đầu tiên

1. **Authentication → Users → Add user → Create new user**: điền email và mật khẩu của chủ shop, tick **Auto Confirm User**.
2. **SQL Editor**, chạy (thay email và tên):

   ```sql
   update public.profiles
   set role = 'owner', branch_id = null, full_name = 'Tên chủ shop'
   where id = (select id from auth.users where email = 'email-chu-shop@gmail.com');
   ```

Từ đó chủ shop đăng nhập web thật, vào **Cài đặt → Tài khoản** để tạo tài khoản cho nhân viên từng cơ sở.

### 11.4. Chạy web trên Vercel

1. vercel.com → **Add New → Project** → chọn repo `aura-rental` trên GitHub → **Import**.
2. Mục **Environment Variables**, thêm 5 dòng:

   | Tên | Lấy ở đâu |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → Data API** → Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → **Project Settings → API Keys** → Publishable key |
   | `SUPABASE_SECRET_KEY` | Supabase → **Project Settings → API Keys** → Secret key (**tuyệt đối không chia sẻ**) |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare, bước 11.5 |
   | `TURNSTILE_SECRET_KEY` | Cloudflare, bước 11.5 |

3. Bấm **Deploy**. Vài phút sau Vercel cho một địa chỉ dạng `aura-rental-xxx.vercel.app`.

Trên web thật mà **thiếu khoá Turnstile thì khách không đặt được** (cố ý để chống spam).

### 11.5. Captcha chống spam (Cloudflare Turnstile)

Cloudflare → **Turnstile** → **Add widget** → đặt tên, thêm tên miền của web (và tên miền `*.vercel.app` nếu đang dùng) → chế độ **Managed** → tạo. Copy **Site Key** và **Secret Key** vào Vercel (bước 11.4), rồi vào Vercel → **Deployments** → **Redeploy** để áp dụng.

### 11.6. Cập nhật web thật sau này

- **Code:** commit và đẩy lên GitHub nhánh `main` (phần 8) → Vercel tự build và cập nhật sau vài phút.
- **Database** (khi có migration mới): chạy `pnpm exec supabase db push` **trước** khi đẩy code dùng tới nó.
- Trước khi đẩy việc lớn: chạy `pnpm build` trên máy, không lỗi mới đẩy.

### 11.7. Tên miền riêng

Vercel → Project → **Settings → Domains** → thêm tên miền → làm theo hướng dẫn trỏ DNS ở nơi mua tên miền. Sau đó sửa **Site URL** trong Supabase (bước 11.2) và tên miền trong Turnstile (bước 11.5).

---

## 12. Lỗi hay gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `Cannot connect to the Docker daemon` hoặc `pnpm db:start` báo lỗi Docker | Mở Docker Desktop, chờ chạy xong rồi chạy lại lệnh. |
| `pnpm db:start` báo cổng (port) đang bị dùng | Chạy `pnpm exec supabase stop --all` rồi `pnpm db:start` lại. |
| `pnpm: command not found` | Làm lại bước cài pnpm ở phần 3, rồi đóng mở lại VS Code. |
| Trang báo lỗi thiếu Supabase URL / key | Kiểm tra `.env.local` (phần 4.4). Sửa xong phải dừng `pnpm dev` (Ctrl + C) rồi chạy lại. |
| Không đăng nhập được bằng `owner@aura.local` | Chưa có tài khoản: chạy `pnpm db:reset` (xoá dữ liệu trên máy). Mật khẩu là `aura123456`. |
| Sửa màu / giao diện mà trình duyệt vẫn như cũ | Dừng `pnpm dev` (Ctrl + C), chạy lại, rồi tải lại trang (Cmd/Ctrl + Shift + R). |
| Terminal ghi `Local: http://localhost:3001` | Cổng 3000 đang bị chiếm (thường do một `pnpm dev` khác còn chạy). Dùng địa chỉ 3001, hoặc tắt cửa sổ Terminal cũ. |
| `pnpm typecheck` báo lỗi sau khi đổi database | Chạy `pnpm db:types` rồi kiểm tra lại. |
| Đặt váy báo "đã kín lịch" dù trông còn trống | Ngày giặt, ngày ship, ngày chuyển giữa 2 cơ sở cũng được tính là bận. Xem **Lịch váy** (vùng gạch chéo) và **Cài đặt** → số ngày giặt / ship / chuyển. |
| Lỗi khó hiểu khác | Copy nguyên thông báo lỗi (và ảnh màn hình nếu có) gửi Claude Code: "chạy lệnh X thì bị lỗi này, sửa giúp". |

---

## 13. Việc còn dang dở

Tính đến lúc bàn giao (26/10/2026):

| Việc | Ghi chú |
|---|---|
| Danh sách váy thật + ảnh | Chưa có; thêm theo phần 10. |
| Số tài khoản nhận cọc | Điền ở Cài đặt → Vận hành; chưa có thì trang khách không hiện mã QR. |
| Đưa web lên mạng | Chưa làm; theo phần 11. |
| Form đặt lịch **thử đồ** cho khách trên web | Chưa làm. Database đã có sẵn (`create_fitting`, `get_fitting_slots`), nhân viên đã đặt được trong quản trị. |
| Ảnh xem trước khi gửi link váy lên Facebook / Zalo | Chưa làm. |
| Giờ mở cửa theo từng ngày | Hệ thống chỉ có một khung giờ chung; Hà Nội Chủ nhật đóng 17:00 chưa thể hiện được. |
| Hạn giữ chỗ chờ cọc có thể muộn hơn giờ nhận váy | Ví dụ đặt 20:00 để nhận 9:00 sáng mai, hạn cọc vẫn là 20:00 mai. Cần chủ shop quyết định quy tắc. |
| Báo đơn mới qua Telegram, tự xác nhận chuyển khoản (SePay) | Dự định ở giai đoạn sau, chưa làm. |

---

## 14. Bảng lệnh nhanh

| Lệnh | Làm gì |
|---|---|
| `pnpm install` | Cài / cập nhật thư viện |
| `pnpm db:start` | Bật database trên máy (cần Docker đang chạy) |
| `pnpm exec supabase stop` | Tắt database trên máy (giữ dữ liệu) |
| `pnpm dev` | Chạy web trên máy, http://localhost:3000 |
| `pnpm db:reset` | **Xoá sạch** database trên máy và tạo lại từ migration + seed |
| `pnpm exec supabase migration up` | Áp migration mới, **giữ** dữ liệu |
| `pnpm db:types` | Cập nhật kiểu dữ liệu cho code sau khi đổi database |
| `pnpm typecheck` | Kiểm tra lỗi code |
| `pnpm lint` | Kiểm tra quy tắc viết code |
| `pnpm db:test` | Chạy test quy tắc database |
| `pnpm build` | Build như trên web thật (chạy trước khi đẩy việc lớn) |
| `pnpm exec supabase db push` | Đẩy migration lên database thật (sau khi đã `link`) |
| `git pull` | Lấy code mới nhất từ GitHub |
