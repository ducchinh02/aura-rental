"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DressThumb } from "@/components/admin/dress-thumb";
import { EmptyBlock } from "@/components/admin/page-header";
import { formatMoney } from "@/lib/format";

export type CatalogItem = {
  slug: string;
  name: string;
  color: string | null;
  category: string | null;
  image: string | null;
  sizes: string[];
  fromPrice: number;
  rentalDays: number;
  hourlyFrom: number | null;
  hourlyHours: number;
  noDeposit: boolean;
};

const HOURLY = "__hourly";

export function CatalogGrid({ items }: { items: CatalogItem[] }) {
  const [filter, setFilter] = useState("all");
  const categories = [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))];
  const visible = items.filter((i) =>
    filter === "all" ? true : filter === HOURLY ? i.hourlyFrom != null : i.category === filter,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Váy đang cho thuê</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          value={filter}
          onValueChange={(v) => setFilter(v || "all")}
          className="flex-wrap justify-start"
          aria-label="Lọc váy"
        >
          <ToggleGroupItem value="all" className="px-3">
            Tất cả
          </ToggleGroupItem>
          {categories.map((c) => (
            <ToggleGroupItem key={c} value={c} className="px-3">
              {c}
            </ToggleGroupItem>
          ))}
          {items.some((i) => i.hourlyFrom != null) && (
            <ToggleGroupItem value={HOURLY} className="px-3">
              <Clock />
              Thuê theo giờ
            </ToggleGroupItem>
          )}
        </ToggleGroup>
      </div>

      {visible.length === 0 ? (
        <EmptyBlock icon={Clock} title="Chưa có váy nào trong mục này" />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <li key={item.slug}>
              <Link href={`/vay/${item.slug}`} className="group flex flex-col gap-3">
                <div className="overflow-hidden rounded-xl bg-muted">
                  <DressThumb
                    name={item.name}
                    image={item.image}
                    color={item.color}
                    category={item.category}
                    className="w-full rounded-none transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div>
                  <p className="font-medium group-hover:underline">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[item.category, item.color].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-1 text-sm tabular">
                    <span className="font-semibold">{formatMoney(item.fromPrice)}</span>
                    <span className="text-muted-foreground"> / {item.rentalDays} ngày</span>
                  </p>
                  {item.hourlyFrom != null && (
                    <p className="text-sm text-muted-foreground tabular">
                      hoặc {formatMoney(item.hourlyFrom)} / {item.hourlyHours} giờ
                    </p>
                  )}
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {item.sizes.map((s) => (
                      <span key={s} className="rounded border px-1.5 text-xs text-muted-foreground">
                        {s}
                      </span>
                    ))}
                    {item.noDeposit && (
                      <span className="rounded bg-emerald-50 px-1.5 text-xs font-medium text-emerald-700">Không cần cọc</span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
