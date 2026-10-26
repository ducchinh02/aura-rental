"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Điều một khách đang chọn, chia sẻ qua presence (không có thông tin cá nhân) */
export type Watching = { size: string; from: string | null; to: string | null };

/** Tin DB phát khi lịch của mẫu đổi: size và khoảng ngày bị ảnh hưởng */
export type AvailabilityChange = { size?: string; from?: string | null; to?: string | null; at: number };

export type LiveStatus = "connecting" | "live" | "offline";

/**
 * Nghe kênh Realtime "availability:<productId>" (private, chỉ DB được phát tin):
 * - `version` tăng mỗi khi lịch của mẫu đổi, khi kết nối lại hoặc khi khách quay lại tab,
 *   form dùng nó để tải lại ngày trống / khung giờ / giá
 * - `others`: những khách khác đang mở mẫu này và đang chọn size, ngày nào
 */
export function useLiveAvailability(productId: string, size: string, from: string | null, to: string | null) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [version, setVersion] = useState(0);
  const [lastChange, setLastChange] = useState<AvailabilityChange | null>(null);
  const [others, setOthers] = useState<Watching[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const watchingRef = useRef<Watching>({ size, from, to });

  useEffect(() => {
    const supabase = createClient();
    const me = crypto.randomUUID();
    const channel = supabase.channel(`availability:${productId}`, {
      config: { private: true, presence: { key: me } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "changed" }, ({ payload }) => {
        setLastChange({ ...(payload as Omit<AvailabilityChange, "at">), at: Date.now() });
        setVersion((v) => v + 1);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Watching>();
        setOthers(
          Object.entries(state)
            .filter(([key]) => key !== me)
            .map(([, metas]) => metas[metas.length - 1]),
        );
      });

    let closed = false;
    // Kênh private cần gửi token (khách dùng khoá publishable) trước khi vào kênh
    supabase.realtime.setAuth().then(() => {
      if (closed) return;
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("live");
          channel.track(watchingRef.current);
          // Có thể đã lỡ tin trong lúc mất kết nối
          setVersion((v) => v + 1);
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("offline");
        }
      });
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") setVersion((v) => v + 1);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisible);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [productId]);

  // Báo cho khách khác biết mình đang chọn gì (gộp các lần đổi liên tiếp)
  useEffect(() => {
    watchingRef.current = { size, from, to };
    if (status !== "live") return;
    const timer = setTimeout(() => channelRef.current?.track({ size, from, to }), 400);
    return () => clearTimeout(timer);
  }, [size, from, to, status]);

  return { status, version, lastChange, others };
}
