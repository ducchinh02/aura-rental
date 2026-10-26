import type { Metadata } from "next";
import { Shirt } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyBlock, PageBody, PageHeader } from "@/components/admin/page-header";
import { getStaff } from "@/lib/auth";
import { getBranches, getViewBranchId } from "@/lib/branches";
import { addDays, diffDays, formatDate, todayVN } from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import { bookingStatusLabel, bookingStatusTone, toneClass, type BookingStatus } from "@/lib/labels";
import { sortSizes } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DayBoard } from "./day-board";
import { VIEW_LABEL, type ScheduleBooking, type ScheduleProduct, type ScheduleView } from "./schedule-data";
import { ScheduleToolbar } from "./schedule-toolbar";
import { Timeline } from "./timeline";

export const metadata: Metadata = { title: "Lịch váy" };

/** blocked_period "[a,b)" → ngày đầu và ngày cuối (tính cả hai đầu) */
function parseRange(range: unknown) {
  const match = /^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)$/.exec(String(range));
  return match ? { from: match[1], to: addDays(match[2], -1) } : null;
}

/** Khoảng ngày hiển thị theo chế độ xem; tuần bắt đầu từ thứ Hai */
function windowFor(view: ScheduleView, date: string) {
  if (view === "day") return { from: date, days: 1 };
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const monday = addDays(date, -((dow + 6) % 7));
  if (view === "week") return { from: monday, days: 7 };
  if (view === "2weeks") return { from: monday, days: 14 };
  const first = `${date.slice(0, 8)}01`;
  const [y, m] = date.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { from: first, days: diffDays(first, nextMonth) };
}

const bookingSelect =
  "id, item_id, blocked_period, bookings!inner(code, status, rental_unit, pickup_date, return_date, pickup_at, return_at, branch_id, customers(full_name))" as const;

export default async function SchedulePage({ searchParams }: PageProps<"/admin/lich">) {
  const staff = await getStaff();
  const sp = await searchParams;
  const today = todayVN();
  const view: ScheduleView = sp.view === "week" || sp.view === "2weeks" || sp.view === "month" ? sp.view : "day";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const { from, days } = windowFor(view, date);
  const to = addDays(from, days - 1);

  const [branches, branchId] = await Promise.all([getBranches(), getViewBranchId(staff)]);
  const supabase = await createClient();
  const [{ data: itemRows }, { data: windowRows }, { data: overdueRows }, { data: locations }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id, code, size, home_branch_id, status, products!inner(id, name, status, color, categories(name), product_images(storage_path, is_cover))",
      )
      .neq("status", "retired")
      .neq("products.status", "archived"),
    supabase
      .from("booking_items")
      .select(bookingSelect)
      .eq("is_active", true)
      .overlaps("blocked_period", `[${from},${addDays(to, 1)})`),
    // Đơn đang thuê đã quá hạn trả vẫn chiếm váy dù hết khoảng giữ
    supabase.from("booking_items").select(bookingSelect).eq("is_active", true).eq("bookings.status", "picked_up").lt("bookings.return_date", today),
    supabase.from("item_locations").select("item_id, current_branch_id, in_transit, rented_booking_id"),
  ]);

  const branchCode = new Map(branches.map((b) => [b.id, b.code]));
  const seen = new Set<string>();
  const bookings: ScheduleBooking[] = [];
  for (const row of [...(windowRows ?? []), ...(overdueRows ?? [])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const range = parseRange(row.blocked_period);
    if (!range) continue;
    const b = row.bookings;
    bookings.push({
      id: row.id,
      itemId: row.item_id,
      code: b.code,
      status: b.status,
      customer: b.customers?.full_name ?? "",
      branch: branchCode.get(b.branch_id) ?? "",
      pickup: b.pickup_date,
      ret: b.return_date,
      unit: b.rental_unit,
      pickupAt: b.pickup_at,
      returnAt: b.return_at,
      blockFrom: range.from,
      blockTo: range.to,
    });
  }

  // Cơ sở đang xem: váy có kho gốc ở đó, cộng váy cơ sở khác đang cho đơn của cơ sở này mượn
  const borrowed = new Set(
    branchId
      ? [...(windowRows ?? []), ...(overdueRows ?? [])].filter((r) => r.bookings.branch_id === branchId).map((r) => r.item_id)
      : [],
  );
  const locationById = new Map((locations ?? []).map((l) => [l.item_id, l]));
  const showLocation = view === "day" && date === today;

  const byProduct = new Map<string, ScheduleProduct>();
  for (const i of itemRows ?? []) {
    if (branchId && i.home_branch_id !== branchId && !borrowed.has(i.id)) continue;
    if (q && !i.products.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) continue;
    const p =
      byProduct.get(i.products.id) ??
      ({
        id: i.products.id,
        name: i.products.name,
        color: i.products.color,
        category: i.products.categories?.name ?? null,
        image: coverPath(i.products.product_images),
        items: [],
      } satisfies ScheduleProduct);
    const loc = locationById.get(i.id);
    const homeCode = branchCode.get(i.home_branch_id) ?? "";
    const here = loc?.current_branch_id ? branchCode.get(loc.current_branch_id) : undefined;
    p.items.push({
      id: i.id,
      code: i.code,
      size: i.size,
      status: i.status,
      homeCode,
      location: showLocation
        ? loc?.in_transit
          ? "đang chuyển"
          : here && here !== homeCode
            ? `đang ở ${here}`
            : undefined
        : undefined,
    });
    byProduct.set(p.id, p);
  }
  const products = [...byProduct.values()]
    .map((p) => {
      const order = sortSizes([...new Set(p.items.map((i) => i.size))]);
      return { ...p, items: p.items.sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size) || a.code.localeCompare(b.code)) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const scope = branchId ? `Cơ sở ${branchCode.get(branchId)}` : "Tất cả cơ sở";
  const title =
    view === "day"
      ? `${date === today ? "Hôm nay, " : ""}${formatDate(date)}`
      : `${VIEW_LABEL[view]} ${formatDate(from).slice(0, 5)} – ${formatDate(to)}`;

  return (
    <PageBody>
      <PageHeader title="Lịch váy" description={`${scope}. ${title}.`} />
      <Card className="gap-4">
        <CardHeader className="gap-3">
          <ScheduleToolbar view={view} date={date} today={today} q={q} />
          {view !== "day" && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(["pending", "confirmed", "picked_up", "returned", "completed"] as BookingStatus[]).map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-4 rounded-sm", toneClass[bookingStatusTone[s]].bar)} />
                  {bookingStatusLabel[s]}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-red-500" />
                Quá hạn trả
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm border border-dashed border-zinc-300 bg-[repeating-linear-gradient(135deg,var(--color-zinc-200)_0_1px,transparent_1px_4px)]" />
                Giặt, ship, chuyển cơ sở
              </li>
              <li className="flex items-center gap-1.5">
                <span className="rounded bg-emerald-50 px-1 font-semibold text-emerald-700">3</span>
                số chiếc còn trống
              </li>
            </ul>
          )}
        </CardHeader>
        <CardContent className={view === "day" ? undefined : "px-0"}>
          {products.length === 0 ? (
            <EmptyBlock
              className={view === "day" ? undefined : "mx-5"}
              icon={Shirt}
              title={q ? `Không có váy nào khớp "${q}"` : `${scope} chưa có váy nào`}
              description="Thêm váy trong mục Kho váy, chọn kho gốc là cơ sở này."
            />
          ) : view === "day" ? (
            <DayBoard products={products} bookings={bookings} day={date} today={today} now={new Date().toISOString()} />
          ) : (
            <Timeline products={products} bookings={bookings} from={from} days={days} today={today} />
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
