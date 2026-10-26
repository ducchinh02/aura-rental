import type { Metadata } from "next";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { getStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  AccountsManager,
  BranchActiveSwitch,
  BranchForm,
  CategoryManager,
  NewBranchDialog,
  SettingsForm,
} from "./settings-forms";

export const metadata: Metadata = { title: "Cài đặt" };

function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Ai được làm gì: khớp với RLS trong supabase/migrations/*_rls.sql và các Server Action */
const PERMISSIONS: { action: string; owner: string; staff: string }[] = [
  { action: "Xem đơn, lịch váy, khách, doanh thu", owner: "Mọi cơ sở", staff: "Mọi cơ sở" },
  { action: "Tạo đơn, đổi trạng thái, sửa ngày, hủy đơn", owner: "Mọi cơ sở", staff: "Cơ sở mình" },
  { action: "Ghi nhận tiền thu / hoàn", owner: "Mọi cơ sở", staff: "Cơ sở mình" },
  { action: "Sửa, xoá khoản tiền đã ghi", owner: "Có", staff: "Không" },
  { action: "Sửa giá thuê trên từng đơn", owner: "Mọi cơ sở", staff: "Cơ sở mình" },
  { action: "Thêm mẫu váy, ảnh, danh mục", owner: "Có", staff: "Có" },
  { action: "Sửa giá mẫu váy, giá riêng theo cơ sở", owner: "Có", staff: "Không" },
  { action: "Thêm chiếc váy, đổi tình trạng, đổi kho gốc", owner: "Mọi cơ sở", staff: "Váy kho gốc cơ sở mình" },
  { action: "Xác nhận đã gửi / đã nhận váy chuyển", owner: "Mọi cơ sở", staff: "Cơ sở gửi / cơ sở nhận" },
  { action: "Đặt và cập nhật lịch thử", owner: "Mọi cơ sở", staff: "Cơ sở mình" },
  { action: "Cài đặt vận hành, cơ sở, tài khoản", owner: "Có", staff: "Chỉ xem" },
];

const hhmm = (time: string) => time.slice(0, 5);

/** CS1, CS2 → gợi ý CS3 */
function nextBranchCode(codes: string[]) {
  const max = Math.max(0, ...codes.map((c) => Number(/^CS(\d+)$/.exec(c)?.[1] ?? 0)));
  return `CS${max + 1}`;
}

export default async function SettingsPage() {
  const staff = await getStaff();
  const isOwner = staff.role === "owner";
  const supabase = await createClient();

  const [{ data: settings }, { data: branches }, { data: categories }, { data: profiles }] = await Promise.all([
    supabase.from("settings").select("*").single(),
    supabase.from("branches").select("*").order("code"),
    supabase.from("categories").select("id, name, products(count)").order("sort_order").order("name"),
    supabase.from("profiles").select("id, full_name, phone, role, branch_id, is_active").order("created_at"),
  ]);

  // Email nằm ở auth.users, chỉ đọc được bằng service role
  let emails = new Map<string, string>();
  if (isOwner) {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
    emails = new Map((data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  }

  return (
    <PageBody>
      <PageHeader
        title="Cài đặt"
        description={
          isOwner ? "Thông số vận hành, các cơ sở, danh mục, tài khoản và phân quyền." : "Chỉ chủ shop sửa được các mục này. Bạn vẫn quản lý được danh mục váy."
        }
      />
      <Tabs defaultValue="ops" className="gap-4 md:gap-6">
        <TabsList>
          <TabsTrigger value="ops">Vận hành</TabsTrigger>
          <TabsTrigger value="branches">Cơ sở</TabsTrigger>
          <TabsTrigger value="categories">Danh mục</TabsTrigger>
          {isOwner && <TabsTrigger value="accounts">Tài khoản</TabsTrigger>}
          <TabsTrigger value="permissions">Phân quyền</TabsTrigger>
        </TabsList>
        <TabsContent value="ops">
        {settings && (
          <Panel
            title="Vận hành"
            description="Các con số này quyết định váy bị khoá lịch bao lâu trước và sau mỗi lượt thuê."
          >
            <SettingsForm
              editable={isOwner}
              initial={{
                cleaning_days: settings.cleaning_days,
                transfer_days: settings.transfer_days,
                ship_days_local: settings.ship_days_local,
                ship_days_province: settings.ship_days_province,
                hold_hours: settings.hold_hours,
                hourly_buffer_minutes: settings.hourly_buffer_minutes,
                late_fee_per_day: settings.late_fee_per_day,
                bank_bin: settings.bank_bin ?? "",
                bank_account: settings.bank_account ?? "",
                bank_holder: settings.bank_holder ?? "",
              }}
            />
          </Panel>
        )}
        </TabsContent>

        <TabsContent value="branches" className="flex flex-col gap-4 md:gap-6">
        {isOwner && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {(branches ?? []).filter((b) => b.is_active).length} cơ sở đang hoạt động. Váy có thể chuyển qua lại giữa các cơ sở.
            </p>
            <NewBranchDialog suggestedCode={nextBranchCode((branches ?? []).map((b) => b.code))} />
          </div>
        )}
        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        {(branches ?? []).map((b) => (
          <Panel
            key={b.id}
            className={b.is_active ? undefined : "opacity-70"}
            title={b.name}
            description={`Mã cơ sở ${b.code}`}
            action={isOwner ? <BranchActiveSwitch branchId={b.id} name={b.name} active={b.is_active} /> : undefined}
          >
            <BranchForm
              branchId={b.id}
              editable={isOwner}
              initial={{
                name: b.name,
                address: b.address ?? "",
                phone: b.phone ?? "",
                map_url: b.map_url ?? "",
                open_time: hhmm(b.open_time),
                close_time: hhmm(b.close_time),
                fitting_slot_minutes: b.fitting_slot_minutes,
                fitting_capacity: b.fitting_capacity,
              }}
            />
          </Panel>
        ))}
        </div>
        </TabsContent>

        <TabsContent value="categories" className="max-w-2xl">
        <Panel title="Danh mục váy" description="Bấm vào tên để sửa.">
          <CategoryManager
            categories={(categories ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              productCount: c.products[0]?.count ?? 0,
            }))}
          />
        </Panel>
        </TabsContent>

        {isOwner && (
          <TabsContent value="accounts">
          <Panel title="Tài khoản" description="Tài khoản bị khoá không đăng nhập được nữa. Lịch sử đơn vẫn giữ nguyên.">
            <AccountsManager
              currentUserId={staff.id}
              branches={(branches ?? []).filter((b) => b.is_active).map((b) => ({ id: b.id, name: b.name, code: b.code }))}
              accounts={(profiles ?? []).map((p) => ({
                id: p.id,
                email: emails.get(p.id) ?? "",
                full_name: p.full_name,
                phone: p.phone,
                role: p.role,
                branch_id: p.branch_id,
                is_active: p.is_active,
              }))}
            />
          </Panel>
          </TabsContent>
        )}

        <TabsContent value="permissions" className="max-w-4xl">
          <Panel
            title="Phân quyền"
            description="Hai vai trò. Quyền được kiểm tra ở cả giao diện, server và database, nên không vượt quyền được bằng cách gọi thẳng."
          >
            <div className="-mx-5">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-xs">Việc</TableHead>
                    <TableHead className="text-xs">Chủ shop</TableHead>
                    <TableHead className="pr-5 text-xs">Nhân viên</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSIONS.map((p) => (
                    <TableRow key={p.action}>
                      <TableCell className="pl-5 whitespace-normal">{p.action}</TableCell>
                      <TableCell className="text-muted-foreground">{p.owner}</TableCell>
                      <TableCell className="pr-5 text-muted-foreground whitespace-normal">{p.staff}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
