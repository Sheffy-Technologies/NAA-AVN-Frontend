import { useMemo, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import {
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useGetBudgetsQuery,
  // useGetExpenseCategoriesQuery,
  useGetExpenseTypesQuery,
  type FinanceBudget,
  type FinanceExpense,
  // type FinanceExpenseCategory,
  type FinanceExpenseType,
} from "@/features/finance/api";
import {
  useGetPurchaseOrdersQuery,
  useGetSuppliersQuery,
  type PurchaseOrder,
  type InventorySupplier,
} from "@/features/inventory/api";
import {
  useGetWorkOrdersQuery,
  type WorkOrderResponse,
} from "@/features/maintenance/api";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import { BackButton, CancelButton } from "@/shared/ui/button";

type FinanceFormValues = {
  budget_id: number | "";
  unit_id: number | "";
  expense_category_id: number | "";
  expense_type_id: number | "";
  aircraft_id: number | "";
  part_number: string;
  part_name: string;
  vendor_supplier: string;
  purchase_order: string;
  maintenance_work_order: string;
  remark: string;
  quantity: string;
  unit_cost: string;
  date: string;
};

const emptyFormValues: FinanceFormValues = {
  budget_id: "",
  unit_id: "",
  expense_category_id: "",
  expense_type_id: "",
  aircraft_id: "",
  part_number: "",
  part_name: "",
  vendor_supplier: "",
  purchase_order: "",
  maintenance_work_order: "",
  remark: "",
  quantity: "",
  unit_cost: "",
  date: "",
};

export const FinanceFormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const editState = location.state as
    | {
        mode?: "edit";
        expense?: FinanceExpense;
      }
    | undefined;
  const editingExpense = editState?.mode === "edit" ? editState.expense : undefined;
  const isEditing = Boolean(editingExpense?.id);

  const { data: budgetsData } = useGetBudgetsQuery();
  const { data: unitsData } = useGetUnitsQuery();
  const { data: suppliersData } = useGetSuppliersQuery();
  const { data: purchaseOrdersData } = useGetPurchaseOrdersQuery();
  const { data: workOrdersData } = useGetWorkOrdersQuery();
  // const { data: categoriesData } = useGetExpenseCategoriesQuery();
  const { data: expenseTypesData } = useGetExpenseTypesQuery();

  const initialValues: FinanceFormValues = editingExpense
    ? {
        budget_id: editingExpense.budget_id,
        unit_id: editingExpense.unit_id,
        expense_category_id: editingExpense.expense_category_id ?? "",
        expense_type_id: editingExpense.expense_type_id,
        aircraft_id: editingExpense.aircraft_id,
        part_number: editingExpense.part_number ?? "",
        part_name: editingExpense.part_name ?? "",
        vendor_supplier: "",
        purchase_order: "",
        maintenance_work_order: "",
        remark: editingExpense.work_order ?? "",
        quantity: String(editingExpense.quantity ?? ""),
        unit_cost: String(editingExpense.unit_cost ?? ""),
        date: editingExpense.date || editingExpense.created_at
          ? new Date(
              editingExpense.date || editingExpense.created_at,
            ).toISOString().split("T")[0]
          : "",
      }
    : emptyFormValues;

  const [values, setValues] = useState<FinanceFormValues>(initialValues);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createExpense, { isLoading }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();

  const budgets = (budgetsData ?? []) as FinanceBudget[];
  const units = (unitsData ?? []) as Unit[];
  const suppliers = (suppliersData ?? []) as InventorySupplier[];
  const purchaseOrders = (purchaseOrdersData ?? []) as PurchaseOrder[];
  const workOrders = (workOrdersData ?? []) as WorkOrderResponse[];
  // const categories = (categoriesData ?? []) as FinanceExpenseCategory[];
  const expenseTypes = (expenseTypesData ?? []) as FinanceExpenseType[];

  const selectedBudget: FinanceBudget | undefined = useMemo(() => {
    const list = (budgetsData ?? []) as FinanceBudget[];
    const selectedId =
      typeof values.budget_id === "number" ? values.budget_id : -1;

    return list.find((budget) => budget.id === selectedId);
  }, [budgetsData, values.budget_id]);

  const parsedQuantity =
    values.quantity.trim().length > 0 ? Number(values.quantity) : 0;
  const parsedUnitCost =
    values.unit_cost.trim().length > 0 ? Number(values.unit_cost) : 0;

  const computedTotalCost =
    !Number.isNaN(parsedQuantity) && !Number.isNaN(parsedUnitCost)
      ? parsedQuantity * parsedUnitCost
      : 0;

  const handleChange =
    (field: keyof FinanceFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;

      setValues((prev) => {
        const numericFields: Array<keyof FinanceFormValues> = [
          "budget_id",
          "unit_id",
          "expense_category_id",
          "expense_type_id",
          "aircraft_id",
        ];

        const nextValue: FinanceFormValues[keyof FinanceFormValues] =
          numericFields.includes(field)
            ? value === ""
              ? ""
              : Number(value)
            : value;

        const nextValues: FinanceFormValues = {
          ...prev,
          [field]: nextValue,
        } as FinanceFormValues;

        if (field === "budget_id") {
          const budgetId = value === "" ? "" : Number(value);
          const budget =
            typeof budgetId === "number"
              ? budgets.find((item) => item.id === budgetId)
              : undefined;

          if (budget) {
            nextValues.unit_id = budget.unit_id;
            nextValues.expense_category_id =
              typeof budget.expense_category_id === "number"
                ? budget.expense_category_id
                : "";
            nextValues.aircraft_id = budget.aircraft_id;
          }
        }

        return nextValues;
      });
      setSubmitError(null);
    };

  const isFormDirty = Boolean(
    values.budget_id ||
    values.part_number.trim() ||
    values.part_name.trim() ||
    values.quantity.trim() ||
    values.unit_cost.trim(),
  );


  const handleSubmit = async () => {
    setSubmitError(null);

    if (!selectedBudget) {
      setSubmitError("Select a budget.");
      return;
    }

    const selectedExpenseTypeId =
      typeof values.expense_type_id === "number"
        ? values.expense_type_id
        : expenseTypes[0]?.id;

    if (typeof selectedExpenseTypeId !== "number") {
      setSubmitError("No expense types available.");
      return;
    }

    const selectedAircraftId =
      typeof values.aircraft_id === "number"
        ? values.aircraft_id
        : selectedBudget.aircraft_id;

    if (!values.part_number.trim() || !values.part_name.trim()) {
      setSubmitError("Enter item description and units/measurement.");
      return;
    }

    if (
      Number.isNaN(parsedQuantity) ||
      Number.isNaN(parsedUnitCost) ||
      parsedQuantity <= 0 ||
      parsedUnitCost <= 0
    ) {
      setSubmitError("Enter valid quantity and unit cost.");
      return;
    }

    const derivedWorkOrder = [
      values.purchase_order.trim() ? `PO: ${values.purchase_order.trim()}` : "",
      values.maintenance_work_order.trim()
        ? `WO: ${values.maintenance_work_order.trim()}`
        : "",
      values.vendor_supplier.trim(),
      values.remark.trim(),
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      const payload = {
        ...(typeof values.expense_category_id === "number"
          ? { expense_category_id: values.expense_category_id }
          : {}),
        expense_type_id: selectedExpenseTypeId,
        aircraft_id: selectedAircraftId,
        unit_id:
          typeof values.unit_id === "number" && values.unit_id > 0
            ? values.unit_id
            : selectedBudget.unit_id,
        budget_id: selectedBudget.id,
        part_number: values.part_number.trim(),
        part_name: values.part_name.trim(),
        work_order: derivedWorkOrder,
        quantity: parsedQuantity,
        unit_cost: parsedUnitCost,
        total_cost: computedTotalCost,
        ...(values.date ? { date: values.date } : {}),
      };

      if (isEditing && editingExpense) {
        await updateExpense({
          id: editingExpense.id,
          body: payload,
        }).unwrap();
      } else {
        await createExpense(payload).unwrap();
      }

      navigate("/dashboard/finance");
    } catch {
      setSubmitError(
        isEditing
          ? "Failed to update expense record. Please try again."
          : "Failed to save finance record. Please try again.",
      );
    }
  };

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/finance" isDirty={isFormDirty} />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            {isEditing ? "EDIT EXPENSE" : "ADD EXPENSE"}
          </h1>
        </div>
      </div>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 sm:p-6">
        <div className="mb-4 text-[11px] sm:text-xs text-gray-400">
          <span className="font-semibold text-white">EXPENSE ID:{` `}</span>
          <span>
            {isEditing && editingExpense
              ? `EXP-${String(editingExpense.id).padStart(5, "0")}`
              : "Auto-generated"}
          </span>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Budget</label>
              <select
                value={values.budget_id === "" ? "" : String(values.budget_id)}
                onChange={handleChange("budget_id")}
                aria-label="Select Budget"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="">Select Budget</option>
                {budgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">
                Item Description
              </label>
              <input
                type="text"
                value={values.part_name}
                onChange={handleChange("part_name")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
                placeholder="Enter Item Description"
              />
            </div>
            {/* <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Category</label>
              <select
                value={
                  values.expense_category_id === ""
                    ? ""
                    : String(values.expense_category_id)
                }
                onChange={handleChange("expense_category_id")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div> */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">
                Vendor/Supplier
              </label>
              <select
                value={values.vendor_supplier}
                onChange={handleChange("vendor_supplier")}
                aria-label="Select Vendor/Supplier"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="">Select Vendor/Supplier (Optional)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">
                Units/Measurement
              </label>
              <input
                type="text"
                value={values.part_number}
                onChange={handleChange("part_number")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
                placeholder="Enter Units/Measurement"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">QTY </label>
              <input
                type="number"
                min={1}
                value={values.quantity}
                onChange={handleChange("quantity")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
                placeholder="Enter Quantity"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Unit Cost</label>
              <input
                type="number"
                min={0}
                value={values.unit_cost}
                onChange={handleChange("unit_cost")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
                placeholder="Enter Unit Cost"
              />
            </div>
            <div className="space-y-1 flex flex-col">
              <label className="text-[11px] text-gray-400">Total Cost</label>
              <div className="flex-1 flex items-center justify-end text-2xl sm:text-3xl font-semibold text-white">
                {computedTotalCost > 0
                  ? computedTotalCost.toLocaleString()
                  : "00"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Unit</label>
              <select
                value={values.unit_id === "" ? "" : String(values.unit_id)}
                onChange={handleChange("unit_id")}
                aria-label="Select Unit"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="">Select Unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Remark</label>
              <input
                type="text"
                value={values.remark}
                onChange={handleChange("remark")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
                placeholder="Enter Remark"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">
                Purchase Order
              </label>
              <select
                value={values.purchase_order}
                onChange={handleChange("purchase_order")}
                aria-label="Select Purchase Order"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="">Select Purchase Order (Optional)</option>
                {purchaseOrders.map((purchaseOrder) => {
                  const purchaseOrderLabel =
                    purchaseOrder.name?.trim() ||
                    `PO-${String(purchaseOrder.id).padStart(5, "0")}`;

                  return (
                    <option key={purchaseOrder.id} value={purchaseOrderLabel}>
                      {purchaseOrderLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Work Order</label>
              <select
                value={values.maintenance_work_order}
                onChange={handleChange("maintenance_work_order")}
                aria-label="Select Work Order"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="">Select Work Order (Optional)</option>
                {workOrders.map((workOrder) => {
                  const workOrderLabel =
                    workOrder.title?.trim() ||
                    `WO-${String(workOrder.id).padStart(5, "0")}`;

                  return (
                    <option key={workOrder.id} value={workOrderLabel}>
                      {workOrderLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Date</label>
              <input
                type="date"
                value={values.date}
                onChange={handleChange("date")}
                aria-label="Select Date"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        {submitError && (
          <p className="mt-4 text-[11px] text-red-400">{submitError}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <CancelButton
            fallbackUrl="/dashboard/finance"
            isDirty={isFormDirty}
            label="Cancel"
            size="md"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className={cn(
              "px-8 py-2.5 rounded bg-[#0369A1] text-white text-xs sm:text-sm font-semibold hover:bg-[#0369A1]/90 transition-colors shadow-sm",
              (isLoading || isUpdating) && "opacity-70 cursor-not-allowed",
            )}
            disabled={isLoading || isUpdating}
          >
            {isLoading || isUpdating ? "Saving..." : isEditing ? "Save Changes" : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
};
