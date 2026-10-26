"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { vnDateTimeToISO } from "@/lib/dates";
import { isValidPhone, normalizePhone } from "@/lib/format";
import type { BookingStatus } from "@/lib/labels";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "Mã không hợp lệ");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày");
const money = z.number().int().min(0, "Số tiền không hợp lệ");
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullish();

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Chọn giờ");

// Thuê theo ngày: pickupDate → returnDate. Thuê theo giờ: trong ngày pickupDate, từ startTime tới endTime (giờ VN)
const scheduleSchema = z
  .object({
    unit: z.enum(["day", "hour"]).default("day"),
    pickupDate: isoDate,
    returnDate: isoDate,
    startTime: hhmm.nullish(),
    endTime: hhmm.nullish(),
    delivery: z.enum(["pickup", "ship"]),
    shipZone: z.enum(["local", "province"]).nullish(),
    shippingAddress: optionalText,
  })
  .refine((v) => v.unit === "hour" || v.returnDate >= v.pickupDate, { message: "Ngày trả phải sau ngày nhận" })
  .refine((v) => v.unit === "day" || (v.startTime && v.endTime && v.endTime > v.startTime), {
    message: "Giờ trả phải sau giờ nhận",
  })
  .refine((v) => v.unit === "day" || v.delivery === "pickup", { message: "Thuê theo giờ chỉ nhận và trả tại shop" })
  .refine((v) => v.delivery === "pickup" || (v.shipZone && v.shippingAddress), {
    message: "Nhập khu vực và địa chỉ giao hàng",
  });

type Schedule = z.output<typeof scheduleSchema>;

/** Giờ nhận / trả dạng ISO cho đơn theo giờ */
function hourTimes(v: Schedule) {
  if (v.unit !== "hour" || !v.startTime || !v.endTime) return { pickupAt: null, returnAt: null };
  return { pickupAt: vnDateTimeToISO(v.pickupDate, v.startTime), returnAt: vnDateTimeToISO(v.pickupDate, v.endTime) };
}

const createSchema = z.object({
  branchId: id,
  customer: z.object({
    full_name: z.string().trim().min(1, "Nhập tên khách"),
    phone: z.string().refine(isValidPhone, "Số điện thoại không hợp lệ"),
    facebook_url: optionalText,
    zalo: optionalText,
  }),
  source: z.enum(["web", "facebook", "zalo", "phone", "walk_in"]),
  schedule: scheduleSchema,
  shippingFee: money,
  discount: money,
  items: z.array(z.object({ productId: id, size: z.string().min(1, "Chọn size") })).min(1, "Chọn ít nhất 1 váy"),
  customerNote: optionalText,
  internalNote: optionalText,
  fittingId: id.nullish(),
});

export type CreateBookingInput = z.input<typeof createSchema>;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

export async function createBooking(input: CreateBookingInput): Promise<ActionResult<{ code: string }>> {
  await getStaff();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const supabase = await createClient();
  const times = hourTimes(v.schedule);
  const { data: booking, error } = await supabase.rpc("create_booking", {
    p_branch_id: v.branchId,
    p_customer: v.customer,
    p_items: v.items.map((i) => ({ product_id: i.productId, size: i.size })),
    p_pickup_date: v.schedule.pickupDate,
    p_return_date: v.schedule.unit === "hour" ? v.schedule.pickupDate : v.schedule.returnDate,
    p_delivery: v.schedule.delivery,
    p_ship_zone: v.schedule.delivery === "ship" ? v.schedule.shipZone ?? undefined : undefined,
    p_shipping_address: v.schedule.shippingAddress ?? undefined,
    p_source: v.source,
    p_customer_note: v.customerNote ?? undefined,
    p_unit: v.schedule.unit,
    p_pickup_at: times.pickupAt ?? undefined,
    p_return_at: times.returnAt ?? undefined,
  });
  if (error || !booking) return fail(dbErrorMessage(error));

  const extras = {
    shipping_fee: v.schedule.delivery === "ship" ? v.shippingFee : 0,
    discount: v.discount,
    internal_note: v.internalNote,
  };
  if (extras.shipping_fee || extras.discount || extras.internal_note) {
    const { error: updateError } = await supabase.from("bookings").update(extras).eq("id", booking.id);
    if (updateError) return fail(`Đã tạo đơn ${booking.code} nhưng chưa lưu được phí/ghi chú: ${dbErrorMessage(updateError)}`);
  }

  if (v.fittingId) {
    await supabase
      .from("fitting_appointments")
      .update({ booking_id: booking.id, status: "done" })
      .eq("id", v.fittingId);
  }

  return ok({ code: booking.code });
}

/** price = null: mẫu này không cho thuê theo giờ */
export type Quote = { available: boolean; price: number | null; deposit: number; days: number; hours: number | null };

export async function quoteItem(input: {
  productId: string;
  size: string;
  branchId: string;
  unit: "day" | "hour";
  pickupDate: string;
  returnDate: string;
  startTime?: string | null;
  endTime?: string | null;
  delivery: "pickup" | "ship";
  shipZone: "local" | "province" | null;
}): Promise<Quote | null> {
  await getStaff();
  if (!input.pickupDate) return null;
  if (input.unit === "day" && (!input.returnDate || input.returnDate < input.pickupDate)) return null;
  if (input.unit === "hour" && (!input.startTime || !input.endTime || input.endTime <= input.startTime)) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("quote_rental", {
    p_product_id: input.productId,
    p_size: input.size,
    p_branch_id: input.branchId,
    p_pickup_date: input.pickupDate,
    p_return_date: input.unit === "hour" ? input.pickupDate : input.returnDate,
    p_delivery: input.unit === "hour" ? "pickup" : input.delivery,
    p_ship_zone: input.unit === "day" && input.delivery === "ship" ? input.shipZone ?? undefined : undefined,
    p_unit: input.unit,
    p_pickup_at: input.unit === "hour" ? vnDateTimeToISO(input.pickupDate, input.startTime!) : undefined,
    p_return_at: input.unit === "hour" ? vnDateTimeToISO(input.pickupDate, input.endTime!) : undefined,
  });
  const row = data?.[0];
  return row
    ? { available: row.available, price: row.price, deposit: row.deposit, days: row.rental_days, hours: row.hours }
    : null;
}

export type CustomerMatch = {
  id: string;
  full_name: string;
  facebook_url: string | null;
  zalo: string | null;
  note: string | null;
  is_blacklisted: boolean;
  bookingCount: number;
};

export async function findCustomerByPhone(phone: string): Promise<CustomerMatch | null> {
  await getStaff();
  if (!isValidPhone(phone)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, facebook_url, zalo, note, is_blacklisted, bookings(count)")
    .eq("phone", normalizePhone(phone))
    .maybeSingle();
  if (!data) return null;

  const { bookings, ...customer } = data;
  return { ...customer, bookingCount: bookings[0]?.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Sửa đơn
// ---------------------------------------------------------------------------

export async function setBookingStatus(
  bookingId: string,
  status: BookingStatus,
  cancelReason?: string,
): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update(status === "cancelled" ? { status, cancel_reason: cancelReason?.trim() || null } : { status })
    .eq("id", bookingId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Bạn không có quyền sửa đơn của cơ sở này");
  refresh();
  return ok();
}

export async function updateBookingSchedule(
  bookingId: string,
  input: z.input<typeof scheduleSchema>,
): Promise<ActionResult> {
  await getStaff();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;

  const supabase = await createClient();
  const times = hourTimes(v);
  const { data, error } = await supabase
    .from("bookings")
    .update({
      rental_unit: v.unit,
      pickup_date: v.pickupDate,
      return_date: v.unit === "hour" ? v.pickupDate : v.returnDate,
      pickup_at: times.pickupAt,
      return_at: times.returnAt,
      delivery_method: v.delivery,
      ship_zone: v.delivery === "ship" ? v.shipZone : null,
      shipping_address: v.delivery === "ship" ? v.shippingAddress : null,
    })
    .eq("id", bookingId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Bạn không có quyền sửa đơn của cơ sở này");
  refresh();
  return ok();
}

const feesSchema = z.object({
  discount: money,
  shipping_fee: money,
  late_fee: money,
  damage_fee: money,
});

export async function updateBookingFees(bookingId: string, input: z.input<typeof feesSchema>): Promise<ActionResult> {
  await getStaff();
  const parsed = feesSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings").update(parsed.data).eq("id", bookingId).select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Bạn không có quyền sửa đơn của cơ sở này");
  refresh();
  return ok();
}

export async function updateInternalNote(bookingId: string, note: string): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ internal_note: note.trim() || null })
    .eq("id", bookingId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Bạn không có quyền sửa đơn của cơ sở này");
  refresh();
  return ok();
}

export async function setItemPrice(bookingItemId: string, price: number): Promise<ActionResult> {
  await getStaff();
  if (!Number.isInteger(price) || price < 0) return fail("Giá không hợp lệ");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_items")
    .update({ price, is_price_custom: true })
    .eq("id", bookingItemId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Bạn không có quyền sửa đơn của cơ sở này");
  refresh();
  return ok();
}

export async function addBookingItem(bookingId: string, productId: string, size: string): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_booking_item", {
    p_booking_id: bookingId,
    p_product_id: productId,
    p_size: size,
  });
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

export async function removeBookingItem(bookingItemId: string): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_booking_item", { p_booking_item_id: bookingItemId });
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

const paymentSchema = z.object({
  kind: z.enum(["payment", "refund", "security_hold", "security_return"]),
  method: z.enum(["cash", "bank", "momo"]),
  amount: z.number().int().positive("Nhập số tiền"),
  note: optionalText,
});

export async function addPayment(bookingId: string, input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  await getStaff();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({ booking_id: bookingId, ...parsed.data });
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}
