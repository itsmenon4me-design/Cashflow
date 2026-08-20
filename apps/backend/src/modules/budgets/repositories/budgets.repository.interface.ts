import { BudgetEntity } from '../entities/budget.entity';

export interface IBudgetsRepository {
  findById(id: string, currency?: string): Promise<BudgetEntity | null>;
  findAllByUser(userId: string, currency?: string): Promise<BudgetEntity[]>;
  findByUserAndCategoryAndPeriod(
    userId: string,
    categoryId: string,
    month: number,
    year: number,
    currency?: string,
  ): Promise<BudgetEntity | null>;
  create(input: Partial<BudgetEntity>): Promise<BudgetEntity>;
  update(id: string, updates: Partial<BudgetEntity>): Promise<BudgetEntity>;
  softDelete(id: string): Promise<void>;
}
