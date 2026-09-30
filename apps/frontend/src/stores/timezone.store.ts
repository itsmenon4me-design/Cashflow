import { create } from "zustand";
import { DEFAULT_USER_TIMEZONE } from "@/lib/user-timezone";

interface TimezoneState {
  timezone: string;
  setTimezone: (timezone: string) => void;
  resetTimezone: () => void;
}

export const useTimezoneStore = create<TimezoneState>((set) => ({
  timezone: DEFAULT_USER_TIMEZONE,
  setTimezone: (timezone) => set({ timezone }),
  resetTimezone: () => set({ timezone: DEFAULT_USER_TIMEZONE }),
}));
