import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DressThumb } from "@/components/admin/dress-thumb";
import { EmptyBlock, PageBody, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status";
import { getStaff } from "@/lib/auth";
import { getBranches } from "@/lib/branches";
import { addDays, todayVN } from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import { formatMoney } from "@/lib/format";
import { productStatusLabel, productStatusTone, type ProductStatus } from "@/lib/labels";
import { sortSizes } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { ProductFilters } from "./product-filters";
import { ProductsTable, type ProductRow } from "./products-table";

export const metadata: Metadata = { title: "Kho váy" };

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "current", label: "Đang dùng" },
  { value: "active", label: "Đang hiển thị" },
  { value: "draft", label: "Nháp" },
  { value: "archived", label: "Đã ẩn" },
];

export default async function ProductsPage({ searchParams }: PageProps<"/admin/vay">) {
  await getStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "current";
  const category = typeof sp.category === "string" ? sp.category : "";
  const view = sp.view === "list" ? "list" : "grid";

  const supabase = await createClient();
  const [{ data: all }, { data: categories }, { data: rentals }, branches] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, status, color, base_price, rental_days, category_id, categories(name), product_images(storage_path, is_cover), inventory_items(size, status, home_branch_id)",
      )
      .order("name"),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase
      .from("booking_items")
      .select("inventory_items(product_id), bookings!inner(status, pickup_date)")
      .neq("bookings.status", "cancelled")
      .gte("bookings.pickup_date", addDays(todayVN(), -90)),
    getBranches(),
  ]);

  const rentalCount = new Map<string, number>();
  for (const r of rentals ?? []) {
    const id = r.inventory_items.product_id;
    rentalCount.set(id, (rentalCount.get(id) ?? 0) + 1);
  }

  const products = all ?? [];
  const inTab = (s: ProductStatus, tab: string) => (tab === "current" ? s !== "archived" : s === tab);
  const tabs = STATUS_TABS.map((t) => ({ ...t, count: products.filter((p) => inTab(p.status, t.value)).length }));
  const term = q.toLowerCase();
  const visible = products.filter(
    (p) => inTab(p.status, status) && (!category || p.category_id === category) && (!term || p.name.toLowerCase().includes(term)),
  );

  const rows: ProductRow[] = visible.map((p) => {
    const items = p.inventory_items.filter((i) => i.status !== "retired");
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      color: p.color,
      category: p.categories?.name ?? null,
      image: coverPath(p.product_images),
      price: p.base_price,
      rentalDays: p.rental_days,
      stock: branches.map((b) => ({
        code: b.code,
        sizes: sortSizes(items.filter((i) => i.home_branch_id === b.id).map((i) => i.size)),
      })),
      units: items.length,
      rentals: rentalCount.get(p.id) ?? 0,
    };
  });

  return (
    <PageBody>
      <PageHeader
        title="Kho váy"
        description="Mẫu váy, từng chiếc theo size và cơ sở, giá thuê."
        actions={
          <Button asChild>
            <Link href="/admin/vay/moi">
              <Plus />
              Thêm mẫu váy
            </Link>
          </Button>
        }
      />
      <Card className="gap-5">
        <CardHeader>
          <ProductFilters tabs={tabs} status={status} categories={categories ?? []} category={category} view={view} q={q} />
        </CardHeader>
        <CardContent className={view === "list" ? "px-0" : undefined}>
          {rows.length === 0 ? (
            <EmptyBlock
              className={view === "list" ? "mx-5" : undefined}
              icon={Shirt}
              title={q ? `Không có mẫu nào khớp "${q}"` : "Chưa có mẫu váy nào ở mục này"}
              action={
                !q && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/vay/moi">Thêm mẫu váy</Link>
                  </Button>
                )
              }
            />
          ) : view === "list" ? (
            <ProductsTable rows={rows} />
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/vay/${p.id}`} className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                    <div className="relative">
                      <DressThumb {...p} className="w-full rounded-none" />
                      {p.status !== "active" && (
                        <StatusBadge tone={productStatusTone[p.status]} className="absolute top-2 left-2">
                          {productStatusLabel[p.status]}
                        </StatusBadge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      <p className="truncate font-medium group-hover:text-primary">{p.name}</p>
                      <p className="text-sm tabular">
                        <span className="font-semibold">{formatMoney(p.price)}</span>
                        <span className="text-muted-foreground"> / {p.rentalDays} ngày</span>
                      </p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {p.stock.map((s) => (
                          <span key={s.code}>
                            {s.code} <span className="font-medium text-foreground">{s.sizes.join(" ") || "—"}</span>
                          </span>
                        ))}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
