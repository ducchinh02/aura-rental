import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Staff = {
  id: string;
  fullName: string;
  role: "owner" | "staff";
  branchId: string | null;
};

// Nhân viên đang đăng nhập; chưa đăng nhập / bị khoá thì về trang đăng nhập.
// Gọi ở mọi trang và Server Action của khu quản trị (proxy chỉ là chặn nhanh).
export const getStaff = cache(async (): Promise<Staff> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, branch_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.is_active) redirect("/login?error=inactive");

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    branchId: profile.branch_id,
  };
});

export function canManageBranch(staff: Staff, branchId: string) {
  return staff.role === "owner" || staff.branchId === branchId;
}

export async function requireOwner() {
  const staff = await getStaff();
  if (staff.role !== "owner") redirect("/admin");
  return staff;
}
