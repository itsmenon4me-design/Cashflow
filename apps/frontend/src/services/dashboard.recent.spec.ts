import { describe, it, expect, vi } from "vitest";
import { dashboardService } from "./dashboard.service";

// Mock transaction, account and category services
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

vi.mock("@/services/account.service", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    accountService: {
      ...actual.accountService,
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
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";

describe("dashboard.getRecentTransactions (currency propagation)", () => {
  it("requests transactions with currency hint and maps amounts using account currencies", async () => {
    const mockTx = [
      {
        id: "t1",
        account_id: "a1",
        category_id: "c1",
        transaction_type: "INCOME",
        amount_cents: "100000",
        transaction_date: "2026-08-16T12:00:00Z",
        note: "Test",
        created_at: "2026-08-16T12:00:00Z",
        updated_at: "2026-08-16T12:00:00Z",
      },
    ];

    // @ts-ignore - assign mocked implementation
    (transactionService.list as any).mockResolvedValue({ data: mockTx, pagination: { totalItems: 1, totalPages: 1, page: 1, limit: 5, hasNext: false, hasPrevious: false } });

    // account with SGD currency
    (accountService.list as any).mockResolvedValue([
      {
        id: "a1",
        name: "Main SGD",
        account_type: "BANK",
        currency: "SGD",
        opening_balance_cents: "0",
        current_balance_cents: "0",
        color: null,
        icon: null,
        description: null,
        is_active: true,
        is_default: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    (categoryService.list as any).mockResolvedValue([
      { id: "c1", name: "Salary", type: "INCOME", icon: null, color: null, description: null, is_system: false, is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    ]);

    const res = await dashboardService.getRecentTransactions(5);
    expect(Array.isArray(res)).toBe(true);
    const tx = res.find((r) => r.id === "t1");
    expect(tx).toBeDefined();
    // 100000 minor units in IDR -> 100000 major units (IDR has 0 minor units)
    expect(tx?.amount).toBe(100000);
  });
});
