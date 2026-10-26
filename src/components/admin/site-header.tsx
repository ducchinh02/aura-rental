"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandMenu } from "./command-menu";
import { navGroups, subPageLabel } from "./nav-config";

const sectionByHref = new Map(navGroups.flatMap((g) => g.items).map((i) => [i.href, i.label]));

function crumbsFor(pathname: string) {
  const parts = pathname.split("/").filter(Boolean); // ["admin", "don", "AR-..."]
  if (parts.length <= 1) return [{ href: "/admin", label: "Hôm nay" }];

  const sectionHref = `/${parts.slice(0, 2).join("/")}`;
  const crumbs = [{ href: sectionHref, label: sectionByHref.get(sectionHref) ?? parts[1] }];
  if (parts.length > 2) {
    const last = decodeURIComponent(parts[2]);
    const isId = /^[0-9a-f-]{36}$/i.test(last);
    crumbs.push({
      href: pathname,
      label: subPageLabel[pathname] ?? (isId ? (parts[1] === "khach" ? "Hồ sơ khách" : "Chi tiết") : last),
    });
  }
  return crumbs;
}

function Crumbs({ pathname }: { pathname: string }) {
  const crumbs = crumbsFor(pathname);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
            <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden sm:inline-flex" : "truncate"}>
              {i < crumbs.length - 1 ? (
                <BreadcrumbLink asChild>
                  <Link href={c.href}>{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function HeaderBar({ pathname }: { pathname: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/95 px-3 backdrop-blur md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Crumbs pathname={pathname} />
      <div className="ml-auto flex items-center gap-2">
        <CommandMenu />
        <Button asChild size="sm" className="h-9">
          <Link href="/admin/don/moi">
            <Plus />
            <span className="hidden sm:inline">Tạo đơn</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}

export function SiteHeader() {
  return <HeaderBar pathname={usePathname()} />;
}

/** Hiện trong lúc chờ URL (prerender) */
export function SiteHeaderFallback() {
  return <HeaderBar pathname="/admin" />;
}
