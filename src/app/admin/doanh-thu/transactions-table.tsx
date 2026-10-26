"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/admin/code-badge";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { paymentKindLabel, paymentMethodLabel, type PaymentKind, type PaymentMethod, type Tone } from "@/lib/labels";

export type TransactionRow = {
  id: string;
  paidAt: string;
  code: string;
  customer: string;
  branch: string;
  kind: PaymentKind;
  method: PaymentMethod;
  recordedBy: string;
  note: string;
  amount: number;
};

const kindTone: Record<PaymentKind, Tone> = {
  payment: "emerald",
  refund: "red",
  security_hold: "zinc",
  security_return: "zinc",
};

/** Số tiền có dấu: tiền vào dương, tiền ra âm */
const signed = (r: TransactionRow) => (r.kind === "refund" || r.kind === "security_return" ? -r.amount : r.amount);

const columns: ColumnDef<TransactionRow>[] = [
  {
    accessorKey: "paidAt",
    header: "Thời gian",
    cell: ({ row }) => <span className="text-muted-foreground tabular">{formatDateTime(row.original.paidAt)}</span>,
  },
  {
    accessorKey: "code",
    header: "Đơn",
    cell: ({ row }) => (
      <Link href={`/admin/don/${row.original.code}`}>
        <CodeBadge className="hover:bg-muted-foreground/15">{row.original.code}</CodeBadge>
      </Link>
    ),
  },
  { accessorKey: "customer", header: "Khách" },
  { accessorKey: "branch", header: "Cơ sở", meta: { className: "text-muted-foreground" } },
  {
    accessorKey: "kind",
    header: "Loại",
    cell: ({ row }) => <StatusBadge tone={kindTone[row.original.kind]}>{paymentKindLabel[row.original.kind]}</StatusBadge>,
  },
  {
    accessorKey: "method",
    header: "Hình thức",
    cell: ({ row }) => paymentMethodLabel[row.original.method],
    meta: { className: "text-muted-foreground" },
  },
  { accessorKey: "recordedBy", header: "Người ghi", meta: { className: "text-muted-foreground" } },
  {
    id: "amount",
    accessorFn: signed,
    header: "Số tiền",
    meta: { className: "text-right" },
    cell: ({ row }) => {
      const value = signed(row.original);
      return (
        <span className={value < 0 ? "font-medium text-muted-foreground tabular" : "font-medium text-emerald-700 tabular"}>
          {value < 0 ? "−" : "+"}
          {formatMoney(Math.abs(value))}
        </span>
      );
    },
  },
];

function toCsv(rows: TransactionRow[]) {
  const header = ["Thời gian", "Mã đơn", "Khách", "Cơ sở", "Loại", "Hình thức", "Người ghi", "Ghi chú", "Số tiền"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [formatDateTime(r.paidAt), r.code, r.customer, r.branch, paymentKindLabel[r.kind], paymentMethodLabel[r.method], r.recordedBy, r.note, signed(r)]
      .map(esc)
      .join(","),
  );
  // BOM để Excel đọc đúng tiếng Việt
  return "﻿" + [header.map(esc).join(","), ...lines].join("\n");
}

export function ExportCsvButton({ rows, filename }: { rows: TransactionRow[]; filename: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!rows.length}
      onClick={() => {
        const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download />
      Xuất CSV
    </Button>
  );
}

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  return <DataTable columns={columns} data={rows} pageSize={15} empty="Không có khoản thu, hoàn nào trong kỳ này." />;
}
