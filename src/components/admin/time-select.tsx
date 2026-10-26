"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Các mốc giờ "HH:MM" cách nhau `step` phút trong khoảng [from, to] */
export function timeOptions(from = "06:00", to = "23:00", step = 30) {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const out: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

/** Chọn giờ bằng danh sách (thay cho input type="time") */
export function TimeSelect({
  id,
  value,
  onChange,
  options = timeOptions(),
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const list = options.includes(value) || !value ? options : [...options, value].sort();
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full tabular", className)}>
        <SelectValue placeholder="Chọn giờ" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {list.map((t) => (
          <SelectItem key={t} value={t} className="tabular">
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
