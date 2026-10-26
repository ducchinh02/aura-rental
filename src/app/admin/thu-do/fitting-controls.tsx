"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { toast } from "sonner";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/admin/date-picker";
import { Field } from "@/components/admin/field";
import { TimeSelect, timeOptions } from "@/components/admin/time-select";
import { ProductPicker, type PickerProduct } from "@/components/admin/product-picker";
import { bookingSourceLabel, type BookingSource, type FittingStatus } from "@/lib/labels";
import { createFitting, setFittingStatus } from "./actions";

export function FittingStatusMenu({ fittingId }: { fittingId: string }) {
  const [pending, startTransition] = useTransition();
  const set = (status: FittingStatus, message: string) =>
    startTransition(async () => {
      const result = await setFittingStatus(fittingId, status);
      if (!result.ok) return void toast.error(result.error);
      toast.success(message);
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cập nhật lịch thử" disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => set("done", "Đã ghi nhận khách đến thử")}>Khách đã đến</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => set("no_show", "Đã ghi nhận khách không đến")}>Khách không đến</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => set("cancelled", "Đã hủy lịch thử")}>
          Hủy lịch
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Row = { key: number; productId: string | null; size: string };

// Mốc giờ hẹn thử, 30 phút một
const TIMES = timeOptions("08:00", "21:00");

export function NewFittingDialog({
  branches,
  products,
  defaultBranchId,
  defaultDate,
}: {
  branches: { id: string; name: string }[];
  products: PickerProduct[];
  defaultBranchId: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<BookingSource>("facebook");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([{ key: 1, productId: null, size: "" }]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Đặt lịch thử
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await createFitting({
                branchId,
                date,
                time,
                customer: { full_name: name, phone },
                items: rows.filter((r) => r.productId).map((r) => ({ productId: r.productId!, size: r.size })),
                note,
                source,
              });
              if (!result.ok) return void toast.error(result.error);
              toast.success("Đã đặt lịch thử");
              setOpen(false);
              setPhone("");
              setName("");
              setNote("");
              setRows([{ key: 1, productId: null, size: "" }]);
              router.replace(`/admin/thu-do?date=${date}`, { scroll: false });
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Đặt lịch thử đồ</DialogTitle>
            <DialogDescription>Nhân viên được đặt ngoài khung giờ hoặc khi đã kín phòng thử.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Số điện thoại" htmlFor="f-phone">
              <Input id="f-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </Field>
            <Field label="Tên khách" htmlFor="f-name">
              <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Cơ sở" htmlFor="f-branch" className="col-span-2">
              <Select value={branchId} onValueChange={setBranchId} disabled={branches.length < 2}>
                <SelectTrigger id="f-branch" className="w-full">
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
            <Field label="Ngày" htmlFor="f-date">
              <DatePicker id="f-date" value={date} onChange={setDate} />
            </Field>
            <Field label="Giờ" htmlFor="f-time">
              <TimeSelect id="f-time" value={time} onChange={setTime} options={TIMES} />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Váy muốn thử</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setRows((r) => [...r, { key: r.reduce((m, x) => Math.max(m, x.key), 0) + 1, productId: null, size: "" }])
                }
              >
                <Plus />
                Thêm
              </Button>
            </div>
            {rows.map((row) => {
              const product = products.find((p) => p.id === row.productId);
              return (
                <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2">
                  <ProductPicker
                    products={products}
                    value={row.productId}
                    onChange={(productId) => {
                      const sizes = products.find((p) => p.id === productId)?.sizes ?? [];
                      update(row.key, { productId, size: sizes.length === 1 ? sizes[0] : "" });
                    }}
                  />
                  <Select value={row.size} onValueChange={(size) => update(row.key, { size })} disabled={!product}>
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
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Khách hẹn qua" htmlFor="f-source">
              <Select value={source} onValueChange={(v) => setSource(v as BookingSource)}>
                <SelectTrigger id="f-source" className="w-full">
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
            <Field label="Ghi chú" htmlFor="f-note" className="col-span-2">
              <Textarea id="f-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang đặt…" : "Đặt lịch thử"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
