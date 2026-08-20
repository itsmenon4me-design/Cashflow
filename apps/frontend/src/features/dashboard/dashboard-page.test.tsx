import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./dashboard-page";
import { analyticsService } from "@/services/analytics.service";
import { budgetService } from "@/services/budget.service";
import { dashboardService } from "@/services/dashboard.service";
import { savingGoalService } from "@/services/saving-goal.service";
import { investmentService } from "@/services/investment.service";
import { settingsService } from "@/services/settings.service";
import { useAuthStore } from "@/stores/auth.store";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

function resolveLater<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createHealth(score: number) {
  return {
    score,
    label: score >= 66 ? "healthy" : score >= 33 ? "moderate" : "risk",
    savingRate: 0,
    expenseRatio: 0,
    incomeVsExpense: null,
    netCashFlow: "0",
    cashFlowPositive: false,
    spendingConcentration: 0,
  };
}

describe("DashboardPage financial health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: { name: "Admin", email: "admin@example.com" } });
    useDashboardCurrencyStore.setState({ currency: "USD" });

    vi.spyOn(settingsService, "getSettings").mockResolvedValue({
      id: "settings-1",
      userId: "user-1",
      theme: "dark",
      language: "id",
      currency: "USD",
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
      currency: "USD",
      total_assets_cents: "0",
      total_income_cents: "0",
      total_expense_cents: "0",
      net_cash_flow_cents: "0",
      total_accounts: 0,
      total_categories: 0,
      total_transactions: 0,
      last_updated_at: null,
      by_currency: [],
    } as any);
    vi.spyOn(dashboardService, "getFlowSeries").mockResolvedValue({ cashFlow: [], flow: [] });
    vi.spyOn(dashboardService, "getCategoryDistribution").mockResolvedValue([]);
    vi.spyOn(dashboardService, "getRecentTransactions").mockResolvedValue([]);
    vi.spyOn(budgetService, "analysis").mockResolvedValue({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      overall: { budget: 1000000, spent: 300000, remaining: 700000, percentageUsed: 30 },
      categories: [
        {
          categoryId: "cat-1",
          categoryName: "Housing",
          budgetAmount: 500000,
          spentAmount: 200000,
          remainingAmount: 300000,
          percentageUsed: 40,
          status: "SAFE",
        },
        {
          categoryId: "cat-2",
          categoryName: "Food",
          budgetAmount: 500000,
          spentAmount: 100000,
          remainingAmount: 400000,
          percentageUsed: 20,
          status: "SAFE",
        },
      ],
    } as any);
    vi.spyOn(savingGoalService, "overview").mockResolvedValue(null);
    vi.spyOn(investmentService, "overview").mockResolvedValue(null);
  });

  it("loads the current month budget targets from the active currency instead of mock data", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Tempat Tinggal")).toBeInTheDocument();
      expect(screen.getByText("Makanan")).toBeInTheDocument();
    });

    expect(screen.queryByText("Dana Darurat")).not.toBeInTheDocument();
  });

  it("clears stale financial health while switching currencies", async () => {
    const firstHealth = resolveLater<any>();
    const secondHealth = resolveLater<any>();

    vi.spyOn(analyticsService, "getFinancialHealth")
      .mockImplementationOnce(() => firstHealth.promise)
      .mockImplementationOnce(() => secondHealth.promise);

    render(<DashboardPage />);

    await act(async () => {
      firstHealth.resolve(createHealth(20));
    });

    await waitFor(() => {
      expect(screen.getByText("20/100")).toBeInTheDocument();
    });

    act(() => {
      useDashboardCurrencyStore.setState({ currency: "EUR" });
    });

    await waitFor(() => {
      expect(screen.queryByText("20/100")).not.toBeInTheDocument();
    });

    await act(async () => {
      secondHealth.resolve(createHealth(0));
    });

    await waitFor(() => {
      expect(screen.getByText("0/100")).toBeInTheDocument();
    });
  });
});
