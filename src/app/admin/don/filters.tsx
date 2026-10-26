"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, List, Search } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type StatusTab = { value: string; label: string; count: number };

/** Tab trạng thái + ô tìm + đổi kiểu xem; mọi lựa chọn nằm trên URL */
export function BookingsToolbar({ tabs, status, view }: { tabs: StatusTab[]; status: string; view: "list" | "calendar" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  // Tìm sau khi ngừng gõ một chút
  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return;
    const timer = setTimeout(() => update({ q: q.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", pending && "opacity-60")}>
      {view === "list" && (
        <ScrollArea className="-mx-1 px-1">
          <Tabs value={status} onValueChange={(value) => update({ status: value === "open" ? "" : value })}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="flex-none">
                  {t.label}
                  <span className="rounded bg-muted-foreground/10 px-1.5 text-[0.6875rem] tabular">{t.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      <div className="flex gap-2">
        <InputGroup className="max-w-md flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mã đơn, SĐT hoặc tên khách"
            aria-label="Tìm đơn"
          />
        </InputGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && update({ view: v === "list" ? "" : v })}
          className="ml-auto"
        >
          <ToggleGroupItem value="list" aria-label="Xem dạng danh sách" className="px-3">
            <List />
            <span className="hidden sm:inline">Danh sách</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar" aria-label="Xem dạng lịch" className="px-3">
            <CalendarDays />
            <span className="hidden sm:inline">Lịch</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
