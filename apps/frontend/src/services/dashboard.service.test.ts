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
  it("getFlowSeries maps the wrapped { type, data } trend contract", async () => {
    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [],
      trend: {
        type: "monthly",
        data: [
          { period: "2026-03", income: "100000", expense: "50000", netCashFlow: "50000" },
          { period: "2026-04", income: "200000", expense: "80000", netCashFlow: "120000" },
        ],
      },
      budget: null,
    });

    const series = await dashboardService.getFlowSeries();

    expect(apiClient.get).toHaveBeenCalledWith("/dashboard/widgets");
    expect(series.cashFlow).toEqual([
      { month: "Mar", balance: "50000" },
      { month: "Apr", balance: "120000" },
    ]);
    expect(series.flow).toEqual([
      { month: "Mar", income: "100000", expense: "50000" },
      { month: "Apr", income: "200000", expense: "80000" },
    ]);
  });

  it("getFlowSeries returns empty series when trend is null (widget failure)", async () => {
    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [],
      trend: null,
      budget: null,
    });

    const series = await dashboardService.getFlowSeries();

    expect(series.cashFlow).toEqual([]);
    expect(series.flow).toEqual([]);
  });

  it("getFlowSeries falls back to empty when trend.data is absent", async () => {
    mockedApi.get.mockResolvedValue({
      summary: {},
      cashFlow: {},
      monthlyReport: {},
      categoryBreakdown: [],
      trend: { type: "monthly", data: [] },
      budget: null,
    });

    const series = await dashboardService.getFlowSeries();

    expect(series.cashFlow).toEqual([]);
    expect(series.flow).toEqual([]);
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