import { create } from "zustand";

interface ThemeState {
  mode: "light" | "dark";
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "dark",
  toggleMode: () => set((state) => ({ mode: state.mode === "dark" ? "light" : "dark" })),
}));
