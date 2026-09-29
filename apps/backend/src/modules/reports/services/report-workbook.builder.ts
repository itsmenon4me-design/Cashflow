import ExcelJS from 'exceljs';
import { DateHelper } from '../../../common/utils/date.util';
import {
  applyWorkbookBaseFont,
  REPORT_WORKBOOK_STYLE,
  styleBandedRows,
  styleTableHeader,
  styleTotalRow,
} from './report-export.styles';

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
    properties: { tabColor: { argb: COLORS.navy }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = Array.from({ length: 12 }, () => ({ width: 15 }));
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
  };
  sheet.mergeCells('A1:L1');
  sheet.getCell('A1').value = 'Laporan Keuangan';
  sheet.getCell('A1').font = {
    name: REPORT_WORKBOOK_STYLE.font,
    size: 20,
    bold: true,
    color: { argb: COLORS.navy },
  };
  sheet.getRow(1).height = 32;

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
      fill: COLORS.income,
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
      fill: COLORS.expense,
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
      fill: COLORS.net,
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
      fill: COLORS.neutral,
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
          fgColor: { argb: card.fill },
        };
        cell.font = {
          name: REPORT_WORKBOOK_STYLE.font,
          color: { argb: COLORS.white },
          bold: rowNumber !== 7,
          size: rowNumber === 5 ? 16 : 10,
          italic: rowNumber === 7,
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
      }
    }
    label.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: COLORS.white },
      bold: true,
      size: 10,
    };
    value.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: COLORS.white },
      bold: true,
      size: 16,
    };
    value.numFmt = card.isCount
      ? REPORT_WORKBOOK_STYLE.numberFormats.count
      : MONEY_FORMAT;
    change.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: COLORS.white },
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
  sheet.getRow(tableHeaderRow).values = ['Metrik', 'Nilai', 'Perubahan'];
  styleTableHeader(sheet.getRow(tableHeaderRow), COLORS.navy);
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
  summaryRows.forEach((values) => sheet.addRow(values));
  for (let rowNumber = 11; rowNumber <= 14; rowNumber += 1) {
    sheet.getCell(`B${rowNumber}`).numFmt =
      rowNumber === 14
        ? REPORT_WORKBOOK_STYLE.numberFormats.count
        : MONEY_FORMAT;
    sheet.getRow(rowNumber).height = 30;
  }
  styleBandedRows(sheet, 11, 14, 3);
  sheet.autoFilter = 'A10:C14';
  sheet.getCell('B11').numFmt = MONEY_FORMAT;
  sheet.getCell('B12').numFmt = MONEY_FORMAT;
  sheet.getCell('B13').numFmt = MONEY_FORMAT;
  sheet.getCell('B14').numFmt = REPORT_WORKBOOK_STYLE.numberFormats.count;
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
    properties: { tabColor: { argb: COLORS.navy }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [{ width: 18 }, { width: 22 }, { width: 22 }, { width: 23 }];
  sheet.addRow(['Periode', 'Pemasukan', 'Pengeluaran', 'Arus Kas Bersih']);
  styleTableHeader(sheet.getRow(1), COLORS.navy);
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
      color: { argb: COLORS.navy },
    };
  }
  applyWorkbookBaseFont(sheet);
}

function setupCategorySheet(
  workbook: ExcelJS.Workbook,
  input: ReportWorkbookInput,
  type: WorkbookTransactionType,
  sourceEndRow: number,
): void {
  const isIncome = type === 'INCOME';
  const title = isIncome
    ? 'Pemasukan per Kategori'
    : 'Pengeluaran per Kategori';
  const fill = isIncome ? COLORS.income : COLORS.expense;
  const sheet = workbook.addWorksheet(title, {
    properties: { tabColor: { argb: fill }, defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [
    { width: 32 },
    { width: 22 },
    { width: 20 },
    { width: 20 },
    { width: 38 },
  ];
  sheet.addRow([
    'Kategori',
    'Total',
    'Persentase',
    'Jumlah Transaksi',
    'ID Kategori',
  ]);
  styleTableHeader(sheet.getRow(1), fill);
  const categoryMap = new Map<
    string,
    { name: string; total: bigint; count: number }
  >();
  for (const transaction of input.transactions) {
    if (transaction.period !== 'Laporan' || transaction.type !== type) continue;
    const category = categoryMap.get(transaction.categoryId) ?? {
      name: transaction.categoryName,
      total: 0n,
      count: 0,
    };
    category.total += transaction.amount;
    category.count += 1;
    categoryMap.set(transaction.categoryId, category);
  }
  const categories = Array.from(categoryMap.entries()).sort((a, b) =>
    a[1].total > b[1].total
      ? -1
      : a[1].total < b[1].total
        ? 1
        : a[1].name.localeCompare(b[1].name, 'id'),
  );
  const amountRange = `${DETAILS_SHEET}!$F$2:$F$${sourceEndRow}`;
  const typeRange = `${DETAILS_SHEET}!${DETAILS_TYPE_RANGE}${sourceEndRow}`;
  const periodRange = `${DETAILS_SHEET}!${DETAILS_PERIOD_RANGE}${sourceEndRow}`;
  const categoryRange = `${DETAILS_SHEET}!$I$2:$I$${sourceEndRow}`;
  const firstDataRow = 2;
  categories.forEach(([id, category]) => {
    const rowNumber = sheet.rowCount + 1;
    const categoryFormula = `SUMIFS(${amountRange},${typeRange},"${type}",${periodRange},"Laporan",${categoryRange},E${rowNumber})`;
    const countFormula = `COUNTIFS(${typeRange},"${type}",${periodRange},"Laporan",${categoryRange},E${rowNumber})`;
    const allTypeTotal = categories.reduce(
      (sum, [, row]) => sum + row.total,
      0n,
    );
    sheet.addRow([
      category.name,
      excelFormula(categoryFormula, Number(category.total)),
      excelFormula(
        `IFERROR(B${rowNumber}/$B$${categories.length + 2},0)`,
        allTypeTotal === 0n ? 0 : Number(category.total) / Number(allTypeTotal),
      ),
      excelFormula(countFormula, category.count),
      id,
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
  const allTypeTotal = categories.reduce((sum, [, row]) => sum + row.total, 0n);
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
      categories.reduce((sum, [, row]) => sum + row.count, 0),
    ),
    '',
  ]);
  sheet.getColumn(5).hidden = true;
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
  }
  if (categories.length > 0) {
    const dataBarRule: ExcelJS.DataBarRuleType & {
      color: Partial<ExcelJS.Color>;
    } = {
      type: 'dataBar',
      priority: 1,
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: { argb: isIncome ? COLORS.incomeBar : COLORS.expenseBar },
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
  sheet.columns = [
    { width: 39 },
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
  const transactionRows = input.transactions.map((row) => [
    row.id,
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
  ]);
  transactionRows.forEach((row) => sheet.addRow(row));
  if (transactionRows.length === 0) sheet.addRow([]);
  const lastRow = Math.max(1, transactionRows.length + 1);
  applyTableView(sheet, `A1:H${lastRow}`);
  styleBandedRows(sheet, 2, lastRow, 8);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    sheet.getCell(`A${rowNumber}`).font = {
      name: REPORT_WORKBOOK_STYLE.font,
      color: { argb: COLORS.muted },
    };
    sheet.getCell(`B${rowNumber}`).numFmt =
      REPORT_WORKBOOK_STYLE.numberFormats.date;
    sheet.getCell(`F${rowNumber}`).numFmt = MONEY_FORMAT;
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

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
