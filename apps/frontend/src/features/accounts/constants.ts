import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AccountFormValues } from "@/features/accounts/schema";
import type { AccountFiltersState, AccountSortKey } from "@/features/accounts/types";
import type { AccountType } from "@/types/backend";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const ACCOUNT_TYPE_OPTIONS: {
  value: AccountType;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "CASH", label: "Kas", icon: Banknote },
  { value: "BANK", label: "Bank", icon: Landmark },
  { value: "E_WALLET", label: "E-Wallet", icon: Wallet },
  { value: "CREDIT_CARD", label: "Kartu Kredit", icon: CreditCard },
  { value: "SAVINGS", label: "Tabungan", icon: PiggyBank },
  { value: "INVESTMENT", label: "Investasi", icon: TrendingUp },
  { value: "OTHER", label: "Lainnya", icon: CircleDollarSign },
];

export const ACCOUNT_SORT_OPTIONS: { value: AccountSortKey; label: string }[] = [
  { value: "name_asc", label: "Nama (A-Z)" },
  { value: "name_desc", label: "Nama (Z-A)" },
  { value: "balance_asc", label: "Saldo (Terendah)" },
  { value: "balance_desc", label: "Saldo (Tertinggi)" },
  { value: "created_desc", label: "Terbaru" },
  { value: "created_asc", label: "Terlama" },
];

export const EMPTY_FILTERS: AccountFiltersState = {
  search: "",
  type: "all",
  sort: "name_asc",
};

export const EMPTY_FORM_VALUES: AccountFormValues = {
  name: "",
  accountType: "BANK",
  currency: "IDR",
  openingBalance: 0,
  description: "",
  isDefault: false,
};