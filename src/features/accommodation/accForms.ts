import type { AccField, AccOption, AccValues } from "./components/AccFormModal";
import { RESIDENCE_STATUS_LABEL, today } from "./accommodationHelpers";

/** Turns form strings into an API body: "" → null, number fields → numbers. */
export const toPayload = (fields: AccField[], values: AccValues) =>
  Object.fromEntries(
    fields.map((f) => {
      const v = values[f.name];
      if (f.type === "checkbox") return [f.name, Boolean(v)];
      if (v === "" || v === undefined) return [f.name, null];
      return [f.name, f.type === "number" || f.type === "search-select" ? Number(v) : v];
    }),
  );

/** Form values from a record (dates trimmed to YYYY-MM-DD), falling back to defaults. */
export const valuesFrom = (fields: AccField[], record: object | null, defaults: AccValues = {}): AccValues =>
  Object.fromEntries(
    fields.map((f) => {
      const v = record ? (record as Record<string, unknown>)[f.name] : undefined;
      if (f.type === "checkbox") return [f.name, v === undefined ? Boolean(defaults[f.name]) : Boolean(v)];
      if (v === null || v === undefined) return [f.name, defaults[f.name] ?? ""];
      return [f.name, f.type === "date" ? String(v).slice(0, 10) : String(v)];
    }),
  );

export const categoryFields: AccField[] = [
  { name: "name", label: "Category name", type: "text", required: true, wide: true, placeholder: "e.g. Married Officers' Quarters" },
  { name: "sort_order", label: "Display order", type: "number", min: 0, help: "Lower numbers appear first in the tab bar." },
  { name: "description", label: "Description", type: "textarea" },
];

export const blockFields = (categories: AccOption[]): AccField[] => [
  { name: "accommodation_category_id", label: "Category", type: "select", required: true, options: categories },
  { name: "name", label: "Block name", type: "text", required: true, placeholder: "e.g. SOQ Block D" },
  { name: "location", label: "Location", type: "text", wide: true, placeholder: "e.g. Behind the officers' mess" },
  { name: "description", label: "Description", type: "textarea" },
];

export const residenceFields = (blocks: AccOption[], apartmentTypes: AccOption[]): AccField[] => [
  { name: "accommodation_block_id", label: "Block", type: "search-select", required: true, options: blocks },
  { name: "name", label: "House / flat / room", type: "text", required: true, placeholder: "e.g. Flat 3 or Comd's House" },
  { name: "apartment_type", label: "Type of apartment", type: "select", required: true, options: apartmentTypes },
  { name: "rooms", label: "Rooms (bedrooms)", type: "number", min: 0 },
  { name: "bathrooms", label: "Bathrooms", type: "number", min: 0 },
  { name: "floor", label: "Floor", type: "text", placeholder: "e.g. Ground, 1st" },
  { name: "capacity", label: "Capacity (occupants)", type: "number", required: true, min: 1, help: "1 for a family house; more for a shared room." },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: Object.entries(RESIDENCE_STATUS_LABEL).map(([value, label]) => ({ value, label })),
    help: "Occupied or vacant is worked out from the residents.",
  },
  { name: "is_furnished", label: "Furnished", type: "checkbox" },
  { name: "has_boys_quarters", label: "Has boys' quarters", type: "checkbox" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const allocateFields = (residences: AccOption[], personnel: AccOption[]): AccField[] => [
  { name: "personnel_id", label: "Personnel", type: "search-select", required: true, options: personnel, wide: true },
  { name: "residence_id", label: "Residence", type: "search-select", required: true, options: residences, wide: true, help: "Only residences in use with a free space are listed." },
  { name: "move_in_date", label: "Date of moving in", type: "date", required: true, max: today() },
  { name: "expected_move_out_date", label: "Expected move-out", type: "date" },
  { name: "allocation_reference", label: "Allocation letter / ref.", type: "text" },
  { name: "dependants", label: "Dependants living in", type: "number", min: 0 },
  { name: "notes", label: "Notes", type: "textarea" },
];

/** Editing a stay: who and where are fixed (vacate and re-allocate to move someone). */
export const stayFields = (vacated: boolean): AccField[] => [
  { name: "move_in_date", label: "Date of moving in", type: "date", required: true },
  { name: "expected_move_out_date", label: "Expected move-out", type: "date" },
  ...(vacated ? [{ name: "move_out_date", label: "Date moved out", type: "date" as const, required: true }] : []),
  { name: "allocation_reference", label: "Allocation letter / ref.", type: "text" },
  { name: "dependants", label: "Dependants living in", type: "number", min: 0 },
  { name: "notes", label: "Notes", type: "textarea" },
  ...(vacated ? [{ name: "vacate_remarks", label: "Vacating remarks", type: "textarea" as const }] : []),
];

export const vacateFields: AccField[] = [
  { name: "move_out_date", label: "Date moved out", type: "date", required: true, max: today() },
  { name: "vacate_remarks", label: "Remarks", type: "textarea", placeholder: "e.g. Posted out; keys returned; condition of the residence" },
];
