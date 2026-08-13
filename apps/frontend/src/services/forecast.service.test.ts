import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/axios";
import { forecastService } from "@/services/forecast.service";
import type { ForecastResponse, SpendingPredictionResponse } from "@/types/backend";

describe("forecastService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the forecast endpoint with the expected params and unwraps the backend payload", async () => {
    const forecastResponse: ForecastResponse = {
      currency: "IDR",
      horizon: 3,
      months: [],
      confidence: 0.5,
      basis: {
        monthsUsed: 3,
        historyStart: "2024-01",
        historyEnd: "2024-03",
        totalIncomeCents: "30000000",
        totalExpenseCents: "15000000",
        averageMonthlyIncomeCents: "10000000",
        averageMonthlyExpenseCents: "5000000",
      },
      excludedTransfers: false,
      outliers: [],
      insufficientData: false,
    };

    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: forecastResponse,
    });

    await expect(
      forecastService.getForecast({ horizon: 3, startDate: "2025-01-01", endDate: "2025-03-31" }),
    ).resolves.toEqual(forecastResponse);

    expect(getSpy).toHaveBeenCalledWith("/ai/forecast", {
      params: { horizon: 3, startDate: "2025-01-01", endDate: "2025-03-31" },
    });
    const params = getSpy.mock.calls[0]?.[1]?.params as Record<string, string | number> | undefined;
    expect(params).not.toHaveProperty("userId");
  });

  it("calls the spending prediction endpoint with the expected params and unwraps the backend payload", async () => {
    const spendingResponse: SpendingPredictionResponse = {
      currency: "IDR",
      period: "2025-03",
      predictedTotalCents: "2500000",
      confidence: 0.82,
      categories: [],
      noHistoryCategoryIds: [],
      otherCents: "0",
      insufficientData: false,
    };

    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: spendingResponse,
    });

    await expect(forecastService.getSpendingPrediction({ horizon: 2 })).resolves.toEqual(spendingResponse);

    expect(getSpy).toHaveBeenCalledWith("/ai/spending-prediction", {
      params: { horizon: 2 },
    });
    const params = getSpy.mock.calls[0]?.[1]?.params as Record<string, string | number> | undefined;
    expect(params).not.toHaveProperty("userId");
  });

  it("calls the forecast endpoint without params when none are provided", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: { currency: "IDR", horizon: 3, months: [], confidence: 0, basis: {
        monthsUsed: 0, historyStart: "", historyEnd: "", totalIncomeCents: "0", totalExpenseCents: "0",
        averageMonthlyIncomeCents: "0", averageMonthlyExpenseCents: "0",
      }, excludedTransfers: true, outliers: [], insufficientData: true },
    });

    await forecastService.getForecast();

    expect(getSpy).toHaveBeenCalledWith("/ai/forecast", { params: undefined });
  });

  it("propagates the backend currency and keeps all money fields as strings", async () => {
    const forecastResponse: ForecastResponse = {
      currency: "USD",
      horizon: 3,
      months: [{ period: "2026-07", projectedIncomeCents: "123", projectedExpenseCents: "1747", projectedNetCashflowCents: "-1624", projectedEndingBalanceCents: "9007199254740993" }],
      confidence: 0.5,
      basis: { monthsUsed: 6, historyStart: "2025-12", historyEnd: "2026-05", totalIncomeCents: "999", totalExpenseCents: "501", averageMonthlyIncomeCents: "137", averageMonthlyExpenseCents: "17" },
      excludedTransfers: true,
      outliers: [{ period: "2026-01", amountCents: "-13759" }],
      insufficientData: false,
    };

    vi.spyOn(apiClient, "get").mockResolvedValue({ success: true, data: forecastResponse });

    const result = await forecastService.getForecast({ horizon: 3 });

    expect(result.currency).toBe("USD");
    expect(typeof result.months[0].projectedIncomeCents).toBe("string");
    expect(typeof result.months[0].projectedEndingBalanceCents).toBe("string");
    expect(typeof result.basis.totalIncomeCents).toBe("string");
    expect(typeof result.outliers[0].amountCents).toBe("string");
    expect(result.months[0].projectedEndingBalanceCents).toBe("9007199254740993");
  });

  it("never attaches a client-supplied userId to either endpoint", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: { currency: "IDR", period: "2026-07", predictedTotalCents: "1000", confidence: 0.5, categories: [], noHistoryCategoryIds: [], otherCents: "0", insufficientData: false },
    });

    await forecastService.getSpendingPrediction({ horizon: 6 });

    const params = getSpy.mock.calls[0]?.[1]?.params as Record<string, string | number> | undefined;
    expect(params).not.toHaveProperty("userId");
    expect(params).not.toHaveProperty("user_id");
  });
});
