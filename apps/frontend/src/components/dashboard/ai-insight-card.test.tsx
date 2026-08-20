import { act, render, screen, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MonthlyTargetCard } from "@/components/dashboard/MonthlyTargetCard";
import { AIInsightCard } from "@/components/dashboard/ai-insight-card";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import { setUiTextLanguage, uiText } from "@/locales";

describe("dashboard context widgets", () => {
  beforeEach(() => {
    useDashboardCurrencyStore.setState({ currency: "USD" });
    // default language is id; reset to id for deterministic tests
    setUiTextLanguage("id");
  });

  it("passes the active dashboard currency into the AI context", () => {
    render(<AIInsightCard items={["USD dashboard context: cash flow remains balanced."]} />);

    // don't assert exact localized template; assert the currency label is present
    // allow multiple matches (context label + sample item) — assert at least one occurrence
    expect(screen.getAllByText(/USD/).length).toBeGreaterThan(0);

    act(() => {
      useDashboardCurrencyStore.setState({ currency: "EUR" });
    });

    expect(screen.getAllByText(/EUR/).length).toBeGreaterThan(0);
  });

  it("updates monthly target formatting when the dashboard currency changes", () => {
    render(
      <MonthlyTargetCard
        items={[
          {
            id: "monthly-target-1",
            name: "Savings Goal",
            target: 100000,
            realized: 50000,
          },
        ]}
      />,
    );

    expect(screen.getByText("$1,000.00")).toBeInTheDocument();

    act(() => {
      useDashboardCurrencyStore.setState({ currency: "EUR" });
    });

    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
  });

  it("renders AI insights localized for Indonesian and English", () => {
    // Indonesian
    setUiTextLanguage("id");
    useDashboardCurrencyStore.setState({ currency: "IDR" });
    const insightsId = (uiText.dashboard as any).aiInsightsByCurrency?.IDR ?? [];
    render(<AIInsightCard items={insightsId} />);
    expect(screen.getByText((uiText.dashboard as any).aiInsight)).toBeTruthy();
    // context label should contain IDR (localized template) — allow multiple matches
    expect(screen.getAllByText(/IDR/).length).toBeGreaterThan(0);
    if (insightsId.length > 0) {
      expect(screen.getByText(insightsId[0])).toBeTruthy();
    } else {
      expect(screen.getByText((uiText.dashboard as any).aiInsightEmpty)).toBeTruthy();
    }

    // switch to English — cleanup DOM from previous render
    cleanup();
    setUiTextLanguage("en");
    useDashboardCurrencyStore.setState({ currency: "USD" });
    const insightsEn = (uiText.dashboard as any).aiInsightsByCurrency?.USD ?? [];
    render(<AIInsightCard items={insightsEn} />);
    expect(screen.getByText((uiText.dashboard as any).aiInsight)).toBeTruthy();
    // allow multiple matches for USD
    expect(screen.getAllByText(/USD/).length).toBeGreaterThan(0);
    if (insightsEn.length > 0) {
      expect(screen.getByText(insightsEn[0])).toBeTruthy();
    } else {
      expect(screen.getByText((uiText.dashboard as any).aiInsightEmpty)).toBeTruthy();
    }
  });
});
