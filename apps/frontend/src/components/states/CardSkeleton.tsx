import { cn } from "@/lib/utils";

interface CardSkeletonProps {
  className?: string;
  rows?: number;
  variant?: "stat" | "list";
}

export function CardSkeleton({ className, variant = "stat" }: CardSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[360px] items-center justify-center rounded-xl border border-border bg-card px-6 text-sm text-muted-foreground",
        variant === "stat" && "min-h-[116px]",
        className
      )}
    >
      Memuat data...
    </div>
  );
}