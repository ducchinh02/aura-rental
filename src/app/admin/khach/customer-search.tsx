"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function CustomerSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  return (
    <form
      className="w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        router.replace(q ? `/admin/khach?q=${encodeURIComponent(q)}` : "/admin/khach", { scroll: false });
      }}
    >
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="Tên hoặc số điện thoại, nhấn Enter để tìm"
          aria-label="Tìm khách"
        />
      </InputGroup>
    </form>
  );
}
