import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useCreateExpenseMutation,
  useGetBudgetsQuery,
  useGetExpenseCategoriesQuery,
  useGetExpenseTypesQuery,
  useGetAircraftQuery,
  type FinanceBudget,
  type FinanceExpenseCategory,
  type FinanceExpenseType,
  type FinanceAircraft,
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
  work_order: string;
  quantity: string;
  unit_cost: string;
  total_cost: string;
};

const emptyFormValues: FinanceFormValues = {
  budget_id: "",
  unit_id: "",
  expense_category_id: "",
  expense_type_id: "",
  aircraft_id: "",
  part_number: "",
  part_name: "",
  work_order: "",
  quantity: "",
  unit_cost: "",
  total_cost: "",
};

export const FinanceFormPage = () => {
  const navigate = useNavigate();

  const { data: budgetsData } = useGetBudgetsQuery();
  const { data: unitsData } = useGetUnitsQuery();
  const { data: categoriesData } = useGetExpenseCategoriesQuery();
  const { data: expenseTypesData } = useGetExpenseTypesQuery();
  const { data: aircraftData } = useGetAircraftQuery();

  const [values, setValues] = useState<FinanceFormValues>(emptyFormValues);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createExpense, { isLoading }] = useCreateExpenseMutation();

  const budgets = budgetsData ?? [];
  const units = (unitsData ?? []) as Unit[];
  const categories = (categoriesData ?? []) as FinanceExpenseCategory[];
  const expenseTypes = (expenseTypesData ?? []) as FinanceExpenseType[];
  const aircraftList = (aircraftData ?? []) as FinanceAircraft[];

  const selectedBudget: FinanceBudget | undefined = useMemo(
    () =>
      budgets.find(
        (budget) =>
          budget.id ===
          (typeof values.budget_id === "number" ? values.budget_id : -1),
      ),
    [budgets, values.budget_id],
  );

  const parsedQuantity =
    values.quantity.trim().length > 0 ? Number(values.quantity) : 0;
  const parsedUnitCost =
    values.unit_cost.trim().length > 0 ? Number(values.unit_cost) : 0;

  const computedTotalCost =
    !Number.isNaN(parsedQuantity) && !Number.isNaN(parsedUnitCost)
      ? parsedQuantity * parsedUnitCost
      : 0;

  const displayTotalCost =
    values.total_cost.trim().length > 0
      ? Number(values.total_cost)
      : computedTotalCost;

  const handleChange =
    (field: keyof FinanceFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;

      setValues((prev) => ({
        ...prev,
        [field]:
          field === "budget_id" ||
          field === "unit_id" ||
          field === "expense_category_id" ||
          field === "expense_type_id" ||
          field === "aircraft_id"
            ? value === ""
              ? ""
              : Number(value)
            : value,
      }));
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

    if (
      values.expense_category_id === "" ||
      values.expense_type_id === "" ||
      values.aircraft_id === ""
    ) {
      setSubmitError("Select category, aircraft and expense type.");
      return;
    }

    if (!values.part_number.trim() || !values.part_name.trim()) {
      setSubmitError("Enter both part number and part name.");
      return;
    }

    if (!values.work_order.trim()) {
      setSubmitError("Enter a work order.");
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

    const totalCost =
      displayTotalCost && !Number.isNaN(displayTotalCost)
        ? displayTotalCost
        : computedTotalCost;

    try {
      await createExpense({
        expense_category_id: values.expense_category_id as number,
        expense_type_id: values.expense_type_id as number,
        aircraft_id: values.aircraft_id as number,
        unit_id:
          typeof values.unit_id === "number" && values.unit_id > 0
            ? values.unit_id
            : selectedBudget.unit_id,
        budget_id: selectedBudget.id,
        part_number: values.part_number.trim(),
        part_name: values.part_name.trim(),
        work_order: values.work_order.trim(),
        quantity: parsedQuantity,
        unit_cost: parsedUnitCost,
        total_cost: totalCost,
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
          Add Finance
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
          <span className="font-semibold text-white">FINANCE ID:{` `}</span>
          <span>Auto-generated</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Part No.
            </label>
            <input
              type="text"
              value={values.part_number}
              onChange={handleChange("part_number")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              placeholder="Enter Part No."
            />
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
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Category
            </label>
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
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Aircraft
            </label>
            <select
              value={
                values.aircraft_id === "" ? "" : String(values.aircraft_id)
              }
              onChange={handleChange("aircraft_id")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none"
            >
              <option value="">Select Aircraft</option>
              {aircraftList.map((aircraft) => (
                <option key={aircraft.id} value={aircraft.id}>
                  {aircraft.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Work Order
            </label>
            <input
              type="text"
              value={values.work_order}
              onChange={handleChange("work_order")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              placeholder="Enter Work Order"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Quantity
            </label>
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
            <label className="text-[11px] uppercase text-gray-400">
              Expense Type
            </label>
            <select
              value={
                values.expense_type_id === ""
                  ? ""
                  : String(values.expense_type_id)
              }
              onChange={handleChange("expense_type_id")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none appearance-none"
            >
              <option value="">Select Expense Type</option>
              {expenseTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Unit Cost (₦)
            </label>
            <input
              type="number"
              min={0}
              value={values.unit_cost}
              onChange={handleChange("unit_cost")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              placeholder="Enter Unit Cost"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Total Cost (₦)
            </label>
            <input
              type="number"
              min={0}
              value={
                values.total_cost.trim().length
                  ? values.total_cost
                  : computedTotalCost
                    ? String(computedTotalCost)
                    : ""
              }
              onChange={handleChange("total_cost")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              placeholder="Enter Total Cost"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Unit</label>
            <select
              value={values.unit_id === "" ? "" : String(values.unit_id)}
              onChange={handleChange("unit_id")}
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
            <label className="text-[11px] uppercase text-gray-400">
              Budget
            </label>
            <select
              value={values.budget_id === "" ? "" : String(values.budget_id)}
              onChange={handleChange("budget_id")}
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
        </div>

        {submitError && (
          <p className="mt-4 text-[11px] text-red-400">{submitError}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className={cn(
              "px-6 sm:px-10 py-2 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors",
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
