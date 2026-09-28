export type CategorySortKey =
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc";

export type CategoryTypeFilter = "all" | "INCOME" | "EXPENSE";

export interface CategoryFiltersState {
  search: string;
  sort: CategorySortKey;
  type: CategoryTypeFilter;
}