import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getStaff } from "@/lib/auth";
import { ALL_BRANCHES, getBranches, getViewBranchId } from "@/lib/branches";
import { addDays, todayVN, vnDateTimeToISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { BranchSwitcher } from "./branch-switcher";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { BrandMark, Wordmark } from "./wordmark";

function Brand() {
  return (
    <Link href="/admin" aria-label="Aura Rental, về trang Hôm nay" className="flex h-10 items-center px-2 group-data-[collapsible=icon]:px-0">
      <Wordmark className="h-[21px] group-data-[collapsible=icon]:hidden" />
      <BrandMark className="hidden group-data-[collapsible=icon]:block" />
    </Link>
  );
}

export async function AppSidebar() {
  const staff = await getStaff();
  const [branches, viewBranchId] = await Promise.all([getBranches(), getViewBranchId(staff)]);
  const supabase = await createClient();
  const today = todayVN();

  // Số đếm trên menu: đơn chờ cọc, lịch thử hôm nay, váy cần gửi đi
  let pending = supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending");
  let fittings = supabase
    .from("fitting_appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "booked")
    .gte("starts_at", vnDateTimeToISO(today, "00:00"))
    .lt("starts_at", vnDateTimeToISO(addDays(today, 1), "00:00"));
  let transfers = supabase.from("transfers").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (viewBranchId) {
    pending = pending.eq("branch_id", viewBranchId);
    fittings = fittings.eq("branch_id", viewBranchId);
    transfers = transfers.eq("from_branch_id", viewBranchId);
  }
  const [p, f, t] = await Promise.all([pending, fittings, transfers]);

  const ownBranch = branches.find((b) => b.id === staff.branchId);
  const role = staff.role === "owner" ? "Chủ shop" : `Nhân viên ${ownBranch?.code ?? ""}`;

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <Brand />
        <BranchSwitcher
          branches={branches}
          value={viewBranchId ?? ALL_BRANCHES}
          subtitle={viewBranchId ? "Đang xem 1 cơ sở" : `Gộp ${branches.length} cơ sở`}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain counts={{ bookings: p.count ?? 0, fittings: f.count ?? 0, transfers: t.count ?? 0 }} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser name={staff.fullName || "Nhân viên"} role={role} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppSidebarSkeleton() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <Brand />
        <Skeleton className="h-12 rounded-lg" />
      </SidebarHeader>
      <SidebarContent className="gap-3 px-4 pt-3">
        {[70, 55, 62, 48, 66, 58, 52, 60].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-md" />
            <Skeleton className="h-4" style={{ width: `${w}%` }} />
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
