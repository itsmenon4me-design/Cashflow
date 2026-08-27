import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional icon component */
  icon?: ReactNode;
  /** Optional action button element */
  actionButton?: ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * Reusable empty state component.
 * Displays an optional icon, title, description and an optional action button.
 */
export function EmptyState({
  title,
  description,
  icon,
  actionButton,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
  "flex flex-col items-center justify-center gap-4 overflow-hidden rounded-xl bg-card px-6 py-16 text-center shadow-card ring-1 ring-foreground/10",
  className
      )}
    >
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actionButton && <div>{actionButton}</div>}
    </div>
  );
}

export default EmptyState;