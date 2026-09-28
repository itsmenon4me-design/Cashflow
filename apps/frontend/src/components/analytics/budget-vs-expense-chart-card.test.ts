import { describe, expect, it } from "vitest";
import {
  buildBudgetComparisonData,
  getFullMonthWindow,
  type BudgetComparisonItem,
} from "./budget-vs-expense-chart-card";
import type { BudgetResponse } from "@/services/budget.service";
import type { CategoryBreakdownItem } from "@/services/report.service";

function budget(
  categoryId: string,
  categoryName: string,
  month: number,
  year: number,
  amount: string,
): BudgetResponse {
  return {
    id: `${categoryId}-${month}`,
    category_id: categoryId,
    category_name: categoryName,
    currency: "IDR",
    budget_amount_cents: amount,
    month,
    year,
    created_at: "",
    updated_at: "",
  };
}

function expense(
  categoryId: string,
  categoryName: string,
  amount: string,
): CategoryBreakdownItem {
  return {
    categoryId,
    categoryName,
    totalAmount: amount,
    percentage: 0,
    transactionCount: 1,
  };
}

describe("buildBudgetComparisonData", () => {
  it("sums budgets only for full months and joins spending from the same months", () => {
    const monthWindow = getFullMonthWindow({
      startDate: "2026-02-15T00:00:00.000Z",
      endDate: "2026-04-15T23:59:59.999Z",
    });
    expect(monthWindow?.monthKeys).toEqual(new Set(["2026-3"]));

    const result = buildBudgetComparisonData(
      [
        budget("food", "Makanan", 2, 2026, "1000000"),
        budget("food", "Makanan", 3, 2026, "1200000"),
        budget("food", "Makanan", 4, 2026, "1400000"),
        budget("transport", "Transportasi", 3, 2026, "900000"),
      ],
      [
        expense("food", "Makanan", "700000"),
        expense("health", "Kesehatan", "200000"),
      ],
      monthWindow!.monthKeys,
    );

    expect(result).toEqual<BudgetComparisonItem[]>([
      { categoryId: "food", name: "Makanan", budget: 1200000, spent: 700000 },
      { categoryId: "health", name: "Kesehatan", budget: 0, spent: 200000 },
      { categoryId: "transport", name: "Transportasi", budget: 900000, spent: 0 },
    ]);
  });

  it("returns no comparison window when the range contains no full month", () => {
    expect(
      getFullMonthWindow({
        startDate: "2026-03-05T00:00:00.000Z",
        endDate: "2026-03-28T23:59:59.999Z",
      }),
    ).toBeNull();
  });

  it("returns no comparison window for an invalid range", () => {
    expect(
      getFullMonthWindow({ startDate: "invalid", endDate: "also-invalid" }),
    ).toBeNull();
  });
});
