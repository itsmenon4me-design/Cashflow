import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountTable } from "@/components/accounts/AccountTable";
import type { AccountItem } from "@/services/account.service";

const makeAccount = (): AccountItem => ({
  id: "acct-1",
  name: "Kas Utama",
  accountType: "BANK",
  currency: "IDR",
  balance: 1000000,
  openingBalance: 1000000,
  color: null,
  description: "Akun utama",
  isActive: true,
  isDefault: true,
  createdAt: "2024-01-01T00:00:00.000Z",
});

describe("AccountTable", () => {
  it("renders account balances in IDR", () => {
    render(
      <AccountTable
        accounts={[makeAccount()]}
        onView={() => undefined}
        onEdit={() => undefined}
        onSetDefault={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(screen.getAllByText((content) => String(content).includes("Rp") && String(content).includes("1.000.000")).length).toBeGreaterThan(0);
  });
});
