// Màu vải từ ô "Màu" của mẫu váy (chữ tự do) → mã màu để vẽ bản phác dáng váy khi chưa có ảnh.
// Thứ tự quan trọng: "xanh navy" phải khớp navy trước "xanh".
const FABRICS: { match: RegExp; hex: string }[] = [
  { match: /đen|black/i, hex: "#2b2a2e" },
  { match: /navy|tím than/i, hex: "#26305a" },
  { match: /đỏ|red|wine|rượu|burgundy|mận/i, hex: "#7e2233" },
  { match: /trắng|ivory|ngà|white/i, hex: "#efe8da" },
  { match: /champagne|sâm panh/i, hex: "#e3cfae" },
  { match: /kem|\bbe\b|beige|nude/i, hex: "#e6d5c3" },
  { match: /hồng|pink|blush/i, hex: "#e9b9be" },
  { match: /tím|lilac|lavender|purple/i, hex: "#a593c2" },
  { match: /xanh lá|sage|olive|rêu|green|bạc hà|mint/i, hex: "#8fa68b" },
  { match: /xanh|blue/i, hex: "#6c8cbf" },
  { match: /vàng|gold|yellow/i, hex: "#d6b15a" },
  { match: /bạc|silver|xám|ghi|grey|gray/i, hex: "#b6b4ba" },
];

export function fabricColor(color: string | null | undefined) {
  if (!color) return "#d9cfcf";
  return FABRICS.find((f) => f.match.test(color))?.hex ?? "#d9cfcf";
}

export function isDarkFabric(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

export type Silhouette = "aline" | "mermaid" | "ballgown";

/** Dáng váy để phác: váy cưới → bồng, dạ hội → đuôi cá, còn lại → xoè chữ A */
export function silhouetteFor(category: string | null | undefined, name: string): Silhouette {
  const text = `${category ?? ""} ${name}`.toLowerCase();
  if (/cưới|wedding|công chúa/.test(text)) return "ballgown";
  if (/dạ hội|đuôi cá|evening|gown/.test(text)) return "mermaid";
  return "aline";
}

/** Ảnh bìa của mẫu (ưu tiên ảnh đánh dấu bìa) */
export function coverPath(images: { storage_path: string; is_cover: boolean }[] | null | undefined) {
  if (!images?.length) return null;
  return (images.find((i) => i.is_cover) ?? images[0]).storage_path;
}
