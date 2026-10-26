import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service role: chỉ dùng trên server cho form của khách (đặt váy, đặt lịch thử)
// sau khi đã kiểm tra captcha, và cho việc chủ shop tạo tài khoản nhân viên.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
