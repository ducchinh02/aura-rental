import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarX2, Shirt, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DressThumb } from "@/components/admin/dress-thumb";
import { EmptyBlock, PageBody, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status";
import { canManageBranch, getStaff } from "@/lib/auth";
import { getBranches, getDefaultBranchId, getViewBranchId } from "@/lib/branches";
import { addDays, dateOfTimestamp, formatTime, todayVN, vnDateTimeToISO } from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import { formatPhone } from "@/lib/format";
import { bookingSourceLabel, fittingStatusLabel, fittingStatusTone } from "@/lib/labels";
import { getProductOptions } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { FittingCalendar } from "./fitting-calendar";
import { FittingStatusMenu, NewFittingDialog } from "./fitting-controls";

export const metadata: Metadata = { title: "Thử đồ" };

const WEEKDAY_NAMES = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export default async function FittingsPage({ searchParams }: PageProps<"/admin/thu-do">) {
  const staff = await getStaff();
  const sp = await searchParams;
  const today = todayVN();
  const selected = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : selected.slice(0, 7);

  const [allBranches, branchId, defaultBranchId, products] = await Promise.all([
    getBranches(),
    getViewBranchId(staff),
    getDefaultBranchId(staff),
    getProductOptions(),
  ]);
  const supabase = await createClient();

  // Cả tháng đang xem (để chấm lịch) + tháng này và 7 ngày tới (thẻ số liệu)
  const windowFrom = [`${month}-01`, `${today.slice(0, 7)}-01`].sort()[0];
  const windowTo = [addDays(`${month}-01`, 42), addDays(today, 32)].sort().at(-1)!;
  let query = supabase
    .from("fitting_appointments")
    .select(
      "id, starts_at, status, branch_id, source, customer_note, booking_id, customers(full_name, phone), fitting_items(product_id, size, products(name, color, categories(name), product_images(storage_path, is_cover))), bookings(code)",
    )
    .gte("starts_at", vnDateTimeToISO(addDays(windowFrom, -7), "00:00"))
    .lt("starts_at", vnDateTimeToISO(windowTo, "00:00"))
    .order("starts_at");
  if (branchId) query = query.eq("branch_id", branchId);

  const [{ data: fittings }, { data: items }, { data: locations }] = await Promise.all([
    query,
    supabase.from("inventory_items").select("id, product_id, size").eq("status", "active"),
    supabase.from("item_locations").select("item_id, current_branch_id, rented_booking_id"),
  ]);

  // Mẫu + size đó có chiếc nào đang nằm ở cơ sở hẹn thử không
  const locationById = new Map((locations ?? []).map((l) => [l.item_id, l]));
  const availableAt = (productId: string, size: string | null, atBranch: string) =>
    (items ?? []).some((i) => {
      const loc = locationById.get(i.id);
      return i.product_id === productId && (!size || i.size === size) && !loc?.rented_booking_id && loc?.current_branch_id === atBranch;
    });

  const all = fittings ?? [];
  const counts: Record<string, number> = {};
  for (const f of all) {
    if (f.status === "cancelled") continue;
    const d = dateOfTimestamp(f.starts_at);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  const dayList = all.filter((f) => dateOfTimestamp(f.starts_at) === selected);
  const next7 = all.filter((f) => {
    const d = dateOfTimestamp(f.starts_at);
    return f.status === "booked" && d >= today && d < addDays(today, 7);
  });
  const thisMonth = all.filter((f) => f.status !== "cancelled" && dateOfTimestamp(f.starts_at).startsWith(today.slice(0, 7)));
  const converted = thisMonth.filter((f) => f.booking_id).length;
  const noShow = thisMonth.filter((f) => f.status === "no_show").length;

  const branchCode = new Map(allBranches.map((b) => [b.id, b.code]));
  const branches = staff.role === "owner" ? allBranches : allBranches.filter((b) => b.id === staff.branchId);
  const weekdayName = WEEKDAY_NAMES[new Date(`${selected}T00:00:00Z`).getUTCDay()];

  return (
    <PageBody>
      <PageHeader
        title="Thử đồ"
        description="Khách hẹn đến shop thử váy. Váy chưa có ở cơ sở hẹn sẽ được nhắc để chuyển trước."
        actions={
          <NewFittingDialog
            branches={branches}
            products={products}
            defaultBranchId={defaultBranchId ?? branches[0]?.id ?? ""}
            defaultDate={selected < today ? today : selected}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="7 ngày tới" value={next7.length} caption="lịch thử đã hẹn" icon={Users} tone="violet" />
        <StatCard
          title={`Chốt đơn tháng ${Number(today.slice(5, 7))}`}
          value={converted}
          caption={thisMonth.length ? `${Math.round((converted / thisMonth.length) * 100)}% buổi thử thành đơn` : "chưa có buổi thử"}
          icon={CalendarCheck}
          tone="emerald"
        />
        <StatCard title="Khách không đến" value={noShow} caption="trong tháng này" icon={CalendarX2} tone="amber" />
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Chọn ngày</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-violet-500" />
              Ngày có khách hẹn thử
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FittingCalendar selected={selected} today={today} counts={counts} month={month} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selected === today ? "Hôm nay, " : ""}
              {weekdayName} {selected.slice(8)}/{selected.slice(5, 7)}
            </CardTitle>
            <CardDescription>{dayList.length ? `${dayList.length} lịch hẹn` : "Chưa có lịch hẹn"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dayList.length === 0 && (
              <EmptyBlock
                icon={Shirt}
                title="Ngày này chưa có ai hẹn thử"
                description="Bấm Đặt lịch thử khi khách nhắn hẹn qua Facebook hoặc Zalo."
              />
            )}
            {dayList.map((f) => {
              const missing = f.fitting_items.filter((i) => !availableAt(i.product_id, i.size, f.branch_id));
              const editable = canManageBranch(staff, f.branch_id);
              return (
                <div key={f.id} className="flex gap-4 rounded-lg border p-4">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-lg leading-none font-semibold tabular">{formatTime(f.starts_at)}</p>
                    {!branchId && <p className="mt-1 text-xs text-muted-foreground">{branchCode.get(f.branch_id)}</p>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <CustomerAvatar name={f.customers?.full_name ?? "?"} size="sm" />
                      <span className="font-medium">{f.customers?.full_name}</span>
                      <span className="text-sm text-muted-foreground tabular">{f.customers && formatPhone(f.customers.phone)}</span>
                      <StatusBadge tone={fittingStatusTone[f.status]}>{fittingStatusLabel[f.status]}</StatusBadge>
                      <span className="text-xs text-muted-foreground">qua {bookingSourceLabel[f.source]}</span>
                    </div>
                    {f.fitting_items.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {f.fitting_items.map((i, index) => (
                          <li key={index} className="flex items-center gap-2 rounded-lg bg-muted/50 py-1.5 pr-3 pl-1.5">
                            <DressThumb
                              name={i.products.name}
                              color={i.products.color}
                              category={i.products.categories?.name}
                              image={coverPath(i.products.product_images)}
                              className="w-8 rounded-md"
                            />
                            <span className="text-sm">
                              {i.products.name}
                              {i.size && <span className="text-muted-foreground"> size {i.size}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Chưa chọn mẫu</p>
                    )}
                    {f.status === "booked" && missing.length > 0 && (
                      <p className="mt-3 flex items-start gap-1.5 text-sm text-amber-700">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Chưa có sẵn tại {branchCode.get(f.branch_id)}:{" "}
                          {missing.map((i) => `${i.products.name}${i.size ? ` (${i.size})` : ""}`).join(", ")}.{" "}
                          <Link href="/admin/chuyen-vay" className="font-medium underline underline-offset-4">
                            Tạo phiếu chuyển
                          </Link>
                        </span>
                      </p>
                    )}
                    {f.customer_note && <p className="mt-2 text-sm text-muted-foreground">“{f.customer_note}”</p>}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {f.bookings ? (
                      <Link href={`/admin/don/${f.bookings.code}`}>
                        <CodeBadge className="h-7 px-2 hover:bg-muted-foreground/15">{f.bookings.code}</CodeBadge>
                      </Link>
                    ) : (
                      editable &&
                      f.status !== "cancelled" && (
                        <Button asChild size="sm" variant={f.status === "done" ? "default" : "outline"}>
                          <Link href={`/admin/don/moi?fitting=${f.id}`}>Tạo đơn</Link>
                        </Button>
                      )
                    )}
                    {editable && f.status === "booked" && <FittingStatusMenu fittingId={f.id} />}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
