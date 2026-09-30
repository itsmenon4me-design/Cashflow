import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useEffect } from "react";
import { uiText, locales } from "@/locales";
import { hydrateLanguagePreference, useLanguageStore } from "@/stores/language.store";
import { LanguageProvider } from "@/components/providers/language-provider";
import { useAuthStore } from "@/stores/auth.store";
import { settingsService } from "@/services/settings.service";
import { SettingsPage } from "@/features/settings/settings-page";
import { clearSettingsSession } from "@/services/settings-session";

const { replaceMock, searchParamsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  searchParamsMock: {
    get: vi.fn<(key?: string) => string | null>(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => searchParamsMock.get(key) ?? null,
  }),
}));

function Probe() {
  // Reads the shared live binding during render, like application components.
  return createElement("p", null, uiText.forecast.pageTitle);
}

describe("global language store", () => {
  beforeEach(() => {
    window.localStorage.removeItem("cashflow.language");
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "id" });
    window.localStorage.removeItem("cashflow.language");
    document.cookie = "cashflow.language=; path=/; max-age=0";
    searchParamsMock.get.mockReset();
    searchParamsMock.get.mockImplementation(() => null);
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts in Indonesian by default and swaps the shared uiText binding", () => {
    expect(useLanguageStore.getState().language).toBe("id");
    expect(uiText).toBe(locales.id);

    useLanguageStore.getState().setLanguage("en");
    expect(useLanguageStore.getState().language).toBe("en");
    expect(uiText).toBe(locales.en);
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("cashflow.language")).toBe("en");

    useLanguageStore.getState().setLanguage("id");
    expect(uiText).toBe(locales.id);
    expect(document.documentElement.lang).toBe("id");
  });

  it("falls back to Indonesian for unknown language values", () => {
    useLanguageStore.getState().setLanguage("fr" as never);
    expect(useLanguageStore.getState().language).toBe("id");
    expect(uiText).toBe(locales.id);
  });

  it("persists the switch across re-reads", () => {
    useLanguageStore.getState().setLanguage("en");
    expect(window.localStorage.getItem("cashflow.language")).toBe("en");
    // Simulates a fresh module read on next app load.
    const stored = window.localStorage.getItem("cashflow.language");
    expect(stored === "en" ? "en" : "id").toBe("en");
  });

  it("hydrates the shared uiText binding from persisted storage on startup", () => {
    window.localStorage.setItem("cashflow.language", "en");

    const active = hydrateLanguagePreference();

    expect(active).toBe("en");
    expect(useLanguageStore.getState().language).toBe("en");
    expect(uiText).toBe(locales.en);
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("LanguageProvider reconciliation", () => {
  const previousAuthenticated = useAuthStore.getState().isAuthenticated;

  beforeEach(() => {
    clearSettingsSession();
    window.localStorage.removeItem("cashflow.language");
    document.cookie = "cashflow.language=; path=/; max-age=0";
    useLanguageStore.getState().setLanguage("id");
    window.localStorage.removeItem("cashflow.language");
    document.cookie = "cashflow.language=; path=/; max-age=0";
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ isAuthenticated: previousAuthenticated });
    useLanguageStore.getState().setLanguage("id");
    clearSettingsSession();
    window.localStorage.removeItem("cashflow.language");
    document.cookie = "cashflow.language=; path=/; max-age=0";
    searchParamsMock.get.mockReset();
    searchParamsMock.get.mockImplementation(() => null);
    vi.restoreAllMocks();
  });

  it("adopts the backend settings language for authenticated sessions", async () => {
    useAuthStore.setState({ isAuthenticated: true });
    vi.spyOn(settingsService, "getSettings").mockResolvedValue({
      language: "en",
    } as never);

    render(
      createElement(LanguageProvider, null, createElement(Probe)),
    );

    await waitFor(() => {
      expect(useLanguageStore.getState().language).toBe("en");
    });
    expect(screen.getByText(locales.en.forecast.pageTitle)).toBeInTheDocument();
    expect(uiText).toBe(locales.en);
  });

  it("preserves sidebar and page scroll positions when the locale changes", async () => {
    let mountCount = 0;

    function MountProbe() {
      useEffect(() => {
        mountCount += 1;
      }, []);

      return createElement("div", null,
        createElement(
          "main",
          {
            "data-testid": "page-scroll",
            className: "dashboard-main-scroll",
            style: { height: "100px", overflowY: "auto" },
          },
          createElement("div", { style: { height: "1000px" } }, "page content"),
        ),
        createElement(
          "div",
          {
            "data-testid": "sidebar-scroll",
            "data-scroll-preserve": true,
            style: { height: "100px", overflowY: "auto" },
          },
          createElement("div", { style: { height: "1000px" } }, "menu content"),
        ),
      );
    }

    render(
      createElement(LanguageProvider, null, createElement(MountProbe)),
    );

    expect(mountCount).toBe(1);

    screen.getByTestId("page-scroll").scrollTop = 320;
    screen.getByTestId("sidebar-scroll").scrollTop = 420;

    await act(async () => {
      useLanguageStore.getState().setLanguage("en");
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
    });

    expect(mountCount).toBe(2);
    expect(screen.getByTestId("page-scroll").scrollTop).toBe(320);
    expect(screen.getByTestId("sidebar-scroll").scrollTop).toBe(420);
  });

  it("does not refetch settings or remount settings content when preferences change", async () => {
    let mountCount = 0;
    const getSettingsSpy = vi.spyOn(settingsService, "getSettings").mockResolvedValue({
      id: "settings-1",
      userId: "user-1",
      theme: "dark",
      language: "id",
      currency: "IDR",
      timezone: null,
      notificationPreferences: {
        transactions: true,
        budgets: true,
        savingGoals: true,
        accounts: true,
        investments: true,
        system: true,
      },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    } as never);
    vi.spyOn(settingsService, "updateSettings").mockImplementation(async (patch) => ({
      id: "settings-1",
      userId: "user-1",
      theme: patch.theme ?? "dark",
      language: patch.language ?? "id",
      timezone: null,
      notificationPreferences: {
        transactions: patch.notificationPreferences?.transactions ?? true,
        budgets: patch.notificationPreferences?.budgets ?? true,
        savingGoals: patch.notificationPreferences?.savingGoals ?? true,
        accounts: patch.notificationPreferences?.accounts ?? true,
        investments: patch.notificationPreferences?.investments ?? true,
        system: patch.notificationPreferences?.system ?? true,
      },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    }) as never);
    searchParamsMock.get.mockImplementation((key?: string) =>
      key === "tab" ? "notifications" : null,
    );

    function SettingsProbe() {
      useEffect(() => {
        mountCount += 1;
      }, []);

      return createElement(SettingsPage);
    }

    render(createElement(SettingsProbe));

    await waitFor(() => {
      expect(screen.getByText("Pengaturan")).toBeInTheDocument();
    });

    const initialCalls = getSettingsSpy.mock.calls.length;
    const initialMountCount = mountCount;

    const notificationsToggle = document.getElementById("notif-transactions");
    expect(notificationsToggle).not.toBeNull();
    fireEvent.click(notificationsToggle!);

    expect(mountCount).toBe(initialMountCount);
    expect(getSettingsSpy).toHaveBeenCalledTimes(initialCalls);
  });

  it("keeps the persisted language when settings are unavailable", async () => {
    useAuthStore.setState({ isAuthenticated: true });
    vi.spyOn(settingsService, "getSettings").mockRejectedValue(new Error("offline"));
    useLanguageStore.getState().setLanguage("en");

    render(
      createElement(LanguageProvider, null, createElement(Probe)),
    );

    expect(screen.getByText(locales.en.forecast.pageTitle)).toBeInTheDocument();
    expect(useLanguageStore.getState().language).toBe("en");
  });
});