import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./dashboard-page";
import { dashboardService } from "@/services/dashboard.service";
import { analyticsService } from "@/services/analytics.service";
import { settingsService } from "@/services/settings.service";
import { useAuthStore } from "@/stores/auth.store";
import { uiText } from "@/locales";

vi.mock("@/components/charts/lazy-charts", () => ({
  LazyCashflowChartCard: ({ data }: any) => (
    <div data-testid="lazy-cashflow-chart">Arus Kas Bulanan</div>
  ),
}));

describe("DashboardPage simplified layout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: { name: "Admin", email: "admin@example.com" } });

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
      expect(screen.getByText(uiText.dashboard.currentBalance)).toBeInTheDocument();
      expect(screen.getByText(uiText.dashboard.totalIncome)).toBeInTheDocument();
      expect(screen.getByText(uiText.dashboard.totalExpense)).toBeInTheDocument();
      expect(screen.getByText(uiText.dashboard.cashFlow)).toBeInTheDocument();
    });

    // 2. Cash Flow Monthly Chart
    await waitFor(() => {
      expect(screen.getByText(uiText.dashboard.cashFlowMonthly)).toBeInTheDocument();
    });

    // 3. Recent Transactions
    await waitFor(() => {
      expect(screen.getByText(uiText.dashboard.recentTransactions)).toBeInTheDocument();
      expect(screen.getByText("Gaji Bulanan")).toBeInTheDocument();
    });

    // 4. Actionable AI Insight
    await waitFor(() => {
      expect(
        screen.getByText("Pengeluaran kategori Makanan naik 20% dibanding periode sebelumnya."),
      ).toBeInTheDocument();
    });

    // 5. Excluded mirrored sections should not be present
    expect(screen.queryByText("Target Bulan Ini")).not.toBeInTheDocument();
    expect(screen.queryByText("Target Tabungan")).not.toBeInTheDocument();
    expect(screen.queryByText("Ringkasan Investasi")).not.toBeInTheDocument();
    expect(screen.queryByText("Aktivitas Terbaru")).not.toBeInTheDocument();
    expect(screen.queryByText("Distribusi Pengeluaran")).not.toBeInTheDocument();
  });

  it("hides the AI insight section when insights are empty or only generic", async () => {
    vi.spyOn(analyticsService, "getInsights").mockResolvedValue([
      "Konteks IDR: dashboard Anda tetap selaras dengan preferensi tampilan aktif.",
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(uiText.dashboard.currentBalance)).toBeInTheDocument();
    });

    expect(screen.queryByText(uiText.dashboard.aiInsight)).not.toBeInTheDocument();
  });
});
