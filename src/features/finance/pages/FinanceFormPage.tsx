import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useCreateExpenseMutation,
  useGetBudgetsQuery,
  // useGetExpenseCategoriesQuery,
  useGetExpenseTypesQuery,
  type FinanceBudget,
  // type FinanceExpenseCategory,
  type FinanceExpenseType,
} from "@/features/finance/api";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";

type FinanceFormValues = {
  budget_id: number | "";
  unit_id: number | "";
  expense_category_id: number | "";
  expense_type_id: number | "";
  aircraft_id: number | "";
  part_number: string;
  part_name: string;
  vendor_supplier: string;
  remark: string;
  work_order: string;
  quantity: string;
  unit_cost: string;
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
  remark: "",
  work_order: "",
  quantity: "",
  unit_cost: "",
};

export const FinanceFormPage = () => {
  const navigate = useNavigate();

  const { data: budgetsData } = useGetBudgetsQuery();
  const { data: unitsData } = useGetUnitsQuery();
  // const { data: categoriesData } = useGetExpenseCategoriesQuery();
  const { data: expenseTypesData } = useGetExpenseTypesQuery();

  const [values, setValues] = useState<FinanceFormValues>(emptyFormValues);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createExpense, { isLoading }] = useCreateExpenseMutation();

  const budgets = (budgetsData ?? []) as FinanceBudget[];
  const units = (unitsData ?? []) as Unit[];
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

  const handleCancel = () => {
    navigate("/dashboard/finance");
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    if (!selectedBudget) {
      setSubmitError("Select a budget.");
      return;
    }

    if (values.expense_category_id === "") {
      setSubmitError("Select a category.");
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

    if (!values.vendor_supplier.trim()) {
      setSubmitError("Enter vendor/supplier.");
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
      values.vendor_supplier.trim(),
      values.remark.trim(),
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      await createExpense({
        expense_category_id: values.expense_category_id as number,
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
      }).unwrap();

      navigate("/dashboard/finance");
    } catch {
      setSubmitError("Failed to save finance record. Please try again.");
    }
  };

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-base sm:text-lg font-semibold text-white uppercase tracking-wide">
          ADD FINANCE
        </h1>
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-300 hover:text-white"
        >
          <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
          <span>Save &amp; Exit</span>
        </button>
      </div>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 sm:p-6">
        <div className="mb-4 text-[11px] sm:text-xs text-gray-400">
          <span className="font-semibold text-white">EXPENSE ID:{` `}</span>
          <span>Auto-generated</span>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Budget</label>
              <select
                value={values.budget_id === "" ? "" : String(values.budget_id)}
                onChange={handleChange("budget_id")}
                aria-label="Select Budget"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none"
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
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
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
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none"
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
              <input
                type="text"
                value={values.vendor_supplier}
                onChange={handleChange("vendor_supplier")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Vendor/Supplier"
              />
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
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
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
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
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
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
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
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none"
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
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Remark"
              />
            </div>
          </div>
        </div>

        {submitError && (
          <p className="mt-4 text-[11px] text-red-400">{submitError}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className={cn(
              "w-full sm:w-90 px-6 sm:px-10 py-2.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors",
              isLoading && "opacity-70 cursor-not-allowed",
            )}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
};
