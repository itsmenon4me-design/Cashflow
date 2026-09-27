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
      role="status"
      aria-label="Memuat grafik"
      className={cn(
        "flex w-full items-center justify-center text-sm text-muted-foreground",
        heightClass,
      )}
    >
      Memuat grafik...
    </div>
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
      const fallback = window.setTimeout(() => setShow(true), 0);
      return () => window.clearTimeout(fallback);
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

/** Dashboard: monthly cashflow bar chart (real card = 356px). */
export const LazyCashflowChartCard = lazyChart(
  () => import("@/components/dashboard/cashflow-chart-card").then((m) => m.CashflowChartCard),
  "h-[356px]",
);

/** Dashboard: category distribution donut (real card = 344px). */
export const LazyCategoryDistributionCard = lazyChart(
  () =>
    import("@/components/dashboard/category-distribution-card").then(
      (m) => m.CategoryDistributionCard,
    ),
  "h-[344px]",
);

/** Dashboard + reports + analytics: income vs expense bars (real card = 380px). */
export const LazyIncomeExpenseChartCard = lazyChart(
  () =>
    import("@/components/dashboard/income-expense-chart-card").then(
      (m) => m.IncomeExpenseChartCard,
    ),
  "h-[380px]",
);

/** Reports + analytics: cashflow trend line (real card = 380px). */
export const LazyCashflowTrendChart = lazyChart(
  () => import("@/components/reports/cashflow-trend-chart").then((m) => m.CashflowTrendChart),
  "h-[380px]",
);

/** Reports + analytics: category breakdown donut (real card = 380px). */
export const LazyCategoryBreakdownCard = lazyChart(
  () =>
    import("@/components/reports/category-breakdown-card").then((m) => m.CategoryBreakdownCard),
  "h-[380px]",
);

/** Investments: allocation pie (real card = 344px). */
export const LazyAllocationPieCard = lazyChart(
  () => import("@/components/investments/AllocationPieCard").then((m) => m.AllocationPieCard),
  "h-[344px]",
);

/** Forecast: projected balance chart (real card = 412px). */
export const LazyForecastChart = lazyChart(
  () => import("@/features/forecast/components/forecast-chart").then((m) => m.ForecastChart),
  "h-[412px]",
);

/** Analytics: stacked expense-by-category-over-time bars (real card = 380px). */
export const LazyExpenseCategoryTrendCard = lazyChart(
  () =>
    import("@/components/analytics/expense-category-trend-card").then(
      (m) => m.ExpenseCategoryTrendCard,
    ),
  "h-[380px]",
);
