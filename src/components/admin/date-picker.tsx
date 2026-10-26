"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { DateRange, Matcher } from "react-day-picker";
import { vi } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { todayVN } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Ngày trong app là chuỗi "YYYY-MM-DD"; Calendar làm việc với Date giờ địa phương
export function isoToDate(iso: string | null | undefined) {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToIso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const label = (iso: string) => format(isoToDate(iso)!, "EEEEEE, dd/MM/yyyy", { locale: vi });

// Ô ngày 40px để dễ bấm và đọc trong popover (mặc định của Calendar chỉ 28px)
const pickerClass = "p-3 [--cell-size:--spacing(10)]";

type DatePickerProps = {
  id?: string;
  value: string | null;
  onChange: (iso: string) => void;
  placeholder?: string;
  disabled?: Matcher | Matcher[];
  className?: string;
  "aria-label"?: string;
};

export function DatePicker({ id, value, onChange, placeholder = "Chọn ngày", disabled, className, ...rest }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={rest["aria-label"]}
          className={cn("justify-start font-normal tabular", !value && "text-muted-foreground", className)}
        >
          <CalendarDays className="text-muted-foreground" />
          {value ? label(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={vi}
          today={isoToDate(todayVN())}
          className={pickerClass}
          selected={isoToDate(value)}
          defaultMonth={isoToDate(value)}
          disabled={disabled}
          onSelect={(date) => {
            if (!date) return;
            onChange(dateToIso(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type RangeProps = {
  id?: string;
  from: string | null;
  to: string | null;
  onChange: (from: string, to: string) => void;
  disabled?: Matcher | Matcher[];
  className?: string;
};

/** Chọn ngày nhận → ngày trả trên 2 tháng liền nhau */
export function DateRangePicker({ id, from, to, onChange, disabled, className }: RangeProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const selected = draft ?? { from: isoToDate(from), to: isoToDate(to) };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("w-full justify-start font-normal tabular", !from && "text-muted-foreground", className)}
        >
          <CalendarDays className="text-muted-foreground" />
          {from && to ? `${label(from)} → ${label(to)}` : "Chọn ngày nhận và ngày trả"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          locale={vi}
          today={isoToDate(todayVN())}
          className={pickerClass}
          numberOfMonths={isMobile ? 1 : 2}
          // Hai tháng cạnh nhau: ẩn ngày của tháng bên cạnh để một ngày không hiện hai lần
          showOutsideDays={false}
          defaultMonth={isoToDate(from)}
          selected={selected}
          disabled={disabled}
          // Lần bấm đầu luôn là ngày nhận mới, lần sau là ngày trả (bấm trước ngày nhận thì đổi ngày nhận)
          onSelect={(_, day) => {
            if (!draft?.from || day < draft.from) {
              setDraft({ from: day, to: undefined });
              return;
            }
            onChange(dateToIso(draft.from), dateToIso(day));
            setDraft(undefined);
            setOpen(false);
          }}
        />
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {draft?.from && !draft.to ? "Chọn tiếp ngày trả" : "Bấm ngày nhận, rồi bấm ngày trả"}
        </p>
      </PopoverContent>
    </Popover>
  );
}
