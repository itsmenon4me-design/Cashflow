"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";
import { cn } from "@/lib/utils";

interface YearStepperProps {
  value: number;
  onChange: (year: number) => void;
  /** Hard floor (e.g. the year the user's account was created). */
  minYear?: number;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Stepper year picker (`‹ 2026 ›`) replacing the old static dropdown:
 * - Lower bound: cannot go below `minYear`.
 * - Upper bound: unlimited — free to step forward as far as needed.
 */
export function YearStepper({
  value,
  onChange,
  minYear,
  disabled = false,
  className,
  ariaLabel,
}: YearStepperProps) {
  const canDecrement = !disabled && (minYear === undefined || value > minYear);

  return (
    <div
      role="group"
      aria-label={ariaLabel ?? uiText.budgets.year}
      className={cn(
        "inline-flex h-9 w-full items-center justify-between rounded-xl border border-border bg-card px-1",
        disabled && "opacity-50",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={uiText.budgets.previousYear}
        title={uiText.budgets.previousYear}
        disabled={!canDecrement}
        onClick={() => canDecrement && onChange(value - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="select-none text-center text-sm font-medium tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={uiText.budgets.nextYear}
        title={uiText.budgets.nextYear}
        disabled={disabled}
        onClick={() => onChange(value + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
