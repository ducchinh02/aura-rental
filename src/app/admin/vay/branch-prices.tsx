"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/admin/field";
import { MoneyInput } from "@/components/admin/money-input";
import { formatMoney } from "@/lib/format";
import { setBranchPrice, type BranchPriceInput } from "./actions";

type Row = { branchId: string; branchName: string } & BranchPriceInput;

type Base = { price: number; extraDay: number; hourly: number | null; extraHour: number };

export function BranchPrices({
  productId,
  rows,
  base,
  editable,
}: {
  productId: string;
  rows: Row[];
  base: Base;
  editable: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y">
      {rows.map((row) => (
        <BranchPriceRow key={row.branchId} productId={productId} row={row} base={base} editable={editable} />
      ))}
    </ul>
  );
}

const money = new Intl.NumberFormat("vi-VN");
// Ô để trống (0) = dùng giá chung
const orNull = (v: number) => (v > 0 ? v : null);

function BranchPriceRow({ productId, row, base, editable }: { productId: string; row: Row; base: Base; editable: boolean }) {
  const [v, setV] = useState({
    price: row.price ?? 0,
    extra_day_price: row.extra_day_price ?? 0,
    hourly_price: row.hourly_price ?? 0,
    extra_hour_price: row.extra_hour_price ?? 0,
  });
  const [pending, startTransition] = useTransition();
  const custom = [row.price, row.extra_day_price, row.hourly_price, row.extra_hour_price].some((x) => x !== null);
  const set = (key: keyof typeof v) => (value: number) => setV((cur) => ({ ...cur, [key]: value }));

  const save = (input: BranchPriceInput) =>
    startTransition(async () => {
      const result = await setBranchPrice(productId, row.branchId, input);
      if (!result.ok) return void toast.error(result.error);
      toast.success(Object.values(input).every((x) => x === null) ? `${row.branchName} dùng lại giá chung` : `Đã lưu giá ${row.branchName}`);
    });

  if (!editable) {
    return (
      <li className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-sm">
        <span>{row.branchName}</span>
        <span className="text-muted-foreground tabular">
          {formatMoney(row.price ?? base.price)} / gói ngày
          {base.hourly !== null && `, ${formatMoney(row.hourly_price ?? base.hourly)} / gói giờ`}
          {!custom && " (giá chung)"}
        </span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">{row.branchName}</span>
          <span className="text-muted-foreground"> {custom ? "đang dùng giá riêng" : "đang dùng giá chung"}</span>
        </p>
        <div className="flex gap-2">
          {custom && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setV({ price: 0, extra_day_price: 0, hourly_price: 0, extra_hour_price: 0 });
                save({ price: null, extra_day_price: null, hourly_price: null, extra_hour_price: null });
              }}
            >
              Dùng giá chung
            </Button>
          )}
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              save({
                price: orNull(v.price),
                extra_day_price: orNull(v.extra_day_price),
                hourly_price: orNull(v.hourly_price),
                extra_hour_price: orNull(v.extra_hour_price),
              })
            }
          >
            Lưu
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Gói ngày" htmlFor={`bp-day-${row.branchId}`}>
          <MoneyInput
            id={`bp-day-${row.branchId}`}
            placeholder={money.format(base.price)}
            value={v.price}
            onValueChange={set("price")}
          />
        </Field>
        <Field label="Mỗi ngày thêm" htmlFor={`bp-xday-${row.branchId}`}>
          <MoneyInput
            id={`bp-xday-${row.branchId}`}
            placeholder={money.format(base.extraDay)}
            value={v.extra_day_price}
            onValueChange={set("extra_day_price")}
          />
        </Field>
        {base.hourly !== null && (
          <>
            <Field label="Gói giờ" htmlFor={`bp-hour-${row.branchId}`}>
              <MoneyInput
                id={`bp-hour-${row.branchId}`}
                placeholder={money.format(base.hourly)}
                value={v.hourly_price}
                onValueChange={set("hourly_price")}
              />
            </Field>
            <Field label="Mỗi giờ thêm" htmlFor={`bp-xhour-${row.branchId}`}>
              <MoneyInput
                id={`bp-xhour-${row.branchId}`}
                placeholder={money.format(base.extraHour)}
                value={v.extra_hour_price}
                onValueChange={set("extra_hour_price")}
              />
            </Field>
          </>
        )}
      </div>
    </li>
  );
}
