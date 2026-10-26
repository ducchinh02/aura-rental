import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Phone, Plus, ReceiptText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookingSummarySelect, DressStack, toDress } from "@/components/admin/booking-row";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { EmptyBlock, PageBody, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { BookingStatusBadge, StatusBadge } from "@/components/admin/status";
import { getStaff } from "@/lib/auth";
import { getBranches } from "@/lib/branches";
import { formatDate, formatPeriod, periodOf } from "@/lib/dates";
import { formatMoney, formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "./customer-form";

export const metadata: Metadata = { title: "Khách hàng" };

export default async function CustomerPage({ params }: PageProps<"/admin/khach/[id]">) {
  await getStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [{ data: customer }, { data: bookings }, branches] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bookings")
      .select(`${bookingSummarySelect}, payments(kind, amount)`)
      .eq("customer_id", id)
      .order("pickup_date", { ascending: false }),
    getBranches(),
  ]);
  if (!customer) notFound();

  const list = bookings ?? [];
  const rentals = list.filter((b) => b.status !== "cancelled");
  const spent = list
    .flatMap((b) => b.payments)
    .reduce((sum, p) => sum + (p.kind === "payment" ? p.amount : p.kind === "refund" ? -p.amount : 0), 0);
  const last = rentals[0];
  const branchCode = new Map(branches.map((b) => [b.id, b.code]));

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-4">
        <CustomerAvatar name={customer.full_name} size="lg" className="size-14 text-base" />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-3">
                {customer.full_name}
                {customer.is_blacklisted && <StatusBadge tone="red">Danh sách đen</StatusBadge>}
                {rentals.length >= 3 && !customer.is_blacklisted && <StatusBadge tone="violet">Khách quen</StatusBadge>}
              </span>
            }
            description={`${formatPhone(customer.phone)}. Khách từ ${formatDate(customer.created_at.slice(0, 10))}.`}
            actions={
              <>
                <Button asChild variant="outline">
                  <a href={`tel:${customer.phone}`}>
                    <Phone />
                    Gọi
                  </a>
                </Button>
                <Button asChild>
                  <Link href={`/admin/don/moi?phone=${customer.phone}`}>
                    <Plus />
                    Tạo đơn
                  </Link>
                </Button>
              </>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Số đơn" value={rentals.length} caption={`${list.length - rentals.length} đơn đã hủy`} icon={ReceiptText} tone="sky" />
        <StatCard title="Tổng chi" value={formatMoney(spent)} caption="tiền đã thu trừ tiền hoàn" icon={Wallet} tone="violet" />
        <StatCard
          title="Lần thuê gần nhất"
          value={last ? formatDate(last.pickup_date).slice(0, 5) : "—"}
          caption={last ? last.booking_items.map((bi) => bi.inventory_items.products.name).join(", ") : "chưa thuê lần nào"}
          icon={CalendarClock}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3 lg:items-start">
        <Card className="gap-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Lịch sử thuê</CardTitle>
            <CardDescription>{list.length} đơn, mới nhất trước</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {list.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-xs">Đơn</TableHead>
                    <TableHead className="text-xs">Thời gian</TableHead>
                    <TableHead className="text-xs">Váy</TableHead>
                    <TableHead className="text-xs">Cơ sở</TableHead>
                    <TableHead className="text-right text-xs">Tổng</TableHead>
                    <TableHead className="pr-5 text-xs">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((b) => {
                    const dresses = b.booking_items.map((bi) => toDress(bi.inventory_items));
                    return (
                      <TableRow key={b.code}>
                        <TableCell className="pl-5">
                          <Link href={`/admin/don/${b.code}`}>
                            <CodeBadge className="hover:bg-muted-foreground/15">{b.code}</CodeBadge>
                          </Link>
                        </TableCell>
                        <TableCell className="tabular">{formatPeriod(periodOf(b))}</TableCell>
                        <TableCell>
                          <span className="flex max-w-56 items-center gap-2">
                            <DressStack dresses={dresses} />
                            <span className="truncate text-muted-foreground">{dresses.map((d) => d.name).join(", ")}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{branchCode.get(b.branch_id)}</TableCell>
                        <TableCell className="text-right font-medium tabular">{formatMoney(b.total)}</TableCell>
                        <TableCell className="pr-5">
                          <BookingStatusBadge status={b.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyBlock className="mx-5" icon={ReceiptText} title="Khách chưa có đơn nào" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin liên hệ</CardTitle>
            <CardDescription>Ghi chú chỉ nhân viên thấy</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm
              customerId={customer.id}
              initial={{
                full_name: customer.full_name,
                phone: customer.phone,
                email: customer.email ?? "",
                facebook_url: customer.facebook_url ?? "",
                zalo: customer.zalo ?? "",
                address: customer.address ?? "",
                note: customer.note ?? "",
                is_blacklisted: customer.is_blacklisted,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
