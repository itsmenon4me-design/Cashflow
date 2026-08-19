import { describe, it, expect } from 'vitest';
import { getYearOptions } from './constants';

describe('getYearOptions', () => {
  it('returns 13 options from currentYear - 2 to currentYear + 10', () => {
    const opts = getYearOptions();
    const current = new Date().getFullYear();
    expect(opts.length).toBe(13);
    expect(opts[0]).toBe(current - 2);
    expect(opts[opts.length - 1]).toBe(current + 10);
  });
});
