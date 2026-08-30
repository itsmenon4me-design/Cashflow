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

declare global {
  interface Window {
    __authHydrated?: boolean;
  }
}

export interface AuthUser {
  name: string;
  email: string;
  has_manual_password?: boolean | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  hydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  hydrateFromStorage: () => void;
  loginSession: (params: { accessToken: string; refreshToken: string; user?: StoredUser | null }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  hydrated: false,
  setUser: (user) => {
    setStoredUser(user);
    set({ user });
  },
  hydrateFromStorage: () => {
    const token = getAccessToken();
    const storedUser = getStoredUser() as AuthUser | null;
    set({
      isAuthenticated: token !== null,
      user: storedUser,
      hydrated: true,
    });
    if (typeof window !== "undefined") {
      window.__authHydrated = true;
    }
  },
  loginSession: ({ accessToken, refreshToken, user }) => {
    setAuthTokens(accessToken, refreshToken);
    if (user) {
      setStoredUser(user);
    }
    set({ isAuthenticated: true, user: (user as AuthUser | null) ?? null, hydrated: true });
    if (typeof window !== "undefined") {
      window.__authHydrated = true;
    }
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