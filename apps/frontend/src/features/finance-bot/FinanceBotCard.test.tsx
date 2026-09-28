import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { settingsService } from "@/services/settings.service";
import { FinanceBotCard } from "@/features/finance-bot/FinanceBotCard";
import { uiText } from "@/locales";
import type { FinanceBotSettings, UserSettings } from "@/types/settings";

const getSettings = vi.spyOn(settingsService, "getSettings");
const updateSettings = vi.spyOn(settingsService, "updateSettings");

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

const persistedSettings: UserSettings = {
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
  createdAt: "2026-09-26T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
};

describe("FinanceBotCard", () => {
  afterEach(() => {
    getSettings.mockReset();
    updateSettings.mockReset();
    vi.useRealTimers();
  });

  it("does not show a loading placeholder or request settings again", () => {
    const onSettingsChange = vi.fn();
    render(
      <FinanceBotCard
        settings={financeBotFixture()}
        loading
        onSettingsChange={onSettingsChange}
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(settingsService.getSettings).not.toHaveBeenCalled();
  });

  it("uses settings as soon as the shared Settings request completes", () => {
    const onSettingsChange = vi.fn();
    const { rerender } = render(
      <FinanceBotCard
        settings={financeBotFixture()}
        loading
        onSettingsChange={onSettingsChange}
      />,
    );

    rerender(
      <FinanceBotCard
        settings={financeBotFixture({
          personality: "CUSTOM",
          customStyle: "Singkat dan jelas",
        })}
        loading={false}
        onSettingsChange={onSettingsChange}
      />,
    );

    expect(screen.getByLabelText(uiText.financeBot.customLabel)).toHaveValue(
      "Singkat dan jelas",
    );
    expect(settingsService.getSettings).not.toHaveBeenCalled();
  });

  it("renders the settings supplied by the Settings page", () => {
    render(
      <FinanceBotCard
        settings={financeBotFixture({
          enabled: true,
          personality: "TEGAS",
          budgetThreshold: 90,
          dailyReminderEnabled: false,
          reminderTime1: "19:00",
          reminderTime2: "21:00",
        })}
        loading={false}
        onSettingsChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("switch", { name: uiText.financeBot.enabled })).toBeChecked();
    expect(screen.getByRole("radio", { name: uiText.financeBot.personalityOptions.TEGAS })).toBeChecked();
    expect(screen.getByRole("combobox")).toHaveTextContent("90%");
    expect(screen.getByText(uiText.financeBot.timezoneNote)).toBeInTheDocument();
  });

  it("has no save button and auto-saves on toggle", async () => {
    const onSettingsChange = vi.fn();
    updateSettings.mockResolvedValue(persistedSettings);

    render(
      <FinanceBotCard
        settings={financeBotFixture()}
        loading={false}
        onSettingsChange={onSettingsChange}
      />,
    );

    const toggle = screen.getByRole("switch", { name: uiText.financeBot.enabled });
    expect(screen.queryByRole("button", { name: /save|simpan/i })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
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
    updateSettings.mockResolvedValue(persistedSettings);

    render(
      <FinanceBotCard
        settings={financeBotFixture()}
        loading={false}
        onSettingsChange={vi.fn()}
      />,
    );

    const radio = screen.getByRole("radio", { name: uiText.financeBot.personalityOptions.TEGAS });
    fireEvent.click(radio);

    expect(updateSettings).toHaveBeenCalledWith({
      financeBotSettings: expect.objectContaining({
        personality: "TEGAS",
      }),
    });
  });

  it("debounces custom style persistence", async () => {
    updateSettings.mockResolvedValue(persistedSettings);

    render(
      <FinanceBotCard
        settings={financeBotFixture({ personality: "CUSTOM", customStyle: "" })}
        loading={false}
        onSettingsChange={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText(uiText.financeBot.customLabel);
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
