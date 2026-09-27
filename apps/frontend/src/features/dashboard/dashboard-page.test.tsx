import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./dashboard-page";
import { dashboardService } from "@/services/dashboard.service";
import { analyticsService } from "@/services/analytics.service";
import { settingsService } from "@/services/settings.service";
import { useAuthStore } from "@/stores/auth.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { uiText } from "@/locales";
import { formatCurrencyCents } from "@/lib/format";

vi.mock("@/components/charts/lazy-charts", () => ({
  LazyCashflowChartCard: () => (
    <div data-testid="lazy-cashflow-chart">Arus Kas Bulanan</div>
  ),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("DashboardPage simplified layout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useDataRefreshStore.setState({ version: 0 });
    useAuthStore.setState({
      user: { name: "Admin", email: "admin@example.com" },
    });

    vi.spyOn(settingsService, "getSettings").mockResolvedValue({
      id: "settings-1",
      userId: "user-1",
      theme: "dark",
      language: "id",
      timezone: "Asia/Jakarta",
      notificationPreferences: {
        transactions: true,
        budgets: true,
        savingGoals: true,
        accounts: true,
        investments: true,
        system: true,
      },
      financeBotSettings: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    vi.spyOn(dashboardService, "getSummary").mockResolvedValue({
      currency: "IDR",
      total_assets_cents: "1500000000",
      total_income_cents: "500000000",
      total_expense_cents: "150000000",
      net_cash_flow_cents: "350000000",
      previous_net_cash_flow_cents: "300000000",
      total_accounts: 2,
      total_categories: 5,
      total_transactions: 10,
      last_updated_at: null,
    } as any);

    vi.spyOn(dashboardService, "getFlowSeries").mockResolvedValue({
      cashFlow: [{ month: "Aug", balance: 3500000 }],
      flow: [],
    });

    vi.spyOn(dashboardService, "getRecentTransactions").mockResolvedValue([
      {
        id: "tx-1",
        description: "Gaji Bulanan",
        amount: 5000000,
        type: "income",
        category: "Salary",
        date: "2026-08-25T00:00:00.000Z",
        status: "completed",
      },
    ]);

    vi.spyOn(analyticsService, "getInsights").mockResolvedValue([
      "Pengeluaran kategori Makanan naik 20% dibanding periode sebelumnya.",
    ]);
  });

  it("renders the 4 core sections: KPIs, Cash Flow Chart, Recent Transactions, and AI Insights", async () => {
    render(<DashboardPage />);

    // 1. KPI Cards
    await waitFor(() => {
      expect(
        screen.getByText(uiText.dashboard.currentBalance),
      ).toBeInTheDocument();
      expect(
        screen.getByText(uiText.dashboard.totalIncome),
      ).toBeInTheDocument();
      expect(
        screen.getByText(uiText.dashboard.totalExpense),
      ).toBeInTheDocument();
      expect(screen.getByText(uiText.dashboard.cashFlow)).toBeInTheDocument();
    });
    const kpiSection = screen
      .getByText(uiText.dashboard.currentBalance)
      .closest("section");
    expect(kpiSection).toHaveClass("grid-cols-2");
    expect(kpiSection?.querySelectorAll('[data-slot="card"]')).toHaveLength(4);
    expect(
      screen.getByText(`+${formatCurrencyCents("50000000")}`),
    ).toBeInTheDocument();
    expect(screen.getByText(uiText.common.vsLastMonth)).toBeInTheDocument();

    // 2. Cash Flow Monthly Chart
    await waitFor(() => {
      expect(
        screen.getByText(uiText.dashboard.cashFlowMonthly),
      ).toBeInTheDocument();
    });

    // 3. Recent Transactions
    await waitFor(() => {
      expect(
        screen.getByText(uiText.dashboard.recentTransactions),
      ).toBeInTheDocument();
      expect(screen.getByText("Gaji Bulanan")).toBeInTheDocument();
    });

    // 4. Actionable AI Insight
    await waitFor(() => {
      expect(
        screen.getByText(
          "Pengeluaran kategori Makanan naik 20% dibanding periode sebelumnya.",
        ),
      ).toBeInTheDocument();
    });

    // 5. Excluded mirrored sections should not be present
    expect(screen.queryByText("Target Bulan Ini")).not.toBeInTheDocument();
    expect(screen.queryByText("Target Tabungan")).not.toBeInTheDocument();
    expect(screen.queryByText("Ringkasan Investasi")).not.toBeInTheDocument();
    expect(screen.queryByText("Aktivitas Terbaru")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Distribusi Pengeluaran"),
    ).not.toBeInTheDocument();
  });

  it("renders the authenticated user's full name in the greeting", () => {
    useAuthStore.setState({
      user: { name: "Nama Registrasi", email: "amiboys@example.com" },
    });

    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: /Nama Registrasi/ }),
    ).toBeInTheDocument();
  });

  it("shows a negative cash-flow delta against the previous calendar month", async () => {
    vi.spyOn(dashboardService, "getSummary").mockResolvedValue({
      currency: "IDR",
      total_assets_cents: "1000",
      total_income_cents: "100",
      total_expense_cents: "200",
      net_cash_flow_cents: "-100",
      previous_net_cash_flow_cents: "100",
      total_accounts: 0,
      total_categories: 0,
      total_transactions: 2,
      last_updated_at: null,
    } as any);

    render(<DashboardPage />);

    expect(
      await screen.findByText(`-${formatCurrencyCents("200")}`),
    ).toHaveClass("text-red-700");
    expect(screen.getByText(uiText.common.vsLastMonth)).toBeInTheDocument();
  });

  it("keeps non-cash-flow KPIs without comparisons and shows the real zero cash-flow delta", async () => {
    vi.spyOn(dashboardService, "getSummary").mockResolvedValue({
      currency: "IDR",
      total_assets_cents: "0",
      total_income_cents: "0",
      total_expense_cents: "0",
      net_cash_flow_cents: "0",
      previous_net_cash_flow_cents: "0",
      total_accounts: 0,
      total_categories: 0,
      total_transactions: 0,
      last_updated_at: null,
    } as any);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText(uiText.common.noComparisonData)).toHaveLength(
        3,
      );
    });

    expect(screen.queryByText("+4,2%")).not.toBeInTheDocument();
    expect(screen.queryByText("+8,1%")).not.toBeInTheDocument();
    expect(screen.queryByText("-2,4%")).not.toBeInTheDocument();
    expect(screen.queryByText("+12,8%")).not.toBeInTheDocument();
    expect(screen.getByText(uiText.common.vsLastMonth)).toBeInTheDocument();
  });

  it("hides the AI insight section when insights are empty or only generic", async () => {
    vi.spyOn(analyticsService, "getInsights").mockResolvedValue([
      "Konteks IDR: dashboard Anda tetap selaras dengan preferensi tampilan aktif.",
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(uiText.dashboard.currentBalance),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText(uiText.dashboard.aiInsight),
    ).not.toBeInTheDocument();
  });

  it("shows summary KPIs before the other dashboard requests finish", async () => {
    const flow =
      deferred<Awaited<ReturnType<typeof dashboardService.getFlowSeries>>>();
    const transactions =
      deferred<
        Awaited<ReturnType<typeof dashboardService.getRecentTransactions>>
      >();
    const insights = deferred<string[]>();

    vi.spyOn(dashboardService, "getSummary").mockResolvedValue({
      currency: "IDR",
      total_assets_cents: "123456",
      total_income_cents: "234567",
      total_expense_cents: "34567",
      net_cash_flow_cents: "200000",
      previous_net_cash_flow_cents: "200000",
      total_accounts: 1,
      total_categories: 2,
      total_transactions: 3,
      last_updated_at: null,
    } as any);
    vi.spyOn(dashboardService, "getFlowSeries").mockReturnValue(flow.promise);
    vi.spyOn(dashboardService, "getRecentTransactions").mockReturnValue(
      transactions.promise,
    );
    vi.spyOn(analyticsService, "getInsights").mockReturnValue(insights.promise);

    render(<DashboardPage />);

    expect(
      await screen.findByText(formatCurrencyCents("123456")),
    ).toBeInTheDocument();

    flow.resolve({ cashFlow: [], flow: [] });
    transactions.resolve([]);
    insights.resolve([]);
  });

  it("keeps dashboard panels available when an older summary omits the cash-flow comparison", async () => {
    vi.spyOn(dashboardService, "getSummary").mockResolvedValue({
      currency: "IDR",
      total_assets_cents: "-7000000",
      total_income_cents: "0",
      total_expense_cents: "7000000",
      net_cash_flow_cents: "-7000000",
      total_categories: 1,
      total_transactions: 1,
      last_updated_at: null,
    });

    render(<DashboardPage />);

    expect(
      await screen.findAllByText(formatCurrencyCents("-7000000")),
    ).toHaveLength(2);
    expect(await screen.findByText("Gaji Bulanan")).toBeInTheDocument();
    expect(
      await screen.findByText(uiText.dashboard.cashFlowMonthly),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(uiText.dashboard.flowLoadError),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(uiText.dashboard.recentTransactionsLoadError),
    ).not.toBeInTheDocument();
  });

  it("keeps the last successful chart and transactions visible when refresh requests fail", async () => {
    vi.spyOn(dashboardService, "getFlowSeries")
      .mockResolvedValueOnce({
        cashFlow: [{ month: "Aug", balance: 3500000 }],
        flow: [],
      })
      .mockRejectedValueOnce(new Error("Network unavailable"));
    vi.spyOn(dashboardService, "getRecentTransactions")
      .mockResolvedValueOnce([
        {
          id: "tx-1",
          description: "Gaji Bulanan",
          amount: 5000000,
          type: "income",
          category: "Salary",
          date: "2026-08-25T00:00:00.000Z",
          status: "completed",
        },
      ])
      .mockRejectedValueOnce(new Error("Network unavailable"));

    render(<DashboardPage />);

    expect(await screen.findByText("Gaji Bulanan")).toBeInTheDocument();
    useDataRefreshStore.getState().bump();

    expect(
      await screen.findByText(uiText.dashboard.flowLoadError),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(uiText.dashboard.recentTransactionsLoadError),
    ).toBeInTheDocument();
    expect(screen.getByText("Gaji Bulanan")).toBeInTheDocument();
  });
});
