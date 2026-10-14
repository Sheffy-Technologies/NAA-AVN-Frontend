import type { jsPDF } from "jspdf";
import {
  NAAVN_LABEL_FILL,
  NAAVN_PLACEHOLDER_COLOR,
  columnTotal,
  formatLongDate,
  formatNumber,
  loadLogos,
  toNumber,
  type LoadedImage,
  type NaavnColumn,
  type NaavnDocument,
  type NaavnField,
  type NaavnSpan,
  type NaavnTable,
  type NaavnValue,
} from "./naavnDocument";

const PAGE = { width: 210, height: 297, marginX: 12, top: 10, bottom: 18 };
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;
const LINE_MM = 3.7;
const PAD = 1.8;
const FIELD_HEIGHT = 7;
const LOGO_MM = 25;
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];

const LABEL_RGB = hexToRgb(NAAVN_LABEL_FILL);
const PLACEHOLDER_RGB = hexToRgb(NAAVN_PLACEHOLDER_COLOR);

/** The built-in PDF fonts only cover Latin-1, so e.g. "₦" falls back to the currency code. */
const pdfCurrencySymbol = (doc: NaavnDocument) => {
  const symbol = doc.currency?.symbol ?? "";
  if (/^[ -ÿ€]*$/.test(symbol)) return symbol;
  return doc.currency?.code ?? "";
};

const formatValue = (value: NaavnValue, format?: NaavnColumn["format"]) => {
  if (value instanceof Date) return formatLongDate(value);
  if (value === null || value === undefined) return "";
  const number = toNumber(value);
  if (number !== null) {
    if (format === "money" || format === "decimal") return formatNumber(number, 2);
    if (format === "integer") return formatNumber(number, 0);
  }
  return String(value);
};

class Renderer {
  private y = PAGE.top;
  private readonly xs: number[];
  private readonly ws: number[];
  private readonly pdf: jsPDF;
  private readonly doc: NaavnDocument;
  private readonly logos: { left: LoadedImage | null; right: LoadedImage | null };

  constructor(
    pdf: jsPDF,
    doc: NaavnDocument,
    logos: { left: LoadedImage | null; right: LoadedImage | null },
  ) {
    this.pdf = pdf;
    this.doc = doc;
    this.logos = logos;
    const total = doc.columnWidths.reduce((sum, w) => sum + w, 0);
    this.ws = doc.columnWidths.map((w) => (w / total) * CONTENT_WIDTH);
    this.xs = this.ws.map(
      (_, i) => PAGE.marginX + this.ws.slice(0, i).reduce((sum, w) => sum + w, 0),
    );
  }

  private spanX(span: NaavnSpan) {
    return this.xs[span[0]];
  }

  private spanW(span: NaavnSpan) {
    return this.ws.slice(span[0], span[1] + 1).reduce((sum, w) => sum + w, 0);
  }

  private setFont(size: number, bold = false, italic = false) {
    const style = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
    this.pdf.setFont("helvetica", style);
    this.pdf.setFontSize(size);
  }

  /** Sets the largest font size (down to 5.5pt) at which `text` fits on one line in `width`. */
  private setFontToFit(text: string, width: number, size: number, bold = false) {
    let fitted = size;
    this.setFont(fitted, bold);
    while (fitted > 5.5 && this.pdf.getTextWidth(text) > width - PAD * 2) {
      fitted -= 0.5;
      this.setFont(fitted, bold);
    }
  }

  private wrap(text: string, width: number) {
    return this.pdf.splitTextToSize(text, Math.max(4, width - PAD * 2)) as string[];
  }

  private box(x: number, y: number, w: number, h: number, fill?: [number, number, number]) {
    this.pdf.setLineWidth(0.2);
    this.pdf.setDrawColor(0, 0, 0);
    if (fill) {
      this.pdf.setFillColor(...fill);
      this.pdf.rect(x, y, w, h, "FD");
    } else {
      this.pdf.rect(x, y, w, h);
    }
  }

  /** Draws pre-wrapped lines vertically centred in a box. */
  private textIn(
    lines: string[],
    x: number,
    y: number,
    w: number,
    h: number,
    align: "left" | "center" | "right" = "left",
  ) {
    const startY = y + h / 2 - ((lines.length - 1) * LINE_MM) / 2;
    const tx = align === "left" ? x + PAD : align === "right" ? x + w - PAD : x + w / 2;
    lines.forEach((line, i) => {
      this.pdf.text(line, tx, startY + i * LINE_MM, { align, baseline: "middle" });
    });
  }

  private ensureSpace(height: number) {
    if (this.y + height <= PAGE.height - PAGE.bottom) return false;
    this.pdf.addPage();
    this.y = PAGE.top + 4;
    return true;
  }

  render() {
    this.header();
    this.fields();
    this.shipTo();
    for (const table of this.doc.tables) this.table(table);
    this.signatures();
  }

  private header() {
    const { pdf, doc, logos } = this;
    const top = PAGE.top;
    if (logos.left) {
      pdf.addImage(logos.left.dataUrl, logos.left.extension.toUpperCase(), PAGE.marginX, top, LOGO_MM, LOGO_MM);
    }
    if (logos.right) {
      pdf.addImage(
        logos.right.dataUrl,
        logos.right.extension.toUpperCase(),
        PAGE.width - PAGE.marginX - LOGO_MM,
        top,
        LOGO_MM,
        LOGO_MM,
      );
    }

    const cx = PAGE.width / 2;
    pdf.setTextColor(0, 0, 0);
    this.setFont(8);
    pdf.text("RESTRICTED", cx, top + 3, { align: "center", baseline: "middle" });
    this.setFont(15, true);
    pdf.text("NIGERIAN ARMY AVIATION", cx, top + 9, { align: "center", baseline: "middle" });
    this.setFont(13, true);
    pdf.text(doc.title, cx, top + 15, { align: "center", baseline: "middle" });

    if (doc.docRef) {
      const label = "DOCUMENT REF No.: ";
      this.setFont(8);
      const labelW = pdf.getTextWidth(label);
      this.setFont(8, true);
      const refW = pdf.getTextWidth(doc.docRef);
      const startX = cx - (labelW + refW) / 2;
      this.setFont(8);
      pdf.text(label, startX, top + 20, { baseline: "middle" });
      this.setFont(8, true);
      pdf.text(doc.docRef, startX + labelW, top + 20, { baseline: "middle" });
    }

    this.y = top + LOGO_MM + 6;
  }

  private field(field: NaavnField, labelSpan: NaavnSpan, valueSpan: NaavnSpan, y: number) {
    const lx = this.spanX(labelSpan);
    const lw = this.spanW(labelSpan);
    const vx = this.spanX(valueSpan);
    const vw = this.spanW(valueSpan);

    this.box(lx, y, lw, FIELD_HEIGHT, LABEL_RGB);
    this.setFontToFit(field.label, lw, 8, true);
    this.textIn([field.label], lx, y, lw, FIELD_HEIGHT);

    const value = formatValue(field.value);
    this.box(vx, y, vw, FIELD_HEIGHT);
    this.setFontToFit(value, vw, 8, Boolean(field.bold));
    this.textIn([value], vx, y, vw, FIELD_HEIGHT, "center");
  }

  private fields() {
    const { leftFields, rightFields, layout } = this.doc;
    const rows = Math.max(leftFields.length, rightFields.length);
    for (let i = 0; i < rows; i += 1) {
      if (leftFields[i]) this.field(leftFields[i], layout.leftLabel, layout.leftValue, this.y);
      if (rightFields[i]) this.field(rightFields[i], layout.rightLabel, layout.rightValue, this.y);
      this.y += FIELD_HEIGHT;
    }
    this.y += 5;
  }

  private shipTo() {
    const { shipTo, attention, addressLabel, layout } = this.doc;
    if (!shipTo?.length) return;

    const lineH = 5.5;
    this.setFont(8, true);
    const textRight = attention ? this.spanX(layout.rightLabel) : PAGE.width - PAGE.marginX;
    const lines = shipTo.flatMap((line) =>
      this.wrap(line, textRight - this.spanX(layout.shipTo)),
    );
    lines.forEach((line, index) => {
      const cy = this.y + lineH / 2;
      this.setFont(8, true);
      if (index === 0) {
        this.pdf.text(addressLabel ?? "SHIP TO", this.spanX(layout.shipTo) - PAD, cy, {
          align: "right",
          baseline: "middle",
        });
        if (attention) {
          this.pdf.text(attention.label, this.spanX(layout.rightValue) - PAD, cy, {
            align: "right",
            baseline: "middle",
          });
          this.setFont(8, Boolean(attention.bold));
          this.pdf.text(formatValue(attention.value), this.spanX(layout.rightValue) + PAD, cy, {
            baseline: "middle",
          });
          this.setFont(8, true);
        }
      }
      this.pdf.text(line, this.spanX(layout.shipTo) + PAD, cy, { baseline: "middle" });
      this.y += lineH;
    });
    this.y += 5;
  }

  private tableHeader(table: NaavnTable) {
    this.setFont(8, true);
    const wrapped = table.columns.map((c) => this.wrap(c.header, this.spanW(c.span)));
    const headerH = Math.max(...wrapped.map((l) => l.length)) * LINE_MM + 2 + LINE_MM + 2;

    table.columns.forEach((column, index) => {
      const x = this.spanX(column.span);
      const w = this.spanW(column.span);
      this.box(x, this.y, w, headerH);
      this.setFont(8, true);
      this.textIn(wrapped[index], x, this.y, w, headerH - LINE_MM - 1, "center");
      this.setFont(7);
      this.pdf.text(`(${LETTERS[index] ?? index + 1})`, x + w / 2, this.y + headerH - LINE_MM / 2 - 1.5, {
        align: "center",
        baseline: "middle",
      });
    });
    this.y += headerH;
    return headerH;
  }

  private moneyCell(text: string, x: number, w: number, y: number, h: number) {
    const symbol = pdfCurrencySymbol(this.doc);
    if (symbol) {
      this.pdf.text(symbol, x + PAD, y + h / 2, { baseline: "middle" });
    }
    this.pdf.text(text, x + w - PAD, y + h / 2, { align: "right", baseline: "middle" });
  }

  private table(table: NaavnTable) {
    const firstCol = Math.min(...table.columns.map((c) => c.span[0]));
    const lastCol = Math.max(...table.columns.map((c) => c.span[1]));
    const fullSpan: NaavnSpan = [firstCol, lastCol];
    const tableX = this.spanX(fullSpan);
    const tableW = this.spanW(fullSpan);

    this.ensureSpace(30);
    if (table.heading) {
      this.setFont(9, true);
      this.pdf.text(table.heading, tableX, this.y + 3, { baseline: "middle" });
      this.y += 6;
    }

    let blockTop = this.y;
    this.tableHeader(table);

    const closeBlock = () => {
      this.pdf.setLineWidth(0.5);
      this.pdf.rect(tableX, blockTop, tableW, this.y - blockTop);
    };

    if (table.rows.length === 0) {
      const h = 10;
      this.box(tableX, this.y, tableW, h);
      this.setFont(8, false, true);
      this.textIn([table.emptyText ?? "No records"], tableX, this.y, tableW, h, "center");
      this.y += h;
    }

    for (const values of table.rows) {
      this.setFont(8);
      const cells = table.columns.map((column, index) => {
        const text = formatValue(values[index], column.format);
        const lines = column.format === "money" ? [text] : this.wrap(text, this.spanW(column.span));
        return { column, lines };
      });
      const rowH = Math.max(10, Math.max(...cells.map((c) => c.lines.length)) * LINE_MM + 4);

      // Box the rows on this page, then repeat the column headers on the next one.
      if (this.y + rowH > PAGE.height - PAGE.bottom) {
        closeBlock();
        this.ensureSpace(rowH);
        blockTop = this.y;
        this.tableHeader(table);
      }

      this.setFont(8);
      for (const { column, lines } of cells) {
        const x = this.spanX(column.span);
        const w = this.spanW(column.span);
        this.box(x, this.y, w, rowH);
        if (column.format === "money") {
          if (lines[0]) this.moneyCell(lines[0], x, w, this.y, rowH);
        } else {
          const numeric = column.format !== undefined && column.format !== "text";
          this.textIn(lines, x, this.y, w, rowH, column.align ?? (numeric ? "center" : "left"));
        }
      }
      this.y += rowH;
    }
    closeBlock();

    if (table.total) {
      const column = table.columns[table.total.column];
      const h = 7;
      this.ensureSpace(h);
      const lx = this.spanX(table.total.labelSpan);
      const lw = this.spanW(table.total.labelSpan);
      this.box(lx, this.y, lw, h, LABEL_RGB);
      this.setFont(9.5, true);
      this.textIn(["TOTAL"], lx, this.y, lw, h, "center");

      const vx = this.spanX(column.span);
      const vw = this.spanW(column.span);
      this.pdf.setLineWidth(0.5);
      this.pdf.rect(vx, this.y, vw, h);
      this.moneyCell(formatNumber(columnTotal(table, table.total.column), 2), vx, vw, this.y, h);
      this.y += h;
    }

    this.y += 8;
  }

  private signatures() {
    const { layout, approval, footnote } = this.doc;
    const h = 16;
    this.ensureSpace(h * 2 + 6);
    const top = this.y;

    const label = (span: NaavnSpan, text: string, y: number) => {
      const x = this.spanX(span);
      const w = this.spanW(span);
      this.box(x, y, w, h, LABEL_RGB);
      this.setFont(8, true);
      this.textIn(this.wrap(text, w), x, y, w, h, "center");
    };
    const blank = (span: NaavnSpan, y: number) =>
      this.box(this.spanX(span), y, this.spanW(span), h);

    label(layout.leftLabel, "SIGNATURE OF ISSUER", top);
    blank(layout.issuerSignature ?? layout.leftValue, top);

    if (approval) {
      label(layout.rightLabel, "APPROVED BY:", top);
      blank(layout.rightValue, top);
      this.setFontToFit("RANK INITIAL AND SURNAME", this.spanW(layout.rightValue), 7.5);
      this.pdf.setTextColor(...PLACEHOLDER_RGB);
      this.textIn(
        ["RANK INITIAL AND SURNAME"],
        this.spanX(layout.rightValue),
        top,
        this.spanW(layout.rightValue),
        h,
        "center",
      );
      this.pdf.setTextColor(0, 0, 0);
      label(layout.rightLabel, "APPROVAL SIGNATURE:", top + h);
      blank(layout.rightValue, top + h);
    }

    if (footnote) {
      this.setFont(7.5, true);
      this.pdf.text(footnote, this.spanX(layout.leftLabel), top + h + 7, { baseline: "middle" });
    }
    this.y = top + h * 2 + 6;
  }
}

const drawFooters = (pdf: jsPDF, doc: NaavnDocument, firstPage: number, lastPage: number) => {
  const count = lastPage - firstPage + 1;
  const y = PAGE.height - 8;
  for (let page = firstPage; page <= lastPage; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(0, 0, 0);
    if (doc.revisionNo) pdf.text(`Revision No.: ${doc.revisionNo}`, PAGE.marginX, y);
    if (doc.revisionDate) {
      pdf.text(`Revision Date: ${doc.revisionDate}`, PAGE.width / 2, y, { align: "center" });
    }
    pdf.setFontSize(8.5);
    pdf.text(`Page ${page - firstPage + 1} of ${count}`, PAGE.width - PAGE.marginX, y, {
      align: "right",
    });
  }
};

/** Renders each document on its own pages (with its own page numbering) into one PDF. */
export const exportNaavnPdf = async (docs: NaavnDocument[], fileName: string) => {
  const [{ jsPDF }, logos] = await Promise.all([import("jspdf"), loadLogos()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const ranges: Array<{ doc: NaavnDocument; first: number; last: number }> = [];
  docs.forEach((doc, index) => {
    if (index > 0) pdf.addPage();
    const first = pdf.getNumberOfPages();
    new Renderer(pdf, doc, logos).render();
    ranges.push({ doc, first, last: pdf.getNumberOfPages() });
  });
  for (const { doc, first, last } of ranges) drawFooters(pdf, doc, first, last);

  pdf.save(`${fileName}.pdf`);
};
