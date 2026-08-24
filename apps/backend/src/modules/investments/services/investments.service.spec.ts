import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { PrismaInvestmentsRepository } from '../repositories/prisma-investments.repository';
import { UserSettingsService } from '../../settings/services/user-settings.service';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { PrismaService } from '../../../database/prisma.service';
import { InvestmentEntity } from '../entities/investment.entity';

const dummy = (
  id: string,
  overrides: Partial<InvestmentEntity> = {},
): InvestmentEntity => ({
  id,
  user_id: 'u1',
  account_id: null,
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
  let prismaMock: { account: { findUnique: jest.Mock } };

  beforeEach(async () => {
    repoMock = {
      findById: jest.fn().mockResolvedValue(dummy('i1')),
      findAllByUser: jest.fn().mockResolvedValue([dummy('i1'), dummy('i2')]),
      create: jest.fn().mockResolvedValue(dummy('i1')),
      update: jest.fn().mockResolvedValue(dummy('i1')),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    prismaMock = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        { provide: PrismaInvestmentsRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: UserSettingsService,
          useValue: { getSettings: jest.fn().mockResolvedValue({ currency: 'IDR' }) },
        },
      ],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
  });

  it('lists investments', async () => {
    const items = await service.listAll('u1');
    expect(items).toHaveLength(2);
    expect(repoMock.findAllByUser).toHaveBeenCalledWith('u1', undefined);
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
        invested_amount_cents: BigInt(5000000),
        current_value_cents: BigInt(6000000),
        profit_loss_cents: BigInt(1000000),
      }),
    );
  });

  it('computes derived values on create (USD account, x100)', async () => {
    prismaMock.account.findUnique.mockResolvedValue({
      id: 'a1',
      currency: 'USD',
      user_id: 'u1',
    });
    await service.create('u1', {
      account_id: 'a1',
      name: 'AAPL',
      platform: 'NASDAQ',
      investment_type: 'Stock',
      quantity: 10,
      average_buy_price: 137.59,
      current_price: 150.25,
      purchase_date: '2026-01-01',
      status: 'ACTIVE',
    });
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invested_amount_cents: BigInt(137590),
        current_value_cents: BigInt(150250),
        profit_loss_cents: BigInt(12660),
      }),
    );
  });

  it('accepts and stores investment currency', async () => {
    repoMock.create.mockResolvedValue(dummy('i1', { currency: 'SGD' }));
    await service.create('u1', {
      name: 'AAPL',
      platform: 'NASDAQ',
      investment_type: 'Stock',
      quantity: 10,
      average_buy_price: 137.59,
      current_price: 150.25,
      currency: 'SGD',
      purchase_date: '2026-01-01',
      status: 'ACTIVE',
    });
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'SGD' }),
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
