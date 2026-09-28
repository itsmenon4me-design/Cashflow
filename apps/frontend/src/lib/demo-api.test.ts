import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/axios";
import { getDemoResponse } from "@/lib/demo-api";
import { syncCreateTransaction } from "@/lib/offline/sync-client";

describe("frontend demo data", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATA_MODE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("provides labelled sample categories and a paginated transaction history", () => {
    const categories = getDemoResponse("/categories") as {
      data: Array<{ description: string | null }>;
    };
    const transactions = getDemoResponse("/transactions", { page: 2, limit: 10 }) as {
      data: Array<{ note: string | null }>;
      pagination: { totalItems: number; page: number; totalPages: number };
    };

    expect(categories.data).toHaveLength(11);
    expect(categories.data.every((category) => category.description?.includes("[DATA DUMMY]"))).toBe(true);
    expect(transactions.data).toHaveLength(10);
    expect(transactions.data.every((transaction) => transaction.note?.includes("[DATA DUMMY]"))).toBe(true);
    expect(transactions.pagination).toMatchObject({ totalItems: 168, page: 2, totalPages: 17 });
  });

  it("returns data for budgets, goals, investments, reports, analytics, and forecasts", () => {
    expect(getDemoResponse("/budgets")).toMatchObject({ data: expect.any(Array) });
    expect(getDemoResponse("/saving-goals")).toMatchObject({ data: expect.any(Array) });
    expect(getDemoResponse("/investments")).toMatchObject({ data: expect.any(Array) });
    const goalOverview = getDemoResponse("/saving-goals/overview") as {
      data: { total: number; currentAmount: string };
    };
    const investmentOverview = getDemoResponse("/investments/overview") as {
      data: { total: number; totalInvested: string };
    };
    expect(goalOverview.data.total).toBe(3);
    expect(Number(goalOverview.data.currentAmount)).toBeGreaterThan(0);
    expect(investmentOverview.data.total).toBe(4);
    expect(Number(investmentOverview.data.totalInvested)).toBeGreaterThan(0);
    expect(getDemoResponse("/reports/monthly")).toHaveProperty("summary");
    expect(getDemoResponse("/analytics/overview")).toHaveProperty("comparison");
    expect(getDemoResponse("/ai/forecast")).toMatchObject({
      data: { insufficientData: false, months: expect.any(Array) },
    });
  });

  it("provides historical demo budgets and calculates analysis for the requested month", () => {
    const budgets = getDemoResponse("/budgets") as {
      data: Array<{
        month: number;
        year: number;
        category_id: string;
        budget_amount_cents: string;
      }>;
    };
    const monthKeys = new Set(
      budgets.data.map((budget) => `${budget.year}-${budget.month}`),
    );
    expect(monthKeys.size).toBe(12);
    const currentMonthBudgets = budgets.data.filter(
      (budget) =>
        budget.month === new Date().getMonth() + 1 &&
        budget.year === new Date().getFullYear(),
    );
    const dashboard = getDemoResponse("/dashboard/widgets") as {
      budget: { overall: { budget: number } };
    };
    expect(dashboard.budget.overall.budget).toBe(
      currentMonthBudgets.reduce(
        (sum, budget) => sum + Number(budget.budget_amount_cents),
        0,
      ),
    );

    const historicBudget = budgets.data.find(
      (budget) => `${budget.year}-${budget.month}` !==
        `${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
    );
    expect(historicBudget).toBeDefined();
    const analysis = getDemoResponse("/reports/budget-analysis", {
      month: historicBudget!.month,
      year: historicBudget!.year,
    }) as {
      month: number;
      year: number;
      categories: Array<{ categoryId: string; spentAmount: number }>;
    };

    expect(analysis).toMatchObject({
      month: historicBudget!.month,
      year: historicBudget!.year,
    });
    expect(
      analysis.categories.find(
        (category) => category.categoryId === historicBudget!.category_id,
      )?.spentAmount,
    ).toBeGreaterThan(0);
  });

  it("keeps demo-mode writes in browser memory instead of calling the backend", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      apiClient.post<{ success: boolean; data: { note: string | null } }>("/transactions", {
        category_id: "cat-expense-food",
        transaction_type: "EXPENSE",
        amount_cents: 125_000,
        transaction_date: new Date().toISOString(),
        note: "Perubahan sementara",
      }),
    ).resolves.toMatchObject({
      success: true,
      data: { note: "Perubahan sementara" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not queue demo transactions for later backend sync while offline", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    vi.stubGlobal("navigator", { onLine: false });

    await expect(
      syncCreateTransaction({
        category_id: "cat-expense-food",
        transaction_type: "EXPENSE",
        amount_cents: 75_000,
        transaction_date: new Date().toISOString(),
      }),
    ).resolves.toMatchObject({ queued: false });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
