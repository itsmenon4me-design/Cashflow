import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  titleWidth?: string;
  subtitleWidth?: string;
  action?: ReactNode;
  className?: string;
}

export function PageSkeleton({
  titleWidth = "w-56",
  subtitleWidth = "w-40",
  action,
  className,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className={cn("h-7", titleWidth)} />
          <Skeleton className={cn("h-4", subtitleWidth)} />
        </div>
        {action}
      </div>
      <Skeleton className="h-px w-full" />
    </div>
  );
}