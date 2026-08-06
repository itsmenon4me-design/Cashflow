import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface SkeletonContainerProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export function SkeletonContainer({
  compact = false,
  className,
  children,
  ...props
}: SkeletonContainerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-card",
        compact ? "min-h-24" : "min-h-32",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}