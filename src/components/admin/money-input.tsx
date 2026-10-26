"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const grouping = new Intl.NumberFormat("vi-VN");

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
};

/** Ô nhập tiền VND, tự thêm dấu chấm hàng nghìn */
export function MoneyInput({ value, onValueChange, className, ...props }: Props) {
  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value ? grouping.format(value) : ""}
        onChange={(e) => onValueChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className={cn("tabular pr-8", className)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        ₫
      </span>
    </div>
  );
}
