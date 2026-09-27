import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CategoriesPage } from "./categories-page";
import { categoryService } from "@/services/category.service";
import type { CategoryResponse } from "@/types/backend";
import { uiText } from "@/locales";

function makeCategory(id: string, type: CategoryResponse["type"], name: string): CategoryResponse {
  return {
    id,
    name,
    type,
    icon: null,
    color: null,
    description: null,
    is_system: false,
    is_active: true,
    created_at: "2026-09-27T00:00:00.000Z",
    updated_at: "2026-09-27T00:00:00.000Z",
  };
}

describe("CategoriesPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows one loading surface before the empty state", async () => {
    let resolveCategories!: (categories: CategoryResponse[]) => void;
    vi.spyOn(categoryService, "list").mockReturnValue(
      new Promise((resolve) => {
        resolveCategories = resolve;
      }),
    );

    render(<CategoriesPage />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen.queryByText(uiText.categories.count.replace("{count}", "0")),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: uiText.categories.emptyTitle })).not.toBeInTheDocument();

    resolveCategories([]);

    expect(
      await screen.findByRole("heading", { name: uiText.categories.emptyTitle }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen.getByText(uiText.categories.count.replace("{count}", "0")),
    ).toBeInTheDocument();
  });

  it("keeps separate income and expense panels when categories exist", async () => {
    vi.spyOn(categoryService, "list").mockResolvedValue([
      makeCategory("income-1", "INCOME", "Salary"),
      makeCategory("expense-1", "EXPENSE", "Food"),
    ]);

    render(<CategoriesPage />);

    expect(
      await screen.findByText(uiText.transactions.typeIncome),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uiText.transactions.typeExpense),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
