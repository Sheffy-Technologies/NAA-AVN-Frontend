/**
 * Shared model for the official NAAVN paper forms (Purchase Order, RFQ, Work Order).
 *
 * A document is laid out on a fixed column grid (Excel column widths), so the same
 * definition drives both the styled .xlsx export (`naavnExcel.ts`) and the vector
 * PDF export (`naavnPdf.ts`). The layout mirrors the templates in `docs/`.
 */

/** Inclusive [from, to] range of grid column indexes. */
export type NaavnSpan = readonly [from: number, to: number];

export type NaavnValue = string | number | Date | null | undefined;

export type NaavnField = {
  label: string;
  value: NaavnValue;
  bold?: boolean;
};

export type NaavnColumnFormat = "text" | "integer" | "decimal" | "money";

export type NaavnColumn = {
  header: string;
  span: NaavnSpan;
  align?: "left" | "center" | "right";
  format?: NaavnColumnFormat;
  /** Written to Excel as a formula multiplying these two columns (indexes into `columns`). */
  productOf?: readonly [number, number];
};

export type NaavnTable = {
  heading?: string;
  columns: NaavnColumn[];
  rows: NaavnValue[][];
  emptyText?: string;
  /** Adds a TOTAL row summing `column` (an index into `columns`). */
  total?: { label: string; labelSpan: NaavnSpan; column: number };
};

export type NaavnLayout = {
  leftLabel: NaavnSpan;
  leftValue: NaavnSpan;
  rightLabel: NaavnSpan;
  rightValue: NaavnSpan;
  shipTo: NaavnSpan;
  /** Blank box beside "SIGNATURE OF ISSUER"; defaults to `leftValue`. */
  issuerSignature?: NaavnSpan;
};

export type NaavnDocument = {
  /** Form title under "NIGERIAN ARMY AVIATION", e.g. "PURCHASE ORDER". */
  title: string;
  docRef?: string | null;
  revisionNo?: string | null;
  revisionDate?: string | null;
  sheetName: string;
  /** Excel character widths; the PDF scales them to the page width. */
  columnWidths: number[];
  layout: NaavnLayout;
  currency?: { symbol: string; code?: string | null } | null;
  leftFields: NaavnField[];
  rightFields: NaavnField[];
  shipTo?: string[];
  /** Label printed before the `shipTo` lines; defaults to "SHIP TO". */
  addressLabel?: string;
  /** Printed beside the first ship-to line (the RFQ's "ATTN"). */
  attention?: NaavnField | null;
  tables: NaavnTable[];
  /** Show the "APPROVED BY" / "APPROVAL SIGNATURE" boxes next to the issuer signature. */
  approval: boolean;
  footnote?: string | null;
};

export const NAAVN_SHIP_TO = [
  "Nigerian Army Aviation",
  "Airport Road, Opposite University of Abuja",
  "Giri, Abuja.",
  "Nigeria",
];

export const NAAVN_LOGOS = {
  left: "/images/documents/nigerian-army-logo.png",
  right: "/images/documents/naavn-logo.jpeg",
} as const;

export const NAAVN_LABEL_FILL = "BFBFBF";
export const NAAVN_PLACEHOLDER_COLOR = "BFBFBF";

/**
 * Parses an API date ("2026-09-15" or an ISO timestamp) to a local calendar date,
 * without the UTC shift `new Date("2026-09-15")` would apply.
 */
export const toCalendarDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatLongDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

export const formatNumber = (value: number, fractionDigits: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

export const toNumber = (value: NaavnValue): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export const columnTotal = (table: NaavnTable, column: number) =>
  table.rows.reduce((sum, row) => sum + (toNumber(row[column]) ?? 0), 0);

export const sanitizeDocumentFileName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ") || "document";

export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export type LoadedImage = { dataUrl: string; base64: string; extension: "png" | "jpeg" };

const imageCache = new Map<string, Promise<LoadedImage>>();

export const loadImage = (url: string): Promise<LoadedImage> => {
  const cached = imageCache.get(url);
  if (cached) return cached;

  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<LoadedImage>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result);
            resolve({
              dataUrl,
              base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
              extension: url.endsWith(".png") ? "png" : "jpeg",
            });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    );

  imageCache.set(url, pending);
  pending.catch(() => imageCache.delete(url));
  return pending;
};

import { ARMY_LOGO_DATA_URL, NA_AVN_LOGO_DATA_URL } from "@/features/inventory/components/purchaseOrderLogos";

const toLoadedFromDataUrl = (dataUrl: string): LoadedImage => ({
  dataUrl,
  base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
  extension: dataUrl.startsWith("data:image/png") ? "png" : "jpeg",
});

/** Loads both logos; a missing logo leaves its slot empty rather than failing the export. */
export const loadLogos = async () => {
  const [left, right] = await Promise.all([
    loadImage(NAAVN_LOGOS.left).catch(() => toLoadedFromDataUrl(ARMY_LOGO_DATA_URL)),
    loadImage(NAAVN_LOGOS.right).catch(() => toLoadedFromDataUrl(NA_AVN_LOGO_DATA_URL)),
  ]);
  return { left, right };
};
