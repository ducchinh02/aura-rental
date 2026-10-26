"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/admin/date-picker";
import { Field } from "@/components/admin/field";
import { slugify } from "@/lib/format";
import type { TransferStatus } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { createTransfer, setTransferStatus } from "./actions";

export function TransferAction({
  transferId,
  status,
  label,
  variant = "default",
}: {
  transferId: string;
  status: TransferStatus;
  label: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setTransferStatus(transferId, status);
          if (!result.ok) return void toast.error(result.error);
          toast.success(label);
        })
      }
    >
      {label}
    </Button>
  );
}

type ItemOption = { id: string; code: string; size: string; productName: string; location: string };

export function NewTransferDialog({
  items,
  branches,
  defaultDate,
}: {
  items: ItemOption[];
  branches: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [toBranchId, setToBranchId] = useState(branches[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const item = items.find((i) => i.id === itemId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus />
          Chuyển váy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!itemId) return void toast.error("Chọn chiếc váy cần chuyển");
            startTransition(async () => {
              const result = await createTransfer({ itemId, toBranchId, dueDate, note });
              if (!result.ok) return void toast.error(result.error);
              toast.success("Đã tạo phiếu chuyển");
              setOpen(false);
              setItemId(null);
              setNote("");
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Chuyển váy giữa cơ sở</DialogTitle>
            <DialogDescription>
              Dùng khi cần mang váy sang cơ sở kia ngoài đơn thuê, ví dụ cho khách thử. Kho gốc không đổi.
            </DialogDescription>
          </DialogHeader>
          <Field label="Chiếc váy" htmlFor="t-item">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="t-item"
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className={cn("truncate", !item && "text-muted-foreground")}>
                    {item ? `${item.code}, ${item.productName}` : "Tìm theo mã hoặc tên váy"}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="Mã hoặc tên váy…" />
                  <CommandList>
                    <CommandEmpty>Không tìm thấy váy.</CommandEmpty>
                    <CommandGroup>
                      {items.map((i) => (
                        <CommandItem
                          key={i.id}
                          value={`${i.code} ${i.productName} ${i.id}`}
                          keywords={[slugify(i.productName).replace(/-/g, " ")]}
                          onSelect={() => {
                            setItemId(i.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check className={cn(itemId === i.id ? "opacity-100" : "opacity-0")} />
                          <span className="font-medium tabular">{i.code}</span>
                          <span className="truncate text-muted-foreground">{i.productName}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{i.location}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Chuyển tới" htmlFor="t-to">
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger id="t-to" className="w-full">
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
            <Field label="Cần có váy trước ngày" htmlFor="t-due">
              <DatePicker id="t-due" value={dueDate} onChange={setDueDate} className="w-full" />
            </Field>
          </div>
          <Field label="Ghi chú" htmlFor="t-note">
            <Input id="t-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: khách hẹn thử 10h" />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo…" : "Tạo phiếu chuyển"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
