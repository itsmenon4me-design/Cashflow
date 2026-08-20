import { BillEntity } from '../entities/bill.entity';

export interface IBillsRepository {
  create(input: Partial<BillEntity>): Promise<BillEntity>;

  findByIdOwned(id: string, userId: string, currency?: string): Promise<BillEntity | null>;

  findAllByUser(userId: string, currency?: string): Promise<BillEntity[]>;

  findUpcomingByUser(
    userId: string,
    from: Date,
    to: Date,
    currency?: string,
  ): Promise<BillEntity[]>;

  updateOwned(
    id: string,
    userId: string,
    updates: Partial<BillEntity>,
  ): Promise<BillEntity | null>;

  softDeleteOwned(id: string, userId: string): Promise<boolean>;
}
