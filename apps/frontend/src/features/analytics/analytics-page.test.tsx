import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsPage } from "./analytics-page";
import { analyticsService } from "@/services/analytics.service";
import type { PeriodKey } from "@/features/reports/period";
import type {
  AnalyticsCashflow,
  AnalyticsHealth,
  AnalyticsOverview,
  AnalyticsSpending,
  AnalyticsTypeResult,
} from "@/services/analytics.service";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/reports/report-period-filter", () => ({
  ReportPeriodFilter: ({
    loading,
    refreshingLabel,
    onPeriodChange,
    onCustomStartChange,
    onCustomEndChange,
    onApplyCustom,
  }: {
    loading: boolean;
    refreshingLabel?: string;
    onPeriodChange: (period: PeriodKey) => void;
    onCustomStartChange: (value: string) => void;
    onCustomEndChange: (value: string) => void;
    onApplyCustom: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onPeriodChange("lastMonth")}>
        Ganti periode
      </button>
      <button
        type="button"
        onClick={() => {
          onPeriodChange("custom");
          onCustomStartChange("2026-09-10");
          onCustomEndChange("2026-09-20");
        }}
      >
        Pilih rentang khusus
      </button>
      <button type="button" onClick={onApplyCustom}>
        Terapkan rentang
      </button>
      {loading && refreshingLabel && (
        <p role="status" aria-live="polite">
          {refreshingLabel}
        </p>
      )}
    </div>
  ),
}));

vi.mock("@/components/analytics/financial-health-card", () => ({
  FinancialHealthCard: () => null,
}));
vi.mock("@/components/analytics/insights-card", () => ({
  InsightsCard: () => null,
}));
vi.mock("@/components/analytics/spending-analysis-card", () => ({
  SpendingAnalysisCard: () => null,
}));
vi.mock("@/components/charts/lazy-charts", () => ({
  LazyCategoryBreakdownCard: () => null,
  LazyBudgetVsExpenseChartCard: () => (
    <div>Anggaran vs Pengeluaran per Kategori</div>
  ),
  LazyExpenseCategoryTrendCard: () => null,
  LazyIncomeExpenseChartCard: () => null,
}));
vi.mock("@/components/reports/summary-card", () => ({
  SummaryCard: ({
    label,
    value,
    change,
  }: {
    label: string;
    value: string;
    change?: string;
  }) => (
    <div data-testid={label}>
      {value}
      {change && <span>{change}</span>}
    </div>
  ),
}));
vi.mock("@/components/reports/top-categories-card", () => ({
  TopCategoriesCard: () => null,
}));
vi.mock("@/components/states/ErrorState", () => ({
  ErrorState: ({ title }: { title: string }) => <p role="alert">{title}</p>,
}));
vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, formatMoney: (value: number) => String(value) };
});
vi.mock("@/lib/categories", () => ({
  categoryLabel: (value: string) => value,
}));

import { computeRange } from "@/features/reports/period";
import { useTimezoneStore } from "@/stores/timezone.store";

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function overview(income: string, transactions = 1): AnalyticsOverview {
  return {
    income,
    expense: "5000",
    netCashFlow: "5000",
    savingRate: 50,
    transactions,
    comparison: { income: 0, expense: 0, netCashFlow: 0, savingRate: 0 },
  };
}

const typeResult: AnalyticsTypeResult = {
  total: "5000",
  transactionCount: 1,
  trend: [],
  categories: [],
  top: [],
  comparison: 0,
  biggestCategory: null,
  biggestCategoryPercentage: null,
};

const cashflow: AnalyticsCashflow = {
  trend: [],
  totalIncome: "10000",
  totalExpense: "5000",
  netCashFlow: "5000",
  surplusPeriods: 1,
  deficitPeriods: 0,
  status: "surplus",
};

const spending: AnalyticsSpending = {
  avgExpense: "5000",
  largestExpense: "5000",
  avgTransaction: "5000",
  totalTransactions: 1,
  incomeTransactions: 1,
  expenseTransactions: 0,
  byCategory: [],
};

const health: AnalyticsHealth = {
  score: 75,
  label: "healthy",
  savingRate: 50,
  expenseRatio: 50,
  incomeVsExpense: 2,
  netCashFlow: "5000",
  cashFlowPositive: true,
  spendingConcentration: 50,
};

function mockSupportingData() {
  vi.spyOn(analyticsService, "getIncome").mockResolvedValue(typeResult);
  vi.spyOn(analyticsService, "getExpenses").mockResolvedValue(typeResult);
  vi.spyOn(analyticsService, "getCashflow").mockResolvedValue(cashflow);
  vi.spyOn(analyticsService, "getSpending").mockResolvedValue(spending);
  vi.spyOn(analyticsService, "getFinancialHealth").mockResolvedValue(health);
  vi.spyOn(analyticsService, "getInsights").mockResolvedValue([]);
}

describe("AnalyticsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useTimezoneStore.setState({ timezone: "Asia/Jakarta" });
  });

  it("keeps the current figures visible and labels them while another period loads", async () => {
    const user = userEvent.setup();
    const nextOverview = deferred<AnalyticsOverview>();
    vi.spyOn(analyticsService, "getOverview")
      .mockResolvedValueOnce(overview("10000"))
      .mockReturnValueOnce(nextOverview.promise);
    mockSupportingData();

    render(<AnalyticsPage />);
    expect(await screen.findByTestId("Total Pemasukan")).toHaveTextContent(
      "10000",
    );
    expect(
      screen.getByText("Anggaran vs Pengeluaran per Kategori"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ganti periode" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Memperbarui analitik. Data mungkin belum mencerminkan periode yang dipilih.",
    );
    expect(screen.getByTestId("Total Pemasukan")).toHaveTextContent("10000");

    nextOverview.resolve(overview("20000"));
    await waitFor(() => {
      expect(screen.getByTestId("Total Pemasukan")).toHaveTextContent("20000");
    });
    expect(screen.queryByText(/Memperbarui analitik/)).not.toBeInTheDocument();
  });

  it("shows the empty state after a successful response with no data", async () => {
    vi.spyOn(analyticsService, "getOverview").mockResolvedValue(
      overview("0", 0),
    );
    vi.spyOn(analyticsService, "getIncome").mockResolvedValue({
      ...typeResult,
      total: "0",
      transactionCount: 0,
    });

    vi.spyOn(analyticsService, "getExpenses").mockResolvedValue({
      ...typeResult,
      total: "0",
      transactionCount: 0,
    });
    vi.spyOn(analyticsService, "getCashflow").mockResolvedValue({
      ...cashflow,
      trend: [],
      surplusPeriods: 0,
    });
    vi.spyOn(analyticsService, "getSpending").mockResolvedValue({
      ...spending,
      totalTransactions: 0,
    });
    vi.spyOn(analyticsService, "getFinancialHealth").mockResolvedValue(health);
    vi.spyOn(analyticsService, "getInsights").mockResolvedValue([]);

    render(<AnalyticsPage />);

    expect(
      await screen.findByText("Belum ada data laporan pada periode ini."),
    ).toBeInTheDocument();
  });

  it("renders nullable comparisons as localized new or unavailable labels", async () => {
    vi.spyOn(analyticsService, "getOverview").mockResolvedValue({
      ...overview("10000"),
      comparison: {
        income: null,
        expense: null,
        netCashFlow: null,
        savingRate: null,
      },
    });
    mockSupportingData();

    render(<AnalyticsPage />);

    expect(await screen.findAllByText("Baru")).toHaveLength(4);
    cleanup();
    vi.spyOn(analyticsService, "getOverview").mockResolvedValue({
      ...overview("0"),
      savingRate: 0,
      comparison: {
        income: null,
        expense: null,
        netCashFlow: null,
        savingRate: null,
      },
    });
    mockSupportingData();
    render(<AnalyticsPage />);
    await screen.findByTestId("Total Pemasukan");
    expect(screen.getByTestId("Total Pemasukan")).toHaveTextContent("-");
    expect(screen.getByTestId("Total Pengeluaran")).toHaveTextContent("Baru");
    expect(screen.getByTestId("Arus Kas Bersih")).toHaveTextContent("Baru");
    expect(screen.getByTestId("Saving Rate")).toHaveTextContent("-");
  });

  it("shows an error state when the analytics request fails", async () => {
    vi.spyOn(analyticsService, "getOverview").mockRejectedValue(
      new Error("Request failed"),
    );
    mockSupportingData();

    render(<AnalyticsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Terjadi kesalahan.",
    );
  });

  it.each(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"])(
    "sends the preset range for the shared %s timezone",
    async (timeZone) => {
      useTimezoneStore.setState({ timezone: timeZone });
      vi.spyOn(analyticsService, "getOverview").mockResolvedValue(
        overview("10000"),
      );
      mockSupportingData();

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(analyticsService.getOverview).toHaveBeenCalledWith(
          computeRange("thisMonth", new Date(), timeZone),
        );
      });
    },
  );

  it.each(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"])(
    "sends custom dates as calendar dates for %s without browser-zone conversion",
    async (timeZone) => {
      const user = userEvent.setup();
      useTimezoneStore.setState({ timezone: timeZone });
      vi.spyOn(analyticsService, "getOverview").mockResolvedValue(
        overview("10000"),
      );
      mockSupportingData();

      render(<AnalyticsPage />);
      await waitFor(() =>
        expect(analyticsService.getOverview).toHaveBeenCalled(),
      );
      await user.click(
        screen.getByRole("button", { name: "Pilih rentang khusus" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Terapkan rentang" }),
      );

      await waitFor(() => {
        expect(analyticsService.getOverview).toHaveBeenLastCalledWith({
          startDate: "2026-09-10",
          endDate: "2026-09-20",
        });
      });
    },
  );
});
