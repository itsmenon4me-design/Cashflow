"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

/**
 * Async wrappers around every recharts-based card.
 *
 * recharts (+ its d3 deps) is the largest third-party chunk in the app
 * (~340KB raw). Two-stage deferral keeps it off the critical path on
 * low-end devices:
 *
 *   1. next/dynamic moves the code into an async chunk (never in the eager
 *      route graph).
 *   2. WhenNearViewport only MOUNTS the dynamic component once the card's
 *      slot approaches the viewport (or after a short idle fallback).
 *      Without this stage, the dynamic import() fires at mount during
 *      hydration and the chunk gets fetched on every page view anyway,
 *      costing parse+compile on weak CPUs before first interaction.
 *
 * `ssr: false` avoids recharts ResponsiveContainer hydration mismatches; the
 * placeholder reserves each chart's real plot height so nothing shifts when
 * the real card swaps in. `memo` prevents sibling state updates (KPI fetches
 * settling one by one) from reconciling chart subtrees.
 */

function ChartPlaceholder({ heightClass }: { heightClass: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("w-full animate-pulse rounded-xl bg-accent/50", heightClass)}
    />
  );
}

function WhenNearViewport({
  children,
  heightClass,
}: {
  children: ReactNode;
  heightClass: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (old browsers / jsdom): render immediately.
    // Real deferral matters on modern browsers, all of which support IO.
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "256px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {show ? (
        children
      ) : (
        <ChartPlaceholder heightClass={heightClass} />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChartProps = any;

function lazyChart(
  loader: () => Promise<unknown>,
  heightClass: string,
): (props: AnyChartProps) => ReactNode {
  const DynamicChart = dynamic(loader as never, {
    ssr: false,
    loading: () => <ChartPlaceholder heightClass={heightClass} />,
  });

  const ChartWithGate = (props: AnyChartProps) => (
    <WhenNearViewport heightClass={heightClass}>
      <DynamicChart {...props} />
    </WhenNearViewport>
  );
  ChartWithGate.displayName = "LazyChart";

  return memo(ChartWithGate);
}

/** Dashboard: monthly cashflow area chart (plot ≈ h-72). */
export const LazyCashflowChartCard = lazyChart(
  () => import("@/components/dashboard/cashflow-chart-card").then((m) => m.CashflowChartCard),
  "h-64",
);

/** Dashboard: category distribution donut (plot ≈ h-64). */
export const LazyCategoryDistributionCard = lazyChart(
  () =>
    import("@/components/dashboard/category-distribution-card").then(
      (m) => m.CategoryDistributionCard,
    ),
  "h-56",
);

/** Dashboard + reports + analytics: income vs expense bars (plot ≈ h-64). */
export const LazyIncomeExpenseChartCard = lazyChart(
  () =>
    import("@/components/dashboard/income-expense-chart-card").then(
      (m) => m.IncomeExpenseChartCard,
    ),
  "h-56",
);

/** Reports + analytics: cashflow trend line (plot ≈ h-72). */
export const LazyCashflowTrendChart = lazyChart(
  () => import("@/components/reports/cashflow-trend-chart").then((m) => m.CashflowTrendChart),
  "h-64",
);

/** Reports + analytics: category breakdown donut (plot ≈ h-64). */
export const LazyCategoryBreakdownCard = lazyChart(
  () =>
    import("@/components/reports/category-breakdown-card").then((m) => m.CategoryBreakdownCard),
  "h-56",
);

/** Investments: allocation pie (plot ≈ h-72). */
export const LazyAllocationPieCard = lazyChart(
  () => import("@/components/investments/AllocationPieCard").then((m) => m.AllocationPieCard),
  "h-64",
);

/** Forecast: projected balance chart (plot ≈ h-80). */
export const LazyForecastChart = lazyChart(
  () => import("@/features/forecast/components/forecast-chart").then((m) => m.ForecastChart),
  "h-72",
);

/** Analytics: stacked expense-by-category-over-time bars (plot ~ h-72). */
export const LazyExpenseCategoryTrendCard = lazyChart(
  () =>
    import("@/components/analytics/expense-category-trend-card").then(
      (m) => m.ExpenseCategoryTrendCard,
    ),
  "h-64",
);
