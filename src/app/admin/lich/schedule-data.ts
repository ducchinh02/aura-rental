// Kiểu dữ liệu và cách tính trạng thái dùng chung cho chế độ Ngày và dòng thời gian.
import { addDays } from "@/lib/dates";
import type { BookingStatus, ItemStatus, Tone } from "@/lib/labels";

export type ScheduleView = "day" | "week" | "2weeks" | "month";

export const VIEW_LABEL: Record<ScheduleView, string> = {
  day: "Ngày",
  week: "Tuần",
  "2weeks": "2 tuần",
  month: "Tháng",
};

export type ScheduleItem = { id: string; code: string; size: string; status: ItemStatus; homeCode: string; location?: string };

export type ScheduleProduct = {
  id: string;
  name: string;
  color: string | null;
  category: string | null;
  image: string | null;
  items: ScheduleItem[];
};

/** Một chiếc váy bị giữ cho một đơn. Ngày dạng YYYY-MM-DD, tính cả hai đầu */
export type ScheduleBooking = {
  id: string;
  itemId: string;
  code: string;
  status: BookingStatus;
  customer: string;
  branch: string;
  pickup: string;
  ret: string;
  unit: "day" | "hour";
  pickupAt: string | null;
  returnAt: string | null;
  blockFrom: string;
  blockTo: string;
};

export type DayState = "overdue" | "return" | "handover" | "late" | "out" | "buffer" | "maintenance" | "ready";

export const dayStateMeta: Record<DayState, { label: string; tone: Tone; hint: string }> = {
  overdue: { label: "Quá hạn trả", tone: "red", hint: "Khách giữ váy quá ngày hẹn trả" },
  return: { label: "Nhận lại", tone: "violet", hint: "Khách hẹn trả váy ngày này" },
  handover: { label: "Giao váy", tone: "brand", hint: "Khách nhận váy ngày này" },
  late: { label: "Chưa đến lấy", tone: "amber", hint: "Đã qua ngày nhận nhưng khách chưa lấy váy" },
  out: { label: "Khách đang giữ", tone: "sky", hint: "Váy đang ở chỗ khách" },
  buffer: { label: "Giặt, ship, chuyển", tone: "zinc", hint: "Ngày giữ thêm trước/sau lượt thuê" },
  maintenance: { label: "Bảo trì", tone: "amber", hint: "Chiếc váy đang sửa, chưa cho thuê" },
  ready: { label: "Sẵn sàng", tone: "emerald", hint: "Còn trống, nhận đơn được" },
};

export const DAY_STATE_ORDER: DayState[] = ["overdue", "return", "handover", "late", "out", "buffer", "maintenance", "ready"];

/** Trạng thái của một chiếc váy vào ngày `day`, kèm đơn liên quan nếu có */
export function itemStateOn(
  item: ScheduleItem,
  bookings: ScheduleBooking[],
  day: string,
  today: string,
  now: string,
): { state: DayState; booking?: ScheduleBooking } {
  const mine = bookings.filter((b) => b.itemId === item.id);

  // Đơn đang thuê quá hạn: váy vẫn ở chỗ khách dù đã hết khoảng giữ.
  // Thuê giờ quá hạn ngay khi qua giờ trả trong ngày.
  const overdue = mine.find(
    (b) =>
      b.status === "picked_up" &&
      ((b.ret < day && day <= today) || (b.unit === "hour" && day === today && !!b.returnAt && b.returnAt < now)),
  );
  if (overdue) return { state: "overdue", booking: overdue };

  const inRental = mine.find((b) => b.pickup <= day && day <= b.ret);
  if (inRental) {
    const b = inRental;
    if (b.status === "picked_up") return { state: b.ret === day ? "return" : "out", booking: b };
    if (b.status === "pending" || b.status === "confirmed") {
      if (b.pickup === day) return { state: "handover", booking: b };
      return { state: day <= today ? "late" : "out", booking: b };
    }
    // Đơn đã trả / hoàn tất: những ngày trong quá khứ váy ở chỗ khách
    return { state: b.ret === day ? "return" : "out", booking: b };
  }

  const inBuffer = mine.find((b) => b.blockFrom <= day && day <= b.blockTo);
  if (inBuffer) return { state: "buffer", booking: inBuffer };
  if (item.status === "maintenance") return { state: "maintenance" };
  return { state: "ready" };
}

/** Đơn quá hạn: thanh trên dòng thời gian kéo dài tới hôm nay */
export function effectiveEnd(b: ScheduleBooking, today: string) {
  return b.status === "picked_up" && b.ret < today ? today : b.ret;
}

export function daysFrom(from: string, count: number) {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
