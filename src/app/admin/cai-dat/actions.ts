"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getStaff } from "@/lib/auth";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { isValidPhone, normalizePhone, slugify } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function ownerOnly() {
  const staff = await getStaff();
  return staff.role === "owner" ? staff : null;
}

const days = z.number().int().min(0, "Số ngày không hợp lệ").max(30);
const text = z
  .string()
  .trim()
  .transform((v) => v || null);

const settingsSchema = z.object({
  cleaning_days: days,
  transfer_days: days,
  ship_days_local: days,
  ship_days_province: days,
  hold_hours: z.number().int().min(1, "Giữ chỗ tối thiểu 1 giờ").max(24 * 14),
  hourly_buffer_minutes: z.number().int().min(0).max(1440, "Tối đa 1440 phút"),
  late_fee_per_day: z.number().int().min(0),
  bank_bin: text,
  bank_account: text,
  bank_holder: text,
});

export async function updateSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  if (!(await ownerOnly())) return fail("Chỉ chủ shop được sửa cài đặt");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");

  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(parsed.data).eq("id", true);
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Giờ không hợp lệ");
const branchSchema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên cơ sở"),
    address: text,
    phone: text,
    map_url: text,
    open_time: time,
    close_time: time,
    fitting_slot_minutes: z.number().int().min(5).max(240).nullable(),
    fitting_capacity: z.number().int().min(1).max(50).nullable(),
  })
  .refine((v) => v.close_time > v.open_time, { message: "Giờ đóng cửa phải sau giờ mở cửa" });

export async function updateBranch(branchId: string, input: z.input<typeof branchSchema>): Promise<ActionResult> {
  if (!(await ownerOnly())) return fail("Chỉ chủ shop được sửa thông tin cơ sở");
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");

  const supabase = await createClient();
  const { error } = await supabase.from("branches").update(parsed.data).eq("id", branchId);
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

const newBranchSchema = branchSchema.and(
  z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,6}$/, "Mã cơ sở gồm 2–6 chữ in hoa hoặc số, ví dụ CS3"),
  }),
);

export async function createBranch(input: z.input<typeof newBranchSchema>): Promise<ActionResult> {
  if (!(await ownerOnly())) return fail("Chỉ chủ shop được thêm cơ sở");
  const parsed = newBranchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");

  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert(parsed.data);
  if (error) return fail(error.code === "23505" ? `Mã ${parsed.data.code} đã có cơ sở dùng` : dbErrorMessage(error));
  refresh();
  return ok();
}

export async function setBranchActive(branchId: string, active: boolean): Promise<ActionResult> {
  if (!(await ownerOnly())) return fail("Chỉ chủ shop được bật / tắt cơ sở");
  const supabase = await createClient();
  const { error } = await supabase.from("branches").update({ is_active: active }).eq("id", branchId);
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

// ---------------------------------------------------------------------------
// Danh mục
// ---------------------------------------------------------------------------

export async function saveCategory(categoryId: string | null, name: string): Promise<ActionResult> {
  await getStaff();
  const trimmed = name.trim();
  if (!trimmed) return fail("Nhập tên danh mục");

  const supabase = await createClient();
  const { error } = categoryId
    ? await supabase.from("categories").update({ name: trimmed, slug: slugify(trimmed) }).eq("id", categoryId)
    : await supabase.from("categories").insert({ name: trimmed, slug: slugify(trimmed), sort_order: 99 });
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

// ---------------------------------------------------------------------------
// Tài khoản nhân viên (Admin API, chỉ chủ shop)
// ---------------------------------------------------------------------------

const accountSchema = z
  .object({
    email: z.email("Email không hợp lệ"),
    password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
    full_name: z.string().trim().min(1, "Nhập tên nhân viên"),
    phone: z.string().refine(isValidPhone, "Số điện thoại không hợp lệ"),
    role: z.enum(["owner", "staff"]),
    branch_id: z.string().nullable(),
  })
  .refine((v) => v.role === "owner" || v.branch_id, { message: "Chọn cơ sở cho nhân viên" });

export async function createAccount(input: z.input<typeof accountSchema>): Promise<ActionResult> {
  if (!(await ownerOnly())) return fail("Chỉ chủ shop được tạo tài khoản");
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const v = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    app_metadata: { role: v.role, branch_id: v.role === "owner" ? null : v.branch_id },
    user_metadata: { full_name: v.full_name, phone: normalizePhone(v.phone) },
  });
  if (error) {
    return fail(/already.*registered|exists/i.test(error.message) ? "Email này đã có tài khoản" : error.message);
  }
  refresh();
  return ok();
}

export async function updateAccount(
  profileId: string,
  input: { role: "owner" | "staff"; branch_id: string | null; is_active: boolean },
): Promise<ActionResult> {
  const owner = await ownerOnly();
  if (!owner) return fail("Chỉ chủ shop được sửa tài khoản");
  if (profileId === owner.id && (!input.is_active || input.role !== "owner")) {
    return fail("Không tự khoá hoặc hạ quyền tài khoản của chính mình");
  }
  if (input.role === "staff" && !input.branch_id) return fail("Chọn cơ sở cho nhân viên");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: input.role, branch_id: input.role === "owner" ? null : input.branch_id, is_active: input.is_active })
    .eq("id", profileId);
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

const accountInfoSchema = z.object({
  full_name: z.string().trim().min(1, "Nhập tên nhân viên"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidPhone(v), "Số điện thoại không hợp lệ"),
});

export async function updateAccountInfo(profileId: string, input: z.input<typeof accountInfoSchema>): Promise<ActionResult> {
  if (!(await ownerOnly())) return fail("Chỉ chủ shop được sửa tài khoản");
  const parsed = accountInfoSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : null })
    .eq("id", profileId);
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}

export async function resetPassword(profileId: string, password: string): Promise<ActionResult> {
  if (!(await ownerOnly())) return fail("Chỉ chủ shop được đặt lại mật khẩu");
  if (password.length < 8) return fail("Mật khẩu tối thiểu 8 ký tự");

  const { error } = await createAdminClient().auth.admin.updateUserById(profileId, { password });
  if (error) return fail(error.message);
  return ok();
}
