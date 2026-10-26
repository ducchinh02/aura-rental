"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatPhone } from "@/lib/format";
import { bookingSourceLabel, type BookingSource } from "@/lib/labels";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  blacklisted: boolean;
  rentals: number;
  spent: number;
  lastRental: string | null;
  source: BookingSource | null;
};

const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: "name",
    header: "Khách",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <CustomerAvatar name={row.original.name} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{row.original.name}</span>
            {row.original.blacklisted && <StatusBadge tone="red">Danh sách đen</StatusBadge>}
            {row.original.rentals >= 3 && !row.original.blacklisted && <StatusBadge tone="violet">Khách quen</StatusBadge>}
          </p>
          <p className="text-xs text-muted-foreground tabular">{formatPhone(row.original.phone)}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "source",
    header: "Biết shop qua",
    cell: ({ row }) => (row.original.source ? bookingSourceLabel[row.original.source] : "—"),
    meta: { className: "text-muted-foreground" },
  },
  { accessorKey: "rentals", header: "Số đơn", meta: { className: "text-right tabular" } },
  {
    accessorKey: "spent",
    header: "Tổng chi",
    meta: { className: "text-right" },
    cell: ({ row }) => <span className="font-medium tabular">{formatMoney(row.original.spent)}</span>,
  },
  {
    accessorKey: "lastRental",
    header: "Lần thuê gần nhất",
    cell: ({ row }) => (row.original.lastRental ? formatDate(row.original.lastRental) : "—"),
    meta: { className: "tabular text-muted-foreground" },
  },
];

export function CustomersTable({ rows, empty }: { rows: CustomerRow[]; empty: string }) {
  return <DataTable columns={columns} data={rows} rowHref={(r) => `/admin/khach/${r.id}`} empty={empty} />;
}
