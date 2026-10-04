import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import {
  useGetFinanceDashboardQuery,
  useGetExpensesQuery,
  useGetBudgetsQuery,
  useGetExpenseCategoriesQuery,
  useGetExpenseTypesQuery,
  useGetAircraftQuery,
  useDeleteExpenseMutation,
  useDeleteBudgetMutation,
  useCreateExpenseMutation,
  type FinanceExpense,
  type FinanceBudget,
  type FinanceExpenseCategory,
} from "@/features/finance/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import {
  ImportCsvModal,
  type ImportCsvField,
} from "@/shared/components/ImportCsvModal";

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
  currencySymbol: string;
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

const EXPENSE_IMPORT_FIELDS: ImportCsvField[] = [
  { key: "part_name", label: "Item Description", required: true, example: "Hydraulic Fluid" },
  { key: "part_number", label: "Part Number", required: true, example: "PN-77213" },
  { key: "category", label: "Category", required: false, example: "Consumables" },
  { key: "expense_type", label: "Expense Type", required: true, example: "Maintenance" },
  { key: "aircraft", label: "Aircraft", required: true, example: "Mi-17" },
  { key: "unit", label: "Unit", required: true, example: "1 Squadron" },
  { key: "budget", label: "Budget / Account", required: true, example: "Operations Budget 2026" },
  { key: "work_order", label: "Work Order", required: false, example: "WO-4021" },
  { key: "quantity", label: "Quantity", required: true, example: "5" },
  { key: "unit_cost", label: "Unit Cost", required: true, example: "2500" },
  { key: "date", label: "Date (YYYY-MM-DD)", required: false, example: "2026-02-10" },
];

export const FinancePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
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
  // Always load budgets so the Account selector works on either tab.
  const {
    data: budgetsData,
    isLoading: isBudgetsLoading,
    isError: isBudgetsError,
  } = useGetBudgetsQuery();
  const { data: expenseCategoriesData } = useGetExpenseCategoriesQuery();
  const { data: expenseTypesData } = useGetExpenseTypesQuery();
  const { data: aircraftData } = useGetAircraftQuery();
  const { data: unitsData } = useGetUnitsQuery();
  const [createExpense] = useCreateExpenseMutation();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleImportExpenseRow = async (row: Record<string, string>) => {
    const categoryMatch = row.category
      ? (expenseCategoriesData ?? []).find(
          (c) =>
            c.name.trim().toLowerCase() === row.category.trim().toLowerCase(),
        )
      : undefined;
    if (row.category && !categoryMatch) {
      throw new Error(`Category "${row.category}" not found`);
    }

    const expenseTypeMatch = (expenseTypesData ?? []).find(
      (t) =>
        t.name.trim().toLowerCase() === row.expense_type.trim().toLowerCase(),
    );
    if (!expenseTypeMatch) {
      throw new Error(`Expense type "${row.expense_type}" not found`);
    }

    const aircraftMatch = (aircraftData ?? []).find(
      (a) => a.name.trim().toLowerCase() === row.aircraft.trim().toLowerCase(),
    );
    if (!aircraftMatch) {
      throw new Error(`Aircraft "${row.aircraft}" not found`);
    }

    const unitMatch = (unitsData ?? []).find(
      (u) => u.name.trim().toLowerCase() === row.unit.trim().toLowerCase(),
    );
    if (!unitMatch) {
      throw new Error(`Unit "${row.unit}" not found`);
    }

    const budgetMatch = (budgetsData ?? []).find(
      (b) => b.name.trim().toLowerCase() === row.budget.trim().toLowerCase(),
    );
    if (!budgetMatch) {
      throw new Error(`Budget "${row.budget}" not found`);
    }

    const quantity = Number(row.quantity);
    const unitCost = Number(row.unit_cost);
    if (Number.isNaN(quantity) || Number.isNaN(unitCost)) {
      throw new Error("Quantity and Unit Cost must be numbers");
    }

    await createExpense({
      expense_category_id: categoryMatch?.id,
      expense_type_id: expenseTypeMatch.id,
      aircraft_id: aircraftMatch.id,
      unit_id: unitMatch.id,
      budget_id: budgetMatch.id,
      part_number: row.part_number,
      part_name: row.part_name,
      work_order: row.work_order || "",
      quantity,
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
      date: row.date || undefined,
    }).unwrap();
  };

  const [selectedAccountId, setSelectedAccountId] = useState<
    number | null | "default"
  >("default");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const resolvedSelectedAccountId =
    selectedAccountId === "default" ? (budgetsData?.[0]?.id ?? null) : selectedAccountId;

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
  const [activeExpenseId, setActiveExpenseId] = useState<number | null>(null);
  const [isExportingExpensePdf, setIsExportingExpensePdf] = useState(false);
  const [openBudgetActionId, setOpenBudgetActionId] = useState<number | null>(
    null,
  );
  const expensesTableRef = useRef<HTMLDivElement>(null);
  const budgetsTableRef = useRef<HTMLDivElement>(null);
  const expenseSliderRef = useRef<HTMLDivElement>(null);

  const summaryCards = useMemo(() => {
    const selected =
      resolvedSelectedAccountId != null
        ? (budgetsData ?? []).find((b) => b.id === resolvedSelectedAccountId)
        : undefined;

    const symbol =
      selected?.currency?.symbol || selected?.currency?.code || "₦";

    const fmtCurrency = (value: number | string | undefined | null) => {
      const n = typeof value === "string" ? Number(value) : (value ?? null);
      if (n == null || Number.isNaN(n)) return `${symbol}—`;
      return `${symbol}${n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    };

    if (selected) {
      const allocated = Number(selected.amount ?? 0);
      const totalIncome = Number(selected.total_income ?? 0);
      const totalExpense = Number(selected.total_expense ?? 0);
      const remaining =
        selected.remaining_amount != null
          ? Number(selected.remaining_amount)
          : allocated + totalIncome - totalExpense;

      return [
        {
          id: "allocated",
          label: "Total Amount Received",
          value: fmtCurrency(allocated),
          icon: "mdi:wallet-outline",
        },
        {
          id: "income",
          label: "Allocated amount",
          value: fmtCurrency(totalIncome),
          icon: "mdi:cash-plus",
        },
        {
          id: "expense",
          label: "Total Expense",
          value: fmtCurrency(totalExpense),
          icon: "mdi:cash-minus",
        },
        {
          id: "available",
          label: "Available",
          value: fmtCurrency(remaining),
          icon: "mdi:scale-balance",
        },
      ];
    }

    return [
      {
        id: "total_expense",
        label: "Total Expense",
        value: fmtCurrency(dashboard?.total_expense),
        icon: "mdi:credit-card-outline",
      },
      {
        id: "monthly",
        label: "Monthly",
        value: fmtCurrency(dashboard?.current_month_expense),
        icon: "mdi:calendar-month-outline",
      },
      {
        id: "quarterly",
        label: "Quarterly",
        value: fmtCurrency(dashboard?.current_quarter_expense),
        icon: "mdi:calendar-blank-outline",
      },
      {
        id: "accounts",
        label: "Accounts",
        value: fmtCurrency(dashboard?.budget),
        icon: "mdi:bank-outline",
      },
    ];
  }, [dashboard, resolvedSelectedAccountId, budgetsData]);

  const expenses: ExpenseRow[] = useMemo(() => {
    if (!expensesData) return [];

    return expensesData.map((expense: FinanceExpense) => {
      const expenseDateSource = expense.date || expense.created_at;

      return {
        id: expense.id,
        expenseId: `EXP-${expense.id.toString().padStart(5, "0")}`,
        date: new Date(expenseDateSource).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        createdAt: expenseDateSource,
        category: expense.expense_category?.name ?? "-",
        categoryId: expense.expense_category_id,
        partName: expense.part_name,
        partNumber: expense.part_number,
        quantity: expense.quantity,
        unit: expense.unit?.name ?? "-",
        unitId: expense.unit_id,
        expenseType: expense.expense_type?.name ?? "-",
        currencySymbol:
          expense.budget?.currency?.symbol ?? expense.budget?.currency?.code ?? "₦",
        unitCost: expense.unit_cost,
        totalCost: expense.total_cost,
        budgetId: expense.budget_id,
        budgetName: expense.budget?.name ?? "-",
      };
    });
  }, [expensesData]);

  useEffect(() => {
    const routeState = location.state as
      | {
          activeTab?: FinanceTabKey;
          expenseId?: number;
        }
      | undefined;

    if (!routeState) return;

    if (routeState.activeTab === "expenses" || routeState.activeTab === "budgets") {
      setActiveTab(routeState.activeTab);
    }

    if (typeof routeState.expenseId === "number") {
      setActiveExpenseId(routeState.expenseId);
      setOpenExpenseDetailId(null);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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

  const [deleteExpense] = useDeleteExpenseMutation();
  const [deleteBudget] = useDeleteBudgetMutation();

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm("Delete this expense? This action cannot be undone.")) return;
    try {
      await deleteExpense(id).unwrap();
      dispatch(showToast({ message: "Expense deleted successfully", type: "success" }));
      setOpenExpenseDetailId(null);
    } catch {
      dispatch(showToast({ message: "Failed to delete expense", type: "error" }));
    }
  };

  const handleDeleteBudget = async (id: number) => {
    if (!window.confirm("Delete this budget? This action cannot be undone.")) return;
    try {
      await deleteBudget(id).unwrap();
      dispatch(showToast({ message: "Budget deleted successfully", type: "success" }));
      setOpenBudgetActionId(null);
    } catch {
      dispatch(showToast({ message: "Failed to delete budget", type: "error" }));
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

  useClickOutside(accountMenuRef, () => setAccountMenuOpen(false), accountMenuOpen);

  const selectedAccount = useMemo(
    () =>
      resolvedSelectedAccountId != null
        ? (budgetsData ?? []).find((b) => b.id === resolvedSelectedAccountId) ?? null
        : null,
    [resolvedSelectedAccountId, budgetsData],
  );

  const activeExpense = useMemo(
    () => (expensesData ?? []).find((expense) => expense.id === activeExpenseId),
    [activeExpenseId, expensesData],
  );

  const activeExpenseRow = useMemo(
    () => expenses.find((expense) => expense.id === activeExpenseId),
    [activeExpenseId, expenses],
  );

  const handleGenerateReport = () => {
    if (resolvedSelectedAccountId == null) {
      dispatch(
        showToast({
          message: "Select an account to generate its statement",
          type: "info",
        }),
      );
      return;
    }
    navigate(`/dashboard/finance/budgets/${resolvedSelectedAccountId}/statement`);
  };

  const handleViewBudget = (id: number) => {
    navigate(`/dashboard/finance/budgets/${id}`);
  };

  const handleViewExpense = (id: number) => {
    setActiveExpenseId(id);
    setOpenExpenseDetailId(null);
  };

  const handleEditExpense = (id: number) => {
    const expenseToEdit = (expensesData ?? []).find((expense) => expense.id === id);

    if (!expenseToEdit) {
      dispatch(showToast({ message: "Expense record not found", type: "error" }));
      return;
    }

    setOpenExpenseDetailId(null);
    setActiveExpenseId(null);

    navigate("/dashboard/finance/add", {
      state: {
        mode: "edit",
        expense: expenseToEdit,
      },
    });
  };

  const handleDownloadExpensePdf = async () => {
    if (!activeExpenseRow || !expenseSliderRef.current) return;

    try {
      setIsExportingExpensePdf(true);
      await downloadElementAsPdf({
        element: expenseSliderRef.current,
        fileName: `expense-${activeExpenseRow.expenseId}`,
      });
      dispatch(showToast({ message: "Expense PDF exported", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to export expense PDF", type: "error" }));
    } finally {
      setIsExportingExpensePdf(false);
    }
  };

  return (
    <div className="px-2 sm:px-0">
      {/* Account selector + report */}
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" ref={accountMenuRef}>
          <span className="text-[11px] sm:text-xs uppercase tracking-wide text-gray-400">
            Account:
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-[#0A4D66]/50 bg-[#001219] px-3 py-1.5 text-xs sm:text-sm text-white hover:bg-[#0A4D66]/20"
            >
              <Icon icon="mdi:bank-outline" className="w-4 h-4 text-[#7FD5FF]" />
              <span>
                {selectedAccount
                  ? `${selectedAccount.name}${selectedAccount.currency?.code ? ` (${selectedAccount.currency.code})` : ""}`
                  : "All Accounts"}
              </span>
              <Icon icon="mdi:chevron-down" className="w-4 h-4 text-gray-400" />
            </button>

            {accountMenuOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-[#0A4D66]/50 bg-[#001219] shadow-xl max-h-80 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(null);
                    setAccountMenuOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-[#0A4D66]/30",
                    resolvedSelectedAccountId == null
                      ? "text-[#7FD5FF]"
                      : "text-gray-200",
                  )}
                >
                  All Accounts (overview)
                </button>
                {isBudgetsLoading && (budgetsData ?? []).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
                ) : (budgetsData ?? []).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    No accounts yet.
                  </div>
                ) : (
                  (budgetsData ?? []).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(b.id);
                        setAccountMenuOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-[#0A4D66]/30 flex items-center justify-between gap-2",
                        resolvedSelectedAccountId === b.id
                          ? "text-[#7FD5FF]"
                          : "text-gray-200",
                      )}
                    >
                      <span className="truncate">{b.name}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {b.currency?.code ?? ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={resolvedSelectedAccountId == null}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors",
              resolvedSelectedAccountId == null
                ? "bg-[#0A4D66]/30 text-gray-400 cursor-not-allowed"
                : "bg-emerald-500 text-black hover:bg-emerald-600",
            )}
            title={
              resolvedSelectedAccountId == null
                ? "Select an account to generate a statement"
                : "Generate account statement"
            }
          >
            <Icon icon="mdi:file-document-outline" className="w-4 h-4" />
            <span>Generate Report</span>
          </button>

          {activeTab === "expenses" && (
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold border border-[#0A4D66]/40 text-gray-200 hover:text-white hover:border-[#7FD5FF]/50 transition-colors"
            >
              <Icon icon="mdi:upload" className="w-4 h-4" />
              <span>Import CSV</span>
            </button>
          )}

          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded bg-[#0369A1] text-white text-xs sm:text-sm font-medium hover:bg-[#0369A1]/90 transition-colors"
            onClick={handleOpenPrimaryAction}
          >
            <Icon icon="mdi:plus" className="w-4 h-4" />
            <span>
              {activeTab === "budgets" ? "Add Account" : "Add Expense"}
            </span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {isDashboardLoading
          ? summaryCards.map((card) => (
              <div
                key={card.id}
                className="h-24 sm:h-28 bg-[#001219] border border-[#0A4D66]/40 rounded-xl flex items-center justify-between px-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 bg-[#001219] rounded-full animate-pulse" />
                  <div className="h-6 w-20 bg-[#001219] rounded-full animate-pulse" />
                </div>
                <div className="w-10 h-10 rounded bg-[#001219] animate-pulse" />
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
                <div className="w-10 h-10 rounded bg-[#001219] flex items-center justify-center">
                  <Icon icon={card.icon} className="w-5 h-5 text-white" />
                </div>
              </div>
            ))}
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-visible min-h-90">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#001219]">
          <div className="flex flex-wrap items-center gap-4">
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
                Expenses
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
                Accounts
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#001219] p-1">
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200"
            >
              {activeTab === "expenses"
                ? filteredExpenses.length
                : filteredBudgets.length}
            </button>

            {activeTab === "expenses" && (
              <div className="hidden lg:flex flex-wrap items-center gap-2">
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
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 outline-none appearance-none"
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
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 outline-none appearance-none"
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
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 outline-none appearance-none"
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
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 outline-none appearance-none"
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
              <div className="hidden lg:flex flex-wrap items-center gap-2">
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
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 outline-none appearance-none"
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
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 outline-none appearance-none"
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
                    className="h-8 pl-3 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 outline-none appearance-none"
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

          </div>
        </div>

        {activeTab === "expenses" && expensesViewMode === "table" && (
          <div ref={expensesTableRef} className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-gray-200">
              <thead>
                <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
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
                      <td className="px-4 sm:px-6 py-3 align-middle text-white">
                        {row.partName}
                      </td>
                      <td className="px-4 sm:px-6 py-3 align-middle text-white">
                        {row.expenseId}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {row.category}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {row.currencySymbol}
                        {row.unitCost.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-6 py-3 align-middle text-right text-white">
                        {row.currencySymbol}
                        {row.totalCost.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {row.budgetName}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
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
                                onClick={() => handleViewExpense(row.id)}
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
                                onClick={() => handleEditExpense(row.id)}
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
                                onClick={() => handleDeleteExpense(row.id)}
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
                    <div className="h-4 w-32 bg-[#001219] rounded-full animate-pulse" />
                    <div className="h-3 w-40 bg-[#001219] rounded-full animate-pulse" />
                    <div className="h-3 w-24 bg-[#001219] rounded-full animate-pulse" />
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
                          {row.currencySymbol}
                          {row.totalCost.toLocaleString()}
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
                <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
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
                      <td className="px-4 sm:px-6 py-3 align-middle text-white">
                        {`BUD-${budget.id.toString().padStart(5, "0")}`}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {budget.name}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {budget.category}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        ₦{budget.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        ₦{budget.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        Active
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {new Date(budget.startDate).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {new Date(budget.endDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
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
                                onClick={() => handleDeleteBudget(budget.id)}
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
                    <div className="h-4 w-32 bg-[#001219] rounded-full animate-pulse" />
                    <div className="h-3 w-40 bg-[#001219] rounded-full animate-pulse" />
                    <div className="h-3 w-24 bg-[#001219] rounded-full animate-pulse" />
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

      {activeExpenseId !== null && activeExpenseRow && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setActiveExpenseId(null)}
            aria-hidden="true"
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-[#001219] border-l border-[#0A4D66]/50 shadow-2xl overflow-y-auto">
            <div ref={expenseSliderRef} className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">
                    Expense Details
                  </p>
                  <h2 className="text-lg font-semibold text-white mt-1">
                    {activeExpenseRow.partName}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">{activeExpenseRow.expenseId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveExpenseId(null)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-300 hover:bg-[#0A4D66]/40"
                >
                  <Icon icon="mdi:close" className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-lg border border-[#0A4D66]/40 bg-[#001825] divide-y divide-[#0A4D66]/30">
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Category</span>
                  <span className="text-white">{activeExpenseRow.category}</span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Budget</span>
                  <span className="text-white">{activeExpenseRow.budgetName}</span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Quantity</span>
                  <span className="text-white">{activeExpenseRow.quantity}</span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Unit Cost</span>
                  <span className="text-white">
                    {activeExpenseRow.currencySymbol}
                    {activeExpenseRow.unitCost.toLocaleString()}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total Cost</span>
                  <span className="text-white font-semibold">
                    {activeExpenseRow.currencySymbol}
                    {activeExpenseRow.totalCost.toLocaleString()}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Date</span>
                  <span className="text-white">{activeExpenseRow.date}</span>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-gray-400 mb-1">Work Order / Remark</p>
                  <p className="text-white wrap-break-word">{activeExpense?.work_order || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleEditExpense(activeExpenseRow.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0369A1] px-3 py-2 text-sm font-medium text-white hover:bg-[#0369A1]/90"
                >
                  <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExpensePdf}
                  disabled={isExportingExpensePdf}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-black hover:bg-emerald-600",
                    isExportingExpensePdf && "opacity-70 cursor-not-allowed",
                  )}
                >
                  <Icon icon="mdi:file-pdf-box" className="w-4 h-4" />
                  <span>{isExportingExpensePdf ? "Exporting..." : "Download PDF"}</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      <ImportCsvModal
        open={isImportOpen}
        title="Import Expenses from CSV"
        fields={EXPENSE_IMPORT_FIELDS}
        sampleFileName="expenses-import-sample.csv"
        onImportRow={handleImportExpenseRow}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
};
