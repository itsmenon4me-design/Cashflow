import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { TransactionsPage } from "./transactions-page";
import { transactionService } from "@/services/transaction.service";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

describe("TransactionsPage currency change", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // reset store to default to avoid leaking state between tests
    useDashboardCurrencyStore.setState({ currency: "USD" } as any);
  });

  it("refetches transactions when dashboard currency changes", async () => {
    vi.spyOn(accountService, "list").mockResolvedValue([]);
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    const listSpy = vi.spyOn(transactionService, "list").mockResolvedValue({
      data: [],
      pagination: { totalItems: 0, totalPages: 1, page: 1, limit: 20, hasNext: false, hasPrevious: false },
    } as any);

    render(<TransactionsPage />);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalled();
    });

    // initial call should contain default currency (USD)
    const firstParams = listSpy.mock.calls[0][0] || {};
    expect(firstParams.currency).toBe("USD");

    // clear mock calls, change currency
    listSpy.mockClear();
    useDashboardCurrencyStore.setState({ currency: "SGD" } as any);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalled();
    });

    const nextParams = listSpy.mock.calls[0][0] || {};
    expect(nextParams.currency).toBe("SGD");
  });
});
