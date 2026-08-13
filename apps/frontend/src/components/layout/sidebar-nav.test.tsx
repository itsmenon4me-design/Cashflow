import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { locales } from "@/locales";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("SidebarNav", () => {
  it("renders the forecast navigation label through localization", () => {
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: locales.id.navigation.forecast })).toBeInTheDocument();
  });

  it("renders all group headings", () => {
    render(<SidebarNav />);

    for (const label of [
      locales.id.navigation.groupMain,
      locales.id.navigation.groupFinance,
      locales.id.navigation.groupPlanning,
      locales.id.navigation.groupInsight,
      locales.id.navigation.groupSystem,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders every navigation item across groups", () => {
    render(<SidebarNav />);

    const expected = [
      locales.id.navigation.dashboard,
      locales.id.navigation.accounts,
      locales.id.navigation.income,
      locales.id.navigation.expense,
      locales.id.navigation.transactions,
      locales.id.navigation.categories,
      locales.id.navigation.budgets,
      locales.id.navigation.goals,
      locales.id.navigation.investments,
      locales.id.navigation.forecast,
      locales.id.navigation.reports,
      locales.id.navigation.analytics,
      locales.id.navigation.notifications,
      locales.id.navigation.auditLog,
      locales.id.navigation.settings,
    ];

    for (const label of expected) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("collapses and expands a group via its toggle button", () => {
    mockPathname = "/";
    render(<SidebarNav />);

    const toggle = screen.getByRole("button", {
      name: `${locales.id.dashboard.collapseSection} ${locales.id.navigation.groupFinance}`,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: locales.id.navigation.accounts })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: locales.id.navigation.accounts })).toBeInTheDocument();
  });

  it("auto-expands the group containing the active route", () => {
    mockPathname = "/";
    const { rerender } = render(<SidebarNav />);

    fireEvent.click(
      screen.getByRole("button", {
        name: `${locales.id.dashboard.collapseSection} ${locales.id.navigation.groupFinance}`,
      })
    );
    expect(screen.queryByRole("link", { name: locales.id.navigation.transactions })).not.toBeInTheDocument();

    mockPathname = "/accounts";
    rerender(<SidebarNav />);

    expect(screen.getByRole("link", { name: locales.id.navigation.accounts })).toBeInTheDocument();
  });
});
