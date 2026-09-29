import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { uiText } from "@/locales";
import { CashflowChartCard } from "./cashflow-chart-card";

describe("CashflowChartCard", () => {
  it("shows the existing empty state for a successful empty series", () => {
    render(<CashflowChartCard data={[]} />);

    expect(screen.getByText(uiText.common.noDataAvailable)).toBeInTheDocument();
  });
});
