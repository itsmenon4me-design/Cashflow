import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { BudgetsPage } from "./budgets-page";
import { budgetService } from "@/services/budget.service";
import { categoryService } from "@/services/category.service";

const searchParamsMock = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock.value,
}));

function analysisResponse(month: number, year: number) {
  return {
    month,
    year,
    overall: { budget: 0, spent: 0, remaining: 0, percentageUsed: 0 },
    categories: [],
  };
}

describe("BudgetsPage period from search params", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    searchParamsMock.value = new URLSearchParams();
  });

  it("defaults to the current month when no params are present", async () => {
    vi.spyOn(budgetService, "list").mockResolvedValue([]);
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    const analysisSpy = vi
      .spyOn(budgetService, "analysis")
      .mockResolvedValue(analysisResponse(1, 2026));

    render(<BudgetsPage />);

    await waitFor(() => {
      expect(analysisSpy).toHaveBeenCalled();
    });
    const now = new Date();
    expect(analysisSpy.mock.calls[0][0]).toBe(now.getMonth() + 1);
    expect(analysisSpy.mock.calls[0][1]).toBe(now.getFullYear());
  });

  it("lands on ?month=&year= from a global-search result instead of the current month", async () => {
    // Regression: clicking a budget search result for another month used to
    // land on the current-month view, hiding the budget that was clicked.
    searchParamsMock.value = new URLSearchParams("month=7&year=2026");

    vi.spyOn(budgetService, "list").mockResolvedValue([]);
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    const analysisSpy = vi
      .spyOn(budgetService, "analysis")
      .mockResolvedValue(analysisResponse(7, 2026));

    render(<BudgetsPage />);

    await waitFor(() => {
      expect(analysisSpy).toHaveBeenCalled();
    });
    expect(analysisSpy.mock.calls[0][0]).toBe(7);
    expect(analysisSpy.mock.calls[0][1]).toBe(2026);
  });

  it("ignores invalid ?month=&year= values and falls back to the current month", async () => {
    searchParamsMock.value = new URLSearchParams("month=13&year=2026");

    vi.spyOn(budgetService, "list").mockResolvedValue([]);
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    const analysisSpy = vi
      .spyOn(budgetService, "analysis")
      .mockResolvedValue(analysisResponse(1, 2026));

    render(<BudgetsPage />);

    await waitFor(() => {
      expect(analysisSpy).toHaveBeenCalled();
    });
    const now = new Date();
    expect(analysisSpy.mock.calls[0][0]).toBe(now.getMonth() + 1);
    expect(analysisSpy.mock.calls[0][1]).toBe(now.getFullYear());
  });
});
