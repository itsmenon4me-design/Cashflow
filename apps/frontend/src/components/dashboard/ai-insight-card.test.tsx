import { render, screen, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MonthlyTargetCard } from "@/components/dashboard/MonthlyTargetCard";
import { AIInsightCard } from "@/components/dashboard/ai-insight-card";
import { setUiTextLanguage, uiText } from "@/locales";

describe("dashboard context widgets", () => {
  beforeEach(() => {
    // default language is id; reset to id for deterministic tests
    setUiTextLanguage("id");
  });

  it("renders the AI context card with its items", () => {
    render(<AIInsightCard items={["IDR dashboard context: cash flow remains balanced."]} />);

    expect(screen.getAllByText(/IDR/).length).toBeGreaterThan(0);
  });

  it("renders monthly target formatting in IDR", () => {
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

    expect(screen.getByText((content) => String(content).includes("Rp") && String(content).includes("100.000"))).toBeInTheDocument();
  });

  it("renders AI insights localized for Indonesian and English", () => {
    // Indonesian
    setUiTextLanguage("id");
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
    const insightsEn = (uiText.dashboard as any).aiInsightsByCurrency?.IDR ?? [];
    render(<AIInsightCard items={insightsEn} />);
    expect(screen.getByText((uiText.dashboard as any).aiInsight)).toBeTruthy();
    // allow multiple matches for IDR
    expect(screen.getAllByText(/IDR/).length).toBeGreaterThan(0);
    if (insightsEn.length > 0) {
      expect(screen.getByText(insightsEn[0])).toBeTruthy();
    } else {
      expect(screen.getByText((uiText.dashboard as any).aiInsightEmpty)).toBeTruthy();
    }
  });
});
