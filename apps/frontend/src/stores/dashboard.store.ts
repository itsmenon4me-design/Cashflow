import { create } from "zustand";

interface DashboardState {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedMonth: "May 2026",
  setSelectedMonth: (month) => set({ selectedMonth: month }),
}));
