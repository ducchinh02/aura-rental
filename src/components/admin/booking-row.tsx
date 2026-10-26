import Link from "next/link";
import { ChevronRight, Clock, Truck } from "lucide-react";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DressThumb } from "@/components/admin/dress-thumb";
import { formatTime } from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import type { BookingStatus } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type Dress = {
  name: string;
  size: string;
  code?: string;
  color: string | null;
  category: string | null;
  image: string | null;
};

export type BookingSummary = {
  code: string;
  status: BookingStatus;
  customerName: string;
  phone: string;
  dresses: Dress[];
  pickupDate: string;
  returnDate: string;
  unit: "day" | "hour";
  pickupAt: string | null;
  returnAt: string | null;
  ship: boolean;
  branchCode?: string;
  total: number;
  balance?: number;
  note?: string;
};

/** Thông tin mẫu váy để vẽ ảnh, dùng lồng trong inventory_items */
export const productThumbSelect = "products(id, name, color, categories(name), product_images(storage_path, is_cover))" as const;

// Kiểu dữ liệu chung khi select đơn kèm khách + váy
export const bookingSummarySelect =
  "id, code, status, rental_unit, pickup_date, return_date, pickup_at, return_at, delivery_method, total, deposit_required, branch_id, customers!inner(full_name, phone), booking_items(inventory_items(code, size, products(id, name, color, categories(name), product_images(storage_path, is_cover))))" as const;

type DressRow = {
  code?: string;
  size: string;
  products: {
    name: string;
    color: string | null;
    categories: { name: string } | null;
    product_images: { storage_path: string; is_cover: boolean }[];
  };
};

export function toDress(item: DressRow): Dress {
  return {
    name: item.products.name,
    size: item.size,
    code: item.code,
    color: item.products.color,
    category: item.products.categories?.name ?? null,
    image: coverPath(item.products.product_images),
  };
}

type SummaryRow = {
  code: string;
  status: BookingStatus;
  rental_unit: "day" | "hour";
  pickup_date: string;
  return_date: string;
  pickup_at: string | null;
  return_at: string | null;
  delivery_method: "pickup" | "ship";
  total: number | null;
  customers: { full_name: string; phone: string };
  booking_items: { inventory_items: DressRow }[];
};

export function toSummary(row: SummaryRow, extra?: Partial<BookingSummary>): BookingSummary {
  return {
    code: row.code,
    status: row.status,
    customerName: row.customers.full_name,
    phone: row.customers.phone,
    dresses: row.booking_items.map((bi) => toDress(bi.inventory_items)),
    pickupDate: row.pickup_date,
    returnDate: row.return_date,
    unit: row.rental_unit,
    pickupAt: row.pickup_at,
    returnAt: row.return_at,
    ship: row.delivery_method === "ship",
    total: row.total ?? 0,
    ...extra,
  };
}

/** Ảnh các váy trong đơn, xếp chồng lệch nhau */
export function DressStack({ dresses, className }: { dresses: Dress[]; className?: string }) {
  return (
    <div className={cn("flex shrink-0 -space-x-2", className)}>
      {dresses.slice(0, 3).map((d, i) => (
        <DressThumb key={i} {...d} className="w-7 rounded-md ring-2 ring-card" />
      ))}
    </div>
  );
}

/** Một dòng đơn trong card (kiểu Louez): avatar, tên + mã, váy, phần bên phải tùy ngữ cảnh */
export function BookingListItem({ booking, aside }: { booking: BookingSummary; aside?: React.ReactNode }) {
  return (
    <Link
      href={`/admin/don/${booking.code}`}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <CustomerAvatar name={booking.customerName} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-medium">{booking.customerName}</span>
          <CodeBadge>{booking.code}</CodeBadge>
          {booking.branchCode && <span className="text-xs text-muted-foreground">{booking.branchCode}</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          {booking.unit === "hour" && booking.pickupAt && booking.returnAt && (
            <span className="flex shrink-0 items-center gap-1 font-medium text-foreground tabular">
              <Clock className="size-3.5" aria-label="Thuê theo giờ" />
              {formatTime(booking.pickupAt)}–{formatTime(booking.returnAt)}
            </span>
          )}
          {booking.ship && <Truck className="size-3.5 shrink-0" aria-label="Giao tận nơi" />}
          <span className="truncate">{booking.dresses.map((d) => `${d.name} (${d.size})`).join(", ")}</span>
        </p>
        {booking.note && <p className="mt-0.5 text-xs text-amber-700">{booking.note}</p>}
      </div>
      <DressStack dresses={booking.dresses} className="hidden sm:flex" />
      {aside}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
