import type ExcelJS from 'exceljs';

export const REPORT_WORKBOOK_STYLE = {
  font: 'Arial',
  colors: {
    navy: 'FF174F4B',
    teal: 'FF174F4B',
    tealLight: 'FFE5EFED',
    income: 'FF287452',
    expense: 'FFA64F48',
    net: 'FF174F4B',
    white: 'FFFFFFFF',
    text: 'FF263331',
    muted: 'FF65736F',
    border: 'FFD5DEDB',
    band: 'FFF4F7F6',
    total: 'FFE7EFED',
    incomeBar: 'FF4E8B70',
    expenseBar: 'FFB76A61',
    chartNet: 'FF174F4B',
    chartGrid: 'FFD9E1DF',
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
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
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
