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

type BudgetExpenseRow = {
  id: number;
  expenseId: string;
  date: string;
  partName: string;
  partNumber: string;
  workOrder: string;
  quantity: string;
  expenseType: string;
};

const dummyExpenses: BudgetExpenseRow[] = [
  {
    id: 1,
    expenseId: "239809JD",
    date: "26 Jan 2026",
    partName: "Oil Filter",
    partNumber: "PN-98765-AB",
    workOrder: "WO-8821",
    quantity: "1 Unit",
    expenseType: "Patrol",
  },
  {
    id: 2,
    expenseId: "239809JD",
    date: "26 Jan 2026",
    partName: "Tire Assembly",
    partNumber: "PN-98765-AB",
    workOrder: "MAINT-990",
    quantity: "1 Unit",
    expenseType: "Logistics",
  },
  {
    id: 3,
    expenseId: "239809JD",
    date: "26 Jan 2026",
    partName: "Spark Plug",
    partNumber: "PN-98765-AB",
    workOrder: "LOG-223",
    quantity: "1 Unit",
    expenseType: "Escort",
  },
  {
    id: 4,
    expenseId: "239809JD",
    date: "26 Jan 2026",
    partName: "O-Ring",
    partNumber: "PN-98765-AB",
    workOrder: "REC-112",
    quantity: "1 Unit",
    expenseType: "Reconnaissance",
  },
];

export const BudgetInfoPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<BudgetInfoTabKey>("info");

  const { data: budgetsData, isLoading: isBudgetsLoading } = useGetBudgetsQuery();
  const { data: expensesData } = useGetExpensesQuery();

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

  const totalExpenseAmount = useMemo(
    () =>
      relatedExpenses.reduce((sum, expense) => {
        return sum + expense.total_cost;
      }, 0),
    [relatedExpenses],
  );

  const remainingAmount = budget ? budget.amount - totalExpenseAmount : 0;

  const utilisation = budget && budget.amount > 0
    ? (totalExpenseAmount / budget.amount) * 100
    : 0;

  const handleBack = () => {
    navigate("/dashboard/finance");
  };

  const handleEdit = () => {
    navigate("/dashboard/finance/budgets/add");
  };

  const handleAddExpense = () => {
    navigate("/dashboard/finance/add");
  };

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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
                Budget Information
              </span>
              <span className="text-[11px] text-gray-400">
                Budget ID:{` `}BUD-{budget.id.toString().padStart(6, "0")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs sm:text-sm text-gray-200 hover:bg-[#021a27]/80"
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-4">
          <div className="grid gap-3 lg:grid-cols-4 mb-4">
            <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase text-gray-400">Budget</p>
                <p className="text-lg font-semibold text-white">
                  ₦{budget.amount.toLocaleString()}
                </p>
              </div>
              <Icon icon="mdi:wallet-outline" className="w-6 h-6 text-white" />
            </div>
            <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase text-gray-400">
                  Total Expense
                </p>
                <p className="text-lg font-semibold text-white">
                  ₦{totalExpenseAmount.toLocaleString()}
                </p>
              </div>
              <Icon
                icon="mdi:credit-card-outline"
                className="w-6 h-6 text-white"
              />
            </div>
            <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase text-gray-400">
                  Remaining Amount
                </p>
                <p className="text-lg font-semibold text-white">
                  ₦{remainingAmount.toLocaleString()}
                </p>
              </div>
              <Icon icon="mdi:scale-balance" className="w-6 h-6 text-white" />
            </div>
            <div className="h-20 bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase text-gray-400">
                  Utilisation
                </p>
                <p className="text-lg font-semibold text-white">
                  {utilisation.toFixed(1)}%
                </p>
              </div>
              <Icon icon="mdi:percent-outline" className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 border-t border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-t-md border-b-2 border-transparent",
                activeTab === "info"
                  ? "border-[#7FD5FF] text-white"
                  : "text-gray-400 hover:text-white",
              )}
            >
              Budget Information
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("expenses")}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-t-md border-b-2 border-transparent",
                activeTab === "expenses"
                  ? "border-[#7FD5FF] text-white"
                  : "text-gray-400 hover:text-white",
              )}
            >
              Expense Breakdown
            </button>
          </div>

          {activeTab === "expenses" && (
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27]"
              >
                {dummyExpenses.length}
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            </div>
          )}
        </div>

        {activeTab === "info" && (
          <div className="p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                <div className="text-[11px] uppercase text-gray-400 mb-3">
                  Budget Details
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Budget Name:</span>
                    <span className="font-semibold text-white">
                      {budget.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Category:</span>
                    <span className="font-semibold text-white">
                      {budget.expense_category.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Aircraft:</span>
                    <span className="font-semibold text-white">
                      {budget.aircraft.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Unit:</span>
                    <span className="font-semibold text-white">
                      {budget.unit.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                <div className="text-[11px] uppercase text-gray-400 mb-3">
                  Period
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Start Date:</span>
                    <span className="font-semibold text-white">
                      {budget.start_date}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">End Date:</span>
                    <span className="font-semibold text-white">
                      {budget.end_date}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Status:</span>
                    <span className="font-semibold text-emerald-400">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="p-4 sm:p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm text-gray-200">
                <thead>
                  <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 sm:px-6 py-3 text-left">Expense ID</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Part Name</th>
                    <th className="px-4 py-3 text-left">Part No.</th>
                    <th className="px-4 py-3 text-left">Work Order</th>
                    <th className="px-4 py-3 text-left">Quantity</th>
                    <th className="px-4 py-3 text-left">Expense Type</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dummyExpenses.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-[#0A4D66]/40",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-4 sm:px-6 py-3 text-gray-100">
                        {row.expenseId}
                      </td>
                      <td className="px-4 py-3 text-gray-100">{row.date}</td>
                      <td className="px-4 py-3 text-gray-100">
                        {row.partName}
                      </td>
                      <td className="px-4 py-3 text-gray-100">
                        {row.partNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-100">
                        {row.workOrder}
                      </td>
                      <td className="px-4 py-3 text-gray-100">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-3 text-gray-100">
                        {row.expenseType}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right text-gray-100">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                        >
                          <Icon icon="mdi:dots-vertical" className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

