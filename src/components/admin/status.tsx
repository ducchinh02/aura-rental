import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { bookingStatusLabel, bookingStatusTone, toneClass, type BookingStatus, type Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Badge nền nhạt chữ cùng tông, kèm chấm màu */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge className={cn("gap-1.5 ring-1 ring-inset", toneClass[tone].badge, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", toneClass[tone].dot)} />
      {children}
    </Badge>
  );
}

// Đơn không cần cọc (deposit_required = 0) không nói "cọc" với khách / nhân viên
const noDepositLabel: Partial<Record<BookingStatus, string>> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
};

export function BookingStatusBadge({ status, noDeposit }: { status: BookingStatus; noDeposit?: boolean }) {
  return (
    <StatusBadge tone={bookingStatusTone[status]}>
      {(noDeposit && noDepositLabel[status]) || bookingStatusLabel[status]}
    </StatusBadge>
  );
}

/** Tình trạng tiền của đơn: đã thu đủ / còn thiếu / chưa thu */
export function PaymentBadge({ total, balance, status }: { total: number; balance: number; status: BookingStatus }) {
  if (status === "cancelled") return null;
  if (balance <= 0) return <StatusBadge tone="emerald">Đã thu đủ</StatusBadge>;
  if (balance >= total) return <StatusBadge tone="red">Chưa thu</StatusBadge>;
  return <StatusBadge tone="amber">Còn {formatMoney(balance)}</StatusBadge>;
}
