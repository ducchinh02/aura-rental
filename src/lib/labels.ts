import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export type BookingStatus = Enums["booking_status"];
export type BookingSource = Enums["booking_source"];
export type DeliveryMethod = Enums["delivery_method"];
export type ShipZone = Enums["ship_zone"];
export type PaymentKind = Enums["payment_kind"];
export type PaymentMethod = Enums["payment_method"];
export type TransferStatus = Enums["transfer_status"];
export type FittingStatus = Enums["fitting_status"];
export type ItemStatus = Enums["item_status"];
export type ProductStatus = Enums["product_status"];
export type RentalUnit = Enums["rental_unit"];

export const rentalUnitLabel: Record<RentalUnit, string> = {
  day: "Theo ngày",
  hour: "Theo giờ",
};

export const bookingStatusLabel: Record<BookingStatus, string> = {
  pending: "Chờ cọc",
  confirmed: "Đã cọc",
  picked_up: "Đang thuê",
  returned: "Đã trả váy",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

export type Tone = "amber" | "emerald" | "sky" | "violet" | "zinc" | "red" | "brand";

/** Bảng màu trạng thái dùng chung: badge nền nhạt, chấm, thanh trên lịch */
export const toneClass: Record<Tone, { badge: string; dot: string; bar: string; soft: string }> = {
  amber: { badge: "bg-amber-50 text-amber-700 ring-amber-600/15", dot: "bg-amber-500", bar: "bg-amber-500", soft: "bg-amber-50 text-amber-600" },
  emerald: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", dot: "bg-emerald-500", bar: "bg-emerald-600", soft: "bg-emerald-50 text-emerald-600" },
  sky: { badge: "bg-sky-50 text-sky-700 ring-sky-600/15", dot: "bg-sky-500", bar: "bg-sky-600", soft: "bg-sky-50 text-sky-600" },
  violet: { badge: "bg-violet-50 text-violet-700 ring-violet-600/15", dot: "bg-violet-500", bar: "bg-violet-600", soft: "bg-violet-50 text-violet-600" },
  zinc: { badge: "bg-zinc-100 text-zinc-600 ring-zinc-500/15", dot: "bg-zinc-400", bar: "bg-zinc-500", soft: "bg-zinc-100 text-zinc-600" },
  red: { badge: "bg-red-50 text-red-700 ring-red-600/15", dot: "bg-red-500", bar: "bg-red-400", soft: "bg-red-50 text-red-600" },
  brand: { badge: "bg-brand-soft text-primary ring-primary/15", dot: "bg-primary", bar: "bg-primary", soft: "bg-brand-soft text-primary" },
};

export const bookingStatusTone: Record<BookingStatus, Tone> = {
  pending: "amber",
  confirmed: "emerald",
  picked_up: "sky",
  returned: "violet",
  completed: "zinc",
  cancelled: "red",
};

/** Bước tiếp theo của đơn, theo đúng luồng trạng thái trong database */
export const nextBookingStatus: Partial<Record<BookingStatus, { status: BookingStatus; action: string }>> = {
  pending: { status: "confirmed", action: "Xác nhận đã cọc" },
  confirmed: { status: "picked_up", action: "Khách đã nhận váy" },
  picked_up: { status: "returned", action: "Khách đã trả váy" },
  returned: { status: "completed", action: "Hoàn tất đơn" },
};

export const bookingSourceLabel: Record<BookingSource, string> = {
  web: "Web",
  facebook: "Facebook",
  zalo: "Zalo",
  phone: "Điện thoại",
  walk_in: "Tại shop",
};

export const deliveryLabel: Record<DeliveryMethod, string> = {
  pickup: "Nhận tại shop",
  ship: "Giao tận nơi",
};

export const shipZoneLabel: Record<ShipZone, string> = {
  local: "Nội thành",
  province: "Ngoại tỉnh",
};

export const paymentKindLabel: Record<PaymentKind, string> = {
  payment: "Thu tiền",
  refund: "Hoàn tiền",
  security_hold: "Nhận thế chấp",
  security_return: "Trả thế chấp",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  bank: "Chuyển khoản",
  momo: "MoMo",
};

export const transferStatusLabel: Record<TransferStatus, string> = {
  pending: "Chờ gửi",
  in_transit: "Đang chuyển",
  received: "Đã nhận",
  cancelled: "Đã hủy",
};

export const fittingStatusLabel: Record<FittingStatus, string> = {
  booked: "Đã hẹn",
  done: "Đã đến",
  no_show: "Không đến",
  cancelled: "Đã hủy",
};

export const itemStatusLabel: Record<ItemStatus, string> = {
  active: "Sẵn sàng",
  maintenance: "Bảo trì",
  retired: "Ngưng cho thuê",
};

export const productStatusLabel: Record<ProductStatus, string> = {
  draft: "Nháp",
  active: "Đang hiển thị",
  archived: "Đã ẩn",
};

export const transferStatusTone: Record<TransferStatus, Tone> = {
  pending: "amber",
  in_transit: "sky",
  received: "emerald",
  cancelled: "zinc",
};

export const fittingStatusTone: Record<FittingStatus, Tone> = {
  booked: "sky",
  done: "emerald",
  no_show: "amber",
  cancelled: "zinc",
};

export const itemStatusTone: Record<ItemStatus, Tone> = {
  active: "emerald",
  maintenance: "amber",
  retired: "zinc",
};

export const productStatusTone: Record<ProductStatus, Tone> = {
  draft: "amber",
  active: "emerald",
  archived: "zinc",
};
