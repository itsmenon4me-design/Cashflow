import {
  Briefcase,
  Car,
  Coins,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PiggyBank,
  ShoppingBag,
  Tag,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { CategoryFormValues } from "@/features/categories/schema";
import type { CategoryFiltersState, CategorySortKey } from "@/features/categories/types";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const CATEGORY_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "shopping-bag", label: "Belanja", icon: ShoppingBag },
  { value: "car", label: "Transportasi", icon: Car },
  { value: "house", label: "Rumah", icon: House },
  { value: "utensils", label: "Makanan", icon: Utensils },
  { value: "heart-pulse", label: "Kesehatan", icon: HeartPulse },
  { value: "graduation-cap", label: "Pendidikan", icon: GraduationCap },
  { value: "dumbbell", label: "Olahraga", icon: Dumbbell },
  { value: "gamepad", label: "Hiburan", icon: Gamepad2 },
  { value: "briefcase", label: "Bisnis", icon: Briefcase },
  { value: "coins", label: "Pendapatan", icon: Coins },
  { value: "gift", label: "Hadiah", icon: Gift },
  { value: "piggy-bank", label: "Tabungan", icon: PiggyBank },
  { value: "tag", label: "Lainnya", icon: Tag },
];

export const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

export function categoryIconInfo(name: string | null) {
  return (
    CATEGORY_ICONS.find((option) => option.value === name) ??
    CATEGORY_ICONS[CATEGORY_ICONS.length - 1]
  );
}

export const CATEGORY_SORT_OPTIONS: { value: CategorySortKey; label: string }[] = [
  { value: "name_asc", label: "Nama (A-Z)" },
  { value: "name_desc", label: "Nama (Z-A)" },
  { value: "created_desc", label: "Terbaru" },
  { value: "created_asc", label: "Terlama" },
];

export const EMPTY_FILTERS: CategoryFiltersState = {
  search: "",
  sort: "name_asc",
};

export const EMPTY_FORM_VALUES: CategoryFormValues = {
  name: "",
  type: "EXPENSE",
  icon: "tag",
  color: CATEGORY_COLORS[0],
  description: "",
};