import { TransactionsService } from './services/transactions.service';

describe('Transactions Regression - currency scoping', () => {
  let repoMock: any;
  let svc: TransactionsService;

  beforeEach(() => {
    repoMock = {
      findByUserWithFilter: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      searchByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    // minimal deps for TransactionsService constructor
    svc = new TransactionsService(repoMock as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  });

  it('passes currency to findByUserWithFilter when listing', async () => {
    await svc.listAll('u1', { accountId: 'a1', currency: 'USD' } as any, { page: 1, limit: 10 });
    expect(repoMock.findByUserWithFilter).toHaveBeenCalledWith('u1', expect.objectContaining({ accountId: 'a1', currency: 'USD' }), expect.any(Object));
  });

  it('passes currency to searchByUser when searching', async () => {
    await svc.search('u1', 'food', { page: 1, limit: 20 }, 'SGD');
    expect(repoMock.searchByUser).toHaveBeenCalledWith('u1', 'food', expect.any(Object), 'SGD');
  });
});
