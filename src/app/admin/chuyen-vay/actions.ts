"use server";

import { refresh } from "next/cache";
import { getStaff } from "@/lib/auth";
import { dbErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { TransferStatus } from "@/lib/labels";

export async function setTransferStatus(transferId: string, status: TransferStatus): Promise<ActionResult> {
  await getStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("transfers").update({ status }).eq("id", transferId).select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Bạn không có quyền cập nhật phiếu chuyển này");
  refresh();
  return ok();
}

/** Chuyển tay 1 chiếc váy (ví dụ mang sang cho khách thử), không gắn với đơn */
export async function createTransfer(input: {
  itemId: string;
  toBranchId: string;
  dueDate: string;
  note: string;
}): Promise<ActionResult> {
  await getStaff();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return fail("Chọn ngày cần có váy");

  const supabase = await createClient();
  const { data: location } = await supabase
    .from("item_locations")
    .select("current_branch_id, in_transit, rented_booking_id")
    .eq("item_id", input.itemId)
    .maybeSingle();
  if (!location) return fail("Không tìm thấy váy");
  if (location.in_transit) return fail("Váy đang trên đường chuyển, chờ cơ sở nhận xác nhận trước");
  if (location.rented_booking_id) return fail("Khách đang giữ váy này");
  if (location.current_branch_id === input.toBranchId) return fail("Váy đang ở cơ sở này rồi");

  const { error } = await supabase.from("transfers").insert({
    item_id: input.itemId,
    from_branch_id: location.current_branch_id!,
    to_branch_id: input.toBranchId,
    due_date: input.dueDate,
    note: input.note.trim() || null,
  });
  if (error) return fail(dbErrorMessage(error));
  refresh();
  return ok();
}
