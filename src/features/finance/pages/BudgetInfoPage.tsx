import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetBudgetsQuery,
  useGetExpensesQuery,
  type FinanceBudget,
  type FinanceExpense,
} from "@/features/finance/api";

type BudgetInfoTabKey = "info" | "expenses";
type BudgetExpenseViewMode = "table" | "grid";
type PeriodFilterKey = "all" | "month" | "quarter" | "year";

export const BudgetInfoPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<BudgetInfoTabKey>("info");
  const [expensesViewMode, setExpensesViewMode] =
    useState<BudgetExpenseViewMode>("table");
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilterKey>("all");

  const { data: budgetsData, isLoading: isBudgetsLoading } =
    useGetBudgetsQuery();
  const {
    data: expensesData,
    isLoading: isExpensesLoading,
    isError: isExpensesError,
  } = useGetExpensesQuery();

  const budget: FinanceBudget | undefined = useMemo(() => {
    if (!budgetsData || !id) return undefined;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) return undefined;
    return budgetsData.find((item) => item.id === numericId);
  }, [budgetsData, id]);

  const relatedExpenses: FinanceExpense[] = useMemo(() => {
    if (!expensesData || !budget) return [];
    return expensesData.filter((expense) => expense.budget_id === budget.id);
  }, [expensesData, budget]);

  const filteredRelatedExpenses: FinanceExpense[] = useMemo(() => {
    if (filterPeriod === "all") return relatedExpenses;

    const now = new Date();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();
    const nowQuarter = Math.floor(nowMonth / 3);

    return relatedExpenses.filter((expense) => {
      const rowDate = new Date(expense.created_at);
      const rowMonth = rowDate.getMonth();
      const rowYear = rowDate.getFullYear();
      const rowQuarter = Math.floor(rowMonth / 3);

      if (filterPeriod === "month") {
        return rowYear === nowYear && rowMonth === nowMonth;
      }
      if (filterPeriod === "quarter") {
        return rowYear === nowYear && rowQuarter === nowQuarter;
      }
      return rowYear === nowYear;
    });
  }, [filterPeriod, relatedExpenses]);

  const totalExpenseAmount = useMemo(
    () =>
      relatedExpenses.reduce((sum, expense) => {
        return sum + expense.total_cost;
      }, 0),
    [relatedExpenses],
  );

  const remainingAmount = budget ? budget.amount - totalExpenseAmount : 0;

  const utilisation =
    budget && budget.amount > 0
      ? (totalExpenseAmount / budget.amount) * 100
      : 0;

  const budgetIdLabel = budget
    ? `BUD-${budget.id.toString().padStart(6, "0")}`
    : "";

  const budgetCreatedAt = budget?.created_at
    ? new Date(budget.created_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

  const budgetStatus = useMemo(() => {
    if (!budget?.start_date || !budget?.end_date) {
      return { label: "-", tone: "muted" as const };
    }

    const start = new Date(budget.start_date);
    const end = new Date(budget.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { label: "-", tone: "muted" as const };
    }

    const now = new Date();
    if (now >= start && now <= end) {
      return { label: "Active", tone: "active" as const };
    }
    if (now > end) {
      return { label: "Expired", tone: "expired" as const };
    }
    return { label: "Upcoming", tone: "upcoming" as const };
  }, [budget?.end_date, budget?.start_date]);

  const handleBack = () => {
    navigate("/dashboard/finance");
  };

  const handleEdit = () => {
    navigate("/dashboard/finance/budgets/add");
  };

  const handleAddFinance = () => {
    navigate("/dashboard/finance/add");
  };

  if (isBudgetsLoading && !budget) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-40 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
              <div className="h-40 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!id || (!budget && !isBudgetsLoading)) {
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
            Failed to load budget.
          </div>
        </section>
      </div>
    );
  }

  if (isBudgetsLoading || !budget) {
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
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Budget Information
            </span>
          </div>
          <div className="p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="h-32 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
              <div className="h-32 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
              <div className="h-32 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 flex-[2]">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 border-transparent",
                activeTab === "info"
                  ? "border-[#7FD5FF] text-white"
                  : "text-gray-400 hover:text-white",
              )}
            >
              <Icon icon="mdi:praying-hands" className="w-4 h-4" />
              <span>Budget Information</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("expenses")}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 border-transparent",
                activeTab === "expenses"
                  ? "border-[#7FD5FF] text-white"
                  : "text-gray-400 hover:text-white",
              )}
            >
              <Icon icon="mdi:clipboard-list-outline" className="w-4 h-4" />
              <span>Expense Breakdown</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 flex-1">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs sm:text-sm text-gray-200 hover:bg-[#021a27]/80"
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs sm:text-sm text-gray-200 hover:bg-[#021a27]/80"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs sm:text-sm text-gray-200 hover:bg-[#021a27]/80"
            >
              <Icon icon="mdi:download-outline" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeTab === "info" && (
          <div className="px-4 sm:px-6 py-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">
                    Budget
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-white">
                    ₦{budget.amount.toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
                  <Icon
                    icon="mdi:wallet-outline"
                    className="w-5 h-5 text-white"
                  />
                </div>
              </div>
              <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">
                    Total Expense
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-white">
                    ₦{totalExpenseAmount.toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
                  <Icon
                    icon="mdi:home-outline"
                    className="w-5 h-5 text-white"
                  />
                </div>
              </div>
              <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">
                    Remaining Amount
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-white">
                    ₦{remainingAmount.toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
                  <Icon icon="mdi:wallet" className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">
                    Utilisation
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-white">
                    {utilisation.toFixed(1)}%
                  </p>
                </div>
                <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
                  <Icon
                    icon="mdi:percent-outline"
                    className="w-5 h-5 text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "info" && (
          <div className="p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                <div className="pb-3 border-b border-[#0A4D66]/40">
                  <span className="text-[11px] uppercase tracking-wide text-[#7FD5FF]">
                    Budget ID:{` `}
                    {budgetIdLabel}
                  </span>
                </div>
                <div className="divide-y divide-[#0A4D66]/40">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-[#7FD5FF]">Budget Name:</span>
                    <span className="font-semibold text-white text-right">
                      {budget.name}
                    </span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-[#7FD5FF]">Category:</span>
                    <span className="font-semibold text-white text-right">
                      {budget.expense_category?.name ?? "-"}
                    </span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-[#7FD5FF]">Unit</span>
                    <span className="font-semibold text-white text-right">
                      {budget.unit?.name ?? "-"}
                    </span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-[#7FD5FF]">Date Created:</span>
                    <span className="font-semibold text-white text-right">
                      {budgetCreatedAt}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                <div className="pb-3 border-b border-[#0A4D66]/40">
                  <span className="text-[11px] uppercase tracking-wide text-[#7FD5FF]">
                    Period
                  </span>
                </div>
                <div className="divide-y divide-[#0A4D66]/40">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-[#7FD5FF]">Start Date:</span>
                    <span className="font-semibold text-white text-right">
                      {budget.start_date ?? "-"}
                    </span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-[#7FD5FF]">End Date:</span>
                    <span className="font-semibold text-white text-right">
                      {budget.end_date ?? "-"}
                    </span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-[#7FD5FF]">Status:</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 font-semibold",
                        budgetStatus.tone === "active" && "text-emerald-400",
                        budgetStatus.tone === "expired" && "text-red-400",
                        budgetStatus.tone === "upcoming" && "text-amber-400",
                        budgetStatus.tone === "muted" && "text-gray-400",
                      )}
                    >
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          budgetStatus.tone === "active" && "bg-emerald-400",
                          budgetStatus.tone === "expired" && "bg-red-400",
                          budgetStatus.tone === "upcoming" && "bg-amber-400",
                          budgetStatus.tone === "muted" && "bg-gray-500",
                        )}
                      />
                      {budgetStatus.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#021a27] p-1">
                <button
                  type="button"
                  onClick={() => setExpensesViewMode("table")}
                  className={cn(
                    "inline-flex items-center justify-center w-7 h-7 rounded text-gray-300",
                    expensesViewMode === "table" && "bg-[#0A4D66] text-white",
                  )}
                >
                  <Icon icon="mdi:view-list-outline" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpensesViewMode("grid")}
                  className={cn(
                    "inline-flex items-center justify-center w-7 h-7 rounded text-gray-300",
                    expensesViewMode === "grid" && "bg-[#0A4D66] text-white",
                  )}
                >
                  <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200"
                >
                  {filteredRelatedExpenses.length}
                </button>

                <div className="relative">
                  <select
                    value={filterPeriod}
                    onChange={(e) =>
                      setFilterPeriod(e.target.value as PeriodFilterKey)
                    }
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 outline-none appearance-none"
                  >
                    <option value="all">Period</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  />
                </div>

                <button
                  type="button"
                  className="inline-flex items-center justify-center w-8 h-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-gray-300"
                >
                  <Icon icon="mdi:download-outline" className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleAddFinance}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Finance</span>
                </button>
              </div>
            </div>
            {expensesViewMode === "table" && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm text-gray-200">
                  <thead>
                    <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 sm:px-6 py-3 text-left">
                        Item Description
                      </th>
                      <th className="px-4 py-3 text-left">Expense ID</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Quantity</th>
                      <th className="px-4 py-3 text-left">Unit Cost</th>
                      <th className="px-4 py-3 text-left">Total Cost</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Vendor</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isExpensesLoading && relatedExpenses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 sm:px-6 py-6 text-center text-gray-400"
                        >
                          <div className="inline-flex items-center gap-2">
                            <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                            <span>Loading expenses...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredRelatedExpenses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 sm:px-6 py-6 text-center text-gray-400"
                        >
                          {isExpensesError && relatedExpenses.length === 0
                            ? "Failed to load expenses."
                            : filterPeriod !== "all"
                              ? "No expenses match filters."
                              : "No expenses recorded yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredRelatedExpenses.map((expense, index) => (
                        <tr
                          key={expense.id}
                          className={cn(
                            "border-t border-[#0A4D66]/40",
                            index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-4 sm:px-6 py-3 text-gray-100">
                            {expense.part_name}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            EXP-{expense.id.toString().padStart(5, "0")}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            {expense.expense_category?.name ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            {expense.quantity}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            ₦{expense.unit_cost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            ₦{expense.total_cost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            {new Date(expense.created_at).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            {new Date(expense.created_at).toLocaleTimeString(
                              "en-GB",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-100">
                            {(expense.work_order?.split(" | ")[0] ?? "-") ||
                              "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-right text-gray-100">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                            >
                              <Icon
                                icon="mdi:dots-vertical"
                                className="w-5 h-5"
                              />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {expensesViewMode === "grid" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {isExpensesLoading && relatedExpenses.length === 0
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 space-y-3"
                      >
                        <div className="h-4 w-32 bg-[#021a27] rounded-full animate-pulse" />
                        <div className="h-3 w-40 bg-[#021a27] rounded-full animate-pulse" />
                        <div className="h-3 w-24 bg-[#021a27] rounded-full animate-pulse" />
                      </div>
                    ))
                  : filteredRelatedExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 space-y-2 text-xs sm:text-sm text-gray-200"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {expense.part_name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              EXP-{expense.id.toString().padStart(5, "0")}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p className="text-gray-400">Total Cost</p>
                            <p className="font-semibold text-white">
                              ₦{expense.total_cost.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-400">Category</span>
                          <span className="text-gray-100">
                            {expense.expense_category?.name ?? "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-400">Date</span>
                          <span className="text-gray-100">
                            {new Date(expense.created_at).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                {filteredRelatedExpenses.length === 0 &&
                  !isExpensesLoading &&
                  !isExpensesError && (
                    <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                      {filterPeriod !== "all"
                        ? "No expenses match filters."
                        : "No expenses recorded yet."}
                    </div>
                  )}
                {isExpensesError && !isExpensesLoading && (
                  <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                    Failed to load expenses.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
