/* eslint-disable @next/next/no-img-element -- logo PNG nhỏ trong /public, không cần tối ưu qua next/image */
import { cn } from "@/lib/utils";

/** Logo chữ "AURA RENTAL" (tỉ lệ 637×86). Đặt chiều cao bằng className, ví dụ h-5 */
export function Wordmark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <img
      src={inverted ? "/brand/aura-rental-logo-white.png" : "/brand/aura-rental-logo.png"}
      alt="Aura Rental"
      width={637}
      height={86}
      className={cn("h-5 w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** Biểu tượng chữ "A" trên nền xanh phấn, dùng khi không đủ chỗ cho logo chữ */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/aura-mark.png"
      alt="Aura Rental"
      width={128}
      height={128}
      className={cn("size-8 shrink-0 rounded-lg select-none", className)}
      draggable={false}
    />
  );
}
