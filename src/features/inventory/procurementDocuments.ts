import {
  NAAVN_SHIP_TO,
  toCalendarDate,
  toNumber,
  type NaavnDocument,
  type NaavnLayout,
} from "@/shared/documents/naavnDocument";
import type { InventoryRequisitionDetail, InventorySupplier, PurchaseOrder, Rfq } from "./api";

// Grid and layout copied from docs/NAAVN Purchase Order Sheet.xlsx (sheet NAAVN-006).
const PO_COLUMN_WIDTHS = [8.3, 19.5, 16.8, 12.8, 16.7, 14, 25.3];
const PO_LAYOUT: NaavnLayout = {
  leftLabel: [0, 1],
  leftValue: [2, 2],
  rightLabel: [4, 5],
  rightValue: [6, 6],
  shipTo: [1, 2],
};

// Grid and layout copied from docs/RFQ Form 001 Midwest.xlsx.
const RFQ_COLUMN_WIDTHS = [8.3, 22, 22, 42, 15, 13];
const RFQ_LAYOUT: NaavnLayout = {
  leftLabel: [0, 1],
  leftValue: [2, 3],
  rightLabel: [3, 3],
  rightValue: [4, 5],
  shipTo: [1, 2],
  issuerSignature: [2, 2],
};

// Same 7-column grid as the purchase order. The last column stays as wide
// as the PO's: the approval box beside it takes its width from it.
const REQUISITION_COLUMN_WIDTHS = [8.3, 19.5, 24.5, 9, 13, 13, 25.3];
const REQUISITION_LAYOUT: NaavnLayout = {
  leftLabel: [0, 1],
  leftValue: [2, 2],
  rightLabel: [4, 5],
  rightValue: [6, 6],
  shipTo: [1, 2],
};

export const personName = (
  person?: {
    firstname?: string | null;
    lastname?: string | null;
    username?: string | null;
    email?: string | null;
  } | null,
) => {
  if (!person) return "";
  const name = [person.firstname, person.lastname]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();
  return (name || person.username || person.email || "").toUpperCase();
};

type PurchaseOrderDocumentOptions = {
  issuedBy?: string | null;
  quoteNumber?: string | null;
};

export const buildPurchaseOrderDocument = (
  order: PurchaseOrder,
  { issuedBy, quoteNumber }: PurchaseOrderDocumentOptions = {},
): NaavnDocument => {
  const currency = order.currency ?? null;

  return {
    title: "PURCHASE ORDER",
    docRef: "NAAVN-006",
    revisionNo: "00",
    revisionDate: "17 February 2026",
    sheetName: `PO ${order.id}`,
    columnWidths: PO_COLUMN_WIDTHS,
    layout: PO_LAYOUT,
    currency: currency ? { symbol: currency.symbol || currency.code, code: currency.code } : null,
    leftFields: [
      { label: "DATE:", value: toCalendarDate(order.order_date ?? order.created_at) },
      { label: "ISSUED BY:", value: issuedBy },
    ],
    rightFields: [
      { label: "P.O NUMBER:", value: order.id },
      { label: "SUPPLIER:", value: order.supplier?.name?.toUpperCase(), bold: true },
      { label: "QUOTE NO.:", value: quoteNumber },
    ],
    shipTo: NAAVN_SHIP_TO,
    tables: [
      {
        columns: [
          { header: "ITEM", span: [0, 0], align: "center" },
          { header: "PART NUMBER", span: [1, 1] },
          { header: "DESCRIPTION", span: [2, 2] },
          { header: "CONDITION", span: [3, 3], align: "center" },
          { header: "QUANTITY", span: [4, 4], format: "decimal" },
          { header: "UNIT PRICE", span: [5, 5], format: "money" },
          { header: "TOTAL PRICE", span: [6, 6], format: "money", productOf: [4, 5] },
        ],
        rows: (order.items ?? []).map((item, index) => {
          const quantity = toNumber(item.quantity_ordered ?? null) ?? 0;
          const unitPrice = toNumber(item.unit_price ?? null) ?? 0;
          return [
            index + 1,
            item.part_number || item.inventory?.part_number || "",
            item.inventory?.description || item.inventory?.part_name || "",
            "",
            quantity,
            unitPrice,
            quantity * unitPrice,
          ];
        }),
        emptyText: "No items on this purchase order",
        total: { label: "TOTAL", labelSpan: [5, 5], column: 6 },
      },
    ],
    approval: true,
    footnote: "*Attach copy of quote provided by supplier for reference.",
  };
};

/** One RFQ form per supplier, matching the one-supplier-per-sheet template. */
export const buildRfqDocument = (
  rfq: Rfq,
  supplier: InventorySupplier | null,
): NaavnDocument => ({
  title: "REQUEST FOR QUOTATION",
  docRef: "NAAVN-010",
  revisionNo: "00",
  revisionDate: "06 October 2026",
  sheetName: supplier?.name || rfq.rfq_number || `RFQ ${rfq.id}`,
  columnWidths: RFQ_COLUMN_WIDTHS,
  layout: RFQ_LAYOUT,
  leftFields: [
    { label: "DATE:", value: toCalendarDate(rfq.issued_at ?? null) },
    { label: "ISSUED BY:", value: personName(rfq.requester) },
    { label: "RFQ NUMBER:", value: rfq.rfq_number || rfq.id },
  ],
  rightFields: [],
  shipTo: NAAVN_SHIP_TO,
  attention: { label: "ATTN", value: supplier?.name ?? "" },
  tables: [
    {
      columns: [
        { header: "ITEM No.", span: [0, 0], align: "center" },
        { header: "PART NUMBER", span: [1, 1] },
        { header: "ALTERNATE PART NUMBER", span: [2, 2] },
        { header: "DESCRIPTION", span: [3, 3] },
        { header: "CONDITION", span: [4, 4], align: "center" },
        { header: "QUANTITY", span: [5, 5], format: "integer" },
      ],
      rows: (rfq.stock_movement?.stocks ?? []).map((line, index) => [
        index + 1,
        line.inventory?.part_number || "",
        "",
        line.inventory?.description || line.inventory?.part_name || "",
        "",
        line.quantity_approved || line.quantity_requested,
      ]),
      emptyText: "No parts on this RFQ",
    },
  ],
  approval: false,
});

const statusText = (status?: string | null) => (status ? status.replace(/_/g, " ").toUpperCase() : "");

/** An inventory requisition on the NAAVN form, from the saved figures (not unsaved edits). */
export const buildRequisitionDocument = (requisition: InventoryRequisitionDetail): NaavnDocument => {
  const unit = requisition.requesting_unit;

  return {
    title: "INVENTORY REQUISITION",
    docRef: null,
    revisionNo: null,
    revisionDate: null,
    sheetName: `Requisition ${requisition.id}`,
    columnWidths: REQUISITION_COLUMN_WIDTHS,
    layout: REQUISITION_LAYOUT,
    leftFields: [
      { label: "DATE:", value: toCalendarDate(requisition.created_at) },
      { label: "REQUESTED BY:", value: personName(requisition.requested_by) },
      { label: "REQUESTING UNIT:", value: unit?.name?.toUpperCase() ?? (requisition.requesting_unit_id ? `UNIT #${requisition.requesting_unit_id}` : "") },
    ],
    rightFields: [
      { label: "REQUISITION NO.:", value: requisition.id, bold: true },
      { label: "STATUS:", value: statusText(requisition.status) },
      { label: "APPROVED BY:", value: personName(requisition.approved_by) },
      { label: "DATE APPROVED:", value: toCalendarDate(requisition.approved_at ?? null) },
    ],
    addressLabel: "DELIVER TO",
    shipTo: [unit?.name, unit?.description].filter((line): line is string => Boolean(line?.trim())),
    tables: [
      {
        columns: [
          { header: "ITEM", span: [0, 0], align: "center" },
          { header: "PART NUMBER", span: [1, 1] },
          { header: "DESCRIPTION", span: [2, 2] },
          { header: "UNIT", span: [3, 3], align: "center" },
          { header: "QTY REQUESTED", span: [4, 4], format: "integer" },
          { header: "QTY APPROVED", span: [5, 5], format: "integer" },
          { header: "QTY IN STOCK", span: [6, 6], format: "integer" },
        ],
        rows: (requisition.items ?? []).map((line, index) => [
          index + 1,
          line.inventory?.part_number || "",
          line.inventory?.description || line.inventory?.part_name || `Inventory #${line.inventory_id}`,
          line.inventory?.measurement_unit || "",
          toNumber(line.requested_quantity ?? null) ?? 0,
          toNumber(line.approved_quantity ?? null),
          toNumber(line.available_quantity ?? line.inventory?.current_stock ?? null),
        ]),
        emptyText: "No items on this requisition",
      },
    ],
    approval: true,
    footnote: requisition.remark?.trim() ? `REMARKS: ${requisition.remark.trim()}` : null,
  };
};
