"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection } from "@/components/admin/field";
import { MoneyInput } from "@/components/admin/money-input";
import { slugify } from "@/lib/format";
import { productStatusLabel, type ProductStatus } from "@/lib/labels";
import { createProduct, updateProduct, type ProductInput } from "./actions";

type Props = {
  categories: { id: string; name: string }[];
  product?: ProductInput & { id: string };
  canEditPrice: boolean;
};

const NO_CATEGORY = "none";

export function ProductForm({ categories, product, canEditPrice }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [values, setValues] = useState<ProductInput>(
    product ?? {
      name: "",
      slug: "",
      category_id: null,
      status: "draft",
      color: "",
      occasions: [],
      description: "",
      base_price: 0,
      rental_days: 3,
      extra_day_price: 0,
      deposit_amount: 0,
      security_amount: 0,
      hourly_price: null,
      hourly_hours: 3,
      extra_hour_price: 0,
    },
  );
  const [occasions, setOccasions] = useState((product?.occasions ?? []).join(", "));
  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const priceLocked = Boolean(product) && !canEditPrice;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      ...values,
      occasions: occasions
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    };
    startTransition(async () => {
      if (product) {
        const result = await updateProduct(product.id, input);
        if (!result.ok) return void toast.error(result.error);
        toast.success("Đã lưu mẫu váy");
      } else {
        const result = await createProduct(input);
        if (!result.ok) return void toast.error(result.error);
        toast.success("Đã thêm mẫu váy. Tiếp theo, thêm ảnh và từng chiếc váy.");
        router.push(`/admin/vay/${result.data.id}`);
      }
    });
  }

  return (
    <Card className="gap-0 py-0">
      <form onSubmit={submit} className="divide-y">
        <FormSection title="Thông tin">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên mẫu váy" htmlFor="name">
              <Input
                id="name"
                value={values.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
                required
              />
            </Field>
            <Field label="Đường dẫn trên web" htmlFor="slug" hint={`Trang của váy: /vay/${values.slug || "…"}`}>
              <Input
                id="slug"
                value={values.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
                required
              />
            </Field>
            <Field label="Danh mục" htmlFor="category">
              <Select
                value={values.category_id ?? NO_CATEGORY}
                onValueChange={(v) => set("category_id", v === NO_CATEGORY ? null : v)}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Chưa phân loại</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hiển thị" htmlFor="status" hint="Chỉ mẫu đang hiển thị mới xuất hiện trên web cho khách.">
              <Select value={values.status} onValueChange={(v) => set("status", v as ProductStatus)}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(productStatusLabel) as ProductStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {productStatusLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Màu" htmlFor="color">
              <Input id="color" value={values.color ?? ""} onChange={(e) => set("color", e.target.value)} />
            </Field>
            <Field label="Dịp mặc" htmlFor="occasions" hint="Cách nhau bằng dấu phẩy, ví dụ: tiệc cưới, chụp ảnh">
              <Input id="occasions" value={occasions} onChange={(e) => setOccasions(e.target.value)} />
            </Field>
            <Field label="Mô tả" htmlFor="description" className="sm:col-span-2">
              <Textarea
                id="description"
                rows={3}
                value={values.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Giá thuê theo ngày"
          aside={priceLocked && <span className="text-xs text-muted-foreground">Chỉ chủ shop sửa được giá</span>}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Giá thuê gói" htmlFor="base_price">
              <MoneyInput
                id="base_price"
                value={values.base_price}
                onValueChange={(v) => set("base_price", v)}
                disabled={priceLocked}
              />
            </Field>
            <Field label="Số ngày của gói" htmlFor="rental_days">
              <Input
                id="rental_days"
                type="number"
                min={1}
                value={values.rental_days}
                onChange={(e) => set("rental_days", Number(e.target.value))}
                disabled={priceLocked}
              />
            </Field>
            <Field label="Phụ thu mỗi ngày thêm" htmlFor="extra_day_price">
              <MoneyInput
                id="extra_day_price"
                value={values.extra_day_price}
                onValueChange={(v) => set("extra_day_price", v)}
                disabled={priceLocked}
              />
            </Field>
            <Field label="Cọc giữ chỗ" htmlFor="deposit_amount">
              <MoneyInput
                id="deposit_amount"
                value={values.deposit_amount}
                onValueChange={(v) => set("deposit_amount", v)}
                disabled={priceLocked}
              />
            </Field>
            <Field label="Thế chấp khi nhận váy" htmlFor="security_amount">
              <MoneyInput
                id="security_amount"
                value={values.security_amount}
                onValueChange={(v) => set("security_amount", v)}
                disabled={priceLocked}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Thuê theo giờ"
          description="Cho khách thuê vài giờ, ví dụ chụp ảnh, dự tiệc ngắn. Khách nhận và trả tại shop."
          aside={
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={values.hourly_price !== null}
                disabled={priceLocked}
                onCheckedChange={(on) => set("hourly_price", on ? (values.hourly_price ?? 0) : null)}
                aria-label="Cho thuê theo giờ"
              />
              {values.hourly_price !== null ? "Đang bật" : "Đang tắt"}
            </label>
          }
        >
          {values.hourly_price !== null && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Giá gói giờ" htmlFor="hourly_price">
                <MoneyInput
                  id="hourly_price"
                  value={values.hourly_price ?? 0}
                  onValueChange={(v) => set("hourly_price", v)}
                  disabled={priceLocked}
                />
              </Field>
              <Field label="Số giờ của gói" htmlFor="hourly_hours" hint="Thuê ít hơn vẫn tính giá gói.">
                <Input
                  id="hourly_hours"
                  type="number"
                  min={1}
                  max={24}
                  value={values.hourly_hours}
                  onChange={(e) => set("hourly_hours", Number(e.target.value))}
                  disabled={priceLocked}
                />
              </Field>
              <Field label="Phụ thu mỗi giờ thêm" htmlFor="extra_hour_price" hint="Cũng là mức gợi ý khi khách trả muộn.">
                <MoneyInput
                  id="extra_hour_price"
                  value={values.extra_hour_price}
                  onValueChange={(v) => set("extra_hour_price", v)}
                  disabled={priceLocked}
                />
              </Field>
            </div>
          )}
        </FormSection>

        <div className="flex justify-end px-4 py-4 md:px-6">
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu…" : product ? "Lưu thay đổi" : "Thêm mẫu váy"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
