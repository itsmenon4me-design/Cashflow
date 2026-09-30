import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "./mobile-nav";
import { useLanguageStore } from "@/stores/language.store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));

describe("MobileNav", () => {
  beforeEach(() => {
    useLanguageStore.getState().setLanguage("id");
  });

  afterEach(() => {
    useLanguageStore.getState().setLanguage("id");
  });

  it("links directly to the dashboard instead of redirecting through the root route", () => {
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: "Beranda" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("keeps bottom navigation available until the desktop sidebar breakpoint", () => {
    render(<MobileNav />);

    const navigation = screen.getByRole("navigation", { name: "Navigasi utama" });
    expect(navigation.className).toContain("fixed");
    expect(navigation.className).toContain("lg:hidden");
    expect(navigation.className).not.toContain("md:hidden");
  });

  it("updates labels immediately when the interface language changes", () => {
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: "Beranda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transaksi" })).toBeInTheDocument();

    act(() => {
      useLanguageStore.getState().setLanguage("en");
    });

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
  });
});
