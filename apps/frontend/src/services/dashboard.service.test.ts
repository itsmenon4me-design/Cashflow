import { describe, it, expect, vi } from "vitest";
import { dashboardService } from "./dashboard.service";
import { apiClient } from "@/lib/axios";

vi.mock("@/lib/axios", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
};

describe("dashboard.service", () => {
  it("getFlowSeries requests only the current year's trend and maps its points", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T11:00:00.000Z"));
    mockedApi.get.mockResolvedValue({
      type: "monthly",
      data: [
          { period: "2026-03", income: "100000", expense: "50000", netCashFlow: "50000" },
          { period: "2026-04", income: "200000", expense: "80000", netCashFlow: "120000" },
      ],
    });

    try {
      const series = await dashboardService.getFlowSeries();

      expect(apiClient.get).toHaveBeenCalledWith("/reports/cashflow-trend", {
        params: {
          type: "monthly",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
      });
      expect(series.cashFlow).toHaveLength(12);
      expect(series.cashFlow.map(({ month }) => month)).toEqual([
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
      ]);
      expect(series.cashFlow.slice(0, 4)).toEqual([
        { month: "Jan", balance: 0 },
        { month: "Feb", balance: 0 },
        { month: "Mar", balance: 50000 },
        { month: "Apr", balance: 120000 },
      ]);
      expect(series.cashFlow.slice(-3)).toEqual([
        { month: "Okt", balance: null },
        { month: "Nov", balance: null },
        { month: "Des", balance: null },
      ]);
      expect(series.flow).toHaveLength(12);
      expect(series.flow.slice(0, 4)).toEqual([
        { month: "Jan", income: 0, expense: 0 },
        { month: "Feb", income: 0, expense: 0 },
        { month: "Mar", income: 100000, expense: 50000 },
        { month: "Apr", income: 200000, expense: 80000 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("getFlowSeries propagates trend request failures", async () => {
    mockedApi.get.mockRejectedValue(new Error("trend request failed"));

    await expect(dashboardService.getFlowSeries()).rejects.toThrow(
      "trend request failed",
    );
  });

  it("getFlowSeries returns an empty series when the trend has no points", async () => {
    mockedApi.get.mockResolvedValue({
      type: "monthly",
      data: [],
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T11:00:00.000Z"));

    try {
      const series = await dashboardService.getFlowSeries();

      expect(series).toEqual({ cashFlow: [], flow: [] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("getCategoryDistribution maps percentage values from categoryBreakdown", async () => {
    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [
        { categoryId: "c1", categoryName: "Food", totalAmount: "100000", percentage: 66.666, transactionCount: 3 },
        { categoryId: "c2", categoryName: "Transport", totalAmount: "50000", percentage: 33.333, transactionCount: 1 },
      ],
      trend: null,
      budget: null,
    });

    const items = await dashboardService.getCategoryDistribution();

    expect(items).toEqual([
      { name: "Food", value: 66.67, amount: 100000 },
      { name: "Transport", value: 33.33, amount: 50000 },
    ]);
  });

  it("getCategoryDistribution falls back to 'Lainnya' for null category names", async () => {
    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [
        { categoryId: "c1", categoryName: null, totalAmount: "100000", percentage: 100, transactionCount: 1 },
      ],
      trend: null,
      budget: null,
    });

    const items = await dashboardService.getCategoryDistribution();

    expect(items).toEqual([{ name: "Lainnya", value: 100, amount: 100000 }]);
  });

  it("getBudgetStatus normalizes string-cents to numbers (contract fix)", async () => {
    const budget = {
      month: 8,
      year: 2026,
      overall: { budget: "1000000", spent: "400000", remaining: "600000", percentageUsed: 40 },
      categories: [
        {
          categoryId: "c1",
          categoryName: "Food",
          budgetAmount: "800000",
          spentAmount: "300000",
          remainingAmount: "500000",
          percentageUsed: 37.5,
          status: "ACTIVE",
        },
      ],
    };
    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [],
      trend: null,
      budget,
    });

    const result = await dashboardService.getBudgetStatus();

    expect(result).not.toBeNull();
    expect(result?.overall).toEqual({ budget: 1000000, spent: 400000, remaining: 600000, percentageUsed: 40 });
    expect(result?.categories[0]).toEqual({
      categoryId: "c1",
      categoryName: "Food",
      budgetAmount: 800000,
      spentAmount: 300000,
      remainingAmount: 500000,
      percentageUsed: 37.5,
      status: "ACTIVE",
    });
  });

  it("getBudgetStatus coerces invalid values and returns null when absent", async () => {
    const budget = {
      month: 8,
      year: 2026,
      overall: { budget: "abc", spent: null, remaining: undefined, percentageUsed: 0 },
      categories: [],
    };
    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [],
      trend: null,
      budget,
    });

    const result = await dashboardService.getBudgetStatus();

    expect(result?.overall.budget).toBe(0);

    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [],
      trend: null,
      budget: null,
    });

    expect(await dashboardService.getBudgetStatus()).toBeNull();
  });
});