import "server-only";

const LOCAL_SUPABASE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

/**
 * Kiểm tra captcha Cloudflare Turnstile của form khách.
 * Chưa cấu hình TURNSTILE_SECRET_KEY thì chỉ cho qua khi chạy với Supabase local.
 */
export async function verifyCaptcha(token: string | null | undefined, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return LOCAL_SUPABASE.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("verifyCaptcha", error);
    return false;
  }
}
