import sharp from 'sharp';
import { REPORT_WORKBOOK_STYLE } from './report-export.styles';
import type {
  WorkbookCategoryChartItem,
  WorkbookTrendPoint,
  WorkbookTrendType,
} from './report-workbook.builder';

export interface RenderedWorkbookChart {
  buffer: Buffer;
  width: number;
  height: number;
}

const CHART_COLORS = REPORT_WORKBOOK_STYLE.colors;
const FONT = REPORT_WORKBOOK_STYLE.font;

function hexColor(color: string): string {
  return `#${color.slice(2)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function currencyLabel(value: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return `Rp ${formatted}`;
}

function trendLabel(period: string, type: WorkbookTrendType): string {
  if (type === 'weekly') {
    const [year, week] = period.split('-W');
    return `Mg ${week}/${year.slice(-2)}`;
  }

  const date =
    type === 'monthly'
      ? new Date(`${period}-01T00:00:00.000Z`)
      : new Date(`${period}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('id-ID', {
    ...(type === 'monthly'
      ? { month: 'short', year: 'numeric' }
      : { day: '2-digit', month: 'short' }),
    timeZone: 'UTC',
  }).format(date);
}

async function makePng(
  svg: string,
  width: number,
  height: number,
): Promise<RenderedWorkbookChart> {
  return {
    buffer: await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer(),
    width,
    height,
  };
}

export async function renderCashflowTrendChart(
  points: WorkbookTrendPoint[],
  type: WorkbookTrendType,
): Promise<RenderedWorkbookChart> {
  const width = 1440;
  const height = 680;
  const left = 104;
  const right = 56;
  const top = 166;
  const bottom = 98;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const income = points.map((point) => Number(BigInt(point.income)));
  const expense = points.map((point) => Number(BigInt(point.expense)));
  const net = points.map((point) => Number(BigInt(point.netCashFlow)));
  const minimum = Math.min(0, ...net);
  const maximum = Math.max(0, ...income, ...expense, ...net);
  const range = maximum - minimum || 1;
  const paddedMinimum = minimum - range * 0.08;
  const paddedMaximum = maximum + range * 0.08;
  const yFor = (value: number) =>
    top +
    ((paddedMaximum - value) / (paddedMaximum - paddedMinimum)) * plotHeight;
  const zeroY = yFor(0);
  const count = Math.max(1, points.length);
  const slot = plotWidth / count;
  const barWidth = Math.min(26, Math.max(2, slot * 0.32));
  const barGap = Math.min(7, slot * 0.08);
  const labels = new Set<number>();
  const labelCount = Math.min(12, points.length);
  for (let index = 0; index < labelCount; index += 1) {
    labels.add(
      labelCount === 1
        ? 0
        : Math.round((index * (points.length - 1)) / (labelCount - 1)),
    );
  }

  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = paddedMinimum + ((paddedMaximum - paddedMinimum) * index) / 4;
    const y = yFor(value);
    const axisValue = `${value < 0 ? '-' : ''}${currencyLabel(value)}`;
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="${hexColor(CHART_COLORS.chartGrid)}" stroke-width="1"/><text x="${left - 14}" y="${y + 5}" text-anchor="end" font-family="${FONT}" font-size="16" fill="${hexColor(CHART_COLORS.muted)}">${escapeXml(axisValue)}</text>`;
  }).join('');

  const bars = points
    .map((_, index) => {
      const center = left + slot * (index + 0.5);
      const incomeX = center - barWidth - barGap / 2;
      const expenseX = center + barGap / 2;
      const incomeY = yFor(income[index]);
      const expenseY = yFor(expense[index]);
      return `<rect x="${incomeX}" y="${Math.min(zeroY, incomeY)}" width="${barWidth}" height="${Math.max(1, Math.abs(zeroY - incomeY))}" rx="3" fill="${hexColor(CHART_COLORS.chartIncome)}"/><rect x="${expenseX}" y="${Math.min(zeroY, expenseY)}" width="${barWidth}" height="${Math.max(1, Math.abs(zeroY - expenseY))}" rx="3" fill="${hexColor(CHART_COLORS.chartExpense)}"/>`;
    })
    .join('');

  const linePoints = points.map((_, index) => ({
    x: left + slot * (index + 0.5),
    y: yFor(net[index]),
  }));
  const line = linePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
  const markers =
    points.length <= 24
      ? linePoints
          .map(
            (point) =>
              `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#FFFFFF" stroke="${hexColor(CHART_COLORS.chartNet)}" stroke-width="2.5"/>`,
          )
          .join('')
      : '';
  const ticks = Array.from(labels)
    .map((index) => {
      const x = left + slot * (index + 0.5);
      return `<text x="${x}" y="${height - 45}" text-anchor="middle" font-family="${FONT}" font-size="16" fill="${hexColor(CHART_COLORS.muted)}">${escapeXml(trendLabel(points[index].period, type))}</text>`;
    })
    .join('');
  const legend = [
    {
      x: left,
      color: hexColor(CHART_COLORS.chartIncome),
      label: 'Pemasukan',
      line: false,
    },
    {
      x: left + 190,
      color: hexColor(CHART_COLORS.chartExpense),
      label: 'Pengeluaran',
      line: false,
    },
    {
      x: left + 400,
      color: hexColor(CHART_COLORS.chartNet),
      label: 'Arus kas bersih',
      line: true,
    },
  ]
    .map(
      (item) =>
        `${item.line ? `<line x1="${item.x}" y1="120" x2="${item.x + 28}" y2="120" stroke="${item.color}" stroke-width="4" stroke-linecap="round"/>` : `<rect x="${item.x}" y="111" width="18" height="18" rx="3" fill="${item.color}"/>`}<text x="${item.x + 36}" y="126" font-family="${FONT}" font-size="17" fill="${hexColor(CHART_COLORS.text)}">${item.label}</text>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#FFFFFF"/><text x="${left}" y="54" font-family="${FONT}" font-size="30" font-weight="700" fill="${hexColor(CHART_COLORS.navy)}">Tren Arus Kas</text><text x="${left}" y="84" font-family="${FONT}" font-size="17" fill="${hexColor(CHART_COLORS.muted)}">Perbandingan pemasukan, pengeluaran, dan arus kas bersih</text>${legend}${grid}<line x1="${left}" y1="${zeroY}" x2="${width - right}" y2="${zeroY}" stroke="${hexColor(CHART_COLORS.muted)}" stroke-width="1.5"/>${bars}<path d="${line}" fill="none" stroke="${hexColor(CHART_COLORS.chartNet)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${markers}${ticks}</svg>`;
  return makePng(svg, width, height);
}

function wrapLabel(value: string, maxLength: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words.length > 0 ? words : ['']) {
    if (word.length > maxLength) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxLength) {
        lines.push(word.slice(index, index + maxLength));
      }
      continue;
    }

    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderCategoryChart(
  categories: WorkbookCategoryChartItem[],
  type: 'INCOME' | 'EXPENSE',
): Promise<RenderedWorkbookChart> {
  const visibleCategories = categories.slice(0, 10);
  const labelLines = visibleCategories.map((category) =>
    wrapLabel(category.name, 32),
  );
  const rowHeights = labelLines.map((lines) =>
    Math.max(62, lines.length * 25 + 20),
  );
  const width = 1440;
  const top = 154;
  const rowGap = 10;
  const height =
    top +
    rowHeights.reduce((sum, rowHeight) => sum + rowHeight + rowGap, 0) +
    50;
  const labelX = 40;
  const barX = 430;
  const valueWidth = 190;
  const right = 48;
  const maxBarWidth = width - barX - valueWidth - right;
  const maximum = Math.max(
    1,
    ...visibleCategories.map((category) => Number(category.total)),
  );
  const barColor = hexColor(
    type === 'INCOME' ? CHART_COLORS.chartIncome : CHART_COLORS.chartExpense,
  );
  const title =
    type === 'INCOME' ? 'Pemasukan per Kategori' : 'Pengeluaran per Kategori';
  const subtitle =
    visibleCategories.length < categories.length
      ? `10 kategori terbesar dari ${categories.length} kategori · nominal periode laporan`
      : 'Nominal periode laporan, diurutkan dari terbesar';
  let y = top;
  const rows = visibleCategories
    .map((category, index) => {
      const rowHeight = rowHeights[index];
      const barWidth = (Number(category.total) / maximum) * maxBarWidth;
      const label = labelLines[index]
        .map(
          (line, lineIndex) =>
            `<tspan x="${labelX}" dy="${lineIndex === 0 ? 0 : 24}">${escapeXml(line)}</tspan>`,
        )
        .join('');
      const centerY = y + rowHeight / 2;
      const markup = `<text x="${labelX}" y="${centerY - ((labelLines[index].length - 1) * 24) / 2 + 6}" font-family="${FONT}" font-size="18" font-weight="600" fill="${hexColor(CHART_COLORS.text)}">${label}</text><rect x="${barX}" y="${centerY - 12}" width="${maxBarWidth}" height="24" rx="5" fill="${hexColor(CHART_COLORS.chartTrack)}"/><rect x="${barX}" y="${centerY - 12}" width="${Math.max(2, barWidth)}" height="24" rx="5" fill="${barColor}"/><text x="${barX + maxBarWidth + 18}" y="${centerY + 6}" font-family="${FONT}" font-size="17" fill="${hexColor(CHART_COLORS.text)}">${escapeXml(currencyLabel(Number(category.total)))}</text>`;
      y += rowHeight + rowGap;
      return markup;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#FFFFFF"/><text x="${labelX}" y="54" font-family="${FONT}" font-size="30" font-weight="700" fill="${hexColor(CHART_COLORS.navy)}">${title}</text><text x="${labelX}" y="86" font-family="${FONT}" font-size="17" fill="${hexColor(CHART_COLORS.muted)}">${escapeXml(subtitle)}</text>${rows}</svg>`;
  return makePng(svg, width, height);
}
