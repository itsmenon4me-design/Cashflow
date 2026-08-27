import { InvestmentEntity } from '../entities/investment.entity';

export interface IInvestmentsRepository {
  findById(id: string): Promise<InvestmentEntity | null>;
  findAllByUser(userId: string): Promise<InvestmentEntity[]>;
  create(input: Partial<InvestmentEntity>): Promise<InvestmentEntity>;
  update(
    id: string,
    updates: Partial<InvestmentEntity>,
  ): Promise<InvestmentEntity>;
  softDelete(id: string): Promise<void>;
}
