import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wordmark } from "@/components/admin/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-brand-soft px-4 py-12">
      {/* Nền xanh phấn của logo, thêm vài quầng sáng như bầu trời mây */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -top-48 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-white/70 blur-[120px]" />
        <span className="absolute -bottom-56 -left-32 size-[32rem] rounded-full bg-sky-200/60 blur-[110px]" />
        <span className="absolute -right-24 bottom-10 size-[24rem] rounded-full bg-white/60 blur-[100px]" />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center gap-8">
        <Wordmark className="h-7" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg">Đăng nhập</CardTitle>
            <CardDescription>Dùng email và mật khẩu chủ shop đã cấp cho bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Trang quản lý dành cho nhân viên các cơ sở Aura Rental.</p>
      </div>
    </main>
  );
}
