"use client";

import { useTransition } from "react";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { setViewBranch } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

type Branch = { id: string; name: string; code: string };

function BranchMark({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[0.6875rem] font-semibold text-primary-foreground",
        className,
      )}
    >
      {code === "all" ? <Store className="size-4" /> : code}
    </span>
  );
}

/** Đổi cơ sở đang xem (lưu vào cookie, áp cho mọi trang quản trị) */
export function BranchSwitcher({ branches, value, subtitle }: { branches: Branch[]; value: string; subtitle: string }) {
  const { isMobile } = useSidebar();
  const [pending, startTransition] = useTransition();
  const current = branches.find((b) => b.id === value);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={pending}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <BranchMark code={current?.code ?? "all"} />
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">{current?.name ?? "Tất cả cơ sở"}</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              </span>
              <ChevronsUpDown className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Xem dữ liệu của</DropdownMenuLabel>
            {[{ id: "all", name: "Tất cả cơ sở", code: "all" }, ...branches].map((b, index) => (
              <div key={b.id}>
                {index === 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => startTransition(() => setViewBranch(b.id))} className="gap-2 p-2">
                  <BranchMark code={b.code} className="size-6 rounded-md text-[0.625rem]" />
                  {b.name}
                  {(current?.id ?? "all") === b.id && <Check className="ml-auto" />}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
