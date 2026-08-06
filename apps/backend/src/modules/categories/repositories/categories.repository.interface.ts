import { CategoryEntity } from '../entities/category.entity';

export interface ICategoriesRepository {
  create(input: Partial<CategoryEntity>): Promise<CategoryEntity>;
  findById(id: string): Promise<CategoryEntity | null>;
  findAllByUser(userId: string): Promise<CategoryEntity[]>;
  findByUserAndNameAndType(
    userId: string,
    name: string,
    type: string,
  ): Promise<CategoryEntity | null>;
  update(id: string, updates: Partial<CategoryEntity>): Promise<CategoryEntity>;
  softDelete(id: string): Promise<void>;
  findByType(userId: string, type: string): Promise<CategoryEntity[]>;
}
