"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { vi } from "react-day-picker/locale";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CodeBadge } from "./code-badge";
import { dateToIso, isoToDate } from "./date-picker";

export type AgendaKind = "pickup" | "return" | "fitting";

export type AgendaEvent = {
  date: string;
  kind: AgendaKind;
  title: string;
  code?: string;
  detail: string;
  href: string;
};

const KIND: Record<AgendaKind, { label: string; dot: string; text: string }> = {
  pickup: { label: "Giao váy", dot: "bg-emerald-500", text: "text-emerald-700" },
  return: { label: "Nhận lại", dot: "bg-sky-500", text: "text-sky-700" },
  fitting: { label: "Thử đồ", dot: "bg-violet-500", text: "text-violet-700" },
};

/** Lịch tháng: chấm màu ở ngày có giao / nhận / thử; bấm ngày để xem danh sách */
export function AgendaCalendar({ events, today, className }: { events: AgendaEvent[]; today: string; className?: string }) {
  const [selected, setSelected] = useState(today);
  const byDate = new Map<string, AgendaEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const dayEvents = byDate.get(selected) ?? [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Lịch giao nhận</CardTitle>
        <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.values(KIND).map((k) => (
            <span key={k.label} className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", k.dot)} />
              {k.label}
            </span>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          locale={vi}
          required
          today={isoToDate(today)}
          selected={isoToDate(selected)}
          onSelect={(d) => d && setSelected(dateToIso(d))}
          className="w-full p-0 [--cell-size:--spacing(9)]"
          classNames={{ root: "w-full" }}
          components={{
            DayButton: ({ children, ...props }) => {
              const kinds = [...new Set((byDate.get(dateToIso(props.day.date)) ?? []).map((e) => e.kind))];
              return (
                <CalendarDayButton {...props} locale={vi}>
                  {children}
                  <span className="flex h-1 gap-0.5 opacity-100!">
                    {kinds.map((k) => (
                      <span key={k} className={cn("size-1 rounded-full", KIND[k].dot)} />
                    ))}
                  </span>
                </CalendarDayButton>
              );
            },
          }}
        />
        <div className="border-t pt-3">
          <p className="mb-2 text-sm font-medium first-letter:uppercase">
            {format(isoToDate(selected)!, "EEEE, dd/MM", { locale: vi })}
          </p>
          {dayEvents.length ? (
            <ul className="flex flex-col gap-1">
              {dayEvents.map((e, i) => (
                <li key={i}>
                  <Link href={e.href} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", KIND[e.kind].dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="truncate font-medium">{e.title}</span>
                        {e.code && <CodeBadge>{e.code}</CodeBadge>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className={KIND[e.kind].text}>{KIND[e.kind].label}:</span> {e.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 text-sm text-muted-foreground">Không có lịch giao, nhận hay thử đồ.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
