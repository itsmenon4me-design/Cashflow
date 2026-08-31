import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveSessionsTable } from "./active-sessions-table";

vi.mock("@/lib/auth-token", () => ({
  getAccessToken: () => null,
}));

vi.mock("@/services/session.service", () => ({
  sessionService: {
    list: vi.fn().mockResolvedValue([
      {
        id: "mobile",
        device_type: "Mobile",
        device_name: "Android Mobile",
        operating_system: "Android",
        browser: "Mobile Chrome",
        city: "Medan",
        country: "ID",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_activity_at: "2026-01-01T00:00:00.000Z",
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
        last_activity_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "desktop",
        device_type: "Desktop",
        device_name: "Laptop",
        operating_system: "Windows",
        browser: "Chrome",
        city: null,
        country: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_activity_at: "2026-01-01T00:00:00.000Z",
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
        last_activity_at: "2026-01-01T00:00:00.000Z",
      },
    ]),
    revoke: vi.fn(),
    revokeOthers: vi.fn(),
  },
}));

describe("ActiveSessionsTable", () => {
  it("renders the icon matching each device type", async () => {
    render(<ActiveSessionsTable />);

    expect(await screen.findByTestId("device-icon-mobile")).toBeInTheDocument();
    expect(screen.getByTestId("device-icon-tablet")).toBeInTheDocument();
    expect(screen.getByTestId("device-icon-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("device-icon-unknown")).toBeInTheDocument();
    expect(screen.getByText("Lokasi")).toBeInTheDocument();
    expect(screen.queryByText(/Lokasi berdasarkan estimasi jaringan/)).not.toBeInTheDocument();
    expect(screen.getByText("Windows, Chrome")).toBeInTheDocument();
  });
});
