"use server";

import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import { canManageBranch, getStaff } from "@/lib/auth";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { slugify } from "@/lib/format";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { CATALOG_TAG } from "@/lib/queries/storefront";
import { createClient } from "@/lib/supabase/server";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "Mã không hợp lệ");
const money = z.number().int().min(0, "Số tiền không hợp lệ");

const productSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên mẫu váy"),
  slug: z
    .string()
    .trim()
    .transform((v) => slugify(v))
    .pipe(z.string().min(1, "Nhập đường dẫn")),
  category_id: id.nullable(),
  status: z.enum(["draft", "active", "archived"]),
  color: z
    .string()
    .trim()
    .transform((v) => v || null),
  occasions: z.array(z.string().trim().min(1)),
  description: z
    .string()
    .trim()
    .transform((v) => v || null),
  base_price: money,
  rental_days: z.number().int().min(1, "Số ngày của gói tối thiểu là 1"),
  extra_day_price: money,
  deposit_amount: money,
  requires_deposit: z.boolean(),
  security_amount: money,
  hourly_price: money.nullable(),
  hourly_hours: z.number().int().min(1, "Gói giờ tối thiểu 1 giờ").max(24, "Gói giờ tối đa 24 giờ"),
  extra_hour_price: money,
});

export type ProductInput = z.input<typeof productSchema>;

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  await getStaff();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert(parsed.data).select("id").single();
  if (error || !data) return fail(dbErrorMessage(error));
  revalidateTag(CATALOG_TAG, "max");
  return ok({ id: data.id });
}

export async function updateProduct(productId: string, input: ProductInput): Promise<ActionResult> {
  const staff = await getStaff();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  // Nhân viên không gửi các cột giá để không đụng trigger chặn sửa giá
  const {
    base_price,
    rental_days,
    extra_day_price,
    deposit_amount,
    requires_deposit,
    security_amount,
    hourly_price,
    hourly_hours,
    extra_hour_price,
    ...rest
  } = parsed.data;
  const values =
    staff.role === "owner"
      ? {
          ...rest,
          base_price,
          rental_days,
          extra_day_price,
          deposit_amount,
          requires_deposit,
          security_amount,
          hourly_price,
          hourly_hours,
          extra_hour_price,
        }
      : rest;

  const supabase = await createClient();
  const { error } = await supabase.from("products").update(values).eq("id", productId);
  if (error) return fail(dbErrorMessage(error));
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}

export type BranchPriceInput = {
  price: number | null;
  extra_day_price: number | null;
  hourly_price: number | null;
  extra_hour_price: number | null;
};

/** Giá riêng của cơ sở; trường để null dùng giá chung, tất cả null thì xoá giá riêng */
export async function setBranchPrice(productId: string, branchId: string, input: BranchPriceInput): Promise<ActionResult> {
  const staff = await getStaff();
  if (staff.role !== "owner") return fail("Chỉ chủ shop được sửa giá");
  if (Object.values(input).some((v) => v !== null && (!Number.isInteger(v) || v < 0))) return fail("Giá không hợp lệ");

  const supabase = await createClient();
  const { error } = Object.values(input).every((v) => v === null)
    ? await supabase.from("product_branch_prices").delete().eq("product_id", productId).eq("branch_id", branchId)
    : await supabase.from("product_branch_prices").upsert({ product_id: productId, branch_id: branchId, ...input });
  if (error) return fail(dbErrorMessage(error));
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}

// ---------------------------------------------------------------------------
// Ảnh (file đã được client upload lên Storage)
// ---------------------------------------------------------------------------

export async function addProductImage(productId: string, storagePath: string): Promise<ActionResult> {
  await getStaff();
  if (!storagePath.startsWith(`${productId}/`)) return fail("Đường dẫn ảnh không hợp lệ");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("product_images")
    .select("sort_order, is_cover")
    .eq("product_id", productId);
  const hasCover = (existing ?? []).some((i) => i.is_cover);
  const nextOrder = Math.max(-1, ...(existing ?? []).map((i) => i.sort_order)) + 1;

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: storagePath,
    sort_order: nextOrder,
    is_cover: !hasCover,
  });
  if (error) return fail(dbErrorMessage(error));
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}

export async function setCoverImage(imageId: string): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { data: image } = await supabase.from("product_images").select("product_id").eq("id", imageId).single();
  if (!image) return fail("Không tìm thấy ảnh");

  await supabase.from("product_images").update({ is_cover: false }).eq("product_id", image.product_id);
  const { error } = await supabase.from("product_images").update({ is_cover: true }).eq("id", imageId);
  if (error) return fail(dbErrorMessage(error));
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}

export async function moveImage(imageId: string, direction: -1 | 1): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { data: image } = await supabase.from("product_images").select("product_id").eq("id", imageId).single();
  if (!image) return fail("Không tìm thấy ảnh");

  const { data: images } = await supabase
    .from("product_images")
    .select("id, sort_order")
    .eq("product_id", image.product_id)
    .order("sort_order");
  const list = images ?? [];
  const index = list.findIndex((i) => i.id === imageId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return ok();

  [list[index], list[target]] = [list[target], list[index]];
  const results = await Promise.all(
    list.map((img, order) => supabase.from("product_images").update({ sort_order: order }).eq("id", img.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(dbErrorMessage(failed.error));
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}

export async function deleteImage(imageId: string): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { data: image } = await supabase
    .from("product_images")
    .select("product_id, storage_path, is_cover")
    .eq("id", imageId)
    .single();
  if (!image) return fail("Không tìm thấy ảnh");

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return fail(dbErrorMessage(error));
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);

  // Xoá ảnh bìa thì lấy ảnh đầu tiên còn lại làm bìa
  if (image.is_cover) {
    const { data: first } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (first) await supabase.from("product_images").update({ is_cover: true }).eq("id", first.id);
  }
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}

// ---------------------------------------------------------------------------
// Từng chiếc váy
// ---------------------------------------------------------------------------

const itemSchema = z.object({
  size: z
    .string()
    .trim()
    .min(1, "Nhập size")
    .transform((v) => v.toUpperCase()),
  code: z
    .string()
    .trim()
    .min(1, "Nhập mã váy")
    .transform((v) => v.toUpperCase()),
  home_branch_id: id,
});

export async function addItem(productId: string, input: z.input<typeof itemSchema>): Promise<ActionResult> {
  const staff = await getStaff();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  if (!canManageBranch(staff, parsed.data.home_branch_id)) return fail("Bạn chỉ thêm được váy cho cơ sở của mình");

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({ product_id: productId, ...parsed.data });
  if (error) return fail(dbErrorMessage(error));
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}

const itemUpdateSchema = z.object({
  status: z.enum(["active", "maintenance", "retired"]).optional(),
  home_branch_id: id.optional(),
  condition_note: z
    .string()
    .trim()
    .transform((v) => v || null)
    .optional(),
});

export async function updateItem(itemId: string, input: z.input<typeof itemUpdateSchema>): Promise<ActionResult> {
  await getStaff();
  const parsed = itemUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_items").update(parsed.data).eq("id", itemId).select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Chỉ cơ sở giữ váy (kho gốc) mới sửa được chiếc này");
  revalidateTag(CATALOG_TAG, "max");
  refresh();
  return ok();
}
