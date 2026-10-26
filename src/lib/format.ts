const money = new Intl.NumberFormat("vi-VN");

/** 450.000 ₫ */
export function formatMoney(amount: number | null | undefined) {
  return `${money.format(amount ?? 0)} ₫`;
}

/** "450.000" / "450000" / "450k" → 450000 */
export function parseMoney(input: FormDataEntryValue | string | null | undefined) {
  if (input == null) return 0;
  const raw = String(input).trim().toLowerCase();
  if (raw === "") return 0;
  const thousands = raw.endsWith("k");
  const digits = raw.replace(/[^\d]/g, "");
  const value = digits === "" ? 0 : Number(digits);
  return thousands ? value * 1000 : value;
}

/** Giống private.normalize_phone trong DB: "+84 912 345 678" → "0912345678" */
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  return /^84\d{9,10}$/.test(digits) ? `0${digits.slice(2)}` : digits;
}

export function isValidPhone(input: string) {
  return /^0\d{9,10}$/.test(normalizePhone(input));
}

export function formatPhone(phone: string) {
  return phone.length === 10
    ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
    : phone;
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Rút gọn cho trục biểu đồ: 11.100.000 → "11,1tr", 850.000 → "850k" */
export function formatCompactMoney(amount: number) {
  if (Math.abs(amount) >= 1_000_000) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(amount / 1_000_000)}tr`;
  }
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}
