import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriesPage } from "./categories-page";
import { categoryService } from "@/services/category.service";
import type { CategoryResponse } from "@/types/backend";
import { uiText } from "@/locales";

let scrollIntoViewDescriptor: PropertyDescriptor | null | undefined;

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
    if (scrollIntoViewDescriptor !== undefined) {
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
      scrollIntoViewDescriptor = undefined;
    }
    vi.restoreAllMocks();
  });

  it("does not show a loading indicator while categories are loading", async () => {
    let resolveCategories!: (categories: CategoryResponse[]) => void;
    vi.spyOn(categoryService, "list").mockReturnValue(
      new Promise((resolve) => {
        resolveCategories = resolve;
      }),
    );

    render(<CategoriesPage />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

  it("shows income and expense categories together and filters by type", async () => {
    const user = userEvent.setup();
    vi.spyOn(categoryService, "list").mockResolvedValue([
      makeCategory("income-1", "INCOME", "Salary"),
      makeCategory("expense-1", "EXPENSE", "Food"),
    ]);

    render(<CategoriesPage />);

    expect(await screen.findAllByText("Gaji")).not.toHaveLength(0);
    expect(screen.getAllByText("Makanan")).not.toHaveLength(0);
    expect(screen.getByText(uiText.categories.count.replace("{count}", "2"))).toBeInTheDocument();

    scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    ) ?? null;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    fireEvent.click(screen.getByRole("combobox", { name: uiText.categories.filterType }));
    await screen.findByRole("option", { name: uiText.transactions.typeIncome });
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getAllByText("Gaji")).not.toHaveLength(0);
    expect(screen.queryByText("Makanan")).not.toBeInTheDocument();
    expect(screen.getByText(uiText.categories.count.replace("{count}", "1"))).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a reset action when filters match no categories", async () => {
    const user = userEvent.setup();
    vi.spyOn(categoryService, "list").mockResolvedValue([
      makeCategory("income-1", "INCOME", "Salary"),
    ]);

    render(<CategoriesPage />);
    await screen.findAllByText("Gaji");

    await user.type(
      screen.getByRole("textbox", { name: uiText.categories.searchPlaceholder }),
      "not a category",
    );

    expect(
      await screen.findByRole("heading", { name: uiText.categories.noMatchesTitle }),
    ).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: uiText.transactions.resetFilters }).slice(-1)[0],
    );
    expect(await screen.findAllByText("Gaji")).not.toHaveLength(0);
  });
});
