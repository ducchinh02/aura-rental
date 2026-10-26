import Link from "next/link";
import { Clock, MapPin, Phone } from "lucide-react";
import { Wordmark } from "@/components/admin/wordmark";
import { formatPhone } from "@/lib/format";
import { getShopInfo } from "@/lib/queries/storefront";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label="Aura Rental, về trang chủ">
            <Wordmark className="h-4 sm:h-5" />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="rounded-md px-3 py-2 font-medium hover:bg-muted">
              Váy cho thuê
            </Link>
            <Link href="/tra-cuu" className="rounded-md px-3 py-2 font-medium hover:bg-muted">
              Tra cứu đơn
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <ShopFooter />
    </div>
  );
}

async function ShopFooter() {
  const { branches } = await getShopInfo();
  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_2fr]">
        <div>
          <Wordmark className="h-4" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Cho thuê váy thiết kế. Đặt online, giữ váy ngay, nhận tại shop hoặc giao tận nơi.
          </p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2">
          {branches.map((b) => (
            <li key={b.id} className="flex flex-col gap-1.5 text-sm">
              <p className="font-medium">{b.name}</p>
              {b.address && (
                <p className="flex gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  {b.mapUrl ? (
                    <a href={b.mapUrl} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
                      {b.address}
                    </a>
                  ) : (
                    b.address
                  )}
                </p>
              )}
              {b.phone && (
                <p className="flex gap-2 text-muted-foreground">
                  <Phone className="mt-0.5 size-4 shrink-0" />
                  <a href={`tel:${b.phone}`} className="tabular hover:text-foreground">
                    {formatPhone(b.phone)}
                  </a>
                </p>
              )}
              <p className="flex gap-2 text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0" />
                Mở cửa {b.open} – {b.close}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
