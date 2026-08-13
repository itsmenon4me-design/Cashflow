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

  it('should define USD with 2 minor units (cents)', () => {
    const spec = getCurrencySpec('USD');
    expect(spec.minorUnits).toBe(2);
  });

  it('should define SGD with 2 minor units (cents)', () => {
    const spec = getCurrencySpec('SGD');
    expect(spec.minorUnits).toBe(2);
  });

  it('should define EUR with 2 minor units (cents)', () => {
    const spec = getCurrencySpec('EUR');
    expect(spec.minorUnits).toBe(2);
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

  describe('USD - 2 decimal places', () => {
    it('should multiply USD by 100 to convert to cents', () => {
      expect(toMinorUnits(1.23, 'USD')).toBe(123);
      expect(toMinorUnits(0.01, 'USD')).toBe(1);
      expect(toMinorUnits(100.00, 'USD')).toBe(10000);
    });

    it('should handle arbitrary USD values', () => {
      expect(toMinorUnits(0, 'USD')).toBe(0);
      expect(toMinorUnits(1, 'USD')).toBe(100);
      expect(toMinorUnits(1.25, 'USD')).toBe(125);
      expect(toMinorUnits(137.47, 'USD')).toBe(13747);
      expect(toMinorUnits(2483.19, 'USD')).toBe(248319);
      expect(toMinorUnits(99999.99, 'USD')).toBe(9999999);
    });
  });

  describe('SGD - 2 decimal places', () => {
    it('should handle SGD values correctly', () => {
      expect(toMinorUnits(1.25, 'SGD')).toBe(125);
      expect(toMinorUnits(137.47, 'SGD')).toBe(13747);
      expect(toMinorUnits(8765.43, 'SGD')).toBe(876543);
    });
  });

  describe('EUR - 2 decimal places', () => {
    it('should handle EUR values correctly', () => {
      expect(toMinorUnits(1.25, 'EUR')).toBe(125);
      expect(toMinorUnits(137.47, 'EUR')).toBe(13747);
      expect(toMinorUnits(17391.83, 'EUR')).toBe(1739183);
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

  describe('USD', () => {
    it('should divide USD by 100 to get dollars', () => {
      expect(toMajorUnits(123, 'USD')).toBe(1.23);
      expect(toMajorUnits(10000, 'USD')).toBe(100);
      expect(toMajorUnits(1, 'USD')).toBe(0.01);
    });

    it('should handle BigInt for USD', () => {
      expect(toMajorUnits(BigInt(123), 'USD')).toBe(1.23);
      expect(toMajorUnits(BigInt(13747), 'USD')).toBe(137.47);
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

  describe('USD roundtrip', () => {
    it('should preserve USD values through roundtrip', () => {
      const input = 1.23;
      const stored = toMinorUnits(input, 'USD');
      const displayed = toMajorUnits(stored, 'USD');
      expect(displayed).toBeCloseTo(input, 2);
    });

    it('should handle arbitrary USD roundtrips', () => {
      const testCases = [0.01, 1.25, 137.47, 2483.19];
      for (const original of testCases) {
        const stored = toMinorUnits(original, 'USD');
        const displayed = toMajorUnits(stored, 'USD');
        expect(displayed).toBeCloseTo(original, 2);
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

  describe('USD arithmetic (decimal)', () => {
    it('should preserve precision with cents', () => {
      // Convert to cents for exact arithmetic
      const a = toMinorUnits(1.25, 'USD');
      const b = toMinorUnits(2.75, 'USD');
      const sum = a + b;
      const result = toMajorUnits(sum, 'USD');
      expect(result).toBe(4.00);
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

  describe('USD parsing with English locale', () => {
    it('should parse USD input formats (en-US)', () => {
      expect(parseMoneyInput('1234.56', 'USD', 'en-US')).toBe(1234.56);
      expect(parseMoneyInput('1,234.56', 'USD', 'en-US')).toBe(1234.56);
      expect(parseMoneyInput('$1,234.56', 'USD', 'en-US')).toBe(1234.56);
    });
  });

  describe('EUR parsing with German locale', () => {
    it('should parse EUR input formats (de-DE)', () => {
      expect(parseMoneyInput('1234,56', 'EUR', 'de-DE')).toBe(1234.56);
      expect(parseMoneyInput('1.234,56', 'EUR', 'de-DE')).toBe(1234.56);
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

    it('should format USD correctly from minor units (cents)', () => {
      const formatted = formatMoneyFromMinorUnits(12345, 'USD');
      expect(formatted).toContain('123');
      expect(formatted).toContain('45');
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
      expect(extractDigits('$1,234.56')).toBe('123456');
      expect(extractDigits('€12.345,67')).toBe('1234567');
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

  describe('USD (x100, 2 decimals)', () => {
    const cases: Array<[number, number]> = [
      [0.01, 1],
      [0.07, 7],
      [1.01, 101],
      [1.23, 123],
      [17.47, 1747],
      [137.59, 13759],
      [999.91, 99991],
      [1000000.99, 100000099],
    ];
    it('maps dollars and cents to cents exactly', () => {
      for (const [major, minor] of cases) {
        expect(toMinorUnits(major, 'USD')).toBe(minor);
      }
    });
  });

  describe('SGD and EUR (x100, 2 decimals)', () => {
    it('maps SGD exactly', () => {
      expect(toMinorUnits(137.59, 'SGD')).toBe(13759);
      expect(toMinorUnits(999.91, 'SGD')).toBe(99991);
      expect(toMinorUnits(1, 'SGD')).toBe(100);
    });
    it('maps EUR exactly', () => {
      expect(toMinorUnits(137.59, 'EUR')).toBe(13759);
      expect(toMinorUnits(999.91, 'EUR')).toBe(99991);
      expect(toMinorUnits(1, 'EUR')).toBe(100);
    });
  });

  it('REGRESSION: 1,000,000 IDR must be 1,000,000n, never 100,000,000n', () => {
    expect(toMinorUnits(1000000, 'IDR')).toBe(1000000);
    expect(toMinorUnits(1000000, 'IDR')).not.toBe(100000000);
  });

  it('zero maps to zero minor units for every currency', () => {
    for (const currency of ['IDR', 'USD', 'SGD', 'EUR']) {
      expect(toMinorUnits(0, currency)).toBe(0);
    }
  });

  it('negative values are preserved (not silently zeroed or flipped)', () => {
    expect(toMinorUnits(-1, 'IDR')).toBe(-1);
    expect(toMinorUnits(-1234, 'IDR')).toBe(-1234);
    expect(toMinorUnits(-1.23, 'USD')).toBe(-123);
    expect(toMinorUnits(-137.59, 'USD')).toBe(-13759);
  });

  it('random non-round values survive parse -> minor -> major -> parse', () => {
    const idr = [7, 42, 731, 12345, 999999, 1234567, 99999999];
    for (const v of idr) {
      const minor = toMinorUnits(v, 'IDR');
      expect(minor).toBe(v);
      expect(toMajorUnits(minor, 'IDR')).toBe(v);
    }

    const decimals = [0.01, 0.07, 1.01, 1.23, 17.47, 137.59, 999.91, 1000000.99];
    for (const v of decimals) {
      const minor = toMinorUnits(v, 'USD');
      const back = toMajorUnits(minor, 'USD');
      expect(minor).toBe(Math.round(v * 100));
      expect(back).toBeCloseTo(v, 2);
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

  it('parses USD decimals exactly through round-trip', () => {
    expect(parseMoneyInput('0.07', 'USD', 'en-US')).toBe(0.07);
    expect(parseMoneyInput('17.47', 'USD', 'en-US')).toBe(17.47);
    expect(parseMoneyInput('1,000,000.99', 'USD', 'en-US')).toBe(1000000.99);
    const stored = toMinorUnits(parseMoneyInput('137.59', 'USD', 'en-US'), 'USD');
    expect(stored).toBe(13759);
  });

  it('parses EUR with comma decimal', () => {
    expect(parseMoneyInput('17,47', 'EUR', 'de-DE')).toBe(17.47);
    const stored = toMinorUnits(parseMoneyInput('17,47', 'EUR', 'de-DE'), 'EUR');
    expect(stored).toBe(1747);
  });

  it('handles zero and negative input', () => {
    expect(parseMoneyInput('0', 'IDR')).toBe(0);
    expect(parseMoneyInput('-1234', 'IDR')).toBe(-1234);
    expect(parseMoneyInput('-1.23', 'USD', 'en-US')).toBe(-1.23);
  });
});

describe('round-trip: parse -> minor units -> format -> parse', () => {
  it('IDR 1,000,000 round-trips without the 100x bug', () => {
    const minor = toMinorUnits(parseMoneyInput('1.000.000', 'IDR'), 'IDR');
    expect(minor).toBe(1000000);
    const formatted = formatMoneyFromMinorUnits(minor, 'IDR');
    expect(parseMoneyInput(formatted, 'IDR')).toBe(1000000);
  });

  it('USD round-trips cents exactly', () => {
    const minor = toMinorUnits(parseMoneyInput('999.91', 'USD', 'en-US'), 'USD');
    expect(minor).toBe(99991);
    const formatted = formatMoneyFromMinorUnits(minor, 'USD');
    expect(parseMoneyInput(formatted, 'USD', 'en-US')).toBeCloseTo(999.91, 2);
  });
});

describe('arithmetic invariants across currencies', () => {
  it('sum of cents is exact for decimal currencies', () => {
    const a = toMinorUnits(1.25, 'USD');
    const b = toMinorUnits(2.75, 'USD');
    const sum = a + b;
    expect(sum).toBe(400);
    expect(toMajorUnits(sum, 'USD')).toBe(4);
  });

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
