"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Copy, Eye, MoreHorizontal, Phone, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DressStack, type Dress } from "@/components/admin/booking-row";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DataTable } from "@/components/admin/data-table";
import { BookingStatusBadge, PaymentBadge } from "@/components/admin/status";
import { formatPeriod, periodLength } from "@/lib/dates";
import { formatMoney, formatPhone } from "@/lib/format";
import type { BookingStatus } from "@/lib/labels";

export type BookingRow = {
  code: string;
  status: BookingStatus;
  /** Đơn chờ không cần cọc */
  noDeposit: boolean;
  customerName: string;
  phone: string;
  dresses: Dress[];
  pickupDate: string;
  returnDate: string;
  unit: "day" | "hour";
  pickupAt: string | null;
  returnAt: string | null;
  ship: boolean;
  branchCode: string;
  total: number;
  balance: number;
};

function columns(showBranch: boolean): ColumnDef<BookingRow>[] {
  const cols: ColumnDef<BookingRow>[] = [
    {
      accessorKey: "code",
      header: "Mã đơn",
      cell: ({ row }) => <CodeBadge>{row.original.code}</CodeBadge>,
    },
    {
      accessorKey: "customerName",
      header: "Khách",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <CustomerAvatar name={row.original.customerName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.customerName}</p>
            <p className="text-xs text-muted-foreground tabular">{formatPhone(row.original.phone)}</p>
          </div>
        </div>
      ),
    },
    {
      id: "dresses",
      header: "Váy",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex max-w-60 items-center gap-2.5">
          <DressStack dresses={row.original.dresses} />
          <span className="hidden truncate text-muted-foreground 2xl:inline">
            {row.original.dresses.map((d) => `${d.name} (${d.size})`).join(", ")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "pickupDate",
      header: "Thời gian",
      cell: ({ row }) => (
        <div className="tabular">
          <p>{formatPeriod(row.original)}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {row.original.unit === "hour" && <Clock className="size-3" aria-label="Thuê theo giờ" />}
            {periodLength(row.original)}
            {row.original.ship && <Truck className="size-3" aria-label="Giao tận nơi" />}
          </p>
        </div>
      ),
    },
  ];
  if (showBranch) {
    cols.push({ accessorKey: "branchCode", header: "Cơ sở", meta: { className: "text-muted-foreground" } });
  }
  cols.push(
    {
      accessorKey: "total",
      header: "Tổng",
      meta: { className: "text-right" },
      cell: ({ row }) => <span className="font-medium tabular">{formatMoney(row.original.total)}</span>,
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ row }) => <BookingStatusBadge status={row.original.status} noDeposit={row.original.noDeposit} />,
    },
    {
      id: "payment",
      header: "Thanh toán",
      enableSorting: false,
      cell: ({ row }) => <PaymentBadge total={row.original.total} balance={row.original.balance} status={row.original.status} />,
    },
    {
      id: "actions",
      enableSorting: false,
      meta: { className: "w-10" },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Thao tác với đơn ${row.original.code}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/don/${row.original.code}`}>
                <Eye />
                Xem đơn
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`tel:${row.original.phone}`}>
                <Phone />
                Gọi khách
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                navigator.clipboard.writeText(row.original.code);
                toast.success(`Đã chép mã ${row.original.code}`);
              }}
            >
              <Copy />
              Chép mã đơn
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  );
  return cols;
}

export function BookingsTable({ rows, showBranch, empty }: { rows: BookingRow[]; showBranch: boolean; empty: string }) {
  const cols = useMemo(() => columns(showBranch), [showBranch]);
  return <DataTable columns={cols} data={rows} rowHref={(r) => `/admin/don/${r.code}`} empty={empty} />;
}
