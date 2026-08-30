import { apiClient } from "@/lib/axios";
import type { LoginResponse } from "@/types/backend";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username?: string;
  full_name: string;
  password: string;
  avatar_url?: string | null;
  phone_number?: string | null;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  data?: import("@/types/backend").UserResponse;
}

export interface ResetPasswordPayload {
  token: string;
  id: string;
  new_password: string;
}

import { ApiError } from "@/lib/axios";
import { getStoredUser } from "@/lib/auth-token";

export const authService = {
  login: (payload: LoginPayload): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>("/auth/login", payload),

  googleLogin: (): Promise<{
    success: boolean;
    message?: string;
    url?: string;
  }> =>
    apiClient
      .get<{ success: boolean; message?: string; url?: string }>("/auth/google")
      .catch(() => ({
        success: false,
        message:
          "Google OAuth belum dikonfigurasi. Harap aktifkan Google Client ID dan secret terlebih dahulu.",
      })),

  githubLogin: (): Promise<{
    success: boolean;
    message?: string;
    url?: string;
  }> =>
    apiClient
      .get<{ success: boolean; message?: string; url?: string }>("/auth/github")
      .catch(() => ({
        success: false,
        message:
          "GitHub OAuth belum dikonfigurasi. Harap aktifkan GitHub Client ID dan secret terlebih dahulu.",
      })),

  updateProfile: async (payload: {
    full_name?: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> => {
    try {
      const res = await apiClient.patch<{ success: boolean; data?: any }>(
        "/auth/profile",
        payload,
      );
      return res;
    } catch (err) {
      // If the endpoint doesn't exist in the backend (404), try a fallback to /users/:id
      if (err instanceof ApiError && err.status === 404) {
        try {
          const stored = getStoredUser() as any;
          let maybeId =
            stored?.id ??
            stored?.user_id ??
            stored?.sub ??
            stored?.uuid ??
            null;
          if (!maybeId) {
            // Stored user may lack an id (login response ships no user object) — resolve via /auth/me.
            const me = await apiClient.get<{ success: boolean; data?: any }>(
              "/auth/me",
            );
            maybeId = me?.data?.id ?? null;
          }
          if (maybeId) {
            const userPatch: Record<string, unknown> = {};
            if (payload.full_name) userPatch["full_name"] = payload.full_name;
            const r = await apiClient.patch<{ success: boolean; data?: any }>(
              `/users/${maybeId}`,
              userPatch,
            );
            // PATCH /users/:id balik raw user object tanpa wrapper {success} — normalize
            if (r && typeof r === "object" && "id" in r) {
              return { success: true, data: r };
            }
            return r;
          }
        } catch (e) {
          // fall through to generic failure below
        }
        return {
          success: false,
          message: "No fallback endpoint available for profile update",
        };
      }
      return { success: false, message: String(err) };
    }
  },

  logout: (): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>("/auth/logout"),

  deleteAccount: (payload: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; message?: string }> =>
    apiClient
      .post<{ success: boolean; message?: string }>("/users/me/delete-account", payload)
      .catch((err) => ({
        success: false,
        message:
          err instanceof ApiError &&
          typeof err.data === "object" &&
          err.data !== null &&
          "message" in err.data
            ? String((err.data as { message: unknown }).message)
            : "Hapus akun gagal. Periksa email dan password Anda.",
      })),

  register: (payload: RegisterPayload): Promise<RegisterResponse> =>
    apiClient.post<RegisterResponse>("/auth/register", payload),

  sendVerification: (email: string): Promise<{ success: boolean }> =>
    apiClient
      .post<{ success: boolean }>("/auth/email/send-verification", { email })
      .catch(() => ({ success: false })),

  verifyEmail: (
    token: string,
    id: string,
  ): Promise<{ success: boolean; message?: string }> =>
    apiClient
      .get<{ success: boolean; message?: string }>(
        `/auth/email/verify?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`,
      )
      .catch((err) => ({
        success: false,
        message:
          err instanceof ApiError &&
          typeof err.data === "object" &&
          err.data !== null &&
          "message" in err.data
            ? String((err.data as { message: unknown }).message)
            : "Verifikasi email gagal atau token telah kadaluwarsa.",
      })),

  forgotPassword: (
    email: string,
  ): Promise<{ success: boolean; message?: string }> =>
    apiClient
      .post<{ success: boolean; message?: string }>(
        "/auth/email/forgot-password",
        { email },
      )
      .catch(() => ({
        success: false,
        message: "Gagal mengirim email reset. Coba lagi.",
      })),

  resetPassword: (
    payload: ResetPasswordPayload,
  ): Promise<{ success: boolean; message?: string }> =>
    apiClient
      .post<{ success: boolean; message?: string }>(
        "/auth/reset-password",
        payload,
      )
      .catch(() => ({
        success: false,
        message: "Gagal mengatur ulang kata sandi.",
      })),
};
