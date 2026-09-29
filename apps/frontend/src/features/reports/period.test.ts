import { beforeAll, describe, expect, it } from "vitest";
import {
  computeRange,
  dateInputRange,
  previousRange,
} from "./period";

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

describe("report period timezone boundaries", () => {
  it.each([
    [
      "Asia/Jakarta",
      "2026-08-31T17:00:00.000Z",
      "2026-09-30T16:59:59.999Z",
    ],
    [
      "Asia/Makassar",
      "2026-08-31T16:00:00.000Z",
      "2026-09-30T15:59:59.999Z",
    ],
    [
      "Asia/Jayapura",
      "2026-08-31T15:00:00.000Z",
      "2026-09-30T14:59:59.999Z",
    ],
  ])(
    "builds the current month and previous full month in %s",
    (timeZone, expectedStart, expectedEnd) => {
      const range = computeRange(
        "thisMonth",
        new Date("2026-08-31T18:00:00.000Z"),
        timeZone,
      );
      expect(range).toEqual({
        startDate: expectedStart,
        endDate: expectedEnd,
      });

      const previous = previousRange(range, timeZone);
      expect(previous.startDate).toBe(
        computeRange(
          "lastMonth",
          new Date("2026-08-31T18:00:00.000Z"),
          timeZone,
        ).startDate,
      );
      expect(previous.endDate).toBe(
        new Date(new Date(expectedStart).getTime() - 1).toISOString(),
      );
    },
  );

  it("keeps duration comparison for a custom range", () => {
    const range = dateInputRange(
      "2026-09-10",
      "2026-09-20",
      "Asia/Makassar",
    );
    expect(range).not.toBeNull();
    const previous = previousRange(range!, "Asia/Makassar");
    expect(new Date(previous.endDate).getTime()).toBe(
      new Date(range!.startDate).getTime() - 1,
    );
    expect(
      new Date(previous.endDate).getTime() -
        new Date(previous.startDate).getTime(),
    ).toBe(
      new Date(range!.endDate).getTime() -
        new Date(range!.startDate).getTime(),
    );
  });

  it("converts date-only input into the complete local day", () => {
    expect(
      dateInputRange("2026-09-01", "2026-09-01", "Asia/Jayapura"),
    ).toEqual({
      startDate: "2026-08-31T15:00:00.000Z",
      endDate: "2026-09-01T14:59:59.999Z",
    });
  });

  it("uses calendar boundaries for leap February and year rollover", () => {
    const february = computeRange(
      "thisMonth",
      new Date("2028-02-15T05:00:00.000Z"),
      "Asia/Jakarta",
    );
    expect(previousRange(february, "Asia/Jakarta").startDate).toBe(
      "2027-12-31T17:00:00.000Z",
    );

    const january = computeRange(
      "thisMonth",
      new Date("2027-01-15T05:00:00.000Z"),
      "Asia/Jakarta",
    );
    expect(previousRange(january, "Asia/Jakarta").startDate).toBe(
      "2026-11-30T17:00:00.000Z",
    );
  });
});
