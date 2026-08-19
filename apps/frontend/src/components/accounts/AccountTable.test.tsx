import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
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
  beforeEach(() => {
    useDashboardCurrencyStore.setState({ currency: "USD" });
  });

  it.each(["USD", "IDR", "SGD", "EUR"] as const)(
    "uses the active dashboard currency %s for account balances",
    (currency) => {
      useDashboardCurrencyStore.setState({ currency });

      render(
        <AccountTable
          accounts={[makeAccount()]}
          onView={() => undefined}
          onEdit={() => undefined}
          onSetDefault={() => undefined}
          onDelete={() => undefined}
        />,
      );

      const matcher = (content: string) => {
        if (currency === "USD" || currency === "SGD") {
          return content.includes("$") && content.includes("1,000,000");
        }
        if (currency === "IDR") {
          return content.includes("Rp") && content.includes("1.000.000");
        }
        return content.includes("€") && content.includes("1.000.000");
      };

      expect(screen.getAllByText((content) => matcher(String(content))).length).toBeGreaterThan(0);
    },
  );

  it("keeps the selected dashboard currency persisted through the store", () => {
    useDashboardCurrencyStore.getState().setCurrency("EUR");

    expect(useDashboardCurrencyStore.getState().currency).toBe("EUR");
    expect(localStorage.getItem("cashflow-dashboard-currency")).toBe("EUR");
  });
});
