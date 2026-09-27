import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileNav } from "./mobile-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));

describe("MobileNav", () => {
  it("links directly to the dashboard instead of redirecting through the root route", () => {
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: "Beranda" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
