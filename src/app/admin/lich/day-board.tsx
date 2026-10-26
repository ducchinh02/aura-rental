"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CodeBadge } from "@/components/admin/code-badge";
import { DressThumb } from "@/components/admin/dress-thumb";
import { EmptyBlock } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status";
import { formatPeriod } from "@/lib/dates";
import { toneClass } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  DAY_STATE_ORDER,
  dayStateMeta,
  itemStateOn,
  type DayState,
  type ScheduleBooking,
  type ScheduleProduct,
} from "./schedule-data";

/** Chế độ Ngày: mỗi chiếc váy đang ở đâu, làm gì trong ngày được chọn */
export function DayBoard({
  products,
  bookings,
  day,
  today,
  now,
}: {
  products: ScheduleProduct[];
  bookings: ScheduleBooking[];
  day: string;
  today: string;
  now: string;
}) {
  const [filter, setFilter] = useState<DayState | "all">("all");

  const rows = useMemo(
    () =>
      products.map((p) => ({
        product: p,
        items: p.items.map((item) => ({ item, ...itemStateOn(item, bookings, day, today, now) })),
      })),
    [products, bookings, day, today, now],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(DAY_STATE_ORDER.map((s) => [s, 0])) as Record<DayState, number>;
    for (const r of rows) for (const i of r.items) c[i.state] += 1;
    return c;
  }, [rows]);
  const total = rows.reduce((s, r) => s + r.items.length, 0);

  const visible = rows
    .map((r) => ({ ...r, items: filter === "all" ? r.items : r.items.filter((i) => i.state === filter) }))
    .filter((r) => r.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={filter}
        onValueChange={(v) => setFilter((v || "all") as DayState | "all")}
        className="flex-wrap justify-start"
      >
        <ToggleGroupItem value="all" className="gap-2 px-3">
          Tất cả
          <span className="text-xs text-muted-foreground tabular">{total}</span>
        </ToggleGroupItem>
        {DAY_STATE_ORDER.filter((s) => counts[s] > 0 || s === "ready").map((s) => (
          <ToggleGroupItem key={s} value={s} className="gap-2 px-3">
            <span className={cn("size-2 rounded-full", toneClass[dayStateMeta[s].tone].dot)} />
            {dayStateMeta[s].label}
            <span className="text-xs text-muted-foreground tabular">{counts[s]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {visible.length === 0 ? (
        <EmptyBlock icon={Shirt} title="Không có chiếc váy nào ở trạng thái này" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map(({ product, items }) => {
            const ready = rows.find((r) => r.product.id === product.id)!.items.filter((i) => i.state === "ready").length;
            return (
              <Card key={product.id} size="sm" className="gap-3">
                <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
                  <DressThumb {...product} className="row-span-2 w-10 rounded-md" />
                  <CardTitle className="truncate">
                    <Link href={`/admin/vay/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    <span className={cn("font-medium", ready ? "text-emerald-700" : "text-red-600")}>{ready}</span>/
                    {product.items.length} chiếc sẵn sàng
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  {items.map(({ item, state, booking }) => (
                    <div key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                        {item.size}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <CodeBadge>{item.code}</CodeBadge>
                          {item.location && <span className="text-xs text-muted-foreground">{item.location}</span>}
                        </p>
                        {booking && (
                          <Link
                            href={`/admin/don/${booking.code}`}
                            className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-foreground"
                          >
                            {booking.customer}, {formatPeriod({ unit: booking.unit, pickupDate: booking.pickup, returnDate: booking.ret, pickupAt: booking.pickupAt, returnAt: booking.returnAt })}
                            {booking.branch !== item.homeCode && `, thuê tại ${booking.branch}`}
                          </Link>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <StatusBadge tone={dayStateMeta[state].tone}>{dayStateMeta[state].label}</StatusBadge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{dayStateMeta[state].hint}</TooltipContent>
                      </Tooltip>
                      {state === "ready" && day >= today && (
                        <Button asChild variant="ghost" size="icon-sm" aria-label={`Tạo đơn cho ${item.code}`}>
                          <Link href={`/admin/don/moi?item=${item.id}&date=${day}`}>
                            <Plus />
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
