"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CalendarPlus, Plus, ReceiptText, Search, Shirt, Tags, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { navGroups } from "./nav-config";

const actions = [
  { label: "Tạo đơn", href: "/admin/don/moi", icon: Plus },
  { label: "Đặt lịch thử", href: "/admin/thu-do", icon: CalendarPlus },
  { label: "Thêm mẫu váy", href: "/admin/vay/moi", icon: Shirt },
  { label: "Tạo phiếu chuyển váy", href: "/admin/chuyen-vay", icon: ArrowLeftRight },
];

/** Ô "Tìm hoặc làm nhanh" trên header, mở bằng ⌘K / Ctrl K */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };
  const q = query.trim();

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-9 justify-start px-0 text-muted-foreground max-sm:justify-center sm:w-64 sm:px-3"
      >
        <Search />
        <span className="hidden flex-1 text-left font-normal sm:inline">Tìm đơn, khách, váy…</span>
        <KbdGroup className="hidden sm:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Tìm hoặc làm nhanh" description="Gõ mã đơn, SĐT, tên khách hoặc tên váy">
        <Command>
        <CommandInput placeholder="Gõ mã đơn, SĐT, tên khách, tên váy…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Không có lệnh phù hợp.</CommandEmpty>
          {q && (
            <CommandGroup heading="Tìm kiếm">
              <CommandItem value={`tim-don ${q}`} onSelect={() => go(`/admin/don?status=all&q=${encodeURIComponent(q)}`)}>
                <ReceiptText />
                Tìm đơn “{q}”
              </CommandItem>
              <CommandItem value={`tim-khach ${q}`} onSelect={() => go(`/admin/khach?q=${encodeURIComponent(q)}`)}>
                <Users />
                Tìm khách “{q}”
              </CommandItem>
              <CommandItem value={`tim-vay ${q}`} onSelect={() => go(`/admin/vay?q=${encodeURIComponent(q)}`)}>
                <Tags />
                Tìm mẫu váy “{q}”
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Làm nhanh">
            {actions.map((a) => (
              <CommandItem key={a.href + a.label} onSelect={() => go(a.href)}>
                <a.icon />
                {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Đi tới">
            {navGroups.flatMap((g) => g.items).map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
