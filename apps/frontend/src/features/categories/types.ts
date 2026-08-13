export type CategorySortKey =
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc";

export interface CategoryFiltersState {
  search: string;
  sort: CategorySortKey;
}