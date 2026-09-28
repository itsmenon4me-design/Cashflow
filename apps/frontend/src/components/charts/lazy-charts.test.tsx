import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: () => function MockChart() {
    return <div>Chart module ready</div>;
  },
}));

import { LazyCashflowChartCard } from "@/components/charts/lazy-charts";

let intersectionCallback: IntersectionObserverCallback | undefined;

class NonIntersectingObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  observe() {}
  disconnect() {}
}

describe("lazy chart viewport gate", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    intersectionCallback = undefined;
  });

  it("starts loading when the chart enters the viewport", () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", NonIntersectingObserver);

    render(<LazyCashflowChartCard data={[]} />);

    expect(screen.getByRole("status", { name: "Memuat grafik" })).toBeInTheDocument();

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getByText("Chart module ready")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Memuat grafik" })).not.toBeInTheDocument();
  });

  it("starts loading after the fallback if the observer never reports visibility", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", NonIntersectingObserver);

    render(<LazyCashflowChartCard data={[]} />);

    expect(screen.getByRole("status", { name: "Memuat grafik" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("Chart module ready")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Memuat grafik" })).not.toBeInTheDocument();
  });
});
