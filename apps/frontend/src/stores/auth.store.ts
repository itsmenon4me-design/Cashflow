import { create } from "zustand";
import {
  getAccessToken,
  getStoredUser,
  setAuthTokens,
  setStoredUser,
  clearAuthTokens,
  type StoredUser,
} from "@/lib/auth-token";
import { clearOfflineUserData } from "@/lib/offline/storage";
import { useSyncStore } from "@/stores/sync.store";

export interface AuthUser {
  name: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  loginSession: (params: { accessToken: string; refreshToken: string; user?: StoredUser | null }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: typeof window !== "undefined" && getAccessToken() !== null,
  user: getStoredUser() as AuthUser | null,
  setUser: (user) => {
    setStoredUser(user);
    set({ user });
  },
  loginSession: ({ accessToken, refreshToken, user }) => {
    setAuthTokens(accessToken, refreshToken);
    if (user) {
      setStoredUser(user);
    }
    set({ isAuthenticated: true, user: (user as AuthUser | null) ?? null });
  },
  logout: () => {
    const user = getStoredUser() as AuthUser | null;
    clearAuthTokens();
    if (user?.email) {
      void clearOfflineUserData(user.email.toLowerCase().trim());
    }
    useSyncStore.getState().reset();
    set({ isAuthenticated: false, user: null });
  },
}));