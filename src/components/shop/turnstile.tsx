"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Có captcha hay không (chưa cấu hình site key khi chạy local) */
export const captchaEnabled = Boolean(SITE_KEY);

/**
 * Captcha Cloudflare Turnstile. Đổi `resetKey` để lấy token mới sau mỗi lần gửi
 * (token chỉ dùng được một lần).
 */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const callback = useRef(onToken);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !loaded || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: SITE_KEY,
      language: "vi",
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(null),
      "error-callback": () => callback.current(null),
    });
    widget.current = id;
    return () => {
      window.turnstile?.remove(id);
      widget.current = null;
    };
  }, [loaded]);

  useEffect(() => {
    if (resetKey === 0 || !widget.current) return;
    window.turnstile?.reset(widget.current);
    callback.current(null);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setLoaded(true)}
      />
      <div ref={box} className="min-h-[65px]" />
    </>
  );
}
