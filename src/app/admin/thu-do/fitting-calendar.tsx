"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { vi } from "react-day-picker/locale";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { dateToIso, isoToDate } from "@/components/admin/date-picker";
import { cn } from "@/lib/utils";

/** Lịch chọn ngày xem lịch thử; số chấm = số khách hẹn ngày đó (tối đa 3) */
export function FittingCalendar({
  selected,
  today,
  counts,
  month,
}: {
  selected: string;
  today: string;
  counts: Record<string, number>;
  month: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const go = (params: Record<string, string>) =>
    startTransition(() => router.replace(`${pathname}?${new URLSearchParams(params)}`, { scroll: false }));

  return (
    <Calendar
      mode="single"
      locale={vi}
      required
      today={isoToDate(today)}
      selected={isoToDate(selected)}
      month={isoToDate(`${month}-01`)}
      onMonthChange={(d) => go({ date: selected, month: format(d, "yyyy-MM") })}
      onSelect={(d) => d && go({ date: dateToIso(d), month: format(d, "yyyy-MM") })}
      className={cn("w-full p-0 transition-opacity [--cell-size:--spacing(10)]", pending && "opacity-60")}
      classNames={{ root: "w-full" }}
      components={{
        DayButton: ({ children, ...props }) => {
          const n = counts[dateToIso(props.day.date)] ?? 0;
          return (
            <CalendarDayButton {...props} locale={vi}>
              {children}
              <span className="flex h-1 gap-0.5 opacity-100!">
                {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                  <span key={i} className="size-1 rounded-full bg-violet-500 group-data-[selected=true]/day:bg-white" />
                ))}
              </span>
            </CalendarDayButton>
          );
        },
      }}
    />
  );
}
