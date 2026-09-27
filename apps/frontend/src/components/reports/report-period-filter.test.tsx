import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportPeriodFilter } from "./report-period-filter";

describe("ReportPeriodFilter", () => {
  it("announces a refresh only when a refresh label is provided and loading", () => {
    const props = {
      value: "thisMonth" as const,
      range: {
        startDate: "2026-09-01T00:00:00.000Z",
        endDate: "2026-09-30T23:59:59.999Z",
      },
      customStart: "",
      customEnd: "",
      onPeriodChange: vi.fn(),
      onCustomStartChange: vi.fn(),
      onCustomEndChange: vi.fn(),
      onApplyCustom: vi.fn(),
      refreshingLabel: "Updating analytics.",
    };

    const { rerender } = render(
      <ReportPeriodFilter {...props} loading refreshingLabel={props.refreshingLabel} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Updating analytics.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    rerender(<ReportPeriodFilter {...props} loading={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
