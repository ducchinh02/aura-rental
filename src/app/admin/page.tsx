import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Clock, Shirt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AgendaCalendar, type AgendaEvent } from "@/components/admin/agenda-calendar";
import {
  BookingListItem,
  bookingSummarySelect,
  productThumbSelect,
  toSummary,
  type BookingSummary,
} from "@/components/admin/booking-row";
import { RevenueChart, SourceChart, type RevenuePoint } from "@/components/admin/charts";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DressThumb } from "@/components/admin/dress-thumb";
import { EmptyBlock, PageBody, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status";
import { getStaff } from "@/lib/auth";
import { getBranches, getViewBranchId } from "@/lib/branches";
import { addDays, dateOfTimestamp, diffDays, formatDate, formatTime, hoursLate, todayVN, vnDateTimeToISO } from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import { formatMoney } from "@/lib/format";
import { bookingSourceLabel, shipZoneLabel, transferStatusLabel, transferStatusTone, type BookingSource } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hôm nay" };

const WEEKDAY_NAMES = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function ListCard({
  title,
  description,
  icon: Icon,
  tone,
  href,
  children,
}: {
  title: string;
  description: string;
  icon: typeof ArrowUpRight;
  tone: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-x-3">
        <span className={cn("row-span-2 flex size-9 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-4" />
        </span>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="col-start-2">{description}</CardDescription>
        {href && (
          <CardAction className="col-start-3 row-span-2 self-center">
            <Button asChild variant="ghost" size="sm">
              <Link href={href}>
                Xem tất cả
                <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-2">{children}</CardContent>
    </Card>
  );
}

export default async function TodayPage() {
  const staff = await getStaff();
  const [branches, branchId] = await Promise.all([getBranches(), getViewBranchId(staff)]);
  const supabase = await createClient();

  const today = todayVN();
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthStart = `${addDays(monthStart, -1).slice(0, 8)}01`;
  const sameDayLastMonth = addDays(lastMonthStart, diffDays(monthStart, today));
  const since90 = addDays(today, -89);

  const { data: settings } = await supabase.from("settings").select("ship_days_local, ship_days_province").single();
  const shipDays = { local: settings?.ship_days_local ?? 1, province: settings?.ship_days_province ?? 3 };
  const scoped = <T extends { eq: (col: "branch_id", v: string) => T }>(q: T) => (branchId ? q.eq("branch_id", branchId) : q);

  const [confirmedRes, rentedRes, pendingRes, agendaRes, fittingsRes, transfersRes, paymentsRes, sourcesRes] =
    await Promise.all([
      scoped(
        supabase
          .from("bookings")
          .select(`${bookingSummarySelect}, ship_zone`)
          .eq("status", "confirmed")
          .lte("pickup_date", addDays(today, shipDays.province)),
      ).order("pickup_date"),
      scoped(supabase.from("bookings").select(bookingSummarySelect).eq("status", "picked_up").lte("return_date", today)).order(
        "return_date",
      ),
      scoped(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending")),
      // Lịch giao nhận: đơn còn hiệu lực có ngày nhận hoặc trả trong khoảng 1 tháng trước đến 2 tháng sau
      scoped(
        supabase
          .from("bookings")
          .select(
            "code, status, rental_unit, pickup_date, return_date, pickup_at, return_at, customers!inner(full_name), booking_items(inventory_items(size, products(name)))",
          )
          .neq("status", "cancelled")
          .gte("return_date", addDays(monthStart, -31))
          .lte("pickup_date", addDays(monthStart, 92)),
      ),
      scoped(
        supabase
          .from("fitting_appointments")
          .select(`id, starts_at, branch_id, status, customers(full_name), fitting_items(size, ${productThumbSelect})`)
          .neq("status", "cancelled")
          .gte("starts_at", vnDateTimeToISO(addDays(monthStart, -31), "00:00"))
          .lt("starts_at", vnDateTimeToISO(addDays(monthStart, 92), "00:00")),
      ).order("starts_at"),
      supabase
        .from("transfers")
        .select(`id, status, due_date, from_branch_id, to_branch_id, inventory_items(code, size, ${productThumbSelect})`)
        .in("status", ["pending", "in_transit"])
        .lte("due_date", addDays(today, 2))
        .order("due_date"),
      supabase
        .from("payments")
        .select("kind, amount, paid_at, bookings!inner(branch_id)")
        .in("kind", ["payment", "refund"])
        .gte("paid_at", vnDateTimeToISO(lastMonthStart < since90 ? lastMonthStart : since90, "00:00")),
      scoped(supabase.from("bookings").select("source").neq("status", "cancelled").gte("created_at", vnDateTimeToISO(since90, "00:00"))),
    ]);

  // Giao váy: khách nhận tại shop hôm nay (hoặc hẹn trước mà chưa đến), đơn ship phải gửi hôm nay
  const handovers: BookingSummary[] = [];
  for (const b of confirmedRes.data ?? []) {
    const ship = b.delivery_method === "ship";
    const due = ship ? addDays(b.pickup_date, -shipDays[b.ship_zone ?? "local"]) <= today : b.pickup_date <= today;
    if (!due) continue;
    handovers.push(
      toSummary(b, {
        note: ship
          ? `Gửi ship ${shipZoneLabel[b.ship_zone ?? "local"].toLowerCase()}, khách cần nhận ${formatDate(b.pickup_date).slice(0, 5)}`
          : b.pickup_date < today
            ? `Hẹn nhận ${formatDate(b.pickup_date).slice(0, 5)}, khách chưa đến`
            : undefined,
      }),
    );
  }
  // Quá hạn: thuê ngày khi đã qua ngày trả; thuê giờ khi đã qua giờ trả (tính ngay trong ngày)
  const lateNote = (b: { rental_unit: "day" | "hour"; return_date: string; return_at: string | null }) => {
    if (b.rental_unit === "hour" && b.return_at) {
      const hours = hoursLate(b.return_at);
      return hours > 0 ? `Quá giờ trả ${hours} giờ (hẹn ${formatTime(b.return_at)})` : undefined;
    }
    return b.return_date < today ? `Quá hạn ${diffDays(b.return_date, today)} ngày` : undefined;
  };
  const rented = rentedRes.data ?? [];
  const returns = rented.map((b) => toSummary(b, { note: lateNote(b) }));
  const overdue = rented.filter((b) => lateNote(b)).length;

  // Doanh thu
  const inScope = (id: string) => !branchId || id === branchId;
  const signed = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);
  const payments = (paymentsRes.data ?? []).filter((p) => inScope(p.bookings.branch_id));
  const sumBetween = (from: string, to: string) =>
    payments
      .filter((p) => {
        const d = dateOfTimestamp(p.paid_at);
        return d >= from && d <= to;
      })
      .reduce((s, p) => s + signed(p), 0);
  const monthRevenue = sumBetween(monthStart, today);
  const lastMonthRevenue = sumBetween(lastMonthStart, sameDayLastMonth);
  const trend = lastMonthRevenue ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null;

  const visibleBranches = branches.filter((b) => inScope(b.id));
  const seriesKey = (id: string) => branches.find((b) => b.id === id)!.code.toLowerCase();
  const revenueByDay = new Map<string, RevenuePoint>();
  for (let i = 0; i < 90; i++) {
    const date = addDays(since90, i);
    revenueByDay.set(date, { date, ...Object.fromEntries(visibleBranches.map((b) => [seriesKey(b.id), 0])) });
  }
  for (const p of payments) {
    const point = revenueByDay.get(dateOfTimestamp(p.paid_at));
    if (point) point[seriesKey(p.bookings.branch_id)] = Number(point[seriesKey(p.bookings.branch_id)]) + signed(p);
  }

  const sourceCounts = new Map<BookingSource, number>();
  for (const b of sourcesRes.data ?? []) sourceCounts.set(b.source, (sourceCounts.get(b.source) ?? 0) + 1);
  const sources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: bookingSourceLabel[key], count }));

  // Sự kiện cho lịch
  const dressLine = (items: { inventory_items: { size: string; products: { name: string } } }[]) =>
    items.map((i) => `${i.inventory_items.products.name} (${i.inventory_items.size})`).join(", ");
  const events: AgendaEvent[] = [];
  for (const b of agendaRes.data ?? []) {
    const base = { title: b.customers.full_name, code: b.code, href: `/admin/don/${b.code}` };
    const at = (ts: string | null) => (b.rental_unit === "hour" && ts ? `${formatTime(ts)}, ` : "");
    if (b.status === "pending" || b.status === "confirmed")
      events.push({ ...base, date: b.pickup_date, kind: "pickup", detail: at(b.pickup_at) + dressLine(b.booking_items) });
    if (b.status !== "returned" && b.status !== "completed")
      events.push({ ...base, date: b.return_date, kind: "return", detail: at(b.return_at) + dressLine(b.booking_items) });
  }
  const fittings = fittingsRes.data ?? [];
  for (const f of fittings) {
    events.push({
      date: dateOfTimestamp(f.starts_at),
      kind: "fitting",
      title: f.customers?.full_name ?? "Khách",
      detail: `${formatTime(f.starts_at)}, ${f.fitting_items.map((i) => i.products.name).join(", ") || "chưa chọn mẫu"}`,
      href: "/admin/thu-do",
    });
  }
  const fittingsToday = fittings.filter((f) => f.status === "booked" && dateOfTimestamp(f.starts_at) === today);

  const branchCode = new Map(branches.map((b) => [b.id, b.code]));
  const transfers = (transfersRes.data ?? []).filter((t) => !branchId || t.from_branch_id === branchId || t.to_branch_id === branchId);
  const weekday = WEEKDAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()];

  return (
    <PageBody>
      <PageHeader
        title={`Chào ${staff.fullName.split(" ").at(-1) || "bạn"}`}
        description={`${weekday}, ${formatDate(today)}. Đây là việc của ${branchId ? branchCode.get(branchId) : "tất cả cơ sở"} hôm nay.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Giao váy hôm nay" value={handovers.length} caption="đơn cần đưa váy cho khách" icon={ArrowUpRight} tone="emerald" />
        <StatCard
          title="Nhận lại hôm nay"
          value={returns.length - overdue}
          caption="đơn khách hẹn trả"
          icon={ArrowDownLeft}
          tone="sky"
          badge={overdue > 0 && <StatusBadge tone="red">{overdue} quá hạn</StatusBadge>}
        />
        <StatCard
          title="Chờ cọc, xác nhận"
          value={pendingRes.count ?? 0}
          caption="đơn đang giữ váy chờ xử lý"
          icon={Clock}
          tone="amber"
          badge={!!pendingRes.count && <StatusBadge tone="amber">Cần xử lý</StatusBadge>}
        />
        <StatCard
          title={`Đã thu tháng ${Number(today.slice(5, 7))}`}
          value={formatMoney(monthRevenue)}
          caption={`so với cùng kỳ tháng trước (${formatMoney(lastMonthRevenue)})`}
          icon={Wallet}
          tone="violet"
          badge={
            trend !== null && <StatusBadge tone={trend >= 0 ? "emerald" : "red"}>{`${trend >= 0 ? "+" : ""}${trend}%`}</StatusBadge>
          }
        />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <RevenueChart
          className="xl:col-span-2"
          data={[...revenueByDay.values()]}
          series={visibleBranches.map((b) => ({ key: seriesKey(b.id), label: b.name }))}
        />
        <AgendaCalendar events={events} today={today} className="xl:row-span-2" />
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:col-span-2">
          <ListCard
            title="Giao váy hôm nay"
            description="Đơn cần đưa váy cho khách"
            icon={ArrowUpRight}
            tone="bg-emerald-50 text-emerald-600"
            href="/admin/don?status=confirmed"
          >
            {handovers.length ? (
              handovers.map((b) => <BookingListItem key={b.code} booking={b} />)
            ) : (
              <EmptyBlock className="mx-2 border-0 py-6" title="Không có váy cần giao" description="Đơn đã cọc sẽ hiện ở đây vào ngày nhận." />
            )}
          </ListCard>
          <ListCard
            title="Nhận lại hôm nay"
            description="Đơn khách hẹn trả váy"
            icon={ArrowDownLeft}
            tone="bg-sky-50 text-sky-600"
            href="/admin/don?status=picked_up"
          >
            {returns.length ? (
              returns.map((b) => <BookingListItem key={b.code} booking={b} />)
            ) : (
              <EmptyBlock className="mx-2 border-0 py-6" title="Không có váy cần nhận lại" description="Đơn đang thuê đến hạn trả sẽ hiện ở đây." />
            )}
          </ListCard>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <ListCard title="Thử đồ hôm nay" description="Khách hẹn đến thử váy" icon={Shirt} tone="bg-violet-50 text-violet-600" href="/admin/thu-do">
          {fittingsToday.length ? (
            fittingsToday.map((f) => (
              <Link key={f.id} href="/admin/thu-do" className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60">
                <CustomerAvatar name={f.customers?.full_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.customers?.full_name}</p>
                  <p className="text-sm text-muted-foreground tabular">
                    {formatTime(f.starts_at)}
                    {!branchId && `, ${branchCode.get(f.branch_id)}`}
                  </p>
                </div>
                <div className="flex -space-x-2">
                  {f.fitting_items.map((i, index) => (
                    <DressThumb
                      key={index}
                      name={i.products.name}
                      color={i.products.color}
                      category={i.products.categories?.name}
                      image={coverPath(i.products.product_images)}
                      className="w-7 rounded-md ring-2 ring-card"
                    />
                  ))}
                </div>
              </Link>
            ))
          ) : (
            <EmptyBlock className="mx-2 border-0 py-6" title="Không có lịch thử hôm nay" />
          )}
        </ListCard>

        <ListCard
          title="Chuyển váy"
          description="Cần gửi hoặc sắp tới trong 2 ngày"
          icon={ArrowLeftRight}
          tone="bg-amber-50 text-amber-600"
          href="/admin/chuyen-vay"
        >
          {transfers.length ? (
            transfers.map((t) => (
              <Link key={t.id} href="/admin/chuyen-vay" className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60">
                <DressThumb
                  name={t.inventory_items.products.name}
                  color={t.inventory_items.products.color}
                  category={t.inventory_items.products.categories?.name}
                  image={coverPath(t.inventory_items.products.product_images)}
                  className="w-8 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.inventory_items.products.name}</p>
                  <p className="text-sm text-muted-foreground tabular">
                    {branchCode.get(t.from_branch_id)} → {branchCode.get(t.to_branch_id)}, hạn {formatDate(t.due_date).slice(0, 5)}
                  </p>
                </div>
                <StatusBadge tone={transferStatusTone[t.status]}>{transferStatusLabel[t.status]}</StatusBadge>
              </Link>
            ))
          ) : (
            <EmptyBlock className="mx-2 border-0 py-6" title="Không có váy cần chuyển" />
          )}
        </ListCard>

        <SourceChart className="lg:col-span-2 xl:col-span-1" data={sources} description="Đơn tạo trong 90 ngày qua, không tính đơn hủy" />
      </div>
    </PageBody>
  );
}
