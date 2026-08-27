"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import CenteredEmptyState from "@/components/states/CenteredEmptyState";
import { categoryLabel } from "@/lib/categories";
import { formatCurrencyCents, formatCompactCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import { categoryService } from "@/services/category.service";
import {
  transactionService,
  type TransactionListParams,
} from "@/services/transaction.service";
import type { TransactionDTO } from "@/types/backend";

interface ExpenseCategoryTrendCardProps {
  range: { startDate: string; endDate: string };
}

const PAGE_LIMIT = 100;
/** Safety cap: 8 pages × 100 tx covers realistic personal ranges. */
const MAX_PAGES = 8;
/** Buckets above this switch from daily to monthly columns. */
const DAILY_MAX_SPAN_DAYS = 62;

/**
 * Series palette — EXISTING tokens only (no new colors): distinct hues for up
 * to five categories plus a quiet neutral for the "Other" remainder.
 */
const CATEGORY_COLORS = [
  "var(--chart-3)",
  "var(--chart-1)",
  "var(--success)",
  "var(--info)",
  "var(--warning)",
];
const OTHER_COLOR = "var(--chart-5)";
const TOP_CATEGORIES = 5;

type BucketMap = Map<string, Map<string, number>>;

function bucketKey(isoDate: string, mode: "daily" | "monthly"): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  if (mode === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function bucketSortKey(key: string, mode: "daily" | "monthly"): number {
  // Daily keys are dd/MM within one range year-window; monthly are YYYY-MM.
  if (mode === "monthly") {
    return Number(key.replace("-", ""));
  }
  const [day, month] = key.split("/").map(Number);
  // Ranges never wrap years by more than a few days; month dominates order.
  return month * 100 + day;
}

export function ExpenseCategoryTrendCard({ range }: ExpenseCategoryTrendCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rows, setRows] = useState<Record<string, number | string>[]>([]);
  const [seriesMeta, setSeriesMeta] = useState<{ key: string; color: string }[]>([]);
  const [truncatedTotal, setTruncatedTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(false);

      try {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        const spanDays = Math.max(
          1,
          Math.round((end.getTime() - start.getTime()) / 86_400_000),
        );
        const mode: "daily" | "monthly" =
          spanDays <= DAILY_MAX_SPAN_DAYS ? "daily" : "monthly";

        const [categories, firstPage] = await Promise.all([
          categoryService.list().catch(() => []),
          transactionService.list({
            fromDate: range.startDate,
            toDate: range.endDate,
            page: 1,
            limit: PAGE_LIMIT,
            sortBy: "date",
            sortOrder: "asc",
          } satisfies TransactionListParams),
        ]);
        if (cancelled) return;

        const catNames = Object.fromEntries(
          categories.map((c) => [c.id, c.name]),
        );
        const expenses: TransactionDTO[] = firstPage.data.filter(
          (dto) => dto.transaction_type === "EXPENSE",
        );
        const totalPages = Math.min(firstPage.pagination.totalPages ?? 1, MAX_PAGES);
        for (let page = 2; page <= totalPages; page += 1) {
          const res = await transactionService.list({
            fromDate: range.startDate,
            toDate: range.endDate,
            page,
            limit: PAGE_LIMIT,
            sortBy: "date",
            sortOrder: "asc",
          });
          if (cancelled) return;
          expenses.push(
            ...res.data.filter((dto) => dto.transaction_type === "EXPENSE"),
          );
        }
        const fetchedCount =
          (totalPages - 1) * PAGE_LIMIT + firstPage.data.length;
        const grandTotal = firstPage.pagination.totalItems ?? 0;
        setTruncatedTotal(grandTotal > fetchedCount ? grandTotal : null);

        // Aggregate cents per bucket × category name. Uncategorized rows
        // ("-") fold into the "Other" remainder so the legend stays honest.
        const buckets: BucketMap = new Map();
        for (const dto of expenses) {
          const bucket = bucketKey(dto.transaction_date, mode);
          const inner = buckets.get(bucket) ?? new Map<string, number>();
          const rawName = catNames[dto.category_id] ?? "-";
          const label = rawName === "-" ? "__other__" : categoryLabel(rawName);
          inner.set(label, (inner.get(label) ?? 0) + Number(dto.amount_cents));
          buckets.set(bucket, inner);
        }

        // Global top categories across all buckets.
        const totalsByCategory = new Map<string, number>();
        for (const inner of buckets.values()) {
          for (const [label, cents] of inner) {
            totalsByCategory.set(label, (totalsByCategory.get(label) ?? 0) + cents);
          }
        }
        const topLabels = [...totalsByCategory.entries()]
          // "__other__" is the fold bucket, never a real top category —
          // otherwise it would be added twice to the series list.
          .filter(([label]) => label !== "__other__")
          .sort((a, b) => b[1] - a[1])
          .slice(0, TOP_CATEGORIES)
          .map(([label]) => label);
        const topSet = new Set(topLabels);

        const sortedBuckets = [...buckets.entries()].sort(
          (a, b) =>
            bucketSortKey(a[0], mode) - bucketSortKey(b[0], mode),
        );
        const grid = sortedBuckets.map(([bucket, inner]) => {
          const row: Record<string, number | string> = { period: bucket };
          let other = 0;
          for (const [label, cents] of inner) {
            if (topSet.has(label)) {
              row[label] = cents;
            } else {
              other += cents;
            }
          }
          if (other > 0) {
            row.__other__ = other;
          }
          return row;
        });

        const meta = [
          ...topLabels.map((label, index) => ({
            key: label,
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] as string,
          })),
          ...(grid.some((row) => "__other__" in row)
            ? [{ key: "__other__", color: OTHER_COLOR }]
            : []),
        ];

        if (!cancelled) {
          setSeriesMeta(meta);
          setRows(grid);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const hasData = rows.some((row) =>
    seriesMeta.some(({ key }) => Number(row[key] ?? 0) > 0),
  );

  return (
    <ChartCard
      title={uiText.analytics.expenseTrendTitle}
      subtitle={uiText.analytics.expenseTrendSubtitle}
      loading={loading}
      empty={!hasData && !error}
      contentClassName="h-72"
    >
      {!hasData ? (
        <CenteredEmptyState title={uiText.common.noDataAvailable} />
      ) : (
        <div className="flex h-full flex-col gap-2">
          {/* Inline legend: wraps instead of a fixed recharts legend box so it
              stays readable with up to six series. Hover-only chart below. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {seriesMeta.map(({ key, color }) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {key === "__other__" ? uiText.analytics.trendLegendOther : key}
              </span>
            ))}
            {truncatedTotal !== null && (
              <span className="ml-auto italic">
                {uiText.analytics.trendTruncated.replace(
                  "{total}",
                  truncatedTotal.toLocaleString("id-ID"),
                )}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(value) => formatCompactCurrency(Number(value))}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(value) =>
                        formatCurrencyCents(String(value))
                      }
                    />
                  }
                  cursor={{ fill: "var(--muted)" }}
                />
                {/* Flat stacked segments (no per-segment radius): consistent
                    with the app's flat card aesthetic and honest about the
                    cumulative reading of a stacked bar. */}
                {seriesMeta.map(({ key, color }) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="expense"
                    name={key === "__other__" ? uiText.analytics.trendLegendOther : key}
                    fill={color}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
