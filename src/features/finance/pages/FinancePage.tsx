import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetFinanceDashboardQuery,
  useGetExpensesQuery,
  useGetBudgetsQuery,
  type FinanceExpense,
  type FinanceBudget,
} from "@/features/finance/api";

type FinanceTabKey = "expenses" | "budgets";
type FinanceViewMode = "table" | "grid";

type ExpenseRow = {
  id: number;
  expenseId: string;
  date: string;
  category: string;
  partName: string;
  partNumber: string;
  aircraft: string;
  workOrder: string;
  quantity: number;
  unit: string;
  expenseType: string;
  unitCost: number;
  totalCost: number;
};

type BudgetRow = {
  id: number;
  name: string;
  category: string;
  aircraft: string;
  unit: string;
  amount: number;
  period: string;
};

export const FinancePage = () => {
  const navigate = useNavigate();
  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
  } = useGetFinanceDashboardQuery();
  const {
    data: expensesData,
    isLoading: isExpensesLoading,
    isError: isExpensesError,
  } = useGetExpensesQuery();
  const {
    data: budgetsData,
    isLoading: isBudgetsLoading,
    isError: isBudgetsError,
  } = useGetBudgetsQuery();

  const [activeTab, setActiveTab] = useState<FinanceTabKey>("expenses");
  const [expensesViewMode, setExpensesViewMode] =
    useState<FinanceViewMode>("table");
  const [budgetsViewMode, setBudgetsViewMode] =
    useState<FinanceViewMode>("table");
  const [openExpenseDetailId, setOpenExpenseDetailId] = useState<number | null>(
    null,
  );
  const [openBudgetActionId, setOpenBudgetActionId] = useState<number | null>(
    null,
  );

  const summaryCards = useMemo(() => {
    const formatCurrency = (value: number | undefined) =>
      typeof value === "number" ? `₦${value.toLocaleString()}` : "₦—";

    return [
      {
        id: "total_expense",
        label: "Total Expense",
        value: formatCurrency(dashboard?.total_expense),
        icon: "mdi:credit-card-outline",
      },
      {
        id: "monthly",
        label: "Monthly",
        value: formatCurrency(dashboard?.current_month_expense),
        icon: "mdi:calendar-month-outline",
      },
      {
        id: "quarterly",
        label: "Quarterly",
        value: formatCurrency(dashboard?.current_quarter_expense),
        icon: "mdi:calendar-blank-outline",
      },
      {
        id: "budget",
        label: "Budget",
        value: formatCurrency(dashboard?.budget),
        icon: "mdi:wallet-outline",
      },
    ];
  }, [dashboard]);

  const expenses: ExpenseRow[] = useMemo(() => {
    if (!expensesData) return [];

    return expensesData.map((expense: FinanceExpense) => ({
      id: expense.id,
      expenseId: `EXP-${expense.id.toString().padStart(5, "0")}`,
      date: new Date(expense.created_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      category: expense.expense_category.name,
      partName: expense.part_name,
      partNumber: expense.part_number,
      aircraft: expense.aircraft.name,
      workOrder: expense.work_order,
      quantity: expense.quantity,
      unit: expense.unit.name,
      expenseType: expense.expense_type.name,
      unitCost: expense.unit_cost,
      totalCost: expense.total_cost,
    }));
  }, [expensesData]);

  const budgets: BudgetRow[] = useMemo(() => {
    if (!budgetsData) return [];

    return budgetsData.map((budget: FinanceBudget) => ({
      id: budget.id,
      name: budget.name,
      category: budget.expense_category.name,
      aircraft: budget.aircraft.name,
      unit: budget.unit.name,
      amount: budget.amount,
      period: `${budget.start_date} - ${budget.end_date}`,
    }));
  }, [budgetsData]);

  const isSummaryError = isDashboardError;

  const handleOpenPrimaryAction = () => {
    if (activeTab === "budgets") {
      navigate("/dashboard/finance/budgets/add");
    } else {
      navigate("/dashboard/finance/add");
    }
  };

  const handleToggleExpenseDetail = (id: number) => {
    setOpenExpenseDetailId((current) => (current === id ? null : id));
  };

  const handleToggleBudgetActions = (id: number) => {
    setOpenBudgetActionId((current) => (current === id ? null : id));
  };

  const handleViewBudget = (id: number) => {
    navigate(`/dashboard/finance/budgets/${id}`);
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {isDashboardLoading
          ? summaryCards.map((card) => (
              <div
                key={card.id}
                className="h-24 sm:h-28 bg-[#001219] border border-[#0A4D66]/40 rounded-xl flex items-center justify-between px-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 bg-[#021a27] rounded-full animate-pulse" />
                  <div className="h-6 w-20 bg-[#021a27] rounded-full animate-pulse" />
                </div>
                <div className="w-10 h-10 rounded bg-[#021a27] animate-pulse" />
              </div>
            ))
          : summaryCards.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "h-24 sm:h-28 rounded-xl flex items-center justify-between px-4 border border-[#0A4D66]/40",
                  "bg-[#001219]",
                )}
              >
                <div>
                  <p className="text-[11px] sm:text-xs uppercase tracking-wide text-gray-400">
                    {card.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-semibold text-white mt-1">
                    {isSummaryError ? "₦—" : card.value}
                  </p>
                </div>
                <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
                  <Icon icon={card.icon} className="w-5 h-5 text-white" />
                </div>
              </div>
            ))}
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-visible min-h-[360px]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("expenses")}
                className={cn(
                  "px-3 py-1.5 text-xs sm:text-sm rounded-md border border-transparent",
                  activeTab === "expenses"
                    ? "bg-[#0A4D66] text-white border-[#0A4D66]"
                    : "text-gray-300",
                )}
              >
                Finances
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("budgets")}
                className={cn(
                  "px-3 py-1.5 text-xs sm:text-sm rounded-md border border-transparent",
                  activeTab === "budgets"
                    ? "bg-[#0A4D66] text-white border-[#0A4D66]"
                    : "text-gray-300",
                )}
              >
                Budget
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#021a27] p-1">
              <button
                type="button"
                onClick={() =>
                  activeTab === "expenses"
                    ? setExpensesViewMode("table")
                    : setBudgetsViewMode("table")
                }
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded text-gray-300",
                  (activeTab === "expenses"
                    ? expensesViewMode === "table"
                    : budgetsViewMode === "table") && "bg-[#0A4D66] text-white",
                )}
              >
                <Icon icon="mdi:view-list-outline" className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  activeTab === "expenses"
                    ? setExpensesViewMode("grid")
                    : setBudgetsViewMode("grid")
                }
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded text-gray-300",
                  (activeTab === "expenses"
                    ? expensesViewMode === "grid"
                    : budgetsViewMode === "grid") && "bg-[#0A4D66] text-white",
                )}
              >
                <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200"
            >
              {activeTab === "expenses" ? expenses.length : budgets.length}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
              onClick={handleOpenPrimaryAction}
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>
                {activeTab === "budgets" ? "Add Budget" : "Add Finance"}
              </span>
            </button>
          </div>
        </div>

        {activeTab === "expenses" && expensesViewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-gray-200">
              <thead>
                <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 sm:px-6 py-3 text-left">Expense ID</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Part Name</th>
                  <th className="px-4 py-3 text-left">Part No.</th>
                  <th className="px-4 py-3 text-left">Aircraft</th>
                  <th className="px-4 py-3 text-left">Work Order</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isExpensesLoading && expenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                        <span>Loading expenses...</span>
                      </div>
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      {isExpensesError
                        ? "Failed to load expenses."
                        : "No expenses recorded yet."}
                    </td>
                  </tr>
                ) : (
                  expenses.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-[#0A4D66]/40",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-4 sm:px-6 py-3 align-middle text-gray-100">
                        {row.expenseId}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.date}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.category}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.partName}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.partNumber}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.aircraft}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.workOrder}
                      </td>
                      <td className="px-4 sm:px-6 py-3 align-middle text-right text-gray-100">
                        ₦{row.totalCost.toLocaleString()}
                      </td>
                      <td className="relative px-4 sm:px-6 py-3 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleExpenseDetail(row.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                        >
                          <Icon icon="mdi:dots-vertical" className="w-5 h-5" />
                        </button>

                        {openExpenseDetailId === row.id && (
                          <div className="absolute right-4 top-10 z-20 w-72 sm:w-80 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl text-xs sm:text-sm text-gray-200">
                            <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[11px] text-gray-400">
                                  Expense ID {row.expenseId}
                                </p>
                                <p className="text-sm font-semibold text-white">
                                  {row.partName}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 text-gray-300">
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[#021a27]"
                                >
                                  <Icon
                                    icon="mdi:download-outline"
                                    className="w-4 h-4"
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[#021a27]"
                                >
                                  <Icon
                                    icon="mdi:printer-outline"
                                    className="w-4 h-4"
                                  />
                                </button>
                              </div>
                            </div>
                            <div className="px-4 py-3 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">Date:</span>
                                <span className="font-semibold">
                                  {row.date}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">Category:</span>
                                <span className="font-semibold">
                                  {row.category}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">
                                  Work Order:
                                </span>
                                <span className="font-semibold">
                                  {row.workOrder}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">Quantity:</span>
                                <span className="font-semibold">
                                  {row.quantity} {row.unit}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">
                                  Expense Type:
                                </span>
                                <span className="font-semibold">
                                  {row.expenseType}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">
                                  Unit Cost:
                                </span>
                                <span className="font-semibold">
                                  ₦{row.unitCost.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">
                                  Total Cost:
                                </span>
                                <span className="font-semibold">
                                  ₦{row.totalCost.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div className="px-4 py-2 border-t border-[#0A4D66]/40 flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-gray-200 hover:text-white"
                                >
                                  <Icon
                                    icon="mdi:eye-outline"
                                    className="w-4 h-4"
                                  />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-gray-200 hover:text-white"
                                >
                                  <Icon
                                    icon="mdi:pencil-outline"
                                    className="w-4 h-4"
                                  />
                                  <span>Edit</span>
                                </button>
                              </div>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
                              >
                                <Icon
                                  icon="mdi:trash-can-outline"
                                  className="w-4 h-4"
                                />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "expenses" && expensesViewMode === "grid" && (
          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isExpensesLoading && expenses.length === 0
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
              : expenses.map((row) => (
                  <div
                    key={row.id}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 space-y-2 text-xs sm:text-sm text-gray-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {row.partName}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {row.partNumber} • {row.expenseId}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-gray-400">Total Cost</p>
                        <p className="font-semibold text-white">
                          ₦{row.totalCost.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {row.category} • {row.aircraft}
                    </p>
                    <p className="text-[11px] text-gray-400">{row.workOrder}</p>
                    <p className="text-[11px] text-gray-500">{row.date}</p>
                  </div>
                ))}
            {expenses.length === 0 &&
              !isExpensesLoading &&
              !isExpensesError && (
                <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                  No expenses recorded yet.
                </div>
              )}
            {isExpensesError && !isExpensesLoading && (
              <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                Failed to load expenses.
              </div>
            )}
          </div>
        )}

        {activeTab === "budgets" && budgetsViewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-gray-200">
              <thead>
                <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 sm:px-6 py-3 text-left">Budget ID</th>
                  <th className="px-4 py-3 text-left">Budget Name</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Allocated Budget</th>
                  <th className="px-4 py-3 text-left">Remaining Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Start Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isBudgetsLoading && budgets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                        <span>Loading budgets...</span>
                      </div>
                    </td>
                  </tr>
                ) : budgets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      {isBudgetsError
                        ? "Failed to load budgets."
                        : "No budgets found."}
                    </td>
                  </tr>
                ) : (
                  budgets.map((budget, index) => (
                    <tr
                      key={budget.id}
                      className={cn(
                        "border-t border-[#0A4D66]/40",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-4 sm:px-6 py-3 align-middle text-gray-100">
                        {`BUD-${budget.id.toString().padStart(5, "0")}`}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {budget.name}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {budget.category}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        ₦{budget.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        ₦{budget.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        Active
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {budget.period.split(" - ")[0]}
                      </td>
                      <td className="relative px-4 sm:px-6 py-3 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleBudgetActions(budget.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                        >
                          <Icon icon="mdi:dots-vertical" className="w-5 h-5" />
                        </button>

                        {openBudgetActionId === budget.id && (
                          <div className="absolute right-4 top-10 z-20 w-40 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl">
                            <div className="py-1 text-xs text-gray-200">
                              <button
                                type="button"
                                onClick={() => handleViewBudget(budget.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:eye-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:pencil-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:download-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>Download</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400"
                              >
                                <Icon
                                  icon="mdi:trash-can-outline"
                                  className="w-4 h-4"
                                />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "budgets" && budgetsViewMode === "grid" && (
          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isBudgetsLoading && budgets.length === 0
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
              : budgets.map((budget) => (
                  <div
                    key={budget.id}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 space-y-2 text-xs sm:text-sm text-gray-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {budget.name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {budget.category} • {budget.unit}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-gray-400">Amount</p>
                        <p className="font-semibold text-white">
                          ₦{budget.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {budget.aircraft}
                    </p>
                    <p className="text-[11px] text-gray-400">{budget.period}</p>
                  </div>
                ))}
            {budgets.length === 0 && !isBudgetsLoading && !isBudgetsError && (
              <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                No budgets found.
              </div>
            )}
            {isBudgetsError && !isBudgetsLoading && (
              <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                Failed to load budgets.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
