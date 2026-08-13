import { HistoricalDataAuditService } from './historical-data-audit.service';

describe('HistoricalDataAuditService', () => {
  it('does not flag clean data as suspicious', () => {
    const service = new HistoricalDataAuditService();
    const report = service.auditFinancialDataset({
      accounts: [
        {
          id: 'acc-1',
          user_id: 'user-1',
          currency: 'IDR',
          opening_balance_cents: 1000000,
          current_balance_cents: 1400000,
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          user_id: 'user-1',
          account_id: 'acc-1',
          currency: 'IDR',
          amount_cents: 500000,
          transaction_type: 'INCOME',
          transaction_date: '2026-01-01',
        },
        {
          id: 'tx-2',
          user_id: 'user-1',
          account_id: 'acc-1',
          currency: 'IDR',
          amount_cents: 100000,
          transaction_type: 'EXPENSE',
          transaction_date: '2026-01-02',
        },
      ],
    });

    expect(report.findings).toEqual([]);
    expect(report.balance_discrepancies).toEqual([]);
  });

  it('accepts valid IDR and decimal-currency references without false positives', () => {
    const service = new HistoricalDataAuditService();
    const report = service.auditFinancialDataset({
      accounts: [
        {
          id: 'acc-idr',
          user_id: 'u1',
          currency: 'IDR',
          opening_balance_cents: 1000000,
          current_balance_cents: 619,
        },
        {
          id: 'acc-usd',
          user_id: 'u1',
          currency: 'USD',
          opening_balance_cents: 10000,
          current_balance_cents: 10023,
        },
      ],
      transactions: [
        {
          id: 'tid-1',
          user_id: 'u1',
          account_id: 'acc-idr',
          currency: 'IDR',
          amount_cents: 1,
          transaction_type: 'INCOME',
          transaction_date: '2026-02-01',
        },
        {
          id: 'tid-2',
          user_id: 'u1',
          account_id: 'acc-idr',
          currency: 'IDR',
          amount_cents: 17,
          transaction_type: 'EXPENSE',
          transaction_date: '2026-02-02',
        },
        {
          id: 'tid-3',
          user_id: 'u1',
          account_id: 'acc-idr',
          currency: 'IDR',
          amount_cents: 137,
          transaction_type: 'INCOME',
          transaction_date: '2026-02-03',
        },
        {
          id: 'tid-4',
          user_id: 'u1',
          account_id: 'acc-idr',
          currency: 'IDR',
          amount_cents: 501,
          transaction_type: 'EXPENSE',
          transaction_date: '2026-02-04',
        },
        {
          id: 'tid-5',
          user_id: 'u1',
          account_id: 'acc-idr',
          currency: 'IDR',
          amount_cents: 999,
          transaction_type: 'INCOME',
          transaction_date: '2026-02-05',
        },
        {
          id: 'tid-6',
          user_id: 'u1',
          account_id: 'acc-idr',
          currency: 'IDR',
          amount_cents: 1000000,
          transaction_type: 'EXPENSE',
          transaction_date: '2026-02-06',
        },
        {
          id: 'tid-7',
          user_id: 'u1',
          account_id: 'acc-usd',
          currency: 'USD',
          amount_cents: 123,
          transaction_type: 'INCOME',
          transaction_date: '2026-02-07',
        },
        {
          id: 'tid-8',
          user_id: 'u1',
          account_id: 'acc-usd',
          currency: 'USD',
          amount_cents: 100,
          transaction_type: 'EXPENSE',
          transaction_date: '2026-02-08',
        },
      ],
    });

    expect(report.findings.filter((f) => f.status !== 'SAFE')).toHaveLength(0);
  });

  it('detects mixed currency aggregation in the same account and period', () => {
    const service = new HistoricalDataAuditService();
    const report = service.auditFinancialDataset({
      accounts: [
        {
          id: 'acc-mixed',
          user_id: 'u2',
          currency: 'IDR',
          opening_balance_cents: 0,
          current_balance_cents: 0,
        },
      ],
      transactions: [
        {
          id: 'm-1',
          user_id: 'u2',
          account_id: 'acc-mixed',
          currency: 'USD',
          amount_cents: 100,
          transaction_type: 'INCOME',
          transaction_date: '2026-03-01',
        },
        {
          id: 'm-2',
          user_id: 'u2',
          account_id: 'acc-mixed',
          currency: 'IDR',
          amount_cents: 100,
          transaction_type: 'INCOME',
          transaction_date: '2026-03-01',
        },
      ],
    });

    expect(
      report.findings.some((f) => f.entity_type === 'account-aggregation'),
    ).toBe(true);
  });

  it('detects balance discrepancies without mutating historical records', () => {
    const service = new HistoricalDataAuditService();
    const report = service.auditFinancialDataset({
      accounts: [
        {
          id: 'acc-bal',
          user_id: 'u3',
          currency: 'IDR',
          opening_balance_cents: 1000,
          current_balance_cents: 1500,
        },
      ],
      transactions: [
        {
          id: 'bal-1',
          user_id: 'u3',
          account_id: 'acc-bal',
          currency: 'IDR',
          amount_cents: 300,
          transaction_type: 'INCOME',
          transaction_date: '2026-04-01',
        },
        {
          id: 'bal-2',
          user_id: 'u3',
          account_id: 'acc-bal',
          currency: 'IDR',
          amount_cents: 200,
          transaction_type: 'EXPENSE',
          transaction_date: '2026-04-02',
        },
      ],
    });

    expect(report.balance_discrepancies).toHaveLength(1);
    expect(report.findings.some((f) => f.entity_type === 'account')).toBe(true);
  });

  it('detects transfer mismatch and cross-currency transfer anomalies', () => {
    const service = new HistoricalDataAuditService();
    const report = service.auditFinancialDataset({
      accounts: [
        {
          id: 'src',
          user_id: 'u4',
          currency: 'USD',
          opening_balance_cents: 0,
          current_balance_cents: 0,
        },
        {
          id: 'dst',
          user_id: 'u4',
          currency: 'IDR',
          opening_balance_cents: 0,
          current_balance_cents: 0,
        },
      ],
      transfers: [
        {
          id: 'tr-1',
          user_id: 'u4',
          source_account_id: 'src',
          destination_account_id: 'dst',
          amount_cents: 100,
          source_currency: 'USD',
          destination_currency: 'IDR',
          transfer_group_id: 'group-z',
        },
        {
          id: 'tr-2',
          user_id: 'u4',
          source_account_id: 'src',
          destination_account_id: 'dst',
          amount_cents: 75,
          source_currency: 'USD',
          destination_currency: 'IDR',
          transfer_group_id: 'group-z',
        },
      ],
    });

    expect(report.findings.some((f) => f.entity_type === 'transfer')).toBe(
      true,
    );
  });

  it('keeps BigInt precision exact for values beyond MAX_SAFE_INTEGER', () => {
    const service = new HistoricalDataAuditService();
    const serviceWithBigInt = service as unknown as {
      normalizeBigInt: (value: string) => bigint;
    };
    const normalized = serviceWithBigInt.normalizeBigInt('9007199254740993');
    expect(normalized).toBe(BigInt('9007199254740993'));
    expect(normalized).not.toBe(BigInt('9007199254740992'));
    expect(normalized).not.toBe(BigInt('9007199254740991'));
  });

  it('exposes read-only audit contract in case of accidental write attempts', () => {
    expect(HistoricalDataAuditService.FORBIDDEN_WRITE_OPERATIONS).toContain(
      'update',
    );
    expect(HistoricalDataAuditService.FORBIDDEN_WRITE_OPERATIONS).toContain(
      'deleteMany',
    );
    expect(HistoricalDataAuditService.FORBIDDEN_WRITE_OPERATIONS).toContain(
      '$executeRawUnsafe',
    );
  });
});
