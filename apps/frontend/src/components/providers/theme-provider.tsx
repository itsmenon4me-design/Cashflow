"use client";

import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "@/stores/theme.store";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const mode = useThemeStore((state) => state.mode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  return <>{children}</>;
}
