import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageTransition } from "./page-transition";

const pathnameMock = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.value,
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

  it("resets the fallback when the destination pathname changes", () => {
    const { container, rerender } = render(
      <PageTransition>
        <PendingRoute />
      </PageTransition>,
    );

    expect(container.querySelector('[class*="lg:grid-cols-3"]')).toBeNull();

    pathnameMock.value = "/categories";
    rerender(
      <PageTransition>
        <PendingRoute />
      </PageTransition>,
    );

    expect(container.querySelector('[class*="lg:grid-cols-3"]')).toBeInTheDocument();
  });

  it("skips the fallback when the destination commits before the delay", async () => {
    pathnameMock.value = "/dashboard";
    window.history.replaceState({}, "", "/dashboard");
    const currentRoute = <div>Current route</div>;
    const { container, rerender } = render(<PageTransition>{currentRoute}</PageTransition>);

    vi.useFakeTimers();
    try {
      act(() => {
        window.dispatchEvent(new CustomEvent("cashflow:navigate", { detail: "/categories" }));
      });

      expect(container).toHaveTextContent("Current route");
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(99);
      });
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();

      pathnameMock.value = "/categories";
      window.history.replaceState({}, "", "/categories");
      const destinationRoute = <div>Categories route</div>;
      act(() => {
        rerender(<PageTransition>{destinationRoute}</PageTransition>);
      });
      expect(container).toHaveTextContent("Categories route");
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(container).toHaveTextContent("Categories route");
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the fallback after the delay and removes it as soon as the route commits", async () => {
    pathnameMock.value = "/dashboard";
    window.history.replaceState({}, "", "/dashboard");
    const currentRoute = <div>Current route</div>;
    const { container, rerender } = render(<PageTransition>{currentRoute}</PageTransition>);

    vi.useFakeTimers();
    try {
      act(() => {
        window.dispatchEvent(new CustomEvent("cashflow:navigate", { detail: "/categories" }));
      });
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
      expect(container).not.toHaveTextContent("Current route");

      pathnameMock.value = "/categories";
      window.history.replaceState({}, "", "/categories");
      act(() => {
        rerender(<PageTransition>{currentRoute}</PageTransition>);
      });
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();

      const destinationRoute = <div>Categories route</div>;
      act(() => {
        rerender(<PageTransition>{destinationRoute}</PageTransition>);
      });
      expect(container).toHaveTextContent("Categories route");
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
