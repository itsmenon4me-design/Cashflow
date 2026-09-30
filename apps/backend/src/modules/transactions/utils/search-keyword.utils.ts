import type { Prisma } from '../../../generated/prisma/client';
import { DateHelper } from '../../../common/utils/date.util';

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Indonesian UI labels → canonical English category names stored in the DB
// (mirrors apps/frontend/src/lib/categories.ts CATEGORY_LABELS)
const CATEGORY_LABELS_ID: Record<string, string> = {
  gaji: 'Salary',
  bonus: 'Bonus',
  hadiah: 'Gift',
  investasi: 'Investment',
  'pemasukan lainnya': 'Other Income',
  'tempat tinggal': 'Housing',
  tagihan: 'Bills',
  makanan: 'Food',
  transportasi: 'Transport',
  belanja: 'Shopping',
  hiburan: 'Entertainment',
  liburan: 'Travel',
  kesehatan: 'Health',
  pendidikan: 'Education',
  'pengeluaran lainnya': 'Other Expense',
};

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  feb: 2,
  februari: 2,
  mar: 3,
  maret: 3,
  apr: 4,
  april: 4,
  mei: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  agu: 8,
  agustus: 8,
  aug: 8,
  sep: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
};

const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const pad2 = (value: number): string => String(value).padStart(2, '0');

const dayStart = (y: number, m: number, d: number, timeZone: string): Date =>
  DateHelper.startOfDayInTimezone(
    `${y}-${pad2(m)}-${pad2(d)}`,
    timeZone,
  );
const dayEnd = (y: number, m: number, d: number, timeZone: string): Date =>
  DateHelper.endOfDayInTimezone(
    `${y}-${pad2(m)}-${pad2(d)}`,
    timeZone,
  );
const monthStart = (y: number, m: number, timeZone: string): Date =>
  DateHelper.startOfCalendarMonthInTimezone(y, m, timeZone);
const monthEnd = (y: number, m: number, timeZone: string): Date =>
  DateHelper.endOfCalendarMonthInTimezone(y, m, timeZone);
const yearStart = (y: number, timeZone: string): Date =>
  DateHelper.startOfCalendarMonthInTimezone(y, 1, timeZone);
const yearEnd = (y: number, timeZone: string): Date =>
  DateHelper.endOfCalendarMonthInTimezone(y, 12, timeZone);

interface DateRange {
  gte: Date;
  lte: Date;
}

// Best-effort date parsing: "25 Agu", "25 Agu 2026", "Agu 2026", "Agu",
// "2026-08-25", "25/08/2026", bare year "2026". Without an explicit year the
// current year and its neighbours are covered.
function dateRanges(raw: string, timeZone: string): DateRange[] {
  const q = raw.toLowerCase();
  const out: DateRange[] = [];
  const nowYear = DateHelper.yearInNamedTimezone(new Date(), timeZone);

  // [day] month-name [year]
  const named = q.match(/^(\d{1,2})?\s*([a-z]+)\.?(\s+(\d{4}))?$/);
  if (named && MONTHS[named[2]] !== undefined) {
    const month = MONTHS[named[2]];
    const day = named[1] ? parseInt(named[1], 10) : undefined;
    const year = named[4] ? parseInt(named[4], 10) : undefined;
    if (!day || (day >= 1 && day <= 31)) {
      const years = year ? [year] : [nowYear - 1, nowYear, nowYear + 1];
      for (const y of years) {
        if (day)
          out.push({
            gte: dayStart(y, month, day, timeZone),
            lte: dayEnd(y, month, day, timeZone),
          });
        else
          out.push({
            gte: monthStart(y, month, timeZone),
            lte: monthEnd(y, month, timeZone),
          });
      }
      return out;
    }
  }

  // ISO yyyy-mm-dd(/) or day-first dd-mm-yyyy(-/)
  const norm = q.replace(/\//g, '-');
  let parts = norm.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const iso = Boolean(parts);
  if (!parts) parts = norm.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (parts) {
    const [, a, b, c] = parts;
    const year = parseInt(iso ? a : c, 10);
    const month = parseInt(b, 10);
    const day = parseInt(iso ? c : a, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      out.push({
        gte: dayStart(year, month, day, timeZone),
        lte: dayEnd(year, month, day, timeZone),
      });
      return out;
    }
  }

  // bare year (also matched as amount — OR keeps both interpretations)
  if (/^\d{4}$/.test(q)) {
    const y = parseInt(q, 10);
    out.push({
      gte: yearStart(y, timeZone),
      lte: yearEnd(y, timeZone),
    });
  }
  return out;
}

// Builds every keyword interpretation as OR predicates; callers combine them
// with their base filters via AND so search narrows instead of overriding.
export function buildKeywordOr(
  rawQuery: string,
  timeZone = DEFAULT_TIMEZONE,
): Prisma.TransactionWhereInput[] {
  const q = rawQuery.trim();
  const or: Prisma.TransactionWhereInput[] = [
    { note: { contains: q, mode: 'insensitive' } },
    { reference_number: { contains: q, mode: 'insensitive' } },
    { category: { name: { contains: q, mode: 'insensitive' } } },
  ];

  // Only UUID-shaped strings get an exact id lookup — a loose hex-ish regex
  // once matched plain digits and crashed Postgres with "invalid input
  // syntax for type uuid" (500).
  if (UUID_RE.test(q)) {
    or.push({ id: q });
  }

  // Amount: accept "100000" plus separator forms like "100.000" / "100,000".
  // Grouping separators are stripped before the numeric check; amount_cents
  // stores minor units (rupiah for IDR). Int64-safe values only.
  const digits = q.replace(/[.,\s]/g, '');
  if (/^\d+$/.test(digits)) {
    const num = Number(digits);
    if (Number.isSafeInteger(num)) {
      or.push({ amount_cents: BigInt(num) });
    }
  }

  // Transaction type words
  const typeByWord: Record<string, 'INCOME' | 'EXPENSE'> = {
    income: 'INCOME',
    expense: 'EXPENSE',
    pemasukan: 'INCOME',
    pengeluaran: 'EXPENSE',
  };
  const typeWord = typeByWord[q.toLowerCase()];
  if (typeWord) {
    or.push({ transaction_type: typeWord });
  }

  // Status: transactions carry no status column — the app treats every row as
  // completed, so success words match everything and the rest match nothing.
  const statusWord = q.toLowerCase();
  if (['berhasil', 'sukses', 'success', 'completed'].includes(statusWord)) {
    or.push({ deleted_at: null }); // always true within the scoped rows
  } else if (
    [
      'pending',
      'gagal',
      'failed',
      'dibatalkan',
      'cancelled',
      'canceled',
      'batal',
    ].includes(statusWord)
  ) {
    or.push({ id: { in: [] } });
  }

  // Category Indonesian labels ("Gaji" → Salary)
  const ql = q.toLowerCase();
  const categoryNames = Object.entries(CATEGORY_LABELS_ID)
    .filter(([label]) => label.includes(ql))
    .map(([, name]) => name);
  if (categoryNames.length > 0) {
    or.push({ category: { name: { in: categoryNames } } });
  }

  // Dates, best-effort
  for (const range of dateRanges(q, timeZone)) {
    or.push({ transaction_date: range });
  }

  return or;
}
