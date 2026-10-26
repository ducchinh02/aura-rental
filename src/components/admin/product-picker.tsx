"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DressThumb } from "@/components/admin/dress-thumb";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PickerProduct = {
  id: string;
  name: string;
  sizes: string[];
  status?: string;
  color?: string | null;
  category?: string | null;
  image?: string | null;
  hourly?: boolean;
};

type Props = {
  products: PickerProduct[];
  value: string | null;
  onChange: (productId: string) => void;
  id?: string;
  /** Lý do không chọn được mẫu (ví dụ không thuê theo giờ); null = chọn được */
  disabledReason?: (product: PickerProduct) => string | null;
};

export function ProductPicker({ products, value, onChange, id, disabledReason }: Props) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-card font-normal"
        >
          <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-muted-foreground")}>
            {selected && <DressThumb {...selected} className="w-5" />}
            <span className="truncate">{selected?.name ?? "Chọn mẫu váy"}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Tìm tên váy…" />
          <CommandList>
            <CommandEmpty>Không có mẫu nào khớp.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => {
                const reason = disabledReason?.(p) ?? null;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.id}`}
                    keywords={[slugify(p.name).replace(/-/g, " ")]}
                    disabled={!!reason}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                  >
                    <DressThumb {...p} className="w-7" />
                    <span className="truncate">{p.name}</span>
                    <Check className={cn("size-3.5", value === p.id ? "opacity-100" : "opacity-0")} />
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {reason ?? (p.status === "draft" ? "Nháp" : p.sizes.join(", ") || "Chưa có váy")}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
