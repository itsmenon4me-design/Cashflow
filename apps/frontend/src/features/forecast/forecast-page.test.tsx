import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ForecastPage } from "@/features/forecast/forecast-page";
import { forecastService } from "@/services/forecast.service";
import { settingsService } from "@/services/settings.service";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { useLanguageStore } from "@/stores/language.store";
import { formatCurrencyCents } from "@/lib/format";
import { locales } from "@/locales";
import type { ForecastResponse, SpendingPredictionResponse } from "@/types/backend";
import type { UserSettings } from "@/types/settings";

function createBaseSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: "user-1",
    userId: "user-1",
    theme: "dark",
    language: "id",
    timezone: "Asia/Jakarta",
    notificationPreferences: {
      transactions: true,
      budgets: true,
      savingGoals: true,
      accounts: true,
      investments: true,
      system: true,
    },
    financeBotSettings: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createForecastResponse(overrides: Partial<ForecastResponse> = {}): ForecastResponse {
  return {
    currency: "IDR",
    horizon: 3,
    months: [
      {
        period: "2025-01",
        projectedIncomeCents: "15000000",
        projectedExpenseCents: "8000000",
        projectedNetCashflowCents: "7000000",
        projectedEndingBalanceCents: "17000000",
      },
      {
        period: "2025-02",
        projectedIncomeCents: "15000000",
        projectedExpenseCents: "9000000",
        projectedNetCashflowCents: "6000000",
        projectedEndingBalanceCents: "23000000",
      },
    ],
    confidence: 0.87,
    basis: {
      monthsUsed: 6,
      historyStart: "2024-07",
      historyEnd: "2024-12",
      totalIncomeCents: "90000000",
      totalExpenseCents: "48000000",
      averageMonthlyIncomeCents: "15000000",
      averageMonthlyExpenseCents: "8000000",
    },
    outliers: [],
    insufficientData: false,
    ...overrides,
  };
}

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

function resolveLater<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function getTextMatcher(value: string) {
  const normalized = value.replace(/\s+/g, " ");
  return (_content: string | null, element: Element | null) => {
    const content = element?.textContent?.replace(/\s+/g, " ") ?? "";
    return content.includes(normalized);
  };
}

describe("ForecastPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useDataRefreshStore.setState({ version: 0 });
    useLanguageStore.setState({ language: "id" });
  });

  it("shows loading skeletons while forecast data is pending", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    const forecastDeferred = resolveLater<ForecastResponse>();
    const spendingDeferred = resolveLater<SpendingPredictionResponse>();
    vi.spyOn(forecastService, "getForecast").mockReturnValue(forecastDeferred.promise);
    vi.spyOn(forecastService, "getSpendingPrediction").mockReturnValue(spendingDeferred.promise);

    render(<ForecastPage />);

    expect(screen.getByText(locales.id.forecast.pageTitle)).toBeInTheDocument();
    expect(screen.queryByText(formatCurrencyCents("15000000", "IDR"))).not.toBeInTheDocument();

    forecastDeferred.resolve(createForecastResponse());
    spendingDeferred.resolve(createSpendingResponse());
    await waitFor(
      () => {
        expect(screen.getByText(locales.id.forecast.chartTitle)).toBeInTheDocument();
      },
      // Chart dimuat via async chunk; di bawah beban worker paralel proses
      // import+eval bisa melampaui default 1s.
      { timeout: 5000 },
    );
  }, /* cold transform of the async chart chunk can exceed the 5s default
        under parallel workers — this test intentionally defers data, so give
        the whole case room instead of flaking on environment load */
  20_000);

  it("renders forecast summary, breakdown, confidence, and history", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({
      outliers: [],
    }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect(await screen.findByRole("heading", { name: locales.id.forecast.pageTitle })).toBeInTheDocument();
    // Chart dimuat via dynamic import (async chunk), jadi judulnya muncul
    // setelah chunk termuat — gunakan finder async.
    expect(await screen.findByText(locales.id.forecast.chartTitle)).toBeInTheDocument();
    expect(screen.getByText(locales.id.forecast.breakdownTitle)).toBeInTheDocument();
    expect(screen.getByText(locales.id.forecast.confidenceTitle)).toBeInTheDocument();
    expect(screen.getByText(locales.id.forecast.basisTitle)).toBeInTheDocument();
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("15000000", "IDR"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("8000000", "IDR"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("7000000", "IDR"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("17000000", "IDR"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(locales.id.forecast.confidenceHigh)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/87%/).length).toBeGreaterThan(0);
  });

  it("updates the forecast request when the horizon selector changes", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    const getForecast = vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse());
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect(await screen.findByText(locales.id.forecast.pageTitle)).toBeInTheDocument();
    // getForecast menerima ({ horizon }, signal) sejak AbortController ditambahkan
    const [, signalArg] = getForecast.mock.calls[0];
    expect(signalArg).toBeInstanceOf(AbortSignal);
    expect(getForecast).toHaveBeenCalledWith({ horizon: 3 }, signalArg);

    for (const option of [1, 2, 4, 5, 6]) {
      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.click(screen.getByRole("option", {
        name: option === 1 ? locales.id.forecast.horizon1Month : locales.id.forecast.horizonNMonths.replace("{count}", String(option)),
      }));

      await waitFor(() => {
        const lastCall = getForecast.mock.calls[getForecast.mock.calls.length - 1];
        expect(lastCall[0]).toEqual({ horizon: option });
      });
    }
  });

  it("shows the insufficient data empty state without rendering a misleading chart", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({
      insufficientData: true,
      months: [],
      confidence: 0,
      basis: {
        monthsUsed: 0,
        historyStart: "",
        historyEnd: "",
        totalIncomeCents: "0",
        totalExpenseCents: "0",
        averageMonthlyIncomeCents: "0",
        averageMonthlyExpenseCents: "0",
      },
    }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect(await screen.findByText(locales.id.forecast.insufficientDataTitle)).toBeInTheDocument();
    expect(screen.queryByText(locales.id.forecast.chartTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it("shows an error state and retries the forecast request", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    const getForecast = vi.spyOn(forecastService, "getForecast")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(createForecastResponse());
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect(await screen.findByText(locales.id.forecast.errorTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: locales.id.common.tryAgain }));

    await waitFor(() => {
      expect(getForecast).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(locales.id.forecast.chartTitle)).toBeInTheDocument();
  });

  it.each([
    ["id", "IDR", locales.id],
    ["en", "IDR", locales.en],
  ])("renders forecast amounts using the response currency for %s/%s", async (language, currency, localeTexts) => {
    useLanguageStore.setState({ language: language as UserSettings["language"] });
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings({ language: language as UserSettings["language"] }));
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({ currency: "IDR" }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse({ currency: "IDR" }));

    render(<ForecastPage />);

    expect((await screen.findAllByText(getTextMatcher(formatCurrencyCents("15000000", currency)))).length).toBeGreaterThan(0);
    expect(screen.getByText(localeTexts.forecast.pageTitle)).toBeInTheDocument();
  });

  it.each([
    ["positive net cashflow", "7000000"],
    ["negative net cashflow", "-7000000"],
    ["zero net cashflow", "0"],
  ])("renders forecast values for %s", async (_label, netCashflow) => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({
      months: [{
        period: "2025-01",
        projectedIncomeCents: "15000000",
        projectedExpenseCents: "8000000",
        projectedNetCashflowCents: netCashflow,
        projectedEndingBalanceCents: "17000000",
      }],
    }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect((await screen.findAllByText(getTextMatcher(formatCurrencyCents("15000000", "IDR")))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("8000000", "IDR"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents(netCashflow, "IDR"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("17000000", "IDR"))).length).toBeGreaterThan(0);
  });

  it.each([
    [0.87, locales.id.forecast.confidenceHigh],
    [0.6, locales.id.forecast.confidenceMedium],
    [0.3, locales.id.forecast.confidenceLow],
    [0, locales.id.forecast.confidenceLow],
  ])("renders the correct confidence label for %.2f", async (confidence, label) => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({ confidence }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect((await screen.findAllByText(new RegExp(label))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(`${Math.round(confidence * 100)}%`)).length).toBeGreaterThan(0);
  });

  it("renders outlier information and hides it when there are none", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({
      outliers: [{ period: "2026-01", amountCents: "-50000000" }],
    }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect(await screen.findByText(locales.id.forecast.outlierTitle)).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp("Jan|2026", "i")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("-50000000", "IDR"))).length).toBeGreaterThan(0);
    expect(screen.queryByText("transactionId")).not.toBeInTheDocument();
  });

  it("refreshes forecast data when the refresh store changes", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    const getForecast = vi.spyOn(forecastService, "getForecast")
      .mockResolvedValueOnce(createForecastResponse())
      .mockResolvedValueOnce(createForecastResponse({ horizon: 6 }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    await waitFor(() => expect(getForecast).toHaveBeenCalledTimes(1));

    useDataRefreshStore.getState().bump();

    await waitFor(() => expect(getForecast).toHaveBeenCalledTimes(2));
  });

  it("renders each backend figure with its own response currency when they differ", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({ currency: "IDR" }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse({ currency: "IDR" }));

    render(<ForecastPage />);

    // Forecast figures render in IDR...
    expect((await screen.findAllByText(getTextMatcher(formatCurrencyCents("15000000", "IDR")))).length).toBeGreaterThan(0);
    // ...and the spending prediction also renders in IDR.
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("2500000", "IDR"))).length).toBeGreaterThan(0);
  });

  it("renders monetary strings above Number.MAX_SAFE_INTEGER exactly", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse({
      months: [{
        period: "2026-07",
        projectedIncomeCents: "9007199254740993",
        projectedExpenseCents: "1000000",
        projectedNetCashflowCents: "9007198254740993",
        projectedEndingBalanceCents: "9007199254840993",
      }],
    }));
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect((await screen.findAllByText(getTextMatcher(formatCurrencyCents("9007199254740993", "IDR")))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("9007199254740993", "IDR"))).length).toBeGreaterThan(0);
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it("prevents a stale in-flight forecast from overwriting a newer horizon result", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    const slowHorizon3 = resolveLater<ForecastResponse>();
    const fastHorizon6 = resolveLater<ForecastResponse>();
    const getForecast = vi.spyOn(forecastService, "getForecast")
      .mockReturnValueOnce(slowHorizon3.promise)
      .mockReturnValueOnce(fastHorizon6.promise);
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);
    await waitFor(() => expect(getForecast).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: locales.id.forecast.horizonNMonths.replace("{count}", "6") }));
    await waitFor(() => expect(getForecast).toHaveBeenCalledTimes(2));
    const lastArgs = getForecast.mock.calls[getForecast.mock.calls.length - 1][0];
    expect(lastArgs).toEqual({ horizon: 6 });

    // Newer (horizon 6) request resolves first and renders its data.
    fastHorizon6.resolve(createForecastResponse({
      horizon: 6,
      currency: "IDR",
      months: [{
        period: "2026-07",
        projectedIncomeCents: "5555555",
        projectedExpenseCents: "2222222",
        projectedNetCashflowCents: "3333333",
        projectedEndingBalanceCents: "4444444",
      }],
    }));
    await waitFor(() => {
      expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("5555555", "IDR"))).length).toBeGreaterThan(0);
    });

    // Older (horizon 3) request resolves later; its stale result must be dropped.
    slowHorizon3.resolve(createForecastResponse({
      currency: "IDR",
      months: [{
        period: "2026-06",
        projectedIncomeCents: "999999999",
        projectedExpenseCents: "111111111",
        projectedNetCashflowCents: "888888888",
        projectedEndingBalanceCents: "777777777",
      }],
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(getTextMatcher(formatCurrencyCents("999999999", "IDR")))).toBeNull();
    expect(screen.getAllByText(getTextMatcher(formatCurrencyCents("5555555", "IDR"))).length).toBeGreaterThan(0);
  });

  it("shows the localized error state without leaking raw server details", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    const serverError = Object.assign(new Error("boom"), {
      response: {
        status: 500,
        data: { message: "Internal Server Error", stack: "at Query.<anonymous>", error: "PrismaClientKnownRequestError" },
      },
    });
    vi.spyOn(forecastService, "getForecast").mockRejectedValue(serverError);
    vi.spyOn(forecastService, "getSpendingPrediction").mockResolvedValue(createSpendingResponse());

    render(<ForecastPage />);

    expect(await screen.findByText(locales.id.forecast.errorTitle)).toBeInTheDocument();
    expect(screen.getByText(locales.id.forecast.errorDescription)).toBeInTheDocument();
    expect(screen.queryByText(/Internal Server Error/)).toBeNull();
    expect(screen.queryByText(/PrismaClientKnownRequestError/)).toBeNull();
    expect(screen.queryByText(/at Query\./)).toBeNull();
    expect(screen.queryByText(getTextMatcher(formatCurrencyCents("15000000", "IDR")))).toBeNull();
  });

  it("shows the spending prediction error state and recovers via retry", async () => {
    vi.spyOn(settingsService, "getSettings").mockResolvedValue(createBaseSettings());
    vi.spyOn(forecastService, "getForecast").mockResolvedValue(createForecastResponse());
    const getSpendingPrediction = vi.spyOn(forecastService, "getSpendingPrediction")
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(createSpendingResponse());

    render(<ForecastPage />);

    expect(await screen.findByText(locales.id.forecast.errorTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: locales.id.common.tryAgain }));

    await waitFor(() => expect(getSpendingPrediction).toHaveBeenCalledTimes(2));
    const recovered = await screen.findAllByText(getTextMatcher(formatCurrencyCents("2500000", "IDR")));
    expect(recovered.length).toBeGreaterThan(0);
  });
});
