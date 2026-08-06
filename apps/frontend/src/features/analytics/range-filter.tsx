"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalyticsRangeKey } from "@/types/dashboard";

export interface RangeOption {
  key: AnalyticsRangeKey;
  label: string;
}

interface RangeFilterProps {
  options: RangeOption[];
  value: AnalyticsRangeKey;
  onChange: (range: AnalyticsRangeKey) => void;
  ariaLabel: string;
}

export function RangeFilter({ options, value, onChange, ariaLabel }: RangeFilterProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-1 rounded-xl bg-muted p-1"
    >
      {options.map((option) => {
        const isActive = option.key === value;

        return (
          <Button
            key={option.key}
            type="button"
            variant={isActive ? "default" : "ghost"}
            aria-pressed={isActive}
            className={cn("h-11 rounded-lg px-4 sm:h-8 sm:px-2.5", isActive && "hover:bg-primary/80")}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
