import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { useGetBudgetStatementQuery } from "@/features/finance/api";

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const BudgetStatementPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const {
    data: statement,
    isLoading,
    isError,
  } = useGetBudgetStatementQuery(id ?? "", { skip: !id });

  const currencySymbol =
    statement?.budget?.currency?.symbol ||
    statement?.budget?.currency?.code ||
    "₦";

  const fmtMoney = useMemo(
    () => (n: number | string | undefined | null) => {
      const v = typeof n === "string" ? Number(n) : (n ?? 0);
      if (Number.isNaN(v)) return `${currencySymbol}—`;
      return `${currencySymbol}${v.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [currencySymbol],
  );

  const handleBack = () => navigate(-1);
  const handlePrint = () => window.print();

  if (!id || isError) {
    return (
      <div className="px-2 sm:px-0">
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-center text-gray-400">
          Failed to load statement.
        </div>
      </div>
    );
  }

  if (isLoading || !statement) {
    return (
      <div className="px-2 sm:px-0">
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-center text-gray-400">
          Loading statement...
        </div>
      </div>
    );
  }

  const { budget, incomes, expenses, totals, generated_at } = statement;

  return (
    <div className="px-2 sm:px-0 print:px-0 print:bg-white">
      {/* Toolbar - hidden when printing */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/50 text-gray-200 text-xs sm:text-sm hover:bg-[#0A4D66]/20"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500 text-black text-xs sm:text-sm font-semibold hover:bg-emerald-600"
        >
          <Icon icon="mdi:printer-outline" className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      <section
        className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 sm:p-8 text-gray-200 print:bg-white print:text-black print:border-0 print:shadow-none"
        id="statement-printable"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#0A4D66]/40 pb-4 mb-6 print:border-gray-300">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white print:text-black">
              Account Statement
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 print:text-gray-700">
              {budget.name}
            </p>
          </div>
          <div className="text-right text-[11px] sm:text-xs text-gray-400 print:text-gray-700">
            <p>Generated: {formatDate(generated_at)}</p>
            <p>Account ID: BUD-{String(budget.id).padStart(5, "0")}</p>
          </div>
        </div>

        {/* Account info */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-xs sm:text-sm">
          <div>
            <p className="text-[11px] uppercase text-gray-400 print:text-gray-600">
              Currency
            </p>
            <p className="font-semibold text-white print:text-black">
              {budget.currency?.code ?? "—"}{" "}
              {budget.currency?.symbol ? `(${budget.currency.symbol})` : ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-gray-400 print:text-gray-600">
              Category
            </p>
            <p className="font-semibold text-white print:text-black">
              {budget.budget_category?.name ?? "-"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-gray-400 print:text-gray-600">
              Period
            </p>
            <p className="font-semibold text-white print:text-black">
              {formatDate(budget.start_date)} → {formatDate(budget.end_date)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-gray-400 print:text-gray-600">
              Unit
            </p>
            <p className="font-semibold text-white print:text-black">
              {budget.unit?.name ?? "-"}
            </p>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Amount Received", value: totals.allocated, color: "text-white" },
            {
              label: "Allocated amount",
              value: totals.total_income,
              color: "text-emerald-300",
            },
            {
              label: "Total Expense",
              value: totals.total_expense,
              color: "text-red-300",
            },
            {
              label: "Available",
              value: totals.available,
              color: "text-[#7FD5FF]",
            },
          ].map((t) => (
            <div
              key={t.label}
              className="rounded-lg border border-[#0A4D66]/40 bg-[#001825] p-3 print:bg-white print:border-gray-300"
            >
              <p className="text-[11px] uppercase text-gray-400 print:text-gray-600">
                {t.label}
              </p>
              <p
                className={`mt-1 text-base sm:text-lg font-semibold ${t.color} print:text-black`}
              >
                {fmtMoney(t.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Incomes */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white print:text-black mb-2">
            Incoming Funds
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[#0A4D66]/40 print:border-gray-300">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#001825] uppercase text-[11px] text-gray-400 print:bg-gray-100 print:text-gray-700 border-b border-[#0A4D66]/40 print:border-gray-300">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-gray-400 print:text-gray-600"
                    >
                      No income recorded.
                    </td>
                  </tr>
                ) : (
                  incomes.map((inc, idx) => (
                    <tr
                      key={inc.id}
                      className={
                        idx % 2 === 0
                          ? "bg-[#001219] print:bg-white"
                          : "bg-[#001825] print:bg-gray-50"
                      }
                    >
                      <td className="px-3 py-2 text-gray-200 print:text-black">
                        {formatDate(inc.received_at)}
                      </td>
                      <td className="px-3 py-2 text-white print:text-black">
                        {inc.source}
                      </td>
                      <td className="px-3 py-2 text-gray-300 print:text-gray-700">
                        {inc.reference || "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-300 print:text-gray-700">
                        {inc.description || "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-300 print:text-black font-medium">
                        {fmtMoney(inc.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#0A4D66]/40 print:border-gray-300">
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right font-semibold text-gray-300 print:text-black"
                  >
                    Total Income
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-300 print:text-black">
                    {fmtMoney(totals.total_income)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Expenses */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white print:text-black mb-2">
            Expenses
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[#0A4D66]/40 print:border-gray-300">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#001825] uppercase text-[11px] text-gray-400 print:bg-gray-100 print:text-gray-700 border-b border-[#0A4D66]/40 print:border-gray-300">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Unit Cost</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-gray-400 print:text-gray-600"
                    >
                      No expenses recorded.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp, idx) => (
                    <tr
                      key={exp.id}
                      className={
                        idx % 2 === 0
                          ? "bg-[#001219] print:bg-white"
                          : "bg-[#001825] print:bg-gray-50"
                      }
                    >
                      <td className="px-3 py-2 text-gray-200 print:text-black">
                        {formatDate(exp.created_at)}
                      </td>
                      <td className="px-3 py-2 text-white print:text-black">
                        {exp.part_name}
                        {exp.part_number ? (
                          <span className="text-[11px] text-gray-400 ml-1 print:text-gray-600">
                            ({exp.part_number})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-gray-300 print:text-gray-700">
                        {exp.expense_category?.name ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-200 print:text-black">
                        {exp.quantity}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-200 print:text-black">
                        {fmtMoney(exp.unit_cost)}
                      </td>
                      <td className="px-3 py-2 text-right text-red-300 print:text-black font-medium">
                        {fmtMoney(exp.total_cost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#0A4D66]/40 print:border-gray-300">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right font-semibold text-gray-300 print:text-black"
                  >
                    Total Expense
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-red-300 print:text-black">
                    {fmtMoney(totals.total_expense)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#0A4D66]/40 print:border-gray-300 flex items-center justify-between text-[11px] text-gray-400 print:text-gray-600">
          <span>End of statement</span>
          <span className="font-semibold text-white print:text-black">
            Available Balance: {fmtMoney(totals.available)}
          </span>
        </div>
      </section>
    </div>
  );
};

export default BudgetStatementPage;
