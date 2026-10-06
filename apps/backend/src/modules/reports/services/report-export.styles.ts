import type ExcelJS from 'exceljs';

export const REPORT_WORKBOOK_STYLE = {
  font: 'Arial',
  colors: {
    navy: 'FF17324D',
    income: 'FF177245',
    expense: 'FFB42318',
    net: 'FF2457A7',
    neutral: 'FF586575',
    white: 'FFFFFFFF',
    text: 'FF263445',
    muted: 'FF586575',
    border: 'FFD7DEE7',
    band: 'FFF3F6F9',
    total: 'FFE7ECF1',
    incomeBar: 'FF72B78F',
    expenseBar: 'FFE58A82',
    chartIncome: 'FF668B7B',
    chartExpense: 'FFB17C77',
    chartNet: 'FF17324D',
    chartGrid: 'FFE2E8EF',
    chartTrack: 'FFF0F3F6',
  },
  numberFormats: {
    idr: '"Rp" #,##0;[Red]-"Rp" #,##0;"Rp" 0',
    count: '#,##0',
    percentage: '0.00%',
    date: 'dd mmm yyyy',
  },
} as const;

export function applyWorkbookBaseFont(worksheet: ExcelJS.Worksheet): void {
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { ...cell.font, name: REPORT_WORKBOOK_STYLE.font };
    });
  });
}

export function styleTableHeader(
  row: ExcelJS.Row,
  fill: string = REPORT_WORKBOOK_STYLE.colors.navy,
): void {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fill },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      bold: true,
      color: { argb: REPORT_WORKBOOK_STYLE.colors.white },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: {
        style: 'thin',
        color: { argb: REPORT_WORKBOOK_STYLE.colors.border },
      },
    };
  });
}

export function styleBandedRows(
  worksheet: ExcelJS.Worksheet,
  firstRow: number,
  lastRow: number,
  lastColumn: number,
): void {
  for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell) => {
      if ((rowNumber - firstRow) % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: REPORT_WORKBOOK_STYLE.colors.band },
        };
      }
      cell.border = {
        bottom: {
          style: 'hair',
          color: { argb: REPORT_WORKBOOK_STYLE.colors.border },
        },
      };
      cell.alignment = { ...cell.alignment, vertical: 'middle' };
    });
    for (let column = 1; column <= lastColumn; column += 1) {
      row.getCell(column).font = {
        name: REPORT_WORKBOOK_STYLE.font,
        ...row.getCell(column).font,
      };
    }
  }
}

export function styleTotalRow(row: ExcelJS.Row, lastColumn: number): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: REPORT_WORKBOOK_STYLE.colors.total },
    };
    cell.font = {
      name: REPORT_WORKBOOK_STYLE.font,
      ...cell.font,
      bold: true,
      color: { argb: REPORT_WORKBOOK_STYLE.colors.text },
    };
    cell.border = {
      top: {
        style: 'thin',
        color: { argb: REPORT_WORKBOOK_STYLE.colors.border },
      },
    };
    cell.alignment = { ...cell.alignment, vertical: 'middle' };
  });
  for (let column = 1; column <= lastColumn; column += 1) {
    row.getCell(column).font = {
      name: REPORT_WORKBOOK_STYLE.font,
      ...row.getCell(column).font,
    };
  }
}
