import { AccountEntity } from '../entities/account.entity';

export interface IAccountsRepository {
  create(input: Partial<AccountEntity>): Promise<AccountEntity>;
  findById(id: string, currency?: string): Promise<AccountEntity | null>;
  findAllByUser(userId: string, currency?: string): Promise<AccountEntity[]>;
  findByUserAndName(
    userId: string,
    name: string,
    currency?: string,
  ): Promise<AccountEntity | null>;
  update(id: string, updates: Partial<AccountEntity>): Promise<AccountEntity>;
  softDelete(id: string): Promise<void>;
  findDefaultByUser(userId: string): Promise<AccountEntity | null>;
  unsetDefaultForUser(userId: string): Promise<void>;
}
