import { apiClient } from "@/lib/axios";
import type { AuthPayload, ForgotPasswordPayload, AuthSession } from "@/types/auth";

export const authService = {
  login: async (payload: AuthPayload): Promise<AuthSession> => {
    return apiClient.post<AuthSession>("/auth/login", payload);
  },
  register: async (payload: AuthPayload): Promise<AuthSession> => {
    return apiClient.post<AuthSession>("/auth/register", payload);
  },
  forgotPassword: async (payload: ForgotPasswordPayload): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>("/auth/forgot-password", payload);
  },
  refreshToken: async (refreshToken: string): Promise<AuthSession> => {
    return apiClient.post<AuthSession>("/auth/refresh-token", { refreshToken });
  },
};
