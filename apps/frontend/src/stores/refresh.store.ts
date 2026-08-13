import { create } from "zustand";

interface DataRefreshState {
  version: number;
  bump: () => void;
}

export const useDataRefreshStore = create<DataRefreshState>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));