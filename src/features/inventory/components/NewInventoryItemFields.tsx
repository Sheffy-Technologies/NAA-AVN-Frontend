import type { InventoryExpenseCategory } from "../api";
import type { NewInventoryDraft } from "../newInventoryItem";

type Props = {
  draft: NewInventoryDraft;
  onChange: (next: NewInventoryDraft) => void;
  expenseCategories: InventoryExpenseCategory[];
  inputClassName?: string;
};

const defaultInputClass =
  "rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white";

export const NewInventoryItemFields = ({
  draft,
  onChange,
  expenseCategories,
  inputClassName = defaultInputClass,
}: Props) => {
  const set = <K extends keyof NewInventoryDraft>(key: K, value: NewInventoryDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="rounded-lg border border-[#0A4D66]/40 bg-[#001825] p-3">
      <p className="mb-2 text-xs text-[#7FD5FF]">
        This item will be added to inventory with zero stock. Stock is recorded when the goods are received.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          className={inputClassName}
          placeholder="Part number *"
          aria-label="New item part number"
          value={draft.part_number}
          onChange={(e) => set("part_number", e.target.value)}
        />
        <input
          className={`${inputClassName} sm:col-span-2`}
          placeholder="Description *"
          aria-label="New item description"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <input
          className={inputClassName}
          placeholder="Unit of measure (e.g. pcs)"
          aria-label="New item unit of measure"
          value={draft.measurement_unit}
          onChange={(e) => set("measurement_unit", e.target.value)}
        />
        <input
          type="number"
          min={0}
          step="0.01"
          className={inputClassName}
          placeholder="Unit cost"
          aria-label="New item unit cost"
          value={draft.unit_cost}
          onChange={(e) => set("unit_cost", e.target.value)}
        />
        <input
          type="number"
          min={0}
          className={inputClassName}
          placeholder="Re-order level"
          aria-label="New item re-order level"
          value={draft.re_order_level}
          onChange={(e) => set("re_order_level", e.target.value)}
        />
        <select
          className={inputClassName}
          aria-label="New item store"
          value={draft.store}
          onChange={(e) => set("store", e.target.value as NewInventoryDraft["store"])}
        >
          <option value="bonded">Bonded</option>
          <option value="quarantine">Quarantine</option>
          <option value="flammable">Flammable</option>
          <option value="rubber">Rubber</option>
          <option value="others">Others</option>
        </select>
        <select
          className={inputClassName}
          aria-label="New item expense category"
          value={draft.expense_category_id}
          onChange={(e) => set("expense_category_id", e.target.value)}
        >
          <option value="">Expense category (optional)</option>
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          className={inputClassName}
          placeholder="Serial number (optional)"
          aria-label="New item serial number"
          value={draft.serial_number}
          onChange={(e) => set("serial_number", e.target.value)}
        />
        <input
          className={`${inputClassName} sm:col-span-2`}
          placeholder="Remark (optional)"
          aria-label="New item remark"
          value={draft.remark}
          onChange={(e) => set("remark", e.target.value)}
        />
      </div>
    </div>
  );
};
