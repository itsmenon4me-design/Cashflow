"use client";

import type { ReactNode } from "react";

import { OfflineBanner } from "@/components/layout/offline-banner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ErrorBoundary } from "@/components/states/ErrorBoundary";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>{children}</ThemeProvider>
      <OfflineBanner />
    </ErrorBoundary>
  );
}