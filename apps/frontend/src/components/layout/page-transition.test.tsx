import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageTransition } from "./page-transition";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

const pendingRoute = new Promise<void>(() => {});

function PendingRoute(): never {
  throw pendingRoute;
}

describe("PageTransition", () => {
  it("shows the dashboard-shaped fallback while the destination route suspends", () => {
    const { container } = render(
      <PageTransition>
        <PendingRoute />
      </PageTransition>,
    );

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});
