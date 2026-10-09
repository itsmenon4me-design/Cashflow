import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLanguageStore } from "@/stores/language.store";
import { ApiError } from "@/lib/axios";

const {
  mockGoogleRedirectUrl,
  mockGithubRedirectUrl,
  mockLogin,
  mockSendVerification,
  mockLoginSession,
  mockSearchParams,
} =
  vi.hoisted(() => ({
    mockGoogleRedirectUrl: vi.fn(),
    mockGithubRedirectUrl: vi.fn(),
    mockLogin: vi.fn(),
    mockSendVerification: vi.fn(),
    mockLoginSession: vi.fn(),
    mockSearchParams: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: mockSearchParams,
}));

vi.mock("@/services/auth.service", () => ({
  authService: {
    googleRedirectUrl: mockGoogleRedirectUrl,
    githubRedirectUrl: mockGithubRedirectUrl,
    login: mockLogin,
    logout: vi.fn(),
    register: vi.fn(),
    sendVerification: mockSendVerification,
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector: (state: { loginSession: typeof mockLoginSession }) => unknown) =>
    selector({ loginSession: mockLoginSession }),
}));

import Page from "./page";

describe("Login page", () => {
  beforeEach(() => {
    mockGoogleRedirectUrl.mockReset();
    mockGithubRedirectUrl.mockReset();
    mockLogin.mockReset();
    mockSendVerification.mockReset();
    mockLoginSession.mockReset();
    mockSearchParams.mockReturnValue(new URLSearchParams());
    useLanguageStore.getState().setLanguage("en");
  });

  it("navigates directly to the Google OAuth redirect endpoint", () => {
    mockGoogleRedirectUrl.mockReturnValue(
      "https://cashflow-backend.example/api/v1/auth/google/redirect",
    );
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });

    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/i }),
    );

    expect(mockGoogleRedirectUrl).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith(
      "https://cashflow-backend.example/api/v1/auth/google/redirect",
    );
  });

  it("navigates directly to the GitHub OAuth redirect endpoint", () => {
    mockGithubRedirectUrl.mockReturnValue(
      "https://cashflow-backend.example/api/v1/auth/github/redirect",
    );
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });

    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with GitHub/i }),
    );

    expect(mockGithubRedirectUrl).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith(
      "https://cashflow-backend.example/api/v1/auth/github/redirect",
    );
  });

  it("shows the GitHub-specific OAuth error from the callback", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("oauth_error=github_auth_failed"),
    );
    render(<Page />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /GitHub login is not available/i,
    );
  });

  it("shows the verification message and resend action for pending accounts", async () => {
    mockLogin.mockRejectedValue(
      new ApiError(403, { errorCode: "ERR_EMAIL_NOT_VERIFIED" }),
    );
    mockSendVerification.mockResolvedValue({ success: true });

    render(<Page />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "pending@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /not verified/i,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Resend verification email/i }),
    );
    await waitFor(() =>
      expect(mockSendVerification).toHaveBeenCalledWith(
        "pending@example.com",
      ),
    );
  });

  it("stores the full name returned by the login response", async () => {
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      },
      user: {
        id: "u1",
        email: "amiboys@example.com",
        username: "amiboys",
        full_name: "Nama Registrasi",
      },
    });

    render(<Page />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "amiboys@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(mockLoginSession).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            id: "u1",
            name: "Nama Registrasi",
            email: "amiboys@example.com",
          },
        }),
      ),
    );
  });
});
