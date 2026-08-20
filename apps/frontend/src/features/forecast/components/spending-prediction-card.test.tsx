import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpendingPredictionCard } from "@/features/forecast/components/spending-prediction-card";
import { locales } from "@/locales";
import { formatCurrencyCents } from "@/lib/format";
import type { SpendingPredictionResponse } from "@/types/backend";

function createSpendingResponse(overrides: Partial<SpendingPredictionResponse> = {}): SpendingPredictionResponse {
  return {
    currency: "IDR",
    period: "2025-03",
    predictedTotalCents: "2500000",
    confidence: 0.82,
    categories: [
      {
        categoryId: "cat-1",
        categoryName: "Food",
        predictedAmountCents: "1500000",
        confidence: 0.85,
        basedOnMonths: 5,
      },
      {
        categoryId: "cat-2",
        categoryName: "Transport",
        predictedAmountCents: "750000",
        confidence: 0.72,
        basedOnMonths: 4,
      },
    ],
    noHistoryCategoryIds: [],
    otherCents: "250000",
    insufficientData: false,
    ...overrides,
  };
}

describe("SpendingPredictionCard", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders the category breakdown and preserves backend ordering", () => {
    render(
      <SpendingPredictionCard
        data={createSpendingResponse()}
        currency="IDR"
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    const foodValue = formatCurrencyCents("1500000", "IDR");
    const transportValue = formatCurrencyCents("750000", "IDR");

    expect(screen.getByText(locales.id.forecast.spendingTitle)).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) => (element?.textContent ?? "").includes(locales.id.forecast.spendingPeriodLabel)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Makanan/i)).toBeInTheDocument();
    expect(screen.getByText(/Transportasi/i)).toBeInTheDocument();
    // 1,500,000 / 750,000 IDR minor units must render as Rp1.500.000 / Rp750.000,
    // never the old /100 "15.000" / "7.500" artifact.
    expect(screen.getAllByText((_, element) => (element?.textContent ?? "").includes(foodValue)).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => (element?.textContent ?? "").includes(transportValue)).length).toBeGreaterThan(0);
    expect(screen.queryByText((_, element) => (element?.textContent ?? "").includes("15.000"))).toBeNull();
    expect(screen.queryByText((_, element) => (element?.textContent ?? "").includes("7.500"))).toBeNull();
    expect(screen.getAllByText((_, element) => (element?.textContent ?? "").includes(locales.id.forecast.confidenceHigh)).length).toBeGreaterThan(0);
    expect(screen.getByText(locales.id.forecast.spendingBasedOnMonths.replace("{count}", "5"))).toBeInTheDocument();
  });

  it("hides the other spending section when the backend reports zero", () => {
    render(
      <SpendingPredictionCard
        data={createSpendingResponse({ otherCents: "0" })}
        currency="IDR"
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    expect(screen.queryByText(locales.id.forecast.spendingOtherLabel)).not.toBeInTheDocument();
  });

  it("renders the empty state when the backend has no category data", () => {
    render(
      <SpendingPredictionCard
        data={createSpendingResponse({ categories: [] })}
        currency="IDR"
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    expect(screen.getByText(locales.id.forecast.spendingNoCategoryData)).toBeInTheDocument();
  });

  it("does not present an insufficient-data zero as a real prediction", () => {
    render(
      <SpendingPredictionCard
        data={createSpendingResponse({
          insufficientData: true,
          predictedTotalCents: "0",
          confidence: 0,
          categories: [],
          otherCents: "0",
        })}
        currency="IDR"
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    expect(screen.getByText(locales.id.forecast.spendingEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByText(locales.id.forecast.spendingTotalLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rp0/)).not.toBeInTheDocument();
  });

  it.each(["USD", "SGD", "EUR"])("renders the prediction in the backend currency (%s)", (currency) => {
    render(
      <SpendingPredictionCard
        data={createSpendingResponse({
          currency,
          predictedTotalCents: "1747",
          otherCents: "0",
          categories: [
            {
              categoryId: "cat-1",
              categoryName: "Food",
              predictedAmountCents: "123",
              confidence: 0.7,
              basedOnMonths: 4,
            },
          ],
        })}
        currency={currency}
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    expect(screen.getAllByText((_, element) => (element?.textContent ?? "").includes(formatCurrencyCents("1747", currency))).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => (element?.textContent ?? "").includes(formatCurrencyCents("123", currency))).length).toBeGreaterThan(0);
  });

  it("shows a skeleton while loading and never a partial prediction", () => {
    render(
      <SpendingPredictionCard
        data={null}
        currency="IDR"
        loading
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    expect(screen.getByText(locales.id.forecast.spendingTitle)).toBeInTheDocument();
    expect(screen.queryByText(locales.id.forecast.spendingTotalLabel)).not.toBeInTheDocument();
  });

  it("renders the error state with a working retry action", () => {
    const onRetry = vi.fn();
    render(
      <SpendingPredictionCard
        data={null}
        currency="IDR"
        error
        onRetry={onRetry}
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    expect(screen.getByText(locales.id.forecast.errorTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: locales.id.common.tryAgain }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a zero total without crashing and never flips negative amounts", () => {
    render(
      <SpendingPredictionCard
        data={createSpendingResponse({
          predictedTotalCents: "0",
          otherCents: "0",
          categories: [
            {
              categoryId: "cat-neg",
              categoryName: "Transport",
              predictedAmountCents: "-1747",
              confidence: 0.5,
              basedOnMonths: 3,
            },
          ],
        })}
        currency="USD"
        locale="id"
        text={{
          title: locales.id.forecast.spendingTitle,
          subtitle: locales.id.forecast.spendingSubtitle,
          periodLabel: locales.id.forecast.spendingPeriodLabel,
          totalLabel: locales.id.forecast.spendingTotalLabel,
          otherLabel: locales.id.forecast.spendingOtherLabel,
          breakdownTitle: locales.id.forecast.spendingBreakdownTitle,
          basedOnMonths: locales.id.forecast.spendingBasedOnMonths,
          noCategoryData: locales.id.forecast.spendingNoCategoryData,
          emptyTitle: locales.id.forecast.spendingEmptyTitle,
          emptyDescription: locales.id.forecast.spendingEmptyDescription,
          confidenceLabel: locales.id.forecast.spendingConfidenceLabel,
          confidenceHigh: locales.id.forecast.confidenceHigh,
          confidenceMedium: locales.id.forecast.confidenceMedium,
          confidenceLow: locales.id.forecast.confidenceLow,
          errorTitle: locales.id.forecast.errorTitle,
          errorDescription: locales.id.forecast.errorDescription,
        }}
      />,
    );

    expect(screen.getAllByText((_, element) => (element?.textContent ?? "").includes("$0.00")).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => (element?.textContent ?? "").includes("-$17.47")).length).toBeGreaterThan(0);
    // No standalone positive "$17.47" element: the negative sign is never dropped.
    expect(screen.queryAllByText((_, element) => (element?.textContent ?? "").trim() === "$17.47").length).toBe(0);
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
});
