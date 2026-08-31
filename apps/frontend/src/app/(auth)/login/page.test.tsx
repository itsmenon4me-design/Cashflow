import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLanguageStore } from "@/stores/language.store";
import { ApiError } from "@/lib/axios";

const { mockGoogleLogin, mockGithubLogin, mockLogin, mockSendVerification } =
  vi.hoisted(() => ({
  mockGoogleLogin: vi.fn(),
  mockGithubLogin: vi.fn(),
  mockLogin: vi.fn(),
  mockSendVerification: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/services/auth.service", () => ({
  authService: {
    googleLogin: mockGoogleLogin,
    githubLogin: mockGithubLogin,
    login: mockLogin,
    logout: vi.fn(),
    register: vi.fn(),
    sendVerification: mockSendVerification,
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock("@/stores/auth.store", () => ({
  useAuthStore: () => ({ loginSession: vi.fn() }),
}));

import Page from "./page";

describe("Login page", () => {
  beforeEach(() => {
    mockGoogleLogin.mockReset();
    mockGithubLogin.mockReset();
    mockLogin.mockReset();
    mockSendVerification.mockReset();
    useLanguageStore.getState().setLanguage("en");
  });

  it("redirects to Google when Continue with Google is clicked", async () => {
    mockGoogleLogin.mockResolvedValue({
      success: true,
      url: "https://accounts.google.com/oauth2/auth",
    });
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });

    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/i }),
    );

    await waitFor(() => expect(mockGoogleLogin).toHaveBeenCalledTimes(1));
    expect(assignSpy).toHaveBeenCalledWith(
      "https://accounts.google.com/oauth2/auth",
    );
  });

  it("redirects to GitHub when Continue with GitHub is clicked", async () => {
    mockGithubLogin.mockResolvedValue({
      success: true,
      url: "https://github.com/login/oauth/authorize",
    });
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });

    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with GitHub/i }),
    );

    await waitFor(() => expect(mockGithubLogin).toHaveBeenCalledTimes(1));
    expect(assignSpy).toHaveBeenCalledWith(
      "https://github.com/login/oauth/authorize",
    );
  });

  it("displays a generic OAuth error when Google login fails", async () => {
    mockGoogleLogin.mockResolvedValue({
      success: false,
      message: "Google OAuth belum dikonfigurasi.",
    });

    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/i }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Google OAuth belum dikonfigurasi/i,
      ),
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
});
