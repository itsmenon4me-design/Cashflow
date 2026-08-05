export type CategoryType = 'INCOME' | 'EXPENSE';

export class CategoryEntity {
  id!: string;
  user_id!: string;
  name!: string;
  type!: CategoryType;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  parent_category_id?: string | null;
  is_system!: boolean;
  is_active!: boolean;
  created_at!: Date;
  updated_at!: Date;
  deleted_at?: Date | null;
}
