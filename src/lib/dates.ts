// Ngày thuê luôn là chuỗi "YYYY-MM-DD" theo giờ Việt Nam.
// Tính toán bằng UTC để không lệch ngày dù server chạy múi giờ nào.

const VN_TZ = "Asia/Ho_Chi_Minh";
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function todayVN() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const date = toUTC(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
}

export function diffDays(from: string, to: string) {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

export function weekday(iso: string) {
  return WEEKDAYS[toUTC(iso).getUTCDay()];
}

export function isWeekend(iso: string) {
  const day = toUTC(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** 28/10/2026 */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** T4 28/10 */
export function formatDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${weekday(iso)} ${d}/${m}`;
}

/** 28/10 → 30/10 (3 ngày) */
export function formatRange(from: string, to: string) {
  const [, m1, d1] = from.split("-");
  const [, m2, d2] = to.split("-");
  return `${d1}/${m1} → ${d2}/${m2}`;
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TZ,
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  hourCycle: "h23",
});

/** 10:00 */
export function formatTime(timestamp: string) {
  return timeFormat.format(new Date(timestamp));
}

/** 10:00 27/10 */
export function formatDateTime(timestamp: string) {
  const parts = Object.fromEntries(
    dateTimeFormat.formatToParts(new Date(timestamp)).map((p) => [p.type, p.value]),
  );
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
}

/** Ngày (YYYY-MM-DD) của một mốc thời gian theo giờ Việt Nam */
export function dateOfTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(new Date(timestamp));
}

/** "2026-10-27" + "10:00" giờ VN → ISO timestamp */
export function vnDateTimeToISO(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

export function rentalDays(pickup: string, ret: string) {
  return diffDays(pickup, ret) + 1;
}

/** Số giờ thuê (làm tròn lên), giống cách tính giá trong database */
export function rentalHours(pickupAt: string, returnAt: string) {
  return Math.ceil((new Date(returnAt).getTime() - new Date(pickupAt).getTime()) / 3_600_000);
}

/** Số giờ trễ (làm tròn lên) từ giờ hẹn trả đến lúc trả thực tế, chưa trả thì tính đến bây giờ */
export function hoursLate(returnAt: string, returnedAt?: string | null) {
  const end = returnedAt ? new Date(returnedAt).getTime() : Date.now();
  return Math.max(0, Math.ceil((end - new Date(returnAt).getTime()) / 3_600_000));
}

/** Thời gian thuê của một đơn: theo ngày dùng ngày, theo giờ dùng giờ nhận / trả */
export type RentalPeriod = {
  unit: "day" | "hour";
  pickupDate: string;
  returnDate: string;
  pickupAt?: string | null;
  returnAt?: string | null;
};

/** "28/10 → 30/10" hoặc "28/10 09:00 → 13:00" */
export function formatPeriod(p: RentalPeriod) {
  if (p.unit === "hour" && p.pickupAt && p.returnAt) {
    const [, m, d] = p.pickupDate.split("-");
    const sameDay = p.pickupDate === p.returnDate;
    const end = sameDay ? formatTime(p.returnAt) : `${formatTime(p.returnAt)} ${p.returnDate.slice(8)}/${p.returnDate.slice(5, 7)}`;
    return `${d}/${m} ${formatTime(p.pickupAt)} → ${end}`;
  }
  return formatRange(p.pickupDate, p.returnDate);
}

/** "3 ngày" hoặc "4 giờ" */
export function periodLength(p: RentalPeriod) {
  if (p.unit === "hour" && p.pickupAt && p.returnAt) return `${rentalHours(p.pickupAt, p.returnAt)} giờ`;
  return `${rentalDays(p.pickupDate, p.returnDate)} ngày`;
}

/** Đổi dòng bookings (snake_case) sang RentalPeriod */
export function periodOf(b: {
  rental_unit: "day" | "hour";
  pickup_date: string;
  return_date: string;
  pickup_at?: string | null;
  return_at?: string | null;
}): RentalPeriod {
  return { unit: b.rental_unit, pickupDate: b.pickup_date, returnDate: b.return_date, pickupAt: b.pickup_at, returnAt: b.return_at };
}
