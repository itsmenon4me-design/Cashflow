import { Money } from '../types/money';
import { parseMoneyInput, formatMoneyFromMinorUnits } from './money.utils';

describe('Phase C — Money & Multi-Currency Mathematics Test Suite', () => {
  describe('Minor Unit Precision Test Matrix', () => {
    it('IDR minor unit mapping (minorUnits = 0)', () => {
      const cases: Array<[number, bigint]> = [
        [1, 1n],
        [7, 7n],
        [17, 17n],
        [137, 137n],
        [501, 501n],
        [999, 999n],
        [1000, 1000n],
        [1001, 1001n],
        [1234567, 1234567n],
        [123456789, 123456789n],
        [1000000, 1000000n],
      ];
      for (const [major, minor] of cases) {
        const m = Money.from(major, 'IDR');
        expect(m.getMinorUnits()).toBe(minor);
        expect(m.getCurrency()).toBe('IDR');
      }
    });

    it('USD minor unit mapping (minorUnits = 2)', () => {
      const cases: Array<[number, bigint]> = [
        [0.01, 1n],
        [0.07, 7n],
        [0.17, 17n],
        [0.99, 99n],
        [1.01, 101n],
        [1.23, 123n],
        [17.47, 1747n],
        [137.59, 13759n],
        [999.91, 99991n],
        [1234.57, 123457n],
        [1000000.99, 100000099n],
      ];
      for (const [major, minor] of cases) {
        const m = Money.from(major, 'USD');
        expect(m.getMinorUnits()).toBe(minor);
        expect(m.getCurrency()).toBe('USD');
      }
    });

    it('SGD and EUR minor unit mapping (minorUnits = 2)', () => {
      expect(Money.from(1.23, 'SGD').getMinorUnits()).toBe(123n);
      expect(Money.from(99.99, 'SGD').getMinorUnits()).toBe(9999n);
      expect(Money.from(1.23, 'EUR').getMinorUnits()).toBe(123n);
      expect(Money.from(500.5, 'EUR').getMinorUnits()).toBe(50050n);
    });
  });

  describe('BigInt Arithmetic Invariants & Precision Preservation', () => {
    it('Exactness: (a + b) - b === a without rounding error', () => {
      const a = Money.from(1000000.99, 'USD');
      const b = Money.from(137.59, 'USD');
      const res = a.add(b).subtract(b);
      expect(res.equals(a)).toBe(true);
      expect(res.getMinorUnits()).toBe(100000099n);
    });

    it('Large number support beyond MAX_SAFE_INTEGER', () => {
      const largeMinor = BigInt('900719925474099200'); // > 2^53 - 1
      const m1 = new Money(largeMinor, 'IDR');
      const m2 = new Money(100n, 'IDR');
      const sum = m1.add(m2);
      expect(sum.getMinorUnits()).toBe(BigInt('900719925474099300'));
      expect(sum.subtract(m2).getMinorUnits()).toBe(largeMinor);
    });

    it('Same-currency additions and subtractions work correctly', () => {
      const idr1 = Money.from(50000, 'IDR');
      const idr2 = Money.from(25000, 'IDR');
      expect(idr1.add(idr2).getMinorUnits()).toBe(75000n);

      const usd1 = Money.from(10.5, 'USD');
      const usd2 = Money.from(4.25, 'USD');
      expect(usd1.add(usd2).getMinorUnits()).toBe(1475n);
    });
  });

  describe('Multi-Currency Separation Guards', () => {
    it('Prevents direct addition of different currencies', () => {
      const idr = Money.from(10000, 'IDR');
      const usd = Money.from(10, 'USD');
      expect(() => idr.add(usd)).toThrow(/Cannot add/);
    });

    it('Prevents direct subtraction of different currencies', () => {
      const eur = Money.from(50, 'EUR');
      const sgd = Money.from(50, 'SGD');
      expect(() => eur.subtract(sgd)).toThrow(/Cannot subtract/);
    });
  });

  describe('Formatting Integrity', () => {
    it('Formats IDR without decimals', () => {
      const formatted = formatMoneyFromMinorUnits(1000000n, 'IDR');
      expect(formatted).toContain('1.000.000');
    });

    it('Formats USD with exact 2 decimals', () => {
      const formatted = formatMoneyFromMinorUnits(100000099n, 'USD');
      expect(formatted).toContain('1,000,000.99');
    });
  });
});

describe('TIER 6.2.10 — Money domain invariants', () => {
  describe('Financial test matrix (exact minor units)', () => {
    const IDR_MINOR = [
      1n,
      7n,
      17n,
      137n,
      501n,
      999n,
      1000n,
      1001n,
      1234567n,
      123456789n,
      1000000n,
      1234567890123456789n,
    ];
    const DECIMAL_MINOR = [
      1n,
      7n,
      17n,
      99n,
      100n,
      101n,
      123n,
      1747n,
      13759n,
      99991n,
      123457n,
      100000099n,
      9007199254740993n,
    ];

    it('IDR major units map 1:1 to minor units and never ×100', () => {
      for (const minor of IDR_MINOR) {
        expect(Money.fromMinorUnits(minor, 'IDR').getMinorUnits()).toBe(minor);
        expect(Money.from(minor, 'IDR').getMinorUnits()).toBe(minor);
      }
      expect(Money.from(1000000, 'IDR').getMinorUnits()).toBe(1000000n);
      expect(Money.from(1000000, 'IDR').getMinorUnits()).not.toBe(100000000n);
    });

    it('USD/SGD/EUR major units map exactly to 2-decimal minor units', () => {
      for (const currency of ['USD', 'SGD', 'EUR'] as const) {
        for (const minor of DECIMAL_MINOR) {
          expect(Money.fromMinorUnits(minor, currency).getMinorUnits()).toBe(
            minor,
          );
        }
      }
      expect(Money.from(1.23, 'USD').getMinorUnits()).toBe(123n);
      expect(Money.from(1.23, 'SGD').getMinorUnits()).toBe(123n);
      expect(Money.from(1.23, 'EUR').getMinorUnits()).toBe(123n);
      expect(Money.from(1.23, 'USD').getMinorUnits()).not.toBe(1n);
      expect(Money.from(1.23, 'USD').getMinorUnits()).not.toBe(12300n);
      expect(Money.from(1000000.99, 'USD').getMinorUnits()).toBe(100000099n);
    });

    it('major-unit parsing for USD stays exact', () => {
      const cases: Array<[number, bigint]> = [
        [0.01, 1n],
        [0.07, 7n],
        [0.17, 17n],
        [0.99, 99n],
        [1.0, 100n],
        [1.01, 101n],
        [1.23, 123n],
        [17.47, 1747n],
        [137.59, 13759n],
        [999.91, 99991n],
        [1234.57, 123457n],
        [1000000.99, 100000099n],
      ];
      for (const [major, minor] of cases) {
        expect(Money.from(major, 'USD').getMinorUnits()).toBe(minor);
      }
    });

    it('negative values preserve sign and zero stays zero', () => {
      for (const currency of ['IDR', 'USD', 'SGD', 'EUR'] as const) {
        expect(Money.fromMinorUnits(0n, currency).getMinorUnits()).toBe(0n);
        expect(Money.fromMinorUnits(-1n, currency).getMinorUnits()).toBe(-1n);
        expect(Money.fromMinorUnits(-137n, currency).getMinorUnits()).toBe(
          -137n,
        );
        expect(Money.fromMinorUnits(-1000000n, currency).getMinorUnits()).toBe(
          -1000000n,
        );
      }
      expect(Money.from(-1, 'IDR').getMinorUnits()).toBe(-1n);
      expect(Money.from(-1.23, 'USD').getMinorUnits()).toBe(-123n);
    });

    it('random non-round values remain exact', () => {
      expect(Money.fromMinorUnits(137n, 'IDR').getMinorUnits()).toBe(137n);
      expect(Money.fromMinorUnits(501n, 'IDR').getMinorUnits()).toBe(501n);
      expect(Money.fromMinorUnits(9991n, 'USD').getMinorUnits()).toBe(9991n);
      expect(Money.fromMinorUnits(12359n, 'USD').getMinorUnits()).toBe(12359n);
    });
  });

  describe('BigInt precision around Number.MAX_SAFE_INTEGER', () => {
    it('keeps adjacent large values distinct (no Number round trip)', () => {
      const a = Money.fromMinorUnits('9007199254740991', 'IDR');
      const b = Money.fromMinorUnits('9007199254740992', 'IDR');
      const c = Money.fromMinorUnits('9007199254740993', 'IDR');
      expect(b.getMinorUnits() - a.getMinorUnits()).toBe(1n);
      expect(c.getMinorUnits() - b.getMinorUnits()).toBe(1n);
      expect(c.getMinorUnits()).toBe(9007199254740993n);
      expect(c.getMinorUnits()).not.toBe(9007199254740992n);
    });

    it('preserves large values through arithmetic', () => {
      const big = Money.fromMinorUnits('900719925474099200', 'USD');
      const one = Money.fromMinorUnits(100n, 'USD');
      const sum = big.add(one);
      expect(sum.getMinorUnits()).toBe(BigInt('900719925474099300'));
      expect(sum.subtract(one).getMinorUnits()).toBe(big.getMinorUnits());
    });

    it('Money.from(BigInt) never degrades large major units', () => {
      const large = Money.from(1234567890123456789n, 'IDR');
      expect(large.getMinorUnits()).toBe(1234567890123456789n);
    });
  });

  describe('Domain invariants and same-currency arithmetic', () => {
    it('(a + b) - b === a', () => {
      const a = Money.fromMinorUnits(9007199254740993n, 'USD');
      const b = Money.fromMinorUnits(123457n, 'USD');
      expect(a.add(b).subtract(b).getMinorUnits()).toBe(a.getMinorUnits());
    });

    it('(a - b) + b === a', () => {
      const a = Money.fromMinorUnits(99991n, 'SGD');
      const b = Money.fromMinorUnits(1747n, 'SGD');
      expect(a.subtract(b).add(b).getMinorUnits()).toBe(a.getMinorUnits());
    });

    it('add/subtract across currencies throw a domain-level error', () => {
      const usd = Money.fromMinorUnits(100n, 'USD');
      for (const currency of ['IDR', 'SGD', 'EUR'] as const) {
        const other = Money.fromMinorUnits(100n, currency);
        expect(() => usd.add(other)).toThrow(/Cannot add/);
        expect(() => usd.subtract(other)).toThrow(/Cannot subtract/);
        expect(() => usd.compare(other)).toThrow(/Cannot compare/);
      }
    });

    it('compare/negate/abs/lt/gt behave correctly within one currency', () => {
      const a = Money.fromMinorUnits(123n, 'USD');
      const b = Money.fromMinorUnits(124n, 'USD');
      const neg = a.negate();
      expect(neg.getMinorUnits()).toBe(-123n);
      expect(neg.abs().getMinorUnits()).toBe(123n);
      expect(a.compare(b)).toBe(-1);
      expect(b.compare(a)).toBe(1);
      expect(a.compare(a)).toBe(0);
      expect(a.lt(b)).toBe(true);
      expect(b.gt(a)).toBe(true);
    });

    it('multiplyByInteger is exact', () => {
      const unit = Money.fromMinorUnits(123n, 'USD');
      expect(unit.multiplyByInteger(2n).getMinorUnits()).toBe(246n);
      expect(unit.multiplyByInteger(3).getMinorUnits()).toBe(369n);
      expect(
        Money.fromMinorUnits(1000000n, 'IDR')
          .multiplyByInteger(0n)
          .getMinorUnits(),
      ).toBe(0n);
    });

    it('Money carries its currency on every operation', () => {
      const m = Money.fromMinorUnits('9007199254740993', 'IDR').add(
        Money.fromMinorUnits(7n, 'IDR'),
      );
      expect(m.getCurrency()).toBe('IDR');
      expect(m.getMinorUnits()).toBe(9007199254741000n);
    });

    it('fromMinorUnits accepts authoritative minor-unit strings', () => {
      expect(Money.fromMinorUnits('1000000', 'IDR').getMinorUnits()).toBe(
        1000000n,
      );
      expect(Money.fromMinorUnits('123', 'USD').getMinorUnits()).toBe(123n);
      expect(
        Money.fromMinorUnits('9007199254740993', 'EUR').getMinorUnits(),
      ).toBe(9007199254740993n);
    });
  });
});
