import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { TransactionsPage } from "./transactions-page";
import { transactionService } from "@/services/transaction.service";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function formatDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("TransactionsPage initial date filter", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("sends fromDate and toDate for the current month on initial render", async () => {
    // Arrange: spy on services
    vi.spyOn(accountService, "list").mockResolvedValue([]);
    vi.spyOn(categoryService, "list").mockResolvedValue([]);

    const listSpy = vi.spyOn(transactionService, "list").mockResolvedValue({
      data: [],
      pagination: { totalItems: 0, totalPages: 0, page: 1 },
    } as any);

    // Compute expected dates for current month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const expectedFrom = formatDateInput(start);
    const expectedTo = formatDateInput(end);

    // Act: render page
    render(<TransactionsPage />);

    // Assert: transactionService.list called with params containing fromDate and toDate
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalled();
    });

    const calls = listSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const params = calls[0][0] || {};
    expect(params.fromDate).toBe(expectedFrom);
    expect(params.toDate).toBe(expectedTo);
  });
});
