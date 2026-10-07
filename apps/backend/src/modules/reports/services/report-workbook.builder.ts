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
const DETAILS_SHEET = "'Rincian Transaksi'";
const DETAILS_TYPE_RANGE = `$J$2:$J$`;
const DETAILS_PERIOD_RANGE = `$K$2:$K$`;
const TRANSACTION_REFERENCE_SUFFIX_MODULUS = 100_000_000;

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

function applyTableView(worksheet: ExcelJS.Worksheet, filter: string): void {
  worksheet.views = [
    {
      showGridLines: false,
      state: 'frozen',
      ySplit: 1,
      topLeftCell: 'A2',
    },
  ];
  worksheet.autoFilter = filter;
}

function setupSummarySheet(
  workbook: ExcelJS.Workbook,
  input: ReportWorkbookInput,
  sourceEndRow: number,
): void {
  const sheet = workbook.addWorksheet('Ringkasan', {
    properties: { tabColor: { argb: COLORS.teal }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = Array.from({ length: 12 }, () => ({ width: 15 }));
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 2,
    printArea: 'A1:L41',
  };
  sheet.mergeCells('A1:L1');
  sheet.getCell('A1').value = 'NERACA | LAPORAN KEUANGAN';
  sheet.getCell('A1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 20,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 38;
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.teal },
    };
  });

  const timeZone = input.timeZone ?? 'Asia/Jakarta';
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone,
  };
  const periodText = `${input.startDate.toLocaleDateString('id-ID', dateOptions)} - ${input.endDate.toLocaleDateString('id-ID', dateOptions)}`;
  const comparisonText = `${input.previousStartDate.toLocaleDateString('id-ID', dateOptions)} - ${input.previousEndDate.toLocaleDateString('id-ID', dateOptions)}`;
  const generatedText = input.generatedAt.toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  });
  sheet.mergeCells('A2:L2');
  sheet.getCell('A2').value =
    `Periode: ${periodText} | Pembanding: ${comparisonText} | Dibuat: ${generatedText}`;
  sheet.getCell('A2').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 10,
    color: { argb: COLORS.muted },
  };
  sheet.getCell('A2').alignment = {
    vertical: 'middle',
    wrapText: true,
    indent: 1,
  };
  sheet.getRow(2).height = 30;
  sheet.getRow(2).eachCell({ includeEmpty: true }, (cell) => {
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
    sheet.mergeCells('A9:L9');
    sheet.getCell('A9').value = 'Belum ada transaksi pada periode laporan.';
    sheet.getCell('A9').font = {
      name: REPORT_WORKBOOK_STYLE.font,
      italic: true,
      color: { argb: COLORS.muted },
    };
  }

  const amountRange = `${DETAILS_SHEET}!$F$2:$F$${sourceEndRow}`;
  const typeRange = `${DETAILS_SHEET}!${DETAILS_TYPE_RANGE}${sourceEndRow}`;
  const periodRange = `${DETAILS_SHEET}!${DETAILS_PERIOD_RANGE}${sourceEndRow}`;
  const incomeFormula = sumRange(
    'INCOME',
    'Laporan',
    amountRange,
    typeRange,
    periodRange,
  );
  const expenseFormula = sumRange(
    'EXPENSE',
    'Laporan',
    amountRange,
    typeRange,
    periodRange,
  );
  const comparisonIncomeFormula = sumRange(
    'INCOME',
    'Pembanding',
    amountRange,
    typeRange,
    periodRange,
  );
  const comparisonExpenseFormula = sumRange(
    'EXPENSE',
    'Pembanding',
    amountRange,
    typeRange,
    periodRange,
  );
  const comparisonCountFormula = `COUNTIF(${periodRange},"Pembanding")`;
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
      formula: `=COUNTIF(${periodRange},"Laporan")`,
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

  const tableHeaderRow = 10;
  sheet.addRow([]);
  sheet.getRow(tableHeaderRow).values = [
    'Metrik',
    null,
    'Nilai',
    null,
    'Perubahan',
    null,
  ];
  sheet.mergeCells('A10:B10');
  sheet.mergeCells('C10:D10');
  sheet.mergeCells('E10:F10');
  styleTableHeader(sheet.getRow(tableHeaderRow), COLORS.teal);
  const summaryRows = [
    [
      'Total Pemasukan',
      { formula: 'A5', result: Number(cards[0].result) },
      {
        formula: 'A7',
        result:
          sheet.getCell('A7').value &&
          typeof sheet.getCell('A7').value === 'object'
            ? (sheet.getCell('A7').value as ExcelJS.CellFormulaValue).result
            : '',
      },
    ],
    [
      'Total Pengeluaran',
      { formula: 'D5', result: Number(cards[1].result) },
      {
        formula: 'D7',
        result:
          sheet.getCell('D7').value &&
          typeof sheet.getCell('D7').value === 'object'
            ? (sheet.getCell('D7').value as ExcelJS.CellFormulaValue).result
            : '',
      },
    ],
    [
      'Arus Kas Bersih',
      { formula: 'G5', result: Number(cards[2].result) },
      {
        formula: 'G7',
        result:
          sheet.getCell('G7').value &&
          typeof sheet.getCell('G7').value === 'object'
            ? (sheet.getCell('G7').value as ExcelJS.CellFormulaValue).result
            : '',
      },
    ],
    [
      'Jumlah Transaksi',
      { formula: 'J5', result: Number(cards[3].result) },
      {
        formula: 'J7',
        result:
          sheet.getCell('J7').value &&
          typeof sheet.getCell('J7').value === 'object'
            ? (sheet.getCell('J7').value as ExcelJS.CellFormulaValue).result
            : '',
      },
    ],
  ];
  summaryRows.forEach((values) =>
    sheet.addRow([values[0], null, values[1], null, values[2], null]),
  );
  for (let rowNumber = 11; rowNumber <= 14; rowNumber += 1) {
    sheet.mergeCells(`A${rowNumber}:B${rowNumber}`);
    sheet.mergeCells(`C${rowNumber}:D${rowNumber}`);
    sheet.mergeCells(`E${rowNumber}:F${rowNumber}`);
    sheet.getCell(`C${rowNumber}`).numFmt =
      rowNumber === 14
        ? REPORT_WORKBOOK_STYLE.numberFormats.count
        : MONEY_FORMAT;
    sheet.getRow(rowNumber).height = 30;
  }
  styleBandedRows(sheet, 11, 14, 6);

  const topExpenseCategories = getWorkbookCategories(
    input,
    'EXPENSE',
    'Laporan',
  ).slice(0, 5);
  const topIncomeCategories = getWorkbookCategories(
    input,
    'INCOME',
    'Laporan',
  ).slice(0, 5);
  sheet.mergeCells('G10:I10');
  sheet.mergeCells('J10:L10');
  sheet.getCell('G10').value = 'Pengeluaran per Kategori';
  sheet.getCell('J10').value = 'Pemasukan per Kategori';
  for (const address of ['G10', 'J10']) {
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
  sheet.getRow(11).height = 24;
  ['G', 'H', 'I', 'J', 'K', 'L'].forEach((column) => {
    const cell = sheet.getCell(`${column}11`);
    cell.value =
      column === 'G' || column === 'J'
        ? 'Kategori'
        : column === 'H' || column === 'K'
          ? 'Persentase'
          : 'Nominal';
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
    firstColumn: 'G' | 'J',
  ) => {
    const sheetName =
      type === 'EXPENSE'
        ? 'Pengeluaran per Kategori'
        : 'Pemasukan per Kategori';
    const grandTotal = getWorkbookCategories(input, type, 'Laporan').reduce(
      (sum, category) => sum + category.total,
      0n,
    );
    const columns =
      firstColumn === 'G'
        ? { name: 'G', percentage: 'H', amount: 'I' }
        : { name: 'J', percentage: 'K', amount: 'L' };
    for (let index = 0; index < 5; index += 1) {
      const rowNumber = index + 12;
      const category = categories[index];
      const cellValues = category
        ? {
            name: excelFormula(`'${sheetName}'!A${index + 2}`, category.name),
            percentage: excelFormula(
              `'${sheetName}'!C${index + 2}`,
              grandTotal === 0n
                ? 0
                : Number(category.total) / Number(grandTotal),
            ),
            amount: excelFormula(
              `'${sheetName}'!B${index + 2}`,
              Number(category.total),
            ),
          }
        : { name: '-', percentage: 0, amount: 0 };
      sheet.getCell(`${columns.name}${rowNumber}`).value = cellValues.name;
      sheet.getCell(`${columns.percentage}${rowNumber}`).value =
        cellValues.percentage;
      sheet.getCell(`${columns.amount}${rowNumber}`).value = cellValues.amount;
      sheet.getCell(`${columns.percentage}${rowNumber}`).numFmt =
        REPORT_WORKBOOK_STYLE.numberFormats.percentage;
      sheet.getCell(`${columns.amount}${rowNumber}`).numFmt = MONEY_FORMAT;
      for (const column of Object.values(columns)) {
        const cell = sheet.getCell(`${column}${rowNumber}`);
        cell.alignment = {
          vertical: 'middle',
          horizontal: column === columns.name ? 'left' : 'right',
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
  fillCategorySummary(topExpenseCategories, 'EXPENSE', 'G');
  fillCategorySummary(topIncomeCategories, 'INCOME', 'J');

  sheet.mergeCells('A36:F36');
  sheet.getCell('A36').value = 'Perbandingan Periode';
  sheet.getCell('A36').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.teal },
  };
  sheet.getCell('A36').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    bold: true,
    color: { argb: COLORS.white },
  };
  sheet.getCell('A36').alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(36).height = 26;
  sheet.getRow(37).values = [
    'Metrik',
    null,
    'Pembanding',
    'Periode Laporan',
    'Selisih',
    'Perubahan',
  ];
  sheet.mergeCells('A37:B37');
  styleTableHeader(sheet.getRow(37), COLORS.teal);
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
    const rowNumber = index + 38;
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
      comparison.change,
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
    sheet.getRow(rowNumber).height = 26;
  });
  styleBandedRows(sheet, 38, 41, 6);
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
  sourceEndRow: number,
): void {
  const sheet = workbook.addWorksheet('Tren Arus Kas', {
    properties: { tabColor: { argb: COLORS.teal }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [{ width: 18 }, { width: 22 }, { width: 22 }, { width: 23 }];
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
  };
  sheet.addRow(['Periode', 'Pemasukan', 'Pengeluaran', 'Arus Kas Bersih']);
  styleTableHeader(sheet.getRow(1), COLORS.teal);
  applyTableView(sheet, `A1:D${Math.max(1, input.trend.length + 1)}`);

  const amountRange = `${DETAILS_SHEET}!$F$2:$F$${sourceEndRow}`;
  const typeRange = `${DETAILS_SHEET}!${DETAILS_TYPE_RANGE}${sourceEndRow}`;
  const periodRange = `${DETAILS_SHEET}!${DETAILS_PERIOD_RANGE}${sourceEndRow}`;
  const dateRange = `${DETAILS_SHEET}!$B$2:$B$${sourceEndRow}`;
  input.trend.forEach((point) => {
    const rowNumber = sheet.rowCount + 1;
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
    sheet.addRow([
      point.period,
      excelFormula(incomeFormula, Number(BigInt(point.income))),
      excelFormula(expenseFormula, Number(BigInt(point.expense))),
      excelFormula(
        `B${rowNumber}-C${rowNumber}`,
        Number(BigInt(point.netCashFlow)),
      ),
    ]);
    setFormulaCache(sheet.getCell(rowNumber, 2), Number(BigInt(point.income)));
    setFormulaCache(sheet.getCell(rowNumber, 3), Number(BigInt(point.expense)));
    setFormulaCache(
      sheet.getCell(rowNumber, 4),
      Number(BigInt(point.netCashFlow)),
    );
  });

  const totalRowNumber = sheet.rowCount + 1;
  const incomeTotal = input.trend.reduce(
    (sum, point) => sum + BigInt(point.income),
    0n,
  );
  const expenseTotal = input.trend.reduce(
    (sum, point) => sum + BigInt(point.expense),
    0n,
  );
  const totalIncomeFormula =
    input.trend.length > 0 ? `SUM(B2:B${totalRowNumber - 1})` : 'SUM(0)';
  const totalExpenseFormula =
    input.trend.length > 0 ? `SUM(C2:C${totalRowNumber - 1})` : 'SUM(0)';
  sheet.addRow([
    'Total',
    excelFormula(totalIncomeFormula, Number(incomeTotal)),
    excelFormula(totalExpenseFormula, Number(expenseTotal)),
    excelFormula(
      `B${totalRowNumber}-C${totalRowNumber}`,
      Number(incomeTotal - expenseTotal),
    ),
  ]);
  styleBandedRows(sheet, 2, totalRowNumber - 1, 4);
  styleTotalRow(sheet.getRow(totalRowNumber), 4);
  for (let rowNumber = 2; rowNumber <= totalRowNumber; rowNumber += 1) {
    sheet.getCell(`B${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`C${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`D${rowNumber}`).numFmt = MONEY_FORMAT;
  }
  for (let rowNumber = 2; rowNumber <= totalRowNumber; rowNumber += 1) {
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
  sourceEndRow: number,
): void {
  const title =
    type === 'INCOME' ? 'Pemasukan per Kategori' : 'Pengeluaran per Kategori';
  const sheet = workbook.addWorksheet(title, {
    properties: { tabColor: { argb: COLORS.teal }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [
    { width: 36 },
    { width: 22 },
    { width: 16 },
    { width: 22 },
    { width: 38, hidden: true },
    { width: 3 },
    { width: 36 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
  ];
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
  };
  sheet.addRow([
    'Kategori',
    'Total',
    'Persentase',
    'Jumlah Transaksi',
    'ID Kategori',
    null,
    'Kategori',
    'Pembanding',
    'Periode Laporan',
    'Perubahan',
  ]);
  styleTableHeader(sheet.getRow(1), COLORS.teal);

  const categories = getWorkbookCategories(input, type, 'Laporan');
  const comparisonCategories = getWorkbookCategories(input, type);
  const amountRange = `${DETAILS_SHEET}!$F$2:$F$${sourceEndRow}`;
  const typeRange = `${DETAILS_SHEET}!${DETAILS_TYPE_RANGE}${sourceEndRow}`;
  const periodRange = `${DETAILS_SHEET}!${DETAILS_PERIOD_RANGE}${sourceEndRow}`;
  const categoryRange = `${DETAILS_SHEET}!$I$2:$I$${sourceEndRow}`;
  const firstDataRow = 2;
  const allTypeTotal = categories.reduce((sum, row) => sum + row.total, 0n);
  categories.forEach((category) => {
    const rowNumber = sheet.rowCount + 1;
    const categoryFormula = `SUMIFS(${amountRange},${typeRange},"${type}",${periodRange},"Laporan",${categoryRange},E${rowNumber})`;
    const countFormula = `COUNTIFS(${typeRange},"${type}",${periodRange},"Laporan",${categoryRange},E${rowNumber})`;
    sheet.addRow([
      category.name,
      excelFormula(categoryFormula, Number(category.total)),
      excelFormula(
        `IFERROR(B${rowNumber}/$B$${categories.length + 2},0)`,
        allTypeTotal === 0n ? 0 : Number(category.total) / Number(allTypeTotal),
      ),
      excelFormula(countFormula, category.count),
      category.id,
    ]);
  });
  if (categories.length === 0) {
    sheet.addRow([
      '',
      excelFormula('0', 0),
      excelFormula('0', 0),
      excelFormula('0', 0),
      '',
    ]);
  }
  const totalRowNumber = sheet.rowCount + 1;
  const finalDataRow = Math.max(firstDataRow, totalRowNumber - 1);
  sheet.addRow([
    'Total',
    excelFormula(
      `SUM(B${firstDataRow}:B${finalDataRow})`,
      Number(allTypeTotal),
    ),
    excelFormula(
      `SUM(C${firstDataRow}:C${finalDataRow})`,
      categories.length === 0 ? 0 : 1,
    ),
    excelFormula(
      `SUM(D${firstDataRow}:D${finalDataRow})`,
      categories.reduce((sum, row) => sum + row.count, 0),
    ),
    '',
  ]);
  applyTableView(sheet, `A1:D${totalRowNumber - 1}`);
  styleBandedRows(sheet, firstDataRow, totalRowNumber - 1, 4);
  styleTotalRow(sheet.getRow(totalRowNumber), 4);
  for (
    let rowNumber = firstDataRow;
    rowNumber <= totalRowNumber;
    rowNumber += 1
  ) {
    sheet.getCell(`B${rowNumber}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`C${rowNumber}`).numFmt =
      REPORT_WORKBOOK_STYLE.numberFormats.percentage;
    sheet.getCell(`D${rowNumber}`).numFmt =
      REPORT_WORKBOOK_STYLE.numberFormats.count;
    sheet.getCell(`A${rowNumber}`).alignment = {
      vertical: 'middle',
      wrapText: true,
    };
    const category = categories[rowNumber - firstDataRow];
    sheet.getRow(rowNumber).height = Math.max(
      20,
      Math.ceil((category?.name.length ?? 0) / 36) * 15,
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
  comparisonCategories.forEach((category, index) => {
    const rowNumber = index + 2;
    const totals = comparisonTotals.get(category.id);
    if (!totals) {
      throw new Error('Unable to calculate a category comparison total.');
    }
    const comparisonFormula = (periodName: WorkbookTransactionPeriod) =>
      `SUMIFS(${amountRange},${typeRange},"${type}",${periodRange},"${periodName}",${categoryRange},${category.id})`;
    sheet.getCell(`G${rowNumber}`).value = category.name;
    sheet.getCell(`H${rowNumber}`).value = excelFormula(
      comparisonFormula('Pembanding'),
      Number(totals.previous),
    );
    sheet.getCell(`I${rowNumber}`).value = excelFormula(
      comparisonFormula('Laporan'),
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
  });
  const comparisonTotalRow = comparisonCategories.length + 2;
  if (comparisonCategories.length > 0) {
    const previousGrandTotal = comparisonCategories.reduce(
      (sum, row) => sum + (comparisonTotals.get(row.id)?.previous ?? 0n),
      0n,
    );
    sheet.getCell(`G${comparisonTotalRow}`).value = 'Total';
    sheet.getCell(`H${comparisonTotalRow}`).value = excelFormula(
      `SUM(H2:H${comparisonTotalRow - 1})`,
      Number(previousGrandTotal),
    );
    sheet.getCell(`I${comparisonTotalRow}`).value = excelFormula(
      `SUM(I2:I${comparisonTotalRow - 1})`,
      Number(allTypeTotal),
    );
    sheet.getCell(`J${comparisonTotalRow}`).value = excelFormula(
      `I${comparisonTotalRow}-H${comparisonTotalRow}`,
      Number(allTypeTotal - previousGrandTotal),
    );
    for (let rowNumber = 2; rowNumber < comparisonTotalRow; rowNumber += 1) {
      for (let column = 7; column <= 10; column += 1) {
        const cell = sheet.getRow(rowNumber).getCell(column);
        if (rowNumber % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.band },
          };
        }
        cell.border = {
          bottom: { style: 'hair', color: { argb: COLORS.border } },
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    }
    for (let column = 7; column <= 10; column += 1) {
      const cell = sheet.getRow(comparisonTotalRow).getCell(column);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.total },
      };
      cell.font = {
        ...cell.font,
        bold: true,
        color: { argb: COLORS.text },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
      };
    }
    for (const column of ['H', 'I', 'J']) {
      sheet.getCell(`${column}${comparisonTotalRow}`).numFmt = MONEY_FORMAT;
    }
  }

  if (categories.length > 0) {
    const dataBarRule: ExcelJS.DataBarRuleType & {
      color: Partial<ExcelJS.Color>;
    } = {
      type: 'dataBar',
      priority: 1,
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: {
        argb: type === 'INCOME' ? COLORS.incomeBar : COLORS.expenseBar,
      },
    };
    sheet.addConditionalFormatting({
      ref: `C${firstDataRow}:C${totalRowNumber - 1}`,
      rules: [dataBarRule],
    });
  }
  applyWorkbookBaseFont(sheet);
}

function setupTransactionSheet(
  workbook: ExcelJS.Workbook,
  input: ReportWorkbookInput,
): number {
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
  sheet.addRow([
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
  ]);
  styleTableHeader(sheet.getRow(1), COLORS.navy);
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
  transactionRows.forEach((row) => sheet.addRow(row));
  sheet.getColumn(1).numFmt = '@';
  if (transactionRows.length === 0) sheet.addRow([]);
  const lastRow = Math.max(1, transactionRows.length + 1);
  applyTableView(sheet, `A1:H${lastRow}`);
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
  return Math.max(2, lastRow);
}

function buildNativeCharts(input: ReportWorkbookInput): NativeWorkbookChart[] {
  const trendEndRow = Math.max(2, input.trend.length + 1);
  const trendLabels =
    input.trend.length > 0
      ? input.trend.map((point) => point.period)
      : ['Total'];
  const incomeValues =
    input.trend.length > 0
      ? input.trend.map((point) => Number(BigInt(point.income)))
      : [0];
  const expenseValues =
    input.trend.length > 0
      ? input.trend.map((point) => Number(BigInt(point.expense)))
      : [0];
  const trendCharts: NativeWorkbookChart[] = [
    {
      sheetIndex: 1,
      title: 'Pemasukan vs Pengeluaran',
      anchor: {
        from: { col: 0, row: 17 },
        to: { col: 12, row: 34 },
      },
      categoryFormula: `'Tren Arus Kas'!$A$2:$A$${trendEndRow}`,
      categories: trendLabels,
      direction: 'column',
      series: [
        {
          name: 'Pemasukan',
          nameFormula: "'Tren Arus Kas'!$B$1",
          formula: `'Tren Arus Kas'!$B$2:$B$${trendEndRow}`,
          values: incomeValues,
          color: COLORS.incomeBar,
          type: 'bar',
        },
        {
          name: 'Pengeluaran',
          nameFormula: "'Tren Arus Kas'!$C$1",
          formula: `'Tren Arus Kas'!$C$2:$C$${trendEndRow}`,
          values: expenseValues,
          color: COLORS.expenseBar,
          type: 'bar',
        },
      ],
    },
  ];
  if (input.trend.length > 0) {
    const trendEndOfData = input.trend.length + 1;
    trendCharts.push({
      sheetIndex: 2,
      title: 'Tren Arus Kas',
      anchor: {
        from: { col: 0, row: input.trend.length + 3 },
        to: { col: 11, row: input.trend.length + 24 },
      },
      categoryFormula: `'Tren Arus Kas'!$A$2:$A$${trendEndOfData}`,
      categories: trendLabels,
      direction: 'column',
      series: [
        {
          name: 'Pemasukan',
          nameFormula: "'Tren Arus Kas'!$B$1",
          formula: `'Tren Arus Kas'!$B$2:$B$${trendEndOfData}`,
          values: incomeValues,
          color: COLORS.incomeBar,
          type: 'bar',
        },
        {
          name: 'Pengeluaran',
          nameFormula: "'Tren Arus Kas'!$C$1",
          formula: `'Tren Arus Kas'!$C$2:$C$${trendEndOfData}`,
          values: expenseValues,
          color: COLORS.expenseBar,
          type: 'bar',
        },
        {
          name: 'Arus Kas Bersih',
          nameFormula: "'Tren Arus Kas'!$D$1",
          formula: `'Tren Arus Kas'!$D$2:$D$${trendEndOfData}`,
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
    if (categories.length === 0) continue;
    const sheetName =
      type === 'EXPENSE'
        ? 'Pengeluaran per Kategori'
        : 'Pemasukan per Kategori';
    const comparisonCount = getWorkbookCategories(input, type).length;
    const lastRow = categories.length + 1;
    trendCharts.push({
      sheetIndex,
      title: sheetName,
      anchor: {
        from: {
          col: 0,
          row: Math.max(lastRow + 2, comparisonCount + 3),
        },
        to: {
          col: 9,
          row: Math.max(lastRow + 23, comparisonCount + 24),
        },
      },
      categoryFormula: `'${sheetName}'!$A$2:$A$${lastRow}`,
      categories: categories.map((category) => category.name),
      direction: 'bar',
      series: [
        {
          name: 'Total',
          nameFormula: `'${sheetName}'!$B$1`,
          formula: `'${sheetName}'!$B$2:$B$${lastRow}`,
          values: categories.map((category) => Number(category.total)),
          color: type === 'INCOME' ? COLORS.incomeBar : COLORS.expenseBar,
          type: 'bar',
        },
      ],
    });
  }
  return trendCharts;
}

export async function buildReportWorkbook(
  input: ReportWorkbookInput,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CashFlow';
  workbook.created = input.generatedAt;
  workbook.modified = input.generatedAt;
  workbook.calcProperties = { fullCalcOnLoad: true };

  const sourceEndRow = Math.max(2, input.transactions.length + 1);
  setupSummarySheet(workbook, input, sourceEndRow);
  setupTrendSheet(workbook, input, sourceEndRow);
  setupCategorySheet(workbook, input, 'EXPENSE', sourceEndRow);
  setupCategorySheet(workbook, input, 'INCOME', sourceEndRow);
  setupTransactionSheet(workbook, input);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return addNativeWorkbookCharts(buffer, buildNativeCharts(input));
}
