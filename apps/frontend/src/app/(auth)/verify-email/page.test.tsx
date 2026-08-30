import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/auth.service";
import VerifyEmailPage from "./page";

const { replaceMock, mockSearchParams } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  mockSearchParams: new Map<string, string>([
    ["token", "test-token-123"],
    ["id", "user-id-456"],
  ]),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

vi.mock("@/services/auth.service", () => ({
  authService: {
    verifyEmail: vi.fn(),
  },
}));

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    replaceMock.mockReset();
    mockSearchParams.set("token", "test-token-123");
    mockSearchParams.set("id", "user-id-456");
  });

  it("shows error when token or id parameters are missing", async () => {
    mockSearchParams.clear();

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Tautan verifikasi tidak valid/i
      );
    });
    expect(authService.verifyEmail).not.toHaveBeenCalled();
  });

  it("calls authService.verifyEmail and redirects on success", async () => {
    vi.spyOn(authService, "verifyEmail").mockResolvedValue({
      success: true,
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(authService.verifyEmail).toHaveBeenCalledWith(
        "test-token-123",
        "user-id-456"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  it("shows error message when verification fails", async () => {
    vi.spyOn(authService, "verifyEmail").mockResolvedValue({
      success: false,
      message: "Token verifikasi sudah tidak berlaku.",
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Token verifikasi sudah tidak berlaku."
      );
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
