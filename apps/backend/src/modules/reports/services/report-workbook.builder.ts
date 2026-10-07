import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { DateHelper } from '../../../common/utils/date.util';
import {
  applyWorkbookBaseFont,
  REPORT_WORKBOOK_STYLE,
  styleBandedRows,
  styleTableHeader,
  styleTotalRow,
} from './report-export.styles';
import {
  addNativeWorkbookCharts,
  type NativeWorkbookChart,
  type NativeWorkbookNamedRange,
} from './report-workbook.native-charts';

export type WorkbookTransactionType = 'INCOME' | 'EXPENSE';
export type WorkbookTransactionPeriod = 'Laporan' | 'Pembanding';
export type WorkbookTrendType = 'daily' | 'weekly' | 'monthly';

export interface WorkbookTransaction {
  id: string;
  transactionDate: Date;
  type: WorkbookTransactionType;
  amount: bigint;
  categoryId: string;
  categoryName: string;
  note: string;
  period: WorkbookTransactionPeriod;
}

export interface WorkbookTrendPoint {
  period: string;
  income: string;
  expense: string;
  netCashFlow: string;
}

export interface WorkbookCategoryChartItem {
  name: string;
  total: bigint;
}

export interface ReportWorkbookInput {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
  generatedAt: Date;
  transactions: WorkbookTransaction[];
  trendType: WorkbookTrendType;
  trend: WorkbookTrendPoint[];
  timeZone?: string;
}

const COLORS = REPORT_WORKBOOK_STYLE.colors;
const MONEY_FORMAT = REPORT_WORKBOOK_STYLE.numberFormats.idr;
const PERCENT_FORMAT = REPORT_WORKBOOK_STYLE.numberFormats.percentage;
const TRANSACTION_TABLE = 'TransactionDetails';
const TREND_TABLE = 'TrendData';
const EXPENSE_CATEGORY_TABLE = 'ExpenseCategoryData';
const INCOME_CATEGORY_TABLE = 'IncomeCategoryData';
const DETAILS_AMOUNT_RANGE = `${TRANSACTION_TABLE}[Nominal]`;
const DETAILS_TYPE_RANGE = `${TRANSACTION_TABLE}[Jenis Data]`;
const DETAILS_PERIOD_RANGE = `${TRANSACTION_TABLE}[Kunci Periode]`;
const DETAILS_DATE_RANGE = `${TRANSACTION_TABLE}[Tanggal]`;
const DETAILS_CATEGORY_RANGE = `${TRANSACTION_TABLE}[ID Kategori]`;
const TRANSACTION_REFERENCE_SUFFIX_MODULUS = 100_000_000;

function formatCompactRupiah(amount: bigint): string {
  const negative = amount < 0n;
  const absoluteAmount = negative ? -amount : amount;
  const units = [
    { threshold: 1_000_000_000_000n, divisor: 1_000_000_000_000n, suffix: 'T' },
    { threshold: 1_000_000_000n, divisor: 1_000_000_000n, suffix: 'M' },
    { threshold: 1_000_000n, divisor: 1_000_000n, suffix: 'Jt' },
    { threshold: 1_000n, divisor: 1_000n, suffix: 'Rb' },
  ];
  const unit = units.find(({ threshold }) => absoluteAmount >= threshold);
  if (!unit) {
    return `Rp ${negative ? '-' : ''}${absoluteAmount.toLocaleString('id-ID')}`;
  }

  const hundredths = (absoluteAmount * 100n + unit.divisor / 2n) / unit.divisor;
  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n)
    .toString()
    .padStart(2, '0')
    .replace(/0+$/, '');
  const value = `${Number(whole).toLocaleString('id-ID')}${fraction ? `,${fraction}` : ''}`;
  return `Rp ${negative ? '-' : ''}${value} ${unit.suffix}`;
}

function transactionReferenceIds(
  transactions: WorkbookTransaction[],
  timeZone: string,
): Map<string, string> {
  const references = new Map<string, string>();
  const usedReferences = new Set<string>();
  const orderedTransactions = [...transactions].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const transaction of orderedTransactions) {
    const calendarDate = DateHelper.calendarDateInTimezone(
      transaction.transactionDate,
      timeZone,
    );
    const datePrefix = [
      calendarDate.getUTCFullYear(),
      String(calendarDate.getUTCMonth() + 1).padStart(2, '0'),
      String(calendarDate.getUTCDate()).padStart(2, '0'),
    ].join('');
    const hash = createHash('sha256').update(transaction.id).digest();
    let suffix = hash.readUInt32BE(0) % TRANSACTION_REFERENCE_SUFFIX_MODULUS;
    let reference = '';

    do {
      reference = `${datePrefix}${String(suffix).padStart(8, '0')}`;
      suffix = (suffix + 1) % TRANSACTION_REFERENCE_SUFFIX_MODULUS;
    } while (usedReferences.has(reference));

    references.set(transaction.id, reference);
    usedReferences.add(reference);
  }

  return references;
}

function excelFormula(
  formula: string,
  result: number | string,
): ExcelJS.CellValue {
  return { formula, result };
}

function setFormulaCache(cell: ExcelJS.Cell, result: number): void {
  // ExcelJS's formula value copy drops numeric zero results.
  const value: unknown = Reflect.get(cell, '_value');
  const model: unknown =
    typeof value === 'object' && value !== null
      ? Reflect.get(value, 'model')
      : undefined;
  if (
    typeof model !== 'object' ||
    model === null ||
    !Reflect.set(model, 'result', result)
  ) {
    throw new Error('Unable to set XLSX formula cache');
  }
}

function sumRange(
  type: string,
  period: string,
  amountRange: string,
  typeRange: string,
  periodRange: string,
): string {
  return `SUMIFS(${amountRange},${typeRange},"${type}",${periodRange},"${period}")`;
}

function sumByDateFormula(
  type: WorkbookTransactionType,
  start: Date,
  end: Date,
  amountRange: string,
  typeRange: string,
  periodRange: string,
  dateRange: string,
): string {
  const lowerBound = `DATE(${start.getUTCFullYear()},${start.getUTCMonth() + 1},${start.getUTCDate()})`;
  const upperBound = `DATE(${end.getUTCFullYear()},${end.getUTCMonth() + 1},${end.getUTCDate()})`;
  return `SUMIFS(${amountRange},${typeRange},"${type}",${periodRange},"Laporan",${dateRange},">="&${lowerBound},${dateRange},"<"&${upperBound})`;
}

function periodBounds(period: string, type: WorkbookTrendType): [Date, Date] {
  if (type === 'daily') {
    const [year, month, day] = period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day));
    return [start, new Date(Date.UTC(year, month - 1, day + 1))];
  }

  if (type === 'monthly') {
    const [year, month] = period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    return [start, new Date(Date.UTC(year, month, 1))];
  }

  const [yearText, weekText] = period.split('-W');
  const year = Number(yearText);
  const week = Number(weekText);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mondayOffset = (jan4.getUTCDay() + 6) % 7;
  const start = new Date(
    jan4.getTime() - mondayOffset * 86_400_000 + (week - 1) * 7 * 86_400_000,
  );
  return [start, new Date(start.getTime() + 7 * 86_400_000)];
}

function setupSummarySheet(
  workbook: ExcelJS.Workbook,
  input: ReportWorkbookInput,
): void {
  const sheet = workbook.addWorksheet('Ringkasan', {
    properties: { tabColor: { argb: COLORS.teal }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = Array.from({ length: 12 }, () => ({ width: 15 }));
  sheet.getColumn(10).width = 19;
  sheet.getColumn(11).width = 12;
  sheet.getColumn(12).width = 19;
  sheet.getColumn(7).width = 18;
  sheet.getColumn(8).width = 18;
  sheet.getColumn(9).width = 3;
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: 'A1:L46',
  };
  sheet.mergeCells('A1:H1');
  sheet.mergeCells('I1:L1');
  sheet.mergeCells('A2:H2');
  sheet.mergeCells('I2:L2');
  sheet.getCell('A1').value = 'Neraca';
  sheet.getCell('A1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 19,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  sheet.getCell('A2').value = 'Laporan Keuangan Pribadi';
  sheet.getCell('A2').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 10,
    color: { argb: 'FFE1EEEA' },
  };
  sheet.getCell('A2').alignment = { vertical: 'middle', indent: 2 };
  sheet.getRow(1).height = 32;
  sheet.getRow(2).height = 24;
  for (const rowNumber of [1, 2]) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.teal },
      };
    });
  }

  const timeZone = input.timeZone ?? 'Asia/Jakarta';
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone,
  };
  const periodText = `${input.startDate.toLocaleDateString('id-ID', dateOptions)} – ${input.endDate.toLocaleDateString('id-ID', dateOptions)}`;
  const comparisonText = `${input.previousStartDate.toLocaleDateString('id-ID', dateOptions)} – ${input.previousEndDate.toLocaleDateString('id-ID', dateOptions)}`;
  const generatedText = input.generatedAt.toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  });
  sheet.getCell('I1').value = 'Periode Laporan';
  sheet.getCell('I1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 9,
    bold: true,
    color: { argb: 'FFE1EEEA' },
  };
  sheet.getCell('I1').alignment = {
    vertical: 'middle',
    horizontal: 'right',
    indent: 1,
  };
  sheet.getCell('I2').value = periodText;
  sheet.getCell('I2').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 11,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('I2').alignment = {
    vertical: 'middle',
    horizontal: 'right',
    wrapText: true,
    indent: 1,
  };
  sheet.mergeCells('A3:H3');
  sheet.mergeCells('I3:L3');
  sheet.getCell('A3').value = 'Ringkasan Keuangan';
  sheet.getCell('A3').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 12,
    bold: true,
    color: { argb: COLORS.teal },
  };
  sheet.getCell('I3').value =
    `Pembanding: ${comparisonText} | Dibuat ${generatedText}`;
  sheet.getCell('I3').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 8,
    color: { argb: COLORS.muted },
  };
  sheet.getCell('I3').alignment = {
    vertical: 'middle',
    horizontal: 'right',
    wrapText: true,
  };
  sheet.getRow(3).height = 24;
  sheet.getRow(3).eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.band },
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
  if (!input.transactions.some((row) => row.period === 'Laporan')) {
    sheet.mergeCells('A8:L8');
    sheet.getCell('A8').value = 'Belum ada transaksi pada periode laporan.';
    sheet.getCell('A8').font = {
      name: REPORT_WORKBOOK_STYLE.font,
      italic: true,
      color: { argb: COLORS.muted },
    };
    sheet.getCell('A8').alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(8).height = 20;
  }

  const incomeFormula = sumRange(
    'INCOME',
    'Laporan',
    DETAILS_AMOUNT_RANGE,
    DETAILS_TYPE_RANGE,
    DETAILS_PERIOD_RANGE,
  );
  const expenseFormula = sumRange(
    'EXPENSE',
    'Laporan',
    DETAILS_AMOUNT_RANGE,
    DETAILS_TYPE_RANGE,
    DETAILS_PERIOD_RANGE,
  );
  const comparisonIncomeFormula = sumRange(
    'INCOME',
    'Pembanding',
    DETAILS_AMOUNT_RANGE,
    DETAILS_TYPE_RANGE,
    DETAILS_PERIOD_RANGE,
  );
  const comparisonExpenseFormula = sumRange(
    'EXPENSE',
    'Pembanding',
    DETAILS_AMOUNT_RANGE,
    DETAILS_TYPE_RANGE,
    DETAILS_PERIOD_RANGE,
  );
  const comparisonCountFormula = `COUNTIF(${DETAILS_PERIOD_RANGE},"Pembanding")`;
  const comparisonNetFormula = `(${comparisonIncomeFormula}-${comparisonExpenseFormula})`;

  const cards = [
    {
      label: 'Total Pemasukan',
      start: 'A',
      end: 'C',
      valueColor: COLORS.income,
      formula: `=${incomeFormula}`,
      result: input.transactions
        .filter((row) => row.period === 'Laporan' && row.type === 'INCOME')
        .reduce((sum, row) => sum + row.amount, 0n),
      previous: comparisonIncomeFormula,
      isCount: false,
    },
    {
      label: 'Total Pengeluaran',
      start: 'D',
      end: 'F',
      valueColor: COLORS.expense,
      formula: `=${expenseFormula}`,
      result: input.transactions
        .filter((row) => row.period === 'Laporan' && row.type === 'EXPENSE')
        .reduce((sum, row) => sum + row.amount, 0n),
      previous: comparisonExpenseFormula,
      isCount: false,
    },
    {
      label: 'Arus Kas Bersih',
      start: 'G',
      end: 'I',
      valueColor: COLORS.net,
      formula: '=A5-D5',
      result:
        input.transactions
          .filter((row) => row.period === 'Laporan' && row.type === 'INCOME')
          .reduce((sum, row) => sum + row.amount, 0n) -
        input.transactions
          .filter((row) => row.period === 'Laporan' && row.type === 'EXPENSE')
          .reduce((sum, row) => sum + row.amount, 0n),
      previous: comparisonNetFormula,
      isCount: false,
    },
    {
      label: 'Jumlah Transaksi',
      start: 'J',
      end: 'L',
      valueColor: COLORS.text,
      formula: `=COUNTIF(${DETAILS_PERIOD_RANGE},"Laporan")`,
      result: input.transactions.filter((row) => row.period === 'Laporan')
        .length,
      previous: comparisonCountFormula,
      isCount: true,
    },
  ];

  for (const card of cards) {
    sheet.mergeCells(`${card.start}4:${card.end}4`);
    sheet.mergeCells(`${card.start}5:${card.end}6`);
    sheet.mergeCells(`${card.start}7:${card.end}7`);
    const label = sheet.getCell(`${card.start}4`);
    const value = sheet.getCell(`${card.start}5`);
    const change = sheet.getCell(`${card.start}7`);
    label.value = card.label;
    value.value = excelFormula(card.formula.slice(1), Number(card.result));
    change.value = excelFormula(
      `IF(${card.previous}=0,IF(ABS(${card.start}5)>0,"Baru","-"),TEXT((${card.start}5-${card.previous})/ABS(${card.previous}),"+0.0%;-0.0%;0.0%"))`,
      calculateChange(
        BigInt(card.result),
        card.previous.includes('COUNTIF')
          ? BigInt(
              input.transactions.filter((row) => row.period === 'Pembanding')
                .length,
            )
          : getPreviousAmount(input.transactions, card.label),
      ),
    );
    for (let rowNumber = 4; rowNumber <= 7; rowNumber += 1) {
      for (
        let column = card.start.charCodeAt(0) - 64;
        column <= card.end.charCodeAt(0) - 64;
        column += 1
      ) {
        const cell = sheet.getRow(rowNumber).getCell(column);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb:
              rowNumber === 4
                ? COLORS.tealLight
                : rowNumber === 7
                  ? COLORS.band
                  : COLORS.white,
          },
        };
        cell.font = {
          name: REPORT_WORKBOOK_STYLE.font,
          color: {
            argb: rowNumber === 5 ? card.valueColor : COLORS.muted,
          },
          bold: rowNumber !== 7,
          size: rowNumber === 5 ? 16 : 10,
          italic: rowNumber === 7,
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: COLORS.border } },
        };
      }
    }
    label.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: COLORS.teal },
      bold: true,
      size: 10,
    };
    value.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: card.valueColor },
      bold: true,
      size: 16,
    };
    value.numFmt = card.isCount
      ? REPORT_WORKBOOK_STYLE.numberFormats.count
      : MONEY_FORMAT;
    change.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: COLORS.muted },
      italic: true,
      size: 9,
    };
  }
  sheet.getRow(4).height = 25;
  sheet.getRow(5).height = 25;
  sheet.getRow(6).height = 25;
  sheet.getRow(7).height = 26;

  const tableHeaderRow = 29;
  sheet.addRow([]);
  sheet.getRow(tableHeaderRow).values = [
    'Metrik',
    null,
    'Pembanding',
    'Periode Laporan',
    'Selisih',
    'Perubahan',
  ];
  sheet.mergeCells('A29:B29');
  styleTableHeader(sheet.getRow(tableHeaderRow), COLORS.teal);

  const topExpenseCategories = getWorkbookCategories(
    input,
    'EXPENSE',
    'Laporan',
  ).slice(0, 16);
  const topIncomeCategories = getWorkbookCategories(
    input,
    'INCOME',
    'Laporan',
  ).slice(0, 16);
  sheet.mergeCells('A9:F9');
  sheet.mergeCells('G9:I9');
  sheet.mergeCells('J9:L9');
  sheet.getCell('A9').value = 'Pemasukan vs Pengeluaran';
  sheet.getCell('G9').value = 'Kategori Pengeluaran';
  sheet.getCell('J9').value = 'Rincian Pengeluaran';
  for (const address of ['A9', 'G9', 'J9']) {
    const cell = sheet.getCell(address);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.tealLight },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.teal },
      size: 10,
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  }
  sheet.mergeCells('A28:F28');
  sheet.mergeCells('G28:I28');
  sheet.mergeCells('J28:L28');
  sheet.getCell('A28').value = 'Perbandingan dengan Periode Sebelumnya';
  sheet.getCell('G28').value = 'Kategori Pemasukan';
  sheet.getCell('J28').value = 'Rincian Pemasukan';
  for (const address of ['A28', 'G28', 'J28']) {
    const cell = sheet.getCell(address);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.tealLight },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.teal },
      size: 10,
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  }
  sheet.getRow(28).height = 24;
  sheet.getRow(10).height = 24;
  sheet.getRow(29).height = 24;
  ['J', 'K', 'L'].forEach((column) => {
    const cell = sheet.getCell(`${column}10`);
    cell.value =
      column === 'J' ? 'Kategori' : column === 'K' ? 'Persentase' : 'Nominal';
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.band },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.text },
      size: 9,
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
  ['J', 'K', 'L'].forEach((column) => {
    const cell = sheet.getCell(`${column}29`);
    cell.value =
      column === 'J' ? 'Kategori' : column === 'K' ? 'Persentase' : 'Nominal';
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.band },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.text },
      size: 9,
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
  const fillCategorySummary = (
    categories: WorkbookCategoryTotal[],
    type: WorkbookTransactionType,
  ) => {
    const sheetName =
      type === 'EXPENSE'
        ? 'Pengeluaran per Kategori'
        : 'Pemasukan per Kategori';
    const grandTotal = getWorkbookCategories(input, type, 'Laporan').reduce(
      (sum, category) => sum + category.total,
      0n,
    );
    for (let index = 0; index < 16; index += 1) {
      const rowNumber = index + (type === 'EXPENSE' ? 11 : 30);
      const category = categories[index];
      const cellValues = category
        ? {
            name: excelFormula(`'${sheetName}'!G${index + 6}`, category.name),
            percentage: excelFormula(
              `'${sheetName}'!I${index + 6}`,
              grandTotal === 0n
                ? 0
                : Number(category.total) / Number(grandTotal),
            ),
            amount: excelFormula(
              `'${sheetName}'!H${index + 6}`,
              Number(category.total),
            ),
          }
        : { name: null, percentage: null, amount: null };
      sheet.getCell(`J${rowNumber}`).value = cellValues.name;
      sheet.getCell(`K${rowNumber}`).value = cellValues.percentage;
      sheet.getCell(`L${rowNumber}`).value = cellValues.amount;
      sheet.getCell(`K${rowNumber}`).numFmt =
        REPORT_WORKBOOK_STYLE.numberFormats.percentage;
      sheet.getCell(`L${rowNumber}`).numFmt = MONEY_FORMAT;
      sheet.getRow(rowNumber).height = Math.max(
        20,
        Math.ceil((category?.name.length ?? 1) / 19) * 15,
      );
      for (const column of ['J', 'K', 'L']) {
        const cell = sheet.getCell(`${column}${rowNumber}`);
        cell.alignment = {
          vertical: 'middle',
          horizontal: column === 'J' ? 'left' : 'right',
          wrapText: true,
        };
        cell.border = {
          bottom: { style: 'hair', color: { argb: COLORS.border } },
        };
        if (rowNumber % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.band },
          };
        }
      }
    }
  };
  fillCategorySummary(topExpenseCategories, 'EXPENSE');
  fillCategorySummary(topIncomeCategories, 'INCOME');

  const periodComparisons = [
    {
      label: 'Total Pemasukan',
      previous: comparisonIncomeFormula,
      previousValue: getPreviousAmount(input.transactions, 'Total Pemasukan'),
      current: 'A5',
      currentValue: BigInt(cards[0].result),
      change: 'A7',
      changeValue: calculateChange(
        BigInt(cards[0].result),
        getPreviousAmount(input.transactions, 'Total Pemasukan'),
      ),
    },
    {
      label: 'Total Pengeluaran',
      previous: comparisonExpenseFormula,
      previousValue: getPreviousAmount(input.transactions, 'Total Pengeluaran'),
      current: 'D5',
      currentValue: BigInt(cards[1].result),
      change: 'D7',
      changeValue: calculateChange(
        BigInt(cards[1].result),
        getPreviousAmount(input.transactions, 'Total Pengeluaran'),
      ),
    },
    {
      label: 'Arus Kas Bersih',
      previous: comparisonNetFormula,
      previousValue: getPreviousAmount(input.transactions, 'Arus Kas Bersih'),
      current: 'G5',
      currentValue: BigInt(cards[2].result),
      change: 'G7',
      changeValue: calculateChange(
        BigInt(cards[2].result),
        getPreviousAmount(input.transactions, 'Arus Kas Bersih'),
      ),
    },
    {
      label: 'Jumlah Transaksi',
      previous: comparisonCountFormula,
      previousValue: BigInt(
        input.transactions.filter((row) => row.period === 'Pembanding').length,
      ),
      current: 'J5',
      currentValue: BigInt(cards[3].result),
      change: 'J7',
      changeValue: calculateChange(
        BigInt(cards[3].result),
        BigInt(
          input.transactions.filter((row) => row.period === 'Pembanding')
            .length,
        ),
      ),
      isCount: true,
    },
  ];
  periodComparisons.forEach((comparison, index) => {
    const rowNumber = index + 30;
    sheet.getCell(`A${rowNumber}`).value = comparison.label;
    sheet.mergeCells(`A${rowNumber}:B${rowNumber}`);
    sheet.getCell(`C${rowNumber}`).value = excelFormula(
      comparison.previous,
      Number(comparison.previousValue),
    );
    sheet.getCell(`D${rowNumber}`).value = excelFormula(
      comparison.current,
      Number(comparison.currentValue),
    );
    sheet.getCell(`E${rowNumber}`).value = excelFormula(
      `D${rowNumber}-C${rowNumber}`,
      Number(comparison.currentValue - comparison.previousValue),
    );
    sheet.getCell(`F${rowNumber}`).value = excelFormula(
      `IF(C${rowNumber}=0,IF(ABS(D${rowNumber})>0,"Baru","-"),TEXT((D${rowNumber}-C${rowNumber})/ABS(C${rowNumber}),"+0.0%;-0.0%;0.0%"))`,
      comparison.changeValue,
    );
    for (const column of ['C', 'D', 'E']) {
      sheet.getCell(`${column}${rowNumber}`).numFmt = comparison.isCount
        ? REPORT_WORKBOOK_STYLE.numberFormats.count
        : MONEY_FORMAT;
    }
    setFormulaCache(
      sheet.getCell(`C${rowNumber}`),
      Number(comparison.previousValue),
    );
    setFormulaCache(
      sheet.getCell(`D${rowNumber}`),
      Number(comparison.currentValue),
    );
    setFormulaCache(
      sheet.getCell(`E${rowNumber}`),
      Number(comparison.currentValue - comparison.previousValue),
    );
    sheet.getRow(rowNumber).height = 30;
  });
  styleBandedRows(sheet, 30, 33, 6);
  sheet.getCell('N1').value =
    'Sumber pembanding dihitung dari transaksi pada tabel rincian.';
  sheet.getColumn(14).hidden = true;
  applyWorkbookBaseFont(sheet);
}

function getPreviousAmount(
  transactions: WorkbookTransaction[],
  label: string,
): bigint {
  const types =
    label === 'Total Pemasukan'
      ? ['INCOME']
      : label === 'Total Pengeluaran'
        ? ['EXPENSE']
        : ['INCOME', 'EXPENSE'];
  const total = transactions
    .filter((row) => row.period === 'Pembanding' && types.includes(row.type))
    .reduce(
      (sum, row) =>
        sum +
        row.amount *
          (label === 'Arus Kas Bersih' && row.type === 'EXPENSE' ? -1n : 1n),
      0n,
    );
  return total;
}

function calculateChange(current: bigint, previous: bigint): string {
  if (previous === 0n) return current !== 0n ? 'Baru' : '-';
  const change =
    Number(
      ((current - previous) * 10000n) / (previous < 0n ? -previous : previous),
    ) / 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function setupTrendSheet(
  workbook: ExcelJS.Workbook,
  input: ReportWorkbookInput,
): void {
  const sheet = workbook.addWorksheet('Tren Arus Kas', {
    properties: { tabColor: { argb: COLORS.teal }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = Array.from({ length: 12 }, () => ({ width: 14 }));
  sheet.getColumn(1).width = 16;
  for (const column of [2, 3, 4]) sheet.getColumn(column).width = 20;
  sheet.getColumn(5).width = 3;
  sheet.getColumn(6).width = 24;
  sheet.getColumn(7).width = 20;
  sheet.getColumn(8).width = 12;
  sheet.getColumn(9).width = 3;
  sheet.getColumn(10).width = 26;
  sheet.getColumn(11).width = 14;
  sheet.getColumn(12).width = 20;
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: `A1:L${Math.max(38, input.trend.length + 34)}`,
  };
  sheet.mergeCells('A1:I1');
  sheet.mergeCells('J1:L1');
  sheet.mergeCells('A2:I2');
  sheet.mergeCells('J2:L2');
  sheet.getCell('A1').value = 'Tren Arus Kas';
  sheet.getCell('A1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 18,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  sheet.getCell('A2').value =
    'Melihat perkembangan pemasukan, pengeluaran dan arus kas bersih.';
  sheet.getCell('A2').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 10,
    color: { argb: 'FFE1EEEA' },
  };
  sheet.getCell('A2').alignment = { vertical: 'middle', indent: 2 };
  sheet.getCell('J1').value = 'Periode Laporan';
  sheet.getCell('J1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 9,
    bold: true,
    color: { argb: 'FFE1EEEA' },
  };
  sheet.getCell('J1').alignment = {
    vertical: 'middle',
    horizontal: 'right',
  };
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: input.timeZone ?? 'Asia/Jakarta',
  };
  sheet.getCell('J2').value =
    `${input.startDate.toLocaleDateString('id-ID', dateOptions)} – ${input.endDate.toLocaleDateString('id-ID', dateOptions)}`;
  sheet.getCell('J2').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 11,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('J2').alignment = {
    vertical: 'middle',
    horizontal: 'right',
  };
  for (const rowNumber of [1, 2]) {
    sheet.getRow(rowNumber).height = rowNumber === 1 ? 32 : 24;
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.teal },
      };
    });
  }

  const amountRange = DETAILS_AMOUNT_RANGE;
  const typeRange = DETAILS_TYPE_RANGE;
  const periodRange = DETAILS_PERIOD_RANGE;
  const dateRange = DETAILS_DATE_RANGE;
  const cardTotalRowNumber = 31 + Math.max(1, input.trend.length);
  const cardIncomeTotal = input.trend.reduce(
    (sum, point) => sum + BigInt(point.income),
    0n,
  );
  const cardExpenseTotal = input.trend.reduce(
    (sum, point) => sum + BigInt(point.expense),
    0n,
  );
  const netTotal = cardIncomeTotal - cardExpenseTotal;
  const cards = [
    {
      label: 'Total Pemasukan',
      start: 'A',
      end: 'C',
      color: COLORS.income,
      value: cardIncomeTotal,
      formula: `SUM(${TREND_TABLE}[Pemasukan])`,
    },
    {
      label: 'Total Pengeluaran',
      start: 'D',
      end: 'F',
      color: COLORS.expense,
      value: cardExpenseTotal,
      formula: `SUM(${TREND_TABLE}[Pengeluaran])`,
    },
    {
      label: 'Arus Kas Bersih',
      start: 'G',
      end: 'I',
      color: COLORS.net,
      value: netTotal,
      formula: `B${cardTotalRowNumber}-C${cardTotalRowNumber}`,
    },
  ];
  for (const card of cards) {
    sheet.mergeCells(`${card.start}4:${card.end}4`);
    sheet.mergeCells(`${card.start}5:${card.end}6`);
    const label = sheet.getCell(`${card.start}4`);
    label.value = card.label;
    const value = sheet.getCell(`${card.start}5`);
    value.value = excelFormula(card.formula, Number(card.value));
    value.numFmt = MONEY_FORMAT;
    value.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      size: 16,
      bold: true,
      color: { argb: card.color },
    };
    value.alignment = { vertical: 'middle', horizontal: 'center' };
    for (
      let column = card.start.charCodeAt(0) - 64;
      column <= card.end.charCodeAt(0) - 64;
      column += 1
    ) {
      for (let rowNumber = 4; rowNumber <= 6; rowNumber += 1) {
        const cell = sheet.getRow(rowNumber).getCell(column);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowNumber === 4 ? COLORS.tealLight : COLORS.white },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: COLORS.border } },
        };
      }
    }
    label.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      size: 10,
      bold: true,
      color: { argb: COLORS.teal },
    };
    label.alignment = { vertical: 'middle', horizontal: 'center' };
  }
  sheet.getRow(4).height = 24;
  sheet.getRow(5).height = 26;
  sheet.getRow(6).height = 18;
  sheet.mergeCells('A8:L8');
  sheet.getCell('A8').value = 'Grafik Arus Kas';
  sheet.getCell('A8').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.tealLight },
  };
  sheet.getCell('A8').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    bold: true,
    color: { argb: COLORS.teal },
  };
  sheet.getCell('A8').alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(8).height = 25;

  sheet.mergeCells('A28:D28');
  sheet.mergeCells('F28:H28');
  sheet.mergeCells('J28:L28');
  sheet.getCell('A28').value = 'Detail Bulanan';
  sheet.getCell('F28').value = 'Ringkasan Bulanan';
  sheet.getCell('J28').value = 'Ringkasan Tren';
  for (const address of ['A28', 'F28', 'J28']) {
    const cell = sheet.getCell(address);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.tealLight },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.teal },
    };
    cell.alignment = { vertical: 'middle', indent: 1 };
  }
  sheet.getRow(28).height = 25;
  sheet.getRow(30).values = [
    'Periode',
    'Pemasukan',
    'Pengeluaran',
    'Arus Kas Bersih',
    null,
    'Jenis',
    'Nominal',
    'Persentase',
    null,
    'Metrik',
    'Periode',
    'Nominal',
  ];
  styleTableHeader(sheet.getRow(30), COLORS.teal);
  sheet.addTable({
    name: TREND_TABLE,
    ref: 'A30',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium4',
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: [
      { name: 'Periode', filterButton: true },
      { name: 'Pemasukan', filterButton: true },
      { name: 'Pengeluaran', filterButton: true },
      { name: 'Arus Kas Bersih', filterButton: true },
    ],
    rows: input.trend.map(() => [null, null, null, null]),
  });

  input.trend.forEach((point, index) => {
    const rowNumber = 31 + index;
    const [start, end] = periodBounds(point.period, input.trendType);
    const incomeFormula = sumByDateFormula(
      'INCOME',
      start,
      end,
      amountRange,
      typeRange,
      periodRange,
      dateRange,
    );
    const expenseFormula = sumByDateFormula(
      'EXPENSE',
      start,
      end,
      amountRange,
      typeRange,
      periodRange,
      dateRange,
    );
    sheet.getRow(rowNumber).values = [
      point.period,
      excelFormula(incomeFormula, Number(BigInt(point.income))),
      excelFormula(expenseFormula, Number(BigInt(point.expense))),
      excelFormula(
        `B${rowNumber}-C${rowNumber}`,
        Number(BigInt(point.netCashFlow)),
      ),
    ];
    setFormulaCache(sheet.getCell(rowNumber, 2), Number(BigInt(point.income)));
    setFormulaCache(sheet.getCell(rowNumber, 3), Number(BigInt(point.expense)));
    setFormulaCache(
      sheet.getCell(rowNumber, 4),
      Number(BigInt(point.netCashFlow)),
    );
  });

  const incomeTotal = input.trend.reduce(
    (sum, point) => sum + BigInt(point.income),
    0n,
  );
  const expenseTotal = input.trend.reduce(
    (sum, point) => sum + BigInt(point.expense),
    0n,
  );
  const lastDataRow = Math.max(31, 30 + input.trend.length);
  const totalRowNumber = lastDataRow + 1;
  const totalIncomeFormula = `SUM(${TREND_TABLE}[Pemasukan])`;
  const totalExpenseFormula = `SUM(${TREND_TABLE}[Pengeluaran])`;
  sheet.getRow(totalRowNumber).values = [
    'Total',
    excelFormula(totalIncomeFormula, Number(incomeTotal)),
    excelFormula(totalExpenseFormula, Number(expenseTotal)),
    excelFormula(
      `B${totalRowNumber}-C${totalRowNumber}`,
      Number(incomeTotal - expenseTotal),
    ),
  ];
  styleBandedRows(sheet, 31, lastDataRow, 4);
  styleTotalRow(sheet.getRow(totalRowNumber), 4);
  const summaries = [
    ['Pemasukan', `B${totalRowNumber}`, incomeTotal, 1, COLORS.income],
    [
      'Pengeluaran',
      `C${totalRowNumber}`,
      expenseTotal,
      incomeTotal === 0n
        ? 0
        : Number((expenseTotal * 10_000n) / incomeTotal) / 10_000,
      COLORS.expense,
    ],
    [
      'Arus Kas Bersih',
      `D${totalRowNumber}`,
      incomeTotal - expenseTotal,
      incomeTotal === 0n
        ? 0
        : Number(((incomeTotal - expenseTotal) * 10_000n) / incomeTotal) /
          10_000,
      COLORS.net,
    ],
  ] as const;
  summaries.forEach(([label, formula, result, percentage, color], index) => {
    const rowNumber = 31 + index;
    sheet.getCell(`F${rowNumber}`).value = label;
    sheet.getCell(`G${rowNumber}`).value = excelFormula(
      formula,
      Number(result),
    );
    sheet.getCell(`G${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`G${rowNumber}`).font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: color },
    };
    sheet.getCell(`H${rowNumber}`).value = excelFormula(
      `IF(B${totalRowNumber}=0,0,G${rowNumber}/B${totalRowNumber})`,
      percentage,
    );
    sheet.getCell(`H${rowNumber}`).numFmt = PERCENT_FORMAT;
  });
  const peakMetrics = [
    {
      label: 'Pemasukan tertinggi',
      period: input.trend.reduce(
        (peak, point) =>
          !peak || BigInt(point.income) > BigInt(peak.income) ? point : peak,
        input.trend[0],
      ),
      value: 'income',
      column: 'B',
    },
    {
      label: 'Pengeluaran tertinggi',
      period: input.trend.reduce(
        (peak, point) =>
          !peak || BigInt(point.expense) > BigInt(peak.expense) ? point : peak,
        input.trend[0],
      ),
      value: 'expense',
      column: 'C',
    },
    {
      label: 'Arus kas bersih tertinggi',
      period: input.trend.reduce(
        (peak, point) =>
          !peak || BigInt(point.netCashFlow) > BigInt(peak.netCashFlow)
            ? point
            : peak,
        input.trend[0],
      ),
      value: 'netCashFlow',
      column: 'D',
    },
  ] as const;
  peakMetrics.forEach((metric, index) => {
    const rowNumber = 31 + index;
    sheet.getCell(`J${rowNumber}`).value = metric.label;
    sheet.getCell(`K${rowNumber}`).value = metric.period?.period ?? '-';
    sheet.getCell(`L${rowNumber}`).value = metric.period
      ? excelFormula(
          `MAX(${metric.column}31:${metric.column}${lastDataRow})`,
          Number(BigInt(metric.period[metric.value])),
        )
      : 0;
    sheet.getCell(`L${rowNumber}`).numFmt = MONEY_FORMAT;
  });
  for (let rowNumber = 31; rowNumber <= totalRowNumber; rowNumber += 1) {
    sheet.getCell(`B${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`C${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`D${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`B${rowNumber}`).font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: rowNumber === totalRowNumber,
      color: { argb: COLORS.income },
    };
    sheet.getCell(`C${rowNumber}`).font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: rowNumber === totalRowNumber,
      color: { argb: COLORS.expense },
    };
    sheet.getCell(`D${rowNumber}`).font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.teal },
    };
  }
  applyWorkbookBaseFont(sheet);
}

function getWorkbookCategories(
  input: ReportWorkbookInput,
  type: WorkbookTransactionType,
  period?: WorkbookTransactionPeriod,
): WorkbookCategoryTotal[] {
  const categoryMap = new Map<string, WorkbookCategoryTotal>();
  for (const transaction of input.transactions) {
    if (
      transaction.type !== type ||
      (period && transaction.period !== period)
    ) {
      continue;
    }
    const category = categoryMap.get(transaction.categoryId) ?? {
      id: transaction.categoryId,
      name: transaction.categoryName,
      total: 0n,
      count: 0,
    };
    category.total += transaction.amount;
    category.count += 1;
    categoryMap.set(transaction.categoryId, category);
  }
  return Array.from(categoryMap.values()).sort((left, right) =>
    left.total > right.total
      ? -1
      : left.total < right.total
        ? 1
        : left.name.localeCompare(right.name, 'id'),
  );
}

interface WorkbookCategoryTotal {
  id: string;
  name: string;
  total: bigint;
  count: number;
}

function setupCategorySheet(
  workbook: ExcelJS.Workbook,
  input: ReportWorkbookInput,
  type: WorkbookTransactionType,
): void {
  const income = type === 'INCOME';
  const title = income ? 'Pemasukan per Kategori' : 'Pengeluaran per Kategori';
  const categories = getWorkbookCategories(input, type, 'Laporan');
  const comparisonCategories = getWorkbookCategories(input, type);
  const total = categories.reduce((sum, category) => sum + category.total, 0n);
  const dataStartRow = 6;
  const dataEndRow = dataStartRow + categories.length - 1;
  const totalRow = Math.max(dataStartRow, dataEndRow + 1);
  const comparisonHeaderRow = Math.max(totalRow + 3, 46);
  const comparisonStartRow = comparisonHeaderRow + 1;
  const comparisonEndRow = comparisonStartRow + comparisonCategories.length - 1;
  const bottomRow = Math.max(52, comparisonEndRow + 5);
  const sheet = workbook.addWorksheet(title, {
    properties: { tabColor: { argb: COLORS.teal }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [
    { width: 13 },
    { width: 13 },
    { width: 13 },
    { width: 13 },
    { width: 13 },
    { width: 13 },
    { width: 34 },
    { width: 22 },
    { width: 16 },
    { width: 22 },
    { width: 38, hidden: true },
    { width: 3 },
  ];
  sheet.mergeCells('A1:F1');
  sheet.mergeCells('G1:J1');
  sheet.mergeCells('A2:F2');
  sheet.mergeCells('G2:J2');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 18,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  sheet.getCell('A2').value = income
    ? 'Rincian sumber pemasukan berdasarkan kategori.'
    : 'Rincian pengeluaran berdasarkan kategori.';
  sheet.getCell('A2').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 10,
    color: { argb: 'FFE1EEEA' },
  };
  sheet.getCell('A2').alignment = { vertical: 'middle', indent: 2 };
  sheet.getCell('G1').value = 'Periode Laporan';
  sheet.getCell('G1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 9,
    bold: true,
    color: { argb: 'FFE1EEEA' },
  };
  sheet.getCell('G1').alignment = {
    vertical: 'middle',
    horizontal: 'right',
    indent: 1,
  };
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: input.timeZone ?? 'Asia/Jakarta',
  };
  sheet.getCell('G2').value =
    `${input.startDate.toLocaleDateString('id-ID', dateOptions)} – ${input.endDate.toLocaleDateString('id-ID', dateOptions)}`;
  sheet.getCell('G2').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 11,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('G2').alignment = {
    vertical: 'middle',
    horizontal: 'right',
    indent: 1,
  };
  for (const rowNumber of [1, 2]) {
    sheet.getRow(rowNumber).height = rowNumber === 1 ? 32 : 24;
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.teal },
      };
    });
  }

  sheet.mergeCells('A4:F4');
  sheet.mergeCells('G4:J4');
  sheet.getCell('A4').value = 'Komposisi Kategori';
  sheet.getCell('G4').value = 'Rincian Kategori';
  for (const address of ['A4', 'G4']) {
    const cell = sheet.getCell(address);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.tealLight },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.teal },
    };
    cell.alignment = { vertical: 'middle', indent: 1 };
  }
  sheet.getRow(4).height = 25;
  sheet.getRow(5).values = [
    null,
    null,
    null,
    null,
    null,
    null,
    'Kategori',
    'Nominal',
    'Persentase',
    'Jumlah Transaksi',
  ];
  styleTableHeader(sheet.getRow(5), COLORS.teal);

  sheet.addTable({
    name: income ? INCOME_CATEGORY_TABLE : EXPENSE_CATEGORY_TABLE,
    ref: 'G5',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium4',
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: [
      { name: 'Kategori', filterButton: true },
      { name: 'Nominal', filterButton: true },
      { name: 'Persentase', filterButton: true },
      { name: 'Jumlah Transaksi', filterButton: true },
      { name: 'ID Kategori', filterButton: true },
    ],
    rows: categories.map(() => [null, null, null, null, null]),
  });
  const amountRange = DETAILS_AMOUNT_RANGE;
  const typeRange = DETAILS_TYPE_RANGE;
  const periodRange = DETAILS_PERIOD_RANGE;
  const categoryRange = DETAILS_CATEGORY_RANGE;
  categories.forEach((category, index) => {
    const rowNumber = dataStartRow + index;
    const categoryFormula = `SUMIFS(${amountRange},${typeRange},"${type}",${periodRange},"Laporan",${categoryRange},K${rowNumber})`;
    const countFormula = `COUNTIFS(${typeRange},"${type}",${periodRange},"Laporan",${categoryRange},K${rowNumber})`;
    sheet.getCell(`G${rowNumber}`).value = category.name;
    sheet.getCell(`H${rowNumber}`).value = excelFormula(
      categoryFormula,
      Number(category.total),
    );
    sheet.getCell(`I${rowNumber}`).value = excelFormula(
      `IFERROR(H${rowNumber}/$H$${totalRow},0)`,
      total === 0n ? 0 : Number(category.total) / Number(total),
    );
    sheet.getCell(`J${rowNumber}`).value = excelFormula(
      countFormula,
      category.count,
    );
    sheet.getCell(`K${rowNumber}`).value = category.id;
  });
  sheet.getCell(`G${totalRow}`).value = 'Total';
  sheet.getCell(`H${totalRow}`).value = excelFormula(
    categories.length > 0 ? `SUM(H${dataStartRow}:H${dataEndRow})` : 'SUM(0)',
    Number(total),
  );
  sheet.getCell(`I${totalRow}`).value = excelFormula(
    categories.length > 0 ? `SUM(I${dataStartRow}:I${dataEndRow})` : 'SUM(0)',
    categories.length > 0 ? 1 : 0,
  );
  sheet.getCell(`J${totalRow}`).value = excelFormula(
    categories.length > 0 ? `SUM(J${dataStartRow}:J${dataEndRow})` : 'SUM(0)',
    categories.reduce((sum, category) => sum + category.count, 0),
  );
  if (categories.length > 0) {
    styleBandedRows(sheet, dataStartRow, dataEndRow, 10);
  }
  styleTotalRow(sheet.getRow(totalRow), 10);
  for (let rowNumber = dataStartRow; rowNumber <= totalRow; rowNumber += 1) {
    sheet.getCell(`H${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`I${rowNumber}`).numFmt =
      REPORT_WORKBOOK_STYLE.numberFormats.percentage;
    sheet.getCell(`J${rowNumber}`).numFmt =
      REPORT_WORKBOOK_STYLE.numberFormats.count;
    sheet.getCell(`G${rowNumber}`).alignment = {
      vertical: 'middle',
      wrapText: true,
    };
    const category = categories[rowNumber - dataStartRow];
    sheet.getRow(rowNumber).height = Math.max(
      22,
      Math.ceil((category?.name.length ?? 1) / 34) * 15,
    );
  }

  const comparisonTotals = new Map(
    comparisonCategories.map((category) => [
      category.id,
      { current: 0n, previous: 0n },
    ]),
  );
  for (const transaction of input.transactions) {
    if (transaction.type !== type) continue;
    const totals = comparisonTotals.get(transaction.categoryId);
    if (!totals) continue;
    totals[transaction.period === 'Laporan' ? 'current' : 'previous'] +=
      transaction.amount;
  }
  sheet.mergeCells(`A${comparisonHeaderRow}:F${comparisonHeaderRow}`);
  sheet.mergeCells(`G${comparisonHeaderRow}:J${comparisonHeaderRow}`);
  sheet.getCell(`A${comparisonHeaderRow}`).value = 'Perbandingan Kategori';
  sheet.getCell(`G${comparisonHeaderRow}`).value =
    'Periode laporan dibanding periode sebelumnya';
  for (const address of [
    `A${comparisonHeaderRow}`,
    `G${comparisonHeaderRow}`,
  ]) {
    const cell = sheet.getCell(address);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.tealLight },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: COLORS.teal },
    };
    cell.alignment = { vertical: 'middle', indent: 1, wrapText: true };
  }
  const comparisonTableHeader = comparisonHeaderRow + 1;
  const comparisonTableEnd =
    comparisonTableHeader + comparisonCategories.length;
  sheet.getRow(comparisonTableHeader).values = [
    null,
    null,
    null,
    null,
    null,
    null,
    'Kategori',
    'Pembanding',
    'Periode Laporan',
    'Selisih',
  ];
  styleTableHeader(sheet.getRow(comparisonTableHeader), COLORS.teal);
  comparisonCategories.forEach((category, index) => {
    const rowNumber = comparisonTableHeader + 1 + index;
    const totals = comparisonTotals.get(category.id);
    if (!totals) {
      throw new Error('Unable to calculate a category comparison total.');
    }
    const criteria = category.id.replaceAll('"', '""');
    const formula = (periodName: WorkbookTransactionPeriod) =>
      `SUMIFS(${amountRange},${typeRange},"${type}",${periodRange},"${periodName}",${categoryRange},"${criteria}")`;
    sheet.getCell(`G${rowNumber}`).value = category.name;
    sheet.getCell(`H${rowNumber}`).value = excelFormula(
      formula('Pembanding'),
      Number(totals.previous),
    );
    sheet.getCell(`I${rowNumber}`).value = excelFormula(
      formula('Laporan'),
      Number(totals.current),
    );
    sheet.getCell(`J${rowNumber}`).value = excelFormula(
      `I${rowNumber}-H${rowNumber}`,
      Number(totals.current - totals.previous),
    );
    setFormulaCache(sheet.getCell(`H${rowNumber}`), Number(totals.previous));
    setFormulaCache(sheet.getCell(`I${rowNumber}`), Number(totals.current));
    setFormulaCache(
      sheet.getCell(`J${rowNumber}`),
      Number(totals.current - totals.previous),
    );
    for (const column of ['H', 'I', 'J']) {
      sheet.getCell(`${column}${rowNumber}`).numFmt = MONEY_FORMAT;
    }
    sheet.getCell(`G${rowNumber}`).alignment = {
      vertical: 'middle',
      wrapText: true,
    };
    sheet.getRow(rowNumber).height = 22;
  });
  const comparisonGrandRow = comparisonTableEnd + 1;
  const previousGrandTotal = comparisonCategories.reduce(
    (sum, category) =>
      sum + (comparisonTotals.get(category.id)?.previous ?? 0n),
    0n,
  );
  const currentGrandTotal = comparisonCategories.reduce(
    (sum, category) => sum + (comparisonTotals.get(category.id)?.current ?? 0n),
    0n,
  );
  sheet.getCell(`G${comparisonGrandRow}`).value = 'Total';
  sheet.getCell(`H${comparisonGrandRow}`).value = excelFormula(
    comparisonCategories.length > 0
      ? `SUM(H${comparisonTableHeader + 1}:H${comparisonTableEnd})`
      : 'SUM(0)',
    Number(previousGrandTotal),
  );
  sheet.getCell(`I${comparisonGrandRow}`).value = excelFormula(
    comparisonCategories.length > 0
      ? `SUM(I${comparisonTableHeader + 1}:I${comparisonTableEnd})`
      : 'SUM(0)',
    Number(currentGrandTotal),
  );
  sheet.getCell(`J${comparisonGrandRow}`).value = excelFormula(
    `I${comparisonGrandRow}-H${comparisonGrandRow}`,
    Number(currentGrandTotal - previousGrandTotal),
  );
  for (const column of ['H', 'I', 'J']) {
    sheet.getCell(`${column}${comparisonGrandRow}`).numFmt = MONEY_FORMAT;
  }
  if (comparisonCategories.length > 0) {
    styleBandedRows(
      sheet,
      comparisonTableHeader + 1,
      comparisonGrandRow - 1,
      10,
    );
    styleTotalRow(sheet.getRow(comparisonGrandRow), 10);
  }

  if (categories.length > 0) {
    const dataBarRule: ExcelJS.DataBarRuleType & {
      color: Partial<ExcelJS.Color>;
    } = {
      type: 'dataBar',
      priority: 1,
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: {
        argb: income ? COLORS.incomeBar : COLORS.expenseBar,
      },
    };
    sheet.addConditionalFormatting({
      ref: `I${dataStartRow}:I${dataEndRow}`,
      rules: [dataBarRule],
    });
  }
  sheet.views = [
    {
      showGridLines: false,
      state: 'frozen',
      ySplit: 5,
      topLeftCell: 'A6',
    },
  ];
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: `A1:J${bottomRow}`,
    printTitlesRow: '1:5',
  };
  applyWorkbookBaseFont(sheet);
}

function setupTransactionSheet(
  workbook: ExcelJS.Workbook,
  input: ReportWorkbookInput,
): void {
  const sheet = workbook.addWorksheet('Rincian Transaksi', {
    properties: { tabColor: { argb: COLORS.navy }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  const referenceIds = transactionReferenceIds(
    input.transactions,
    input.timeZone ?? 'Asia/Jakarta',
  );
  sheet.columns = [
    { width: 22 },
    { width: 18 },
    { width: 20 },
    { width: 30 },
    { width: 42 },
    { width: 24 },
    { width: 15 },
    { width: 20 },
    { width: 40, hidden: true },
    { width: 16, hidden: true },
    { width: 16, hidden: true },
  ];
  const headers = [
    'ID Transaksi',
    'Tanggal',
    'Jenis Transaksi',
    'Kategori',
    'Catatan',
    'Nominal',
    'Mata Uang',
    'Periode Data',
    'ID Kategori',
    'Jenis Data',
    'Kunci Periode',
  ];
  const transactionRows = input.transactions.map((row) => {
    const referenceId = referenceIds.get(row.id);
    if (!referenceId) {
      throw new Error(
        'Unable to generate a transaction reference for the workbook.',
      );
    }
    return [
      referenceId,
      DateHelper.calendarDateInTimezone(
        row.transactionDate,
        input.timeZone ?? 'Asia/Jakarta',
      ),
      row.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
      row.categoryName,
      row.note,
      Number(row.amount),
      'IDR',
      row.period === 'Laporan' ? 'Periode laporan' : 'Data pembanding',
      row.categoryId,
      row.type,
      row.period,
    ];
  });
  sheet.addTable({
    name: 'TransactionDetails',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium4',
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows: transactionRows,
  });
  styleTableHeader(sheet.getRow(1), COLORS.navy);
  sheet.getColumn(1).numFmt = '@';
  const lastRow = Math.max(1, transactionRows.length + 1);
  sheet.views = [
    {
      showGridLines: false,
      state: 'frozen',
      ySplit: 1,
      topLeftCell: 'A2',
    },
  ];
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:H${lastRow}`,
    printTitlesRow: '1:1',
  };
  styleBandedRows(sheet, 2, lastRow, 8);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    sheet.getCell(`A${rowNumber}`).font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: COLORS.muted },
    };
    sheet.getCell(`B${rowNumber}`).numFmt =
      REPORT_WORKBOOK_STYLE.numberFormats.date;
    sheet.getCell(`F${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`D${rowNumber}`).alignment = {
      vertical: 'middle',
      wrapText: true,
    };
    sheet.getCell(`E${rowNumber}`).alignment = {
      vertical: 'middle',
      wrapText: true,
    };
    const transaction = transactionRows[rowNumber - 2];
    const categoryLines = Math.ceil(String(transaction?.[3] ?? '').length / 30);
    const noteLines = Math.ceil(String(transaction?.[4] ?? '').length / 42);
    sheet.getRow(rowNumber).height = Math.min(
      409,
      Math.max(20, Math.max(categoryLines, noteLines) * 15),
    );
  }
  if (transactionRows.length > 0) {
    sheet.addConditionalFormatting({
      ref: `C2:C${lastRow}`,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['$C2="Pemasukan"'],
          style: { font: { color: { argb: COLORS.income } } },
        },
        {
          type: 'expression',
          priority: 2,
          formulae: ['$C2="Pengeluaran"'],
          style: { font: { color: { argb: COLORS.expense } } },
        },
      ],
    });
    sheet.addConditionalFormatting({
      ref: `F2:F${lastRow}`,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['$C2="Pemasukan"'],
          style: { font: { color: { argb: COLORS.income } } },
        },
        {
          type: 'expression',
          priority: 2,
          formulae: ['$C2="Pengeluaran"'],
          style: { font: { color: { argb: COLORS.expense } } },
        },
      ],
    });
  }
  applyWorkbookBaseFont(sheet);
}

function buildNativeCharts(input: ReportWorkbookInput): NativeWorkbookChart[] {
  const trendLabels = input.trend.map((point) => point.period);
  const incomeValues = input.trend.map((point) => Number(BigInt(point.income)));
  const expenseValues = input.trend.map((point) =>
    Number(BigInt(point.expense)),
  );
  const summaryTrendRanges: NativeWorkbookNamedRange[] = [
    {
      name: 'NeracaTrendPeriods',
      formula:
        "OFFSET('Tren Arus Kas'!$A$31,0,0,MAX(1,COUNTA('Tren Arus Kas'!$A$31:$A$1048576)-1),1)",
    },
    {
      name: 'NeracaTrendIncome',
      formula:
        "OFFSET('Tren Arus Kas'!$B$31,0,0,MAX(1,COUNTA('Tren Arus Kas'!$B$31:$B$1048576)-1),1)",
    },
    {
      name: 'NeracaTrendExpense',
      formula:
        "OFFSET('Tren Arus Kas'!$C$31,0,0,MAX(1,COUNTA('Tren Arus Kas'!$C$31:$C$1048576)-1),1)",
    },
  ];
  const summaryTrendCategoryFormula =
    input.trend.length > 0
      ? "'Ringkasan'!NeracaTrendPeriods"
      : `${TREND_TABLE}[Periode]`;
  const summaryTrendSeriesFormula = (name: string, tableColumn: string) =>
    input.trend.length > 0
      ? `'Ringkasan'!${name}`
      : `${TREND_TABLE}[${tableColumn}]`;
  const trendCharts: NativeWorkbookChart[] = [
    {
      sheetIndex: 1,
      title: 'Pemasukan vs Pengeluaran',
      kind: 'bar',
      namedRanges: input.trend.length > 0 ? summaryTrendRanges : undefined,
      anchor: {
        from: { col: 0, row: 10 },
        to: { col: 6, row: 26 },
      },
      categoryFormula: summaryTrendCategoryFormula,
      categories: trendLabels,
      direction: 'column',
      series: [
        {
          name: 'Pemasukan',
          nameFormula: "'Tren Arus Kas'!$B$30",
          formula: summaryTrendSeriesFormula('NeracaTrendIncome', 'Pemasukan'),
          values: incomeValues,
          color: COLORS.incomeBar,
          type: 'bar',
        },
        {
          name: 'Pengeluaran',
          nameFormula: "'Tren Arus Kas'!$C$30",
          formula: summaryTrendSeriesFormula(
            'NeracaTrendExpense',
            'Pengeluaran',
          ),
          values: expenseValues,
          color: COLORS.expenseBar,
          type: 'bar',
        },
      ],
    },
  ];
  for (const type of ['EXPENSE', 'INCOME'] as const) {
    const categories = getWorkbookCategories(input, type, 'Laporan');
    const sheetName =
      type === 'EXPENSE'
        ? 'Pengeluaran per Kategori'
        : 'Pemasukan per Kategori';
    const chartTable =
      type === 'EXPENSE' ? EXPENSE_CATEGORY_TABLE : INCOME_CATEGORY_TABLE;
    const total = categories.reduce(
      (sum, category) => sum + category.total,
      0n,
    );
    trendCharts.push({
      sheetIndex: 1,
      title: type === 'EXPENSE' ? 'Kategori Pengeluaran' : 'Kategori Pemasukan',
      kind: 'doughnut',
      anchor:
        type === 'EXPENSE'
          ? { from: { col: 6, row: 10 }, to: { col: 8, row: 20 } }
          : { from: { col: 6, row: 28 }, to: { col: 8, row: 36 } },
      centerText: {
        value: formatCompactRupiah(total),
        label: type === 'EXPENSE' ? 'Total Pengeluaran' : 'Total Pemasukan',
      },
      categoryFormula: `${chartTable}[Kategori]`,
      categories: categories.map((category) => category.name),
      direction: 'column',
      series: [
        {
          name: 'Nominal',
          nameFormula: `'${sheetName}'!$H$5`,
          formula: `${chartTable}[Nominal]`,
          values: categories.map((category) => Number(category.total)),
          color: type === 'INCOME' ? COLORS.incomeBar : COLORS.expenseBar,
          pointColors: categories.map(
            (_, index) =>
              [
                'FF4E8B70',
                'FF71968A',
                'FF527F78',
                'FF879B8F',
                'FF68818C',
                'FFA9B6AD',
              ][index % 6] ?? COLORS.teal,
          ),
          type: 'bar',
        },
      ],
    });
  }
  {
    trendCharts.push({
      sheetIndex: 2,
      title: 'Pemasukan, Pengeluaran dan Arus Kas Bersih',
      kind: 'bar',
      anchor: {
        from: { col: 0, row: 9 },
        to: { col: 11, row: 26 },
      },
      categoryFormula: `${TREND_TABLE}[Periode]`,
      categories: trendLabels,
      direction: 'column',
      series: [
        {
          name: 'Pemasukan',
          nameFormula: "'Tren Arus Kas'!$B$30",
          formula: `${TREND_TABLE}[Pemasukan]`,
          values: incomeValues,
          color: COLORS.incomeBar,
          type: 'bar',
        },
        {
          name: 'Pengeluaran',
          nameFormula: "'Tren Arus Kas'!$C$30",
          formula: `${TREND_TABLE}[Pengeluaran]`,
          values: expenseValues,
          color: COLORS.expenseBar,
          type: 'bar',
        },
        {
          name: 'Net Cash Flow',
          nameFormula: "'Tren Arus Kas'!$D$30",
          formula: `${TREND_TABLE}[Arus Kas Bersih]`,
          values: input.trend.map((point) => Number(BigInt(point.netCashFlow))),
          color: COLORS.chartNet,
          type: 'line',
        },
      ],
    });
  }

  for (const [sheetIndex, type] of [
    [3, 'EXPENSE'],
    [4, 'INCOME'],
  ] as const) {
    const categories = getWorkbookCategories(input, type, 'Laporan');
    const sheetName =
      type === 'EXPENSE'
        ? 'Pengeluaran per Kategori'
        : 'Pemasukan per Kategori';
    const chartTable =
      type === 'EXPENSE' ? EXPENSE_CATEGORY_TABLE : INCOME_CATEGORY_TABLE;
    const values = categories.map((category) => Number(category.total));
    const labels = categories.map((category) => category.name);
    const categoryFormula = `${chartTable}[Kategori]`;
    const valueFormula = `${chartTable}[Nominal]`;
    const chartTotal = categories.reduce(
      (sum, category) => sum + category.total,
      0n,
    );
    const pointColors = categories.map(
      (_, index) =>
        [
          'FF4E8B70',
          'FF71968A',
          'FF527F78',
          'FF879B8F',
          'FF68818C',
          'FFA9B6AD',
        ][index % 6] ?? COLORS.teal,
    );
    const chartSeries = {
      name: 'Nominal',
      nameFormula: `'${sheetName}'!$H$5`,
      formula: valueFormula,
      values,
      color: type === 'INCOME' ? COLORS.incomeBar : COLORS.expenseBar,
      type: 'bar' as const,
    };
    trendCharts.push({
      sheetIndex,
      title:
        type === 'INCOME' ? 'Komposisi Pemasukan' : 'Komposisi Pengeluaran',
      kind: 'doughnut',
      anchor: {
        from: { col: 0, row: 5 },
        to: { col: 6, row: 21 },
      },
      centerText: {
        value: formatCompactRupiah(chartTotal),
        label: type === 'INCOME' ? 'Total Pemasukan' : 'Total Pengeluaran',
      },
      categoryFormula,
      categories: labels,
      direction: 'column',
      series: [{ ...chartSeries, pointColors }],
    });
    trendCharts.push({
      sheetIndex,
      title:
        type === 'INCOME'
          ? 'Nominal Pemasukan per Kategori'
          : 'Nominal Pengeluaran per Kategori',
      kind: 'bar',
      anchor: {
        from: {
          col: 0,
          row: 22,
        },
        to: {
          col: 6,
          row: 40,
        },
      },
      categoryFormula,
      categories: labels,
      direction: 'bar',
      series: [chartSeries],
    });
  }
  return trendCharts;
}

export async function buildReportWorkbook(
  input: ReportWorkbookInput,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Neraca';
  workbook.title = 'Neraca';
  workbook.subject = 'Laporan Keuangan Pribadi';
  workbook.created = input.generatedAt;
  workbook.modified = input.generatedAt;
  workbook.calcProperties = { fullCalcOnLoad: true };

  setupSummarySheet(workbook, input);
  setupTrendSheet(workbook, input);
  setupCategorySheet(workbook, input, 'EXPENSE');
  setupCategorySheet(workbook, input, 'INCOME');
  setupTransactionSheet(workbook, input);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return addNativeWorkbookCharts(buffer, buildNativeCharts(input));
}
