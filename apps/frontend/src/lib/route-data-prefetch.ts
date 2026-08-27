/**
 * Hover/focus intent data-warming for sidebar destinations.
 *
 * When a user hovers/focuses/touches a sidebar link we fire the SAME read
 * requests the destination page will make on mount (through the regular
 * service layer, so auth headers + offline cache apply). By the time the
 * click happens, responses are usually in-flight or already resolved —
 * the browser HTTP cache / IndexedDB read-cache makes the page's own mount
 * fetch resolve near-instantly, so its stale-while-revalidate cards paint
 * real data instead of skeletons.
 *
 * Service modules are imported dynamically on first use so this module adds
 * zero bytes to the layout bundle until a link is actually hovered.
 *
 * One successful warm per session per route (page mounts always refetch
 * fresh data anyway); failed warms clear the entry so the next hover retries.
 */

type Warmer = () => Promise<unknown>;

function currentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function buildWarmers(): Record<string, Warmer[]> {
  const { month, year } = currentMonthYear();

  return {
    "/dashboard": [
      async () => {
        const { dashboardService } = await import("@/services/dashboard.service");
        return Promise.allSettled([
          dashboardService.getSummary(),
          dashboardService.getFlowSeries(),
          dashboardService.getCategoryDistribution(),
          dashboardService.getRecentTransactions(),
        ]);
      },
      async () => {
        const [{ budgetService }, { savingGoalService }, { investmentService }] =
          await Promise.all([
            import("@/services/budget.service"),
            import("@/services/saving-goal.service"),
            import("@/services/investment.service"),
          ]);
        return Promise.allSettled([
          budgetService.analysis(month, year),
          savingGoalService.overview(),
          investmentService.overview(),
        ]);
      },
    ],
    "/accounts": [
      async () => {
        const { accountService } = await import("@/services/account.service");
        return accountService.list();
      },
    ],
    "/transactions": [
      async () => {
        const [{ transactionService }, { categoryService }] = await Promise.all([
          import("@/services/transaction.service"),
          import("@/services/category.service"),
        ]);
        return Promise.allSettled([transactionService.list({ page: 1 }), categoryService.list()]);
      },
      async () => {
        const { accountService } = await import("@/services/account.service");
        return accountService.list();
      },
    ],
    "/incomes": [
      async () => {
        const { transactionService } = await import("@/services/transaction.service");
        return transactionService.list({ type: "INCOME", page: 1 });
      },
      async () => {
        const { categoryService } = await import("@/services/category.service");
        return categoryService.list();
      },
    ],
    "/expenses": [
      async () => {
        const { transactionService } = await import("@/services/transaction.service");
        return transactionService.list({ type: "EXPENSE", page: 1 });
      },
      async () => {
        const { categoryService } = await import("@/services/category.service");
        return categoryService.list();
      },
    ],
    "/categories": [
      async () => {
        const { categoryService } = await import("@/services/category.service");
        return categoryService.list();
      },
    ],
    "/budgets": [
      async () => {
        const { budgetService } = await import("@/services/budget.service");
        return budgetService.analysis(month, year);
      },
      async () => {
        const { categoryService } = await import("@/services/category.service");
        return categoryService.list();
      },
    ],
    "/goals": [
      async () => {
        const { savingGoalService } = await import("@/services/saving-goal.service");
        return Promise.allSettled([savingGoalService.list(), savingGoalService.overview()]);
      },
    ],
    "/investments": [
      async () => {
        const { investmentService } = await import("@/services/investment.service");
        return Promise.allSettled([investmentService.list(), investmentService.overview()]);
      },
    ],
    "/forecast": [
      async () => {
        const { forecastService } = await import("@/services/forecast.service");
        return Promise.allSettled([
          forecastService.getForecast(),
          forecastService.getSpendingPrediction(),
        ]);
      },
    ],
    "/reports": [
      async () => {
        const [{ reportService }, { computeRange }] = await Promise.all([
          import("@/services/report.service"),
          import("@/features/reports/period"),
        ]);
        const range = computeRange("thisMonth");
        return reportService.getSummary(range);
      },
      async () => {
        const [{ reportService }, { computeRange, pickTrendType }] = await Promise.all([
          import("@/services/report.service"),
          import("@/features/reports/period"),
        ]);
        const range = computeRange("thisMonth");
        return reportService.getCashflowTrend(pickTrendType(range), range);
      },
    ],
    "/analytics": [
      async () => {
        const [{ analyticsService }, { computeRange }] = await Promise.all([
          import("@/services/analytics.service"),
          import("@/features/reports/period"),
        ]);
        return analyticsService.getOverview(computeRange("thisMonth"));
      },
    ],
    "/notifications": [
      async () => {
        const { notificationService } = await import("@/services/notification.service");
        return Promise.allSettled([
          notificationService.list({ page: 1 }),
          notificationService.unreadCount(),
        ]);
      },
    ],
    "/log-aktivitas": [
      async () => {
        const { sessionService } = await import("@/services/session.service");
        return sessionService.list();
      },
    ],
    "/settings": [
      async () => {
        const { settingsService } = await import("@/services/settings.service");
        return settingsService.getSettings();
      },
    ],
  };
}

let warmers: Record<string, Warmer[]> | null = null;
const inflight = new Map<string, Promise<void>>();

/**
 * Fire-and-forget warm for a route's primary reads. Safe to call on every
 * mouseenter/focus/touchstart: concurrent calls are deduped while in flight,
 * successful runs are remembered for the session, failures allow a retry.
 */
export function warmRouteData(href: string): void {
  let existing = inflight.get(href);
  if (existing) return;

  warmers ??= buildWarmers();
  const fns = warmers[href];
  if (!fns || fns.length === 0) return;

  existing = Promise.all(fns.map((run) => run()))
    .then(() => undefined)
    .catch(() => {
      // Allow a later hover to retry after a failure.
      inflight.delete(href);
      return undefined;
    });
  inflight.set(href, existing);
}
