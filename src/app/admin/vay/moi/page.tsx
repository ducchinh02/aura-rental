import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Thêm mẫu váy" };

export default async function NewProductPage() {
  await getStaff();
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("sort_order");

  return (
    <PageBody>
      <PageHeader title="Thêm mẫu váy" description="Lưu thông tin mẫu trước, sau đó thêm ảnh và từng chiếc váy theo size." />
      <ProductForm categories={categories ?? []} canEditPrice />
    </PageBody>
  );
}
