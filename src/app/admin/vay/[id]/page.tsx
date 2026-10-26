import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Layers, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthlyBarChart } from "@/components/admin/charts";
import { CodeBadge } from "@/components/admin/code-badge";
import { CustomerAvatar } from "@/components/admin/customer-avatar";
import { DressThumb } from "@/components/admin/dress-thumb";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { BookingStatusBadge, StatusBadge } from "@/components/admin/status";
import { getStaff } from "@/lib/auth";
import { getBranches } from "@/lib/branches";
import { addDays, diffDays, formatPeriod, periodOf, todayVN } from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import { formatMoney } from "@/lib/format";
import { productStatusLabel, productStatusTone, type Tone } from "@/lib/labels";
import { sortSizes } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityCalendar } from "../availability-calendar";
import { BranchPrices } from "../branch-prices";
import { ImageManager } from "../image-manager";
import { ItemsManager } from "../items-manager";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Mẫu váy" };

function parseRange(range: unknown) {
  const match = /^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)$/.exec(String(range));
  return match ? { start: match[1], end: match[2] } : null;
}

export default async function ProductPage({ params }: PageProps<"/admin/vay/[id]">) {
  const staff = await getStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const today = todayVN();
  const since = `${addDays(`${today.slice(0, 7)}-01`, -150).slice(0, 7)}-01`; // 6 tháng gần nhất

  const [{ data: product }, { data: categories }, branches] = await Promise.all([
    supabase
      .from("products")
      .select(
        "*, categories(name), product_images(id, storage_path, is_cover, sort_order), inventory_items(id, code, size, home_branch_id, status, condition_note), product_branch_prices(branch_id, price, extra_day_price, hourly_price, extra_hour_price)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
    getBranches(),
  ]);
  if (!product) notFound();

  const itemIds = product.inventory_items.map((i) => i.id);
  const [{ data: locations }, { data: usage }] = itemIds.length
    ? await Promise.all([
        supabase.from("item_locations").select("*").in("item_id", itemIds),
        supabase
          .from("booking_items")
          .select("item_id, price, blocked_period, is_active, bookings!inner(code, status, rental_unit, pickup_date, return_date, pickup_at, return_at, customers(full_name))")
          .in("item_id", itemIds)
          .neq("bookings.status", "cancelled")
          .or(`pickup_date.gte.${since},return_date.gte.${addDays(today, -7)}`, { referencedTable: "bookings" }),
      ])
    : [{ data: [] }, { data: [] }];

  const locationById = new Map((locations ?? []).map((l) => [l.item_id, l]));
  const branchCode = new Map(branches.map((b) => [b.id, b.code]));

  const sizeOrder = sortSizes([...new Set(product.inventory_items.map((i) => i.size))]);
  const items = [...product.inventory_items]
    .sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size) || a.code.localeCompare(b.code))
    .map((item) => {
      const loc = locationById.get(item.id);
      const [location, locationTone]: [string, Tone] = loc?.rented_booking_id
        ? ["Khách đang giữ", "sky"]
        : loc?.in_transit
          ? ["Đang chuyển", "amber"]
          : [`Ở ${branchCode.get(loc?.current_branch_id ?? item.home_branch_id) ?? ""}`, "emerald"];
      return { ...item, location, locationTone };
    });
  const activeUnits = items.filter((i) => i.status === "active").length;

  // Số chiếc bận mỗi ngày (60 ngày tới) để vẽ lịch còn trống
  const busy: Record<string, number> = {};
  for (const u of usage ?? []) {
    const r = parseRange(u.blocked_period);
    if (!u.is_active || !r) continue;
    for (let i = 0; i < diffDays(r.start, r.end); i++) {
      const d = addDays(r.start, i);
      if (d >= today && d <= addDays(today, 62)) busy[d] = (busy[d] ?? 0) + 1;
    }
  }

  // Lượt thuê và doanh thu theo tháng
  const months = Array.from({ length: 6 }, (_, i) => addDays(`${since}`, i * 31).slice(0, 7));
  const byMonth = new Map(months.map((m) => [m, { count: 0, revenue: 0 }]));
  for (const u of usage ?? []) {
    const m = byMonth.get(u.bookings.pickup_date.slice(0, 7));
    if (m) {
      m.count += 1;
      m.revenue += u.price;
    }
  }
  const total6m = [...byMonth.values()].reduce((s, m) => ({ count: s.count + m.count, revenue: s.revenue + m.revenue }), {
    count: 0,
    revenue: 0,
  });
  const recent = [...(usage ?? [])].sort((a, b) => b.bookings.pickup_date.localeCompare(a.bookings.pickup_date)).slice(0, 8);
  const rentedNow = items.filter((i) => i.locationTone === "sky").length;

  const manageableBranchIds = staff.role === "owner" ? branches.map((b) => b.id) : staff.branchId ? [staff.branchId] : [];
  const prefix = (product.slug.split("-").pop() ?? product.slug).slice(0, 3).toUpperCase();
  const cover = coverPath(product.product_images);

  return (
    <PageBody>
      <div className="flex flex-wrap items-center gap-4">
        <DressThumb
          name={product.name}
          color={product.color}
          category={product.categories?.name}
          image={cover}
          className="w-16 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-3">
                {product.name}
                <StatusBadge tone={productStatusTone[product.status]}>{productStatusLabel[product.status]}</StatusBadge>
              </span>
            }
            description={[
              product.categories?.name,
              product.color,
              `${formatMoney(product.base_price)} / ${product.rental_days} ngày`,
              product.hourly_price !== null && `${formatMoney(product.hourly_price)} / ${product.hourly_hours} giờ`,
            ]
              .filter(Boolean)
              .join(", ")}
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-4 md:gap-6">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="units">Từng chiếc ({items.length})</TabsTrigger>
          <TabsTrigger value="photos">Ảnh ({product.product_images.length})</TabsTrigger>
          <TabsTrigger value="info">Thông tin và giá</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4 md:gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Lượt thuê 6 tháng" value={total6m.count} caption="không tính đơn hủy" icon={CalendarCheck} tone="brand" />
            <StatCard title="Doanh thu 6 tháng" value={formatMoney(total6m.revenue)} caption="tiền thuê của mẫu này" icon={Wallet} tone="violet" />
            <StatCard
              title="Đang cho thuê"
              value={`${rentedNow}/${activeUnits}`}
              caption="chiếc khách đang giữ"
              icon={Layers}
              tone="sky"
            />
          </div>
          <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
            <MonthlyBarChart
              title="Lượt thuê theo tháng"
              description="Tính theo ngày khách nhận váy"
              valueLabel="Lượt thuê"
              data={months.map((m) => ({ month: `T${Number(m.slice(5))}`, value: byMonth.get(m)!.count }))}
            />
            <Card>
              <CardHeader>
                <CardTitle>Lịch còn trống</CardTitle>
                <CardDescription>Đã tính ngày giặt, ship và chuyển cơ sở</CardDescription>
              </CardHeader>
              <CardContent>
                <AvailabilityCalendar busy={busy} total={activeUnits} today={today} />
              </CardContent>
            </Card>
          </div>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Đơn gần đây</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {recent.length ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 text-xs">Đơn</TableHead>
                      <TableHead className="text-xs">Khách</TableHead>
                      <TableHead className="text-xs">Thời gian</TableHead>
                      <TableHead className="text-right text-xs">Giá thuê</TableHead>
                      <TableHead className="pr-5 text-xs">Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((u) => (
                      <TableRow key={`${u.bookings.code}-${u.item_id}`}>
                        <TableCell className="pl-5">
                          <Link href={`/admin/don/${u.bookings.code}`}>
                            <CodeBadge className="hover:bg-muted-foreground/15">{u.bookings.code}</CodeBadge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <CustomerAvatar name={u.bookings.customers?.full_name ?? "?"} size="sm" />
                            {u.bookings.customers?.full_name}
                          </span>
                        </TableCell>
                        <TableCell className="tabular">{formatPeriod(periodOf(u.bookings))}</TableCell>
                        <TableCell className="text-right tabular">{formatMoney(u.price)}</TableCell>
                        <TableCell className="pr-5">
                          <BookingStatusBadge status={u.bookings.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-5 text-sm text-muted-foreground">Mẫu này chưa có đơn nào.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units">
          <Card>
            <CardHeader>
              <CardTitle>Từng chiếc váy</CardTitle>
              <CardDescription>
                Mỗi chiếc thật là một dòng. Váy đang ở cơ sở khác kho gốc sẽ được chuyển về sau khi khách trả.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ItemsManager
                productId={product.id}
                codePrefix={prefix}
                items={items}
                branches={branches}
                manageableBranchIds={manageableBranchIds}
                defaultBranchId={manageableBranchIds[0] ?? branches[0]?.id ?? ""}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle>Ảnh</CardTitle>
              <CardDescription>Ảnh bìa hiện ở danh sách váy trên web. Nên chụp dọc, tỉ lệ 3:4.</CardDescription>
            </CardHeader>
            <CardContent>
              <ImageManager
                productId={product.id}
                images={[...product.product_images].sort((a, b) => a.sort_order - b.sort_order)}
                preview={{ name: product.name, color: product.color, category: product.categories?.name }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="flex flex-col gap-4 md:gap-6">
          <ProductForm
            categories={categories ?? []}
            canEditPrice={staff.role === "owner"}
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              category_id: product.category_id,
              status: product.status,
              color: product.color ?? "",
              occasions: product.occasions,
              description: product.description ?? "",
              base_price: product.base_price,
              rental_days: product.rental_days,
              extra_day_price: product.extra_day_price,
              deposit_amount: product.deposit_amount,
              security_amount: product.security_amount,
              hourly_price: product.hourly_price,
              hourly_hours: product.hourly_hours,
              extra_hour_price: product.extra_hour_price,
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle>Giá riêng theo cơ sở</CardTitle>
              <CardDescription>Ô để trống thì cơ sở dùng giá chung ở trên.</CardDescription>
            </CardHeader>
            <CardContent>
              <BranchPrices
                productId={product.id}
                base={{
                  price: product.base_price,
                  extraDay: product.extra_day_price,
                  hourly: product.hourly_price,
                  extraHour: product.extra_hour_price,
                }}
                editable={staff.role === "owner"}
                rows={branches.map((b) => {
                  const override = product.product_branch_prices.find((p) => p.branch_id === b.id);
                  return {
                    branchId: b.id,
                    branchName: b.name,
                    price: override?.price ?? null,
                    extra_day_price: override?.extra_day_price ?? null,
                    hourly_price: override?.hourly_price ?? null,
                    extra_hour_price: override?.extra_hour_price ?? null,
                  };
                })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
