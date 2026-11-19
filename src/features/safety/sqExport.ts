import { downloadCsvFile } from "@/shared/utils/csv";
import { exportNaavnPdf } from "@/shared/documents/naavnPdf";
import { sanitizeDocumentFileName, toCalendarDate, type NaavnDocument, type NaavnTable } from "@/shared/documents/naavnDocument";
import type { SqRecord } from "./api";
import type { SqField } from "./components/RecordFormModal";
import { formatDate, humanize } from "./components/sqHelpers";

/**
 * Exports for the Safety & Quality registers. Both the CSV (list) and the
 * NAAVN-format PDF (single record) are built from the register's own form
 * fields, so every field is exported with readable labels instead of ids,
 * and a new form field shows up in both exports without extra work.
 */

/** A list of linked records shown on the record page and printed as a table on its PDF. */
export type SqRelated = {
  heading: string;
  rows: (record: SqRecord) => SqRecord[];
  columns: Array<{ header: string; value: (row: SqRecord) => string }>;
  empty: string;
};

export type SqExportSpec = {
  /** Form title on the PDF, e.g. "SAFETY REPORT". */
  formTitle: string;
  singular: string;
  fields: SqField[];
  related?: SqRelated[];
};

export type SqValueRow = { label: string; value: string; long: boolean };

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** One field's value as people read it: option label, formatted date, plain text. */
export const fieldDisplay = (field: SqField, record: SqRecord): string => {
  const raw = record[field.name];
  if (raw === null || raw === undefined || raw === "") return "";

  if (field.type === "select" || field.type === "search-select") {
    const option = field.options?.find((o) => String(o.value) === String(raw));
    return option ? option.label : text(raw);
  }
  if (field.type === "date") return formatDate(text(raw));
  if (field.type === "datetime") return formatDateTime(text(raw));
  return text(raw);
};

/** Every exportable value of a record, title excluded (it heads the document). */
export const recordValues = (spec: SqExportSpec, record: SqRecord): SqValueRow[] => {
  const rows: SqValueRow[] = [];
  if (record.reference) rows.push({ label: "Reference", value: text(record.reference), long: false });
  if (record.document_number && !spec.fields.some((f) => f.name === "document_number")) {
    rows.push({ label: "Document number", value: text(record.document_number), long: false });
  }

  spec.fields
    .filter((f) => f.type !== "file" && f.name !== "title")
    .forEach((f) => rows.push({ label: f.label, value: fieldDisplay(f, record), long: f.type === "textarea" }));

  // Derived statuses the form doesn't edit directly.
  if (record.effective_status) rows.push({ label: "Effective status", value: humanize(text(record.effective_status)), long: false });
  if (record.risk_score) rows.push({ label: "Risk score (L × S)", value: `${text(record.risk_score)} (${humanize(text(record.risk_level))})`, long: false });
  if (record.is_overdue === true) rows.push({ label: "Overdue", value: "Yes", long: false });
  if (record.created_at) rows.push({ label: "Recorded", value: formatDate(text(record.created_at)), long: false });

  return rows;
};

/** CSV of the records currently listed (filters applied), one column per field. */
export const exportRecordsCsv = (spec: SqExportSpec, records: SqRecord[], fileStem: string) => {
  const titleField = spec.fields.find((f) => f.name === "title");
  const perRecord = records.map((record) => new Map(recordValues(spec, record).map((r) => [r.label, r.value])));
  // Union of labels in first-seen order: some values (risk score, overdue) only exist on some records.
  const labels = Array.from(new Set(perRecord.flatMap((m) => Array.from(m.keys()))));
  const headers = [...(titleField ? [titleField.label] : []), ...labels];

  const rows = records.map((record, i) => [
    ...(titleField ? [text(record.title)] : []),
    ...labels.map((label) => perRecord[i].get(label) ?? ""),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`${fileStem}-${stamp}.csv`, [headers, ...rows]);
};

/** A single record on the official NAAVN form layout (crest, title block, signature boxes). */
export const buildRecordDocument = (spec: SqExportSpec, record: SqRecord): NaavnDocument => {
  const values = recordValues(spec, record);
  const short = values.filter((v) => !v.long && v.value !== "");
  const long = values.filter((v) => v.long);
  const half = Math.ceil(short.length / 2);
  const toField = (v: SqValueRow) => ({ label: `${v.label.toUpperCase()}:`, value: v.value });

  const tables: NaavnTable[] = [
    {
      heading: "DETAILS",
      columns: [
        { header: "SECTION", span: [0, 1] },
        { header: "DETAILS", span: [2, 6] },
      ],
      rows: long.map((v) => [v.label.toUpperCase(), v.value || "-"]),
      emptyText: "No further details recorded",
    },
    ...(spec.related ?? []).map<NaavnTable>((rel) => {
      // Spread the related columns across the 7-column grid.
      const n = rel.columns.length;
      const spans = rel.columns.map((_, i) => {
        const from = Math.floor((i * 7) / n);
        const to = Math.floor(((i + 1) * 7) / n) - 1;
        return [from, Math.max(from, to)] as const;
      });
      return {
        heading: rel.heading.toUpperCase(),
        columns: rel.columns.map((c, i) => ({ header: c.header.toUpperCase(), span: spans[i] })),
        rows: rel.rows(record).map((row) => rel.columns.map((c) => c.value(row) || "-")),
        emptyText: rel.empty,
      };
    }),
  ];

  return {
    title: spec.formTitle,
    docRef: null,
    revisionNo: null,
    revisionDate: null,
    sheetName: text(record.reference || record.document_number || `${spec.singular} ${record.id}`).slice(0, 31),
    columnWidths: [8.3, 16, 18, 24, 22, 15, 16],
    layout: {
      leftLabel: [0, 1],
      leftValue: [2, 2],
      rightLabel: [4, 4],
      rightValue: [5, 6],
      shipTo: [1, 4],
    },
    leftFields: [
      { label: "DATE:", value: toCalendarDate(new Date().toISOString()) },
      ...short.slice(0, half).map(toField),
    ],
    rightFields: short.slice(half).map(toField),
    addressLabel: "TITLE",
    shipTo: [text(record.title) || `${spec.singular} #${record.id}`],
    tables,
    approval: true,
  };
};

export const downloadRecordPdf = (spec: SqExportSpec, record: SqRecord) =>
  exportNaavnPdf(
    [buildRecordDocument(spec, record)],
    sanitizeDocumentFileName(`${text(record.reference || record.document_number) || `${spec.singular} ${record.id}`} ${text(record.title)}`),
  );

/** Simple key/value PDF for computed views (pilot currency, unit oversight) on the same NAAVN form. */
/** Header grid of the summary form (Excel character widths). */
const SUMMARY_WIDTHS = [8.3, 16, 18, 24, 22, 15, 16];
/**
 * Each header column is split into this many grid columns, so a table can have
 * up to 7 × SUMMARY_SPLIT columns, each in its own cell, while the header
 * boxes keep their layout.
 */
const SUMMARY_SPLIT = 6;

/**
 * Lays `n` table columns over the grid columns (of widths `gridWidths`) in
 * proportion to `weights` (equal by default), snapping each boundary to the
 * grid line closest in actual width. Every column gets at least one grid
 * column of its own, so no two columns ever share a cell.
 */
const tableSpans = (n: number, gridWidths: number[], weights?: number[]): Array<readonly [number, number]> => {
  const grid = gridWidths.length;
  const w = Array.from({ length: n }, (_, i) => Math.max(0.1, weights?.[i] ?? 1));
  const total = w.reduce((sum, x) => sum + x, 0);
  const gridTotal = gridWidths.reduce((sum, x) => sum + x, 0);
  // edges[k] = distance from the left of grid line k (0 … grid)
  const edges = gridWidths.reduce<number[]>((acc, x) => [...acc, acc[acc.length - 1] + x], [0]);
  const bounds = [0];
  let cumulative = 0;
  for (let i = 0; i < n; i += 1) {
    cumulative += w[i];
    const target = (cumulative / total) * gridTotal;
    let ideal = grid;
    if (i < n - 1) {
      ideal = edges.reduce((best, edge, k) => (Math.abs(edge - target) < Math.abs(edges[best] - target) ? k : best), 0);
    }
    const min = bounds[i] + 1;
    const max = grid - (n - 1 - i);
    bounds.push(Math.min(max, Math.max(min, ideal)));
  }
  return w.map((_, i) => [bounds[i], bounds[i + 1] - 1] as const);
};

export const downloadSummaryPdf = (opts: {
  formTitle: string;
  title: string;
  fileName: string;
  fields: Array<[string, string]>;
  /** `widths`: optional relative width per column (e.g. a notes column at 2). */
  tables?: Array<{ heading: string; headers: string[]; rows: string[][]; empty: string; widths?: number[] }>;
}) => {
  const half = Math.ceil(opts.fields.length / 2);
  const toField = ([label, value]: [string, string]) => ({ label: `${label.toUpperCase()}:`, value });
  const k = SUMMARY_SPLIT;
  const gridWidths = SUMMARY_WIDTHS.flatMap((w) => Array.from({ length: k }, () => w / k));
  const span = (a: number, b: number) => [a * k, b * k + k - 1] as const;
  const doc: NaavnDocument = {
    title: opts.formTitle,
    sheetName: opts.title.slice(0, 31),
    columnWidths: gridWidths,
    layout: { leftLabel: span(0, 1), leftValue: span(2, 2), rightLabel: span(4, 4), rightValue: span(5, 6), shipTo: span(1, 4) },
    leftFields: [{ label: "DATE:", value: toCalendarDate(new Date().toISOString()) }, ...opts.fields.slice(0, half).map(toField)],
    rightFields: opts.fields.slice(half).map(toField),
    addressLabel: "SUBJECT",
    shipTo: [opts.title],
    tables: (opts.tables ?? []).map((t) => {
      const spans = tableSpans(t.headers.length, gridWidths, t.widths);
      return {
        heading: t.heading.toUpperCase(),
        columns: t.headers.map((h, i) => ({ header: h.toUpperCase(), span: spans[i] })),
        rows: t.rows,
        emptyText: t.empty,
      };
    }),
    approval: true,
  };
  return exportNaavnPdf([doc], sanitizeDocumentFileName(opts.fileName));
};
