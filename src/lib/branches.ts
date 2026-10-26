import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/auth";

export const BRANCH_COOKIE = "aura_branch";
export const ALL_BRANCHES = "all";

export type Branch = {
  id: string;
  code: string;
  name: string;
};

export const getBranches = cache(async (): Promise<Branch[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  return data ?? [];
});

/**
 * Cơ sở đang xem: lựa chọn trên thanh bên, mặc định là cơ sở của nhân viên
 * (chủ shop mặc định xem tất cả). Trả về null khi xem tất cả.
 */
export async function getViewBranchId(staff: Staff): Promise<string | null> {
  const value = (await cookies()).get(BRANCH_COOKIE)?.value;
  const branches = await getBranches();

  if (value === ALL_BRANCHES) return null;
  if (value && branches.some((b) => b.id === value)) return value;
  return staff.role === "owner" ? null : staff.branchId;
}

/** Cơ sở mặc định khi tạo đơn / lịch thử */
export async function getDefaultBranchId(staff: Staff) {
  if (staff.role === "staff" && staff.branchId) return staff.branchId;
  return (await getViewBranchId(staff)) ?? (await getBranches())[0]?.id ?? null;
}
