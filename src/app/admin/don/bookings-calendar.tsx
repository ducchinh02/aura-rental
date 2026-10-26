"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { vi } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { dateToIso, isoToDate } from "@/components/admin/date-picker";
import { BookingStatusBadge } from "@/components/admin/status";
import { formatPeriod, formatTime, periodLength } from "@/lib/dates";
import { bookingStatusTone, toneClass, type BookingStatus } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type CalendarBooking = {
  code: string;
  status: BookingStatus;
  customerName: string;
  pickupDate: string;
  returnDate: string;
  unit: "day" | "hour";
  pickupAt: string | null;
  returnAt: string | null;
  dresses: string;
};

/** Lịch tháng các đơn: chip đặc = ngày khách nhận váy, chip viền = ngày khách trả */
export function BookingsCalendar({ bookings, month, today }: { bookings: CalendarBooking[]; month: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(month === today.slice(0, 7) ? today : `${month}-01`);

  const changeMonth = (date: Date) => {
    const params = new URLSearchParams(searchParams);
    params.set("month", format(date, "yyyy-MM"));
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  };

  const active = bookings.filter((b) => b.pickupDate <= selected && b.returnDate >= selected);

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", pending && "opacity-60")}>
      <Calendar
        mode="single"
        locale={vi}
        required
        today={isoToDate(today)}
        month={isoToDate(`${month}-01`)}
        onMonthChange={changeMonth}
        selected={isoToDate(selected)}
        onSelect={(d) => d && setSelected(dateToIso(d))}
        className="w-full p-0"
        classNames={{
          root: "w-full",
          months: "relative flex w-full flex-col",
          month: "flex w-full flex-col gap-3",
          month_caption: "flex h-9 items-center justify-center text-sm font-semibold capitalize",
          weekdays: "grid grid-cols-7 border-b pb-2",
          weekday: "text-xs font-medium text-muted-foreground",
          week: "grid grid-cols-7 border-b last:border-b-0",
          day: "relative h-24 p-0 sm:h-28",
          outside: "opacity-45",
          today: "",
        }}
        components={{
          DayButton: ({ day, modifiers, className, ...props }) => {
            const iso = dateToIso(day.date);
            const starts = bookings.filter((b) => b.pickupDate === iso);
            const ends = bookings.filter((b) => b.returnDate === iso && b.pickupDate !== iso);
            const chips = [...starts.map((b) => ({ b, end: false })), ...ends.map((b) => ({ b, end: true }))];
            return (
              <button
                {...props}
                className={cn(
                  className,
                  "flex size-full flex-col items-stretch gap-1 rounded-md p-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
                  modifiers.selected && "bg-primary/5 ring-1 ring-primary/40 hover:bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs tabular",
                    modifiers.today && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {day.date.getDate()}
                </span>
                {chips.slice(0, 2).map(({ b, end }) => (
                  <span
                    key={`${b.code}-${end}`}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-[0.6875rem] leading-tight font-medium",
                      end ? "border border-dashed border-current bg-transparent" : "",
                      toneClass[bookingStatusTone[b.status]].badge,
                    )}
                  >
                    {end ? "↩ " : ""}
                    {b.unit === "hour" && b.pickupAt ? `${formatTime(b.pickupAt)} ` : ""}
                    {b.customerName}
                  </span>
                ))}
                {chips.length > 2 && <span className="px-1 text-[0.6875rem] text-muted-foreground">+{chips.length - 2} đơn</span>}
              </button>
            );
          },
        }}
      />

      <div className="rounded-lg border">
        <p className="border-b px-4 py-2.5 text-sm font-medium first-letter:uppercase">
          {format(isoToDate(selected)!, "EEEE, dd/MM/yyyy", { locale: vi })}
          <span className="ml-2 font-normal text-muted-foreground">{active.length} đơn có váy đang ở ngoài</span>
        </p>
        {active.length ? (
          <ul className="divide-y">
            {active.map((b) => (
              <li key={b.code}>
                <Link href={`/admin/don/${b.code}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <CustomerAvatar name={b.customerName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="truncate font-medium">{b.customerName}</span>
                      <CodeBadge>{b.code}</CodeBadge>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatPeriod(b)}, {b.dresses}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {b.unit === "hour" ? `Thuê ${periodLength(b)}` : b.pickupDate === selected ? "Nhận váy" : b.returnDate === selected ? "Trả váy" : "Đang thuê"}
                  </span>
                  <BookingStatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Ngày này không có đơn nào.</p>
        )}
      </div>
    </div>
  );
}
