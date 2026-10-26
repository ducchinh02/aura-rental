import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";

// Client theo phiên đăng nhập của request (Server Component, Server Action, Route Handler)
export async function createClient() {
  // Dữ liệu theo phiên luôn đọc lúc có request; supabase-js gọi Date.now() khi kiểm tra token,
  // không được chạy trong bước prerender (kể cả runtime prefetch).
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component không ghi được cookie; proxy.ts đã làm mới phiên
          }
        },
      },
    },
  );
}
