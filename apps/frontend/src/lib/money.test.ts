import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  toMajorUnits,
  parseMoneyInput,
  formatMoneyFromMinorUnits,
  formatCurrency,
  getCurrencySpec,
  extractDigits,
  formatRupiah,
} from './money';

describe('Currency Specifications', () => {
  it('should define IDR with 0 minor units (no cents)', () => {
    const spec = getCurrencySpec('IDR');
    expect(spec.minorUnits).toBe(0);
    expect(spec.code).toBe('IDR');
  });

  it('should default to IDR for undefined currency', () => {
    const spec = getCurrencySpec(undefined);
    expect(spec.code).toBe('IDR');
  });
});

describe('toMinorUnits - Currency-Aware Conversion', () => {
  describe('IDR - No decimal places (THE FIX)', () => {
    it('should NOT multiply IDR by 100 (this was the bug)', () => {
      // Bug: 1000000 * 100 = 100000000 (WRONG)
      // Fix: 1000000 * 1 = 1000000 (CORRECT)
      expect(toMinorUnits(1000000, 'IDR')).toBe(1000000);
    });

    it('should handle arbitrary IDR values exactly', () => {
      expect(toMinorUnits(1, 'IDR')).toBe(1);
      expect(toMinorUnits(137, 'IDR')).toBe(137);
      expect(toMinorUnits(500, 'IDR')).toBe(500);
      expect(toMinorUnits(1237, 'IDR')).toBe(1237);
      expect(toMinorUnits(2483, 'IDR')).toBe(2483);
      expect(toMinorUnits(17391, 'IDR')).toBe(17391);
      expect(toMinorUnits(999999, 'IDR')).toBe(999999);
      expect(toMinorUnits(1234567, 'IDR')).toBe(1234567);
      expect(toMinorUnits(99999999, 'IDR')).toBe(99999999);
      expect(toMinorUnits(123456789, 'IDR')).toBe(123456789);
    });
  });
});

describe('toMajorUnits - Reverse Conversion', () => {
  describe('IDR', () => {
    it('should NOT divide IDR by 100', () => {
      expect(toMajorUnits(1000000, 'IDR')).toBe(1000000);
      expect(toMajorUnits(1234567, 'IDR')).toBe(1234567);
    });

    it('should handle BigInt for IDR', () => {
      expect(toMajorUnits(BigInt(1000000), 'IDR')).toBe(1000000);
      expect(toMajorUnits(BigInt(123456789), 'IDR')).toBe(123456789);
    });
  });
});

describe('Roundtrip: parse → store → display', () => {
  describe('IDR roundtrip', () => {
    it('should preserve IDR values without 100x bug', () => {
      // This was the original bug - now fixed
      const input = 1000000;
      const stored = toMinorUnits(input, 'IDR');
      expect(stored).toBe(1000000); // NOT 100000000
      const displayed = toMajorUnits(stored, 'IDR');
      expect(displayed).toBe(input);
    });

    it('should handle arbitrary IDR roundtrips', () => {
      const testCases = [1, 137, 500, 1237, 2483, 17391, 999999, 1000000, 1234567];
      for (const original of testCases) {
        const stored = toMinorUnits(original, 'IDR');
        const displayed = toMajorUnits(stored, 'IDR');
        expect(displayed).toBe(original);
      }
    });
  });
});

describe('Arithmetic Invariants', () => {
  describe('IDR arithmetic (exact)', () => {
    it('should satisfy a + b - b = a', () => {
      const a = 1000000;
      const b = 500000;
      const result = a + b - b;
      expect(result).toBe(a);
    });

    it('should satisfy a - a = 0', () => {
      expect(1000000 - 1000000).toBe(0);
    });

    it('should satisfy (a + b) + c = a + (b + c)', () => {
      const a = 1000000;
      const b = 500000;
      const c = 234567;
      expect((a + b) + c).toBe(a + (b + c));
    });

    it('should handle multiple transactions correctly', () => {
      const opening = 5000000; // 5M IDR
      const income1 = 1000000;
      const expense1 = 300000;
      const income2 = 2000000;
      const expense2 = 1500000;

      const balance = opening + income1 - expense1 + income2 - expense2;
      expect(balance).toBe(6200000); // 5M + 1M - 300K + 2M - 1.5M = 6.2M
    });
  });
});

describe('Parsing', () => {
  describe('IDR parsing', () => {
    it('should parse IDR input formats', () => {
      expect(parseMoneyInput('1000000', 'IDR')).toBe(1000000);
      expect(parseMoneyInput('1.000.000', 'IDR')).toBe(1000000);
      expect(parseMoneyInput('Rp1.000.000', 'IDR')).toBe(1000000);
    });
  });
});

describe('Formatting', () => {
  describe('formatMoneyFromMinorUnits', () => {
    it('should format IDR correctly from minor units', () => {
      const formatted = formatMoneyFromMinorUnits(1000000, 'IDR');
      expect(formatted).toContain('1');
      expect(formatted).toContain('000');
    });

    it('should handle string input', () => {
      const formatted = formatMoneyFromMinorUnits('1000000', 'IDR');
      expect(formatted).toBeTruthy();
    });

    it('should handle BigInt input', () => {
      const formatted = formatMoneyFromMinorUnits(BigInt(1000000), 'IDR');
      expect(formatted).toBeTruthy();
    });
  });

  describe('formatCurrency', () => {
    it('should format major units correctly', () => {
      const formatted = formatCurrency(1000000, 'IDR');
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('1');
    });
  });
});

describe('Utility Functions', () => {
  describe('extractDigits', () => {
    it('should extract only digits', () => {
      expect(extractDigits('Rp1.000.000')).toBe('1000000');
    });

    it('should handle empty input', () => {
      expect(extractDigits('')).toBe('');
      expect(extractDigits('   ')).toBe('');
    });
  });

  describe('formatRupiah', () => {
    it('should format with dots as separators', () => {
      expect(formatRupiah('1000000')).toBe('1.000.000');
      expect(formatRupiah('123')).toBe('123');
      expect(formatRupiah('1234567')).toBe('1.234.567');
    });

    it('should handle empty input', () => {
      expect(formatRupiah('')).toBe('');
    });
  });
});

describe('EXPECTED EXAMPLES — exact minor-unit conversion', () => {
  describe('IDR (x1, no decimals)', () => {
    const cases: Array<[number, number]> = [
      [1, 1],
      [17, 17],
      [999, 999],
      [1000, 1000],
      [1001, 1001],
      [1234567, 1234567],
    ];
    it('maps major units directly to minor units', () => {
      for (const [major, minor] of cases) {
        expect(toMinorUnits(major, 'IDR')).toBe(minor);
      }
    });
  });

  it('REGRESSION: 1,000,000 IDR must be 1,000,000n, never 100,000,000n', () => {
    expect(toMinorUnits(1000000, 'IDR')).toBe(1000000);
    expect(toMinorUnits(1000000, 'IDR')).not.toBe(100000000);
  });

  it('zero maps to zero minor units', () => {
    expect(toMinorUnits(0, 'IDR')).toBe(0);
  });

  it('negative values are preserved (not silently zeroed or flipped)', () => {
    expect(toMinorUnits(-1, 'IDR')).toBe(-1);
    expect(toMinorUnits(-1234, 'IDR')).toBe(-1234);
  });

  it('random non-round values survive parse -> minor -> major -> parse', () => {
    const idr = [7, 42, 731, 12345, 999999, 1234567, 99999999];
    for (const v of idr) {
      const minor = toMinorUnits(v, 'IDR');
      expect(minor).toBe(v);
      expect(toMajorUnits(minor, 'IDR')).toBe(v);
    }
  });
});

describe('parseMoneyInput currency-aware parsing', () => {
  it('parses IDR with dots or commas as grouping separators', () => {
    expect(parseMoneyInput('1.000.000', 'IDR')).toBe(1000000);
    expect(parseMoneyInput('1,000,000', 'IDR')).toBe(1000000);
    expect(parseMoneyInput('1.234.567', 'IDR')).toBe(1234567);
    expect(parseMoneyInput('1000000', 'IDR')).toBe(1000000);
  });

  it('handles zero input', () => {
    expect(parseMoneyInput('0', 'IDR')).toBe(0);
  });
});

describe('round-trip: parse -> minor units -> format -> parse', () => {
  it('IDR 1,000,000 round-trips without the 100x bug', () => {
    const minor = toMinorUnits(parseMoneyInput('1.000.000', 'IDR'), 'IDR');
    expect(minor).toBe(1000000);
    const formatted = formatMoneyFromMinorUnits(minor, 'IDR');
    expect(parseMoneyInput(formatted, 'IDR')).toBe(1000000);
  });
});

describe('arithmetic invariants', () => {
  it('IDR integer arithmetic is exact', () => {
    const opening = toMinorUnits(5000000, 'IDR');
    const income = toMinorUnits(1000000, 'IDR');
    const expense = toMinorUnits(300000, 'IDR');
    const balance = opening + income - expense;
    expect(balance).toBe(5700000);
  });
});

describe('The Bug: 1,000,000 IDR → 100,000,000 IDR', () => {
  it('should demonstrate the old bug (for regression testing)', () => {
    // This is what the OLD code would do (WRONG)
    const oldBuggyMultiplier = 100;
    const userInput = 1000000;
    const buggyResult = userInput * oldBuggyMultiplier;
    expect(buggyResult).toBe(100000000); // BUG!

    // This is what the FIXED code does (CORRECT)
    const spec = getCurrencySpec('IDR');
    const fixedMultiplier = Math.pow(10, spec.minorUnits); // 10^0 = 1
    const fixedResult = userInput * fixedMultiplier;
    expect(fixedResult).toBe(1000000); // CORRECT!

    // Verify the fix
    expect(toMinorUnits(userInput, 'IDR')).toBe(fixedResult);
  });
});
