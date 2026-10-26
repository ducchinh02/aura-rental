"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/admin/date-picker";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { VIEW_LABEL, type ScheduleView } from "./schedule-data";

function shift(date: string, view: ScheduleView, dir: 1 | -1) {
  if (view === "day") return addDays(date, dir);
  if (view === "week") return addDays(date, 7 * dir);
  if (view === "2weeks") return addDays(date, 14 * dir);
  const [y, m] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + dir, 1));
  return next.toISOString().slice(0, 10);
}

/** Chọn chế độ xem, lùi / tới, nhảy ngày, tìm váy. Mọi lựa chọn nằm trên URL */
export function ScheduleToolbar({ view, date, today, q }: { view: ScheduleView; date: string; today: string; q: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(q);

  const go = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`/admin/lich?${params}`, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <Tabs value={view} onValueChange={(v) => go({ view: v === "day" ? "" : v })}>
        <TabsList>
          {(Object.keys(VIEW_LABEL) as ScheduleView[]).map((v) => (
            <TabsTrigger key={v} value={v} className="flex-none px-3">
              {VIEW_LABEL[v]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ButtonGroup>
        <Button variant="outline" size="icon" aria-label="Lùi" onClick={() => go({ date: shift(date, view, -1) })}>
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          onClick={() => go({ date: "" })}
          className={cn(date === today && "text-primary")}
        >
          <CalendarDays />
          Hôm nay
        </Button>
        <Button variant="outline" size="icon" aria-label="Tới" onClick={() => go({ date: shift(date, view, 1) })}>
          <ChevronRight />
        </Button>
      </ButtonGroup>
      <DatePicker value={date} onChange={(iso) => go({ date: iso === today ? "" : iso })} aria-label="Chọn ngày" />
      <form
        className="w-full sm:ml-auto sm:w-60"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: query.trim() });
        }}
      >
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mẫu hoặc mã váy"
            aria-label="Tìm váy"
          />
        </InputGroup>
      </form>
    </div>
  );
}
