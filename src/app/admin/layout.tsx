import type { Metadata } from "next";
import { Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, AppSidebarSkeleton } from "@/components/admin/app-sidebar";
import { SiteHeader, SiteHeaderFallback } from "@/components/admin/site-header";

export const metadata: Metadata = {
  title: { default: "Quản lý", template: "%s | Aura Rental" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
