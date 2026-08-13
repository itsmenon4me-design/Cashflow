import { apiClient } from "@/lib/axios";
import { withOfflineCache } from "@/lib/offline/read-cache";
import type { CategoryResponse, CategoryType } from "@/types/backend";

export interface CreateCategoryPayload {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  description?: string;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export interface CategoryItem {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export function toCategoryItem(category: CategoryResponse): CategoryItem {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    icon: category.icon,
    color: category.color,
    description: category.description,
    isSystem: category.is_system,
    isActive: category.is_active,
    createdAt: category.created_at,
  };
}

export const categoryService = {
  list: async (): Promise<CategoryResponse[]> => {
    const res = await withOfflineCache("categories", "list", () =>
      apiClient.get<{ success: boolean; data: CategoryResponse[] }>("/categories"),
    );
    return res.data ?? [];
  },

  get: (id: string): Promise<CategoryResponse> =>
    apiClient
      .get<{ success: boolean; data: CategoryResponse }>(`/categories/${id}`)
      .then((res) => res.data),

  listByType: async (type: CategoryType): Promise<CategoryResponse[]> => {
    const res = await apiClient.get<{ success: boolean; data: CategoryResponse[] }>(
      `/categories/type/${type}`,
    );
    return res.data ?? [];
  },

  create: (payload: CreateCategoryPayload): Promise<CategoryResponse> =>
    apiClient
      .post<{ success: boolean; data: CategoryResponse }>("/categories", payload)
      .then((res) => res.data),

  update: (id: string, payload: UpdateCategoryPayload): Promise<CategoryResponse> =>
    apiClient
      .patch<{ success: boolean; data: CategoryResponse }>(`/categories/${id}`, payload)
      .then((res) => res.data),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(`/categories/${id}`),
};