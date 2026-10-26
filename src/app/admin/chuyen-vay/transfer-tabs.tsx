"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function TransferTabs({ value, tabs }: { value: string; tabs: { value: string; label: string; count: number }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <Tabs
      value={value}
      onValueChange={(v) => startTransition(() => router.replace(v === "send" ? pathname : `${pathname}?tab=${v}`, { scroll: false }))}
      className={cn("transition-opacity", pending && "opacity-60")}
    >
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="flex-none">
            {t.label}
            <span className="rounded bg-muted-foreground/10 px-1.5 text-[0.6875rem] tabular">{t.count}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
