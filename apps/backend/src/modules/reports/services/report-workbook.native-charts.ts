import JSZip from 'jszip';
import { REPORT_WORKBOOK_STYLE } from './report-export.styles';

export interface NativeWorkbookChartSeries {
  name: string;
  nameFormula?: string;
  formula: string;
  values: number[];
  color: string;
  type: 'bar' | 'line';
  pointColors?: string[];
}

export interface NativeWorkbookChart {
  sheetIndex: number;
  title?: string;
  kind: 'bar' | 'doughnut';
  anchor: {
    from: { col: number; row: number };
    to: { col: number; row: number };
  };
  centerText?: {
    value: string;
    label: string;
  };
  categoryFormula: string;
  categories: string[];
  direction: 'column' | 'bar';
  series: NativeWorkbookChartSeries[];
}

const RELATIONSHIPS_NS =
  'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_RELATIONSHIPS_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const DRAWING_NS =
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const DRAWING_REL_TYPE = `${OFFICE_RELATIONSHIPS_NS}/drawing`;
const CHART_REL_TYPE = `${OFFICE_RELATIONSHIPS_NS}/chart`;
const CHART_USER_SHAPES_REL_TYPE = `${OFFICE_RELATIONSHIPS_NS}/chartUserShapes`;
const CHART_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const DRAWING_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.drawing+xml';
const CHART_SHAPES_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml';
const COLORS = REPORT_WORKBOOK_STYLE.colors;
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cellReference(formula: string): string {
  return escapeXml(formula);
}

function relationshipId(xml: string): number {
  const ids = Array.from(xml.matchAll(/\bId="rId(\d+)"/g), (match) =>
    Number(match[1]),
  );
  return Math.max(0, ...ids) + 1;
}

function pointCache(values: string[]): string {
  return `<c:strCache><c:ptCount val="${values.length}"/>${values
    .map(
      (value, index) =>
        `<c:pt idx="${index}"><c:v>${escapeXml(value)}</c:v></c:pt>`,
    )
    .join('')}</c:strCache>`;
}

function numberCache(values: number[]): string {
  return `<c:numCache><c:formatCode>#,##0</c:formatCode><c:ptCount val="${values.length}"/>${values
    .map(
      (value, index) =>
        `<c:pt idx="${index}"><c:v>${Number.isFinite(value) ? value : 0}</c:v></c:pt>`,
    )
    .join('')}</c:numCache>`;
}

function seriesXml(
  series: NativeWorkbookChartSeries,
  index: number,
  categoryFormula: string,
  categories: string[],
  isDoughnut = false,
): string {
  const lineStyle =
    series.type === 'line'
      ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${series.color.slice(2)}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${series.color.slice(2)}"/></a:solidFill></a:ln></c:spPr></c:marker>`
      : '';
  const shapeStyle =
    series.type === 'line'
      ? `<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${series.color.slice(2)}"/></a:solidFill></a:ln></c:spPr>`
      : `<c:spPr><a:solidFill><a:srgbClr val="${series.color.slice(2)}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>`;
  const pointColors = isDoughnut
    ? series.pointColors
    : series.type === 'bar'
      ? (series.pointColors ?? series.values.map(() => series.color))
      : undefined;
  const pointStyles = pointColors
    ? pointColors
        .map(
          (color, pointIndex) =>
            `<c:dPt><c:idx val="${pointIndex}"/><c:spPr><a:solidFill><a:srgbClr val="${color.slice(2)}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:dPt>`,
        )
        .join('')
    : '';

  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:strRef><c:f>${cellReference(series.nameFormula ?? series.name)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>${shapeStyle}${lineStyle}${pointStyles}<c:cat><c:strRef><c:f>${cellReference(categoryFormula)}</c:f>${pointCache(categories)}</c:strRef></c:cat><c:val><c:numRef><c:f>${cellReference(series.formula)}</c:f>${numberCache(series.values)}</c:numRef></c:val>${series.type === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
}

function chartTitleXml(title: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"><a:solidFill><a:srgbClr val="${COLORS.text.slice(2)}"/></a:solidFill><a:latin typeface="${REPORT_WORKBOOK_STYLE.font}"/></a:defRPr></a:pPr><a:r><a:rPr lang="id-ID" sz="1400" b="1"><a:solidFill><a:srgbClr val="${COLORS.text.slice(2)}"/></a:solidFill><a:latin typeface="${REPORT_WORKBOOK_STYLE.font}"/></a:rPr><a:t>${escapeXml(title)}</a:t></a:r><a:endParaRPr lang="id-ID"/></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

function chartXml(chart: NativeWorkbookChart): string {
  if (chart.kind === 'doughnut') {
    const series = chart.series[0];
    if (!series) throw new Error('A doughnut chart requires one data series.');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS_NS}"><c:lang val="id-ID"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/>${seriesXml(series, 0, chart.categoryFormula, chart.categories, true)}<c:firstSliceAng val="270"/><c:holeSize val="68"/></c:doughnutChart></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings><c:userShapes r:id="rId1"/></c:chartSpace>`;
  }

  const barSeries = chart.series.filter((series) => series.type === 'bar');
  const lineSeries = chart.series.filter((series) => series.type === 'line');
  const barDirection = chart.direction === 'column' ? 'col' : 'bar';
  const catOrientation = chart.direction === 'column' ? 'minMax' : 'maxMin';
  const categoryCrossing = 'autoZero';
  const barChart =
    barSeries.length === 0
      ? ''
      : `<c:barChart><c:barDir val="${barDirection}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${barSeries
          .map((series, index) =>
            seriesXml(series, index, chart.categoryFormula, chart.categories),
          )
          .join(
            '',
          )}<c:gapWidth val="75"/><c:overlap val="0"/><c:axId val="10"/><c:axId val="20"/></c:barChart>`;
  const lineChart =
    lineSeries.length === 0
      ? ''
      : `<c:lineChart><c:grouping val="standard"/>${lineSeries
          .map((series, index) =>
            seriesXml(
              series,
              barSeries.length + index,
              chart.categoryFormula,
              chart.categories,
            ),
          )
          .join(
            '',
          )}<c:marker val="1"/><c:smooth val="0"/><c:axId val="10"/><c:axId val="20"/></c:lineChart>`;
  const axes =
    chart.direction === 'column'
      ? `<c:catAx><c:axId val="10"/><c:scaling><c:orientation val="${catOrientation}"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="20"/><c:crosses val="${categoryCrossing}"/><c:auto val="1"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${COLORS.chartGrid.slice(2)}"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode='"Rp" #,##0' sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="10"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
      : `<c:catAx><c:axId val="10"/><c:scaling><c:orientation val="${catOrientation}"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="20"/><c:crosses val="${categoryCrossing}"/><c:auto val="1"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${COLORS.chartGrid.slice(2)}"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode='"Rp" #,##0' sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="none"/><c:crossAx val="10"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  const legend =
    chart.direction === 'bar'
      ? ''
      : '<c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS_NS}"><c:lang val="id-ID"/><c:chart>${chart.title ? chartTitleXml(chart.title) : ''}<c:autoTitleDeleted val="${chart.title ? 0 : 1}"/><c:plotArea><c:layout/>${barChart}${lineChart}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function chartUserShapesXml(chart: NativeWorkbookChart): string {
  if (!chart.centerText) {
    throw new Error('A doughnut chart center label is required.');
  }
  const creationId = '{23918D1F-0CF2-3E32-8FAF-4921512F71A9}';
  const centerLabel =
    `${chart.centerText.value}\n${chart.centerText.label}`.replaceAll(
      '\u00a0',
      ' ',
    );
  return `<c:userShapes xmlns:c="${CHART_NS}"><cdr:relSizeAnchor xmlns:cdr="http://schemas.openxmlformats.org/drawingml/2006/chartDrawing"><cdr:from><cdr:x>0.3</cdr:x><cdr:y>0.35</cdr:y></cdr:from><cdr:to><cdr:x>0.7</cdr:x><cdr:y>0.65</cdr:y></cdr:to><cdr:sp macro="" textlink=""><cdr:nvSpPr><cdr:cNvPr id="2" name="TextBox 1"><a:extLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="${creationId}"/></a:ext></a:extLst></cdr:cNvPr><cdr:cNvSpPr txBox="1"/></cdr:nvSpPr><cdr:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="1524000" y="1333500"/><a:ext cx="2032000" cy="1143000"/></a:xfrm><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom></cdr:spPr><cdr:txBody><a:bodyPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" wrap="none" vertOverflow="clip" vert="horz" rtlCol="0" anchor="ctr"/><a:lstStyle xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:pPr algn="ctr"/><a:r><a:rPr lang="id-ID" sz="1000" kern="1200"/><a:t>${escapeXml(centerLabel)}</a:t></a:r></a:p></cdr:txBody></cdr:sp></cdr:relSizeAnchor></c:userShapes>`;
}

function drawingXml(
  chart: NativeWorkbookChart,
  chartRelationshipId: string,
  chartNumber: number,
): string {
  const anchor = (point: { col: number; row: number }) =>
    `<xdr:col>${point.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${point.row}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
  return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from>${anchor(chart.anchor.from)}</xdr:from><xdr:to>${anchor(chart.anchor.to)}</xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${chartNumber + 1}" name="Chart ${chartNumber}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${CHART_NS}"><c:chart xmlns:c="${CHART_NS}" xmlns:r="${OFFICE_RELATIONSHIPS_NS}" r:id="${chartRelationshipId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

function appendRelationship(
  xml: string,
  relationship: { id: string; type: string; target: string },
): string {
  const entry = `<Relationship Id="${relationship.id}" Type="${relationship.type}" Target="${relationship.target}"/>`;
  if (xml.includes('</Relationships>')) {
    return xml.replace('</Relationships>', `${entry}</Relationships>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}">${entry}</Relationships>`;
}

function addWorksheetDrawing(
  xml: string,
  drawingRelationshipId: string,
): string {
  let worksheetXml = xml;
  if (!worksheetXml.includes(`xmlns:r="${OFFICE_RELATIONSHIPS_NS}"`)) {
    worksheetXml = worksheetXml.replace(
      /<worksheet\b/,
      `<worksheet xmlns:r="${OFFICE_RELATIONSHIPS_NS}"`,
    );
  }
  const drawing = `<drawing r:id="${drawingRelationshipId}"/>`;
  let depth = 0;
  for (const match of worksheetXml.matchAll(/<\/?[\w:.-]+\b[^>]*>/g)) {
    const tag = match[0];
    if (!tag || tag.startsWith('<?') || tag.startsWith('<!')) continue;
    const closing = tag.startsWith('</');
    const selfClosing = /\/\s*>$/.test(tag);
    const name = tag.match(/^<\/?([\w:.-]+)/)?.[1];
    if (!name) continue;

    if (!closing && depth === 1 && name === 'extLst') {
      const offset = match.index;
      if (offset === undefined) {
        throw new Error('Unable to locate the worksheet extension list.');
      }
      return `${worksheetXml.slice(0, offset)}${drawing}${worksheetXml.slice(offset)}`;
    }

    if (closing) {
      depth -= 1;
    } else if (!selfClosing) {
      depth += 1;
    }
  }
  return worksheetXml.replace('</worksheet>', `${drawing}</worksheet>`);
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing XLSX component: ${path}`);
  return file.async('string');
}

export async function addNativeWorkbookCharts(
  workbookBuffer: Buffer,
  charts: NativeWorkbookChart[],
): Promise<Buffer> {
  if (charts.length === 0) return workbookBuffer;

  const zip = await JSZip.loadAsync(workbookBuffer);
  const contentTypes = await readZipText(zip, '[Content_Types].xml');
  const drawingsBySheet = new Map<number, NativeWorkbookChart[]>();
  for (const chart of charts) {
    const entries = drawingsBySheet.get(chart.sheetIndex) ?? [];
    entries.push(chart);
    drawingsBySheet.set(chart.sheetIndex, entries);
  }

  let chartNumber = 0;
  let chartShapesDrawingNumber = 5;
  const contentTypeEntries: string[] = [];
  for (const [sheetIndex, sheetCharts] of drawingsBySheet) {
    const sheetPath = `xl/worksheets/sheet${sheetIndex}.xml`;
    const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
    const drawingNumber = sheetIndex;
    const drawingPath = `xl/drawings/drawing${drawingNumber}.xml`;
    const drawingRelsPath = `xl/drawings/_rels/drawing${drawingNumber}.xml.rels`;
    const existingSheetRels = zip.file(sheetRelsPath)
      ? await readZipText(zip, sheetRelsPath)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}"></Relationships>`;
    const drawingRelationship = `rId${relationshipId(existingSheetRels)}`;
    zip.file(
      sheetRelsPath,
      appendRelationship(existingSheetRels, {
        id: drawingRelationship,
        type: DRAWING_REL_TYPE,
        target: `../drawings/drawing${drawingNumber}.xml`,
      }),
    );
    zip.file(
      sheetPath,
      addWorksheetDrawing(
        await readZipText(zip, sheetPath),
        drawingRelationship,
      ),
    );

    const drawingEntries: string[] = [];
    const drawingRelationships: string[] = [];
    for (let index = 0; index < sheetCharts.length; index += 1) {
      const chart = sheetCharts[index];
      if (!chart || chart.series.length === 0) continue;
      chartNumber += 1;
      const chartPath = `xl/charts/chart${chartNumber}.xml`;
      const chartRelationshipsPath = `xl/charts/_rels/chart${chartNumber}.xml.rels`;
      const chartRelationship = `rId${index + 1}`;
      zip.file(chartPath, chartXml(chart));
      contentTypeEntries.push(
        `<Override PartName="/${chartPath}" ContentType="${CHART_CONTENT_TYPE}"/>`,
      );
      if (chart.kind === 'doughnut') {
        const shapesDrawingNumber = chartShapesDrawingNumber;
        chartShapesDrawingNumber += 1;
        const chartShapesPath = `xl/drawings/drawing${shapesDrawingNumber}.xml`;
        const chartShapesRelationshipId = 'rId1';
        zip.file(chartShapesPath, chartUserShapesXml(chart));
        zip.file(
          chartRelationshipsPath,
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}"><Relationship Id="${chartShapesRelationshipId}" Type="${CHART_USER_SHAPES_REL_TYPE}" Target="../drawings/drawing${shapesDrawingNumber}.xml"/></Relationships>`,
        );
        contentTypeEntries.push(
          `<Override PartName="/${chartShapesPath}" ContentType="${CHART_SHAPES_CONTENT_TYPE}"/>`,
        );
      }
      drawingEntries.push(drawingXml(chart, chartRelationship, chartNumber));
      drawingRelationships.push(
        `<Relationship Id="${chartRelationship}" Type="${CHART_REL_TYPE}" Target="../charts/chart${chartNumber}.xml"/>`,
      );
    }

    if (drawingEntries.length === 0) continue;
    zip.file(
      drawingPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${DRAWING_NS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_RELATIONSHIPS_NS}">${drawingEntries.join('')}</xdr:wsDr>`,
    );
    zip.file(
      drawingRelsPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}">${drawingRelationships.join('')}</Relationships>`,
    );
    contentTypeEntries.push(
      `<Override PartName="/${drawingPath}" ContentType="${DRAWING_CONTENT_TYPE}"/>`,
    );
  }

  if (contentTypeEntries.length > 0) {
    zip.file(
      '[Content_Types].xml',
      contentTypes.replace(
        '</Types>',
        `${contentTypeEntries.join('')}</Types>`,
      ),
    );
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}
