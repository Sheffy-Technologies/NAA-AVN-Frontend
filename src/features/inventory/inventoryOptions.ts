import type { SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import type { InventoryItem, StockMovement } from "./api";

type InventoryLike = Pick<InventoryItem, "id" | "part_number" | "current_stock"> & {
  description?: string | null;
  measurement_unit?: string | null;
};

export const inventoryLabel = (item: Pick<InventoryLike, "id" | "part_number" | "description">) =>
  [item.part_number, item.description].filter(Boolean).join(" - ") || `Inventory #${item.id}`;

/** Searchable-select options for inventory items, with current stock shown underneath. */
export const toInventoryOptions = (items: InventoryLike[]): SearchableSelectOption[] =>
  items.map((item) => ({
    value: item.id,
    label: inventoryLabel(item),
    description: `In stock: ${item.current_stock ?? 0}${item.measurement_unit ? ` ${item.measurement_unit}` : ""}`,
  }));

/** Summary of the items on a requisition, e.g. "PN-123 - Brake pad ×2, PN-456 ×1". */
export const describeRequisitionItems = (movement?: StockMovement | null) => {
  const lines = movement?.stocks ?? [];
  if (lines.length === 0) return "No items";
  return lines
    .map((line) => {
      const name = line.inventory
        ? inventoryLabel(line.inventory)
        : line.inventory_id
          ? `Inventory #${line.inventory_id}`
          : `Spare #${line.spare_id}`;
      return `${name} ×${line.quantity_requested}`;
    })
    .join(", ");
};

/** Short origin label for a requisition: its work order, or "Direct" when raised without one. */
export const requisitionOrigin = (movement: Pick<StockMovement, "work_order_id">) =>
  movement.work_order_id ? `WO #${movement.work_order_id}` : "Direct";
