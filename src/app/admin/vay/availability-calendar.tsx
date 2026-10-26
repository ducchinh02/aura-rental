"use client";

import { vi } from "react-day-picker/locale";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { dateToIso, isoToDate } from "@/components/admin/date-picker";
import { cn } from "@/lib/utils";

/** Lịch còn trống của một mẫu: số chiếc rảnh mỗi ngày trên tổng số chiếc */
export function AvailabilityCalendar({ busy, total, today }: { busy: Record<string, number>; total: number; today: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Calendar
        mode="single"
        locale={vi}
        numberOfMonths={2}
        showOutsideDays={false}
        today={isoToDate(today)}
        defaultMonth={isoToDate(today)}
        disabled={{ before: isoToDate(today)! }}
        className="mx-auto p-0 [--cell-size:--spacing(9)]"
        components={{
          DayButton: ({ children, ...props }) => {
            const used = busy[dateToIso(props.day.date)] ?? 0;
            const free = Math.max(0, total - used);
            return (
              <CalendarDayButton
                {...props}
                locale={vi}
                className={cn(
                  used > 0 && free === 0 && "bg-red-50 text-red-700 hover:bg-red-100",
                  used > 0 && free > 0 && "bg-amber-50 text-amber-800 hover:bg-amber-100",
                )}
              >
                {children}
                {used > 0 && <span className="text-[0.5625rem] leading-none tabular">{free}/{total}</span>}
              </CalendarDayButton>
            );
          },
        }}
      />
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-amber-50 ring-1 ring-amber-200" />
          Còn một số chiếc (rảnh/tổng)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-red-50 ring-1 ring-red-200" />
          Hết chiếc
        </span>
      </div>
    </div>
  );
}
