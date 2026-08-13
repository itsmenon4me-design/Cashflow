"use client";

import { usageTone, type UsageTone } from "@/features/budgets/constants";
import { cn } from "@/lib/utils";

const toneClasses: Record<UsageTone, { bar: string; text: string }> = {
  safe: { bar: "bg-emerald-500", text: "text-emerald-500" },
  warning: { bar: "bg-amber-500", text: "text-amber-500" },
  danger: { bar: "bg-red-500", text: "text-red-500" },
};

interface BudgetProgressProps {
  percentage: number;
  className?: string;
}

export function BudgetProgress({ percentage, className }: BudgetProgressProps) {
  const tone = usageTone(percentage);
  const width = Math.min(100, Math.max(0, percentage));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", toneClasses[tone].bar)}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className={cn("text-xs font-medium tabular-nums", toneClasses[tone].text)}>
        {percentage.toFixed(0)}%
      </p>
    </div>
  );
}