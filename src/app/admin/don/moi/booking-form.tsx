"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Plus, TriangleAlert, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DatePicker, DateRangePicker } from "@/components/admin/date-picker";
import { TimeSelect, timeOptions } from "@/components/admin/time-select";
import { Field, FormSection } from "@/components/admin/field";
import { MoneyInput } from "@/components/admin/money-input";
import { ProductPicker, type PickerProduct } from "@/components/admin/product-picker";
import { rentalDays } from "@/lib/dates";
import { formatMoney, isValidPhone, normalizePhone } from "@/lib/format";
import { bookingSourceLabel, shipZoneLabel, type BookingSource, type RentalUnit, type ShipZone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { createBooking, findCustomerByPhone, quoteItem, type CustomerMatch, type Quote } from "../actions";

type Row = { key: number; productId: string | null; size: string };

export type BookingFormDefaults = {
  branchId: string;
  unit: RentalUnit;
  pickupDate: string;
  returnDate: string;
  source: BookingSource;
  items: { productId: string; size: string }[];
  customer: { phone: string; full_name: string; facebook_url: string; zalo: string };
  customerNote: string;
  fittingId: string | null;
};

type Props = {
  branches: { id: string; name: string }[];
  products: PickerProduct[];
  defaults: BookingFormDefaults;
};

// Mốc giờ nhận / trả khi thuê theo giờ
const HOURS = timeOptions("06:00", "23:30");

// Key tính từ danh sách hiện tại (không dùng biến đếm toàn cục để server/client khớp nhau)
const nextKey = (rows: Row[]) => rows.reduce((max, r) => Math.max(max, r.key), 0) + 1;

export function BookingForm({ branches, products, defaults }: Props) {
  const router = useRouter();
  const [submitting, startSubmit] = useTransition();

  const [branchId, setBranchId] = useState(defaults.branchId);
  const [phone, setPhone] = useState(defaults.customer.phone);
  const [fullName, setFullName] = useState(defaults.customer.full_name);
  const [facebook, setFacebook] = useState(defaults.customer.facebook_url);
  const [zalo, setZalo] = useState(defaults.customer.zalo);
  const [match, setMatch] = useState<{ phone: string; customer: CustomerMatch | null } | null>(null);

  const [unit, setUnit] = useState<RentalUnit>(defaults.unit);
  const [pickupDate, setPickupDate] = useState(defaults.pickupDate);
  const [returnDate, setReturnDate] = useState(defaults.returnDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [rows, setRows] = useState<Row[]>(() =>
    defaults.items.length
      ? defaults.items.map((i, index) => ({ key: index + 1, productId: i.productId, size: i.size }))
      : [{ key: 1, productId: null, size: "" }],
  );

  const [delivery, setDelivery] = useState<"pickup" | "ship">("pickup");
  const [shipZone, setShipZone] = useState<ShipZone>("local");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingFee, setShippingFee] = useState(0);

  const [source, setSource] = useState<BookingSource>(defaults.source);
  const [discount, setDiscount] = useState(0);
  const [customerNote, setCustomerNote] = useState(defaults.customerNote);
  const [internalNote, setInternalNote] = useState("");

  // Tìm khách cũ theo SĐT
  const normalizedPhone = isValidPhone(phone) ? normalizePhone(phone) : null;
  useEffect(() => {
    if (!normalizedPhone) return;
    let cancelled = false;
    findCustomerByPhone(normalizedPhone).then((customer) => {
      if (cancelled) return;
      setMatch({ phone: normalizedPhone, customer });
      if (customer) {
        setFullName((name) => name || customer.full_name);
        setFacebook((v) => v || customer.facebook_url || "");
        setZalo((v) => v || customer.zalo || "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [normalizedPhone]);
  const customer = match && match.phone === normalizedPhone ? match.customer : null;

  // Báo giá + kiểm tra còn váy cho từng dòng
  const datesValid =
    unit === "hour"
      ? Boolean(pickupDate && startTime && endTime && endTime > startTime)
      : Boolean(pickupDate && returnDate && returnDate >= pickupDate);
  const quoteKey = JSON.stringify({ branchId, unit, pickupDate, returnDate, startTime, endTime, delivery, shipZone, rows });
  const [quotes, setQuotes] = useState<{ key: string; byRow: Record<number, Quote | null> }>({ key: "", byRow: {} });
  useEffect(() => {
    const targets = rows.filter((r) => r.productId && r.size);
    if (!datesValid || targets.length === 0) return;
    let cancelled = false;
    Promise.all(
      targets.map(async (r) => {
        const quote = await quoteItem({
          productId: r.productId!,
          size: r.size,
          branchId,
          unit,
          pickupDate,
          returnDate,
          startTime,
          endTime,
          delivery,
          shipZone: delivery === "ship" ? shipZone : null,
        });
        return [r.key, quote] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setQuotes({ key: quoteKey, byRow: Object.fromEntries(entries) });
    });
    return () => {
      cancelled = true;
    };
    // quoteKey gom đủ các giá trị phụ thuộc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);
  const quoteFor = (row: Row) => (quotes.key === quoteKey ? quotes.byRow[row.key] : undefined);

  const summary = useMemo(() => {
    let subtotal = 0;
    let deposit = 0;
    for (const row of rows) {
      const q = quotes.key === quoteKey ? quotes.byRow[row.key] : undefined;
      if (q && q.price !== null) {
        subtotal += q.price;
        deposit += q.deposit;
      }
    }
    const ship = delivery === "ship" ? shippingFee : 0;
    return { subtotal, deposit, ship, total: subtotal - discount + ship };
  }, [rows, quotes, quoteKey, delivery, shippingFee, discount]);

  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const lengthLabel = !datesValid
    ? null
    : unit === "hour"
      ? `${Math.ceil((toMinutes(endTime) - toMinutes(startTime)) / 60)} giờ`
      : `${rentalDays(pickupDate, returnDate)} ngày`;
  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startSubmit(async () => {
      const result = await createBooking({
        branchId,
        customer: { full_name: fullName, phone, facebook_url: facebook, zalo },
        source,
        schedule: {
          unit,
          pickupDate,
          returnDate: unit === "hour" ? pickupDate : returnDate,
          startTime: unit === "hour" ? startTime : null,
          endTime: unit === "hour" ? endTime : null,
          delivery,
          shipZone: delivery === "ship" ? shipZone : null,
          shippingAddress: delivery === "ship" ? shippingAddress : null,
        },
        shippingFee,
        discount,
        items: rows
          .filter((r) => r.productId)
          .map((r) => ({ productId: r.productId!, size: r.size })),
        customerNote,
        internalNote,
        fittingId: defaults.fittingId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã tạo đơn ${result.data.code}`);
      router.push(`/admin/don/${result.data.code}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <Card className="gap-0 divide-y py-0">
        <FormSection title="Khách hàng">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Số điện thoại" htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912 345 678"
                required
              />
            </Field>
            <Field label="Tên khách" htmlFor="full_name">
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="Facebook" htmlFor="facebook">
              <Input
                id="facebook"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="Link trang cá nhân"
              />
            </Field>
            <Field label="Zalo" htmlFor="zalo">
              <Input id="zalo" value={zalo} onChange={(e) => setZalo(e.target.value)} placeholder="SĐT hoặc tên Zalo" />
            </Field>
          </div>
          {customer && (
            <Alert variant={customer.is_blacklisted ? "destructive" : "default"}>
              {customer.is_blacklisted ? <TriangleAlert /> : <UserCheck />}
              <AlertTitle>
                {customer.is_blacklisted ? "Khách trong danh sách đen" : "Khách cũ"}, đã thuê {customer.bookingCount} đơn
              </AlertTitle>
              {customer.note && <AlertDescription>{customer.note}</AlertDescription>}
            </Alert>
          )}
        </FormSection>

        <FormSection
          title="Thời gian thuê"
          aside={lengthLabel && <span className="text-sm text-muted-foreground tabular">{lengthLabel}</span>}
        >
          <ToggleGroup
            type="single"
            variant="outline"
            value={unit}
            onValueChange={(v) => {
              if (!v) return;
              setUnit(v as RentalUnit);
              if (v === "hour") setDelivery("pickup");
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="day" className="px-4">
              <CalendarDays />
              Theo ngày
            </ToggleGroupItem>
            <ToggleGroupItem value="hour" className="px-4">
              <Clock />
              Theo giờ
            </ToggleGroupItem>
          </ToggleGroup>
          <div className={cn("grid gap-4", unit === "hour" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
            <Field label="Cơ sở" htmlFor="branch">
              <Select value={branchId} onValueChange={setBranchId} disabled={branches.length < 2}>
                <SelectTrigger id="branch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {unit === "day" ? (
              <Field label="Ngày nhận → ngày trả" htmlFor="dates" className="sm:col-span-2">
                <DateRangePicker
                  id="dates"
                  from={pickupDate}
                  to={returnDate}
                  onChange={(from, to) => {
                    setPickupDate(from);
                    setReturnDate(to);
                  }}
                />
              </Field>
            ) : (
              <>
                <Field label="Ngày" htmlFor="hour-date">
                  <DatePicker id="hour-date" value={pickupDate} onChange={setPickupDate} className="w-full" />
                </Field>
                <Field label="Giờ nhận" htmlFor="start-time">
                  <TimeSelect id="start-time" value={startTime} onChange={setStartTime} options={HOURS} />
                </Field>
                <Field label="Giờ trả" htmlFor="end-time" hint={endTime <= startTime ? "Giờ trả phải sau giờ nhận" : undefined}>
                  <TimeSelect id="end-time" value={endTime} onChange={setEndTime} options={HOURS} />
                </Field>
              </>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Váy"
          aside={
            <Button type="button" variant="ghost" size="sm" onClick={() => setRows((r) => [...r, { key: nextKey(r), productId: null, size: "" }])}>
              <Plus />
              Thêm váy
            </Button>
          }
        >
          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const product = products.find((p) => p.id === row.productId);
              const quote = quoteFor(row);
              return (
                <li key={row.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-start">
                  <ProductPicker
                    id={`product-${row.key}`}
                    products={products}
                    disabledReason={(p) => (unit === "hour" && !p.hourly ? "Chỉ thuê theo ngày" : null)}
                    value={row.productId}
                    onChange={(productId) => {
                      const sizes = products.find((p) => p.id === productId)?.sizes ?? [];
                      updateRow(row.key, { productId, size: sizes.length === 1 ? sizes[0] : "" });
                    }}
                  />
                  <Select
                    value={row.size}
                    onValueChange={(size) => updateRow(row.key, { size })}
                    disabled={!product?.sizes.length}
                  >
                    <SelectTrigger aria-label={`Size váy ${index + 1}`} className="w-full">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      {product?.sizes.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between gap-2 sm:contents">
                    <p className="text-sm sm:col-span-2 sm:row-start-2">
                      {!row.productId || !row.size || !datesValid ? (
                        <span className="text-muted-foreground">
                          {datesValid ? "Chọn mẫu và size để xem giá" : "Chọn thời gian để kiểm tra lịch"}
                        </span>
                      ) : quote === undefined ? (
                        <span className="text-muted-foreground">Đang kiểm tra lịch…</span>
                      ) : quote?.price === null ? (
                        <span className="text-destructive">Mẫu này chưa có giá thuê theo giờ</span>
                      ) : quote?.available ? (
                        <span>
                          Còn váy, <span className="font-medium tabular">{formatMoney(quote.price)}</span>
                        </span>
                      ) : (
                        <span className="text-destructive">
                          Đã kín lịch trong {unit === "hour" ? "khung giờ" : "khoảng ngày"} này
                        </span>
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Bỏ váy này"
                      disabled={rows.length === 1}
                      onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                    >
                      <X />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </FormSection>

        <FormSection title="Nhận váy">
          {unit === "hour" ? (
            <p className="text-sm text-muted-foreground">Thuê theo giờ: khách nhận và trả váy tại {branches.find((b) => b.id === branchId)?.name}.</p>
          ) : (
          <RadioGroup
            value={delivery}
            onValueChange={(v) => setDelivery(v as "pickup" | "ship")}
            className="flex flex-wrap gap-6"
          >
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem value="pickup" />
              Nhận tại shop
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem value="ship" />
              Giao tận nơi
            </Label>
          </RadioGroup>
          )}
          {unit === "day" && delivery === "ship" && (
            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_10rem]">
              <Field label="Khu vực" htmlFor="zone">
                <Select value={shipZone} onValueChange={(v) => setShipZone(v as ShipZone)}>
                  <SelectTrigger id="zone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(shipZoneLabel) as ShipZone[]).map((z) => (
                      <SelectItem key={z} value={z}>
                        {shipZoneLabel[z]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Địa chỉ giao" htmlFor="address">
                <Input
                  id="address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  required
                />
              </Field>
              <Field label="Phí ship" htmlFor="ship-fee">
                <MoneyInput id="ship-fee" value={shippingFee} onValueChange={setShippingFee} />
              </Field>
            </div>
          )}
        </FormSection>

        <FormSection title="Ghi chú">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Khách đặt qua" htmlFor="source">
              <Select value={source} onValueChange={(v) => setSource(v as BookingSource)}>
                <SelectTrigger id="source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(bookingSourceLabel) as BookingSource[])
                    .filter((s) => s !== "web")
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {bookingSourceLabel[s]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Giảm giá" htmlFor="discount">
              <MoneyInput id="discount" value={discount} onValueChange={setDiscount} />
            </Field>
            <Field label="Khách dặn" htmlFor="customer-note">
              <Textarea
                id="customer-note"
                rows={2}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
              />
            </Field>
            <Field label="Ghi chú nội bộ" htmlFor="internal-note" hint="Khách không thấy ghi chú này.">
              <Textarea
                id="internal-note"
                rows={2}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
              />
            </Field>
          </div>
        </FormSection>
      </Card>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Tạm tính</CardTitle>
          <CardDescription>Cập nhật theo váy và ngày đã chọn</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 text-sm tabular">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tiền thuê{lengthLabel ? ` (${lengthLabel})` : ""}</dt>
              <dd>{formatMoney(summary.subtotal)}</dd>
            </div>
            {summary.ship > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Phí ship</dt>
                <dd>{formatMoney(summary.ship)}</dd>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Giảm giá</dt>
                <dd>−{formatMoney(discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 border-t pt-3 font-semibold">
              <dt>Tổng</dt>
              <dd className="text-2xl tracking-tight">{formatMoney(summary.total)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cọc giữ chỗ</dt>
              <dd>{summary.subtotal > 0 && summary.deposit === 0 ? "Không cần cọc" : formatMoney(summary.deposit)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {summary.subtotal > 0 && summary.deposit === 0
              ? "Váy trong đơn không cần cọc: đơn giữ váy, chờ shop xác nhận và không tự huỷ."
              : "Đơn mới ở trạng thái chờ cọc và giữ váy trong thời gian giữ chỗ đã cài đặt."}
          </p>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? "Đang tạo đơn…" : "Tạo đơn"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
