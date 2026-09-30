import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentLocalTime,
  inputDateTimeToIso,
  inputDateToEndIso,
  inputDateToStartIso,
  isoToInputDate,
  isoToLocalTime,
  toInputDate,
} from "@/lib/date";
import { formatTransactionDate } from "@/lib/format";

describe("timezone-aware transaction dates", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["Asia/Jakarta", "2026-09-28T03:00:00.000Z"],
    ["Asia/Makassar", "2026-09-28T02:00:00.000Z"],
    ["Asia/Jayapura", "2026-09-28T01:00:00.000Z"],
    ["Europe/Amsterdam", "2026-09-28T08:00:00.000Z"],
    ["America/New_York", "2026-09-28T14:00:00.000Z"],
  ])("converts local 10:00 in %s to its UTC instant", (timeZone, expected) => {
    expect(inputDateTimeToIso("2026-09-28", "10:00", timeZone)).toBe(expected);
  });

  it.each([
    [
      "Asia/Jakarta",
      "2026-08-31T16:59:00.000Z",
      "2026-08-31T17:00:00.000Z",
    ],
    [
      "Asia/Makassar",
      "2026-08-31T15:59:00.000Z",
      "2026-08-31T16:00:00.000Z",
    ],
    [
      "Asia/Jayapura",
      "2026-08-31T14:59:00.000Z",
      "2026-08-31T15:00:00.000Z",
    ],
  ])(
    "keeps 23:59 and next-day 00:00 in the correct local day for %s",
    (timeZone, lastMinute, nextMidnight) => {
      expect(inputDateTimeToIso("2026-08-31", "23:59", timeZone)).toBe(
        lastMinute,
      );
      expect(inputDateTimeToIso("2026-09-01", "00:00", timeZone)).toBe(
        nextMidnight,
      );
    },
  );

  it("extracts transaction date and time in the selected timezone", () => {
    const instant = "2026-09-28T16:30:00.000Z";

    expect(isoToInputDate(instant, "Asia/Jakarta")).toBe("2026-09-28");
    expect(isoToLocalTime(instant, "Asia/Jakarta")).toBe("23:30");
    expect(isoToInputDate(instant, "Asia/Makassar")).toBe("2026-09-29");
    expect(isoToLocalTime(instant, "Asia/Makassar")).toBe("00:30");
    expect(
      formatTransactionDate("2026-09-28T03:00:00.000Z", "Asia/Jakarta"),
    ).toContain("10.00");
  });

  it("uses the configured timezone for today's date and time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T17:30:00.000Z"));
    const now = new Date();

    expect(toInputDate(now, "Asia/Jakarta")).toBe("2026-09-29");
    expect(toInputDate(now, "America/New_York")).toBe("2026-09-28");
    expect(currentLocalTime("Asia/Jakarta")).toBe("00:30");
    expect(currentLocalTime("America/New_York")).toBe("13:30");
  });

  it("keeps DST-aware day boundaries in New York", () => {
    expect(inputDateToStartIso("2026-03-08", "America/New_York")).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(inputDateToEndIso("2026-03-08", "America/New_York")).toBe(
      "2026-03-09T03:59:59.999Z",
    );
  });

  it("keeps DST-aware day boundaries in Amsterdam", () => {
    expect(inputDateToStartIso("2026-10-25", "Europe/Amsterdam")).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    expect(inputDateToEndIso("2026-10-25", "Europe/Amsterdam")).toBe(
      "2026-10-25T22:59:59.999Z",
    );
  });

  it("formats date-only values without shifting the calendar day", () => {
    expect(
      formatTransactionDate("2026-09-28", "America/Los_Angeles"),
    ).toContain("28");
  });
});
