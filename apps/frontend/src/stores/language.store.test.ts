import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { uiText, locales } from "@/locales";
import { hydrateLanguagePreference, useLanguageStore } from "@/stores/language.store";
import { LanguageProvider } from "@/components/providers/language-provider";
import { useAuthStore } from "@/stores/auth.store";
import { settingsService } from "@/services/settings.service";

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

  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: previousAuthenticated });
    useLanguageStore.setState({ language: "id" });
    cleanup();
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