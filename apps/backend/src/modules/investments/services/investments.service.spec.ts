import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { PrismaInvestmentsRepository } from '../repositories/prisma-investments.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { InvestmentEntity } from '../entities/investment.entity';

const dummy = (
  id: string,
  overrides: Partial<InvestmentEntity> = {},
): InvestmentEntity => ({
  id,
  user_id: 'u1',
  investment_type: 'Stock',
  platform: 'IDX',
  name: 'BBRI',
  symbol: 'BBRI',
  quantity: '100',
  average_buy_price: '50000',
  current_price: '60000',
  invested_amount_cents: BigInt(5000000),
  current_value_cents: BigInt(6000000),
  profit_loss_cents: BigInt(1000000),
  profit_loss_percentage: '20.00',
  purchase_date: new Date('2026-01-01'),
  notes: null,
  status: 'ACTIVE',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  let repoMock: Partial<PrismaInvestmentsRepository> & {
    findById: jest.Mock;
    findAllByUser: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  beforeEach(async () => {
    repoMock = {
      findById: jest.fn().mockResolvedValue(dummy('i1')),
      findAllByUser: jest.fn().mockResolvedValue([dummy('i1'), dummy('i2')]),
      create: jest.fn().mockResolvedValue(dummy('i1')),
      update: jest.fn().mockResolvedValue(dummy('i1')),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        { provide: PrismaInvestmentsRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
  });

  it('lists investments', async () => {
    const items = await service.listAll('u1');
    expect(items).toHaveLength(2);
    expect(repoMock.findAllByUser).toHaveBeenCalledWith('u1');
  });

  it('denies access to another user investment', async () => {
    repoMock.findById.mockResolvedValue(
      dummy('i1', { user_id: 'someone-else' }),
    );
    await expect(service.getById('u1', 'i1')).rejects.toThrow();
  });

  it('computes derived values on create (IDR account, x1)', async () => {
    await service.create('u1', {
      name: 'BBRI',
      platform: 'IDX',
      investment_type: 'Stock',
      quantity: 100,
      average_buy_price: 50000,
      current_price: 60000,
      purchase_date: '2026-01-01',
      status: 'ACTIVE',
    });
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'IDR',
        invested_amount_cents: BigInt(5000000),
        current_value_cents: BigInt(6000000),
        profit_loss_cents: BigInt(1000000),
      }),
    );
  });

  it('computes overview totals & allocation', async () => {
    repoMock.findAllByUser.mockResolvedValue([
      dummy('i1', {
        investment_type: 'Stock',
        invested_amount_cents: BigInt(5000000),
        current_value_cents: BigInt(6000000),
        profit_loss_cents: BigInt(1000000),
      }),
      dummy('i2', {
        investment_type: 'Gold',
        invested_amount_cents: BigInt(2000000),
        current_value_cents: BigInt(1800000),
        profit_loss_cents: BigInt(-200000),
      }),
    ]);
    const overview = await service.overview('u1');
    expect(overview.totalInvested).toBe('7000000');
    expect(overview.totalValue).toBe('7800000');
    expect(overview.totalProfit).toBe('1000000');
    expect(overview.totalLoss).toBe('200000');
    expect(overview.allocation).toHaveLength(2);
  });
});
