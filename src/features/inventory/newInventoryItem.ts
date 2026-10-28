import type { CreateInventoryPayload } from "./api";

export type InventoryStore = "bonded" | "quarantine" | "flammable" | "rubber" | "others";

export type NewInventoryDraft = {
  part_number: string;
  description: string;
  alternate_support_part_no: string;
  manufacturer: string;
  nsn: string;
  cage_code: string;
  ata_chapter: string;
  ata_chapter_id: string;
  special_storage: string;
  measurement_unit: string;
  unit_cost: string;
  re_order_level: string;
  store: InventoryStore;
  expense_category_id: string;
  asset_id: string;
  serial_number: string;
  remark: string;
};

export type NewInventoryPayload = {
  part_number: string;
  description: string;
  alternate_support_part_no?: string | null;
  manufacturer?: string | null;
  nsn?: string | null;
  cage_code?: string | null;
  ata_chapter?: string | null;
  ata_chapter_id?: number | null;
  special_storage?: string | null;
  measurement_unit?: string | null;
  unit_cost?: number | null;
  re_order_level?: number | null;
  store?: InventoryStore | null;
  expense_category_id?: number | null;
  asset_id?: number | null;
  serial_number?: string | null;
  remark?: string | null;
};

export const emptyNewInventoryDraft = (): NewInventoryDraft => ({
  part_number: "",
  description: "",
  alternate_support_part_no: "",
  manufacturer: "",
  nsn: "",
  cage_code: "",
  ata_chapter: "",
  ata_chapter_id: "",
  special_storage: "standard",
  measurement_unit: "",
  unit_cost: "",
  re_order_level: "",
  store: "others",
  expense_category_id: "",
  asset_id: "",
  serial_number: "",
  remark: "",
});

const optionalText = (value: string) => (value.trim() === "" ? null : value.trim());
const optionalNumber = (value: string) => (value.trim() === "" ? null : Number(value));

/** Returns the request payload, or an error message the user can act on. */
export const toNewInventoryPayload = (
  draft: NewInventoryDraft,
): { payload: NewInventoryPayload } | { error: string } => {
  if (!draft.part_number.trim()) return { error: "New item needs a part number." };
  if (!draft.description.trim()) return { error: "New item needs a description." };

  const unitCost = optionalNumber(draft.unit_cost);
  if (unitCost !== null && (Number.isNaN(unitCost) || unitCost < 0)) {
    return { error: "New item unit cost must be zero or more." };
  }

  const reOrder = optionalNumber(draft.re_order_level);
  if (reOrder !== null && (!Number.isInteger(reOrder) || reOrder < 0)) {
    return { error: "New item re-order level must be a whole number." };
  }

  const categoryId = optionalNumber(draft.expense_category_id);
  const ataChapterId = optionalNumber(draft.ata_chapter_id);
  const assetId = optionalNumber(draft.asset_id);

  return {
    payload: {
      part_number: draft.part_number.trim(),
      description: draft.description.trim(),
      alternate_support_part_no: optionalText(draft.alternate_support_part_no),
      manufacturer: optionalText(draft.manufacturer),
      nsn: optionalText(draft.nsn),
      cage_code: optionalText(draft.cage_code),
      ata_chapter: optionalText(draft.ata_chapter),
      ata_chapter_id: ataChapterId,
      special_storage: optionalText(draft.special_storage),
      measurement_unit: optionalText(draft.measurement_unit),
      unit_cost: unitCost,
      re_order_level: reOrder,
      store: draft.store,
      expense_category_id: categoryId,
      asset_id: assetId,
      serial_number: optionalText(draft.serial_number),
      remark: optionalText(draft.remark),
    },
  };
};

// Requisitions draw on the central store's stock (unit_id 1).
const CENTRAL_STORE_UNIT_ID = 1;

/** Body for creating a new zero-stock item in the central store, e.g. from a requisition. */
export const toCreateInventoryPayload = (payload: NewInventoryPayload): CreateInventoryPayload => ({
  store: payload.store ?? "others",
  asset_id: payload.asset_id ?? null,
  expense_category_id: payload.expense_category_id ?? null,
  unit_id: CENTRAL_STORE_UNIT_ID,
  serial_number: payload.serial_number ?? "",
  part_number: payload.part_number,
  alternate_support_part_no: payload.alternate_support_part_no ?? "",
  manufacturer: payload.manufacturer ?? "",
  nsn: payload.nsn ?? "",
  cage_code: payload.cage_code ?? "",
  ata_chapter: payload.ata_chapter ?? "",
  ata_chapter_id: payload.ata_chapter_id ? Number(payload.ata_chapter_id) : null,
  special_storage: payload.special_storage ?? "standard",
  current_stock: 0,
  re_order_level: payload.re_order_level ?? 0,
  unit_cost: payload.unit_cost ?? 0,
  measurement_unit: payload.measurement_unit ?? "",
  expiry_date: null,
  date_received: null,
  remark: payload.remark ?? "",
  description: payload.description,
});
