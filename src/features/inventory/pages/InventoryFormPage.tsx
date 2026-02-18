import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useCreateInventoryMutation,
  useGetInventoryByIdQuery,
  useUpdateInventoryMutation,
  type InventoryItem,
} from "@/features/inventory/api";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";

type FormMode = "create" | "edit";

type InventoryFormValues = {
  expense_category_id: number | "";
  unit_id: number | "";
  part_number: string;
  part_name: string;
  nsn_number: string;
  ata_chapter: string;
  re_order_level: string;
  measurement_unit: string;
  expiry_date: string;
  quantity: string;
};

const emptyFormValues: InventoryFormValues = {
  expense_category_id: "",
  unit_id: "",
  part_number: "",
  part_name: "",
  nsn_number: "",
  ata_chapter: "",
  re_order_level: "",
  measurement_unit: "",
  expiry_date: "",
  quantity: "",
};

const mapItemToFormValues = (item: InventoryItem): InventoryFormValues => ({
  expense_category_id: item.expense_category_id,
  unit_id: item.unit_id,
  part_number: item.part_number,
  part_name: item.part_name,
  nsn_number: item.nsn_number ?? "",
  ata_chapter: item.ata_chapter ?? "",
  re_order_level: String(item.re_order_level ?? ""),
  measurement_unit: item.measurement_unit ?? "",
  expiry_date: item.expiry_date ?? "",
  quantity: String(item.current_stock ?? ""),
});

type InventoryFormContentProps = {
  mode: FormMode;
  inventory: InventoryItem | null;
  units: Unit[] | undefined;
  isUnitsLoading: boolean;
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
  isUnitsLoading,
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

  const pageTitle = mode === "create" ? "Add Stock" : "Edit";
  const primaryButtonLabel = mode === "create" ? "Save" : "Save Changes";

  const handleChange =
    (field: keyof InventoryFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const parsedPayload = useMemo(() => {
    const reOrderNumeric =
      values.re_order_level.trim().length > 0
        ? Number(values.re_order_level)
        : undefined;
    const quantityNumeric =
      values.quantity.trim().length > 0 ? Number(values.quantity) : undefined;

    return {
      reOrderNumeric,
      quantityNumeric,
    };
  }, [values.re_order_level, values.quantity]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof InventoryFormValues, string>> = {};

    if (!values.part_number.trim()) newErrors.part_number = "Required";
    if (!values.part_name.trim()) newErrors.part_name = "Required";
    if (!values.measurement_unit.trim())
      newErrors.measurement_unit = "Required";
    if (!values.quantity.trim()) newErrors.quantity = "Required";
    if (!values.re_order_level.trim()) newErrors.re_order_level = "Required";
    if (!values.unit_id) newErrors.unit_id = "Required";

    if (
      values.re_order_level.trim() &&
      (Number.isNaN(parsedPayload.reOrderNumeric) ||
        parsedPayload.reOrderNumeric === undefined)
    ) {
      newErrors.re_order_level = "Must be a number";
    }

    if (
      values.quantity.trim() &&
      (Number.isNaN(parsedPayload.quantityNumeric) ||
        parsedPayload.quantityNumeric === undefined)
    ) {
      newErrors.quantity = "Must be a number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitInternal = async (exitAfter: boolean) => {
    setSubmitError(null);
    if (!validate()) return;

    const { reOrderNumeric, quantityNumeric } = parsedPayload;

    const basePayload = {
      expense_category_id:
        typeof values.expense_category_id === "number"
          ? values.expense_category_id
          : 1,
      unit_id:
        typeof values.unit_id === "number"
          ? values.unit_id
          : Number(values.unit_id),
      part_number: values.part_number.trim(),
      part_name: values.part_name.trim(),
      nsn_number: values.nsn_number.trim() || null,
      ata_chapter: values.ata_chapter.trim() || null,
      re_order_level: reOrderNumeric ?? 0,
      measurement_unit: values.measurement_unit.trim(),
      expiry_date: values.expiry_date.trim() || null,
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

  const headerInventoryLabel =
    mode === "edit" && inventory ? `INVENTORY ID${inventory.id}` : "";

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h2 className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {mode === "create" && (
              <button
                type="button"
                onClick={() => handleSubmitInternal(true)}
                className={cn(
                  "hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/60 text-xs text-gray-200 hover:bg-[#0A4D66]/30",
                  isSubmitting && "opacity-70 cursor-not-allowed",
                )}
                disabled={isSubmitting}
              >
                Save & Exit
              </button>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 text-xs sm:text-sm text-gray-300">
          {headerInventoryLabel}
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Part Name
              </label>
              <input
                type="text"
                value={values.part_name}
                onChange={handleChange("part_name")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Part Name"
              />
              {errors.part_name && (
                <p className="text-[11px] text-red-400">{errors.part_name}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Category
              </label>
              <input
                type="text"
                value={values.expense_category_id ? "Parts" : ""}
                readOnly
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-400 outline-none"
                placeholder="Select Category"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">NSN</label>
              <input
                type="text"
                value={values.nsn_number}
                onChange={handleChange("nsn_number")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter NSN"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                ATA Chapter
              </label>
              <input
                type="text"
                value={values.ata_chapter}
                onChange={handleChange("ata_chapter")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter ATA Chapter"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Quantity in-stock
              </label>
              <input
                type="number"
                value={values.quantity}
                onChange={handleChange("quantity")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Quantity in-stock"
              />
              {errors.quantity && (
                <p className="text-[11px] text-red-400">{errors.quantity}</p>
              )}
            </div>

            <div className="space-y-1">
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
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Expiry Date
              </label>
              <input
                type="text"
                value={values.expiry_date}
                onChange={handleChange("expiry_date")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="DD/MM/YYYY"
              />
            </div>

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
      isUnitsLoading={isUnitsLoading}
      onBack={handleBack}
      createInventory={createInventory}
      updateInventory={updateInventory}
      id={id}
      isSubmitting={isSubmitting}
    />
  );
};
