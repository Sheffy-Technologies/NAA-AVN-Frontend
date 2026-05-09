import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import {
  useCreateBudgetMutation,
  useGetBudgetCategoriesQuery,
  type FinanceBudgetCategory,
} from "@/features/finance/api";

type BudgetFormValues = {
  name: string;
  budget_category_id: number | "";
  amount: string;
  start_date: string;
  end_date: string;
  unit_id: number | "";
};

const emptyBudgetValues: BudgetFormValues = {
  name: "",
  budget_category_id: "",
  amount: "",
  start_date: "",
  end_date: "",
  unit_id: "",
};

export const BudgetFormPage = () => {
  const navigate = useNavigate();

  const [values, setValues] = useState<BudgetFormValues>(emptyBudgetValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createBudget, { isLoading: isSubmitting }] = useCreateBudgetMutation();

  const { data: unitsData } = useGetUnitsQuery();
  const { data: categoriesData } = useGetBudgetCategoriesQuery();

  const units = (unitsData ?? []) as Unit[];
  const categories = (categoriesData ?? []) as FinanceBudgetCategory[];

  const handleChange =
    (field: keyof BudgetFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;

      setValues((prev) => ({
        ...prev,
        [field]:
          field === "budget_category_id" || field === "unit_id"
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
    if (!values.name.trim()) {
      setSubmitError("Enter budget name.");
      return;
    }

    if (values.budget_category_id === "") {
      setSubmitError("Select a budget category.");
      return;
    }

    if (!values.amount.trim() || Number(values.amount) <= 0) {
      setSubmitError("Enter a valid amount.");
      return;
    }

    if (!values.start_date || !values.end_date) {
      setSubmitError("Select start and end dates.");
      return;
    }

    if (values.unit_id === "") {
      setSubmitError("Select a unit.");
      return;
    }

    try {
      await createBudget({
        name: values.name.trim(),
        budget_category_id: values.budget_category_id,
        amount: Number(values.amount),
        start_date: values.start_date,
        end_date: values.end_date,
        unit_id: values.unit_id,
      }).unwrap();
    } catch {
      setSubmitError("Failed to save budget. Please try again.");
      return;
    }

    navigate("/dashboard/finance");
  };

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-base sm:text-lg font-semibold text-white uppercase tracking-wide">
          Add Budget
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
          <span className="font-semibold text-white">BUDGET ID:{` `}</span>
          <span>Auto-generated</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Budget Name
            </label>
            <input
              type="text"
              value={values.name}
              onChange={handleChange("name")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="Enter Budget Name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Category
            </label>
            <select
              aria-label="Budget category"
              value={
                values.budget_category_id === ""
                  ? ""
                  : String(values.budget_category_id)
              }
              onChange={handleChange("budget_category_id")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
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
              Allocated amount (₦)
            </label>
            <input
              type="number"
              min={0}
              value={values.amount}
              onChange={handleChange("amount")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="Enter Allocated amount"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              Start Date
            </label>
            <input
              type="date"
              aria-label="Budget start date"
              value={values.start_date}
              onChange={handleChange("start_date")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">
              End Date
            </label>
            <input
              type="date"
              aria-label="Budget end date"
              value={values.end_date}
              onChange={handleChange("end_date")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Unit</label>
            <select
              aria-label="Budget unit"
              value={values.unit_id === "" ? "" : String(values.unit_id)}
              onChange={handleChange("unit_id")}
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
        </div>

        {submitError && (
          <p className="mt-4 text-[11px] text-red-400">{submitError}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "px-6 sm:px-10 py-2 rounded bg-[#0369A1] text-black text-xs sm:text-sm font-medium hover:bg-[#0369A1]/90 transition-colors",
              isSubmitting && "opacity-70 cursor-not-allowed",
            )}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
};
