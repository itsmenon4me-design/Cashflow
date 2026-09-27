import type { HTMLAttributes } from "react";

interface SkeletonContainerProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export function SkeletonContainer({
  children,
  compact,
  ...props
}: SkeletonContainerProps) {
  return (
    <div
      {...props}
      data-compact={compact || undefined}
    >
      {children}
    </div>
  );
}