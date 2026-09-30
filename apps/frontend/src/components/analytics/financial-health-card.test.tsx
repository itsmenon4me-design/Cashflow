import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinancialHealthCard } from "./financial-health-card";
import { uiText } from "@/locales";
import type { AnalyticsHealth } from "@/services/analytics.service";

const health: AnalyticsHealth = {
  score: 0,
  label: "risk",
  savingRate: 0,
  expenseRatio: 0,
  incomeVsExpense: null,
  netCashFlow: "0",
  cashFlowPositive: false,
  spendingConcentration: 0,
};

describe("FinancialHealthCard", () => {
  it("shows the insufficient-data state instead of a zero risk score", () => {
    render(
      <FinancialHealthCard health={{ ...health, insufficientData: true }} />,
    );

    expect(
      screen.getByText(uiText.analytics.healthInsufficientDataTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uiText.analytics.healthInsufficientDataDescription),
    ).toBeInTheDocument();
    expect(screen.queryByText("0/100")).not.toBeInTheDocument();
    expect(
      screen.queryByText(uiText.analytics.labelRisk),
    ).not.toBeInTheDocument();
  });

  it("keeps rendering the existing score when the marker is absent", () => {
    render(<FinancialHealthCard health={health} />);

    expect(screen.getByText("0/100")).toBeInTheDocument();
    expect(screen.getByText(uiText.analytics.labelRisk)).toBeInTheDocument();
  });
});
