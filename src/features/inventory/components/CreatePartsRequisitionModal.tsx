import { useMemo, useState } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { Icon } from "@/shared/icons/Icon";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetWorkOrdersQuery } from "@/features/maintenance/api";
import { useCreateStockMovementMutation, useGetInventoriesQuery } from "../api";
import { toInventoryOptions } from "../inventoryOptions";

type Line = { key: number; inventory_id: number | null; quantity: string };

const inputCls =
  "w-full rounded border border-[var(--theme-border-em)] bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none";
const labelCls = "text-xs text-[var(--theme-text-muted)]";

let lineKey = 0;
const newLine = (): Line => ({ key: ++lineKey, inventory_id: null, quantity: "1" });

type CreatePartsRequisitionModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

/**
 * Raises a parts requisition (an "issue" stock movement) directly, without
 * needing to start from a work order. Linking a work order is optional.
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
  const { data: workOrders = [] } = useGetWorkOrdersQuery(undefined, { skip: !open });
  const { data: units = [] } = useGetUnitsQuery(undefined, { skip: !open });
  const [createStockMovement, { isLoading: isSaving }] = useCreateStockMovementMutation();

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

    const stocks: Array<{ inventory_id: number; quantity_requested: number; quantity_approved: number }> = [];
    for (const [index, line] of lines.entries()) {
      const quantity = Number(line.quantity);
      if (!line.inventory_id) {
        setError(`Select an inventory item on line ${index + 1}.`);
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError(`Enter a valid quantity on line ${index + 1}.`);
        return;
      }
      stocks.push({ inventory_id: line.inventory_id, quantity_requested: quantity, quantity_approved: 0 });
    }

    const inventoryIds = stocks.map((stock) => stock.inventory_id);
    if (new Set(inventoryIds).size !== inventoryIds.length) {
      setError("The same item is listed more than once. Combine the quantities on one line.");
      return;
    }

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
          Request parts directly. Linking a work order is optional.
        </p>

        {error && (
          <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <div className={labelCls}>Items *</div>
          {lines.map((line) => (
            <div key={line.key} className="flex items-start gap-2">
              <SearchableSelect
                className="flex-1 min-w-0"
                buttonClassName="py-2"
                placeholder={isInventoriesLoading ? "Loading inventory..." : "Select inventory item"}
                searchPlaceholder="Search by part number or description..."
                options={inventoryOptions}
                value={line.inventory_id}
                onChange={(value) =>
                  updateLine(line.key, { inventory_id: value === null ? null : Number(value) })
                }
                disabled={isInventoriesLoading}
              />
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
            {isSaving ? "Creating..." : "Create Requisition"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
