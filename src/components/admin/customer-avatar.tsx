import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toneClass, type Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONES: Tone[] = ["brand", "sky", "violet", "emerald", "amber"];

/** "Nguyễn Thị Lan" → "NL": chữ đầu của họ và tên */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

export function CustomerAvatar({
  name,
  size = "default",
  className,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className={cn("text-xs font-semibold", toneClass[toneFor(name)].soft)}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
