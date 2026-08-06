import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  user: {
    name: string;
    email: string;
  } | null;
  setAuthenticated: (value: boolean) => void;
  setUser: (user: { name: string; email: string } | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: true,
  user: {
    name: "Ariana Wells",
    email: "ariana@cashflow.enterprise",
  },
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setUser: (user) => set({ user }),
}));
