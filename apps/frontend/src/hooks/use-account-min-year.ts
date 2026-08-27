"use client";

import { useEffect, useState } from "react";

import { settingsService } from "@/services/settings.service";

// Module-level cache: the account creation date never changes within a
// session, so one fetch is enough no matter how many pickers mount.
let cachedMinYear: number | undefined | undefined;

function fallbackMinYear(): number {
  return new Date().getFullYear() - 2;
}

async function resolveAccountMinYear(): Promise<number> {
  if (cachedMinYear !== undefined) {
    return cachedMinYear;
  }
  try {
    const settings = await settingsService.getSettings();
    const createdYear = settings.createdAt
      ? new Date(settings.createdAt).getFullYear()
      : NaN;
    cachedMinYear = Number.isFinite(createdYear) ? createdYear : undefined;
  } catch {
    cachedMinYear = undefined;
  }
  // Lower bound = the year the account was created; fall back to the old
  // implicit floor (current-2) when settings are unavailable.
  return cachedMinYear ?? fallbackMinYear();
}

/**
 * Returns the minimum selectable year for period pickers:
 * the year the user's account was created (falls back to current-2 when the
 * setting is unavailable). Result is cached module-wide after first resolve.
 */
export function useAccountMinYear(): number {
  const [minYear, setMinYear] = useState<number>(() => cachedMinYear ?? new Date().getFullYear());

  useEffect(() => {
    let cancelled = false;
    void resolveAccountMinYear().then((year) => {
      if (!cancelled) {
        setMinYear(year);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return minYear;
}
