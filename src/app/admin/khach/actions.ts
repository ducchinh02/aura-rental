"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getStaff } from "@/lib/auth";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);

const customerSchema = z.object({
  full_name: z.string().trim().min(1, "Nhập tên khách"),
  phone: z.string().refine(isValidPhone, "Số điện thoại không hợp lệ").transform(normalizePhone),
  email: optionalText,
  facebook_url: optionalText,
  zalo: optionalText,
  address: optionalText,
  note: optionalText,
  is_blacklisted: z.boolean(),
});

export type CustomerInput = z.input<typeof customerSchema>;

export async function updateCustomer(customerId: string, input: CustomerInput): Promise<ActionResult> {
  await getStaff();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");

  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(parsed.data).eq("id", customerId);
  if (error) {
    return fail(error.code === "23505" ? "Số điện thoại này đã thuộc về khách khác" : dbErrorMessage(error));
  }
  refresh();
  return ok();
}
