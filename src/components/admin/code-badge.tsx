import { cn } from "@/lib/utils";

/** Mã đơn / mã váy dạng chữ máy, nền xám nhạt */
export function CodeBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md bg-muted px-1.5 font-mono text-[0.6875rem] font-medium text-muted-foreground tabular",
        className,
      )}
    >
      {children}
    </span>
  );
}
