import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Trang khách không cần phiên đăng nhập, chỉ chạy cho khu vực nhân viên
export const config = {
  matcher: ["/admin/:path*", "/login"],
};
