import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { TransactionValidationService } from './validation/transaction-validation.service';

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
});
