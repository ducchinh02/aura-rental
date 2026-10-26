---
name: aura-ui
description: Giao diện của Aura Rental (trang quản trị và trang khách). Dùng khi tạo hoặc sửa bất kỳ màn hình, component, form, bảng, biểu đồ, lịch nào trong src/app hoặc src/components. Phong cách SaaS sáng kiểu louez.io, ưu tiên component shadcn/ui có sẵn thay vì tự dựng HTML.
---

# Aura UI

Phong cách tham chiếu: **louez.io** (phần mềm quản lý cho thuê). Sáng, sạch, nhiều khoảng trắng, một màu nhấn, thông tin xếp trong card viền mảnh. Thương hiệu thể hiện qua logo "AURA RENTAL" (chữ đen trên nền xanh phấn) và màu xanh `--primary` lấy từ logo, không phải qua trang trí.

## Nguyên tắc số 1: shadcn trước, HTML tự dựng sau cùng

Trước khi viết một khối giao diện, tìm component có sẵn trong `src/components/ui/`. Thiếu thì thêm bằng:

```bash
yes n | pnpm dlx shadcn@latest add <tên>   # "n" để không ghi đè button/input đã chỉnh
```

Chỉ tự dựng bằng `div` khi shadcn không có thứ tương đương (ví dụ lưới Gantt của Lịch váy), và khi đó vẫn ghép từ `Card`, `Badge`, `Tooltip`, `HoverCard`.

| Cần hiển thị | Dùng | Không dùng |
|---|---|---|
| Khung trang quản trị | `Sidebar` (variant `inset`, collapsible `icon`) + `SidebarInset` + header có `SidebarTrigger`, `Breadcrumb`, nút ⌘K (`CommandDialog`) | sidebar tự dựng, thanh tab đáy |
| Chọn cơ sở / tài khoản | `DropdownMenu` trong `SidebarMenuButton size="lg"` + `Avatar` | `Select` trần |
| Số liệu tổng quan | `StatCard` (`components/admin/stat-card.tsx`, dựng từ `Card`) | số to đứng một mình |
| Xu hướng, tỉ lệ | `ChartContainer` + recharts (`AreaChart`, `BarChart`, `PieChart`) trong `Card` | bảng số |
| Ngày, khoảng ngày | `Calendar` trong `Popover` (`DatePicker`, `DateRangePicker` ở `components/admin/date-picker.tsx`) | `<input type="date">` |
| Giờ | `TimeSelect` + `timeOptions()` (`components/admin/time-select.tsx`) | `<input type="time">` |
| Thời gian thuê của đơn | `formatPeriod(periodOf(row))` / `periodLength` trong `lib/dates.ts` (tự hiện giờ khi đơn thuê theo giờ) | `formatRange(pickup, return)` |
| Lịch theo tháng có sự kiện | `Calendar` với `modifiers` / `components.DayButton` tùy biến | lưới tháng tự dựng |
| Danh sách dữ liệu | `DataTable` (`components/admin/data-table.tsx`, tanstack) với cột định nghĩa trong file client | `<ul>` thủ công |
| Danh sách ngắn trong card | `Item` / dòng có `Avatar` + tên + `CodeBadge` + mũi tên | |
| Lọc theo trạng thái | `Tabs` có số đếm, hoặc `ToggleGroup` | nút tự tô màu |
| Trạng thái | `StatusBadge` / `Badge` nền nhạt chữ đậm cùng tông | chữ màu không nền |
| Trống dữ liệu | `Empty` | đoạn chữ xám |
| Form | `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription` + `Input`, `Select`, `InputGroup` | `Label` + `div` tự xếp |
| Hỏi lại trước khi làm | `AlertDialog`; sửa nhanh: `Dialog`; xem nhanh: `HoverCard`/`Tooltip` | `window.confirm` |
| Đang tải | `Skeleton` khớp bố cục thật, `Spinner` trong nút | |
| Tiến độ thanh toán | `Progress` | |

## Token

Định nghĩa trong `src/app/globals.css`, dùng qua class Tailwind (`bg-primary`, `text-muted-foreground`…). Không viết mã màu hex trong component; cần tông nhạt thì dùng thang Tailwind có sẵn (`bg-emerald-50 text-emerald-700`).

- Nền khung (sidebar, quanh vùng nội dung): `--sidebar` xám rất nhạt. Vùng nội dung `SidebarInset`: trắng, bo `xl`, đổ bóng rất nhẹ.
- Màu nhấn duy nhất: `--primary` #1D6FB8 (xanh đậm cùng tông logo, chữ trắng đạt 5.2:1). Dùng cho nút chính, mục đang chọn, đường biểu đồ chính. Không thêm màu nhấn thứ hai.
- `--brand-soft` #DFF1FF (nền logo, class `bg-brand-soft`): mảng thương hiệu như nền trang đăng nhập, cột hôm nay trên lịch, tone `brand` của badge.
- Màu trạng thái đơn (badge, thanh lịch): chờ cọc = amber, đã cọc = emerald, đang thuê = sky, đã trả váy = violet, hoàn tất = zinc, đã hủy = red nhạt. Bảng màu nằm ở `bookingStatusTone` trong `src/lib/labels.ts`, không khai báo lại ở nơi khác.
- Biểu đồ: `--chart-1` (xanh primary) cho Cơ sở 1, `--chart-2` (xanh nhạt) cho Cơ sở 2, `--chart-3..5` cho cơ sở / nhóm tiếp theo.
- Bo góc: card `rounded-xl`, nút/ô nhập `rounded-md`, badge `rounded-md`.

## Chữ

- Inter cho toàn bộ giao diện. Geist Mono cho mã (mã đơn, mã váy) qua `CodeBadge`.
- Tiêu đề trang `text-2xl font-semibold tracking-tight`, mô tả `text-sm text-muted-foreground` ngay dưới.
- Tiêu đề card `CardTitle` (`text-base font-semibold`), mô tả `CardDescription`.
- Số liệu lớn `text-3xl font-semibold tabular-nums`. Mọi cột tiền, ngày dùng `tabular`.
- Không chữ in hoa toàn bộ, không font serif. Logo là ảnh: `Wordmark` (chữ, `public/brand/aura-rental-logo.png`) và `BrandMark` (chữ A trên nền xanh, khi sidebar thu gọn); favicon ở `src/app/icon.png`.

## Bố cục trang

```
┌ Sidebar ┐┌ SidebarInset ─────────────────────────────────────────┐
│ Aura    ││ [≡] | Đơn thuê › AR-261026-02     [⌘K Tìm…] [+ Tạo đơn]│
│ Cơ sở ▾ │├───────────────────────────────────────────────────────┤
│ Hôm nay ││ Tiêu đề trang                         [hành động]     │
│ Đơn thuê││ Mô tả ngắn                                            │
│ …       ││ [StatCard][StatCard][StatCard][StatCard]              │
│ Quản lý ││ [Card biểu đồ 2/3        ][Card lịch 1/3]             │
│ …       ││ [Card danh sách][Card danh sách]                      │
│ Bạn ▾   │└───────────────────────────────────────────────────────┘
```

- Nội dung `p-4 md:p-6`, khối cách nhau `gap-4 md:gap-6`.
- Trang chi tiết: cột chính `lg:col-span-2` + cột phụ (khách, thời gian, ghi chú).
- Trang danh sách: `Tabs` trạng thái → ô tìm + bộ lọc + `ToggleGroup` kiểu xem → `DataTable` hoặc lịch.
- Điện thoại: sidebar tự thành `Sheet`; bảng cuộn ngang trong card; card xếp một cột.

## Hình váy

Váy là nội dung chính của shop, nên mọi nơi nhắc tới váy đều kèm `DressThumb` (ảnh bìa, chưa có ảnh thì vẽ phác theo màu vải). Kích thước: trong bảng `w-8`, trong dòng card `w-10`, lưới catalogue `w-full`.

## Viết chữ

- Tiếng Việt, câu ngắn, động từ rõ: "Tạo đơn", "Ghi nhận tiền", "Xác nhận đã cọc".
- Nút và thông báo dùng cùng một động từ ("Ghi nhận" → toast "Đã ghi nhận").
- Trạng thái trống chỉ ra việc cần làm tiếp, không xin lỗi.

## Bẫy đã gặp

- `CommandDialog` (bản radix-nova) không tự bọc `<Command>`: luôn đặt `<Command>` bên trong, thiếu là lỗi `reading 'subscribe'` khi mở.
- `Sidebar` trong `components/ui/sidebar.tsx` đã được sửa để luôn render cả bản desktop lẫn `Sheet` điện thoại; không thay lại bằng bản gốc shadcn (bản gốc gây lỗi hydration #418 trên điện thoại vì sidebar nằm trong `Suspense`).
- `SidebarMenuSkeleton` dùng `Math.random()` → không dùng, tự dựng skeleton độ rộng cố định.
- Thêm component bằng `yes n | pnpm dlx shadcn@latest add …` để không ghi đè `button`, `input`, `card`, `toggle` đã chỉnh.
- `@tanstack/react-table` giữ bản 8 (bản 9 đổi API). Cột định nghĩa trong file `"use client"`, server chỉ truyền dữ liệu thuần.
- `Calendar` là client component: truyền ngày dạng chuỗi ISO rồi đổi bằng `isoToDate`; luôn truyền `today={isoToDate(todayVN())}` và `locale={vi}` (từ `react-day-picker/locale`) để server và client khớp nhau.
- Không export hằng số (object, mảng) từ file `"use client"` để server component dùng: phía server chỉ nhận một tham chiếu client, giá trị thành `undefined`. Đặt hằng dùng chung trong file thường (ví dụ `lich/schedule-data.ts`, `doanh-thu/presets.ts`).
- Trigger chạy với quyền người dùng mà gọi hàm trong schema `private` thì phải `grant execute` hàm đó cho `authenticated` (bài học từ `normalize_phone`).
- `Calendar` mặc định ô 28px, quá nhỏ: luôn đặt `[--cell-size:--spacing(9)]` hoặc `(10)` (popover chọn ngày dùng 10). Với `locale={vi}` lịch tự hiện "Tháng 11/2026" và "T2…CN" (formatter trong `ui/calendar.tsx`); hiện 2 tháng thì `showOutsideDays={false}`.
- Đơn có thể thuê theo giờ: chỗ nào hiện ngày nhận/trả của đơn thì select thêm `rental_unit, pickup_at, return_at` và dùng `formatPeriod`. `Date.now()` trong component bị lint `react-hooks/purity` chặn, dùng helper trong `lib/dates.ts` (ví dụ `hoursLate`).
- Đổi `globals.css` mà dev server vẫn hiện màu cũ thì khởi động lại `pnpm dev` (Turbopack đôi khi giữ CSS cũ).

## Kiểm tra trước khi xong

1. `pnpm typecheck && pnpm lint`.
2. Chụp màn hình desktop 1440px và điện thoại 390px (Playwright), xem console không có lỗi hydration.
3. Không còn `<input type="date">`, `rounded-xl` lồng `rounded-xl`, hay màu hex trong component.
