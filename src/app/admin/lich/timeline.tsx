"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DressThumb } from "@/components/admin/dress-thumb";
import { BookingStatusBadge, StatusBadge } from "@/components/admin/status";
import { diffDays, formatDay, formatTime, isWeekend, periodLength, weekday } from "@/lib/dates";
import { bookingStatusTone, toneClass } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { daysFrom, effectiveEnd, type ScheduleBooking, type ScheduleProduct } from "./schedule-data";

type Props = {
  products: ScheduleProduct[];
  bookings: ScheduleBooking[];
  from: string;
  days: number;
  today: string;
};

/**
 * Dòng thời gian một lưới CSS duy nhất:
 *   cột 1 = tên váy (dính trái), cột 2.. = từng ngày; hàng 1 = ngày (dính trên).
 * Thứ tự lớp: ô nền < thanh đơn (z-10) < cột tên (z-20) < hàng ngày (z-30) < góc (z-40).
 */
export function Timeline({ products, bookings, from, days, today }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dates = daysFrom(from, days);
  const to = dates[dates.length - 1];
  const narrow = days > 14;

  // Cột trong lưới: ngày đầu là cột 2; cắt ở mép khoảng đang xem
  const col = (iso: string) => Math.min(Math.max(diffDays(from, iso), 0), days - 1) + 2;
  const byItem = new Map<string, ScheduleBooking[]>();
  for (const b of bookings) byItem.set(b.itemId, [...(byItem.get(b.itemId) ?? []), b]);

  const busyOn = (itemId: string, day: string) =>
    (byItem.get(itemId) ?? []).some((b) => (b.blockFrom <= day && day <= b.blockTo) || (b.status === "picked_up" && b.ret < day && day <= today));

  let row = 2;
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className="relative max-h-[calc(100dvh-17rem)] overflow-auto overscroll-x-contain border-t [--label:10rem] md:[--label:15rem]"
      role="grid"
      aria-label="Lịch váy theo ngày"
    >
      <div
        className="grid w-full min-w-max"
        style={{
          gridTemplateColumns: `var(--label) repeat(${days}, minmax(${narrow ? "2.25rem" : "3rem"}, 1fr))`,
        }}
      >
        {/* Hàng ngày */}
        <div className="sticky top-0 left-0 z-40 flex items-end border-r border-b bg-card px-4 pb-2 text-xs font-medium text-muted-foreground">
          {products.reduce((s, p) => s + p.items.length, 0)} chiếc váy
        </div>
        {dates.map((d) => (
          <div
            key={d}
            className={cn(
              "sticky top-0 z-30 flex flex-col items-center gap-0.5 border-b bg-card py-2",
              isWeekend(d) && "bg-muted",
              d === today && "bg-brand-soft",
            )}
          >
            <span className="text-[0.625rem] text-muted-foreground">{weekday(d)}</span>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-medium tabular",
                d === today && "bg-primary text-primary-foreground",
              )}
            >
              {Number(d.slice(8))}
            </span>
          </div>
        ))}

        {products.map((product) => {
          const open = !collapsed.has(product.id);
          const active = product.items.filter((i) => i.status === "active");
          const groupRow = row++;
          return (
            <Fragment key={product.id}>
              {/* Hàng mẫu váy: số chiếc còn trống từng ngày */}
              <button
                type="button"
                onClick={() => toggle(product.id)}
                aria-expanded={open}
                style={{ gridRow: groupRow, gridColumn: 1 }}
                className="sticky left-0 z-20 flex min-h-12 items-center gap-2.5 border-t border-r bg-card px-3 text-left hover:bg-muted/60"
              >
                {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                <DressThumb {...product} className="w-7 rounded-md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{product.name}</span>
                  <span className="block text-xs text-muted-foreground">{product.items.length} chiếc</span>
                </span>
              </button>
              {dates.map((d, i) => {
                const free = active.filter((item) => !busyOn(item.id, d)).length;
                const tone = free === 0 ? "red" : free < active.length ? "amber" : "emerald";
                return (
                  <div
                    key={d}
                    style={{ gridRow: groupRow, gridColumn: i + 2 }}
                    className={cn(
                      "flex items-center justify-center border-t px-0.5",
                      isWeekend(d) && "bg-muted/50",
                      d === today && "bg-brand-soft/60",
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "flex h-6 w-full max-w-10 items-center justify-center rounded-md text-[0.6875rem] font-semibold tabular",
                            toneClass[tone].badge,
                          )}
                        >
                          {free}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDay(d)}: {free}/{active.length} chiếc trống
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}

              {open &&
                product.items.map((item) => {
                  const r = row++;
                  const mine = byItem.get(item.id) ?? [];
                  return (
                    <Fragment key={item.id}>
                      <div
                        style={{ gridRow: r, gridColumn: 1 }}
                        className="sticky left-0 z-20 flex min-h-11 items-center gap-2 border-r bg-card pr-3 pl-12"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[0.6875rem] font-semibold">
                          {item.size}
                        </span>
                        <CodeBadge className="truncate">{item.code}</CodeBadge>
                        {item.status === "maintenance" && <StatusBadge tone="amber">Bảo trì</StatusBadge>}
                      </div>
                      {dates.map((d, i) => {
                        const canBook = d >= today && item.status === "active" && !busyOn(item.id, d);
                        const cellClass = cn(
                          "border-t border-l border-border/50",
                          isWeekend(d) && "bg-muted/40",
                          d === today && "bg-brand-soft/50",
                          item.status === "maintenance" &&
                            "bg-[repeating-linear-gradient(135deg,var(--color-amber-100)_0_2px,transparent_2px_7px)]",
                        );
                        return canBook ? (
                          <Link
                            key={d}
                            href={`/admin/don/moi?item=${item.id}&date=${d}`}
                            aria-label={`Tạo đơn ${item.code} ngày ${d}`}
                            style={{ gridRow: r, gridColumn: i + 2 }}
                            className={cn(cellClass, "hover:bg-primary/10")}
                          />
                        ) : (
                          <div key={d} style={{ gridRow: r, gridColumn: i + 2 }} className={cellClass} />
                        );
                      })}

                      {mine.map((b) => {
                        const end = effectiveEnd(b, today);
                        const overdue = end !== b.ret;
                        const showBuffer = b.blockFrom <= to && b.blockTo >= from;
                        const showRental = b.pickup <= to && end >= from;
                        const span = Math.min(diffDays(b.pickup < from ? from : b.pickup, end > to ? to : end) + 1, days);
                        return (
                          <Fragment key={b.id}>
                            {showBuffer && (
                              <span
                                aria-hidden
                                style={{ gridRow: r, gridColumn: `${col(b.blockFrom)} / ${col(b.blockTo) + 1}` }}
                                className="pointer-events-none z-10 mx-0.5 my-2 rounded-md border border-dashed border-zinc-300 bg-[repeating-linear-gradient(135deg,var(--color-zinc-200)_0_1px,transparent_1px_6px)]"
                              />
                            )}
                            {showRental && (
                              <HoverCard openDelay={120} closeDelay={60}>
                                <HoverCardTrigger asChild>
                                  <Link
                                    href={`/admin/don/${b.code}`}
                                    style={{ gridRow: r, gridColumn: `${col(b.pickup)} / ${col(end) + 1}` }}
                                    className={cn(
                                      "z-10 mx-0.5 my-1.5 flex min-w-0 items-center gap-1 overflow-hidden rounded-md px-2 text-xs font-medium whitespace-nowrap text-white shadow-xs transition-[filter] hover:brightness-110",
                                      overdue ? "bg-red-500" : toneClass[bookingStatusTone[b.status]].bar,
                                      b.pickup < from && "rounded-l-none",
                                      end > to && "rounded-r-none",
                                    )}
                                  >
                                    {(!narrow || span >= 3) && (
                                      <span className="truncate">
                                        {b.unit === "hour" && b.pickupAt && b.returnAt && (
                                          <span className="mr-1 opacity-80 tabular">
                                            {formatTime(b.pickupAt)}–{formatTime(b.returnAt)}
                                          </span>
                                        )}
                                        {b.customer}
                                      </span>
                                    )}
                                  </Link>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-72" align="start">
                                  <div className="flex items-start gap-3">
                                    <CustomerAvatar name={b.customer} />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium">{b.customer}</p>
                                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                        <CodeBadge>{b.code}</CodeBadge>
                                        thuê tại {b.branch}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="mt-3 text-sm tabular">
                                    {b.unit === "hour" && b.pickupAt && b.returnAt
                                      ? `${formatDay(b.pickup)} ${formatTime(b.pickupAt)} → ${formatTime(b.returnAt)}`
                                      : `${formatDay(b.pickup)} → ${formatDay(b.ret)}`}
                                    <span className="text-muted-foreground">
                                      {" "}
                                      ({periodLength({ unit: b.unit, pickupDate: b.pickup, returnDate: b.ret, pickupAt: b.pickupAt, returnAt: b.returnAt })})
                                    </span>
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <BookingStatusBadge status={b.status} />
                                    {overdue && <StatusBadge tone="red">Quá hạn {diffDays(b.ret, today)} ngày</StatusBadge>}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
