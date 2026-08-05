import { TransactionEntity } from '../entities/transaction.entity';

export interface ITransactionsRepository {
  create(input: Partial<TransactionEntity>): Promise<TransactionEntity>;
  findById(id: string): Promise<TransactionEntity | null>;
  findAllByUser(userId: string): Promise<TransactionEntity[]>;
  update(id: string, updates: Partial<TransactionEntity>): Promise<TransactionEntity>;
  softDelete(id: string): Promise<void>;
}
