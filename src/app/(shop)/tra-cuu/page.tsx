import { Suspense } from "react";
import type { Metadata } from "next";
import { getShopInfo } from "@/lib/queries/storefront";
import { LookupForm } from "./lookup-form";

export const metadata: Metadata = { title: "Tra cứu đơn" };

export default async function LookupPage() {
  const { bank } = await getShopInfo();
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Tra cứu đơn</h1>
      <p className="mt-2 text-muted-foreground">Nhập mã đơn (ví dụ AR-261026-01) và số điện thoại bạn dùng khi đặt.</p>
      <Suspense>
        <LookupForm bank={bank} />
      </Suspense>
    </div>
  );
}
