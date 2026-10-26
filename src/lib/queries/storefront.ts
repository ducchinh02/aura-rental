import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sortSizes } from "@/lib/queries/catalog";
import { createPublicClient } from "@/lib/supabase/public";

// Dữ liệu trang khách ít đổi: cache theo giờ, trang quản trị gọi revalidateTag(CATALOG_TAG) khi sửa.
// Lịch trống của váy KHÔNG cache, trình duyệt tự tải và nghe Realtime.
export const CATALOG_TAG = "catalog";

export type ShopBranch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  mapUrl: string | null;
  open: string;
  close: string;
};

export type ShopInfo = {
  branches: ShopBranch[];
  holdHours: number;
  bank: { bin: string; account: string; holder: string } | null;
};

export async function getShopInfo(): Promise<ShopInfo> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const supabase = createPublicClient();
  const [{ data: branches }, { data: settings }] = await Promise.all([
    supabase.from("branches").select("id, name, address, phone, map_url, open_time, close_time").eq("is_active", true).order("code"),
    supabase.from("settings").select("hold_hours, bank_bin, bank_account, bank_holder").maybeSingle(),
  ]);

  return {
    branches: (branches ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      mapUrl: b.map_url,
      open: b.open_time.slice(0, 5),
      close: b.close_time.slice(0, 5),
    })),
    holdHours: settings?.hold_hours ?? 24,
    bank:
      settings?.bank_bin && settings.bank_account && settings.bank_holder
        ? { bin: settings.bank_bin, account: settings.bank_account, holder: settings.bank_holder }
        : null,
  };
}

/** Giá của một mẫu tại một cơ sở (đã áp giá riêng của cơ sở nếu có) */
export type BranchPrice = {
  price: number;
  extraDay: number;
  hourly: number | null;
  extraHour: number;
};

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  category: string | null;
  occasions: string[];
  images: string[];
  rentalDays: number;
  hourlyHours: number;
  /** 0 = mẫu không cần cọc: đặt xong chờ shop gọi xác nhận */
  deposit: number;
  security: number;
  sizes: string[];
  /** Theo id cơ sở */
  prices: Record<string, BranchPrice>;
};

const productSelect =
  "id, slug, name, description, color, occasions, base_price, rental_days, extra_day_price, hourly_price, hourly_hours, extra_hour_price, deposit_amount, requires_deposit, security_amount, categories(name), product_images(storage_path, is_cover, sort_order), inventory_items(size), product_branch_prices(branch_id, price, extra_day_price, hourly_price, extra_hour_price)" as const;

async function loadProducts(slug?: string): Promise<ShopProduct[]> {
  const supabase = createPublicClient();
  const { branches } = await getShopInfo();
  let query = supabase.from("products").select(productSelect).eq("status", "active").order("name");
  if (slug) query = query.eq("slug", slug);
  const { data } = await query;

  return (data ?? [])
    .map((p) => {
      const images = [...p.product_images].sort(
        (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
      );
      const prices = Object.fromEntries(
        branches.map((br) => {
          const own = p.product_branch_prices.find((bp) => bp.branch_id === br.id);
          return [
            br.id,
            {
              price: own?.price ?? p.base_price,
              extraDay: own?.extra_day_price ?? p.extra_day_price,
              hourly: own?.hourly_price ?? p.hourly_price,
              extraHour: own?.extra_hour_price ?? p.extra_hour_price,
            },
          ];
        }),
      );
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        color: p.color,
        category: p.categories?.name ?? null,
        occasions: p.occasions,
        // Ảnh bìa trước, còn lại theo thứ tự shop sắp
        images: images.map((i) => i.storage_path),
        rentalDays: p.rental_days,
        hourlyHours: p.hourly_hours,
        deposit: p.requires_deposit ? p.deposit_amount : 0,
        security: p.security_amount,
        // RLS chỉ trả về chiếc đang cho thuê của mẫu đang hiển thị
        sizes: sortSizes([...new Set(p.inventory_items.map((i) => i.size))]),
        prices,
      };
    })
    .filter((p) => p.sizes.length > 0);
}

export async function getCatalog(): Promise<ShopProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return loadProducts();
}

export async function getShopProduct(slug: string): Promise<ShopProduct | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const [product] = await loadProducts(slug);
  return product ?? null;
}
