import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import type { InventoryExpenseCategory } from "../api";
import type { NewInventoryDraft } from "../newInventoryItem";
import { formatCategoryName } from "../inventoryUtils";

type Props = {
  draft: NewInventoryDraft;
  onChange: (next: NewInventoryDraft) => void;
  expenseCategories: InventoryExpenseCategory[];
  inputClassName?: string;
};

export const STORAGE_ENVIRONMENT_OPTIONS = [
  { value: "standard", label: "Standard Warehouse Storage" },
  { value: "bonded", label: "Bonded Store (Customs Controlled)" },
  { value: "quarantine", label: "Quarantine / Inspection Hold" },
  { value: "flammable", label: "Flammable Liquid / Combustible Locker" },
  { value: "cold_storage", label: "Cold Storage / Refrigerated" },
  { value: "esd_sensitive", label: "ESD Sensitive (Electrostatic Discharge)" },
  { value: "hazmat", label: "Hazardous Materials (HAZMAT)" },
  { value: "rubber", label: "Rubber Controlled Environment" },
  { value: "high_security", label: "High Security / Armory Vault" },
  { value: "others", label: "Other Specialized Storage" },
];

export const NewInventoryItemFields = ({
  draft,
  onChange,
  expenseCategories,
}: Props) => {
  const { isDark } = useTheme();
  const set = <K extends keyof NewInventoryDraft>(key: K, value: NewInventoryDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const inputClass = cn(
    "w-full rounded-xl px-3.5 py-2.5 text-xs transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
    isDark
      ? "border-[#0A4D66]/60 bg-[#001825] text-white placeholder:text-slate-500"
      : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs",
  );

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 space-y-4 transition-colors",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-[#0A4D66]/40 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
            <Icon icon="mdi:cog-outline" className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              Common Part Information
              <span className="text-[10px] font-semibold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                Shared Specifications
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Entered once and inherited into the master inventory record upon receipt.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
        {/* Part Name / Description */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Part Name / Description <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            placeholder="e.g. HYDRAULIC ACTUATOR CYLINDER ASSY"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        {/* Part Number */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Part Number (P/N) <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            placeholder="e.g. HP-60750"
            value={draft.part_number}
            onChange={(e) => set("part_number", e.target.value)}
          />
        </div>

        {/* Alternate Part Number */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Alternate Part Number (Alt P/N)
          </label>
          <input
            className={inputClass}
            placeholder="e.g. ALT-109-88 / 10-60750-2"
            value={draft.alternate_support_part_no}
            onChange={(e) => set("alternate_support_part_no", e.target.value)}
          />
        </div>

        {/* Manufacturer */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Manufacturer (MFR)
          </label>
          <input
            className={inputClass}
            placeholder="e.g. Leonardo, Honeywell, Safran, Bell"
            value={draft.manufacturer}
            onChange={(e) => set("manufacturer", e.target.value)}
          />
        </div>

        {/* ATA Chapter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            ATA Chapter
          </label>
          <input
            className={inputClass}
            placeholder="e.g. ATA 29 - Hydraulic Power"
            value={draft.ata_chapter}
            onChange={(e) => set("ata_chapter", e.target.value)}
          />
        </div>

        {/* NATO Stock Number (NSN) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            NATO Stock Number (NSN) <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="e.g. 2840-01-523-9988"
            value={draft.nsn}
            onChange={(e) => set("nsn", e.target.value)}
          />
        </div>

        {/* CAGE Code */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            CAGE Code <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="e.g. 77272"
            value={draft.cage_code}
            onChange={(e) => set("cage_code", e.target.value)}
          />
        </div>

        {/* Storage Environment */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Storage Environment
          </label>
          <select
            className={inputClass}
            value={draft.special_storage || "standard"}
            onChange={(e) => set("special_storage", e.target.value)}
          >
            {STORAGE_ENVIRONMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Unit Cost */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Unit Cost
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputClass}
            placeholder="0.00"
            value={draft.unit_cost}
            onChange={(e) => set("unit_cost", e.target.value)}
          />
        </div>

        {/* Unit of Measure */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Unit of Measure (UOM)
          </label>
          <input
            className={inputClass}
            placeholder="e.g. EA, ASSY, SET, MTR"
            value={draft.measurement_unit}
            onChange={(e) => set("measurement_unit", e.target.value)}
          />
        </div>

        {/* Re-order Level */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Order Threshold (Re-Order Level)
          </label>
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="1"
            value={draft.re_order_level}
            onChange={(e) => set("re_order_level", e.target.value)}
          />
        </div>

        {/* Expense Category */}
        {expenseCategories.length > 0 && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Expense Category
            </label>
            <select
              className={inputClass}
              value={draft.expense_category_id}
              onChange={(e) => set("expense_category_id", e.target.value)}
            >
              <option value="">Select category (optional)</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {formatCategoryName(category.name)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Serial Number (Optional) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Serial Number <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            className={inputClass}
            placeholder="e.g. SN-882941 (optional)"
            value={draft.serial_number}
            onChange={(e) => set("serial_number", e.target.value)}
          />
        </div>

        {/* Internal Remarks / Traceability Notes */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Internal Remarks / Traceability Notes
          </label>
          <input
            className={inputClass}
            placeholder="e.g. To be received under Certificate of Conformance (CoC), batch inspection remarks, airworthiness tags"
            value={draft.remark}
            onChange={(e) => set("remark", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
