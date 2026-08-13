import type { SavingGoalStatus } from "@/services/saving-goal.service";

export type SavingGoalSortKey =
  | "name_asc"
  | "name_desc"
  | "target_desc"
  | "target_asc"
  | "progress_desc"
  | "target_date_asc";

export interface SavingGoalFiltersState {
  search: string;
  status: SavingGoalStatus | "all";
  sort: SavingGoalSortKey;
}