import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { TransactionsPage } from "./transactions-page";
import { transactionService } from "@/services/transaction.service";
import { categoryService } from "@/services/category.service";

const searchParamsMock = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock.value,
}));

describe("TransactionsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    searchParamsMock.value = new URLSearchParams();
  });

  it("uses the ?q= from global search on initial render", async () => {
    searchParamsMock.value = new URLSearchParams("q=OldTx-123");

    vi.spyOn(categoryService, "list").mockResolvedValue([]);

    const listSpy = vi.spyOn(transactionService, "list").mockResolvedValue({
      data: [],
      pagination: { totalItems: 0, totalPages: 0, page: 1 },
    } as any);

    render(<TransactionsPage />);

    await waitFor(() => {
      const call = listSpy.mock.calls.find((c) => (c[0] || {}).q === "OldTx-123");
      expect(call).toBeTruthy();
    });
  });

  it("filters by a fixed transaction type", async () => {
    vi.spyOn(categoryService, "list").mockResolvedValue([]);

    const listSpy = vi.spyOn(transactionService, "list").mockResolvedValue({
      data: [],
      pagination: { totalItems: 0, totalPages: 0, page: 1 },
    } as any);

    render(<TransactionsPage transactionType="expense" />);

    await waitFor(() => {
      const call = listSpy.mock.calls.find((c) => (c[0] || {}).type === "EXPENSE");
      expect(call).toBeTruthy();
    });
  });
});