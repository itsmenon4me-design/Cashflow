import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { uiText } from "@/locales";
import {
  CashflowChartCard,
  toCashflowChartData,
} from "./cashflow-chart-card";

describe("CashflowChartCard", () => {
  it("maps negative net flow to an upward magnitude without losing its sign", () => {
    expect(
      toCashflowChartData([
        { month: "Jan", balance: 1200 },
        { month: "Feb", balance: -800 },
        { month: "Mar", balance: null },
      ]),
    ).toEqual([
      { month: "Jan", balance: 1200, chartValue: 1200 },
      { month: "Feb", balance: -800, chartValue: 800 },
      { month: "Mar", balance: null, chartValue: null },
    ]);
  });

  it("shows the existing empty state for a successful empty series", () => {
    render(<CashflowChartCard data={[]} />);

    expect(screen.getByText(uiText.common.noDataAvailable)).toBeInTheDocument();
  });

  it("labels positive and negative flow in the chart legend", () => {
    render(
      <CashflowChartCard
        data={[
          { month: "Jan", balance: 1200 },
          { month: "Feb", balance: -800 },
        ]}
      />,
    );

    expect(
      screen.getByText(uiText.analytics.cashFlowPositive),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uiText.analytics.cashFlowNegative),
    ).toBeInTheDocument();
  });
});
