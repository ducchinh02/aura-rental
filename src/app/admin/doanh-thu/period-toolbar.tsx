"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DateRangePicker } from "@/components/admin/date-picker";
import { cn } from "@/lib/utils";
import { PRESETS, type Preset } from "./presets";

/** Chọn kỳ báo cáo: mốc nhanh hoặc khoảng ngày tự chọn; lưu trên URL */
export function PeriodToolbar({ preset, from, to }: { preset: Preset | "custom"; from: string; to: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (query: string) => startTransition(() => router.replace(`/admin/doanh-thu?${query}`, { scroll: false }));

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <ToggleGroup
        type="single"
        variant="outline"
        value={preset === "custom" ? "" : preset}
        onValueChange={(v) => v && go(`period=${v}`)}
        className="flex-wrap"
      >
        {Object.entries(PRESETS).map(([key, label]) => (
          <ToggleGroupItem key={key} value={key} className="px-3">
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <DateRangePicker
        from={from}
        to={to}
        onChange={(f, t) => go(`from=${f}&to=${t}`)}
        className={cn("w-auto", preset === "custom" && "border-primary text-primary")}
      />
    </div>
  );
}
