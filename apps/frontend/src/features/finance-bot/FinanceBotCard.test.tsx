import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { settingsService } from "@/services/settings.service";
import { FinanceBotCard } from "@/features/finance-bot/FinanceBotCard";
import { uiText } from "@/locales";
import type { FinanceBotSettings, UserSettings } from "@/types/settings";

const getSettings = vi.spyOn(settingsService, "getSettings");
const updateSettings = vi.spyOn(settingsService, "updateSettings");

function resolveLater<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const baseUserSettings: UserSettings = {
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
};

function financeBotFixture(overrides: Partial<FinanceBotSettings> = {}): FinanceBotSettings {
  return {
    enabled: false,
    personality: "SANTAI",
    customStyle: undefined,
    budgetThreshold: 80,
    dailyReminderEnabled: true,
    reminderTime1: "20:00",
    reminderTime2: "22:00",
    ...overrides,
  };
}

describe("FinanceBotCard", () => {
  afterEach(() => {
    getSettings.mockReset();
    updateSettings.mockReset();
    vi.useRealTimers();
  });

  it("renders loading skeleton while settings are loading", async () => {
    const deferred = resolveLater<Awaited<ReturnType<typeof settingsService.getSettings>>>();
    getSettings.mockReturnValue(deferred.promise);

    render(<FinanceBotCard />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      deferred.resolve({ ...baseUserSettings, financeBotSettings: null });
    });
  });

  it("loads and displays existing settings", async () => {
    getSettings.mockResolvedValue({
      ...baseUserSettings,
      financeBotSettings: financeBotFixture({
        enabled: true,
        personality: "TEGAS",
        budgetThreshold: 90,
        dailyReminderEnabled: false,
        reminderTime1: "19:00",
        reminderTime2: "21:00",
      }),
    });

    render(<FinanceBotCard />);

    expect(await screen.findByRole("switch", { name: uiText.financeBot.enabled })).toBeInTheDocument();
    expect(screen.getByText(uiText.financeBot.timezoneNote)).toBeInTheDocument();
  });

  it("shows load error state when settings fail to load", async () => {
    getSettings.mockRejectedValue(new Error("load-failure"));

    render(<FinanceBotCard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(uiText.settingsPage.loadError);
  });

  it("has no save button and auto-saves on toggle", async () => {
    getSettings.mockResolvedValue({
      ...baseUserSettings,
      financeBotSettings: financeBotFixture(),
    });
    updateSettings.mockResolvedValue(baseUserSettings);

    render(<FinanceBotCard />);

    const toggle = await screen.findByRole("switch", { name: uiText.financeBot.enabled });
    expect(screen.queryByRole("button", { name: /save|simpan/i })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(updateSettings).toHaveBeenCalledWith({
      financeBotSettings: {
        enabled: true,
        personality: "SANTAI",
        customStyle: undefined,
        budgetThreshold: 80,
        dailyReminderEnabled: true,
        reminderTime1: "20:00",
        reminderTime2: "22:00",
      },
    });
  });

  it("auto-saves on personality change", async () => {
    getSettings.mockResolvedValue({
      ...baseUserSettings,
      financeBotSettings: financeBotFixture(),
    });
    updateSettings.mockResolvedValue(baseUserSettings);

    render(<FinanceBotCard />);

    const radio = await screen.findByRole("radio", { name: uiText.financeBot.personalityOptions.TEGAS });
    fireEvent.click(radio);

    expect(updateSettings).toHaveBeenCalledWith({
      financeBotSettings: expect.objectContaining({
        personality: "TEGAS",
      }),
    });
  });

  it("debounces custom style persistence", async () => {
    getSettings.mockResolvedValue({
      ...baseUserSettings,
      financeBotSettings: financeBotFixture({ personality: "CUSTOM", customStyle: "" }),
    });
    updateSettings.mockResolvedValue(baseUserSettings);

    render(<FinanceBotCard />);

    const textarea = await screen.findByLabelText(uiText.financeBot.customLabel);
    vi.useFakeTimers();
    fireEvent.change(textarea, { target: { value: "hangry" } });

    expect(updateSettings).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(updateSettings).toHaveBeenCalledWith({
      financeBotSettings: expect.objectContaining({
        customStyle: "hangry",
        personality: "CUSTOM",
      }),
    });
  });
});
