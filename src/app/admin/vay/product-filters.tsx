"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Props = {
  tabs: { value: string; label: string; count: number }[];
  status: string;
  categories: { id: string; name: string }[];
  category: string;
  view: "grid" | "list";
  q: string;
};

export function ProductFilters({ tabs, status, categories, category, view, q }: Props) {
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
    startTransition(() => router.replace(`/admin/vay?${params}`, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", pending && "opacity-60")}>
      <Tabs value={status} onValueChange={(v) => go({ status: v === "current" ? "" : v })}>
        <TabsList className="max-w-full overflow-x-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-none">
              {t.label}
              <span className="rounded bg-muted-foreground/10 px-1.5 text-[0.6875rem] tabular">{t.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-2">
        <form
          className="min-w-48 flex-1 sm:max-w-sm"
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
              placeholder="Tìm tên mẫu váy"
              aria-label="Tìm mẫu váy"
            />
          </InputGroup>
        </form>
        <Select value={category || "all"} onValueChange={(v) => go({ category: v === "all" ? "" : v })}>
          <SelectTrigger aria-label="Danh mục" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả danh mục</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && go({ view: v === "grid" ? "" : v })}
          className="ml-auto"
        >
          <ToggleGroupItem value="grid" aria-label="Xem dạng lưới ảnh">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Xem dạng bảng">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
