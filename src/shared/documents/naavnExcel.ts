import type { Borders, Cell, Fill, Font, Workbook, Worksheet } from "exceljs";
import {
  NAAVN_LABEL_FILL,
  NAAVN_PLACEHOLDER_COLOR,
  columnTotal,
  loadLogos,
  saveBlob,
  toNumber,
  type LoadedImage,
  type NaavnColumn,
  type NaavnDocument,
  type NaavnField,
  type NaavnSpan,
  type NaavnTable,
  type NaavnValue,
} from "./naavnDocument";

const FONT_NAME = "Arial";
const LOGO_PX = 95;
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const thin = { style: "thin" as const, color: { argb: "FF000000" } };
const medium = { style: "medium" as const, color: { argb: "FF000000" } };
const allThin: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };
const labelFill: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: `FF${NAAVN_LABEL_FILL}` },
};

const font = (overrides: Partial<Font> = {}): Partial<Font> => ({
  name: FONT_NAME,
  size: 10,
  ...overrides,
});

const colLetter = (index: number) => {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

const moneyFormat = (symbol: string) => {
  const sym = `"${symbol.replace(/"/g, "")}"`;
  return `_(${sym}* #,##0.00_);_(${sym}* \\(#,##0.00\\);_(${sym}* "-"??_);_(@_)`;
};

const numberFormatFor = (column: NaavnColumn, symbol: string) => {
  switch (column.format) {
    case "money":
      return moneyFormat(symbol);
    case "integer":
      return "0";
    case "decimal":
      return "0.00";
    default:
      return undefined;
  }
};

/** Excel stores dates as UTC serials; pin calendar dates to UTC midnight so they don't shift a day. */
const toExcelValue = (value: NaavnValue): Cell["value"] => {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (value === null || value === undefined || value === "") return null;
  return value;
};

type CellStyle = {
  value?: Cell["value"];
  font?: Partial<Font>;
  fill?: Fill;
  border?: Partial<Borders>;
  align?: "left" | "center" | "right";
  numFmt?: string;
  wrap?: boolean;
};

/** Styles every cell in a range (so borders survive merging), writes the value, then merges. */
const writeRange = (
  ws: Worksheet,
  row1: number,
  row2: number,
  span: NaavnSpan,
  style: CellStyle,
) => {
  for (let r = row1; r <= row2; r += 1) {
    for (let c = span[0]; c <= span[1]; c += 1) {
      // Assign a fresh style object: ExcelJS shares style objects between cells of a
      // column, so mutating `cell.border` etc. in place would leak into other cells.
      ws.getCell(r, c + 1).style = {
        font: style.font ?? font(),
        ...(style.fill ? { fill: style.fill } : {}),
        ...(style.border ? { border: { ...style.border } } : {}),
        ...(style.numFmt ? { numFmt: style.numFmt } : {}),
        alignment: {
          horizontal: style.align ?? "left",
          vertical: "middle",
          wrapText: style.wrap ?? true,
        },
      };
    }
  }
  if (row1 !== row2 || span[0] !== span[1]) {
    ws.mergeCells(row1, span[0] + 1, row2, span[1] + 1);
  }
  const anchor = ws.getCell(row1, span[0] + 1);
  if (style.value !== undefined) anchor.value = style.value;
  return anchor;
};

/** Replaces the outer edges of a block with a medium border, keeping the inner thin lines. */
const outline = (ws: Worksheet, row1: number, row2: number, col1: number, col2: number) => {
  for (let r = row1; r <= row2; r += 1) {
    for (let c = col1; c <= col2; c += 1) {
      const cell = ws.getCell(r, c + 1);
      const border = { ...cell.border };
      if (r === row1) border.top = medium;
      if (r === row2) border.bottom = medium;
      if (c === col1) border.left = medium;
      if (c === col2) border.right = medium;
      cell.style = { ...cell.style, border };
    }
  }
};

const spanWidth = (widths: number[], span: NaavnSpan) =>
  widths.slice(span[0], span[1] + 1).reduce((sum, w) => sum + w, 0);

/** Rough line count for wrapped 10pt Arial text in a span of the given character width. */
const estimateLines = (text: string, widthChars: number) => {
  const perLine = Math.max(4, Math.floor(widthChars * 1.05));
  return text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
};

const columnPx = (width: number) => Math.round(width * 7 + 5);

/** Fractional column position whose left edge sits `px` pixels from the grid's right edge. */
const anchorFromRight = (widths: number[], px: number) => {
  let remaining = px;
  for (let c = widths.length - 1; c >= 0; c -= 1) {
    const w = columnPx(widths[c]);
    if (remaining <= w) return c + (w - remaining) / w;
    remaining -= w;
  }
  return 0;
};

const addLogo = (
  workbook: Workbook,
  ws: Worksheet,
  image: LoadedImage | null,
  col: number,
) => {
  if (!image) return;
  const id = workbook.addImage({ base64: image.base64, extension: image.extension });
  ws.addImage(id, {
    tl: { col, row: 0.15 },
    ext: { width: LOGO_PX, height: LOGO_PX },
    editAs: "oneCell",
  });
};

const writeHeader = (
  workbook: Workbook,
  ws: Worksheet,
  doc: NaavnDocument,
  logos: { left: LoadedImage | null; right: LoadedImage | null },
) => {
  const fullSpan: NaavnSpan = [0, doc.columnWidths.length - 1];
  const center = { align: "center" as const, wrap: false };

  writeRange(ws, 1, 1, fullSpan, { ...center, value: "RESTRICTED", font: font() });
  writeRange(ws, 2, 2, fullSpan, {
    ...center,
    value: "NIGERIAN ARMY AVIATION",
    font: font({ size: 18, bold: true }),
  });
  writeRange(ws, 3, 3, fullSpan, {
    ...center,
    value: doc.title,
    font: font({ size: 16, bold: true }),
  });
  writeRange(ws, 4, 4, fullSpan, {
    ...center,
    value: doc.docRef
      ? {
          richText: [
            { text: "DOCUMENT REF No.: ", font: font() },
            { text: doc.docRef, font: font({ bold: true }) },
          ],
        }
      : null,
  });
  ws.getRow(1).height = 16;
  ws.getRow(2).height = 24;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 16;
  ws.getRow(5).height = 12;

  addLogo(workbook, ws, logos.left, 0.05);
  addLogo(workbook, ws, logos.right, anchorFromRight(doc.columnWidths, LOGO_PX + 4));
};

const writeField = (
  ws: Worksheet,
  row: number,
  field: NaavnField,
  labelSpan: NaavnSpan,
  valueSpan: NaavnSpan,
) => {
  writeRange(ws, row, row, labelSpan, {
    value: field.label,
    font: font({ bold: true }),
    fill: labelFill,
    border: allThin,
  });
  writeRange(ws, row, row, valueSpan, {
    value: toExcelValue(field.value),
    font: font({ bold: field.bold }),
    border: allThin,
    align: "center",
    numFmt: field.value instanceof Date ? "dd mmmm yyyy" : undefined,
  });
};

const writeTable = (
  ws: Worksheet,
  startRow: number,
  table: NaavnTable,
  doc: NaavnDocument,
) => {
  const widths = doc.columnWidths;
  const symbol = doc.currency?.symbol ?? "";
  const firstCol = Math.min(...table.columns.map((c) => c.span[0]));
  const lastCol = Math.max(...table.columns.map((c) => c.span[1]));
  let row = startRow;

  if (table.heading) {
    writeRange(ws, row, row, [firstCol, lastCol], {
      value: table.heading,
      font: font({ bold: true, size: 11 }),
      wrap: false,
    });
    ws.getRow(row).height = 20;
    row += 1;
  }

  const headerRow = row;
  const headerLines = Math.max(
    ...table.columns.map((c) => estimateLines(c.header, spanWidth(widths, c.span))),
  );
  table.columns.forEach((column, index) => {
    writeRange(ws, row, row, column.span, {
      value: column.header,
      font: font({ bold: true }),
      align: "center",
      border: { left: thin, right: thin, top: thin },
    });
    writeRange(ws, row + 1, row + 1, column.span, {
      value: `(${LETTERS[index] ?? index + 1})`,
      align: "center",
      border: { left: thin, right: thin, bottom: thin },
    });
  });
  ws.getRow(row).height = Math.max(16, headerLines * 13 + 4);
  ws.getRow(row + 1).height = 14;
  row += 2;

  const firstDataRow = row;
  if (table.rows.length === 0) {
    writeRange(ws, row, row, [firstCol, lastCol], {
      value: table.emptyText ?? "No records",
      align: "center",
      border: allThin,
      font: font({ italic: true }),
    });
    ws.getRow(row).height = 30;
    row += 1;
  }

  for (const values of table.rows) {
    let lines = 1;
    table.columns.forEach((column, index) => {
      const raw = values[index];
      const number = toNumber(raw);
      const isNumeric = column.format !== undefined && column.format !== "text";
      let value: Cell["value"] = isNumeric && number !== null ? number : toExcelValue(raw);

      if (column.productOf && number !== null) {
        const [a, b] = column.productOf;
        const ref = (i: number) => `${colLetter(table.columns[i].span[0])}${row}`;
        value = { formula: `${ref(a)}*${ref(b)}`, result: number };
      }

      writeRange(ws, row, row, column.span, {
        value,
        align: column.align ?? (isNumeric ? "center" : "left"),
        border: allThin,
        numFmt: numberFormatFor(column, symbol),
      });
      if (typeof value === "string") {
        lines = Math.max(lines, estimateLines(value, spanWidth(widths, column.span)));
      }
    });
    ws.getRow(row).height = Math.max(30, lines * 13 + 10);
    row += 1;
  }

  outline(ws, headerRow, row - 1, firstCol, lastCol);

  if (table.total) {
    const column = table.columns[table.total.column];
    const lastDataRow = Math.max(firstDataRow, row - 1);
    const letter = colLetter(column.span[0]);
    writeRange(ws, row, row, table.total.labelSpan, {
      value: table.total.label,
      font: font({ bold: true, size: 12 }),
      fill: labelFill,
      align: "center",
      border: { ...allThin, left: medium, bottom: medium },
    });
    writeRange(ws, row, row, column.span, {
      value: {
        formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,
        result: columnTotal(table, table.total.column),
      },
      font: font({ bold: true, size: 12 }),
      border: { ...allThin, right: medium, bottom: medium },
      numFmt: numberFormatFor(column, symbol),
    });
    ws.getRow(row).height = 20;
    row += 1;
  }

  return row;
};

const writeSignatures = (ws: Worksheet, startRow: number, doc: NaavnDocument) => {
  const { leftLabel, leftValue, rightLabel, rightValue } = doc.layout;
  const r = startRow;

  writeRange(ws, r, r + 1, leftLabel, {
    value: "SIGNATURE OF ISSUER",
    font: font({ bold: true }),
    fill: labelFill,
    align: "center",
    border: allThin,
  });
  writeRange(ws, r, r + 1, doc.layout.issuerSignature ?? leftValue, {
    value: null,
    border: allThin,
  });

  if (doc.approval) {
    writeRange(ws, r, r + 1, rightLabel, {
      value: "APPROVED BY:",
      font: font({ bold: true }),
      fill: labelFill,
      align: "center",
      border: allThin,
    });
    writeRange(ws, r, r + 1, rightValue, {
      value: "RANK INITIAL AND SURNAME",
      font: font({ color: { argb: `FF${NAAVN_PLACEHOLDER_COLOR}` } }),
      align: "center",
      border: allThin,
    });
    writeRange(ws, r + 2, r + 3, rightLabel, {
      value: "APPROVAL SIGNATURE:",
      font: font({ bold: true }),
      fill: labelFill,
      align: "center",
      border: allThin,
    });
    writeRange(ws, r + 2, r + 3, rightValue, { value: null, border: allThin });
  }

  for (let i = 0; i < 4; i += 1) ws.getRow(r + i).height = 17;

  if (doc.footnote) {
    writeRange(ws, r + 3, r + 3, [0, 0], {
      value: doc.footnote,
      font: font({ bold: true, size: 9 }),
      wrap: false,
    });
  }
};

const footerText = (doc: NaavnDocument) =>
  [
    doc.revisionNo ? `&LRevision No.: ${doc.revisionNo}` : "",
    doc.revisionDate ? `&CRevision Date: ${doc.revisionDate}` : "",
    "&RPage &P of &N",
  ].join("");

const uniqueSheetName = (name: string, used: Set<string>) => {
  const base = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const addDocumentSheet = (
  workbook: Workbook,
  doc: NaavnDocument,
  sheetName: string,
  logos: { left: LoadedImage | null; right: LoadedImage | null },
) => {
  const ws = workbook.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: footerText(doc) },
    views: [{ showGridLines: false }],
  });
  ws.columns = doc.columnWidths.map((width) => ({ width }));

  writeHeader(workbook, ws, doc, logos);

  const { leftLabel, leftValue, rightLabel, rightValue, shipTo } = doc.layout;
  let row = 6;
  const fieldRows = Math.max(doc.leftFields.length, doc.rightFields.length);
  for (let i = 0; i < fieldRows; i += 1) {
    if (doc.leftFields[i]) writeField(ws, row, doc.leftFields[i], leftLabel, leftValue);
    if (doc.rightFields[i]) writeField(ws, row, doc.rightFields[i], rightLabel, rightValue);
    ws.getRow(row).height = 20;
    row += 1;
  }
  row += 1;

  if (doc.shipTo?.length) {
    doc.shipTo.forEach((line, index) => {
      if (index === 0) {
        writeRange(ws, row, row, [0, 0], {
          value: doc.addressLabel ?? "SHIP TO",
          font: font({ bold: true }),
          align: "right",
          wrap: false,
        });
        if (doc.attention) {
          writeRange(ws, row, row, rightLabel, {
            value: doc.attention.label,
            font: font({ bold: true }),
            align: "right",
            wrap: false,
          });
          writeRange(ws, row, row, rightValue, {
            value: toExcelValue(doc.attention.value),
            font: font({ bold: doc.attention.bold }),
          });
        }
      }
      writeRange(ws, row, row, shipTo, { value: line, font: font({ bold: true }) });
      ws.getRow(row).height = Math.max(
        17,
        estimateLines(line, spanWidth(doc.columnWidths, shipTo)) * 13 + 4,
      );
      row += 1;
    });
    row += 1;
  }

  for (const table of doc.tables) {
    row = writeTable(ws, row, table, doc) + 1;
  }

  writeSignatures(ws, row + 1, doc);
};

export const exportNaavnExcel = async (docs: NaavnDocument[], fileName: string) => {
  const [{ default: ExcelJS }, logos] = await Promise.all([import("exceljs"), loadLogos()]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Naavn DDBMS";
  workbook.created = new Date();

  const used = new Set<string>();
  for (const doc of docs) {
    addDocumentSheet(workbook, doc, uniqueSheetName(doc.sheetName, used), logos);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${fileName}.xlsx`,
  );
};
