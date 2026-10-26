"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { isActive, navGroups, type NavKey } from "./nav-config";

export function NavMain({ counts }: { counts: Partial<Record<NavKey, number>> }) {
  return <NavMainList counts={counts} pathname={usePathname()} />;
}

/** Bản không đọc URL, làm fallback khi chưa có pathname */
export function NavMainList({ counts, pathname }: { counts: Partial<Record<NavKey, number>>; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return navGroups.map((group, index) => (
    <SidebarGroup key={index}>
      {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const count = item.badge ? counts[item.badge] : undefined;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className="data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border"
                >
                  <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
                    <item.icon className={active ? "text-primary" : undefined} />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                {!!count && <SidebarMenuBadge className="bg-primary/10 text-primary">{count}</SidebarMenuBadge>}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
