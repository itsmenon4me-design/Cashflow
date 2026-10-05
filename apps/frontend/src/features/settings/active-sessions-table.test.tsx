import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveSessionsTable } from "./active-sessions-table";

const tokenState = vi.hoisted(() => ({ accessToken: null as string | null }));

vi.mock("@/lib/auth-token", () => ({
  getAccessToken: () => tokenState.accessToken,
}));

vi.mock("@/services/session.service", () => ({
  sessionService: {
    list: vi.fn().mockResolvedValue([
      {
        id: "mobile",
        device_type: "Mobile",
        device_name: "Android",
        operating_system: "Android",
        browser: "Mobile Chrome",
        city: "Medan",
        country: "ID",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_activity_at: "2026-04-04T00:00:00.000Z",
      },
      {
        id: "tablet",
        device_type: "Tablet",
        device_name: "Tablet",
        operating_system: "Android",
        browser: "Chrome",
        city: null,
        country: "ID",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_activity_at: "2026-04-03T00:00:00.000Z",
      },
      {
        id: "desktop",
        device_type: "Desktop",
        device_name: "Windows PC · Chrome",
        operating_system: "Windows",
        browser: "Chrome",
        city: null,
        country: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_activity_at: "2026-04-02T00:00:00.000Z",
      },
      {
        id: "unknown",
        device_type: null,
        device_name: null,
        operating_system: null,
        browser: null,
        city: null,
        country: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_activity_at: "2026-04-01T00:00:00.000Z",
      },
    ]),
    revoke: vi.fn(),
    revokeOthers: vi.fn(),
  },
}));

afterEach(() => {
  tokenState.accessToken = null;
});

describe("ActiveSessionsTable", () => {
  it("renders the icon matching each device type", async () => {
    render(<ActiveSessionsTable />);

    expect(await screen.findByTestId("device-icon-mobile")).toBeInTheDocument();
    expect(screen.getByTestId("device-icon-tablet")).toBeInTheDocument();
    expect(screen.getByTestId("device-icon-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("device-icon-unknown")).toBeInTheDocument();
    expect(screen.getByText("Lokasi")).toBeInTheDocument();
    expect(screen.queryByText(/Lokasi berdasarkan estimasi jaringan/)).not.toBeInTheDocument();
    expect(screen.getByText("Windows PC · Chrome")).toBeInTheDocument();
    expect(
      screen.getAllByRole("row").slice(1).map((row) => row.querySelector("td")?.textContent?.trim()),
    ).toEqual(["Android", "Tablet", "Windows PC · Chrome", "Perangkat tidak diketahui"]);
  });

  it("marks only the session matching the current token", async () => {
    tokenState.accessToken = `header.${btoa(JSON.stringify({ sessionId: "desktop" }))}.signature`;
    render(<ActiveSessionsTable />);

    expect(await screen.findByText("Windows PC · Chrome")).toBeInTheDocument();
    expect(screen.getAllByText("Perangkat ini")).toHaveLength(1);
  });
});
