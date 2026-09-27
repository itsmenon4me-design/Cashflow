import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuickAddTransaction } from "./quick-add-transaction";
import { categoryService } from "@/services/category.service";
import { useAddTransactionStore } from "@/stores/add-transaction.store";
import { uiText } from "@/locales";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/components/transactions/TransactionForm", () => ({
  TransactionForm: ({
    open,
    categories,
    categoryLookupStatus,
    onRetryCategories,
  }: {
    open: boolean;
    categories: string[];
    categoryLookupStatus?: "loading" | "error";
    onRetryCategories?: () => void;
  }) =>
    open ? (
      <div>
        {categories.join(", ")}
        {categoryLookupStatus === "error" && (
          <div role="alert">
            {uiText.transactions.categoryLoadFailed}
            <button onClick={onRetryCategories}>{uiText.common.retry}</button>
          </div>
        )}
      </div>
    ) : null,
}));

describe("QuickAddTransaction", () => {
  afterEach(() => {
    cleanup();
    useAddTransactionStore.getState().closeDialog();
    vi.restoreAllMocks();
  });

  it("loads categories when the shared dialog is opened externally", async () => {
    const listSpy = vi.spyOn(categoryService, "list").mockResolvedValue([
      {
        id: "category-groceries",
        name: "Belanja",
        type: "EXPENSE",
        icon: null,
        color: null,
        description: null,
        is_system: false,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ]);

    render(<QuickAddTransaction showTrigger={false} />);
    useAddTransactionStore.getState().openDialog();

    expect(await screen.findByText("Belanja")).toBeInTheDocument();
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));
  });

  it("allows retrying category lookup after the initial request fails", async () => {
    const listSpy = vi.spyOn(categoryService, "list")
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce([
        {
          id: "category-groceries",
          name: "Belanja",
          type: "EXPENSE",
          icon: null,
          color: null,
          description: null,
          is_system: false,
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      ]);

    render(<QuickAddTransaction showTrigger={false} />);
    useAddTransactionStore.getState().openDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      uiText.transactions.categoryLoadFailed,
    );
    fireEvent.click(screen.getByRole("button", { name: uiText.common.retry }));

    expect(await screen.findByText("Belanja")).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
