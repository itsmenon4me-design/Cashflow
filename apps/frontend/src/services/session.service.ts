import { apiClient } from "@/lib/axios";
import type { SessionItem } from "@/types/session";

export const sessionService = {
  list: () => apiClient.get<SessionItem[]>("/auth/sessions"),
  revoke: (id: string) => apiClient.delete<{ success: boolean }>(`/auth/sessions/${id}`),
  revokeOthers: () => apiClient.delete<{ success: boolean }>("/auth/sessions"),
};
