import { DateHelper, DEFAULT_TIMEZONE_OFFSET_HOURS } from './date.util';

describe('DateHelper Timezone Boundaries (WIB / UTC+7)', () => {
  it('startOfDay maps YYYY-MM-DD to 00:00 WIB (17:00 UTC previous day)', () => {
    const start = DateHelper.startOfDay('2026-08-01', DEFAULT_TIMEZONE_OFFSET_HOURS);
    expect(start.toISOString()).toBe('2026-07-31T17:00:00.000Z');
  });

  it('endOfDay maps YYYY-MM-DD to 23:59:59.999 WIB (16:59:59.999 UTC same day)', () => {
    const end = DateHelper.endOfDay('2026-08-31', DEFAULT_TIMEZONE_OFFSET_HOURS);
    expect(end.toISOString()).toBe('2026-08-31T16:59:59.999Z');
  });

  it('startOfMonth maps month 8, year 2026 to 2026-08-01 00:00 WIB', () => {
    const start = DateHelper.startOfMonth(2026, 8, DEFAULT_TIMEZONE_OFFSET_HOURS);
    expect(start.toISOString()).toBe('2026-07-31T17:00:00.000Z');
  });

  it('endOfMonth maps month 8, year 2026 to 2026-08-31 23:59:59.999 WIB', () => {
    const end = DateHelper.endOfMonth(2026, 8, DEFAULT_TIMEZONE_OFFSET_HOURS);
    expect(end.toISOString()).toBe('2026-08-31T16:59:59.999Z');
  });

  it('correctly includes WIB transaction created at 01:30 AM on 1st of month', () => {
    // 01:30 WIB on Aug 1st = 2026-07-31 18:30 UTC
    const txDate = new Date('2026-07-31T18:30:00.000Z');
    const augustStart = DateHelper.startOfMonth(2026, 8);
    const augustEnd = DateHelper.endOfMonth(2026, 8);

    expect(txDate.getTime()).toBeGreaterThanOrEqual(augustStart.getTime());
    expect(txDate.getTime()).toBeLessThanOrEqual(augustEnd.getTime());
  });

  it('correctly includes WIB transaction created at 23:45 PM on last day of month', () => {
    // 23:45 WIB on Aug 31st = 2026-08-31 16:45 UTC
    const txDate = new Date('2026-08-31T16:45:00.000Z');
    const augustStart = DateHelper.startOfMonth(2026, 8);
    const augustEnd = DateHelper.endOfMonth(2026, 8);

    expect(txDate.getTime()).toBeGreaterThanOrEqual(augustStart.getTime());
    expect(txDate.getTime()).toBeLessThanOrEqual(augustEnd.getTime());
  });
});
