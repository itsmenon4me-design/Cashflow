import { TransactionEntity } from '../entities/transaction.entity';

export interface ITransactionsRepository {
  create(input: Partial<TransactionEntity>): Promise<TransactionEntity>;
  // When currency is provided, the repository must apply a DB-level relation
  // filter so the returned transaction belongs to an account with that currency.
  findById(id: string, currency?: string): Promise<TransactionEntity | null>;
  findByReferenceNumber(
    userId: string,
    referenceNumber: string,
  ): Promise<TransactionEntity | null>;
  findAllByUser(userId: string): Promise<TransactionEntity[]>;
  update(
    id: string,
    updates: Partial<TransactionEntity>,
  ): Promise<TransactionEntity>;
  softDelete(id: string): Promise<void>;
}
