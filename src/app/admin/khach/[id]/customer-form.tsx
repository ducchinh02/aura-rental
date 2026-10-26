"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/field";
import { updateCustomer, type CustomerInput } from "../actions";

export function CustomerForm({ customerId, initial }: { customerId: string; initial: CustomerInput }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateCustomer(customerId, values);
          if (!result.ok) return void toast.error(result.error);
          toast.success("Đã lưu thông tin khách");
        });
      }}
    >
      <Field label="Tên" htmlFor="c-name">
        <Input id="c-name" value={values.full_name} onChange={(e) => set("full_name", e.target.value)} required />
      </Field>
      <Field label="Số điện thoại" htmlFor="c-phone">
        <Input id="c-phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} required />
      </Field>
      <Field label="Facebook" htmlFor="c-fb">
        <Input id="c-fb" value={values.facebook_url ?? ""} onChange={(e) => set("facebook_url", e.target.value)} />
      </Field>
      <Field label="Zalo" htmlFor="c-zalo">
        <Input id="c-zalo" value={values.zalo ?? ""} onChange={(e) => set("zalo", e.target.value)} />
      </Field>
      <Field label="Email" htmlFor="c-email">
        <Input id="c-email" type="email" value={values.email ?? ""} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Địa chỉ" htmlFor="c-address">
        <Input id="c-address" value={values.address ?? ""} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Ghi chú" htmlFor="c-note" hint="Số đo, sở thích, lưu ý khi cho thuê…">
        <Textarea id="c-note" rows={3} value={values.note ?? ""} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <Label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 font-normal">
        <span>
          Danh sách đen
          <span className="block text-xs text-muted-foreground">Hiện cảnh báo khi tạo đơn cho khách này.</span>
        </span>
        <Switch checked={values.is_blacklisted} onCheckedChange={(v) => set("is_blacklisted", v)} />
      </Label>
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "Đang lưu…" : "Lưu"}
      </Button>
    </form>
  );
}
