import { describe, it, expect, vi } from "vitest";
import { dashboardService } from "./dashboard.service";

vi.mock("@/services/transaction.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    transactionService: {
      ...actual.transactionService,
      list: vi.fn(),
    },
  };
});

vi.mock("@/services/category.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    categoryService: {
      ...actual.categoryService,
      list: vi.fn(),
    },
  };
});

import { transactionService } from "@/services/transaction.service";
import { categoryService } from "@/services/category.service";

describe("dashboard.getRecentTransactions", () => {
  it("maps transaction list data correctly", async () => {
    const mockTx = [
      {
        id: "t1",
        category_id: "c1",
        transaction_type: "INCOME",
        amount_cents: "100000",
        transaction_date: "2026-08-16T12:00:00Z",
        note: "Test",
        created_at: "2026-08-16T12:00:00Z",
        updated_at: "2026-08-16T12:00:00Z",
      },
    ];

    (transactionService.list as any).mockResolvedValue({ data: mockTx, pagination: { totalItems: 1, totalPages: 1, page: 1, limit: 5 } });
    (categoryService.list as any).mockResolvedValue([
      { id: "c1", name: "Salary", type: "INCOME" },
    ]);

    const res = await dashboardService.getRecentTransactions(5);
    expect(Array.isArray(res)).toBe(true);
    const tx = res.find((r) => r.id === "t1");
    expect(tx).toBeDefined();
    expect(tx?.amount).toBe(100000);
  });
});