import "server-only";
import { coverPath } from "@/lib/fabric";
import { createClient } from "@/lib/supabase/server";

export type ProductOption = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  sizes: string[];
  color: string | null;
  category: string | null;
  image: string | null;
  /** Có giá thuê theo giờ */
  hourly: boolean;
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];

export function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b, "vi");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Mẫu váy còn cho thuê kèm các size đang có chiếc sẵn sàng */
export async function getProductOptions(): Promise<ProductOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, status, color, hourly_price, categories(name), product_images(storage_path, is_cover), inventory_items(size, status), product_branch_prices(hourly_price)",
    )
    .neq("status", "archived")
    .order("name");

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    color: p.color,
    category: p.categories?.name ?? null,
    image: coverPath(p.product_images),
    hourly: p.hourly_price !== null || p.product_branch_prices.some((bp) => bp.hourly_price !== null),
    sizes: sortSizes([
      ...new Set(p.inventory_items.filter((i) => i.status === "active").map((i) => i.size)),
    ]),
  }));
}
