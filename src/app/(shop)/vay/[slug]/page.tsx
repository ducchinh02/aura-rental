import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DressThumb } from "@/components/admin/dress-thumb";
import { formatMoney } from "@/lib/format";
import { getShopInfo, getShopProduct, type ShopProduct } from "@/lib/queries/storefront";
import { OrderForm } from "./order-form";

export async function generateMetadata({ params }: PageProps<"/vay/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product) return { title: "Không tìm thấy váy" };
  return {
    title: product.name,
    description: product.description ?? `Thuê ${product.name}, xem lịch trống và đặt giữ váy online.`,
  };
}

export default function ProductPage({ params }: PageProps<"/vay/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductView params={params} />
      </Suspense>
    </div>
  );
}

async function ProductView({ params }: { params: PageProps<"/vay/[slug]">["params"] }) {
  const { slug } = await params;
  const [product, shop] = await Promise.all([getShopProduct(slug), getShopInfo()]);
  if (!product) notFound();

  return (
    <>
      <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Váy cho thuê
        </Link>
        <ChevronRight className="size-4" />
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      {/* Điện thoại: ảnh, tên → form đặt → chi tiết. Máy tính: ảnh + chi tiết bên trái, form bên phải */}
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_30rem] lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <div className="flex flex-col gap-6 lg:col-start-1">
          <Gallery product={product} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
            <p className="mt-1 text-muted-foreground">{[product.category, product.color].filter(Boolean).join(", ")}</p>
          </div>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <OrderForm product={product} branches={shop.branches} holdHours={shop.holdHours} bank={shop.bank} />
        </div>

        <ProductDetails product={product} branches={shop.branches} />
      </div>
    </>
  );
}

function Gallery({ product }: { product: ShopProduct }) {
  const [cover, ...rest] = product.images;
  const thumb = { name: product.name, color: product.color, category: product.category };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center rounded-2xl bg-brand-soft/60 p-4 sm:p-8">
        <DressThumb {...thumb} image={cover} className="w-full max-w-sm rounded-xl" />
      </div>
      {rest.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {rest.slice(0, 8).map((path) => (
            <DressThumb key={path} {...thumb} image={path} className="w-full rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDetails({ product, branches }: { product: ShopProduct; branches: { id: string; name: string }[] }) {
  const prices = branches.map((b) => ({ branch: b.name, ...product.prices[b.id] }));
  const samePrice = prices.every(
    (p) => p.price === prices[0].price && p.hourly === prices[0].hourly && p.extraDay === prices[0].extraDay,
  );

  return (
    <div className="flex flex-col gap-6 lg:col-start-1">
      {product.description && <p className="leading-relaxed whitespace-pre-line">{product.description}</p>}

      <dl className="divide-y rounded-xl border text-sm">
        {(samePrice ? prices.slice(0, 1) : prices).map((p) => (
          <div key={p.branch} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">{samePrice ? "Giá thuê" : `Giá tại ${p.branch}`}</dt>
            <dd className="tabular">
              <span className="font-medium">{formatMoney(p.price)}</span> / {product.rentalDays} ngày, thêm{" "}
              {formatMoney(p.extraDay)} mỗi ngày
              {p.hourly != null && (
                <span className="block">
                  <span className="font-medium">{formatMoney(p.hourly)}</span> / {product.hourlyHours} giờ, thêm{" "}
                  {formatMoney(p.extraHour)} mỗi giờ
                </span>
              )}
            </dd>
          </div>
        ))}
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Cọc giữ chỗ</dt>
          <dd className="tabular">
            {product.deposit > 0
              ? `${formatMoney(product.deposit)}, trừ vào tiền thuê khi nhận váy`
              : "Không cần cọc. Đặt xong shop gọi xác nhận với bạn."}
          </dd>
        </div>
        {product.security > 0 && (
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Thế chấp</dt>
            <dd className="tabular">{formatMoney(product.security)} khi nhận váy, hoàn lại khi trả</dd>
          </div>
        )}
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Size</dt>
          <dd>{product.sizes.join(", ")}</dd>
        </div>
        {product.occasions.length > 0 && (
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Hợp với</dt>
            <dd className="first-letter:uppercase">{product.occasions.join(", ")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-x-12">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-[36rem] w-full rounded-xl" />
    </div>
  );
}
