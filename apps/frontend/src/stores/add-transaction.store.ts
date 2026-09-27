import { create } from "zustand";

interface AddTransactionState {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

export const useAddTransactionStore = create<AddTransactionState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));
