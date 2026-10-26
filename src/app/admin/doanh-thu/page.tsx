import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, ReceiptText, Scale, Wallet } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DonutChart, StackedBarChart } from "@/components/admin/charts";
import { DressThumb } from "@/components/admin/dress-thumb";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status";
import { getStaff } from "@/lib/auth";
import { getBranches, getViewBranchId } from "@/lib/branches";
import { addDays, diffDays, formatDate, todayVN, vnDateTimeToISO } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { bookingSourceLabel, paymentMethodLabel, type BookingSource, type PaymentMethod } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { PeriodToolbar } from "./period-toolbar";
import { PRESETS, type Preset } from "./presets";
import { ExportCsvButton, TransactionsTable, type TransactionRow } from "./transactions-table";

export const metadata: Metadata = { title: "Doanh thu" };

type Report = {
  collected: number;
  payments_count: number;
  refunds: number;
  bookings_count: number;
  bookings_total: number;
  outstanding: number;
  outstanding_count: number;
  security_held: number;
  by_period: { bucket: string; branch_id: string; amount: number }[];
  by_branch: { branch_id: string; collected: number; bookings: number; booked: number }[];
  by_method: { method: PaymentMethod; amount: number }[];
  by_source: { source: BookingSource; bookings: number; total: number }[];
  by_category: { category: string; rentals: number; revenue: number }[];
  top_products: { product_id: string; name: string; color: string | null; category: string | null; image: string | null; rentals: number; revenue: number }[];
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function resolvePeriod(sp: Record<string, string | string[] | undefined>, today: string) {
  const monthStart = `${today.slice(0, 8)}01`;
  if (typeof sp.from === "string" && typeof sp.to === "string" && ISO.test(sp.from) && ISO.test(sp.to) && sp.from <= sp.to) {
    return { preset: "custom" as const, from: sp.from, to: sp.to };
  }
  const preset: Preset = typeof sp.period === "string" && sp.period in PRESETS ? (sp.period as Preset) : "month";
  switch (preset) {
    case "last-month": {
      const to = addDays(monthStart, -1);
      return { preset, from: `${to.slice(0, 8)}01`, to };
    }
    case "30d":
      return { preset, from: addDays(today, -29), to: today };
    case "90d":
      return { preset, from: addDays(today, -89), to: today };
    case "year":
      return { preset, from: `${today.slice(0, 4)}-01-01`, to: today };
    default:
      return { preset, from: monthStart, to: today };
  }
}

function trendBadge(now: number, before: number) {
  if (!before) return null;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return <StatusBadge tone={pct >= 0 ? "emerald" : "red"}>{`${pct >= 0 ? "+" : ""}${pct}%`}</StatusBadge>;
}

function ShareRow({ label, value, total, detail }: { label: React.ReactNode; value: number; total: number; detail?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-medium tabular">{formatMoney(value)}</span>
      </div>
      <Progress value={pct} className="h-1.5" aria-label={`${pct}%`} />
      <p className="text-xs text-muted-foreground tabular">
        {pct}%{detail && `, ${detail}`}
      </p>
    </div>
  );
}

export default async function RevenuePage({ searchParams }: PageProps<"/admin/doanh-thu">) {
  const staff = await getStaff();
  const sp = await searchParams;
  const today = todayVN();
  const { preset, from, to } = resolvePeriod(sp, today);
  const days = diffDays(from, to) + 1;
  const bucket = days > 62 ? "month" : "day";
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));

  const [branches, branchId] = await Promise.all([getBranches(), getViewBranchId(staff)]);
  const supabase = await createClient();

  let txQuery = supabase
    .from("payments")
    .select("id, kind, method, amount, paid_at, note, bookings!inner(code, branch_id, customers(full_name)), profiles(full_name)")
    .gte("paid_at", vnDateTimeToISO(from, "00:00"))
    .lt("paid_at", vnDateTimeToISO(addDays(to, 1), "00:00"))
    .order("paid_at", { ascending: false })
    .limit(500);
  if (branchId) txQuery = txQuery.eq("bookings.branch_id", branchId);

  const [{ data: current }, { data: previous }, { data: tx }] = await Promise.all([
    supabase.rpc("revenue_report", { p_from: from, p_to: to, p_branch_id: branchId ?? undefined, p_bucket: bucket }),
    supabase.rpc("revenue_report", { p_from: prevFrom, p_to: prevTo, p_branch_id: branchId ?? undefined, p_bucket: bucket }),
    txQuery,
  ]);
  const r = current as unknown as Report;
  const p = previous as unknown as Report;

  const allBranches = await supabase.from("branches").select("id, code, name").order("code");
  const branchById = new Map((allBranches.data ?? branches).map((b) => [b.id, b]));
  const seriesBranches = (branchId ? branches.filter((b) => b.id === branchId) : branches).map((b) => ({
    key: b.code.toLowerCase(),
    label: b.name,
    id: b.id,
  }));

  // Trục thời gian đầy đủ (ngày hoặc tháng không có tiền vẫn hiện cột 0)
  const buckets: string[] = [];
  if (bucket === "day") for (let i = 0; i < days; i++) buckets.push(addDays(from, i));
  else
    for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
      buckets.push(m);
      const [y, mo] = m.split("-").map(Number);
      m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
    }
  const chartData = buckets.map((b) => {
    const row: { label: string } & Record<string, number | string> = {
      label: bucket === "day" ? `${b.slice(8)}/${b.slice(5, 7)}` : `T${Number(b.slice(5))}/${b.slice(2, 4)}`,
    };
    for (const s of seriesBranches) {
      row[s.key] = r.by_period.filter((x) => x.bucket === b && x.branch_id === s.id).reduce((sum, x) => sum + x.amount, 0);
    }
    return row;
  });

  const avgOrder = r.bookings_count ? Math.round(r.bookings_total / r.bookings_count) : 0;
  const prevAvg = p.bookings_count ? Math.round(p.bookings_total / p.bookings_count) : 0;
  const categoryTotal = r.by_category.reduce((s, c) => s + c.revenue, 0);
  const topTotal = r.top_products[0]?.revenue ?? 0;
  const scopeName = branchId ? branchById.get(branchId)?.name : "tất cả cơ sở";

  const rows: TransactionRow[] = (tx ?? []).map((t) => ({
    id: t.id,
    paidAt: t.paid_at,
    code: t.bookings.code,
    customer: t.bookings.customers?.full_name ?? "",
    branch: branchById.get(t.bookings.branch_id)?.code ?? "",
    kind: t.kind,
    method: t.method,
    recordedBy: t.profiles?.full_name ?? "",
    note: t.note ?? "",
    amount: t.amount,
  }));

  return (
    <PageBody>
      <PageHeader
        title="Doanh thu"
        description={`${scopeName}, từ ${formatDate(from)} đến ${formatDate(to)}. So sánh với ${days} ngày liền trước (${formatDate(prevFrom)} – ${formatDate(prevTo)}).`}
      />
      <PeriodToolbar preset={preset} from={from} to={to} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Đã thu"
          value={formatMoney(r.collected)}
          caption={`${r.payments_count} lần thu${r.refunds ? `, đã hoàn ${formatMoney(r.refunds)}` : ""}`}
          icon={Wallet}
          tone="brand"
          badge={trendBadge(r.collected, p.collected)}
        />
        <StatCard
          title="Doanh thu theo đơn"
          value={formatMoney(r.bookings_total)}
          caption={`${r.bookings_count} đơn nhận váy trong kỳ`}
          icon={ReceiptText}
          tone="violet"
          badge={trendBadge(r.bookings_total, p.bookings_total)}
        />
        <StatCard
          title="Giá trị trung bình"
          value={formatMoney(avgOrder)}
          caption="mỗi đơn"
          icon={Scale}
          tone="emerald"
          badge={trendBadge(avgOrder, prevAvg)}
        />
        <StatCard
          title="Còn phải thu"
          value={formatMoney(r.outstanding)}
          caption={`${r.outstanding_count} đơn đang xử lý; đang giữ ${formatMoney(r.security_held)} thế chấp`}
          icon={HandCoins}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <StackedBarChart
          className="xl:col-span-2"
          title={bucket === "day" ? "Tiền thu theo ngày" : "Tiền thu theo tháng"}
          description="Tiền khách trả trừ tiền hoàn, chưa tính thế chấp"
          data={chartData}
          series={seriesBranches.map(({ key, label }) => ({ key, label }))}
        />
        <Card>
          <CardHeader>
            <CardTitle>Theo cơ sở</CardTitle>
            <CardDescription>Tiền đã thu trong kỳ</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {r.by_branch
              .filter((b) => b.collected || b.bookings)
              .sort((a, b) => b.collected - a.collected)
              .map((b) => (
                <ShareRow
                  key={b.branch_id}
                  label={branchById.get(b.branch_id)?.name ?? b.branch_id}
                  value={b.collected}
                  total={r.collected}
                  detail={`${b.bookings} đơn, doanh thu đơn ${formatMoney(b.booked)}`}
                />
              ))}
            {!r.by_branch.some((b) => b.collected || b.bookings) && (
              <p className="text-sm text-muted-foreground">Chưa có tiền thu trong kỳ này.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <DonutChart
          title="Hình thức thanh toán"
          description="Tiền đã thu theo cách khách trả"
          money
          centerLabel="đã thu"
          data={r.by_method.filter((m) => m.amount > 0).map((m) => ({ key: m.method, label: paymentMethodLabel[m.method], value: m.amount }))}
        />
        <DonutChart
          title="Doanh thu theo nguồn khách"
          description="Tổng tiền đơn theo kênh khách đặt"
          money
          centerLabel="doanh thu đơn"
          data={r.by_source.map((s) => ({ key: s.source, label: bookingSourceLabel[s.source], value: s.total }))}
        />
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Theo danh mục</CardTitle>
            <CardDescription>Tiền thuê váy, chưa tính phí ship và phí phát sinh</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {r.by_category.length ? (
              r.by_category.map((c) => (
                <ShareRow key={c.category} label={c.category} value={c.revenue} total={categoryTotal} detail={`${c.rentals} lượt thuê`} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có đơn nào trong kỳ này.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Mẫu váy mang về nhiều nhất</CardTitle>
          <CardDescription>Tiền thuê của các đơn nhận váy trong kỳ</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {r.top_products.length ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-5 text-xs">#</TableHead>
                  <TableHead className="text-xs">Mẫu váy</TableHead>
                  <TableHead className="text-right text-xs">Lượt thuê</TableHead>
                  <TableHead className="text-right text-xs">Tiền thuê</TableHead>
                  <TableHead className="hidden w-48 pr-5 text-xs md:table-cell" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.top_products.map((x, i) => (
                  <TableRow key={x.product_id}>
                    <TableCell className="pl-5 text-muted-foreground tabular">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/admin/vay/${x.product_id}`} className="flex items-center gap-3">
                        <DressThumb name={x.name} color={x.color} category={x.category} image={x.image} className="w-8 rounded-md" />
                        <span>
                          <span className="block font-medium">{x.name}</span>
                          <span className="block text-xs text-muted-foreground">{x.category ?? "Chưa phân loại"}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular">{x.rentals}</TableCell>
                    <TableCell className="text-right font-medium tabular">{formatMoney(x.revenue)}</TableCell>
                    <TableCell className="hidden pr-5 md:table-cell">
                      <Progress value={topTotal ? (x.revenue / topTotal) * 100 : 0} className="h-1.5" aria-hidden />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-5 text-sm text-muted-foreground">Chưa có đơn nào trong kỳ này.</p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Các khoản thu, hoàn</CardTitle>
          <CardDescription>
            {rows.length === 500 ? "500 khoản gần nhất trong kỳ" : `${rows.length} khoản trong kỳ`}, gồm cả tiền thế chấp nhận và trả
          </CardDescription>
          <CardAction>
            <ExportCsvButton rows={rows} filename={`doanh-thu_${from}_${to}.csv`} />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <TransactionsTable rows={rows} />
        </CardContent>
      </Card>
    </PageBody>
  );
}
