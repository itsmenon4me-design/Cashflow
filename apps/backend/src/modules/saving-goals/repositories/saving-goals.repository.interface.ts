import { SavingGoalEntity } from '../entities/saving-goal.entity';

export interface ISavingGoalsRepository {
  findById(id: string, currency?: string): Promise<SavingGoalEntity | null>;
  findAllByUser(userId: string, currency?: string): Promise<SavingGoalEntity[]>;
  create(input: Partial<SavingGoalEntity>): Promise<SavingGoalEntity>;
  update(
    id: string,
    updates: Partial<SavingGoalEntity>,
  ): Promise<SavingGoalEntity>;
  softDelete(id: string): Promise<void>;
}
