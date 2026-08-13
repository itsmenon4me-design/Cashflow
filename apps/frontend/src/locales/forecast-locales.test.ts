import { describe, expect, it } from "vitest";
import { enText } from "./en";
import { idText } from "./id";
import { locales } from "./index";
import { formatCurrencyCents } from "@/lib/format";

const REQUIRED_FORECAST_KEYS = [
  "pageTitle",
  "pageSubtitle",
  "horizonLabel",
  "horizon1Month",
  "horizonNMonths",
  "projectedIncome",
  "projectedExpense",
  "projectedNetCashflow",
  "projectedEndingBalance",
  "confidenceTitle",
  "confidenceHigh",
  "confidenceMedium",
  "confidenceLow",
  "basisTitle",
  "basisDescription",
  "insufficientDataTitle",
  "insufficientDataDescription",
  "errorTitle",
  "errorDescription",
  "spendingTitle",
  "spendingSubtitle",
  "spendingPeriodLabel",
  "spendingTotalLabel",
  "spendingOtherLabel",
  "spendingBreakdownTitle",
  "spendingBasedOnMonths",
  "spendingNoCategoryData",
  "spendingEmptyTitle",
  "spendingEmptyDescription",
  "spendingConfidenceLabel",
] as const;

describe("Forecast & Spending Prediction localization", () => {
  it("provides the same forecast key set in Indonesian and English", () => {
    const idrKeys = Object.keys(idText.forecast).sort();
    const engKeys = Object.keys(enText.forecast).sort();
    expect(engKeys).toEqual(idrKeys);
  });

  it("includes every key the forecast UI renders in both locales", () => {
    for (const key of REQUIRED_FORECAST_KEYS) {
      expect(idText.forecast[key], `id.forecast.${key}`).toBeTruthy();
      expect(enText.forecast[key], `en.forecast.${key}`).toBeTruthy();
    }
  });

  it("rejects a locale that never falls back: getUiText resolves en and id", () => {
    expect(locales.en.forecast.pageTitle).toMatch(/[A-Za-z]/);
    expect(locales.id.forecast.pageTitle).toMatch(/[A-Za-z\u00C0-\u024F]/);
  });

  it("keeps language and currency semantics separate (English + IDR still formats IDR)", () => {
    expect(formatCurrencyCents("1000000", "IDR")).toBe("Rp1.000.000");
    expect(formatCurrencyCents("1", "IDR")).toBe("Rp1");
    expect(formatCurrencyCents("123", "USD")).toBe("$1.23");
    expect(formatCurrencyCents("1747", "SGD")).toBe("$17.47");
    expect(formatCurrencyCents("1747", "EUR")).toBe("17,47\u00A0€");
  });

  it("has user-facing insufficient-data messages in both languages", () => {
    expect(idText.forecast.insufficientDataTitle.length).toBeGreaterThan(0);
    expect(enText.forecast.insufficientDataTitle.length).toBeGreaterThan(0);
    expect(idText.forecast.spendingEmptyTitle.length).toBeGreaterThan(0);
    expect(enText.forecast.spendingEmptyTitle.length).toBeGreaterThan(0);
    // Indonesian copies must not be empty phrasing artifacts of English.
    expect(idText.forecast.insufficientDataTitle).not.toBe(enText.forecast.insufficientDataTitle);
  });
});