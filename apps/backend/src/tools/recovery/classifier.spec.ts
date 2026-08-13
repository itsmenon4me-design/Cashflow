import { classifyRecord } from './classifier';

describe('recovery classifier - pure classifyRecord', () => {
  test('non-IDR currency is SAFE', () => {
    const res = classifyRecord(100000n, 'USD', [], null, new Date(), 'tx1');
    expect(res.classification).toBe('SAFE');
    expect(res.confidence).toBe('HIGH');
  });

  test('IDR amount not divisible by 100 is SAFE', () => {
    const res = classifyRecord(123n, 'IDR', [], null, new Date(), 'tx1');
    expect(res.classification).toBe('SAFE');
  });

  test('IDR divisible by 100 with peer within 2 minutes -> LIKELY_CORRUPTED', () => {
    const stored = 10000000n; // buggy scaled value
    const candidate = stored / 100n; // 100000n
    const peers = [
      {
        id: 'peer1',
        amount: candidate,
        created_at: new Date(Date.now() - 30 * 1000),
      }, // 30s earlier
    ];
    const res = classifyRecord(
      stored,
      'IDR',
      peers,
      null,
      new Date(),
      'tx-buggy',
    );
    expect(res.classification).toBe('LIKELY_CORRUPTED');
    expect(res.proposed).toBe(candidate);
    expect(res.confidence).toBe('HIGH');
  });

  test('IDR divisible by 100 with account opening equal candidate -> LIKELY_CORRUPTED', () => {
    const stored = 5000000n; // buggy scaled value
    const candidate = stored / 100n; // 50000n
    const peers: Array<any> = [];
    const res = classifyRecord(
      stored,
      'IDR',
      peers,
      candidate,
      new Date(),
      'tx2',
    );
    expect(res.classification).toBe('LIKELY_CORRUPTED');
    expect(res.proposed).toBe(candidate);
    expect(res.confidence).toBe('MEDIUM');
  });

  test('IDR divisible by 100 without evidence -> SUSPICIOUS', () => {
    const stored = 7000000n;
    const res = classifyRecord(stored, 'IDR', [], null, new Date(), 'tx3');
    expect(res.classification).toBe('SUSPICIOUS');
    expect(res.confidence).toBe('LOW');
  });
});
