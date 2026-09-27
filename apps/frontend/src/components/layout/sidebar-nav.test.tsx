import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { locales } from "@/locales";

let pathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("SidebarNav", () => {
  beforeEach(() => {
    pathname = "/dashboard";
    window.localStorage.clear();
  });

  it("keeps standalone items visible and collapses inactive groups by default", () => {
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: locales.id.navigation.dashboard })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: locales.id.navigation.settings })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: locales.id.navigation.accounts })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transaksi" })).toBeInTheDocument();
  });

  it("auto-expands active group and allows manual persistence", () => {
    pathname = "/transactions";
    const { unmount } = render(<SidebarNav />);

    expect(screen.getByRole("link", { name: locales.id.navigation.transactions })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transaksi" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Perencanaan" }));
    expect(screen.getByRole("link", { name: locales.id.navigation.budgets })).toBeInTheDocument();
    unmount();

    pathname = "/dashboard";
    render(<SidebarNav />);
    expect(screen.getByRole("link", { name: locales.id.navigation.budgets })).toBeInTheDocument();
  });

  it("renders an icon stack and removes accordion controls when collapsed", () => {
    render(<SidebarNav collapsed />);

    expect(screen.queryByRole("button", { name: "Transaksi" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: locales.id.navigation.transactions })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: locales.id.navigation.settings })).toBeInTheDocument();
    expect(screen.queryByText("Perencanaan")).not.toBeInTheDocument();
  });

  it("closes the collapsed navigation tooltip after a page is selected", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    render(<SidebarNav collapsed />);

    const link = screen.getByRole("link", { name: locales.id.navigation.income });
    fireEvent.pointerEnter(link, { pointerType: "mouse" });
    fireEvent.pointerMove(link, { pointerType: "mouse" });

    expect(await screen.findByRole("tooltip")).toHaveTextContent(locales.id.navigation.income);

    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(link);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});
