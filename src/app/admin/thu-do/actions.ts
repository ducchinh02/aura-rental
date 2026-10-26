"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getStaff } from "@/lib/auth";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { vnDateTimeToISO } from "@/lib/dates";
import { isValidPhone } from "@/lib/format";
import type { FittingStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const fittingSchema = z.object({
  branchId: z.string().regex(/^[0-9a-f-]{36}$/i),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Chọn giờ"),
  customer: z.object({
    full_name: z.string().trim().min(1, "Nhập tên khách"),
    phone: z.string().refine(isValidPhone, "Số điện thoại không hợp lệ"),
  }),
  items: z.array(z.object({ productId: z.string(), size: z.string() })),
  note: z.string().trim(),
  source: z.enum(["facebook", "zalo", "phone", "walk_in", "web"]),
});

export type FittingInput = z.input<typeof fittingSchema>;

export async function createFitting(input: FittingInput): Promise<ActionResult> {
  await getStaff();
  const parsed = fittingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_fitting", {
    p_branch_id: v.branchId,
    p_customer: v.customer,
    p_starts_at: vnDateTimeToISO(v.date, v.time),
    p_items: v.items.filter((i) => i.productId).map((i) => ({ product_id: i.productId, size: i.size })),
    p_customer_note: v.note || undefined,
    p_source: v.source,
  });
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

export async function setFittingStatus(fittingId: string, status: FittingStatus): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fitting_appointments")
    .update({ status })
    .eq("id", fittingId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Bạn chỉ cập nhật được lịch thử của cơ sở mình");
  refresh();
  return ok();
}
