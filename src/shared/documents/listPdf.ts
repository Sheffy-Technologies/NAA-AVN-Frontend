import type { jsPDF } from "jspdf";
import { NAAVN_LABEL_FILL, loadLogos, sanitizeDocumentFileName } from "./naavnDocument";

/**
 * Prints any list (the same headers and rows its CSV export uses) as a NAAVN
 * PDF: landscape A4, crests, RESTRICTED marking, a header row repeated on every
 * page, and "Page x of y". Column widths follow the content unless given.
 */
export type ListPdfOptions = {
  /** Title under "NIGERIAN ARMY AVIATION", e.g. "INVENTORY". */
  title: string;
  /** Optional line under the title, e.g. the filters applied. */
  subtitle?: string;
  fileName: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  /** Relative column widths; worked out from the content when omitted. */
  widths?: number[];
};

const PAGE = { width: 297, height: 210, marginX: 10, top: 8, bottom: 14 };
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;
const LOGO_MM = 18;
const PAD = 1.5;
const LINE_MM = 3.2;
const BODY_PT = 7;
const HEAD_PT = 7;

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];
const HEAD_FILL = hexToRgb(NAAVN_LABEL_FILL);

/** The built-in PDF fonts only cover Latin-1 (plus a few typographic marks). */
const pdfText = (value: unknown): string =>
  String(value ?? "")
    .replace(/₦/g, "NGN ")
    .replace(/[^\x20-\xFF–—‘’“”…€\n]/g, "");

/** Weights from the header and the typical (90th-percentile) cell length, capped so one long note can't take the page. */
const autoWidths = (headers: string[], rows: string[][]) =>
  headers.map((header, c) => {
    const lengths = rows.map((r) => (r[c] ?? "").length).sort((a, b) => a - b);
    const typical = lengths.length ? lengths[Math.floor((lengths.length - 1) * 0.9)] : 0;
    const longestWord = Math.max(4, ...header.split(/\s+/).map((w) => w.length));
    return Math.min(40, Math.max(longestWord, typical, 4));
  });

export const downloadListPdf = async (opts: ListPdfOptions) => {
  const [{ jsPDF }, logos] = await Promise.all([import("jspdf"), loadLogos()]);
  const pdf: jsPDF = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const headers = opts.headers.map((h) => pdfText(h).toUpperCase());
  const rows = opts.rows.map((r) => headers.map((_, c) => pdfText(r[c])));
  const weights = (opts.widths?.length === headers.length ? opts.widths : autoWidths(headers, rows)).map((w) => Math.max(0.1, w));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const colW = weights.map((w) => (w / totalWeight) * CONTENT_WIDTH);
  const colX = colW.reduce<number[]>((xs, _w, i) => [...xs, i === 0 ? PAGE.marginX : xs[i - 1] + colW[i - 1]], []);

  const setFont = (size: number, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
  };
  const wrap = (text: string, width: number) => pdf.splitTextToSize(text || "", Math.max(3, width - PAD * 2)) as string[];

  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  /** Page heading; returns the y where content starts. Full heading on page 1, a slim one after. */
  const drawHeading = (first: boolean) => {
    const top = PAGE.top;
    const cx = PAGE.width / 2;
    pdf.setTextColor(0, 0, 0);
    if (first) {
      if (logos.left) pdf.addImage(logos.left.dataUrl, logos.left.extension.toUpperCase(), PAGE.marginX, top, LOGO_MM, LOGO_MM);
      if (logos.right) {
        pdf.addImage(logos.right.dataUrl, logos.right.extension.toUpperCase(), PAGE.width - PAGE.marginX - LOGO_MM, top, LOGO_MM, LOGO_MM);
      }
      setFont(7.5);
      pdf.text("RESTRICTED", cx, top + 2.5, { align: "center", baseline: "middle" });
      setFont(13, true);
      pdf.text("NIGERIAN ARMY AVIATION", cx, top + 8, { align: "center", baseline: "middle" });
      setFont(11, true);
      pdf.text(pdfText(opts.title).toUpperCase(), cx, top + 13.5, { align: "center", baseline: "middle" });
      setFont(7.5);
      const meta = [opts.subtitle ? pdfText(opts.subtitle) : null, `${rows.length} record${rows.length === 1 ? "" : "s"}`, `Printed ${generated}`]
        .filter(Boolean)
        .join("  ·  ");
      pdf.text(meta, cx, top + 18.5, { align: "center", baseline: "middle" });
      return top + LOGO_MM + 4;
    }
    setFont(7.5);
    pdf.text("RESTRICTED", cx, top + 2.5, { align: "center", baseline: "middle" });
    setFont(8, true);
    pdf.text(`${pdfText(opts.title).toUpperCase()} (continued)`, PAGE.marginX, top + 7, { baseline: "middle" });
    return top + 11;
  };

  const drawHeaderRow = (y: number) => {
    setFont(HEAD_PT, true);
    const lines = headers.map((h, c) => wrap(h, colW[c]));
    const h = Math.max(...lines.map((l) => l.length)) * LINE_MM + PAD * 2;
    pdf.setLineWidth(0.2);
    pdf.setDrawColor(0, 0, 0);
    // Boxes first, then labels: drawing text changes the PDF fill colour, which would turn later boxes black.
    pdf.setFillColor(...HEAD_FILL);
    headers.forEach((_, c) => pdf.rect(colX[c], y, colW[c], h, "FD"));
    pdf.setTextColor(0, 0, 0);
    headers.forEach((_, c) => {
      lines[c].forEach((line, i) => pdf.text(line, colX[c] + PAD, y + PAD + LINE_MM * (i + 0.5), { baseline: "middle" }));
    });
    return y + h;
  };

  let y = drawHeaderRow(drawHeading(true));
  const limit = PAGE.height - PAGE.bottom;

  if (!rows.length) {
    setFont(BODY_PT);
    pdf.rect(PAGE.marginX, y, CONTENT_WIDTH, 8);
    pdf.text("No records.", PAGE.width / 2, y + 4, { align: "center", baseline: "middle" });
  }

  rows.forEach((row) => {
    setFont(BODY_PT);
    let lines = row.map((cell, c) => wrap(cell, colW[c]));
    // A single cell taller than a page is cut, so the table never loops.
    const maxLines = Math.floor((limit - PAGE.top - 30) / LINE_MM);
    lines = lines.map((l) => (l.length > maxLines ? [...l.slice(0, maxLines - 1), "…"] : l));
    const h = Math.max(1, ...lines.map((l) => l.length)) * LINE_MM + PAD * 2;

    if (y + h > limit) {
      pdf.addPage();
      y = drawHeaderRow(drawHeading(false));
      setFont(BODY_PT);
    }

    pdf.setLineWidth(0.2);
    row.forEach((_, c) => {
      pdf.rect(colX[c], y, colW[c], h);
      lines[c].forEach((line, i) => pdf.text(line, colX[c] + PAD, y + PAD + LINE_MM * (i + 0.5), { baseline: "middle" }));
    });
    y += h;
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    setFont(7.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text("RESTRICTED", PAGE.width / 2, PAGE.height - 6, { align: "center" });
    pdf.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.marginX, PAGE.height - 6, { align: "right" });
  }

  pdf.save(`${sanitizeDocumentFileName(opts.fileName)}.pdf`);
};
