import type { ReactNode } from "react";
import { Field as UIField, FieldDescription, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Ô nhập có nhãn + gợi ý, dựng trên Field của shadcn */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <UIField className={cn("min-w-0 gap-1.5", className)}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {hint && <FieldDescription className="text-xs">{hint}</FieldDescription>}
    </UIField>
  );
}

/** Một khối trong form dài: tiêu đề + mô tả, các khối ngăn bằng đường kẻ */
export function FormSection({
  title,
  description,
  children,
  aside,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
