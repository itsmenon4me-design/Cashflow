import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getSafeReturnPath, TransactionsPage } from "./transactions-page";
import { transactionService } from "@/services/transaction.service";
import { categoryService } from "@/services/category.service";
import { uiText } from "@/locales";
import { ApiTimeoutError } from "@/lib/axios";
import { toInputDate } from "@/lib/date";

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

  it.each([
    { page: "income", transactionType: "income" as const },
    { page: "expense", transactionType: "expense" as const },
    { page: "history", transactionType: undefined },
  ])("defaults both date filters to today on the $page page", async ({ transactionType }) => {
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    const listSpy = vi.spyOn(transactionService, "list").mockResolvedValue({
      data: [],
      pagination: { totalItems: 0, totalPages: 0, page: 1 },
    } as any);

    const { container } = render(<TransactionsPage transactionType={transactionType} />);
    const today = toInputDate(new Date());

    const dateFilters = container.querySelectorAll('input[type="date"]');
    expect(dateFilters).toHaveLength(2);
    dateFilters.forEach((filter) => {
      expect(filter).not.toHaveClass("appearance-none");
      expect(filter).toHaveClass("date-input-no-indicator");
      expect(filter).toHaveValue(today);
      expect(filter.parentElement).toHaveClass(
        "justify-center",
        "border-border",
        "bg-input/30",
        "text-foreground",
      );
      expect(filter.parentElement?.querySelector("span")).toHaveClass(
        "w-full",
        "text-center",
      );
    });
    expect(screen.queryByText(uiText.transactions.selectDate)).not.toBeInTheDocument();
    const [year, month, day] = today.split("-");
    expect(screen.getAllByText(`${day}/${month}/${year}`, { exact: true })).toHaveLength(2);
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({
        fromDate: today,
        toDate: today,
      }));
    });
  });

  it("resets the date range to today", async () => {
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    vi.spyOn(transactionService, "list").mockResolvedValue({
      data: [],
      pagination: { totalItems: 0, totalPages: 0, page: 1 },
    } as any);
    render(<TransactionsPage />);

    fireEvent.change(screen.getByLabelText(uiText.transactions.fromDate), {
      target: { value: "2020-01-01" },
    });
    fireEvent.change(screen.getByLabelText(uiText.transactions.toDate), {
      target: { value: "2020-01-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: uiText.transactions.resetFilters }));

    const today = toInputDate(new Date());
    expect(screen.getByLabelText(uiText.transactions.fromDate)).toHaveValue(today);
    expect(screen.getByLabelText(uiText.transactions.toDate)).toHaveValue(today);
  });

  it("keeps desktop filters compact and lets them wrap by available width", async () => {
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    vi.spyOn(transactionService, "list").mockResolvedValue({
      data: [],
      pagination: { totalItems: 0, totalPages: 0, page: 1 },
    } as any);

    const { container, unmount } = render(<TransactionsPage />);

    const filterGrid = container.querySelector('[data-slot="transaction-filter-controls"]');
    expect(filterGrid).toHaveClass(
      "lg:grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),10rem))]",
    );
    expect(
      screen.getByRole("combobox", { name: uiText.table.category }),
    ).toHaveClass("max-w-40");
    expect(
      screen.getByRole("button", { name: uiText.transactions.resetFilters }).parentElement,
    ).toHaveClass("lg:col-span-1");

    unmount();
    render(<TransactionsPage transactionType="income" />);

    expect(
      screen.getByRole("combobox", { name: uiText.table.category }).parentElement,
    ).toHaveClass("max-w-40");
  });

  it("shows no placeholder before transactions load, then renders the data", async () => {
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

    expect(screen.queryByRole("status", { name: uiText.common.loading })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="table"]')).not.toBeInTheDocument();
    expect(
      screen.queryByText(uiText.transactions.count.replace("{count}", "0")),
    ).not.toBeInTheDocument();
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

  it("replaces the loading state with an error state when the request times out", async () => {
    vi.spyOn(categoryService, "list").mockResolvedValue([]);
    vi.spyOn(transactionService, "list").mockRejectedValue(
      new ApiTimeoutError(20_000),
    );

    render(<TransactionsPage transactionType="income" />);

    expect(await screen.findByText(uiText.states.errorTitle)).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: uiText.common.loading }),
    ).not.toBeInTheDocument();
  });
});