"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { verifyCaptcha } from "@/lib/captcha";
import { dateOfTimestamp } from "@/lib/dates";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "Mã không hợp lệ");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .transform((v) => v || null)
    .nullish();

const orderSchema = z
  .object({
    productId: id,
    size: z.string().trim().min(1, "Chọn size").max(10),
    branchId: id,
    unit: z.enum(["day", "hour"]),
    pickupDate: isoDate.nullish(),
    returnDate: isoDate.nullish(),
    pickupAt: z.iso.datetime({ offset: true }).nullish(),
    returnAt: z.iso.datetime({ offset: true }).nullish(),
    delivery: z.enum(["pickup", "ship"]),
    shipZone: z.enum(["local", "province"]).nullish(),
    shippingAddress: optionalText(300),
    fullName: z.string().trim().min(1, "Nhập họ tên").max(80, "Tên tối đa 80 ký tự"),
    phone: z.string().refine(isValidPhone, "Số điện thoại chưa đúng"),
    contact: optionalText(120),
    note: optionalText(500),
    captcha: z.string().max(4096).nullish(),
  })
  .refine((v) => (v.unit === "day" ? v.pickupDate && v.returnDate : v.pickupAt && v.returnAt), {
    message: "Chọn thời gian thuê",
  })
  .refine((v) => v.unit === "day" || v.delivery === "pickup", { message: "Thuê theo giờ chỉ nhận váy tại shop" })
  .refine((v) => v.delivery === "pickup" || (v.shipZone && v.shippingAddress), {
    message: "Nhập địa chỉ và khu vực giao váy",
  });

export type OrderInput = z.input<typeof orderSchema>;

export type PlacedOrder = {
  code: string;
  unit: "day" | "hour";
  pickupDate: string;
  returnDate: string;
  pickupAt: string | null;
  returnAt: string | null;
  total: number;
  deposit: number;
  security: number;
  holdExpiresAt: string | null;
};

// Lỗi từ create_booking đã viết sẵn tiếng Việt cho khách (hint là mã lỗi nghiệp vụ)
function orderError(error: { message: string; code?: string; hint?: string | null }) {
  if (error.code === "P0001") return error.message;
  if (error.code === "23P01") return "Váy vừa được khách khác đặt trong thời gian này. Bạn chọn thời gian khác nhé.";
  console.error("placeOrder", error);
  return "Chưa đặt được, bạn thử lại sau ít phút hoặc nhắn shop nhé";
}

/**
 * Khách đặt giữ váy. Chạy create_booking bằng service role sau khi qua captcha:
 * DB tự chọn chiếc còn trống của size đó và chặn trùng lịch, nên 2 khách bấm cùng lúc
 * thì chỉ một người giữ được chiếc cuối cùng, người kia nhận lỗi "đã kín lịch".
 */
export async function placeOrder(input: OrderInput): Promise<ActionResult<PlacedOrder>> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Thông tin chưa đúng");
  const v = parsed.data;

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyCaptcha(v.captcha, ip))) return fail("Xác minh chống spam chưa xong, bạn thử lại nhé");

  const contact = v.contact ?? "";
  const { data, error } = await createAdminClient().rpc("create_booking", {
    p_branch_id: v.branchId,
    p_customer: {
      full_name: v.fullName,
      phone: normalizePhone(v.phone),
      ...(/facebook\.com|fb\.com/i.test(contact) ? { facebook_url: contact } : contact ? { zalo: contact } : {}),
    },
    p_items: [{ product_id: v.productId, size: v.size }],
    // Thuê giờ: DB tự lấy ngày từ giờ nhận / trả
    p_pickup_date: v.unit === "day" ? v.pickupDate! : dateOfTimestamp(v.pickupAt!),
    p_return_date: v.unit === "day" ? v.returnDate! : dateOfTimestamp(v.returnAt!),
    p_delivery: v.delivery,
    p_ship_zone: v.delivery === "ship" ? v.shipZone! : undefined,
    p_shipping_address: v.delivery === "ship" ? v.shippingAddress! : undefined,
    p_customer_note: v.note ?? undefined,
    p_unit: v.unit,
    p_pickup_at: v.unit === "hour" ? v.pickupAt! : undefined,
    p_return_at: v.unit === "hour" ? v.returnAt! : undefined,
  });
  if (error || !data) return fail(orderError(error ?? { message: "empty" }));

  return ok({
    code: data.code,
    unit: data.rental_unit,
    pickupDate: data.pickup_date,
    returnDate: data.return_date,
    pickupAt: data.pickup_at,
    returnAt: data.return_at,
    total: data.total ?? 0,
    deposit: data.deposit_required,
    security: data.security_deposit,
    holdExpiresAt: data.hold_expires_at,
  });
}

export type LookedUpOrder = {
  code: string;
  status: "pending" | "confirmed" | "picked_up" | "returned" | "completed" | "cancelled";
  rental_unit: "day" | "hour";
  pickup_date: string;
  return_date: string;
  pickup_at: string | null;
  return_at: string | null;
  delivery_method: "pickup" | "ship";
  total: number;
  deposit_required: number;
  amount_paid: number;
  hold_expires_at: string | null;
  branch: { name: string; address: string | null; phone: string | null; map_url: string | null };
  items: { product_name: string; size: string; price: number }[] | null;
};

const lookupSchema = z.object({
  code: z.string().trim().min(4, "Nhập mã đơn").max(20),
  phone: z.string().refine(isValidPhone, "Số điện thoại chưa đúng"),
});

/** Khách tra cứu đơn bằng mã đơn + SĐT đã đặt */
export async function lookupOrder(input: z.input<typeof lookupSchema>): Promise<ActionResult<LookedUpOrder>> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Thông tin chưa đúng");

  const { data, error } = await createPublicClient().rpc("lookup_booking", {
    p_code: parsed.data.code,
    p_phone: normalizePhone(parsed.data.phone),
  });
  if (error) {
    console.error("lookupOrder", error);
    return fail("Chưa tra cứu được, bạn thử lại sau nhé");
  }
  if (!data) return fail("Không tìm thấy đơn. Kiểm tra lại mã đơn và số điện thoại đã đặt.");
  return ok(data as LookedUpOrder);
}
