import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { TimezoneProvider } from "./timezone-provider";
import { settingsService } from "@/services/settings.service";
import {
  clearSettingsSession,
} from "@/services/settings-session";
import { useAuthStore } from "@/stores/auth.store";
import { useTimezoneStore } from "@/stores/timezone.store";
import { canonicalIndonesianTimezone } from "@/lib/user-timezone";

const browserZone = vi.hoisted<{ value: string | null }>(() => ({
  value: "Asia/Makassar",
}));

vi.mock("@/lib/user-timezone", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/user-timezone")>(
      "@/lib/user-timezone",
    );
  return {
    ...actual,
    getBrowserIndonesianTimezone: () => browserZone.value,
  };
});

describe("TimezoneProvider", () => {
  beforeEach(() => {
    clearSettingsSession();
    useAuthStore.setState({
      isAuthenticated: true,
      user: { name: "Test", email: "timezone-test@example.test" },
    });
    useTimezoneStore.setState({ timezone: "Asia/Jakarta" });
    browserZone.value = "Asia/Makassar";
    vi.spyOn(settingsService, "getSettings");
    vi.spyOn(settingsService, "updateSettings");
  });

  afterEach(() => {
    cleanup();
    clearSettingsSession();
    vi.restoreAllMocks();
  });

  it("syncs a different Indonesian device timezone to settings", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      timezone: "Asia/Jakarta",
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);
    vi.mocked(settingsService.updateSettings).mockResolvedValue({
      timezone: "Asia/Makassar",
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);

    render(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    await waitFor(() => {
      expect(useTimezoneStore.getState().timezone).toBe("Asia/Makassar");
    });
    expect(settingsService.updateSettings).toHaveBeenCalledWith({
      timezone: "Asia/Makassar",
    });
    expect(screen.getByText("application")).toBeInTheDocument();
  });

  it("saves an Indonesian browser zone once when no setting exists", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      timezone: null,
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);
    vi.mocked(settingsService.updateSettings).mockResolvedValue({
      timezone: "Asia/Makassar",
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);

    const view = render(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    await waitFor(() => {
      expect(useTimezoneStore.getState().timezone).toBe("Asia/Makassar");
      expect(settingsService.updateSettings).toHaveBeenCalledWith({
        timezone: "Asia/Makassar",
      });
    });
    view.rerender(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    expect(settingsService.updateSettings).toHaveBeenCalledTimes(1);
  });

  it("does not sync when the saved zone already matches the device", async () => {
    browserZone.value = "Asia/Jakarta";
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      timezone: "Asia/Jakarta",
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);

    render(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    await waitFor(() => {
      expect(useTimezoneStore.getState().timezone).toBe("Asia/Jakarta");
    });
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
  });

  it("preserves a stored zone when the device is outside Indonesia", async () => {
    browserZone.value = null;
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      timezone: "America/New_York",
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);

    render(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    await waitFor(() => {
      expect(useTimezoneStore.getState().timezone).toBe("America/New_York");
    });
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
  });

  it("uses WIB if settings are empty and the device zone is not Indonesian", async () => {
    browserZone.value = null;
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      timezone: null,
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);

    render(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    await waitFor(() => {
      expect(useTimezoneStore.getState().timezone).toBe("Asia/Jakarta");
    });
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
  });

  it("keeps WIB active while the settings request is pending", () => {
    useTimezoneStore.setState({ timezone: "Asia/Makassar" });
    vi.mocked(settingsService.getSettings).mockReturnValue(
      new Promise(() => undefined),
    );

    render(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    expect(useTimezoneStore.getState().timezone).toBe("Asia/Jakarta");
  });

  it("keeps the application usable when the automatic update fails", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      timezone: null,
    } as Awaited<ReturnType<typeof settingsService.getSettings>>);
    vi.mocked(settingsService.updateSettings).mockRejectedValue(
      new Error("temporary settings failure"),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <TimezoneProvider>
        <span>application</span>
      </TimezoneProvider>,
    );

    expect(await screen.findByText("application")).toBeInTheDocument();
    await waitFor(() => {
      expect(useTimezoneStore.getState().timezone).toBe("Asia/Makassar");
    });
  });

  it.each([
    ["Asia/Jakarta", "Asia/Jakarta"],
    ["Asia/Pontianak", "Asia/Jakarta"],
    ["Asia/Makassar", "Asia/Makassar"],
    ["Asia/Ujung_Pandang", "Asia/Makassar"],
    ["Asia/Jayapura", "Asia/Jayapura"],
    ["Europe/Amsterdam", null],
  ])("maps device zone %s to %s", (zone, expected) => {
    expect(canonicalIndonesianTimezone(zone)).toBe(expected);
  });
});
