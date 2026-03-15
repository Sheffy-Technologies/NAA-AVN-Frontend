import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetExpensesQuery } from "@/features/finance/api";
import { cn } from "@/shared/utils/cn";
import {
  useGetDashboardFinanceQuery,
  useGetDashboardInventoriesQuery,
  useGetDashboardMaintenanceQuery,
  useGetDashboardOperationsQuery,
  useGetDashboardPersonnelQuery,
  type DashboardOperationsRecentOperation,
} from "../api";

type Card = {
  label: string;
  value: string | number;
  icon?: string;
  bgClass?: string;
  iconClass?: string;
};

type DashboardTabId =
  | "operations"
  | "maintenance"
  | "finances"
  | "inventory"
  | "personnel";

const TABS: Array<{ id: DashboardTabId; label: string }> = [
  { id: "operations", label: "Operations" },
  { id: "maintenance", label: "Maintenance tracking" },
  { id: "finances", label: "Finances" },
  { id: "inventory", label: "Inventory" },
  { id: "personnel", label: "Personnel" },
];

const CardItem = ({ card }: { card: Card }) => (
  <button
    type="button"
    className={cn(
      "w-full text-left rounded-lg border border-[#0A4D66]/40 p-4 flex items-center justify-between transition-colors cursor-default",
      card.bgClass || "bg-[#001219]",
    )}
  >
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">
        {card.label}
      </p>
      <p className="text-2xl font-semibold text-white">{card.value}</p>
    </div>
    {card.icon && (
      <div
        className={cn(
          "w-9 h-9 rounded flex items-center justify-center",
          card.iconClass || "bg-[#021a27]",
        )}
      >
        <Icon icon={card.icon} className="w-5 h-5 text-white/90" />
      </div>
    )}
  </button>
);

const TableShell = ({
  title,
  left,
  right,
  children,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
          {title}
        </div>
        {left}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
    {children}
  </div>
);

const TableToolbar = ({ resetCount }: { resetCount?: number | string }) => (
  <div className="flex items-center gap-3">
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="p-2 rounded hover:bg-[#0A4D66]/30 text-gray-300 transition-colors"
      >
        <Icon icon="mdi:view-list" className="w-5 h-5" />
      </button>
      <button
        type="button"
        className="p-2 rounded hover:bg-[#0A4D66]/30 text-gray-300 transition-colors"
      >
        <Icon icon="mdi:view-grid" className="w-5 h-5" />
      </button>
    </div>
    <button
      type="button"
      className="inline-flex items-center gap-2 text-xs text-[#7FD5FF] hover:text-[#b3e6ff] transition-colors"
    >
      <span className="w-5 h-5 rounded-full bg-[#0A4D66]/50 text-white text-[10px] flex items-center justify-center">
        {resetCount ?? 0}
      </span>
      Reset Filter
    </button>
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#00090D] border border-[#0A4D66]/50 text-xs text-gray-200 hover:border-[#7FD5FF]/60 transition-colors"
      >
        <span>All Units</span>
        <Icon icon="mdi:chevron-down" className="w-4 h-4 text-gray-400" />
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#00090D] border border-[#0A4D66]/50 text-xs text-gray-200 hover:border-[#7FD5FF]/60 transition-colors"
      >
        <span>All Priority</span>
        <Icon icon="mdi:chevron-down" className="w-4 h-4 text-gray-400" />
      </button>
      <button
        type="button"
        className="p-2 rounded hover:bg-[#0A4D66]/30 text-gray-300 transition-colors"
      >
        <Icon icon="mdi:download" className="w-5 h-5" />
      </button>
    </div>
  </div>
);

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTabId>("operations");

  const { data: operations, isFetching: isFetchingOps } =
    useGetDashboardOperationsQuery(undefined, {
      skip: activeTab !== "operations",
    });

  const { data: maintenance, isFetching: isFetchingMaintenance } =
    useGetDashboardMaintenanceQuery(undefined, {
      skip: activeTab !== "maintenance",
    });

  const { data: finance, isFetching: isFetchingFinance } =
    useGetDashboardFinanceQuery(undefined, {
      skip: activeTab !== "finances",
    });

  const { data: inventories, isFetching: isFetchingInventory } =
    useGetDashboardInventoriesQuery(undefined, {
      skip: activeTab !== "inventory",
    });

  const { data: personnel, isFetching: isFetchingPersonnel } =
    useGetDashboardPersonnelQuery(undefined, {
      skip: activeTab !== "personnel",
    });

  const { data: expenses = [] } = useGetExpensesQuery(undefined, {
    skip: activeTab !== "finances",
  });

  const financeCards: Card[] = useMemo(() => {
    const total = finance?.total_expense ?? 0;
    const monthly = finance?.current_month_expense ?? 0;
    const quarterly = finance?.current_quarter_expense ?? 0;
    const budget = finance?.budget ?? 0;
    const used = finance?.sum_amount ?? total;
    const pct =
      budget > 0 ? Math.round((used / budget) * 1000) / 10 : undefined;
    return [
      {
        label: "Total Expense",
        value: `₦${total.toLocaleString()}`,
        icon: "mdi:cash-fast",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
      {
        label: "Monthly",
        value: `₦${monthly.toLocaleString()}`,
        icon: "mdi:calendar-month",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
      {
        label: "Quarterly",
        value: `₦${quarterly.toLocaleString()}`,
        icon: "mdi:calendar-range",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
      {
        label: "Budget",
        value: `₦${budget.toLocaleString()}${pct !== undefined ? `  ${pct}%` : ""}`,
        icon: "mdi:account-cash",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
    ];
  }, [finance]);

  const inventoryCards: Card[] = useMemo(() => {
    return [
      {
        label: "Total In Stock",
        value: inventories?.total_stock ?? 0,
        icon: "mdi:warehouse",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
      {
        label: "Low Stock Items",
        value: inventories?.low_stock ?? 0,
        icon: "mdi:alert",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#6b4b00]/60",
      },
      {
        label: "Expired Items",
        value: inventories?.expired_items ?? 0,
        icon: "mdi:alert-octagon",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#5a0a0a]/60",
      },
      {
        label: "Critical",
        value: inventories?.critical_stock ?? 0,
        icon: "mdi:alert-decagram",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#7a0000]/60",
      },
    ];
  }, [inventories]);

  const operationsCards: Card[] = useMemo(() => {
    return [
      {
        label: "Planned",
        value: operations?.planned ?? 0,
        icon: "mdi:database",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
      {
        label: "Completed",
        value: operations?.completed ?? 0,
        icon: "mdi:database-check",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#002015]",
        iconClass: "bg-emerald-700/50",
      },
      {
        label: "Ongoing",
        value: operations?.ongoing ?? 0,
        icon: "mdi:database-sync",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#241e00]",
        iconClass: "bg-amber-600/50",
      },
      {
        label: "Aborted",
        value: operations?.aborted ?? 0,
        icon: "mdi:database-off",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#240000]",
        iconClass: "bg-red-700/50",
      },
    ];
  }, [operations]);

  const maintenanceCards: Card[] = useMemo(() => {
    return [
      {
        label: "Total",
        value: maintenance?.total_aircraft ?? 0,
        icon: "mdi:airplane",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
      {
        label: "Serviceable",
        value: maintenance?.maintenance_events?.serviceable ?? 0,
        icon: "mdi:airplane-check",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#002015]",
        iconClass: "bg-emerald-700/50",
      },
      {
        label: "Under Maintenance",
        value: maintenance?.maintenance_events?.under_maintenance ?? 0,
        icon: "mdi:toolbox",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#241e00]",
        iconClass: "bg-amber-600/50",
      },
      {
        label: "Grounded",
        value: maintenance?.maintenance_events?.grounded ?? 0,
        icon: "mdi:airplane-off",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#240000]",
        iconClass: "bg-red-700/50",
      },
    ];
  }, [maintenance]);

  const personnelCards: Card[] = useMemo(() => {
    return [
      {
        label: "Total",
        value: personnel?.total_personnel ?? 0,
        icon: "mdi:account-group",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#001f2e]",
        iconClass: "bg-[#0A4D66]/60",
      },
      {
        label: "Active",
        value: personnel?.active ?? 0,
        icon: "mdi:account-check",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#002015]",
        iconClass: "bg-emerald-700/50",
      },
      {
        label: "Medical",
        value: personnel?.medical ?? 0,
        icon: "mdi:hospital",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#241e00]",
        iconClass: "bg-amber-600/50",
      },
      {
        label: "Grounded",
        value: personnel?.grounded ?? 0,
        icon: "mdi:alert",
        bgClass: "bg-gradient-to-r from-[#001219] to-[#240000]",
        iconClass: "bg-red-700/50",
      },
    ];
  }, [personnel]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-8 border-b border-[#0A4D66]/40">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "py-3 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-white border-b-2 border-[#7FD5FF]"
                : "text-gray-400 hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "operations" && (
        <div className="space-y-4">
          <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
            Operations
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {operationsCards.map((c) => (
              <CardItem key={c.label} card={c} />
            ))}
          </div>

          <TableShell
            title="Upcoming Operations"
            right={
              <TableToolbar resetCount={operations?.total_operations ?? 0} />
            }
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Operation</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">Priority</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {isFetchingOps && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingOps &&
                    (operations?.recent_operations?.length ?? 0) === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={6}>
                          No upcoming operations
                        </td>
                      </tr>
                    )}
                  {(operations?.recent_operations ?? []).map(
                    (op: DashboardOperationsRecentOperation) => (
                      <tr
                        key={
                          op.id ??
                          `${op.name ?? "operation"}-${op.created_at ?? ""}`
                        }
                        className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/10 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {op.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {op.operation_type?.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {op.unit?.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {op.priority || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {op.status || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              op.id
                                ? navigate(`/dashboard/operations/${op.id}`)
                                : undefined
                            }
                            className={cn(
                              "inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors",
                              op.id
                                ? "text-gray-200"
                                : "text-gray-500 cursor-not-allowed",
                            )}
                            disabled={!op.id}
                          >
                            <Icon
                              icon="mdi:dots-horizontal"
                              className="w-5 h-5"
                            />
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </TableShell>
        </div>
      )}

      {activeTab === "maintenance" && (
        <div className="space-y-4">
          <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
            Aircrafts
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {maintenanceCards.map((c) => (
              <CardItem key={c.label} card={c} />
            ))}
          </div>

          <TableShell
            title="Maintenance tracking"
            left={
              <div className="hidden md:flex items-center gap-5">
                {["All", "Airframe", "Engine", "Avionics"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={cn(
                      "text-xs font-medium transition-colors",
                      t === "All"
                        ? "text-[#7FD5FF]"
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            }
            right={
              <TableToolbar resetCount={maintenance?.total_aircraft ?? 0} />
            }
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Tail No</th>
                    <th className="px-4 py-3 text-left">Aircraft</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Total hrs</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {isFetchingMaintenance && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingMaintenance &&
                    (maintenance?.recent_aircrafts?.length ?? 0) === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={6}>
                          No recent aircrafts
                        </td>
                      </tr>
                    )}
                  {(maintenance?.recent_aircrafts ?? []).map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/10 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-300">
                        {a.tail_number || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {a.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {a.type || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {a.operations_total_hours_label ||
                          a.total_airframe_hours ||
                          "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {a.serviceability_status || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/assets/${a.id}`)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                        >
                          <Icon
                            icon="mdi:dots-horizontal"
                            className="w-5 h-5"
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </div>
      )}

      {activeTab === "finances" && (
        <div className="space-y-4">
          <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
            Finances
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {financeCards.map((c) => (
              <CardItem key={c.label} card={c} />
            ))}
          </div>

          <TableShell
            title="Recent finance log"
            right={<TableToolbar resetCount={expenses.length} />}
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Item Description</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Quantity</th>
                    <th className="px-4 py-3 text-left">Unit Cost</th>
                    <th className="px-4 py-3 text-left">Total Cost</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {isFetchingFinance && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingFinance && expenses.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={6}>
                        No recent finance logs
                      </td>
                    </tr>
                  )}
                  {expenses.slice(0, 7).map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {e.part_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {e.expense_category?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {e.quantity ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {typeof e.unit_cost === "number"
                          ? `₦${e.unit_cost.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {typeof e.total_cost === "number"
                          ? `₦${e.total_cost.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate("/dashboard/finance")}
                          className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                        >
                          <Icon
                            icon="mdi:dots-horizontal"
                            className="w-5 h-5"
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
            Inventory
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {inventoryCards.map((c) => (
              <CardItem key={c.label} card={c} />
            ))}
          </div>

          <TableShell
            title="Recent inventories"
            right={
              <TableToolbar
                resetCount={inventories?.recent_inventories?.length ?? 0}
              />
            }
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Part No</th>
                    <th className="px-4 py-3 text-left">Current Stock</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">Expiry</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {isFetchingInventory && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingInventory &&
                    (inventories?.recent_inventories?.length ?? 0) === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={6}>
                          No recent inventories
                        </td>
                      </tr>
                    )}
                  {(inventories?.recent_inventories ?? [])
                    .slice(0, 7)
                    .map((i) => (
                      <tr
                        key={i.id}
                        className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/10 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {i.description || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {i.part_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {typeof i.current_stock === "number"
                            ? i.current_stock
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {i.unit?.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {i.expiry_date || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/dashboard/inventory/${i.id}`)
                            }
                            className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                          >
                            <Icon
                              icon="mdi:dots-horizontal"
                              className="w-5 h-5"
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </div>
      )}

      {activeTab === "personnel" && (
        <div className="space-y-4">
          <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
            Personnel
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {personnelCards.map((c) => (
              <CardItem key={c.label} card={c} />
            ))}
          </div>

          <TableShell
            title="Recent personnel"
            right={
              <TableToolbar
                resetCount={personnel?.recent_personnel?.length ?? 0}
              />
            }
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">Branch</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {isFetchingPersonnel && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingPersonnel &&
                    (personnel?.recent_personnel?.length ?? 0) === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={6}>
                          No recent personnel
                        </td>
                      </tr>
                    )}
                  {(personnel?.recent_personnel ?? []).slice(0, 7).map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {p.full_name ||
                          `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() ||
                          "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.rank?.abbreviation || p.rank?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.unit?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.branch?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.status || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/dashboard/personnel/${p.id}`)
                          }
                          className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                        >
                          <Icon
                            icon="mdi:dots-horizontal"
                            className="w-5 h-5"
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </div>
      )}
    </div>
  );
};
