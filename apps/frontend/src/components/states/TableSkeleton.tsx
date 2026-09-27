import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ className }: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[360px] items-center justify-center rounded-xl border border-border bg-card px-6 text-sm text-muted-foreground",
        className
      )}
    >
      Memuat data...
    </div>
  );
}