import {
  ArrowLeftRight,
  ChartColumnBig,
  CalendarRange,
  House,
  ReceiptText,
  Settings,
  Shirt,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavKey = "bookings" | "fittings" | "transfers";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: NavKey };

export const navGroups: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Hôm nay", icon: House },
      { href: "/admin/don", label: "Đơn thuê", icon: ReceiptText, badge: "bookings" },
      { href: "/admin/lich", label: "Lịch váy", icon: CalendarRange },
      { href: "/admin/thu-do", label: "Thử đồ", icon: Shirt, badge: "fittings" },
      { href: "/admin/chuyen-vay", label: "Chuyển váy", icon: ArrowLeftRight, badge: "transfers" },
    ],
  },
  {
    label: "Danh mục",
    items: [
      { href: "/admin/vay", label: "Kho váy", icon: Tags },
      { href: "/admin/khach", label: "Khách hàng", icon: Users },
    ],
  },
  {
    label: "Quản lý",
    items: [
      { href: "/admin/doanh-thu", label: "Doanh thu", icon: ChartColumnBig },
      { href: "/admin/cai-dat", label: "Cài đặt", icon: Settings },
    ],
  },
];

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Tên trang con trong breadcrumb */
export const subPageLabel: Record<string, string> = {
  "/admin/don/moi": "Tạo đơn",
  "/admin/vay/moi": "Thêm mẫu váy",
};
