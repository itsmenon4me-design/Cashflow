import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { getSafeReturnPath, TransactionsPage } from "./transactions-page";
import { transactionService } from "@/services/transaction.service";
import { categoryService } from "@/services/category.service";
import { uiText } from "@/locales";

const searchParamsMock = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock.value,
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("TransactionsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    searchParamsMock.value = new URLSearchParams();
  });

  it("only allows return destinations on the current origin", () => {
    const origin = "http://localhost:3000";

    expect(getSafeReturnPath("/reports?period=month#summary", origin)).toBe(
      "/reports?period=month#summary",
    );
    expect(getSafeReturnPath("/\\evil.example", origin)).toBe("/dashboard");
    expect(getSafeReturnPath("//evil.example/path", origin)).toBe("/dashboard");
    expect(getSafeReturnPath("https://evil.example/path", origin)).toBe("/dashboard");
    expect(getSafeReturnPath(null, origin)).toBe("/dashboard");
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

  it("shows a loading skeleton instead of an empty-state message before transactions load", async () => {
    let resolveTransactions!: (
      result: Awaited<ReturnType<typeof transactionService.list>>,
    ) => void;
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    vi.spyOn(transactionService, "list").mockReturnValue(
      new Promise((resolve) => {
        resolveTransactions = resolve;
      }) as ReturnType<typeof transactionService.list>,
    );

    render(<TransactionsPage transactionType="income" />);

    expect(screen.getByRole("status", { name: uiText.common.loading })).toBeInTheDocument();
    expect(screen.queryByText(uiText.transactions.emptyTitle)).not.toBeInTheDocument();

    resolveTransactions({
      success: true,
      data: [
        {
          id: "income-1",
          category_id: "category-1",
          transaction_type: "INCOME",
          amount_cents: "100000",
          transaction_date: "2026-09-26T06:37:00.000Z",
          note: "DATA DUMMY",
          created_at: "2026-09-26T06:37:00.000Z",
          updated_at: "2026-09-26T06:37:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });

    expect(await screen.findAllByText("DATA DUMMY")).toHaveLength(2);
    const mobileList = screen.getByRole("list");
    expect(within(mobileList).getByText("DATA DUMMY")).toBeInTheDocument();
    expect(within(mobileList).getAllByRole("button")).toHaveLength(4);
    expect(screen.queryByRole("status", { name: uiText.common.loading })).not.toBeInTheDocument();
  });
});