import type { SavingGoalFormValues } from "@/features/saving-goals/schema";
import type {
  SavingGoalFiltersState,
  SavingGoalSortKey,
} from "@/features/saving-goals/types";
import type { SavingGoalStatus } from "@/services/saving-goal.service";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const STATUS_OPTIONS: { value: SavingGoalStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua Status" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

export const SAVING_GOAL_SORT_OPTIONS: {
  value: SavingGoalSortKey;
  label: string;
}[] = [
  { value: "name_asc", label: "Nama (A-Z)" },
  { value: "name_desc", label: "Nama (Z-A)" },
  { value: "target_desc", label: "Target (Tertinggi)" },
  { value: "target_asc", label: "Target (Terendah)" },
  { value: "progress_desc", label: "Progres (Tertinggi)" },
  { value: "target_date_asc", label: "Tanggal Target (Terdekat)" },
];

export const EMPTY_FILTERS: SavingGoalFiltersState = {
  search: "",
  status: "all",
  sort: "name_asc",
};

export const EMPTY_FORM_VALUES: SavingGoalFormValues = {
  name: "",
  description: "",
  accountId: "",
  categoryId: "",
  target: 0,
  current: 0,
  startDate: "",
  targetDate: "",
  status: "ACTIVE",
};

export function statusColor(status: SavingGoalStatus): "success" | "neutral" | "info" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "neutral";
    default:
      return "info";
  }
}

export function estimateCompletionDate(item: {
  current: number;
  target: number;
  startDate: string;
}): string | null {
  if (item.current <= 0) {
    return null;
  }
  const remaining = item.target - item.current;
  if (remaining <= 0) {
    return null;
  }
  const start = new Date(item.startDate + "T00:00:00").getTime();
  if (Number.isNaN(start) || start >= Date.now()) {
    return null;
  }
  const elapsedMs = Date.now() - start;
  const ratePerMs = item.current / elapsedMs;
  const estimateMs = Date.now() + remaining / ratePerMs;
  return new Date(estimateMs).toISOString().slice(0, 10);
}