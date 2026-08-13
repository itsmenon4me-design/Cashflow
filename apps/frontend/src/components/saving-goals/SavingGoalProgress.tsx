"use client";

import { cn } from "@/lib/utils";

interface SavingGoalProgressProps {
  percentage: number;
  className?: string;
}

export function SavingGoalProgress({ percentage, className }: SavingGoalProgressProps) {
  const width = Math.min(100, Math.max(0, percentage));
  const done = percentage >= 100;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            done ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <p
        className={cn(
          "text-xs font-medium tabular-nums",
          done ? "text-emerald-500" : "text-muted-foreground"
        )}
      >
        {percentage.toFixed(0)}%
      </p>
    </div>
  );
}