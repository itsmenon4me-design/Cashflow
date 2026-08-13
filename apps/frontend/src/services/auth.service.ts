import { apiClient } from "@/lib/axios";
import type { LoginResponse } from "@/types/backend";

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  login: (payload: LoginPayload): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>("/auth/login", payload),

  logout: (): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>("/auth/logout"),

  // TODO: waiting backend endpoint — there is no /auth/register route in the backend yet.
  register: async (): Promise<LoginResponse> => ({
    success: false,
    message: "Pendaftaran belum tersedia. Tunggu endpoint /auth/register di backend.",
  }),

  forgotPassword: (email: string): Promise<{ success: boolean; message?: string }> =>
    apiClient
      .post<{ success: boolean; message?: string }>("/auth/email/forgot-password", { email })
      .catch(() => ({ success: false, message: "Gagal mengirim email reset. Coba lagi." })),
};