import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DataLoadingStateProps {
  className?: string;
  label?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
}

export function DataLoadingState({
  className,
  label = "Memuat data...",
  title,
  description,
  icon,
}: DataLoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[360px] items-center justify-center rounded-xl bg-card px-6 py-16 text-center shadow-card ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-2xl bg-muted"
        >
          {icon ?? <span className="size-2 rounded-full bg-muted-foreground/70" />}
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{title ?? label}</p>
          <p className="min-h-5 text-sm text-muted-foreground">{description ?? "\u00a0"}</p>
        </div>
      </div>
    </div>
  );
}

export default DataLoadingState;
