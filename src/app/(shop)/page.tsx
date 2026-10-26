import { CalendarCheck, QrCode, Shirt } from "lucide-react";
import { getCatalog, getShopInfo } from "@/lib/queries/storefront";
import { CatalogGrid, type CatalogItem } from "./catalog-grid";

export default async function ShopHome() {
  const [products, shop] = await Promise.all([getCatalog(), getShopInfo()]);

  const items: CatalogItem[] = products.map((p) => {
    const prices = Object.values(p.prices);
    const hourly = prices.map((x) => x.hourly).filter((x): x is number => x != null);
    return {
      slug: p.slug,
      name: p.name,
      color: p.color,
      category: p.category,
      image: p.images[0] ?? null,
      sizes: p.sizes,
      fromPrice: Math.min(...prices.map((x) => x.price)),
      rentalDays: p.rentalDays,
      hourlyFrom: hourly.length ? Math.min(...hourly) : null,
      hourlyHours: p.hourlyHours,
      noDeposit: p.deposit === 0,
    };
  });

  return (
    <>
      <section className="bg-brand-soft">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Váy thiết kế cho thuê, xem lịch trống và giữ váy ngay
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground md:text-lg">
            Chọn váy và ngày mặc, lịch còn trống cập nhật trực tiếp. Nhận tại {shop.branches.length} cơ sở hoặc giao tận
            nơi.
          </p>
          <ol className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {(
              [
                [Shirt, "Chọn váy, size", "Lọc theo dịp, xem ảnh và giá"],
                [CalendarCheck, "Chọn ngày hoặc giờ", "Ngày đã kín được gạch sẵn"],
                [QrCode, "Chuyển cọc", `Quét QR trong ${shop.holdHours} giờ để giữ váy`],
              ] as const
            ).map(([Icon, title, text], i) => (
              <li key={title} className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm">
                  <span className="block font-medium">
                    {i + 1}. {title}
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <CatalogGrid items={items} />
      </section>
    </>
  );
}
