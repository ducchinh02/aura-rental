import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, PackageCheck, Truck, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeBadge } from "@/components/admin/code-badge";
import { DressThumb } from "@/components/admin/dress-thumb";
import { EmptyBlock, PageBody, PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status";
import { canManageBranch, getStaff } from "@/lib/auth";
import { getBranches, getViewBranchId } from "@/lib/branches";
import { addDays, formatDate, formatDateTime, todayVN } from "@/lib/dates";
import { coverPath } from "@/lib/fabric";
import { transferStatusLabel, transferStatusTone } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { TransferTabs } from "./transfer-tabs";
import { NewTransferDialog, TransferAction } from "./transfer-controls";

export const metadata: Metadata = { title: "Chuyển váy" };

const transferSelect =
  "id, status, due_date, from_branch_id, to_branch_id, note, sent_at, received_at, inventory_items(code, size, products(name, color, categories(name), product_images(storage_path, is_cover))), bookings(code, pickup_date)" as const;

export default async function TransfersPage({ searchParams }: PageProps<"/admin/chuyen-vay">) {
  const staff = await getStaff();
  const sp = await searchParams;
  const tab = sp.tab === "transit" || sp.tab === "done" ? sp.tab : "send";
  const [branches, branchId] = await Promise.all([getBranches(), getViewBranchId(staff)]);
  const supabase = await createClient();
  const today = todayVN();

  const [{ data: open }, { data: recent }, { data: itemRows }, { data: locations }] = await Promise.all([
    supabase.from("transfers").select(transferSelect).in("status", ["pending", "in_transit"]).order("due_date"),
    supabase
      .from("transfers")
      .select(transferSelect)
      .in("status", ["received", "cancelled"])
      .gte("created_at", `${addDays(today, -14)}T00:00:00+07:00`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("inventory_items").select("id, code, size, products(name)").neq("status", "retired").order("code"),
    supabase.from("item_locations").select("item_id, current_branch_id, in_transit, rented_booking_id"),
  ]);

  const code = new Map(branches.map((b) => [b.id, b.code]));
  const involves = (t: { from_branch_id: string; to_branch_id: string }) =>
    !branchId || t.from_branch_id === branchId || t.to_branch_id === branchId;
  const toSend = (open ?? []).filter((t) => t.status === "pending" && involves(t));
  const inTransit = (open ?? []).filter((t) => t.status === "in_transit" && involves(t));
  const done = (recent ?? []).filter(involves);
  const late = toSend.filter((t) => t.due_date < today).length;
  const list = tab === "send" ? toSend : tab === "transit" ? inTransit : done;

  const locationById = new Map((locations ?? []).map((l) => [l.item_id, l]));
  const itemOptions = (itemRows ?? []).map((i) => {
    const loc = locationById.get(i.id);
    return {
      id: i.id,
      code: i.code,
      size: i.size,
      productName: i.products.name,
      location: loc?.rented_booking_id ? "khách giữ" : loc?.in_transit ? "đang chuyển" : `ở ${code.get(loc?.current_branch_id ?? "") ?? "?"}`,
    };
  });

  return (
    <PageBody>
      <PageHeader
        title="Chuyển váy"
        description="Cơ sở gửi bấm “Đã gửi” khi giao váy cho người chuyển, cơ sở nhận bấm “Đã nhận” khi váy tới."
        actions={
          <NewTransferDialog
            items={itemOptions}
            branches={branches.filter((b) => b.id !== branchId || branches.length === 1)}
            defaultDate={addDays(today, 1)}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Cần gửi đi"
          value={toSend.length}
          caption="phiếu chờ cơ sở gửi"
          icon={ArrowLeftRight}
          tone="amber"
          badge={late > 0 && <StatusBadge tone="red">{late} trễ hạn</StatusBadge>}
        />
        <StatCard title="Đang trên đường" value={inTransit.length} caption="chờ cơ sở nhận xác nhận" icon={Truck} tone="sky" />
        <StatCard title="Đã xong 2 tuần qua" value={done.filter((t) => t.status === "received").length} caption="phiếu đã nhận" icon={PackageCheck} tone="emerald" />
      </div>

      <Card className="gap-4">
        <CardHeader>
          <TransferTabs
            value={tab}
            tabs={[
              { value: "send", label: "Cần gửi", count: toSend.length },
              { value: "transit", label: "Đang chuyển", count: inTransit.length },
              { value: "done", label: "2 tuần gần đây", count: done.length },
            ]}
          />
        </CardHeader>
        <CardContent className="px-0">
          {list.length === 0 ? (
            <EmptyBlock
              className="mx-5"
              icon={PackageCheck}
              title={tab === "send" ? "Không có váy nào chờ gửi" : tab === "transit" ? "Không có váy nào đang chuyển" : "Chưa có phiếu nào gần đây"}
              description="Phiếu tự tạo khi đơn ở cơ sở này dùng váy có kho gốc ở cơ sở kia."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 text-xs">Váy</TableHead>
                  <TableHead className="text-xs">Tuyến</TableHead>
                  <TableHead className="text-xs">Cần có trước</TableHead>
                  <TableHead className="hidden text-xs md:table-cell">Cho đơn</TableHead>
                  <TableHead className="text-xs">Trạng thái</TableHead>
                  <TableHead className="pr-5 text-right text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((t) => {
                  const overdue = t.status === "pending" && t.due_date < today;
                  const action =
                    t.status === "pending" && canManageBranch(staff, t.from_branch_id) ? (
                      <div className="flex justify-end gap-2">
                        {!t.bookings && <TransferAction transferId={t.id} status="cancelled" label="Hủy phiếu" variant="ghost" />}
                        <TransferAction transferId={t.id} status="in_transit" label="Đã gửi" />
                      </div>
                    ) : t.status === "in_transit" && canManageBranch(staff, t.to_branch_id) ? (
                      <TransferAction transferId={t.id} status="received" label="Đã nhận" />
                    ) : null;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="py-3 pl-5">
                        <div className="flex items-center gap-3">
                          <DressThumb
                            name={t.inventory_items.products.name}
                            color={t.inventory_items.products.color}
                            category={t.inventory_items.products.categories?.name}
                            image={coverPath(t.inventory_items.products.product_images)}
                            className="w-9 rounded-md"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.inventory_items.products.name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              Size {t.inventory_items.size}
                              <CodeBadge>{t.inventory_items.code}</CodeBadge>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {code.get(t.from_branch_id)}
                          <ArrowLeftRight className="size-3.5 text-muted-foreground" />
                          {code.get(t.to_branch_id)}
                        </span>
                      </TableCell>
                      <TableCell className={cn("tabular", overdue && "font-medium text-red-600")}>
                        <span className="flex items-center gap-1.5">
                          {overdue && <TriangleAlert className="size-3.5" />}
                          {formatDate(t.due_date)}
                        </span>
                        {t.status !== "pending" && (t.received_at || t.sent_at) && (
                          <span className="text-xs text-muted-foreground">
                            {t.received_at ? `nhận ${formatDateTime(t.received_at)}` : `gửi ${formatDateTime(t.sent_at!)}`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.bookings ? (
                          <Link href={`/admin/don/${t.bookings.code}`}>
                            <CodeBadge className="hover:bg-muted-foreground/15">{t.bookings.code}</CodeBadge>
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t.note || "Chuyển tay"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={transferStatusTone[t.status]}>{transferStatusLabel[t.status]}</StatusBadge>
                      </TableCell>
                      <TableCell className="pr-5 text-right">{action}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
