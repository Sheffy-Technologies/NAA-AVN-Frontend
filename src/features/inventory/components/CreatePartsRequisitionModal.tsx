import { useMemo, useState } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { Icon } from "@/shared/icons/Icon";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetWorkOrdersQuery } from "@/features/maintenance/api";
import {
  useCreateInventoryMutation,
  useCreateStockMovementMutation,
  useGetExpenseCategoriesQuery,
  useGetInventoriesQuery,
} from "../api";
import { toInventoryOptions } from "../inventoryOptions";
import {
  emptyNewInventoryDraft,
  toCreateInventoryPayload,
  toNewInventoryPayload,
  type NewInventoryDraft,
  type NewInventoryPayload,
} from "../newInventoryItem";
import { NewInventoryItemFields } from "./NewInventoryItemFields";

// A line either picks an existing item, or describes a new one (`newItem`) that
// is added to inventory when the requisition is submitted.
type Line = {
  key: number;
  inventory_id: number | null;
  quantity: string;
  newItem: NewInventoryDraft | null;
};

const inputCls =
  "w-full rounded border border-[var(--theme-border-em)] bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none";
const labelCls = "text-xs text-[var(--theme-text-muted)]";

let lineKey = 0;
const newLine = (): Line => ({
  key: ++lineKey,
  inventory_id: null,
  quantity: "1",
  newItem: null,
});

type CreatePartsRequisitionModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

/**
 * Raises a parts requisition (an "issue" stock movement) directly, without
 * needing to start from a work order. Linking a work order is optional, and
 * parts not yet in inventory can be added from here.
 */
export const CreatePartsRequisitionModal = ({
  open,
  onClose,
  onCreated,
}: CreatePartsRequisitionModalProps) => {
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [workOrderId, setWorkOrderId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: inventories = [], isLoading: isInventoriesLoading } = useGetInventoriesQuery(
    undefined,
    { skip: !open },
  );
  const { data: expenseCategories = [] } = useGetExpenseCategoriesQuery(undefined, { skip: !open });
  const { data: workOrders = [] } = useGetWorkOrdersQuery(undefined, {
    skip: !open,
  });
  const { data: units = [] } = useGetUnitsQuery(undefined, { skip: !open });
  const [createStockMovement, { isLoading: isCreatingMovement }] = useCreateStockMovementMutation();
  const [createInventory, { isLoading: isCreatingInventory }] = useCreateInventoryMutation();
  const isSaving = isCreatingMovement || isCreatingInventory;

  const inventoryOptions = useMemo(() => toInventoryOptions(inventories), [inventories]);
  const workOrderOptions: SearchableSelectOption[] = useMemo(
    () =>
      workOrders.map((wo) => ({
        value: wo.id,
        label: `WO #${wo.id} - ${wo.title || "Work Order"}`,
        description: wo.asset?.name ?? undefined,
      })),
    [workOrders],
  );
  const unitOptions: SearchableSelectOption[] = useMemo(
    () => units.map((unit) => ({ value: unit.id, label: unit.name })),
    [units],
  );

  const reset = () => {
    setLines([newLine()]);
    setWorkOrderId(null);
    setUnitId(null);
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const newItems = new Map<number, NewInventoryPayload>();
    for (const [index, line] of lines.entries()) {
      const quantity = Number(line.quantity);
      if (line.newItem) {
        const result = toNewInventoryPayload(line.newItem);
        if ("error" in result) {
          setError(`Line ${index + 1}: ${result.error}`);
          return;
        }
        newItems.set(line.key, result.payload);
      } else if (!line.inventory_id) {
        setError(`Select an inventory item on line ${index + 1}, or add a new one.`);
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError(`Enter a valid quantity on line ${index + 1}.`);
        return;
      }
    }

    const inventoryIds = lines.filter((line) => !line.newItem).map((line) => line.inventory_id);
    const partNumbers = [...newItems.values()].map((item) => item.part_number.toLowerCase());
    if (
      new Set(inventoryIds).size !== inventoryIds.length ||
      new Set(partNumbers).size !== partNumbers.length
    ) {
      setError("The same item is listed more than once. Combine the quantities on one line.");
      return;
    }

    // Add new items first. Created lines are switched over to the new item so
    // that a retry after a later failure doesn't create duplicates.
    const resolvedIds = new Map<number, number>();
    for (const [index, line] of lines.entries()) {
      const payload = newItems.get(line.key);
      if (!payload) continue;
      try {
        const created = await createInventory(toCreateInventoryPayload(payload)).unwrap();
        resolvedIds.set(line.key, created.id);
        updateLine(line.key, { inventory_id: created.id, newItem: null });
      } catch (err: unknown) {
        const responseError = err as { data?: { message?: string } };
        setError(
          `Line ${index + 1}: ${responseError?.data?.message || "failed to add the new inventory item."}`,
        );
        return;
      }
    }

    const stocks = lines.map((line) => ({
      inventory_id: resolvedIds.get(line.key) ?? (line.inventory_id as number),
      quantity_requested: Number(line.quantity),
      quantity_approved: 0,
    }));

    try {
      await createStockMovement({
        movement_type: "issue",
        quantity: stocks.reduce((sum, stock) => sum + stock.quantity_requested, 0),
        work_order_id: workOrderId,
        requesting_unit_id: unitId,
        notes: notes.trim() || null,
        stocks,
      }).unwrap();
      onCreated?.();
      handleClose();
    } catch (err: unknown) {
      const responseError = err as { data?: { message?: string } };
      setError(responseError?.data?.message || "Failed to create parts requisition.");
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="New Parts Requisition" className="max-w-2xl!">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-[var(--theme-text-muted)]">
          Request parts directly. Linking a work order is optional. If a part isn't in the list, use
          &ldquo;Not in list?&rdquo; to add it to inventory.
        </p>

        {error && (
          <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <div className={labelCls}>Items *</div>
          {lines.map((line) => (
            <div key={line.key} className="space-y-2">
              <div className="flex items-start gap-2">
                <SearchableSelect
                  className="flex-1 min-w-0"
                  buttonClassName="py-2"
                  placeholder={
                    line.newItem
                      ? "New item (details below)"
                      : isInventoriesLoading
                        ? "Loading inventory..."
                        : "Select inventory item"
                  }
                  searchPlaceholder="Search by part number or description..."
                  options={inventoryOptions}
                  value={line.newItem ? null : line.inventory_id}
                  onChange={(value) =>
                    updateLine(line.key, {
                      inventory_id: value === null ? null : Number(value),
                    })
                  }
                  disabled={isInventoriesLoading || !!line.newItem}
                />
                <button
                  type="button"
                  onClick={() =>
                    updateLine(line.key, {
                      newItem: line.newItem ? null : emptyNewInventoryDraft(),
                      inventory_id: null,
                    })
                  }
                  className="mt-0.5 shrink-0 rounded border border-[var(--theme-border-em)] px-2 py-1.5 text-xs text-[var(--theme-accent)] hover:bg-[var(--theme-bg-panel)]"
                >
                  {line.newItem ? "Pick from list" : "Not in list?"}
                </button>
                <input
                  type="number"
                  min={1}
                  aria-label="Quantity"
                  className={`${inputCls} w-24`}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((item) => item.key !== line.key))}
                  disabled={lines.length === 1}
                  aria-label="Remove item"
                  className="mt-2 text-red-400 hover:text-red-300 disabled:opacity-30"
                >
                  <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
                </button>
              </div>
              {line.newItem && (
                <NewInventoryItemFields
                  draft={line.newItem}
                  onChange={(next) => updateLine(line.key, { newItem: next })}
                  expenseCategories={expenseCategories}
                  inputClassName={inputCls}
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="inline-flex items-center gap-1 text-xs text-[var(--theme-accent)] hover:underline"
          >
            <Icon icon="mdi:plus" className="h-4 w-4" />
            Add another item
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className={labelCls}>Requesting Unit</div>
            <SearchableSelect
              buttonClassName="py-2"
              placeholder="Select unit (optional)"
              searchPlaceholder="Search units..."
              options={unitOptions}
              value={unitId}
              onChange={(value) => setUnitId(value === null ? null : Number(value))}
            />
          </div>
          <div className="space-y-1">
            <div className={labelCls}>Work Order</div>
            <SearchableSelect
              buttonClassName="py-2"
              placeholder="None (direct requisition)"
              searchPlaceholder="Search work orders..."
              options={workOrderOptions}
              value={workOrderId}
              onChange={(value) => setWorkOrderId(value === null ? null : Number(value))}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className={labelCls}>Notes / Justification</div>
          <textarea
            rows={2}
            className={inputCls}
            placeholder="Why are these parts needed?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-[var(--theme-border-em)] px-4 py-2 text-sm text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1]/90 disabled:opacity-60"
          >
            {isCreatingInventory
              ? "Adding items..."
              : isSaving
                ? "Creating..."
                : "Create Requisition"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
