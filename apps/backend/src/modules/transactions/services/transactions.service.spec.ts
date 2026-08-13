import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { TransactionValidationService } from './validation/transaction-validation.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BalanceService } from '../../accounts/services/balance.service';
import { FinanceBotService } from '../../finance-bot/services/finance-bot.service';

const dummyTx = (id: string) => ({
  id,
  user_id: 'u1',
  account_id: 'a1',
  category_id: 'c1',
  transaction_type: 'INCOME',
  amount_cents: BigInt(1000),
  transaction_date: new Date(),
  note: null,
  created_at: new Date(),
});

describe('TransactionsService (filter & pagination & search)', () => {
  let service: TransactionsService;
  let repoMock: Partial<PrismaTransactionsRepository> & {
    findByUserWithFilter: jest.Mock;
    searchByUser?: jest.Mock;
  };

  beforeEach(async () => {
    repoMock = {
      findByUserWithFilter: jest
        .fn()
        .mockResolvedValue({ items: [dummyTx('t1'), dummyTx('t2')], total: 2 }),
      searchByUser: jest
        .fn()
        .mockResolvedValue({ items: [dummyTx('s1')], total: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaTransactionsRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        {
          provide: TransactionValidationService,
          useValue: {
            validateForCreate: jest.fn(),
            validateForUpdate: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn() },
        },
        {
          provide: BalanceService,
          useValue: { recalculateAccount: jest.fn() },
        },
        {
          provide: FinanceBotService,
          useValue: { evaluateOnTransaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('computes pagination correctly', async () => {
    const res = await service.listAll(
      'u1',
      { accountId: 'a1' },
      {
        page: 1,
        limit: 20,
      },
    );
    expect(res.data).toHaveLength(2);
    expect(res.pagination.totalItems).toBe(2);
    expect(res.pagination.page).toBe(1);
    expect(res.pagination.limit).toBe(20);
    expect(repoMock.findByUserWithFilter).toHaveBeenCalledWith(
      'u1',
      { accountId: 'a1' },
      { page: 1, limit: 20 },
    );
  });

  it('handles empty results', async () => {
    (repoMock.findByUserWithFilter as jest.Mock).mockResolvedValueOnce({
      items: [],
      total: 0,
    });
    const res = await service.listAll('u1', {}, { page: 1, limit: 20 });
    expect(res.data).toHaveLength(0);
    expect(res.pagination.totalItems).toBe(0);
    expect(res.pagination.totalPages).toBe(1);
  });

  it('searches by keyword', async () => {
    const res = await service.search('u1', 'food', { page: 1, limit: 20 });
    expect(res.data).toHaveLength(1);
    expect(res.pagination.totalItems).toBe(1);
    expect(repoMock.searchByUser).toHaveBeenCalledWith('u1', 'food', {
      page: 1,
      limit: 20,
    });
  });

  it('creates a transaction and invokes Finance Bot evaluation without blocking', async () => {
    const createdTransaction = dummyTx('t3');
    repoMock.create = jest.fn().mockResolvedValue(createdTransaction);
    const auditMock = { record: jest.fn() };
    const validatorMock = { validateForCreate: jest.fn(), validateForUpdate: jest.fn() };
    const notificationsMock = { create: jest.fn() };
    const balanceMock = { recalculateAccount: jest.fn() };
    const financeBotMock = {
      evaluateOnTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as FinanceBotService;

    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaTransactionsRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: auditMock },
        { provide: TransactionValidationService, useValue: validatorMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: BalanceService, useValue: balanceMock },
        { provide: FinanceBotService, useValue: financeBotMock },
      ],
    }).compile();

    const serviceWithFinanceBot = module.get<TransactionsService>(TransactionsService);
    const result = await serviceWithFinanceBot.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: 'EXPENSE',
      amount_cents: BigInt(1000),
      transaction_date: new Date('2026-08-09T12:00:00Z'),
    });

    expect(result).toEqual(createdTransaction);
    expect(financeBotMock.evaluateOnTransaction).toHaveBeenCalledWith(
      'u1',
      createdTransaction,
    );
  });

  it('rejects decimal amount representations before persistence', async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaTransactionsRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        {
          provide: TransactionValidationService,
          useValue: { validateForCreate: jest.fn(), validateForUpdate: jest.fn() },
        },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: BalanceService, useValue: { recalculateAccount: jest.fn() } },
        { provide: FinanceBotService, useValue: { evaluateOnTransaction: jest.fn() } },
      ],
    }).compile();

    const serviceWithValidation = module.get<TransactionsService>(TransactionsService);

    await expect(
      serviceWithValidation.create('u1', {
        account_id: 'a1',
        category_id: 'c1',
        transaction_type: 'EXPENSE',
        amount_cents: 10.5 as unknown as bigint,
        transaction_date: new Date('2026-08-09T12:00:00Z'),
      }),
    ).rejects.toThrow('whole integer cent value');
  });

  it('records request correlation ids and anomaly metadata for suspicious scale patterns', async () => {
    const createdTransaction = dummyTx('t3');
    repoMock.create = jest.fn().mockResolvedValue(createdTransaction);
    repoMock.findByUserWithFilter = jest.fn().mockResolvedValue({
      items: [{ ...dummyTx('t-prev'), amount_cents: BigInt(100000000) }],
      total: 1,
    });
    const auditMock = { record: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaTransactionsRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: auditMock },
        {
          provide: TransactionValidationService,
          useValue: { validateForCreate: jest.fn(), validateForUpdate: jest.fn() },
        },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: BalanceService, useValue: { recalculateAccount: jest.fn() } },
        { provide: FinanceBotService, useValue: { evaluateOnTransaction: jest.fn() } },
      ],
    }).compile();

    const serviceWithTrace = module.get<TransactionsService>(TransactionsService);
    await serviceWithTrace.create(
      'u1',
      {
        account_id: 'a1',
        category_id: 'c1',
        transaction_type: 'EXPENSE',
        amount_cents: BigInt(1000000),
        transaction_date: new Date('2026-08-09T12:00:00Z'),
      },
      { correlationId: 'corr-123', requestId: 'req-456' },
    );

    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          correlationId: 'corr-123',
          requestId: 'req-456',
          amountCents: '1000000',
          anomalyCode: 'AMOUNT_SCALE_ANOMALY',
        }),
      }),
    );
  });
});
