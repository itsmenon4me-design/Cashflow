import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonContainer } from "@/components/states/SkeletonContainer";
import { cn } from "@/lib/utils";

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <SkeletonContainer className={cn("h-full", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="flex items-center justify-center gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-16" />
        ))}
      </div>
    </SkeletonContainer>
  );
}