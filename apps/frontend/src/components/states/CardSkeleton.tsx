import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonContainer } from "@/components/states/SkeletonContainer";
import { cn } from "@/lib/utils";

interface CardSkeletonProps {
  className?: string;
  rows?: number;
  variant?: "stat" | "list";
}

export function CardSkeleton({ className, rows = 1, variant = "stat" }: CardSkeletonProps) {
  return (
    <SkeletonContainer className={cn("h-full", className)}>
      {variant === "list" ? (
        Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-6 w-28" />
            <div className="flex gap-1 border-t pt-3">
              {Array.from({ length: 4 }, (_, actionIndex) => (
                <Skeleton key={actionIndex} className="size-8 rounded-md" />
              ))}
            </div>
          </div>
        ))
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-2/5" />
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-full" />
          ))}
        </>
      )}
    </SkeletonContainer>
  );
}