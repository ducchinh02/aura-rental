import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { toneClass, type Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: ReactNode;
  caption?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  badge?: ReactNode;
  className?: string;
};

/** Thẻ số liệu: nhãn + icon nền nhạt ở góc, số lớn, chú thích nhỏ */
export function StatCard({ title, value, caption, icon: Icon, tone = "zinc", badge, className }: Props) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      <CardHeader>
        <CardDescription className="font-medium">{title}</CardDescription>
        <CardAction>
          <span className={cn("flex size-8 items-center justify-center rounded-lg", toneClass[tone].soft)}>
            <Icon className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-3xl leading-none font-semibold tracking-tight tabular">{value}</span>
          {badge}
        </div>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  );
}
