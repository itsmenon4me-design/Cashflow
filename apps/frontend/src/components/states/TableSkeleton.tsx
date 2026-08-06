import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 6, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-card",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div className="grid grid-cols-6 gap-4 border-b border-border bg-muted/40 px-6 py-3">
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-full" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-6 gap-4 border-b border-border/50 px-6 py-4 last:border-b-0"
            >
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <Skeleton
                  key={columnIndex}
                  className={cn("h-3.5", columnIndex === 0 ? "w-3/4" : "w-full")}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}