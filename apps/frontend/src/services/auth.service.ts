import { apiClient } from "@/lib/axios";
import type { LoginResponse } from "@/types/backend";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
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

export const authService = {
  login: (payload: LoginPayload): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>("/auth/login", payload),

  googleLogin: (): Promise<{ success: boolean; message?: string; url?: string }> =>
    apiClient
      .get<{ success: boolean; message?: string; url?: string }>("/auth/google")
      .catch(() => ({
        success: false,
        message: "Google OAuth belum dikonfigurasi. Harap aktifkan Google Client ID dan secret terlebih dahulu.",
      })),

  appleLogin: (): Promise<{ success: boolean; message?: string; url?: string }> =>
    apiClient
      .get<{ success: boolean; message?: string; url?: string }>("/auth/apple")
      .catch(() => ({
        success: false,
        message: "Apple OAuth belum dikonfigurasi. Harap aktifkan Apple client configuration terlebih dahulu.",
      })),

  logout: (): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>("/auth/logout"),

  register: (payload: RegisterPayload): Promise<RegisterResponse> =>
    apiClient.post<RegisterResponse>("/auth/register", payload),

  sendVerification: (email: string): Promise<{ success: boolean }> =>
    apiClient.post<{ success: boolean }>("/auth/email/send-verification", { email }).catch(() => ({ success: false })),

  forgotPassword: (email: string): Promise<{ success: boolean; message?: string }> =>
    apiClient
      .post<{ success: boolean; message?: string }>("/auth/email/forgot-password", { email })
      .catch(() => ({ success: false, message: "Gagal mengirim email reset. Coba lagi." })),

  resetPassword: (payload: ResetPasswordPayload): Promise<{ success: boolean; message?: string }> =>
    apiClient
      .post<{ success: boolean; message?: string }>("/auth/reset-password", payload)
      .catch(() => ({ success: false, message: "Gagal mengatur ulang kata sandi." })),
};