import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { bookingSummarySelect, toDress } from "@/components/admin/booking-row";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { getStaff } from "@/lib/auth";
import { getBranches, getViewBranchId } from "@/lib/branches";
import { addDays, todayVN } from "@/lib/dates";
import { normalizePhone } from "@/lib/format";
import { bookingStatusLabel, type BookingStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { BookingsCalendar } from "./bookings-calendar";
import { BookingsTable } from "./bookings-table";
import { BookingsToolbar, type StatusTab } from "./filters";

export const metadata: Metadata = { title: "Đơn thuê" };

const OPEN_STATUSES: BookingStatus[] = ["pending", "confirmed", "picked_up", "returned"];
const STATUSES = Object.keys(bookingStatusLabel) as BookingStatus[];

export default async function BookingsPage({ searchParams }: PageProps<"/admin/don">) {
  const staff = await getStaff();
  const sp = await searchParams;
  const [branches, branchId] = await Promise.all([getBranches(), getViewBranchId(staff)]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "open";
  const view = sp.view === "calendar" ? "calendar" : "list";
  const today = todayVN();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);

  const supabase = await createClient();
  let query = supabase.from("bookings").select(bookingSummarySelect).limit(500);
  if (branchId) query = query.eq("branch_id", branchId);

  if (view === "calendar") {
    // Cả tuần đầu/cuối hiển thị ở mép tháng
    query = query
      .neq("status", "cancelled")
      .lte("pickup_date", addDays(`${month}-01`, 42))
      .gte("return_date", addDays(`${month}-01`, -7));
  } else if (status === "open") query = query.in("status", OPEN_STATUSES);
  else if (status !== "all") query = query.eq("status", status as BookingStatus);

  if (q) {
    const term = q.replace(/[%_]/g, "");
    if (/^ar[-\s]?\d/i.test(term)) query = query.ilike("code", `%${term}%`);
    else if (/^[\d\s+.]+$/.test(term)) query = query.ilike("customers.phone", `%${normalizePhone(term)}%`);
    else query = query.ilike("customers.full_name", `%${term}%`);
  }
  query = query.order("pickup_date", { ascending: status === "open" });

  // Số đếm cho từng tab trạng thái
  const countFor = (statuses: BookingStatus[] | null) => {
    let c = supabase.from("bookings").select("id", { count: "exact", head: true });
    if (branchId) c = c.eq("branch_id", branchId);
    return statuses ? c.in("status", statuses) : c;
  };
  const [{ data: rows }, ...counts] = await Promise.all([
    query,
    countFor(OPEN_STATUSES),
    ...STATUSES.map((s) => countFor([s])),
    countFor(null),
  ]);

  const tabs: StatusTab[] = [
    { value: "open", label: "Đang xử lý", count: counts[0].count ?? 0 },
    ...STATUSES.map((s, i) => ({ value: s, label: bookingStatusLabel[s], count: counts[i + 1].count ?? 0 })),
    { value: "all", label: "Tất cả", count: counts.at(-1)?.count ?? 0 },
  ];

  const ids = (rows ?? []).map((r) => r.id);
  const { data: totals } = ids.length
    ? await supabase.from("booking_payment_totals").select("booking_id, balance_due").in("booking_id", ids)
    : { data: [] };
  const balanceById = new Map((totals ?? []).map((t) => [t.booking_id, t.balance_due ?? 0]));
  const branchCode = new Map(branches.map((b) => [b.id, b.code]));

  return (
    <PageBody>
      <PageHeader title="Đơn thuê" description="Theo dõi từng đơn từ lúc giữ chỗ đến khi khách trả váy." />
      <Card className="gap-4">
        <CardHeader>
          <BookingsToolbar tabs={tabs} status={status} view={view} />
        </CardHeader>
        <CardContent className={view === "list" ? "px-0" : undefined}>
          {view === "list" ? (
            <BookingsTable
              showBranch={!branchId}
              empty={q ? `Không có đơn nào khớp "${q}".` : "Chưa có đơn nào ở trạng thái này."}
              rows={(rows ?? []).map((r) => ({
                code: r.code,
                status: r.status,
                noDeposit: r.deposit_required === 0,
                customerName: r.customers.full_name,
                phone: r.customers.phone,
                dresses: r.booking_items.map((bi) => toDress(bi.inventory_items)),
                pickupDate: r.pickup_date,
                returnDate: r.return_date,
                unit: r.rental_unit,
                pickupAt: r.pickup_at,
                returnAt: r.return_at,
                ship: r.delivery_method === "ship",
                branchCode: branchCode.get(r.branch_id) ?? "",
                total: r.total ?? 0,
                balance: balanceById.get(r.id) ?? 0,
              }))}
            />
          ) : (
            <BookingsCalendar
              month={month}
              today={today}
              bookings={(rows ?? []).map((r) => ({
                code: r.code,
                status: r.status,
                customerName: r.customers.full_name,
                pickupDate: r.pickup_date,
                returnDate: r.return_date,
                unit: r.rental_unit,
                pickupAt: r.pickup_at,
                returnAt: r.return_at,
                dresses: r.booking_items.map((bi) => `${bi.inventory_items.products.name} (${bi.inventory_items.size})`).join(", "),
              }))}
            />
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
