import { AccountEntity } from '../entities/account.entity';

export interface IAccountsRepository {
  create(input: Partial<AccountEntity>): Promise<AccountEntity>;
  findById(id: string): Promise<AccountEntity | null>;
  findAllByUser(userId: string): Promise<AccountEntity[]>;
  findByUserAndName(
    userId: string,
    name: string,
  ): Promise<AccountEntity | null>;
  update(id: string, updates: Partial<AccountEntity>): Promise<AccountEntity>;
  softDelete(id: string): Promise<void>;
  findDefaultByUser(userId: string): Promise<AccountEntity | null>;
  unsetDefaultForUser(userId: string): Promise<void>;
}
