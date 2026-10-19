import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { BackButton, CancelButton } from "@/shared/ui/button";
import {
  useCreateInventoryMutation,
  useGetExpenseCategoriesQuery,
  useGetInventoryByIdQuery,
  useUpdateInventoryMutation,
  type InventoryItem,
} from "@/features/inventory/api";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import { useGetAssetTypesQuery } from "@/features/assets/api";
import { formatCategoryName } from "@/features/inventory/inventoryUtils";

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 1, name: "Aircraft spares", description: null },
  { id: 2, name: "Consumables", description: null },
  { id: 3, name: "Ground support", description: null },
  { id: 4, name: "General(Qm Stores)", description: null },
];

type FormMode = "create" | "edit";

type StockType =
  | "bonded"
  | "quarantine"
  | "flammable"
  | "rubber"
  | "others";

type InventoryFormValues = {
  store: StockType;
  asset_id: number | "";
  expense_category_id: number | "";
  unit_id: number | "";
  description: string;
  serial_number: string;
  part_number: string;
  nsn: string;
  ata_chapter: string;
  current_stock: string;
  re_order_level: string;
  unit_cost: string;
  measurement_unit: string;
  expiry_date: string;
  date_received: string;
  remark: string;
};

const emptyFormValues: InventoryFormValues = {
  store: "others",
  asset_id: "",
  expense_category_id: "",
  unit_id: "",
  description: "",
  serial_number: "",
  part_number: "",
  nsn: "",
  ata_chapter: "",
  current_stock: "",
  re_order_level: "",
  unit_cost: "",
  measurement_unit: "",
  expiry_date: "",
  date_received: "",
  remark: "",
};

const mapItemToFormValues = (item: InventoryItem): InventoryFormValues => ({
  store:
    item.store === "bonded" ||
    item.store === "quarantine" ||
    item.store === "flammable" ||
    item.store === "rubber" ||
    item.store === "others"
      ? item.store
      : "others",
  asset_id: item.asset_id ?? "",
  expense_category_id: item.expense_category_id,
  unit_id: item.unit_id,
  description: item.description ?? "",
  serial_number: item.serial_number ?? "",
  part_number: item.part_number,
  nsn: item.nsn ?? item.nsn_number ?? "",
  ata_chapter: item.ata_chapter ?? "",
  current_stock: String(item.current_stock ?? ""),
  re_order_level: String(item.re_order_level ?? ""),
  unit_cost: String(item.unit_cost ?? ""),
  measurement_unit: item.measurement_unit ?? "",
  expiry_date: item.expiry_date ?? "",
  date_received: item.date_received ?? "",
  remark: item.remark ?? "",
});

type InventoryFormContentProps = {
  mode: FormMode;
  inventory: InventoryItem | null;
  units: Unit[] | undefined;
  categories:
    | Array<{ id: number; name: string; description: string | null }>
    | undefined;
  isUnitsLoading: boolean;
  isCategoriesLoading: boolean;
  onBack: () => void;
  createInventory: ReturnType<typeof useCreateInventoryMutation>[0];
  updateInventory: ReturnType<typeof useUpdateInventoryMutation>[0];
  id: string | undefined;
  isSubmitting: boolean;
};

const inputClasses =
  "w-full rounded-md px-3 py-2 text-xs sm:text-sm outline-none transition-colors " +
  "bg-white dark:bg-[#001825] text-slate-900 dark:text-white " +
  "border border-slate-300 dark:border-[#0A4D66]/40 " +
  "placeholder:text-slate-400 dark:placeholder:text-gray-500 " +
  "focus:border-[#0369A1] dark:focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#0369A1]/20 dark:focus:ring-[#7FD5FF]/30";

const selectClasses =
  "w-full rounded-md px-3 py-2 text-xs sm:text-sm outline-none appearance-none transition-colors " +
  "bg-white dark:bg-[#001825] text-slate-900 dark:text-white " +
  "border border-slate-300 dark:border-[#0A4D66]/40 " +
  "focus:border-[#0369A1] dark:focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#0369A1]/20 dark:focus:ring-[#7FD5FF]/30";

const labelClasses = "block text-[11px] uppercase font-medium text-slate-600 dark:text-gray-400 mb-1";

const InventoryFormContent = ({
  mode,
  inventory,
  units,
  categories,
  isUnitsLoading,
  isCategoriesLoading,
  onBack,
  createInventory,
  updateInventory,
  id,
  isSubmitting,
}: InventoryFormContentProps) => {
  const initialValues =
    mode === "edit" && inventory
      ? mapItemToFormValues(inventory)
      : emptyFormValues;

  const [values, setValues] = useState<InventoryFormValues>(initialValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof InventoryFormValues, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pageTitle = mode === "create" ? "Add Stock" : "Edit Stock";
  const primaryButtonLabel = mode === "create" ? "Save" : "Save Changes";

  const { data: assetTypes = [], isLoading: isAssetTypesLoading } =
    useGetAssetTypesQuery();

  const handleChange =
    (field: keyof InventoryFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const isFormDirty = useMemo(() => {
    if (mode === "create") {
      return Boolean(
        values.part_number.trim() ||
        values.serial_number.trim() ||
        values.nsn.trim() ||
        values.ata_chapter.trim() ||
        values.description.trim() ||
        values.asset_id !== "" ||
        values.expense_category_id !== "" ||
        values.unit_id !== "" ||
        values.current_stock.trim() ||
        values.re_order_level.trim() ||
        values.unit_cost.trim() ||
        values.measurement_unit.trim() ||
        values.expiry_date.trim() ||
        values.date_received.trim() ||
        values.remark.trim() ||
        values.store !== "others"
      );
    }
    if (!inventory) return false;
    const initial = mapItemToFormValues(inventory);
    return (
      values.store !== initial.store ||
      values.asset_id !== initial.asset_id ||
      values.expense_category_id !== initial.expense_category_id ||
      values.unit_id !== initial.unit_id ||
      values.part_number.trim() !== initial.part_number.trim() ||
      values.serial_number.trim() !== initial.serial_number.trim() ||
      values.nsn.trim() !== initial.nsn.trim() ||
      values.ata_chapter.trim() !== initial.ata_chapter.trim() ||
      values.description.trim() !== initial.description.trim() ||
      values.current_stock.trim() !== initial.current_stock.trim() ||
      values.re_order_level.trim() !== initial.re_order_level.trim() ||
      values.unit_cost.trim() !== initial.unit_cost.trim() ||
      values.measurement_unit.trim() !== initial.measurement_unit.trim() ||
      values.expiry_date.trim() !== initial.expiry_date.trim() ||
      values.date_received.trim() !== initial.date_received.trim() ||
      values.remark.trim() !== initial.remark.trim()
    );
  }, [mode, values, inventory]);

  const parsedPayload = useMemo(() => {
    const currentStockNumeric =
      values.current_stock.trim().length > 0
        ? Number(values.current_stock)
        : undefined;
    const unitCostNumeric =
      values.unit_cost.trim().length > 0 ? Number(values.unit_cost) : undefined;
    const reOrderNumeric =
      values.re_order_level.trim().length > 0
        ? Number(values.re_order_level)
        : undefined;

    return {
      currentStockNumeric,
      reOrderNumeric,
      unitCostNumeric,
    };
  }, [
    values.current_stock,
    values.re_order_level,
    values.unit_cost,
  ]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof InventoryFormValues, string>> = {};

    if (
      values.re_order_level.trim() &&
      (Number.isNaN(parsedPayload.reOrderNumeric) ||
        parsedPayload.reOrderNumeric === undefined)
    ) {
      newErrors.re_order_level = "Must be a number";
    }

    if (
      values.current_stock.trim() &&
      (Number.isNaN(parsedPayload.currentStockNumeric) ||
        parsedPayload.currentStockNumeric === undefined)
    ) {
      newErrors.current_stock = "Must be a number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitInternal = async (exitAfter: boolean) => {
    setSubmitError(null);
    if (!validate()) return;

    const {
      currentStockNumeric,
      reOrderNumeric,
      unitCostNumeric,
    } = parsedPayload;

    const computedAssetId =
      values.asset_id === ""
        ? null
        : typeof values.asset_id === "number"
          ? values.asset_id
          : Number(values.asset_id);

    const basePayload = {
      store: values.store,
      asset_id: computedAssetId,
      expense_category_id:
        values.expense_category_id === ""
          ? null
          : typeof values.expense_category_id === "number"
            ? values.expense_category_id
            : Number(values.expense_category_id),
      unit_id:
        values.unit_id === ""
          ? null
          : typeof values.unit_id === "number"
            ? values.unit_id
            : Number(values.unit_id),
      serial_number: values.serial_number.trim(),
      part_number: values.part_number.trim(),
      nsn: values.nsn.trim() || null,
      ata_chapter: values.ata_chapter.trim() || null,
      current_stock: currentStockNumeric ?? 0,
      re_order_level: reOrderNumeric ?? 0,
      measurement_unit: inventory?.measurement_unit ?? "",
      unit_cost: unitCostNumeric ?? 0,
      expiry_date: values.expiry_date.trim() || null,
      date_received: values.date_received.trim() || null,
      remark: values.remark.trim(),
      description: values.description.trim(),
    };

    try {
      if (mode === "create") {
        await createInventory(basePayload).unwrap();
      } else if (id) {
        await updateInventory({ id, body: basePayload }).unwrap();
      }

      if (exitAfter) {
        onBack();
      } else if (mode === "create") {
        setValues(emptyFormValues);
      }
    } catch {
      setSubmitError("Failed to save inventory. Please try again.");
    }
  };

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/inventory" isDirty={isFormDirty} />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            {pageTitle}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => handleSubmitInternal(true)}
          disabled={isSubmitting}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 shadow-sm transition-colors",
            isSubmitting && "opacity-70 cursor-not-allowed",
          )}
        >
          <Icon icon="mdi:close-circle-outline" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          <span>Save &amp; Exit</span>
        </button>
      </div>

      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001219]">
          <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-slate-800 dark:text-white uppercase">
            {mode === "create" ? "Inventory Details" : `Edit Item #${id ?? ""}`}
          </h2>

          <span className="text-[11px] text-slate-500 dark:text-gray-400">
            * Indicates standard field
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Stock Type Selector */}
          <div className="space-y-2">
            <div className="text-[11px] uppercase font-medium text-slate-600 dark:text-gray-400">
              Select Stock Type
            </div>
            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-700 dark:text-gray-200">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={values.store === "bonded"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      store: "bonded",
                    }))
                  }
                />
                <span>Bonded</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={values.store === "quarantine"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      store: "quarantine",
                    }))
                  }
                />
                <span>Quarantine</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={values.store === "flammable"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      store: "flammable",
                    }))
                  }
                />
                <span>Flammable</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={values.store === "rubber"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      store: "rubber",
                    }))
                  }
                />
                <span>Rubber</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={values.store === "others"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      store: "others",
                    }))
                  }
                />
                <span>Others</span>
              </label>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Part No. */}
            <div className="space-y-1">
              <label className={labelClasses}>Part No.</label>
              <input
                type="text"
                value={values.part_number}
                onChange={handleChange("part_number")}
                className={inputClasses}
                placeholder="Enter Part No."
              />
              {errors.part_number && (
                <p className="text-[11px] text-red-500 font-medium">{errors.part_number}</p>
              )}
            </div>

            {/* Serial No. */}
            <div className="space-y-1">
              <label className={labelClasses}>Serial No.</label>
              <input
                type="text"
                value={values.serial_number}
                onChange={handleChange("serial_number")}
                className={inputClasses}
                placeholder="Enter Serial No."
              />
              {errors.serial_number && (
                <p className="text-[11px] text-red-500 font-medium">
                  {errors.serial_number}
                </p>
              )}
            </div>

            {/* NSN (NATO Stock Number) */}
            <div className="space-y-1">
              <label className={labelClasses}>
                NSN (NATO Stock Number) <span className="text-[10px] lowercase text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={values.nsn}
                onChange={handleChange("nsn")}
                className={inputClasses}
                placeholder="e.g., 2840-01-123-4567"
              />
            </div>

            {/* ATA Chapter */}
            <div className="space-y-1">
              <label className={labelClasses}>
                ATA Chapter <span className="text-[10px] lowercase text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={values.ata_chapter}
                onChange={handleChange("ata_chapter")}
                className={inputClasses}
                placeholder="e.g., 71 - Power Plant"
              />
            </div>

            {/* Aircraft */}
            <div className="space-y-1">
              <label className={labelClasses}>Aircraft</label>
              <div className="relative">
                <select
                  value={values.asset_id}
                  onChange={handleChange("asset_id")}
                  title="Aircraft"
                  className={cn(
                    selectClasses,
                    isAssetTypesLoading && "opacity-70 cursor-not-allowed",
                  )}
                  disabled={isAssetTypesLoading}
                >
                  <option value="">
                    {isAssetTypesLoading ? "Loading..." : "Select Aircraft"}
                  </option>
                  {assetTypes.map((assetType) => (
                    <option key={assetType.id} value={assetType.id}>
                      {assetType.name}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
              {errors.asset_id && (
                <p className="text-[11px] text-red-500 font-medium">{errors.asset_id}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className={labelClasses}>Category</label>
              <div className="relative">
                <select
                  value={values.expense_category_id ?? ""}
                  onChange={handleChange("expense_category_id")}
                  title="Category"
                  className={cn(
                    selectClasses,
                    isCategoriesLoading && "opacity-70 cursor-not-allowed",
                  )}
                  disabled={isCategoriesLoading}
                >
                  <option value="">
                    {isCategoriesLoading ? "Loading..." : "Select Category"}
                  </option>
                  {(categories && categories.length > 0
                    ? categories
                    : DEFAULT_EXPENSE_CATEGORIES
                  ).map((category) => (
                    <option key={category.id} value={category.id}>
                      {formatCategoryName(category.name)}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
              {errors.expense_category_id && (
                <p className="text-[11px] text-red-500 font-medium">
                  {errors.expense_category_id}
                </p>
              )}
            </div>

            {/* Unit */}
            <div className="space-y-1">
              <label className={labelClasses}>Unit</label>
              <div className="relative">
                <select
                  value={values.unit_id}
                  onChange={handleChange("unit_id")}
                  title="Unit"
                  className={cn(
                    selectClasses,
                    isUnitsLoading && "opacity-70 cursor-not-allowed",
                  )}
                  disabled={isUnitsLoading}
                >
                  <option value="">
                    {isUnitsLoading ? "Loading units..." : "Select Unit"}
                  </option>
                  {units?.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
              {errors.unit_id && (
                <p className="text-[11px] text-red-500 font-medium">{errors.unit_id}</p>
              )}
            </div>

            {/* Current Stock */}
            <div className="space-y-1">
              <label className={labelClasses}>Current Stock</label>
              <input
                type="number"
                value={values.current_stock}
                onChange={handleChange("current_stock")}
                className={inputClasses}
                placeholder="Enter Current Stock"
              />
              {errors.current_stock && (
                <p className="text-[11px] text-red-500 font-medium">
                  {errors.current_stock}
                </p>
              )}
            </div>

            {/* Re-Order Level */}
            <div className="space-y-1">
              <label className={labelClasses}>Re-Order Level</label>
              <input
                type="number"
                value={values.re_order_level}
                onChange={handleChange("re_order_level")}
                className={inputClasses}
                placeholder="Enter Re-Order Level"
              />
              {errors.re_order_level && (
                <p className="text-[11px] text-red-500 font-medium">
                  {errors.re_order_level}
                </p>
              )}
            </div>

            {/* Date Received */}
            <div className="space-y-1">
              <label className={labelClasses}>Date Received</label>
              <input
                type="date"
                value={values.date_received}
                onChange={handleChange("date_received")}
                title="Date Received"
                placeholder="Select date received"
                className={inputClasses}
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-1">
              <label className={labelClasses}>Expiry Date</label>
              <input
                type="date"
                value={values.expiry_date}
                onChange={handleChange("expiry_date")}
                title="Expiry Date"
                placeholder="Select expiry date"
                className={inputClasses}
              />
            </div>

            {/* Remark */}
            <div className="space-y-1">
              <label className={labelClasses}>
                Remark <span className="text-[10px] lowercase text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={values.remark}
                onChange={handleChange("remark")}
                className={inputClasses}
                placeholder="Enter Remark"
              />
            </div>

            {/* Item Description (spanning full width or 2/3 cols) */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <label className={labelClasses}>Item Description</label>
              <input
                type="text"
                value={values.description}
                onChange={handleChange("description")}
                className={inputClasses}
                placeholder="Enter Item Description"
              />
              {errors.description && (
                <p className="text-[11px] text-red-500 font-medium">{errors.description}</p>
              )}
            </div>
          </div>

          {submitError && (
            <p className="text-xs text-red-500 font-medium">{submitError}</p>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-[#0A4D66]/40 pt-4">
            <CancelButton
              fallbackUrl="/dashboard/inventory"
              isDirty={isFormDirty}
              label="Cancel"
              size="md"
            />
            <button
              type="button"
              onClick={() => handleSubmitInternal(true)}
              className={cn(
                "inline-flex items-center justify-center px-6 py-2 rounded bg-[#0369A1] text-white text-xs sm:text-sm font-semibold hover:bg-[#0369A1]/90 transition-colors shadow-sm",
                isSubmitting && "opacity-70 cursor-not-allowed",
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : primaryButtonLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export const InventoryFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const isNewOrAdd = !id || id === "new" || id === "add" || id === "create";
  const mode: FormMode = isNewOrAdd ? "create" : "edit";
  const effectiveId = isNewOrAdd ? undefined : id;

  const {
    data: inventory,
    isLoading: isInventoryLoading,
    isError: isInventoryError,
  } = useGetInventoryByIdQuery(effectiveId ?? "", {
    skip: !effectiveId,
  });

  const { data: units, isLoading: isUnitsLoading } = useGetUnitsQuery();
  const { data: categories, isLoading: isCategoriesLoading } =
    useGetExpenseCategoriesQuery();

  const [createInventory, { isLoading: isCreating }] =
    useCreateInventoryMutation();
  const [updateInventory, { isLoading: isUpdating }] =
    useUpdateInventoryMutation();

  const handleBack = () => {
    navigate("/dashboard/inventory");
  };

  if (mode === "edit" && !isInventoryLoading && isInventoryError) {
    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            Edit Stock
          </h1>
        </div>
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden p-6 text-center text-slate-500 dark:text-gray-400 shadow-sm">
          Failed to load inventory item.
        </section>
      </div>
    );
  }

  if (mode === "edit" && isInventoryLoading) {
    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            Edit Stock
          </h1>
        </div>
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden p-6 text-center text-slate-500 dark:text-gray-400 shadow-sm">
          Loading inventory...
        </section>
      </div>
    );
  }

  const isSubmitting = isCreating || isUpdating;

  return (
    <InventoryFormContent
      key={mode === "edit" ? (id ?? "edit") : "create"}
      mode={mode}
      inventory={inventory ?? null}
      units={units}
      categories={categories}
      isUnitsLoading={isUnitsLoading}
      isCategoriesLoading={isCategoriesLoading}
      onBack={handleBack}
      createInventory={createInventory}
      updateInventory={updateInventory}
      id={id}
      isSubmitting={isSubmitting}
    />
  );
};
