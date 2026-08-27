import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Page-shaped loading skeletons for every dashboard route.
 *
 * Each composed skeleton mirrors the REAL page's top-level layout (header,
 * toolbar, filter card, KPI grid, chart/table/list sections) so the loading
 * state occupies the same footprint as the content that replaces it — no
 * full-page spinners, no layout shift when real cards commit.
 *
 * All components are server-safe (no hooks/client APIs) so route-level
 * `loading.tsx` files can render them during SSR streaming and client
 * navigation alike. Shimmer animation comes from the shared <Skeleton>.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function SkeletonCard({
  className,
  contentClassName,
  children,
}: {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm" aria-hidden="true">
      <CardContent className={cn("space-y-3", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

/** Page title (h1 text-2xl ≈ h-8) + subtitle row, matching every page header. */
export function PageHeaderSkeleton({
  titleWidth = "w-56",
  subtitleWidth = "w-72",
}: {
  titleWidth?: string;
  subtitleWidth?: string;
}) {
  return (
    <div aria-hidden="true">
      <Skeleton className={cn("h-8", titleWidth)} />
      <Skeleton className={cn("mt-2 h-4", subtitleWidth)} />
    </div>
  );
}

/** Count label on the left (+ optional Add button) — list-page toolbars. */
export function ToolbarSkeleton({ showAdd = true }: { showAdd?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
      <Skeleton className="h-5 w-28" />
      {showAdd && <Skeleton className="h-9 w-28 rounded-xl" />}
    </div>
  );
}

const FILTER_COL_CLASSES: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/** Filter inputs living inside a single Card (search/selects/reset). */
export function FilterCardSkeleton({ cols = 4 }: { cols?: number }) {
  const colClass = FILTER_COL_CLASSES[cols] ?? FILTER_COL_CLASSES[4];
  return (
    <Card size="sm" aria-hidden="true">
      <CardContent>
        <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", colClass)}>
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Bare (non-card) filter/period controls row — reports & analytics. */
export function PeriodFilterSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-9 w-full rounded-xl sm:w-48" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  );
}

/** KPI stat cards: muted label bar + bold value bar (matches BudgetStat etc.). */
export function KpiGridSkeleton({
  count = 4,
  colsClass = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  count?: number;
  colsClass?: string;
}) {
  return (
    <section className={cn("grid grid-cols-1 gap-4", colsClass)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-24" />
        </SkeletonCard>
      ))}
    </section>
  );
}

/** Chart card: header row + plot area with a faint baseline hint. */
export function ChartCardSkeleton({
  height = "h-64",
  action = true,
}: {
  height?: string;
  action?: boolean;
}) {
  return (
    <Card size="sm" aria-hidden="true">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-36" />
          {action && <Skeleton className="size-8 rounded-lg" />}
        </div>
        <div className={cn("relative overflow-hidden rounded-xl bg-accent/60", height)}>
          <div className="absolute inset-x-0 bottom-6 flex items-end justify-around px-6">
            {[38, 62, 45, 80, 55, 70, 42].map((w, i) => (
              <Skeleton key={i} className="w-6" style={{ height: `${w}%` }} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Table card: header row + zebra-free rows of bars. */
export function TableRowsSkeleton({
  rows = 8,
  columns = 5,
  inCard = true,
}: {
  rows?: number;
  columns?: number;
  inCard?: boolean;
}) {
  const body = (
    <>
      <div className="flex gap-4 border-b border-border pb-2">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 py-3">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            {Array.from({ length: Math.max(1, columns - 1) }, (_, c) => (
              <Skeleton
                key={c}
                className={cn("h-3 flex-1", c === 0 && "max-w-[180px]")}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );

  if (!inCard) return <div aria-hidden="true">{body}</div>;

  return (
    <Card size="sm" aria-hidden="true">
      <CardContent>{body}</CardContent>
    </Card>
  );
}

/** Right-aligned pagination cluster under tables/lists. */
export function PaginationSkeleton() {
  return (
    <div className="mt-4 flex justify-end gap-2" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="size-9 rounded-xl" />
      ))}
    </div>
  );
}

/** Bordered list row (notifications / audit-log style). */
export function BorderedRowSkeleton({
  lines = 2,
  leading = true,
}: {
  lines?: number;
  leading?: boolean;
}) {
  return (
    <li
      className="rounded-xl border border-border bg-card p-4"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        {leading && <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />}
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          {lines > 1 && <Skeleton className="h-3 w-2/3" />}
          {lines > 2 && <Skeleton className="h-3 w-24" />}
        </div>
      </div>
    </li>
  );
}

function BorderedListSkeleton({ rows = 5, ...rest }: { rows?: number; lines?: number; leading?: boolean }) {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <BorderedRowSkeleton key={i} {...rest} />
      ))}
    </ul>
  );
}

/** Generic page shape used while auth state hydrates (replaces the old
 * centered spinner): familiar header + one large panel, stable heights. */
export function GenericPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <ChartCardSkeleton height="h-[420px]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-page skeletons (mirror each feature page's section order)       */
/* ------------------------------------------------------------------ */

/** Table-only page: accounts, transactions, incomes, expenses, goals. */
export function TablePageSkeleton({ filterCols = 4, showAdd = true }: { filterCols?: number; showAdd?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <ToolbarSkeleton showAdd={showAdd} />
      <FilterCardSkeleton cols={filterCols} />
      <div>
        <TableRowsSkeleton rows={8} />
        <PaginationSkeleton />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <KpiGridSkeleton count={4} />
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" aria-hidden="true">
        <ChartCardSkeleton height="h-72" />
        <ChartCardSkeleton height="h-64" />
      </section>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-hidden="true">
        <ChartCardSkeleton height="h-56" />
        <div className="grid grid-cols-1 gap-4" aria-hidden="true">
          <SkeletonCard>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </SkeletonCard>
          <SkeletonCard>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </SkeletonCard>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" aria-hidden="true">
        <ChartCardSkeleton height="h-64" />
        <ChartCardSkeleton height="h-64" />
      </section>
      <TableRowsSkeleton rows={5} />
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-hidden="true">
        <ChartCardSkeleton height="h-52" />
        <ChartCardSkeleton height="h-52" />
      </section>
    </div>
  );
}

export function BudgetsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <FilterCardSkeleton cols={6} />
      <KpiGridSkeleton count={4} />
      <div>
        <TableRowsSkeleton rows={6} />
        <PaginationSkeleton />
      </div>
    </div>
  );
}

export function CategoriesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <FilterCardSkeleton cols={3} />
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }, (_, panel) => (
          <Card key={panel} size="sm" aria-hidden="true">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <Skeleton className="h-3 flex-1 max-w-[160px]" />
                    <Skeleton className="ml-auto h-8 w-16 rounded-lg" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <PeriodFilterSkeleton />
      {/* Export banner */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        aria-hidden="true"
      >
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <KpiGridSkeleton count={4} colsClass="sm:grid-cols-2 xl:grid-cols-4" />
      <ChartCardSkeleton height="h-72" />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
        <ChartCardSkeleton height="h-64" />
        <ChartCardSkeleton height="h-64" />
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
        <ChartCardSkeleton height="h-64" />
        <ChartCardSkeleton height="h-64" />
      </section>
      <TableRowsSkeleton rows={6} />
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <PeriodFilterSkeleton />
      <KpiGridSkeleton count={5} colsClass="sm:grid-cols-2 lg:grid-cols-5" />
      <ChartCardSkeleton height="h-72" />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
        <ChartCardSkeleton height="h-64" />
        <ChartCardSkeleton height="h-64" />
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
        <ChartCardSkeleton height="h-64" />
        <ChartCardSkeleton height="h-64" />
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
        <ChartCardSkeleton height="h-56" />
        <ChartCardSkeleton height="h-56" />
      </section>
    </div>
  );
}

export function InvestmentsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <FilterCardSkeleton cols={4} />
      <KpiGridSkeleton count={4} />
      <div>
        <TableRowsSkeleton rows={6} />
        <PaginationSkeleton />
      </div>
      <ChartCardSkeleton height="h-72" />
    </div>
  );
}

export function ForecastSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      {/* Horizon control panel */}
      <div
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between"
        aria-hidden="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-xl sm:w-44" />
        </div>
      </div>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-7 w-24" />
          </SkeletonCard>
        ))}
      </section>
      <ChartCardSkeleton height="h-80" />
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]" aria-hidden="true">
        <SkeletonCard>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border px-4 py-3" aria-hidden="true">
              <Skeleton className="h-3 w-24" />
              <div className="mt-2 flex gap-4">
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 hidden flex-1 sm:block" />
              </div>
            </div>
          ))}
        </SkeletonCard>
        <div className="space-y-6" aria-hidden="true">
          <SkeletonCard>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </SkeletonCard>
          <SkeletonCard>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </SkeletonCard>
        </div>
      </section>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      {/* Header merged with filter/action controls in one row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-hidden="true">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
      <BorderedListSkeleton rows={6} />
      <PaginationSkeleton />
    </div>
  );
}

export function AuditLogSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      {/* Bare filters toolbar */}
      <div className="flex flex-wrap items-end gap-2" aria-hidden="true">
        <Skeleton className="h-9 w-44 rounded-xl" />
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <BorderedListSkeleton rows={5} lines={3} />
      <PaginationSkeleton />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />

      {/* Application group */}
      <section className="space-y-3" aria-hidden="true">
        <div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1 h-3 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCard key={i}>
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 2 }, (_, j) => (
                <div key={j} className="rounded-xl border border-border px-4 py-3" aria-hidden="true">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="size-4 rounded-full" />
                  </div>
                </div>
              ))}
            </SkeletonCard>
          ))}
        </div>
      </section>

      {/* Account group */}
      <section className="space-y-3" aria-hidden="true">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1 h-3 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </SkeletonCard>
        </div>
      </section>

      {/* FinanceBot group */}
      <section className="space-y-3" aria-hidden="true">
        <Skeleton className="h-4 w-24" />
        <SkeletonCard>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </SkeletonCard>
      </section>

      {/* Notifications group */}
      <section className="space-y-3" aria-hidden="true">
        <Skeleton className="h-4 w-28" />
        <SkeletonCard>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="rounded-xl border border-border px-4 py-3" aria-hidden="true">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="size-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </section>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <PageHeaderSkeleton />
      <Card size="sm" aria-hidden="true">
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10" aria-hidden="true">
              <Skeleton className="size-4" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3" aria-hidden="true">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3" aria-hidden="true">
            <Skeleton className="size-4 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BillsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div
        className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8"
        aria-hidden="true"
      >
        <Skeleton className="size-12 rounded-2xl" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  );
}
