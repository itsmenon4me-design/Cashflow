import {
  Bitcoin,
  Building2,
  CandlestickChart,
  CircleDollarSign,
  Landmark,
  LineChart,
  PiggyBank,
  PieChart,
  type LucideIcon,
} from "lucide-react";
import type { InvestmentFormValues } from "@/features/investments/schema";
import type {
  InvestmentFiltersState,
  InvestmentSortKey,
} from "@/features/investments/types";
import type {
  InvestmentStatus,
  InvestmentType,
} from "@/services/investment.service";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const INVESTMENT_TYPE_OPTIONS: {
  value: InvestmentType;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "Stock", label: "Saham", icon: CandlestickChart },
  { value: "Mutual Fund", label: "Reksa Dana", icon: PieChart },
  { value: "Gold", label: "Emas", icon: CircleDollarSign },
  { value: "Crypto", label: "Kripto", icon: Bitcoin },
  { value: "Bond", label: "Obligasi", icon: Landmark },
  { value: "Deposit", label: "Deposito", icon: PiggyBank },
  { value: "Property", label: "Properti", icon: Building2 },
  { value: "Other", label: "Lainnya", icon: LineChart },
];

export const INVESTMENT_STATUS_OPTIONS: {
  value: InvestmentStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "Semua Status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "SOLD", label: "Dijual" },
  { value: "CLOSED", label: "Ditutup" },
];

export const INVESTMENT_SORT_OPTIONS: {
  value: InvestmentSortKey;
  label: string;
}[] = [
  { value: "name_asc", label: "Nama (A-Z)" },
  { value: "name_desc", label: "Nama (Z-A)" },
  { value: "value_desc", label: "Nilai (Tertinggi)" },
  { value: "value_asc", label: "Nilai (Terendah)" },
  { value: "pl_desc", label: "Profit/Loss (Terbesar)" },
  { value: "purchase_desc", label: "Tanggal Beli (Terbaru)" },
];

export const EMPTY_FILTERS: InvestmentFiltersState = {
  search: "",
  type: "all",
  status: "all",
  sort: "name_asc",
};

export const EMPTY_FORM_VALUES: InvestmentFormValues = {
  accountId: "",
  investmentType: "Stock",
  platform: "",
  name: "",
  symbol: "",
  quantity: 0,
  averageBuyPrice: 0,
  // Empty by default for NEW entries: falls back to the average buy price on
  // submit (ROI awal = 0%). Old investments are never recalculated.
  currentPrice: null,
  invested: 0,
  purchaseDate: "",
  notes: "",
  status: "ACTIVE",
};

export function investmentTypeInfo(type: InvestmentType) {
  return (
    INVESTMENT_TYPE_OPTIONS.find((option) => option.value === type) ??
    INVESTMENT_TYPE_OPTIONS[INVESTMENT_TYPE_OPTIONS.length - 1]
  );
}