import { fabricColor, isDarkFabric, silhouetteFor, type Silhouette } from "@/lib/fabric";
import { productImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

// Bản vẽ phẳng (flat sketch) dáng váy, viewBox 60×80
const PATHS: Record<Silhouette, { body: string; seams: string }> = {
  aline: {
    body: "M25 6 L23.5 15 Q30 20 36.5 15 L35 6 L36.5 15 L35.5 31 L48 71 Q30 75.5 12 71 L24.5 31 L23.5 15 Z",
    seams: "M24.5 31 Q30 32.5 35.5 31 M30 33 L30 73",
  },
  mermaid: {
    body: "M21.5 13 Q30 16.5 38.5 13 L36.5 30 Q38.5 46 35.5 57 Q41 66 47 76 Q30 79 13 76 Q19 66 24.5 57 Q21.5 46 23.5 30 Z",
    seams: "M23.5 30 Q30 31.5 36.5 30 M24.5 57 Q30 58.5 35.5 57",
  },
  ballgown: {
    body: "M22.5 12 Q30 16 37.5 12 L36 29 Q52 46 55 76 Q30 80.5 5 76 Q8 46 24 29 Z",
    seams: "M24 29 Q30 31 36 29 M30 31 Q27 55 22 78 M30 31 Q33 55 38 78",
  },
};

type Props = {
  name: string;
  image?: string | null;
  color?: string | null;
  category?: string | null;
  className?: string;
};

/** Ảnh váy dọc 3:4; chưa có ảnh thì vẽ phác dáng váy theo màu vải */
export function DressThumb({ name, image, color, category, className }: Props) {
  if (image) {
    return (
      // Ảnh từ Storage, kích thước nhỏ trong trang quản trị
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={productImageUrl(image)}
        alt={name}
        loading="lazy"
        className={cn("aspect-[3/4] shrink-0 rounded-sm bg-muted object-cover", className)}
      />
    );
  }

  const fabric = fabricColor(color);
  const dark = isDarkFabric(fabric);
  const shape = PATHS[silhouetteFor(category, name)];

  return (
    <div
      role="img"
      aria-label={name}
      className={cn("relative aspect-[3/4] shrink-0 overflow-hidden rounded-sm", className)}
      style={{ backgroundColor: `color-mix(in oklab, ${fabric} 16%, #fbf9f8)` }}
    >
      <svg viewBox="0 0 60 80" aria-hidden className="absolute inset-0 size-full p-[8%]">
        <path d={shape.body} fill={fabric} stroke="#231825" strokeOpacity={0.55} strokeWidth={0.7} strokeLinejoin="round" />
        <path
          d={shape.seams}
          fill="none"
          stroke={dark ? "#ffffff" : "#231825"}
          strokeOpacity={dark ? 0.35 : 0.3}
          strokeWidth={0.5}
          strokeDasharray="1.2 1"
        />
      </svg>
    </div>
  );
}
