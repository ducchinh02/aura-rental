"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Store, Truck, Users } from "lucide-react";
import { vi } from "react-day-picker/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CodeBadge } from "@/components/admin/code-badge";
import { dateToIso, isoToDate } from "@/components/admin/date-picker";
import { Field, FormSection } from "@/components/admin/field";
import { DepositPayment, type BankInfo } from "@/components/shop/deposit-payment";
import { Turnstile, captchaEnabled } from "@/components/shop/turnstile";
import { useLiveAvailability, type LiveStatus } from "@/hooks/use-live-availability";
import { addDays, formatDateTime, formatDay, formatPeriod, formatTime, periodLength, rentalDays, rentalHours, todayVN } from "@/lib/dates";
import { formatMoney, isValidPhone } from "@/lib/format";
import type { ShopBranch, ShopProduct } from "@/lib/queries/storefront";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { placeOrder, type PlacedOrder } from "@/app/(shop)/actions";

type Unit = "day" | "hour";
type Slot = { start: string; maxEnd: string | null };
type Quote = { key: string; available: boolean; price: number | null; days: number; hours: number | null };

const BOOK_AHEAD_DAYS = 120;
const HOUR = 3_600_000;

// Ngày "hôm nay" theo giờ VN chỉ tính ở trình duyệt; lúc render trên server chưa có nên hiện khung chờ
const noop = () => () => {};
function useToday() {
  return useSyncExternalStore(noop, todayVN, () => null);
}

/** Các mốc giờ trả: từ nhận + 1 giờ tới giờ trả muộn nhất còn trống, cách 30 phút */
function endOptions(start: string, maxEnd: string) {
  const out: string[] = [];
  for (let t = new Date(start).getTime() + HOUR; t <= new Date(maxEnd).getTime(); t += HOUR / 2) {
    out.push(new Date(t).toISOString());
  }
  return out;
}

function daysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function OrderForm({
  product,
  branches,
  holdHours,
  bank,
}: {
  product: ShopProduct;
  branches: ShopBranch[];
  holdHours: number;
  bank: BankInfo | null;
}) {
  const today = useToday();

  // Lựa chọn thuê
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [size, setSize] = useState(product.sizes.length === 1 ? product.sizes[0] : "");
  const [unitChoice, setUnitChoice] = useState<Unit>("day");
  const [range, setRange] = useState<{ from: string; to: string | null } | null>(null);
  const [rangeHint, setRangeHint] = useState<string | null>(null);
  const [hourDate, setHourDate] = useState<string | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<string | null>(null);
  const [deliveryChoice, setDeliveryChoice] = useState<"pickup" | "ship">("pickup");
  const [shipZone, setShipZone] = useState<"local" | "province">("local");
  const [address, setAddress] = useState("");

  // Thông tin khách
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [nonce, setNonce] = useState(0);

  const branch = branches.find((b) => b.id === branchId);
  const price = product.prices[branchId];
  const hourlyHere = price?.hourly != null;
  const unit: Unit = hourlyHere ? unitChoice : "day";
  const delivery = unit === "hour" ? "pickup" : deliveryChoice;
  const zone = delivery === "ship" ? shipZone : null;

  const pickupDate = unit === "day" ? (range?.from ?? null) : hourDate;
  const returnDate = unit === "day" ? (range?.to ?? null) : hourDate;
  const ready = Boolean(size) && (unit === "day" ? Boolean(range?.to) : Boolean(startAt && endAt));

  const live = useLiveAvailability(product.id, size, pickupDate, returnDate);
  const version = live.version + nonce;

  // Ngày không còn chiếc nào của size này (thuê theo ngày)
  const blockedKey = [branchId, size, delivery, zone].join("|");
  const [blocked, setBlocked] = useState<{ key: string; days: Set<string> } | null>(null);
  useEffect(() => {
    if (!today || !size || unit !== "day") return;
    let stale = false;
    createClient()
      .rpc("get_unavailable_dates", {
        p_product_id: product.id,
        p_size: size,
        p_branch_id: branchId,
        p_from: today,
        p_to: addDays(today, BOOK_AHEAD_DAYS),
        p_delivery: delivery,
        p_ship_zone: zone ?? undefined,
      })
      .then(({ data }) => {
        if (!stale) setBlocked({ key: [branchId, size, delivery, zone].join("|"), days: new Set(data ?? []) });
      });
    return () => {
      stale = true;
    };
  }, [today, product.id, branchId, size, unit, delivery, zone, version]);
  const blockedDays = blocked?.key === blockedKey ? blocked.days : null;

  // Khung giờ còn trống trong ngày (thuê theo giờ)
  const slotsKey = [branchId, size, hourDate].join("|");
  const [slots, setSlots] = useState<{ key: string; list: Slot[] } | null>(null);
  useEffect(() => {
    if (unit !== "hour" || !hourDate || !size) return;
    let stale = false;
    createClient()
      .rpc("get_hourly_slots", { p_product_id: product.id, p_size: size, p_branch_id: branchId, p_date: hourDate })
      .then(({ data }) => {
        if (stale) return;
        setSlots({
          key: [branchId, size, hourDate].join("|"),
          list: (data ?? []).map((s) => ({ start: s.start_at, maxEnd: s.max_end_at as string | null })),
        });
      });
    return () => {
      stale = true;
    };
  }, [product.id, branchId, size, unit, hourDate, version]);
  const daySlots = slots?.key === slotsKey ? slots.list : null;
  const slot = daySlots?.find((s) => s.start === startAt);

  // Giá + còn váy cho đúng lựa chọn hiện tại; chạy lại mỗi khi lịch đổi (Realtime)
  const quoteKey = ready ? JSON.stringify([branchId, size, unit, pickupDate, returnDate, startAt, endAt, delivery, zone]) : null;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [takenKey, setTakenKey] = useState<string | null>(null);
  const lastQuote = useRef<Quote | null>(null);
  useEffect(() => {
    if (!quoteKey || !pickupDate || !returnDate) return;
    let stale = false;
    createClient()
      .rpc("quote_rental", {
        p_product_id: product.id,
        p_size: size,
        p_branch_id: branchId,
        p_pickup_date: pickupDate,
        p_return_date: returnDate,
        p_delivery: delivery,
        p_ship_zone: zone ?? undefined,
        p_unit: unit,
        p_pickup_at: startAt ?? undefined,
        p_return_at: endAt ?? undefined,
      })
      .maybeSingle()
      .then(({ data }) => {
        if (stale || !data) return;
        const next: Quote = {
          key: quoteKey,
          available: data.available,
          price: data.price,
          days: data.rental_days,
          hours: data.hours,
        };
        // Cùng lựa chọn, lần trước còn váy mà giờ hết: có khách khác vừa đặt mất
        const prev = lastQuote.current;
        if (prev?.key === quoteKey && prev.available && !next.available) setTakenKey(quoteKey);
        lastQuote.current = next;
        setQuote(next);
      });
    return () => {
      stale = true;
    };
  }, [quoteKey, product.id, size, branchId, pickupDate, returnDate, delivery, zone, unit, startAt, endAt, version]);
  const current = quote?.key === quoteKey ? quote : null;
  const taken = takenKey !== null && takenKey === quoteKey;

  // Khách khác đang chọn cùng size, trùng ngày
  const rivals = live.others.filter(
    (o) => o.size === size && pickupDate && returnDate && o.from && o.to && o.from <= returnDate && pickupDate <= o.to,
  ).length;
  const changedMySize = live.lastChange && (!live.lastChange.size || live.lastChange.size === size) ? live.lastChange : null;

  const pickDay = (day: Date) => {
    const iso = dateToIso(day);
    setRangeHint(null);
    if (!range || range.to || iso < range.from) {
      setRange({ from: iso, to: null });
      return;
    }
    const busy = daysBetween(range.from, iso).find((d) => blockedDays?.has(d));
    if (busy) {
      setRange({ from: iso, to: null });
      setRangeHint(`Ngày ${formatDay(busy)} đã kín size ${size}, bạn chọn lại ngày nhận nhé`);
      return;
    }
    setRange({ from: range.from, to: iso });
  };

  const pickStart = (s: Slot) => {
    setStartAt(s.start);
    const wanted = new Date(new Date(s.start).getTime() + product.hourlyHours * HOUR);
    const latest = new Date(s.maxEnd!);
    setEndAt((wanted < latest ? wanted : latest).toISOString());
  };

  const canSubmit =
    ready &&
    current?.available === true &&
    fullName.trim() !== "" &&
    isValidPhone(phone) &&
    (delivery === "pickup" || address.trim() !== "") &&
    (!captchaEnabled || Boolean(captcha));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setFormError(null);
    startTransition(async () => {
      const result = await placeOrder({
        productId: product.id,
        size,
        branchId,
        unit,
        pickupDate: unit === "day" ? pickupDate : null,
        returnDate: unit === "day" ? returnDate : null,
        pickupAt: unit === "hour" ? startAt : null,
        returnAt: unit === "hour" ? endAt : null,
        delivery,
        shipZone: zone,
        shippingAddress: delivery === "ship" ? address : null,
        fullName,
        phone,
        contact,
        note,
        captcha,
      });
      setCaptchaReset((n) => n + 1);
      if (!result.ok) {
        setFormError(result.error);
        setNonce((n) => n + 1);
        return;
      }
      setPlaced(result.data);
    });
  };

  if (placed) {
    return (
      <OrderPlaced
        order={placed}
        product={product}
        size={size}
        branch={branch}
        bank={bank}
        onAgain={() => {
          setPlaced(null);
          setRange(null);
          setStartAt(null);
          setEndAt(null);
          setNonce((n) => n + 1);
        }}
      />
    );
  }

  return (
    <form onSubmit={submit}>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-5">
          <CardTitle className="text-lg">Đặt giữ váy</CardTitle>
          <CardDescription>
            {price && (
              <>
                <span className="font-medium text-foreground tabular">{formatMoney(price.price)}</span> / {product.rentalDays} ngày
                {price.hourly != null && (
                  <>
                    {" "}hoặc <span className="font-medium text-foreground tabular">{formatMoney(price.hourly)}</span> / {product.hourlyHours} giờ
                  </>
                )}
              </>
            )}
          </CardDescription>
          <LiveBadge status={live.status} />
        </CardHeader>

        <div className="flex flex-col divide-y">
          {branches.length > 1 && (
            <FormSection title="Cơ sở" description="Bạn nhận và trả váy tại cơ sở này">
              <RadioGroup value={branchId} onValueChange={setBranchId} className="gap-2">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    htmlFor={`branch-${b.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                  >
                    <RadioGroupItem id={`branch-${b.id}`} value={b.id} className="mt-0.5" />
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">{b.name}</span>
                      {b.address && <span className="block text-muted-foreground">{b.address}</span>}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </FormSection>
          )}

          <FormSection title="Size">
            <ToggleGroup
              type="single"
              variant="outline"
              value={size}
              onValueChange={(v) => v && setSize(v)}
              className="flex-wrap justify-start"
              aria-label="Chọn size"
            >
              {product.sizes.map((s) => (
                <ToggleGroupItem key={s} value={s} className="min-w-12 font-medium">
                  {s}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormSection>

          <FormSection
            title="Thời gian thuê"
            aside={
              hourlyHere ? (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={unit}
                  onValueChange={(v) => v && setUnitChoice(v as Unit)}
                  aria-label="Hình thức thuê"
                >
                  <ToggleGroupItem value="day" className="px-3">
                    <CalendarDays />
                    Theo ngày
                  </ToggleGroupItem>
                  <ToggleGroupItem value="hour" className="px-3">
                    <Clock />
                    Theo giờ
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : undefined
            }
          >
            {!size ? (
              <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">Chọn size để xem lịch còn trống</p>
            ) : !today ? (
              <Skeleton className="h-80 w-full" />
            ) : unit === "day" ? (
              <div className="flex flex-col gap-3">
                <Calendar
                  mode="range"
                  locale={vi}
                  today={isoToDate(today)}
                  selected={range ? { from: isoToDate(range.from), to: isoToDate(range.to) } : undefined}
                  // Lần bấm đầu là ngày nhận mới, lần sau là ngày trả (bấm trước ngày nhận thì đổi ngày nhận)
                  onSelect={(_, day) => pickDay(day)}
                  defaultMonth={isoToDate(range?.from ?? today)}
                  showOutsideDays={false}
                  disabled={[
                    { before: isoToDate(today)! },
                    { after: isoToDate(addDays(today, BOOK_AHEAD_DAYS))! },
                    (d) => blockedDays?.has(dateToIso(d)) ?? false,
                  ]}
                  modifiers={{ booked: (d) => dateToIso(d) >= today && (blockedDays?.has(dateToIso(d)) ?? false) }}
                  modifiersClassNames={{ booked: "[&_button]:line-through [&_button]:decoration-red-500/60" }}
                  className={cn("mx-auto p-0 [--cell-size:--spacing(11)]", !blockedDays && "opacity-60")}
                />
                <p className="text-center text-sm text-muted-foreground">
                  {rangeHint ? (
                    <span className="text-amber-700">{rangeHint}</span>
                  ) : !range ? (
                    "Bấm ngày nhận váy, rồi bấm ngày trả"
                  ) : !range.to ? (
                    <>Nhận {formatDay(range.from)}. Chọn tiếp ngày trả</>
                  ) : (
                    <>
                      Nhận <span className="font-medium text-foreground">{formatDay(range.from)}</span>, trả{" "}
                      <span className="font-medium text-foreground">{formatDay(range.to)}</span> ({rentalDays(range.from, range.to)} ngày)
                    </>
                  )}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Ngày gạch ngang: size {size} đã kín
                  {changedMySize && <>, lịch vừa cập nhật lúc {formatTime(new Date(changedMySize.at).toISOString())}</>}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Calendar
                  mode="single"
                  locale={vi}
                  today={isoToDate(today)}
                  selected={isoToDate(hourDate)}
                  onSelect={(d) => {
                    if (!d) return;
                    setHourDate(dateToIso(d));
                    setStartAt(null);
                    setEndAt(null);
                  }}
                  defaultMonth={isoToDate(hourDate ?? today)}
                  showOutsideDays={false}
                  disabled={[{ before: isoToDate(today)! }, { after: isoToDate(addDays(today, BOOK_AHEAD_DAYS))! }]}
                  className="mx-auto p-0 [--cell-size:--spacing(11)]"
                />
                {hourDate && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium">
                      Giờ nhận váy, {formatDay(hourDate)}
                      {branch && (
                        <span className="font-normal text-muted-foreground">
                          {" "}(shop mở {branch.open} – {branch.close})
                        </span>
                      )}
                    </p>
                    {!daySlots ? (
                      <Skeleton className="h-24 w-full" />
                    ) : daySlots.every((s) => !s.maxEnd) ? (
                      <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
                        Ngày này size {size} đã kín giờ. Bạn chọn ngày khác nhé.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {daySlots.map((s) => (
                          <Button
                            key={s.start}
                            type="button"
                            size="sm"
                            variant={s.start === startAt ? "default" : "outline"}
                            disabled={!s.maxEnd}
                            onClick={() => pickStart(s)}
                            className="tabular"
                          >
                            {formatTime(s.start)}
                          </Button>
                        ))}
                      </div>
                    )}
                    {startAt && slot?.maxEnd && (
                      <Field label="Giờ trả váy" htmlFor="end-at" hint={`Trả muộn nhất ${formatTime(slot.maxEnd)} vì sau đó váy đã có lịch hoặc shop đóng cửa`}>
                        <Select value={endAt ?? ""} onValueChange={setEndAt}>
                          <SelectTrigger id="end-at" className="w-full tabular">
                            <SelectValue placeholder="Chọn giờ trả" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {endOptions(startAt, slot.maxEnd).map((t) => (
                              <SelectItem key={t} value={t} className="tabular">
                                {formatTime(t)} ({rentalHours(startAt, t)} giờ)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            {taken && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Vừa có khách khác đặt mất</AlertTitle>
                <AlertDescription>
                  Size {size} không còn chiếc nào trong thời gian bạn chọn. Bạn chọn thời gian khác hoặc size khác nhé.
                </AlertDescription>
              </Alert>
            )}
            {!taken && ready && current && !current.available && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Size {size} đã kín trong thời gian này</AlertTitle>
                <AlertDescription>Bạn chọn thời gian khác hoặc size khác nhé.</AlertDescription>
              </Alert>
            )}
            {rivals > 0 && current?.available && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <Users />
                <AlertTitle>{rivals} người khác cũng đang chọn size {size} những ngày này</AlertTitle>
                <AlertDescription className="text-amber-800">
                  Váy chỉ được giữ khi đơn đặt xong. Ai đặt trước giữ được trước.
                </AlertDescription>
              </Alert>
            )}
          </FormSection>

          {unit === "day" && (
            <FormSection title="Nhận váy">
              <RadioGroup
                value={deliveryChoice}
                onValueChange={(v) => setDeliveryChoice(v as "pickup" | "ship")}
                className="grid gap-2 sm:grid-cols-2"
              >
                {(
                  [
                    ["pickup", Store, "Nhận tại shop", branch?.name ?? ""],
                    ["ship", Truck, "Giao tận nơi", "Phí ship shop báo sau"],
                  ] as const
                ).map(([value, Icon, label, hint]) => (
                  <label
                    key={value}
                    htmlFor={`delivery-${value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                  >
                    <RadioGroupItem id={`delivery-${value}`} value={value} className="mt-0.5" />
                    <span className="min-w-0 text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Icon className="size-4 text-muted-foreground" />
                        {label}
                      </span>
                      <span className="block truncate text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {delivery === "ship" && (
                <div className="grid gap-3">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={shipZone}
                    onValueChange={(v) => v && setShipZone(v as "local" | "province")}
                    className="justify-start"
                    aria-label="Khu vực giao"
                  >
                    <ToggleGroupItem value="local" className="px-4">
                      Nội thành
                    </ToggleGroupItem>
                    <ToggleGroupItem value="province" className="px-4">
                      Ngoại tỉnh
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Field label="Địa chỉ nhận váy" htmlFor="address" hint="Giao xa cần thêm ngày ship nên một số ngày có thể kín hơn">
                    <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
                  </Field>
                </div>
              )}
            </FormSection>
          )}

          <FormSection title="Thông tin của bạn" description="Shop liên hệ qua số này để xác nhận đơn">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ tên" htmlFor="full-name">
                <Input id="full-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
              <Field
                label="Số điện thoại"
                htmlFor="phone"
                hint={phone && !isValidPhone(phone) ? "Số điện thoại chưa đúng" : undefined}
              >
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </Field>
              <Field label="Zalo hoặc link Facebook" htmlFor="contact" className="sm:col-span-2">
                <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Không bắt buộc" />
              </Field>
              <Field label="Ghi chú cho shop" htmlFor="note" className="sm:col-span-2">
                <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Số đo, dịp mặc, cần thêm phụ kiện…" />
              </Field>
            </div>
          </FormSection>

          <section className="flex flex-col gap-4 bg-muted/40 px-5 py-5">
            <dl className="flex flex-col gap-2 text-sm tabular">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  Tiền thuê
                  {current?.available &&
                    ` (${periodLength({ unit, pickupDate: pickupDate!, returnDate: returnDate!, pickupAt: startAt, returnAt: endAt })})`}
                </dt>
                <dd className="font-medium">{current?.available && current.price != null ? formatMoney(current.price) : "–"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                {product.deposit > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Cọc giữ chỗ (chuyển khoản trong {holdHours} giờ)</dt>
                    <dd className="font-medium">{formatMoney(product.deposit)}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-muted-foreground">Cọc giữ chỗ</dt>
                    <dd className="font-medium text-emerald-700">Không cần cọc</dd>
                  </>
                )}
              </div>
              {product.security > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Thế chấp khi nhận váy, hoàn lại khi trả</dt>
                  <dd>{formatMoney(product.security)}</dd>
                </div>
              )}
              {delivery === "ship" && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Phí ship</dt>
                  <dd className="text-muted-foreground">Shop báo sau</dd>
                </div>
              )}
            </dl>

            <Turnstile onToken={setCaptcha} resetKey={captchaReset} />

            {formError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Chưa đặt được</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" disabled={!canSubmit || pending}>
              {pending && <Spinner />}
              {pending ? "Đang giữ váy…" : "Đặt giữ váy"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {product.deposit > 0
                ? `Đặt xong bạn chuyển cọc ${formatMoney(product.deposit)} để giữ váy. Quá ${holdHours} giờ chưa cọc, đơn tự huỷ.`
                : "Mẫu này không cần cọc. Đặt xong shop giữ váy và gọi hoặc nhắn Zalo để xác nhận với bạn."}
            </p>
          </section>
        </div>
      </Card>
    </form>
  );
}

function LiveBadge({ status }: { status: LiveStatus }) {
  const meta = {
    live: { dot: "bg-emerald-500", text: "Lịch trống cập nhật trực tiếp" },
    connecting: { dot: "bg-zinc-300", text: "Đang kết nối lịch…" },
    offline: { dot: "bg-amber-500", text: "Mất kết nối, lịch có thể chưa mới. Tải lại trang để cập nhật." },
  }[status];
  return (
    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <span className="relative flex size-2">
        {status === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn("relative inline-flex size-2 rounded-full", meta.dot)} />
      </span>
      {meta.text}
    </p>
  );
}

function OrderPlaced({
  order,
  product,
  size,
  branch,
  bank,
  onAgain,
}: {
  order: PlacedOrder;
  product: ShopProduct;
  size: string;
  branch?: ShopBranch;
  bank: BankInfo | null;
  onAgain: () => void;
}) {
  // Điện thoại: form nằm dưới ảnh váy, cuộn tới thẻ kết quả để khách thấy ngay mã đơn và QR
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const needsDeposit = order.deposit > 0;
  const period = {
    unit: order.unit,
    pickupDate: order.pickupDate,
    returnDate: order.returnDate,
    pickupAt: order.pickupAt,
    returnAt: order.returnAt,
  };
  return (
    <Card ref={card} className="scroll-mt-20">
      <CardHeader>
        <CheckCircle2 className="mb-1 size-8 text-emerald-600" />
        <CardTitle className="text-lg">Shop đã giữ váy cho bạn</CardTitle>
        <CardDescription>
          Mã đơn <CodeBadge className="text-xs">{order.code}</CodeBadge>
          {needsDeposit && order.holdExpiresAt && (
            <>. Chuyển cọc trước {formatDateTime(order.holdExpiresAt)} để giữ váy, quá hạn đơn tự huỷ.</>
          )}
          {!needsDeposit && <>. Đơn không cần cọc, shop sẽ liên hệ để xác nhận với bạn.</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid gap-2 rounded-lg bg-muted/50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Váy</dt>
            <dd className="font-medium">
              {product.name}, size {size}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Thời gian</dt>
            <dd className="tabular">
              {formatPeriod(period)} ({periodLength(period)})
            </dd>
          </div>
          {branch && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Nhận tại</dt>
              <dd className="text-right">{branch.name}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Tiền thuê</dt>
            <dd className="tabular">{formatMoney(order.total)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
            <dt>Cọc cần chuyển</dt>
            <dd className="tabular">{needsDeposit ? formatMoney(order.deposit) : "Không cần cọc"}</dd>
          </div>
        </dl>
        {needsDeposit && <DepositPayment code={order.code} amount={order.deposit} bank={bank} deadline={order.holdExpiresAt} />}
        <p className="text-sm text-muted-foreground">
          {needsDeposit
            ? "Shop sẽ gọi hoặc nhắn Zalo xác nhận khi nhận được cọc."
            : "Shop sẽ gọi hoặc nhắn Zalo trong giờ mở cửa để xác nhận đơn, bạn để ý điện thoại nhé."}{" "}
          Xem lại đơn bất cứ lúc nào ở trang{" "}
          <Link href={`/tra-cuu?code=${order.code}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Tra cứu đơn
          </Link>{" "}
          bằng mã đơn và số điện thoại.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={onAgain}>
          Đặt thêm váy khác
        </Button>
      </CardFooter>
    </Card>
  );
}
