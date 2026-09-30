"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  DEFAULT_USER_TIMEZONE,
  getBrowserIndonesianTimezone,
  isValidIanaTimezone,
} from "@/lib/user-timezone";
import { settingsService } from "@/services/settings.service";
import {
  clearSettingsSession,
  getSettingsForSession,
  markTimezoneSyncAttempt,
  setSettingsForSession,
} from "@/services/settings-session";
import { useAuthStore } from "@/stores/auth.store";
import { useTimezoneStore } from "@/stores/timezone.store";

interface TimezoneProviderProps {
  children: ReactNode;
}

export function TimezoneProvider({ children }: TimezoneProviderProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const email = useAuthStore((state) => state.user?.email);
  const setTimezone = useTimezoneStore((state) => state.setTimezone);
  const resetTimezone = useTimezoneStore((state) => state.resetTimezone);
  const previousSession = useRef<string | null>(null);
  const sessionKey = email?.trim().toLowerCase() || "authenticated";

  useEffect(() => {
    if (!isAuthenticated) {
      clearSettingsSession(previousSession.current ?? undefined);
      previousSession.current = null;
      resetTimezone();
      return;
    }

    if (previousSession.current !== sessionKey) {
      clearSettingsSession(previousSession.current ?? undefined);
      previousSession.current = sessionKey;
      resetTimezone();
    }

    let cancelled = false;
    void getSettingsForSession(sessionKey)
      .then(async (settings) => {
        if (cancelled) return;

        const savedTimezone = isValidIanaTimezone(settings.timezone)
          ? settings.timezone
          : null;
        const detectedTimezone = getBrowserIndonesianTimezone();
        const timezone =
          detectedTimezone ??
          savedTimezone ??
          DEFAULT_USER_TIMEZONE;

        setTimezone(timezone);

        if (!markTimezoneSyncAttempt(sessionKey)) return;
        if (!detectedTimezone || detectedTimezone === savedTimezone) return;

        try {
          const updated = await settingsService.updateSettings({
            timezone: detectedTimezone,
          });
          setSettingsForSession(sessionKey, updated);
        } catch (error) {
          console.warn("[timezone] Browser timezone sync failed", error);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[timezone] Failed to load user timezone settings", error);
      });

    return () => {
      cancelled = true;
    };
  }, [email, isAuthenticated, resetTimezone, sessionKey, setTimezone]);

  return children;
}
