import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetFinanceDashboardQuery,
  useGetExpensesQuery,
  useGetBudgetsQuery,
  useGetExpenseCategoriesQuery,
  type FinanceExpense,
  type FinanceBudget,
  type FinanceExpenseCategory,
} from "@/features/finance/api";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";

type FinanceTabKey = "expenses" | "budgets";
type FinanceViewMode = "table" | "grid";
type PeriodFilterKey = "all" | "month" | "quarter" | "year";

type ExpenseRow = {
  id: number;
  expenseId: string;
  date: string;
  createdAt: string;
  category: string;
  categoryId: number;
  partName: string;
  partNumber: string;
  quantity: number;
  unit: string;
  unitId: number;
  expenseType: string;
  unitCost: number;
  totalCost: number;
  budgetId: number;
  budgetName: string;
};

type BudgetRow = {
  id: number;
  name: string;
  category: string;
  categoryId: number;
  aircraft: string;
  unit: string;
  unitId: number;
  amount: number;
  period: string;
  startDate: string;
  endDate: string;
  createdAt: string;
};

export const FinancePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FinanceTabKey>("expenses");

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
  } = useGetBudgetsQuery(undefined, {
    skip: activeTab !== "budgets",
  });
  const { data: expenseCategoriesData } = useGetExpenseCategoriesQuery();
  const { data: unitsData } = useGetUnitsQuery();

  const [expensesViewMode, setExpensesViewMode] =
    useState<FinanceViewMode>("table");
  const [budgetsViewMode, setBudgetsViewMode] =
    useState<FinanceViewMode>("table");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterUnitId, setFilterUnitId] = useState<number | "">("");
  const [filterBudgetId, setFilterBudgetId] = useState<number | "">("");
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilterKey>("all");
  const [openExpenseDetailId, setOpenExpenseDetailId] = useState<number | null>(
    null,
  );
  const [openBudgetActionId, setOpenBudgetActionId] = useState<number | null>(
    null,
  );
  const expensesTableRef = useRef<HTMLDivElement>(null);
  const budgetsTableRef = useRef<HTMLDivElement>(null);

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
      createdAt: expense.created_at,
      category: expense.expense_category?.name ?? "-",
      categoryId: expense.expense_category_id,
      partName: expense.part_name,
      partNumber: expense.part_number,
      quantity: expense.quantity,
      unit: expense.unit?.name ?? "-",
      unitId: expense.unit_id,
      expenseType: expense.expense_type?.name ?? "-",
      unitCost: expense.unit_cost,
      totalCost: expense.total_cost,
      budgetId: expense.budget_id,
      budgetName: expense.budget?.name ?? "-",
    }));
  }, [expensesData]);

  const budgets: BudgetRow[] = useMemo(() => {
    if (!budgetsData) return [];

    return budgetsData.map((budget: FinanceBudget) => ({
      id: budget.id,
      name: budget.name,
      category: budget.budget_category?.name ?? budget.expense_category?.name ?? "-",
      categoryId: budget.budget_category_id ?? budget.expense_category_id ?? 0,
      aircraft: budget.aircraft?.name ?? "-",
      unit: budget.unit?.name ?? "-",
      unitId: budget.unit_id,
      amount: budget.amount,
      period: `${budget.start_date ?? ""} - ${budget.end_date ?? ""}`,
      startDate: budget.start_date,
      endDate: budget.end_date,
      createdAt: budget.created_at,
    }));
  }, [budgetsData]);

  const expenseCategories = (expenseCategoriesData ?? []) as
    | FinanceExpenseCategory[]
    | [];

  const unitOptions = (unitsData ?? []) as Unit[];

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();
    const nowQuarter = Math.floor(nowMonth / 3);

    return expenses.filter((row) => {
      if (filterCategoryId !== "" && row.categoryId !== filterCategoryId) {
        return false;
      }

      if (filterUnitId !== "" && row.unitId !== filterUnitId) {
        return false;
      }

      if (filterBudgetId !== "" && row.budgetId !== filterBudgetId) {
        return false;
      }

      if (filterPeriod !== "all") {
        const rowDate = new Date(row.createdAt);
        const rowMonth = rowDate.getMonth();
        const rowYear = rowDate.getFullYear();
        const rowQuarter = Math.floor(rowMonth / 3);

        if (filterPeriod === "month") {
          if (rowYear !== nowYear || rowMonth !== nowMonth) return false;
        } else if (filterPeriod === "quarter") {
          if (rowYear !== nowYear || rowQuarter !== nowQuarter) return false;
        } else if (filterPeriod === "year") {
          if (rowYear !== nowYear) return false;
        }
      }

      return true;
    });
  }, [expenses, filterBudgetId, filterCategoryId, filterPeriod, filterUnitId]);

  const hasExpenseFilters =
    filterCategoryId !== "" ||
    filterUnitId !== "" ||
    filterBudgetId !== "" ||
    filterPeriod !== "all";

  const filteredBudgets = useMemo(() => {
    const now = new Date();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();
    const nowQuarter = Math.floor(nowMonth / 3);

    return budgets.filter((row) => {
      if (filterCategoryId !== "" && row.categoryId !== filterCategoryId) {
        return false;
      }

      if (filterUnitId !== "" && row.unitId !== filterUnitId) {
        return false;
      }

      if (filterPeriod !== "all") {
        const rowDate = new Date(row.startDate);
        const rowMonth = rowDate.getMonth();
        const rowYear = rowDate.getFullYear();
        const rowQuarter = Math.floor(rowMonth / 3);

        if (filterPeriod === "month") {
          if (rowYear !== nowYear || rowMonth !== nowMonth) return false;
        } else if (filterPeriod === "quarter") {
          if (rowYear !== nowYear || rowQuarter !== nowQuarter) return false;
        } else if (filterPeriod === "year") {
          if (rowYear !== nowYear) return false;
        }
      }

      return true;
    });
  }, [budgets, filterCategoryId, filterPeriod, filterUnitId]);

  const hasBudgetFilters =
    filterCategoryId !== "" || filterUnitId !== "" || filterPeriod !== "all";

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

  useClickOutside(
    expensesTableRef,
    () => setOpenExpenseDetailId(null),
    activeTab === "expenses" && openExpenseDetailId !== null,
  );

  useClickOutside(
    budgetsTableRef,
    () => setOpenBudgetActionId(null),
    activeTab === "budgets" && openBudgetActionId !== null,
  );

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

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-visible min-h-90">
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
              {activeTab === "expenses"
                ? filteredExpenses.length
                : filteredBudgets.length}
            </button>

            {activeTab === "expenses" && (
              <div className="hidden lg:flex items-center gap-2">
                <div className="relative">
                  <select
                    value={
                      filterCategoryId === "" ? "" : String(filterCategoryId)
                    }
                    onChange={(e) =>
                      setFilterCategoryId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 outline-none appearance-none"
                  >
                    <option value="">All Category</option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  />
                </div>

                <div className="relative">
                  <select
                    value={filterUnitId === "" ? "" : String(filterUnitId)}
                    onChange={(e) =>
                      setFilterUnitId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 outline-none appearance-none"
                  >
                    <option value="">All Units</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  />
                </div>

                <div className="relative">
                  <select
                    value={filterBudgetId === "" ? "" : String(filterBudgetId)}
                    onChange={(e) =>
                      setFilterBudgetId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 outline-none appearance-none"
                  >
                    <option value="">All Budget</option>
                    {budgets.map((budget) => (
                      <option key={budget.id} value={budget.id}>
                        {budget.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  />
                </div>

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
              </div>
            )}

            {activeTab === "budgets" && (
              <div className="hidden lg:flex items-center gap-2">
                <div className="relative">
                  <select
                    value={
                      filterCategoryId === "" ? "" : String(filterCategoryId)
                    }
                    onChange={(e) =>
                      setFilterCategoryId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 outline-none appearance-none"
                  >
                    <option value="">All Category</option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  />
                </div>

                <div className="relative">
                  <select
                    value={filterUnitId === "" ? "" : String(filterUnitId)}
                    onChange={(e) =>
                      setFilterUnitId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 outline-none appearance-none"
                  >
                    <option value="">All Units</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  />
                </div>

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
              </div>
            )}

            <button
              type="button"
              className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-gray-300"
            >
              <Icon icon="mdi:download-outline" className="w-4 h-4" />
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
          <div ref={expensesTableRef} className="overflow-x-auto">
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
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-left">Budget</th>
                  <th className="px-4 py-3 text-left">Date</th>
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
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      {isExpensesError && expenses.length === 0
                        ? "Failed to load expenses."
                        : hasExpenseFilters
                          ? "No expenses match filters."
                          : "No expenses recorded yet."}
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-[#0A4D66]/40",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-4 sm:px-6 py-3 align-middle text-gray-100">
                        {row.partName}
                      </td>
                      <td className="px-4 sm:px-6 py-3 align-middle text-gray-100">
                        {row.expenseId}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.category}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        ₦{row.unitCost.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-6 py-3 align-middle text-right text-gray-100">
                        ₦{row.totalCost.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.budgetName}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.date}
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
                          <div className="absolute right-4 top-10 z-20 w-40 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl">
                            <div className="py-1 text-xs text-gray-200">
                              <button
                                type="button"
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
              : filteredExpenses.map((row) => (
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
                      {row.category} • {row.budgetName}
                    </p>
                    <p className="text-[11px] text-gray-400">{row.expenseId}</p>
                    <p className="text-[11px] text-gray-500">{row.date}</p>
                  </div>
                ))}
            {filteredExpenses.length === 0 &&
              !isExpensesLoading &&
              !isExpensesError && (
                <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                  {hasExpenseFilters
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

        {activeTab === "budgets" && budgetsViewMode === "table" && (
          <div ref={budgetsTableRef} className="overflow-x-auto">
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
                  <th className="px-4 py-3 text-left">End Date</th>
                  <th className="px-4 py-3 text-left">Date Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isBudgetsLoading && budgets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                        <span>Loading budgets...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredBudgets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      {isBudgetsError && budgets.length === 0
                        ? "Failed to load budgets."
                        : hasBudgetFilters
                          ? "No budgets match filters."
                          : "No budgets found."}
                    </td>
                  </tr>
                ) : (
                  filteredBudgets.map((budget, index) => (
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
                        {new Date(budget.startDate).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {new Date(budget.endDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {new Date(budget.createdAt).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
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
              : filteredBudgets.map((budget) => (
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
            {filteredBudgets.length === 0 &&
              !isBudgetsLoading &&
              !isBudgetsError && (
                <div className="col-span-full text-center text-gray-400 text-xs sm:text-sm py-6">
                  {hasBudgetFilters
                    ? "No budgets match filters."
                    : "No budgets found."}
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
