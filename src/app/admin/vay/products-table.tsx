"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table";
import { DressThumb } from "@/components/admin/dress-thumb";
import { StatusBadge } from "@/components/admin/status";
import { formatMoney } from "@/lib/format";
import { productStatusLabel, productStatusTone, type ProductStatus } from "@/lib/labels";

export type ProductRow = {
  id: string;
  name: string;
  status: ProductStatus;
  color: string | null;
  category: string | null;
  image: string | null;
  price: number;
  rentalDays: number;
  stock: { code: string; sizes: string[] }[];
  units: number;
  rentals: number;
};

const columns: ColumnDef<ProductRow>[] = [
  {
    accessorKey: "name",
    header: "Mẫu váy",
    cell: ({ row }) => (
      <Link href={`/admin/vay/${row.original.id}`} className="flex items-center gap-3">
        <DressThumb {...row.original} className="w-10 rounded-md" />
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.color ?? "Chưa ghi màu"}</p>
        </div>
      </Link>
    ),
  },
  { accessorKey: "category", header: "Danh mục", cell: ({ row }) => row.original.category ?? "—" },
  {
    accessorKey: "price",
    header: "Giá thuê",
    cell: ({ row }) => (
      <span className="tabular">
        <span className="font-medium">{formatMoney(row.original.price)}</span>
        <span className="text-muted-foreground"> / {row.original.rentalDays} ngày</span>
      </span>
    ),
  },
  {
    accessorKey: "units",
    header: "Số chiếc",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5 text-xs">
        {row.original.stock.map((s) => (
          <span key={s.code}>
            <span className="text-muted-foreground">{s.code}</span>{" "}
            <span className="font-medium">{s.sizes.join(" ") || "—"}</span>
          </span>
        ))}
      </div>
    ),
  },
  { accessorKey: "rentals", header: "Lượt thuê 90 ngày", meta: { className: "text-right tabular" } },
  {
    accessorKey: "status",
    header: "Hiển thị",
    cell: ({ row }) => (
      <StatusBadge tone={productStatusTone[row.original.status]}>{productStatusLabel[row.original.status]}</StatusBadge>
    ),
  },
];

export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  return <DataTable columns={columns} data={rows} rowHref={(r) => `/admin/vay/${r.id}`} />;
}
