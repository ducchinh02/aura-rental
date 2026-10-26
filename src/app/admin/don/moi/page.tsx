import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/page-header";
import { getStaff } from "@/lib/auth";
import { getBranches, getDefaultBranchId } from "@/lib/branches";
import { getProductOptions } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { addDays, dateOfTimestamp, todayVN } from "@/lib/dates";
import { BookingForm, type BookingFormDefaults } from "./booking-form";

export const metadata: Metadata = { title: "Tạo đơn" };

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function NewBookingPage({ searchParams }: PageProps<"/admin/don/moi">) {
  const staff = await getStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  const [allBranches, products, defaultBranchId] = await Promise.all([
    getBranches(),
    getProductOptions(),
    getDefaultBranchId(staff),
  ]);
  const branches = staff.role === "owner" ? allBranches : allBranches.filter((b) => b.id === staff.branchId);

  const date = param(sp.date);
  const pickupDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : addDays(todayVN(), 1);
  const defaults: BookingFormDefaults = {
    branchId: defaultBranchId ?? branches[0]?.id ?? "",
    unit: param(sp.unit) === "hour" ? "hour" : "day",
    pickupDate,
    returnDate: addDays(pickupDate, 2),
    source: "facebook",
    items: [],
    customer: { phone: "", full_name: "", facebook_url: "", zalo: "" },
    customerNote: "",
    fittingId: null,
  };

  // Tạo đơn từ trang khách hàng
  const phone = param(sp.phone);
  if (phone) defaults.customer.phone = phone;

  // Tạo đơn từ ô trống trên lịch váy
  const itemId = param(sp.item);
  if (itemId) {
    const { data: item } = await supabase
      .from("inventory_items")
      .select("product_id, size")
      .eq("id", itemId)
      .maybeSingle();
    if (item) defaults.items = [{ productId: item.product_id, size: item.size }];
  }

  // Tạo đơn sau buổi thử đồ
  const fittingId = param(sp.fitting);
  if (fittingId) {
    const { data: fitting } = await supabase
      .from("fitting_appointments")
      .select("id, branch_id, starts_at, customer_note, customers(phone, full_name, facebook_url, zalo), fitting_items(product_id, size)")
      .eq("id", fittingId)
      .maybeSingle();
    if (fitting) {
      const c = fitting.customers;
      defaults.fittingId = fitting.id;
      defaults.customer = {
        phone: c?.phone ?? "",
        full_name: c?.full_name ?? "",
        facebook_url: c?.facebook_url ?? "",
        zalo: c?.zalo ?? "",
      };
      defaults.customerNote = fitting.customer_note ?? "";
      defaults.items = fitting.fitting_items.map((i) => ({ productId: i.product_id, size: i.size ?? "" }));
      if (branches.some((b) => b.id === fitting.branch_id)) defaults.branchId = fitting.branch_id;
      if (!date) {
        defaults.pickupDate = addDays(dateOfTimestamp(fitting.starts_at), 1);
        defaults.returnDate = addDays(defaults.pickupDate, 2);
      }
    }
  }

  return (
    <PageBody>
      <PageHeader title="Tạo đơn" description="Dùng cho khách nhắn Facebook, Zalo hoặc đến shop." />
      <BookingForm branches={branches} products={products} defaults={defaults} />
    </PageBody>
  );
}
