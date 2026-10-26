import type { Metadata } from "next";
import { Repeat, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { getStaff } from "@/lib/auth";
import { todayVN } from "@/lib/dates";
import { normalizePhone } from "@/lib/format";
import type { BookingSource } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { CustomerSearch } from "./customer-search";
import { CustomersTable, type CustomerRow } from "./customers-table";

export const metadata: Metadata = { title: "Khách hàng" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/khach">) {
  await getStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%_]/g, "") : "";

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, full_name, phone, is_blacklisted, created_at, bookings(pickup_date, status, source, created_at, payments(kind, amount))")
    .order("created_at", { ascending: false })
    .limit(300);
  if (q) {
    query = /^[\d\s+.]+$/.test(q) ? query.ilike("phone", `%${normalizePhone(q)}%`) : query.ilike("full_name", `%${q}%`);
  }
  const { data: customers } = await query;

  const rows: CustomerRow[] = (customers ?? []).map((c) => {
    const rentals = c.bookings.filter((b) => b.status !== "cancelled");
    const first = [...c.bookings].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    return {
      id: c.id,
      name: c.full_name,
      phone: c.phone,
      blacklisted: c.is_blacklisted,
      rentals: rentals.length,
      spent: c.bookings
        .flatMap((b) => b.payments)
        .reduce((s, p) => s + (p.kind === "payment" ? p.amount : p.kind === "refund" ? -p.amount : 0), 0),
      lastRental: rentals.map((b) => b.pickup_date).sort().at(-1) ?? null,
      source: (first?.source as BookingSource | undefined) ?? null,
    };
  });

  const month = todayVN().slice(0, 7);
  const newThisMonth = (customers ?? []).filter((c) => c.created_at.slice(0, 7) === month).length;
  const returning = rows.filter((r) => r.rentals >= 2).length;

  return (
    <PageBody>
      <PageHeader title="Khách hàng" description="Khách được tạo tự động khi đặt đơn hoặc đặt lịch thử." />
      {!q && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Tổng số khách" value={rows.length} caption="đã từng đặt đơn hoặc hẹn thử" icon={Users} tone="sky" />
          <StatCard title={`Khách mới tháng ${Number(month.slice(5))}`} value={newThisMonth} caption="lần đầu liên hệ shop" icon={UserPlus} tone="emerald" />
          <StatCard
            title="Khách thuê lại"
            value={returning}
            caption={rows.length ? `${Math.round((returning / rows.length) * 100)}% khách thuê từ 2 lần` : "chưa có khách"}
            icon={Repeat}
            tone="violet"
          />
        </div>
      )}
      <Card className="gap-4">
        <CardHeader>
          <CustomerSearch defaultValue={q} />
        </CardHeader>
        <CardContent className="px-0">
          <CustomersTable rows={rows} empty={q ? `Không có khách nào khớp "${q}".` : "Chưa có khách nào."} />
        </CardContent>
      </Card>
    </PageBody>
  );
}
