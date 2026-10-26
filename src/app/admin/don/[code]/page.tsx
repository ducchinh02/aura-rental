import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Ban, Clock, ExternalLink, MessageCircle, Phone, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DressThumb } from "@/components/admin/dress-thumb";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { RentalCalendar } from "@/components/admin/rental-calendar";
import { BookingStatusBadge, PaymentBadge, StatusBadge } from "@/components/admin/status";
import { canManageBranch, getStaff } from "@/lib/auth";
import { getBranches } from "@/lib/branches";
import {
  addDays,
  dateOfTimestamp,
  diffDays,
  formatDate,
  formatDateTime,
  formatDay,
  formatTime,
  hoursLate,
  periodLength,
  periodOf,
  todayVN,
} from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import { formatMoney, formatPhone } from "@/lib/format";
import {
  bookingSourceLabel,
  bookingStatusLabel,
  bookingStatusTone,
  deliveryLabel,
  nextBookingStatus,
  paymentKindLabel,
  paymentMethodLabel,
  rentalUnitLabel,
  shipZoneLabel,
  toneClass,
  transferStatusLabel,
  transferStatusTone,
  type BookingStatus,
  type PaymentKind,
} from "@/lib/labels";
import { getProductOptions } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  AddItemDialog,
  CancelBookingButton,
  FeesDialog,
  InternalNote,
  ItemPriceDialog,
  NextStatusButton,
  PaymentDialog,
  RemoveItemButton,
  ScheduleDialog,
} from "./booking-actions";

export async function generateMetadata({ params }: PageProps<"/admin/don/[code]">): Promise<Metadata> {
  return { title: `Đơn ${decodeURIComponent((await params).code)}` };
}

function Row({ label, children, strong }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4 py-1", strong && "font-semibold")}>
      <dt className={cn(!strong && "text-muted-foreground")}>{label}</dt>
      <dd className="text-right tabular">{children}</dd>
    </div>
  );
}

/** blocked_period dạng "[2026-10-29,2026-11-06)" */
function parseRange(range: unknown) {
  const match = /^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)$/.exec(String(range));
  return match ? { start: match[1], end: match[2] } : null;
}

export default async function BookingPage({ params }: PageProps<"/admin/don/[code]">) {
  const staff = await getStaff();
  const { code } = await params;
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("bookings")
    .select(
      `*,
      customers(id, full_name, phone, facebook_url, zalo, is_blacklisted, note),
      booking_items(id, price, is_price_custom, is_active, blocked_period, inventory_items(id, code, size, home_branch_id, products(id, name, color, extra_hour_price, categories(name), product_images(storage_path, is_cover)))),
      payments(id, kind, method, amount, paid_at, note, profiles(full_name)),
      booking_events(id, event, from_status, to_status, data, created_at, profiles(full_name)),
      transfers(id, status, due_date, from_branch_id, to_branch_id, inventory_items(code))`,
    )
    .eq("code", decodeURIComponent(code))
    .maybeSingle();

  if (!b || !b.customers) notFound();

  const [branches, products, { data: totals }, { data: settings }] = await Promise.all([
    getBranches(),
    getProductOptions(),
    supabase.from("booking_payment_totals").select("*").eq("booking_id", b.id).single(),
    supabase.from("settings").select("late_fee_per_day").single(),
  ]);

  const branchById = new Map(branches.map((br) => [br.id, br]));
  const branch = branchById.get(b.branch_id);
  const customer = b.customers;
  const editable = canManageBranch(staff, b.branch_id);
  const open = b.status === "pending" || b.status === "confirmed";
  const today = todayVN();

  const total = b.total ?? 0;
  const amountPaid = totals?.amount_paid ?? 0;
  const balance = totals?.balance_due ?? total;
  const securityHeld = totals?.security_held ?? 0;
  const paidPercent = total > 0 ? Math.max(0, Math.min(100, Math.round((amountPaid / total) * 100))) : 100;

  // Trễ hạn: tính đến bây giờ (đang thuê) hoặc đến lúc khách trả thực tế.
  // Thuê ngày tính theo ngày × phí trễ mỗi ngày; thuê giờ tính theo giờ × phụ thu mỗi giờ thêm của các váy.
  const period = periodOf(b);
  const hourly = b.rental_unit === "hour" && b.return_at;
  const started = b.status === "picked_up" || b.status === "returned" || b.status === "completed";
  const returnedOn = b.returned_at ? dateOfTimestamp(b.returned_at) : today;
  const lateCount = !started
    ? 0
    : hourly
      ? hoursLate(b.return_at!, b.returned_at)
      : Math.max(0, diffDays(b.return_date, b.status === "picked_up" ? today : returnedOn));
  const lateUnit = hourly ? "giờ" : "ngày";
  const suggestedLateFee = hourly
    ? lateCount * b.booking_items.reduce((sum, bi) => sum + (bi.is_active ? bi.inventory_items.products.extra_hour_price : 0), 0)
    : lateCount * (settings?.late_fee_per_day ?? 0);

  const next = nextBookingStatus[b.status];
  const pendingTransfers = b.transfers.filter(
    (t) => t.to_branch_id === b.branch_id && (t.status === "pending" || t.status === "in_transit"),
  );
  let nextWarning: string | undefined;
  if (next?.status === "picked_up" && pendingTransfers.length) {
    nextWarning = `Còn ${pendingTransfers.length} váy chưa chuyển tới ${branch?.code}. Kiểm tra đã có váy ở shop trước khi giao.`;
  } else if (next?.status === "picked_up" && balance > 0) {
    nextWarning = `Khách còn thiếu ${formatMoney(balance)}. Vẫn giao váy?`;
  } else if (next?.status === "completed" && securityHeld > 0) {
    nextWarning = `Shop đang giữ ${formatMoney(securityHeld)} tiền thế chấp chưa trả khách.`;
  } else if (next?.status === "completed" && balance > 0) {
    nextWarning = `Khách còn thiếu ${formatMoney(balance)}.`;
  }

  const paymentSuggestions: Partial<Record<PaymentKind, number>> = {
    payment: Math.max(0, b.status === "pending" ? Math.min(b.deposit_required - amountPaid, balance) : balance) || undefined,
    security_hold: Math.max(0, b.security_deposit - securityHeld) || undefined,
    security_return: securityHeld || undefined,
    refund: balance < 0 ? -balance : undefined,
  };

  const items = [...b.booking_items].sort((x, y) =>
    x.inventory_items.products.name.localeCompare(y.inventory_items.products.name, "vi"),
  );
  const events = [...b.booking_events].sort((x, y) => y.created_at.localeCompare(x.created_at));
  const payments = [...b.payments].sort((x, y) => x.paid_at.localeCompare(y.paid_at));

  // Khoảng váy bị giữ rộng nhất trong các chiếc của đơn (khoảng nửa mở nên ngày cuối là end − 1)
  const ranges = items
    .filter((i) => i.is_active)
    .map((i) => parseRange(i.blocked_period))
    .filter((r) => r !== null);
  const blockedFrom = ranges.map((r) => r.start).sort()[0];
  const blockedEnd = ranges.map((r) => r.end).sort().at(-1);

  return (
    <PageBody>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            Đơn <span className="font-mono tracking-normal">{b.code}</span>
            <BookingStatusBadge status={b.status} />
            <PaymentBadge total={total} balance={balance} status={b.status} />
            {b.rental_unit === "hour" && <StatusBadge tone="brand">Thuê theo giờ</StatusBadge>}
          </span>
        }
        description={
          <>
            {branch?.name}. Đặt qua {bookingSourceLabel[b.source]} lúc {formatDateTime(b.created_at)}.
          </>
        }
        actions={
          editable && (
            <>
              {open && <CancelBookingButton bookingId={b.id} code={b.code} />}
              {next && <NextStatusButton bookingId={b.id} status={next.status} label={next.action} warning={nextWarning} />}
            </>
          )
        }
      />

      {(b.status === "pending" && b.hold_expires_at) || lateCount > 0 || customer.is_blacklisted || b.cancel_reason ? (
        <div className="flex flex-col gap-3">
          {b.status === "pending" && b.hold_expires_at && (
            <Alert>
              <Clock />
              <AlertTitle>Đang giữ chỗ đến {formatDateTime(b.hold_expires_at)}</AlertTitle>
              <AlertDescription>Chưa ghi nhận tiền cọc thì đơn tự hủy khi hết hạn và váy được mở lịch lại.</AlertDescription>
            </Alert>
          )}
          {b.status === "picked_up" && lateCount > 0 && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>
                Quá hạn trả {lateCount} {lateUnit}
              </AlertTitle>
              <AlertDescription>
                Khách hẹn trả {formatDay(b.return_date)}
                {hourly && ` lúc ${formatTime(b.return_at!)}`}.
                {suggestedLateFee > 0 && ` Phí trễ gợi ý ${formatMoney(suggestedLateFee)}.`}
              </AlertDescription>
            </Alert>
          )}
          {customer.is_blacklisted && (
            <Alert variant="destructive">
              <Ban />
              <AlertTitle>Khách trong danh sách đen</AlertTitle>
              {customer.note && <AlertDescription>{customer.note}</AlertDescription>}
            </Alert>
          )}
          {b.status === "cancelled" && b.cancel_reason && (
            <Alert>
              <Ban />
              <AlertTitle>Đơn đã hủy</AlertTitle>
              <AlertDescription>{b.cancel_reason}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4 md:gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Váy trong đơn</CardTitle>
              <CardDescription>
                {items.length} chiếc, thuê {periodLength(period)}
              </CardDescription>
              {editable && open && (
                <CardAction>
                  <AddItemDialog bookingId={b.id} products={products} />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {items.map((bi) => {
                const item = bi.inventory_items;
                const label = `${item.products.name} size ${item.size}`;
                const away = item.home_branch_id !== b.branch_id;
                return (
                  <div key={bi.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <DressThumb
                      name={item.products.name}
                      color={item.products.color}
                      category={item.products.categories?.name}
                      image={coverPath(item.products.product_images)}
                      className="w-14 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/vay/${item.products.id}`} className="font-medium hover:underline">
                        {item.products.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Size {item.size}</span>
                        <CodeBadge>{item.code}</CodeBadge>
                        {away && (
                          <StatusBadge tone="amber">
                            <ArrowLeftRight className="size-3" />
                            Kho {branchById.get(item.home_branch_id)?.code}
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm tabular">
                      <p className="font-semibold">{formatMoney(bi.price)}</p>
                      {bi.is_price_custom && <p className="text-xs text-muted-foreground">giá sửa tay</p>}
                    </div>
                    {editable && b.status !== "completed" && b.status !== "cancelled" && (
                      <div className="flex">
                        <ItemPriceDialog bookingItemId={bi.id} price={bi.price} label={label} />
                        {open && items.length > 1 && <RemoveItemButton bookingItemId={bi.id} label={label} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thanh toán</CardTitle>
              <CardDescription>Đã thu {paidPercent}% tổng tiền đơn</CardDescription>
              {editable && b.status !== "cancelled" && (
                <CardAction className="flex gap-2">
                  <FeesDialog
                    bookingId={b.id}
                    suggestedLateFee={suggestedLateFee}
                    initial={{
                      discount: b.discount,
                      shipping_fee: b.shipping_fee,
                      late_fee: b.late_fee,
                      damage_fee: b.damage_fee,
                    }}
                  />
                  <PaymentDialog bookingId={b.id} suggestions={paymentSuggestions} />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Tổng đơn", value: total, strong: false },
                  { label: "Đã thu", value: amountPaid, strong: false },
                  { label: balance < 0 ? "Cần hoàn khách" : "Còn thu", value: Math.abs(balance), strong: balance !== 0 },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-muted/60 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={cn("mt-0.5 text-base font-semibold tabular", s.strong && "text-primary")}>{formatMoney(s.value)}</p>
                  </div>
                ))}
              </div>
              <Progress value={paidPercent} aria-label="Tỉ lệ đã thu" />

              <div className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
                <dl>
                  <Row label={`Tiền thuê (${periodLength(period)})`}>{formatMoney(b.subtotal)}</Row>
                  {b.discount > 0 && <Row label="Giảm giá">−{formatMoney(b.discount)}</Row>}
                  {b.shipping_fee > 0 && <Row label="Phí ship">{formatMoney(b.shipping_fee)}</Row>}
                  {b.late_fee > 0 && <Row label="Phí trả trễ">{formatMoney(b.late_fee)}</Row>}
                  {b.damage_fee > 0 && <Row label="Phí hư hỏng">{formatMoney(b.damage_fee)}</Row>}
                  <Separator className="my-1" />
                  <Row label="Tổng" strong>
                    {formatMoney(total)}
                  </Row>
                </dl>
                <dl>
                  <Row label="Cọc giữ chỗ cần thu">{formatMoney(b.deposit_required)}</Row>
                  <Row label="Thế chấp khi nhận váy">{formatMoney(b.security_deposit)}</Row>
                  <Row label="Shop đang giữ thế chấp">{formatMoney(securityHeld)}</Row>
                </dl>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">Các lần thu / hoàn</p>
                {payments.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-0 text-xs">Thời gian</TableHead>
                        <TableHead className="text-xs">Loại</TableHead>
                        <TableHead className="hidden text-xs sm:table-cell">Hình thức</TableHead>
                        <TableHead className="hidden text-xs md:table-cell">Ghi chú</TableHead>
                        <TableHead className="pr-0 text-right text-xs">Số tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => {
                        const out = p.kind === "refund" || p.kind === "security_return";
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="pl-0 text-muted-foreground tabular">{formatDateTime(p.paid_at)}</TableCell>
                            <TableCell>{paymentKindLabel[p.kind]}</TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">{paymentMethodLabel[p.method]}</TableCell>
                            <TableCell className="hidden max-w-48 truncate text-muted-foreground md:table-cell">
                              {[p.note, p.profiles?.full_name].filter(Boolean).join(", ")}
                            </TableCell>
                            <TableCell
                              className={cn("pr-0 text-right font-medium tabular", out ? "text-muted-foreground" : "text-emerald-700")}
                            >
                              {out ? "−" : "+"}
                              {formatMoney(p.amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa ghi nhận khoản nào.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lịch sử đơn</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative ml-1.5 flex flex-col gap-4 border-l pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      className={cn(
                        "absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-card",
                        e.to_status ? toneClass[bookingStatusTone[e.to_status]].dot : "bg-zinc-400",
                      )}
                    />
                    <p className="text-sm font-medium">{eventLabel(e)}</p>
                    <p className="text-xs text-muted-foreground tabular">
                      {formatDateTime(e.created_at)}
                      {e.profiles?.full_name && `, ${e.profiles.full_name}`}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Link href={`/admin/khach/${customer.id}`} className="flex items-center gap-3 rounded-lg hover:opacity-80">
                <CustomerAvatar name={customer.full_name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{customer.full_name}</p>
                  <p className="text-sm text-muted-foreground tabular">{formatPhone(customer.phone)}</p>
                </div>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${customer.phone}`}>
                    <Phone />
                    Gọi
                  </a>
                </Button>
                {customer.zalo && (
                  <Button asChild variant="outline" size="sm">
                    <a href={`https://zalo.me/${customer.zalo.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                      <MessageCircle />
                      Zalo
                    </a>
                  </Button>
                )}
                {customer.facebook_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={customer.facebook_url} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      Facebook
                    </a>
                  </Button>
                )}
              </div>
              {customer.note && !customer.is_blacklisted && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{customer.note}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thời gian thuê</CardTitle>
              <CardDescription>Khách trả váy tại {branch?.name}</CardDescription>
              {editable && ["pending", "confirmed", "picked_up"].includes(b.status) && (
                <CardAction>
                  <ScheduleDialog
                    bookingId={b.id}
                    initial={{
                      unit: b.rental_unit,
                      pickupDate: b.pickup_date,
                      returnDate: b.return_date,
                      startTime: b.pickup_at ? formatTime(b.pickup_at) : null,
                      endTime: b.return_at ? formatTime(b.return_at) : null,
                      delivery: b.delivery_method,
                      shipZone: b.ship_zone,
                      shippingAddress: b.shipping_address,
                    }}
                  />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RentalCalendar
                pickup={b.pickup_date}
                ret={b.return_date}
                blockedFrom={blockedFrom}
                blockedTo={blockedEnd ? addDays(blockedEnd, -1) : undefined}
                today={today}
              />
              <dl className="text-sm">
                <Row label="Hình thức">{rentalUnitLabel[b.rental_unit]}</Row>
                <Row label="Nhận váy">
                  {formatDay(b.pickup_date)}
                  {hourly && ` ${formatTime(b.pickup_at!)}`}
                </Row>
                <Row label="Trả váy">
                  {formatDay(b.return_date)}
                  {hourly && ` ${formatTime(b.return_at!)}`}
                </Row>
                <Row label="Thời lượng">{periodLength(period)}</Row>
                <Row label="Cách nhận">{deliveryLabel[b.delivery_method]}</Row>
                {b.delivery_method === "ship" && b.ship_zone && <Row label="Khu vực">{shipZoneLabel[b.ship_zone]}</Row>}
              </dl>
              {b.shipping_address && <p className="text-sm">{b.shipping_address}</p>}
            </CardContent>
          </Card>

          {b.transfers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Chuyển váy</CardTitle>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/admin/chuyen-vay">Xem tất cả</Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {b.transfers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <CodeBadge>{t.inventory_items.code}</CodeBadge>
                      <p className="mt-1 text-muted-foreground">
                        {branchById.get(t.from_branch_id)?.code} → {branchById.get(t.to_branch_id)?.code}, hạn{" "}
                        {formatDate(t.due_date).slice(0, 5)}
                      </p>
                    </div>
                    <StatusBadge tone={transferStatusTone[t.status]}>{transferStatusLabel[t.status]}</StatusBadge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Ghi chú</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {b.customer_note && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Khách dặn</p>
                  <p className="text-sm whitespace-pre-line">{b.customer_note}</p>
                </div>
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Ghi chú nội bộ</p>
                <InternalNote bookingId={b.id} note={b.internal_note ?? ""} editable={editable} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

function eventLabel(e: { event: string; to_status: BookingStatus | null; data: unknown }) {
  if (e.event === "created") return "Tạo đơn";
  if (e.event === "status_changed" && e.to_status) return `Chuyển sang "${bookingStatusLabel[e.to_status]}"`;
  if (e.event === "price_changed") {
    const d = e.data as { from?: number; to?: number } | null;
    return `Sửa giá ${formatMoney(d?.from)} → ${formatMoney(d?.to)}`;
  }
  return e.event;
}
