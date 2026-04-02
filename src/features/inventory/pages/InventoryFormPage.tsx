import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useCreateInventoryMutation,
  useGetExpenseCategoriesQuery,
  useGetInventoryByIdQuery,
  useGetSuppliersQuery,
  useUpdateInventoryMutation,
  type InventoryItem,
} from "@/features/inventory/api";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import { useGetAssetTypesQuery } from "@/features/assets/api";

type FormMode = "create" | "edit";

type StockType =
  | "aircraft_spares"
  | "consumables"
  | "ground_support"
  | "general"
  | "others";

type InventoryFormValues = {
  type: StockType;
  asset_id: number | "";
  expense_category_id: number | "";
  unit_id: number | "";
  description: string;
  serial_number: string;
  part_number: string;
  current_stock: string;
  re_order_level: string;
  unit_cost: string;
  measurement_unit: string;
  supplier_id: number | "";
  expiry_date: string;
  date_received: string;
  remark: string;
  quantity: string;
};

const emptyFormValues: InventoryFormValues = {
  type: "aircraft_spares",
  asset_id: "",
  expense_category_id: "",
  unit_id: "",
  description: "",
  serial_number: "",
  part_number: "",
  current_stock: "",
  re_order_level: "",
  unit_cost: "",
  measurement_unit: "",
  supplier_id: "",
  expiry_date: "",
  date_received: "",
  remark: "",
  quantity: "",
};

const mapItemToFormValues = (item: InventoryItem): InventoryFormValues => ({
  type:
    item.type === "aircraft_spares" ||
    item.type === "aircraft" ||
    item.type === "consumables" ||
    item.type === "oem" ||
    item.type === "ground_support" ||
    item.type === "general" ||
    item.type === "others"
      ? item.type === "aircraft"
        ? "aircraft_spares"
        : item.type === "oem"
          ? "consumables"
          : item.type
      : "aircraft_spares",
  asset_id: item.asset_id ?? "",
  expense_category_id: item.expense_category_id,
  unit_id: item.unit_id,
  description: item.description ?? "",
  serial_number: item.serial_number ?? "",
  part_number: item.part_number,
  current_stock: String(item.current_stock ?? ""),
  re_order_level: String(item.re_order_level ?? ""),
  unit_cost: String(item.unit_cost ?? ""),
  measurement_unit: item.measurement_unit ?? "",
  supplier_id: item.supplier_id ?? "",
  expiry_date: item.expiry_date ?? "",
  date_received: item.date_received ?? "",
  remark: item.remark ?? "",
  quantity: String(item.current_stock ?? ""),
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
  const isAircraftSpares = values.type === "aircraft_spares";

  const pageTitle = mode === "create" ? "Add Stock" : "Edit";
  const primaryButtonLabel = mode === "create" ? "Save" : "Save Changes";

  const { data: assetTypes = [], isLoading: isAssetTypesLoading } =
    useGetAssetTypesQuery();
  const { data: suppliers = [], isLoading: isSuppliersLoading } =
    useGetSuppliersQuery();

  const handleChange =
    (field: keyof InventoryFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const parsedPayload = useMemo(() => {
    const currentStockNumeric =
      values.current_stock.trim().length > 0
        ? Number(values.current_stock)
        : undefined;
    const quantityNumeric =
      values.quantity.trim().length > 0 ? Number(values.quantity) : undefined;
    const unitCostNumeric =
      values.unit_cost.trim().length > 0 ? Number(values.unit_cost) : undefined;
    const reOrderNumeric =
      values.re_order_level.trim().length > 0
        ? Number(values.re_order_level)
        : undefined;

    return {
      currentStockNumeric,
      reOrderNumeric,
      quantityNumeric,
      unitCostNumeric,
    };
  }, [
    values.current_stock,
    values.quantity,
    values.re_order_level,
    values.unit_cost,
  ]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof InventoryFormValues, string>> = {};

    if (!values.description.trim()) newErrors.description = "Required";
    if (!values.serial_number.trim()) newErrors.serial_number = "Required";
    if (!values.part_number.trim()) newErrors.part_number = "Required";
    if (!values.supplier_id) newErrors.supplier_id = "Required";
    if (!values.current_stock.trim()) newErrors.current_stock = "Required";
    if (!values.re_order_level.trim()) newErrors.re_order_level = "Required";
    if (!values.unit_id) newErrors.unit_id = "Required";
    if (!isAircraftSpares && !values.expense_category_id)
      newErrors.expense_category_id = "Required";
    if (isAircraftSpares && !values.asset_id) newErrors.asset_id = "Required";

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
      quantityNumeric,
      unitCostNumeric,
    } = parsedPayload;

    const computedAssetId =
      values.type === "aircraft_spares"
        ? typeof values.asset_id === "number"
          ? values.asset_id
          : Number(values.asset_id)
        : mode === "edit" && inventory
          ? (inventory.asset_id ?? null)
          : null;

    const basePayload = {
      type: values.type,
      asset_id: computedAssetId,
      expense_category_id: isAircraftSpares
        ? (inventory?.expense_category_id ?? null)
        : typeof values.expense_category_id === "number"
          ? values.expense_category_id
          : Number(values.expense_category_id),
      unit_id:
        typeof values.unit_id === "number"
          ? values.unit_id
          : Number(values.unit_id),
      serial_number: values.serial_number.trim(),
      part_number: values.part_number.trim(),
      current_stock: currentStockNumeric ?? 0,
      re_order_level: reOrderNumeric ?? 0,
      measurement_unit: inventory?.measurement_unit ?? "",
      unit_cost: unitCostNumeric ?? 0,
      supplier_id:
        typeof values.supplier_id === "number"
          ? values.supplier_id
          : Number(values.supplier_id),
      expiry_date: values.expiry_date.trim() || null,
      date_received: values.date_received.trim() || null,
      remark: values.remark.trim(),
      description: values.description.trim(),
      quantity: quantityNumeric ?? 0,
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
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <h2 className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
            {pageTitle}
          </h2>

          <button
            type="button"
            onClick={() => handleSubmitInternal(true)}
            className={cn(
              "inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-300 hover:text-white",
              isSubmitting && "opacity-70 cursor-not-allowed",
            )}
            disabled={isSubmitting}
          >
            <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
            <span>Save &amp; Exit</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-3">
            <div className="text-[11px] uppercase text-gray-400">
              Select Stock Type
            </div>
            <div className="flex flex-wrap items-center gap-5 text-xs text-gray-200">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#7FD5FF]"
                  checked={values.type === "aircraft_spares"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      type: "aircraft_spares",
                      asset_id: "",
                    }))
                  }
                />
                <span>Aircraft spares</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#7FD5FF]"
                  checked={values.type === "consumables"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      type: "consumables",
                      asset_id: "",
                    }))
                  }
                />
                <span>Consumables</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#7FD5FF]"
                  checked={values.type === "ground_support"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      type: "ground_support",
                      asset_id: "",
                    }))
                  }
                />
                <span>Ground support</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="stockType"
                  className="form-radio text-[#7FD5FF]"
                  checked={values.type === "general"}
                  onChange={() =>
                    setValues((prev) => ({
                      ...prev,
                      type: "general",
                      asset_id: "",
                    }))
                  }
                />
                <span>General(Qm Stores)</span>
              </label>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {values.type === "aircraft_spares" && (
              <div className="space-y-1">
                <label className="text-[11px] uppercase text-gray-400">
                  Aircraft
                </label>
                <div className="relative">
                  <select
                    value={values.asset_id}
                    onChange={handleChange("asset_id")}
                    className={cn(
                      "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none",
                      isAssetTypesLoading && "opacity-70 cursor-not-allowed",
                    )}
                    disabled={isAssetTypesLoading}
                  >
                    <option value="">
                      {isAssetTypesLoading ? "Loading..." : "Select"}
                    </option>
                    {assetTypes.map((assetType) => (
                      <option key={assetType.id} value={assetType.id}>
                        {assetType.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
                {errors.asset_id && (
                  <p className="text-[11px] text-red-400">{errors.asset_id}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Item Description
              </label>
              <input
                type="text"
                value={values.description}
                onChange={handleChange("description")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Item Description"
              />
              {errors.description && (
                <p className="text-[11px] text-red-400">{errors.description}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Serial No.
              </label>
              <input
                type="text"
                value={values.serial_number}
                onChange={handleChange("serial_number")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Serial No."
              />
              {errors.serial_number && (
                <p className="text-[11px] text-red-400">
                  {errors.serial_number}
                </p>
              )}
            </div>

            {!isAircraftSpares && (
              <div className="space-y-1">
                <label className="text-[11px] uppercase text-gray-400">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={values.expense_category_id}
                    onChange={handleChange("expense_category_id")}
                    className={cn(
                      "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none",
                      isCategoriesLoading && "opacity-70 cursor-not-allowed",
                    )}
                    disabled={isCategoriesLoading}
                  >
                    <option value="">
                      {isCategoriesLoading ? "Loading..." : "Select Category"}
                    </option>
                    {categories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
                {errors.expense_category_id && (
                  <p className="text-[11px] text-red-400">
                    {errors.expense_category_id}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Current Stock
              </label>
              <input
                type="number"
                value={values.current_stock}
                onChange={handleChange("current_stock")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Current Stock"
              />
              {errors.current_stock && (
                <p className="text-[11px] text-red-400">
                  {errors.current_stock}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Unit
              </label>
              <div className="relative">
                <select
                  value={values.unit_id}
                  onChange={handleChange("unit_id")}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none"
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
                  className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
              {errors.unit_id && (
                <p className="text-[11px] text-red-400">{errors.unit_id}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Part No.
              </label>
              <input
                type="text"
                value={values.part_number}
                onChange={handleChange("part_number")}
                className={cn(
                  "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none",
                  "placeholder:text-gray-500",
                )}
                placeholder="Enter Part No."
              />
              {errors.part_number && (
                <p className="text-[11px] text-red-400">{errors.part_number}</p>
              )}
            </div>

            {/* <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Units/Measurement
              </label>
              <input
                type="text"
                value={values.measurement_unit}
                onChange={handleChange("measurement_unit")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Units/Measurement"
              />
              {errors.measurement_unit && (
                <p className="text-[11px] text-red-400">
                  {errors.measurement_unit}
                </p>
              )}
            </div> */}

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400"></label>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400"></label>
            </div>

            {/* <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Total Cost
              </label>
              <div className="h-[38px] sm:h-[42px] flex items-center text-xl font-bold text-gray-300">
                {(() => {
                  const qty = parsedPayload.quantityNumeric ?? 0;
                  const unitCost = parsedPayload.unitCostNumeric ?? 0;
                  const total = qty * unitCost;
                  if (!total) return "00";
                  return total.toLocaleString();
                })()}
              </div>
            </div> */}

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Re-Order Level
              </label>
              <input
                type="number"
                value={values.re_order_level}
                onChange={handleChange("re_order_level")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Re-Order Level"
              />
              {errors.re_order_level && (
                <p className="text-[11px] text-red-400">
                  {errors.re_order_level}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Expiry Date
              </label>
              <input
                type="date"
                value={values.expiry_date}
                onChange={handleChange("expiry_date")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Date Received
              </label>
              <input
                type="date"
                value={values.date_received}
                onChange={handleChange("date_received")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Vendor/Supplier
              </label>
              <div className="relative">
                <select
                  value={values.supplier_id}
                  onChange={handleChange("supplier_id")}
                  title="Vendor/Supplier"
                  className={cn(
                    "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none",
                    isSuppliersLoading && "opacity-70 cursor-not-allowed",
                  )}
                  disabled={isSuppliersLoading}
                >
                  <option value="">
                    {isSuppliersLoading ? "Loading suppliers..." : "Select Supplier"}
                  </option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
              {errors.supplier_id && (
                <p className="text-[11px] text-red-400">{errors.supplier_id}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Remark
              </label>
              <input
                type="text"
                value={values.remark}
                onChange={handleChange("remark")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Remark"
              />
            </div>
          </div>

          {submitError && (
            <p className="text-[11px] text-red-400">{submitError}</p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => handleSubmitInternal(true)}
              className={cn(
                "inline-flex items-center justify-center px-6 py-2 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors",
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

  const mode: FormMode = id ? "edit" : "create";

  const {
    data: inventory,
    isLoading: isInventoryLoading,
    isError: isInventoryError,
  } = useGetInventoryByIdQuery(id ?? "", {
    skip: !id,
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
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
          <div className="p-6 text-center text-gray-400">
            Failed to load inventory.
          </div>
        </section>
      </div>
    );
  }

  if (mode === "edit" && isInventoryLoading) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
          <div className="p-6 text-center text-gray-400">
            Loading inventory...
          </div>
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
