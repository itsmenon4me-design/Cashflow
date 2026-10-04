import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionFilters } from "./TransactionFilters";
import type { TransactionFiltersState } from "@/features/transactions/types";

const filters: TransactionFiltersState = {
  search: "",
  category: "all",
  type: "all",
  status: "all",
  startDate: "2026-09-28",
  endDate: "2026-09-28",
};

describe("TransactionFilters", () => {
  it("opens the native date picker from the date field without a calendar button", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TransactionFilters
        filters={filters}
        categoryGroups={[]}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );
    const startDate = screen.getByLabelText("Dari tanggal") as HTMLInputElement;
    const showPicker = vi.fn();
    Object.defineProperty(startDate, "showPicker", { configurable: true, value: showPicker });

    fireEvent.click(startDate);

    expect(showPicker).toHaveBeenCalledOnce();
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(container.querySelectorAll('button[aria-label*="kalender" i]')).toHaveLength(0);
    expect(screen.getAllByText("28/09/2026", { exact: true })).toHaveLength(2);
    expect(screen.getByText("Dari tanggal")).toHaveClass("translate-x-1");
    expect(screen.getByText("Sampai tanggal")).toHaveClass("translate-x-1");
    expect(container.querySelector('[data-slot="transaction-filter-controls"]')).toHaveClass("grid-cols-2");
    expect(screen.getByRole("button", { name: /reset/i }).parentElement).toHaveClass("col-span-2");
  });

  it("keeps dedicated-page categories above a paired date range", () => {
    const { container } = render(
      <TransactionFilters
        filters={filters}
        categoryGroups={[]}
        onChange={vi.fn()}
        onReset={vi.fn()}
        showTypeFilter={false}
      />,
    );
    const controls = container.querySelector('[data-slot="transaction-filter-controls"]');
    const category = screen.getByRole("combobox", { name: "Kategori" });

    expect(controls).toHaveClass("grid-cols-2");
    expect(category.parentElement).toHaveClass("col-span-2");
    expect(container.querySelector("#filter-from-date")?.parentElement?.parentElement?.parentElement).toBe(controls);
    expect(container.querySelector("#filter-to-date")?.parentElement?.parentElement?.parentElement).toBe(controls);
  });
});
