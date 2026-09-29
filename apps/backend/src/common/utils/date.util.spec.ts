import { DateHelper, DEFAULT_TIMEZONE_OFFSET_HOURS } from './date.util';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

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

describe('DateHelper named timezone boundaries', () => {
  it.each([
    ['Asia/Jakarta', '2026-08-31T17:00:00.000Z'],
    ['Asia/Makassar', '2026-08-31T16:00:00.000Z'],
    ['Asia/Jayapura', '2026-08-31T15:00:00.000Z'],
  ])('starts September at local midnight in %s', (timeZone, expected) => {
    expect(
      DateHelper.startOfCalendarMonthInTimezone(2026, 9, timeZone).toISOString(),
    ).toBe(expected);
  });

  it.each([
    ['Asia/Jakarta', '2026-09-30T16:59:59.999Z'],
    ['Asia/Makassar', '2026-09-30T15:59:59.999Z'],
    ['Asia/Jayapura', '2026-09-30T14:59:59.999Z'],
  ])('ends September at local month end in %s', (timeZone, expected) => {
    expect(
      DateHelper.endOfCalendarMonthInTimezone(2026, 9, timeZone).toISOString(),
    ).toBe(expected);
  });

  it.each(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'])(
    'uses the previous full calendar month for a full-month range in %s',
    (timeZone) => {
      const start = DateHelper.startOfCalendarMonthInTimezone(
        2026,
        9,
        timeZone,
      );
      const end = DateHelper.endOfCalendarMonthInTimezone(2026, 9, timeZone);
      const previous = DateHelper.previousPeriodInTimezone(
        start,
        end,
        timeZone,
      );
      expect(previous.start).toEqual(
        DateHelper.startOfCalendarMonthInTimezone(2026, 8, timeZone),
      );
      expect(previous.end).toEqual(
        new Date(start.getTime() - 1),
      );
    },
  );

  it.each([
    ['Asia/Jakarta', '2026-08-31T17:00:00.000Z'],
    ['Asia/Makassar', '2026-08-31T16:00:00.000Z'],
    ['Asia/Jayapura', '2026-08-31T15:00:00.000Z'],
  ])(
    'keeps one-minute and one-second month-boundary instants in the correct local month for %s',
    (timeZone, boundaryIso) => {
      const boundary = new Date(boundaryIso);
      const beforeDate = '2026-08-31T00:00:00.000Z';
      const afterDate = '2026-09-01T00:00:00.000Z';

      for (const offset of [-60_000, -1_000]) {
        expect(
          DateHelper.calendarDateInTimezone(
            new Date(boundary.getTime() + offset),
            timeZone,
          ).toISOString(),
        ).toBe(beforeDate);
      }
      for (const offset of [1_000, 60_000]) {
        expect(
          DateHelper.calendarDateInTimezone(
            new Date(boundary.getTime() + offset),
            timeZone,
          ).toISOString(),
        ).toBe(afterDate);
      }
    },
  );

  it('fails the zone-swap control when a Makassar instant is evaluated as Jakarta', () => {
    const makassarMidnight = new Date('2026-08-31T16:00:00.000Z');

    expect(
      DateHelper.calendarDateInTimezone(
        makassarMidnight,
        'Asia/Makassar',
      ).toISOString(),
    ).toBe('2026-09-01T00:00:00.000Z');
    expect(
      DateHelper.calendarDateInTimezone(
        makassarMidnight,
        'Asia/Jakarta',
      ).toISOString(),
    ).toBe('2026-08-31T00:00:00.000Z');
  });

  it('keeps duration-based comparison for a non-calendar-month range', () => {
    const start = DateHelper.startOfDayInTimezone(
      '2026-09-10',
      'Asia/Makassar',
    );
    const end = DateHelper.endOfDayInTimezone(
      '2026-09-20',
      'Asia/Makassar',
    );
    const previous = DateHelper.previousPeriodInTimezone(
      start,
      end,
      'Asia/Makassar',
    );
    expect(previous.end.getTime()).toBe(start.getTime() - 1);
    expect(previous.end.getTime() - previous.start.getTime()).toBe(
      end.getTime() - start.getTime(),
    );
  });

  it('handles leap February and December to January calendar boundaries', () => {
    const leapStart = DateHelper.startOfCalendarMonthInTimezone(
      2028,
      2,
      'Asia/Jakarta',
    );
    const leapEnd = DateHelper.endOfCalendarMonthInTimezone(
      2028,
      2,
      'Asia/Jakarta',
    );
    const leapPrevious = DateHelper.previousPeriodInTimezone(
      leapStart,
      leapEnd,
      'Asia/Jakarta',
    );
    expect(leapPrevious.start).toEqual(
      DateHelper.startOfCalendarMonthInTimezone(2028, 1, 'Asia/Jakarta'),
    );
    expect(leapPrevious.end).toEqual(new Date(leapStart.getTime() - 1));

    const januaryStart = DateHelper.startOfCalendarMonthInTimezone(
      2027,
      1,
      'Asia/Jakarta',
    );
    const januaryEnd = DateHelper.endOfCalendarMonthInTimezone(
      2027,
      1,
      'Asia/Jakarta',
    );
    const januaryPrevious = DateHelper.previousPeriodInTimezone(
      januaryStart,
      januaryEnd,
      'Asia/Jakarta',
    );
    expect(januaryPrevious.start).toEqual(
      DateHelper.startOfCalendarMonthInTimezone(2026, 12, 'Asia/Jakarta'),
    );
    expect(januaryPrevious.end).toEqual(new Date(januaryStart.getTime() - 1));
  });
});
