"use client";

import { vi } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { addDays, diffDays } from "@/lib/dates";
import { isoToDate } from "./date-picker";

/**
 * Lịch xem (không chọn được): khoảng thuê tô màu chính,
 * các ngày váy bị khoá thêm (ship, chuyển cơ sở, giặt) gạch chéo.
 */
export function RentalCalendar({
  pickup,
  ret,
  blockedFrom,
  blockedTo,
  today,
}: {
  pickup: string;
  ret: string;
  blockedFrom?: string;
  blockedTo?: string;
  today: string;
}) {
  const buffer: Date[] = [];
  if (blockedFrom && blockedTo) {
    for (let i = 0; i <= diffDays(blockedFrom, blockedTo); i++) {
      const d = addDays(blockedFrom, i);
      if (d < pickup || d > ret) buffer.push(isoToDate(d)!);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Calendar
        mode="range"
        locale={vi}
        today={isoToDate(today)}
        defaultMonth={isoToDate(pickup)}
        selected={{ from: isoToDate(pickup), to: isoToDate(ret) }}
        modifiers={{ buffer }}
        modifiersClassNames={{
          buffer:
            "[&>button]:bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_5px)] [&>button]:text-muted-foreground",
        }}
        className="w-full p-0 [--cell-size:--spacing(8)]"
        classNames={{ root: "w-full" }}
      />
      {buffer.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-4 rounded-sm border bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_4px)]" />
          Ngày váy được giữ thêm để ship, chuyển cơ sở hoặc giặt
        </p>
      )}
    </div>
  );
}
