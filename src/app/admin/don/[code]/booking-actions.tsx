"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DatePicker, DateRangePicker } from "@/components/admin/date-picker";
import { TimeSelect, timeOptions } from "@/components/admin/time-select";
import { MoneyInput } from "@/components/admin/money-input";
import { ProductPicker, type PickerProduct } from "@/components/admin/product-picker";
import type { ActionResult } from "@/lib/action-result";
import {
  paymentKindLabel,
  paymentMethodLabel,
  shipZoneLabel,
  type BookingStatus,
  type PaymentKind,
  type PaymentMethod,
  type ShipZone,
} from "@/lib/labels";
import {
  addBookingItem,
  addPayment,
  removeBookingItem,
  setBookingStatus,
  setItemPrice,
  updateBookingFees,
  updateBookingSchedule,
  updateInternalNote,
} from "../actions";

/** Chạy action, báo lỗi/thành công bằng toast; trả về true nếu thành công */
function useAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, success?: string, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      onDone?.();
    });
  }
  return { pending, run };
}

function EditDialog({
  title,
  description,
  trigger,
  children,
  onSubmit,
  pending,
  open,
  onOpenChange,
  submitLabel = "Lưu",
}: {
  title: string;
  description?: string;
  trigger: ReactNode;
  children: ReactNode;
  onSubmit: () => void;
  pending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Trạng thái đơn
// ---------------------------------------------------------------------------

export function NextStatusButton({
  bookingId,
  status,
  label,
  warning,
}: {
  bookingId: string;
  status: BookingStatus;
  label: string;
  warning?: string;
}) {
  const { pending, run } = useAction();
  const go = () => run(() => setBookingStatus(bookingId, status), label);

  if (!warning) {
    return (
      <Button onClick={go} disabled={pending}>
        {pending ? "Đang lưu…" : label}
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending}>{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{warning}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Để sau</AlertDialogCancel>
          <AlertDialogAction onClick={go}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CancelBookingButton({ bookingId, code }: { bookingId: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run } = useAction();

  return (
    <EditDialog
      title={`Hủy đơn ${code}`}
      description="Váy trong đơn sẽ được mở lịch lại. Đơn đã hủy không mở lại được."
      open={open}
      onOpenChange={setOpen}
      pending={pending}
      submitLabel="Hủy đơn"
      trigger={<Button variant="outline">Hủy đơn</Button>}
      onSubmit={() => run(() => setBookingStatus(bookingId, "cancelled", reason), "Đã hủy đơn", () => setOpen(false))}
    >
      <Field label="Lý do" htmlFor="cancel-reason" hint="Ví dụ: khách đổi ý, không chuyển cọc.">
        <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </EditDialog>
  );
}

// ---------------------------------------------------------------------------
// Ngày thuê & giao nhận
// ---------------------------------------------------------------------------

export function ScheduleDialog({
  bookingId,
  initial,
}: {
  bookingId: string;
  initial: {
    unit: "day" | "hour";
    pickupDate: string;
    returnDate: string;
    startTime: string | null;
    endTime: string | null;
    delivery: "pickup" | "ship";
    shipZone: ShipZone | null;
    shippingAddress: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState(initial.unit);
  const [pickupDate, setPickupDate] = useState(initial.pickupDate);
  const [returnDate, setReturnDate] = useState(initial.returnDate);
  const [startTime, setStartTime] = useState(initial.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initial.endTime ?? "12:00");
  const [delivery, setDelivery] = useState(initial.delivery);
  const [shipZone, setShipZone] = useState<ShipZone>(initial.shipZone ?? "local");
  const [address, setAddress] = useState(initial.shippingAddress ?? "");
  const { pending, run } = useAction();

  return (
    <EditDialog
      title="Đổi thời gian thuê"
      description="Giá thuê được tính lại theo thời gian mới (trừ giá đã sửa tay)."
      open={open}
      onOpenChange={setOpen}
      pending={pending}
      trigger={
        <Button variant="ghost" size="sm">
          <Pencil />
          Sửa
        </Button>
      }
      onSubmit={() =>
        run(
          () =>
            updateBookingSchedule(bookingId, {
              unit,
              pickupDate,
              returnDate: unit === "hour" ? pickupDate : returnDate,
              startTime: unit === "hour" ? startTime : null,
              endTime: unit === "hour" ? endTime : null,
              delivery: unit === "hour" ? "pickup" : delivery,
              shipZone: unit === "day" && delivery === "ship" ? shipZone : null,
              shippingAddress: unit === "day" && delivery === "ship" ? address : null,
            }),
          "Đã cập nhật thời gian thuê",
          () => setOpen(false),
        )
      }
    >
      <ToggleGroup
        type="single"
        variant="outline"
        value={unit}
        onValueChange={(v) => v && setUnit(v as "day" | "hour")}
        className="justify-start"
      >
        <ToggleGroupItem value="day" className="px-4">
          Theo ngày
        </ToggleGroupItem>
        <ToggleGroupItem value="hour" className="px-4">
          Theo giờ
        </ToggleGroupItem>
      </ToggleGroup>
      {unit === "day" ? (
        <Field label="Ngày nhận → ngày trả" htmlFor="s-range">
          <DateRangePicker
            id="s-range"
            from={pickupDate}
            to={returnDate}
            onChange={(from, to) => {
              setPickupDate(from);
              setReturnDate(to);
            }}
          />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ngày" htmlFor="s-date">
            <DatePicker id="s-date" value={pickupDate} onChange={setPickupDate} className="w-full" />
          </Field>
          <Field label="Giờ nhận" htmlFor="s-start">
            <TimeSelect id="s-start" value={startTime} onChange={setStartTime} options={timeOptions("06:00", "23:30")} />
          </Field>
          <Field label="Giờ trả" htmlFor="s-end">
            <TimeSelect id="s-end" value={endTime} onChange={setEndTime} options={timeOptions("06:00", "23:30")} />
          </Field>
        </div>
      )}
      {unit === "day" && (
      <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as "pickup" | "ship")} className="flex gap-6">
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
        <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <Field label="Khu vực" htmlFor="s-zone">
            <Select value={shipZone} onValueChange={(v) => setShipZone(v as ShipZone)}>
              <SelectTrigger id="s-zone" className="w-full">
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
          <Field label="Địa chỉ giao" htmlFor="s-address">
            <Input id="s-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </Field>
        </div>
      )}
    </EditDialog>
  );
}

// ---------------------------------------------------------------------------
// Tiền
// ---------------------------------------------------------------------------

export function FeesDialog({
  bookingId,
  initial,
  suggestedLateFee,
}: {
  bookingId: string;
  initial: { discount: number; shipping_fee: number; late_fee: number; damage_fee: number };
  suggestedLateFee: number;
}) {
  const [open, setOpen] = useState(false);
  const [fees, setFees] = useState(initial);
  const { pending, run } = useAction();
  const set = (key: keyof typeof fees) => (value: number) => setFees((f) => ({ ...f, [key]: value }));

  return (
    <EditDialog
      title="Sửa phí và giảm giá"
      open={open}
      onOpenChange={setOpen}
      pending={pending}
      trigger={
        <Button variant="ghost" size="sm">
          <Pencil />
          Sửa phí
        </Button>
      }
      onSubmit={() => run(() => updateBookingFees(bookingId, fees), "Đã cập nhật phí", () => setOpen(false))}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Giảm giá" htmlFor="f-discount">
          <MoneyInput id="f-discount" value={fees.discount} onValueChange={set("discount")} />
        </Field>
        <Field label="Phí ship" htmlFor="f-ship">
          <MoneyInput id="f-ship" value={fees.shipping_fee} onValueChange={set("shipping_fee")} />
        </Field>
        <Field
          label="Phí trả trễ"
          htmlFor="f-late"
          hint={
            suggestedLateFee > 0 ? (
              <button type="button" className="underline" onClick={() => set("late_fee")(suggestedLateFee)}>
                Dùng mức gợi ý {new Intl.NumberFormat("vi-VN").format(suggestedLateFee)} ₫
              </button>
            ) : undefined
          }
        >
          <MoneyInput id="f-late" value={fees.late_fee} onValueChange={set("late_fee")} />
        </Field>
        <Field label="Phí hư hỏng" htmlFor="f-damage">
          <MoneyInput id="f-damage" value={fees.damage_fee} onValueChange={set("damage_fee")} />
        </Field>
      </div>
    </EditDialog>
  );
}

export function PaymentDialog({
  bookingId,
  suggestions,
}: {
  bookingId: string;
  suggestions: Partial<Record<PaymentKind, number>>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PaymentKind>("payment");
  const [method, setMethod] = useState<PaymentMethod>("bank");
  const [amount, setAmount] = useState(suggestions.payment ?? 0);
  const [note, setNote] = useState("");
  const { pending, run } = useAction();

  return (
    <EditDialog
      title="Ghi nhận tiền"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setKind("payment");
          setAmount(suggestions.payment ?? 0);
          setNote("");
        }
      }}
      pending={pending}
      submitLabel="Ghi nhận"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          Ghi nhận tiền
        </Button>
      }
      onSubmit={() =>
        run(() => addPayment(bookingId, { kind, method, amount, note }), "Đã ghi nhận", () => setOpen(false))
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Loại" htmlFor="p-kind">
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as PaymentKind);
              setAmount(suggestions[v as PaymentKind] ?? 0);
            }}
          >
            <SelectTrigger id="p-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(paymentKindLabel) as PaymentKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {paymentKindLabel[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hình thức" htmlFor="p-method">
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger id="p-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {paymentMethodLabel[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Số tiền" htmlFor="p-amount" className="col-span-2">
          <MoneyInput id="p-amount" value={amount} onValueChange={setAmount} required />
        </Field>
        <Field label="Ghi chú" htmlFor="p-note" className="col-span-2">
          <Input id="p-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: cọc giữ chỗ" />
        </Field>
      </div>
    </EditDialog>
  );
}

// ---------------------------------------------------------------------------
// Váy trong đơn
// ---------------------------------------------------------------------------

export function ItemPriceDialog({ bookingItemId, price, label }: { bookingItemId: string; price: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(price);
  const { pending, run } = useAction();

  return (
    <EditDialog
      title="Sửa giá thuê"
      description={`${label}. Giá sửa tay được giữ nguyên khi đổi ngày.`}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(price);
      }}
      pending={pending}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Sửa giá ${label}`}>
          <Pencil />
        </Button>
      }
      onSubmit={() => run(() => setItemPrice(bookingItemId, value), "Đã sửa giá", () => setOpen(false))}
    >
      <Field label="Giá thuê" htmlFor="price">
        <MoneyInput id="price" value={value} onValueChange={setValue} />
      </Field>
    </EditDialog>
  );
}

export function RemoveItemButton({ bookingItemId, label }: { bookingItemId: string; label: string }) {
  const { pending, run } = useAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Bỏ ${label}`} disabled={pending}>
          <X />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bỏ {label} khỏi đơn?</AlertDialogTitle>
          <AlertDialogDescription>Chiếc váy này sẽ được mở lịch lại cho khách khác.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Giữ lại</AlertDialogCancel>
          <AlertDialogAction onClick={() => run(() => removeBookingItem(bookingItemId), "Đã bỏ váy khỏi đơn")}>
            Bỏ váy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AddItemDialog({ bookingId, products }: { bookingId: string; products: PickerProduct[] }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [size, setSize] = useState("");
  const { pending, run } = useAction();
  const product = products.find((p) => p.id === productId);

  return (
    <EditDialog
      title="Thêm váy vào đơn"
      description="Hệ thống tự chọn chiếc còn trống trong khoảng ngày của đơn."
      open={open}
      onOpenChange={setOpen}
      pending={pending}
      submitLabel="Thêm váy"
      trigger={
        <Button variant="ghost" size="sm">
          <Plus />
          Thêm váy
        </Button>
      }
      onSubmit={() => {
        if (!productId || !size) {
          toast.error("Chọn mẫu váy và size");
          return;
        }
        run(() => addBookingItem(bookingId, productId, size), "Đã thêm váy", () => {
          setOpen(false);
          setProductId(null);
          setSize("");
        });
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <ProductPicker
          products={products}
          value={productId}
          onChange={(id) => {
            setProductId(id);
            const sizes = products.find((p) => p.id === id)?.sizes ?? [];
            setSize(sizes.length === 1 ? sizes[0] : "");
          }}
        />
        <Select value={size} onValueChange={setSize} disabled={!product?.sizes.length}>
          <SelectTrigger aria-label="Size" className="w-full">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {product?.sizes.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </EditDialog>
  );
}

// ---------------------------------------------------------------------------
// Ghi chú nội bộ
// ---------------------------------------------------------------------------

export function InternalNote({ bookingId, note, editable }: { bookingId: string; note: string; editable: boolean }) {
  const [value, setValue] = useState(note);
  const { pending, run } = useAction();
  const dirty = value.trim() !== note.trim();

  if (!editable) {
    return <p className="text-sm whitespace-pre-line">{note || <span className="text-muted-foreground">Chưa có</span>}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label="Ghi chú nội bộ"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Số đo, yêu cầu sửa váy, hẹn giờ giao…"
      />
      {dirty && (
        <Button
          size="sm"
          className="self-end"
          disabled={pending}
          onClick={() => run(() => updateInternalNote(bookingId, value), "Đã lưu ghi chú")}
        >
          Lưu ghi chú
        </Button>
      )}
    </div>
  );
}
