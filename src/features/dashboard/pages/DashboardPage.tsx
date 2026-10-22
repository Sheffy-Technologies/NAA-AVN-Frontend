import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetExpensesQuery } from "@/features/finance/api";
import { useAppSelector } from "@/shared/hooks/redux";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import {
  useGetDashboardFinanceQuery,
  useGetDashboardInventoriesQuery,
  useGetDashboardMaintenanceQuery,
  useGetDashboardOperationsQuery,
  useGetDashboardPersonnelQuery,
  type DashboardOperationsRecentOperation,
} from "../api";

import { MetricCard, type MetricBadgeColor } from "@/shared/ui/metric/MetricCard";

type Card = {
  label: string;
  value: string | number;
  icon?: string;
  bgClass?: string;
  iconClass?: string;
  badge?: string;
  badgeColor?: MetricBadgeColor;
};

type DashboardTabId =
  | "operations"
  | "maintenance"
  | "finances"
  | "inventory"
  | "personnel";

type UnitFilterOption = {
  value: string;
  label: string;
};

const formatMetric = (
  raw: string | number | undefined,
  unit: string,
  { space = true }: { space?: boolean } = {},
) => {
  if (raw === undefined || raw === null) return "—";
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!value || Number.isNaN(value)) return "—";
  const normalized =
    Math.round(value) === value ? value.toString() : value.toFixed(1);
  return `${normalized}${space ? " " : ""}${unit}`;
};

const formatRemainingMetric = (
  remaining: number,
  unit: string,
  {
    warnThreshold = 10,
    space = true,
  }: { warnThreshold?: number; space?: boolean } = {},
) => {
  const absValue = Math.abs(remaining);
  const normalized =
    Math.round(absValue) === absValue
      ? absValue.toString()
      : absValue.toFixed(1);
  const suffix = `${normalized}${space ? " " : ""}${unit}`;

  if (remaining < 0) {
    return {
      text: `${suffix} Overdue`,
      className: "text-red-400",
    };
  }

  if (remaining <= warnThreshold) {
    return {
      text: suffix,
      className: "text-amber-400",
    };
  }

  return {
    text: suffix,
    className: "text-emerald-400",
  };
};

const formatDateTime = (value: string | undefined | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const TABS: Array<{ id: DashboardTabId; label: string; requiredPermissions: string[] }> = [
  { id: "operations", label: "Operations", requiredPermissions: ["dashboard.operations.view", "operations.viewAny"] },
  {
    id: "maintenance",
    label: "Maintenance tracking",
    requiredPermissions: ["dashboard.maintenance.view", "work-orders.viewAny", "maintenance-programs.viewAny"],
  },
  { id: "finances", label: "Finances", requiredPermissions: ["dashboard.finance.view", "expenses.viewAny", "budgets.viewAny"] },
  { id: "inventory", label: "Inventory", requiredPermissions: ["dashboard.inventories.view", "inventories.viewAny"] },
  { id: "personnel", label: "Personnel", requiredPermissions: ["dashboard.personnel.view", "personnel.viewAny"] },
];

/**
 * Same nav-visibility rule as the Sidebar: a tab only renders for a user
 * holding at least one of its required permissions. This is what keeps the
 * Finances tab (and its data) out of view for anyone not authorised for the
 * Finance module — see CLAUDE.md "Finance Module Restricted Access".
 */
const canAccessTab = (tab: { requiredPermissions: string[] }, permissions: string[]) =>
  tab.requiredPermissions.length === 0 ||
  tab.requiredPermissions.some((permission) => permissions.includes(permission));

const CardItem = ({
  card,
  onClick,
}: {
  card: Card;
  onClick?: () => void;
}) => (
  <MetricCard
    label={card.label}
    value={card.value}
    icon={card.icon}
    badge={card.badge}
    badgeColor={card.badgeColor}
    onClick={onClick}
  />
);

const TableShell = ({
  title,
  left,
  right,
  children,
}: {
  title: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {typeof title === "string" ? (
          <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
            {title}
          </div>
        ) : (
          title
        )}
        {left}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
    {children}
  </div>
);

const TableToolbar = ({
  resetCount,
  unitOptions,
  selectedUnit,
  onChangeUnit,
  onResetFilter,
  onDownload,
  isDownloadDisabled,
  viewMode,
  onViewList,
  onViewGrid,
}: {
  resetCount?: number | string;
  unitOptions: UnitFilterOption[];
  selectedUnit: string;
  onChangeUnit: (value: string) => void;
  onResetFilter: () => void;
  onDownload: () => void;
  isDownloadDisabled?: boolean;
  viewMode?: "table" | "card";
  onViewList?: () => void;
  onViewGrid?: () => void;
}) => (
  <div className="flex items-center gap-3">
    <div className="flex items-center gap-1">
      <button
        type="button"
        title="List view"
        aria-label="List view"
        onClick={onViewList}
        className={cn(
          "p-2 rounded transition-colors",
          viewMode === "card"
            ? "hover:bg-[#0A4D66]/30 text-gray-400"
            : "bg-[#0A4D66]/40 text-white",
        )}
      >
        <Icon icon="mdi:view-list" className="w-5 h-5" />
      </button>
      <button
        type="button"
        title="Grid view"
        aria-label="Grid view"
        onClick={onViewGrid}
        className={cn(
          "p-2 rounded transition-colors",
          viewMode === "card"
            ? "bg-[#0A4D66]/40 text-white"
            : "hover:bg-[#0A4D66]/30 text-gray-400",
        )}
      >
        <Icon icon="mdi:view-grid" className="w-5 h-5" />
      </button>
    </div>
    <button
      type="button"
      onClick={onResetFilter}
      className="inline-flex items-center gap-2 text-xs text-[#7FD5FF] hover:text-[#B7E6FF] transition-colors"
    >
      <span className="w-5 h-5 rounded-full bg-[#0A4D66]/50 text-white text-[10px] flex items-center justify-center">
        {resetCount ?? 0}
      </span>
      Reset Filter
    </button>
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          value={selectedUnit}
          onChange={(event) => onChangeUnit(event.target.value)}
          className="appearance-none inline-flex items-center gap-2 pl-3 pr-8 py-2 rounded bg-[#001219] border border-[#0A4D66]/50 text-xs text-gray-200 hover:border-[#7FD5FF]/60 transition-colors focus:outline-none focus:border-[#7FD5FF]"
          title="Filter by unit"
          aria-label="Filter by unit"
        >
          {unitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          icon="mdi:chevron-down"
          className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        />
      </div>
      <button
        type="button"
        onClick={onDownload}
        disabled={isDownloadDisabled}
        className={cn(
          "p-2 rounded transition-colors",
          isDownloadDisabled
            ? "text-gray-500 cursor-not-allowed"
            : "hover:bg-[#0A4D66]/30 text-gray-300",
        )}
        title="Download current list"
        aria-label="Download current list"
      >
        <Icon icon="mdi:download" className="w-5 h-5" />
      </button>
    </div>
  </div>
);

export const DashboardPage = () => {
  const navigate = useNavigate();
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);
  const visibleTabs = useMemo(() => TABS.filter((tab) => canAccessTab(tab, permissions)), [permissions]);
  const canAccessStrategicDashboard = permissions.includes("dashboard.strategic.view");
  const [activeTab, setActiveTab] = useState<DashboardTabId>("operations");
  const [operationsViewMode, setOperationsViewMode] = useState<"table" | "card">("table");
  const [operationsTab, setOperationsTab] = useState<"upcoming" | "recent">("upcoming");
  const [selectedUnitByTab, setSelectedUnitByTab] = useState<
    Record<DashboardTabId, string>
  >({
    operations: "all",
    maintenance: "all",
    finances: "all",
    inventory: "all",
    personnel: "all",
  });

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
    const openingBalance = finance?.opening_balance ?? finance?.budget ?? 0;
    const balanceOfAccount = finance?.balance_of_account ?? 0;
    return [
      {
        label: "Balance of Account",
        value: `₦${balanceOfAccount.toLocaleString()}`,
        icon: "mdi:bank",
        badge: "Solvent",
        badgeColor: "emerald",
      },
      {
        label: "Monthly Expenditure",
        value: `₦${monthly.toLocaleString()}`,
        icon: "mdi:calendar-month",
        badge: "Monthly",
        badgeColor: "sky",
      },
      {
        label: "Total Expenditure",
        value: `₦${total.toLocaleString()}`,
        icon: "mdi:cash-fast",
        badge: "YTD",
        badgeColor: "indigo",
      },
      {
        label: "Opening Balance",
        value: `₦${openingBalance.toLocaleString()}`,
        icon: "mdi:account-cash",
        badge: "Budget",
        badgeColor: "neutral",
      },
    ];
  }, [finance]);

  const inventoryCards: Card[] = useMemo(() => {
    return [
      {
        label: "Total In Stock",
        value: inventories?.total_stock ?? 0,
        icon: "mdi:warehouse",
        badge: "Catalog",
        badgeColor: "sky",
      },
      {
        label: "Low Stock Items",
        value: inventories?.low_stock ?? 0,
        icon: "mdi:alert",
        badge: "Reorder",
        badgeColor: "amber",
      },
      {
        label: "Expired Items",
        value: inventories?.expired_items ?? 0,
        icon: "mdi:alert-octagon",
        badge: "Expired",
        badgeColor: "red",
      },
      {
        label: "Critical",
        value: inventories?.critical_stock ?? 0,
        icon: "mdi:alert-decagram",
        badge: "Critical",
        badgeColor: "red",
      },
    ];
  }, [inventories]);

  const operationsCards: Card[] = useMemo(() => {
    return [
      {
        label: "Planned",
        value: operations?.planned ?? 0,
        icon: "mdi:database",
      },
      {
        label: "Completed",
        value: operations?.completed ?? 0,
        icon: "mdi:database-check",
      },
      {
        label: "Ongoing",
        value: operations?.ongoing ?? 0,
        icon: "mdi:database-sync",
      },
      {
        label: "Aborted",
        value: operations?.aborted ?? 0,
        icon: "mdi:database-off",
      },
    ];
  }, [operations]);

  const maintenanceCards: Card[] = useMemo(() => {
    return [
      {
        label: "Total",
        value: maintenance?.total_aircraft ?? 0,
        icon: "mdi:airplane",
        badge: "Fleet",
        badgeColor: "sky",
      },
      {
        label: "Serviceable",
        value: maintenance?.maintenance_events?.serviceable ?? 0,
        icon: "mdi:airplane-check",
        badge: "Ready",
        badgeColor: "emerald",
      },
      {
        label: "Under Maintenance",
        value: maintenance?.maintenance_events?.under_maintenance ?? 0,
        icon: "mdi:toolbox",
        badge: "Hangar",
        badgeColor: "amber",
      },
      {
        label: "Grounded",
        value: maintenance?.maintenance_events?.grounded ?? 0,
        icon: "mdi:airplane-off",
        badge: "AOG",
        badgeColor: "red",
      },
    ];
  }, [maintenance]);

  const personnelCards: Card[] = useMemo(() => {
    return [
      {
        label: "Total",
        value: personnel?.total_personnel ?? 0,
        icon: "mdi:account-group",
        badge: "Strength",
        badgeColor: "sky",
      },
      {
        label: "Active",
        value: personnel?.active ?? 0,
        icon: "mdi:account-check",
        badge: "Deployable",
        badgeColor: "emerald",
      },
      {
        label: "Medical",
        value: personnel?.medical ?? 0,
        icon: "mdi:hospital",
        badge: "Medical",
        badgeColor: "amber",
      },
      {
        label: "Grounded",
        value: personnel?.grounded ?? 0,
        icon: "mdi:alert",
        badge: "Stand Down",
        badgeColor: "red",
      },
    ];
  }, [personnel]);

  const toUnitOption = (id: number | undefined, name: string | undefined) => {
    if (!id) return null;
    return {
      value: String(id),
      label: name?.trim() || `Unit #${id}`,
    } as UnitFilterOption;
  };

  const getUnitOptions = (options: Array<UnitFilterOption | null>) => {
    const map = new Map<string, UnitFilterOption>();
    options.forEach((option) => {
      if (!option) return;
      if (!map.has(option.value)) {
        map.set(option.value, option);
      }
    });
    return [{ value: "all", label: "All Units" }, ...Array.from(map.values())];
  };

  const operationsRows = useMemo(
    () => operations?.recent_operations ?? [],
    [operations?.recent_operations],
  );
  const conductedOperationsRows = useMemo(
    () => operations?.conducted_operations ?? [],
    [operations?.conducted_operations],
  );
  const maintenanceRows = useMemo(
    () => maintenance?.recent_aircrafts ?? [],
    [maintenance?.recent_aircrafts],
  );
  const comingDueRows = useMemo(
    () => maintenance?.coming_due ?? [],
    [maintenance?.coming_due],
  );
  const financeRows = expenses;
  const inventoryRows = useMemo(
    () => inventories?.recent_inventories ?? [],
    [inventories?.recent_inventories],
  );
  const personnelRows = useMemo(
    () => personnel?.recent_personnel ?? [],
    [personnel?.recent_personnel],
  );

  const operationsUnitOptions = useMemo(
    () =>
      getUnitOptions(
        operationsRows.map((op) =>
          toUnitOption(op.unit?.id, op.unit?.name),
        ),
      ),
    [operationsRows],
  );

  const maintenanceUnitOptions = useMemo(
    () =>
      getUnitOptions(
        maintenanceRows.map((aircraft) =>
          toUnitOption(aircraft.unit_id, undefined),
        ),
      ),
    [maintenanceRows],
  );

  const financeUnitOptions = useMemo(
    () =>
      getUnitOptions(
        financeRows.map((expense) => toUnitOption(expense.unit_id, expense.unit?.name)),
      ),
    [financeRows],
  );

  const inventoryUnitOptions = useMemo(
    () =>
      getUnitOptions(
        inventoryRows.map((inventory) =>
          toUnitOption(inventory.unit_id, inventory.unit?.name),
        ),
      ),
    [inventoryRows],
  );

  const personnelUnitOptions = useMemo(
    () =>
      getUnitOptions(
        personnelRows.map((person) => toUnitOption(person.unit?.id, person.unit?.name)),
      ),
    [personnelRows],
  );

  const selectedOperationsUnit = selectedUnitByTab.operations;
  const selectedMaintenanceUnit = selectedUnitByTab.maintenance;
  const selectedFinanceUnit = selectedUnitByTab.finances;
  const selectedInventoryUnit = selectedUnitByTab.inventory;
  const selectedPersonnelUnit = selectedUnitByTab.personnel;

  const filteredOperationsRows = operationsRows.filter((op) =>
    selectedOperationsUnit === "all"
      ? true
      : String(op.unit?.id ?? "") === selectedOperationsUnit,
  );

  const filteredMaintenanceRows = maintenanceRows.filter((aircraft) =>
    selectedMaintenanceUnit === "all"
      ? true
      : String(aircraft.unit_id) === selectedMaintenanceUnit,
  );

  const filteredFinanceRows = financeRows.filter((expense) =>
    selectedFinanceUnit === "all"
      ? true
      : String(expense.unit_id) === selectedFinanceUnit,
  );

  const filteredInventoryRows = inventoryRows.filter((inventory) =>
    selectedInventoryUnit === "all"
      ? true
      : String(inventory.unit_id) === selectedInventoryUnit,
  );

  const filteredPersonnelRows = personnelRows.filter((person) =>
    selectedPersonnelUnit === "all"
      ? true
      : String(person.unit?.id ?? "") === selectedPersonnelUnit,
  );

  const setTabUnitFilter = (tab: DashboardTabId, value: string) => {
    setSelectedUnitByTab((previous) => ({ ...previous, [tab]: value }));
  };

  const resetTabUnitFilter = (tab: DashboardTabId) => {
    setSelectedUnitByTab((previous) => ({ ...previous, [tab]: "all" }));
  };

  const toCsv = (headers: string[], rows: Array<Array<string | number>>) => {
    const escape = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const content = [
      headers.map(escape).join(","),
      ...rows.map((row) => row.map(escape).join(",")),
    ].join("\n");

    return content;
  };

  const downloadCsv = (
    fileName: string,
    headers: string[],
    rows: Array<Array<string | number>>,
  ) => {
    const content = toCsv(headers, rows);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadOperations = () => {
    if (filteredOperationsRows.length === 0) return;
    downloadCsv(
      "dashboard-operations.csv",
      ["Operation", "Type", "Unit", "Priority", "Status"],
      filteredOperationsRows.map((op) => [
        op.name || "—",
        op.operation_type?.name || "—",
        op.unit?.name || "—",
        op.priority || "—",
        op.status || "—",
      ]),
    );
  };

  const handleDownloadMaintenance = () => {
    if (filteredMaintenanceRows.length === 0) return;
    downloadCsv(
      "dashboard-maintenance.csv",
      [
        "Tail No.",
        "Aircraft Name",
        "Inspection (Hrs)",
        "Inspection (Cyc)",
        "Total Hrs",
        "Total Cyc",
      ],
      filteredMaintenanceRows.map((aircraft) => [
        aircraft.tail_number || "—",
        aircraft.name || "—",
        formatMetric(aircraft.inspection_interval, "hrs", { space: false }),
        formatMetric(aircraft.inspection_interval_cycle, "cyc"),
        formatMetric(aircraft.total_airframe_hours, "hrs", { space: false }),
        formatMetric(aircraft.total_cycles, "cyc"),
      ]),
    );
  };

  const handleDownloadFinance = () => {
    if (filteredFinanceRows.length === 0) return;
    downloadCsv(
      "dashboard-finance.csv",
      ["Item Description", "Category", "Quantity", "Unit Cost", "Total Cost"],
      filteredFinanceRows.map((expense) => [
        expense.part_name || "—",
        expense.expense_category?.name || "—",
        expense.quantity ?? "—",
        typeof expense.unit_cost === "number"
          ? `₦${expense.unit_cost.toLocaleString()}`
          : "—",
        typeof expense.total_cost === "number"
          ? `₦${expense.total_cost.toLocaleString()}`
          : "—",
      ]),
    );
  };

  const handleDownloadInventory = () => {
    if (filteredInventoryRows.length === 0) return;
    downloadCsv(
      "dashboard-inventory.csv",
      ["Description", "Part No", "Current Stock", "Unit", "Expiry"],
      filteredInventoryRows.map((inventory) => [
        inventory.description || "—",
        inventory.part_number || "—",
        typeof inventory.current_stock === "number"
          ? inventory.current_stock
          : "—",
        inventory.unit?.name || "—",
        inventory.expiry_date || "—",
      ]),
    );
  };

  const handleDownloadPersonnel = () => {
    if (filteredPersonnelRows.length === 0) return;
    downloadCsv(
      "dashboard-personnel.csv",
      ["Name", "Rank", "Unit", "Branch", "Status"],
      filteredPersonnelRows.map((person) => [
        person.full_name ||
          `${person.firstname ?? ""} ${person.lastname ?? ""}`.trim() ||
          "—",
        person.rank?.abbreviation || person.rank?.name || "—",
        person.unit?.name || "—",
        person.branch?.name || "—",
        person.status || "—",
      ]),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 border-b border-[#0A4D66]/40 w-full">
        <div className="flex items-center space-x-8 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-4 text-sm font-medium transition-colors relative whitespace-nowrap bg-transparent tab-link outline-none border-0 shadow-none",
                activeTab === tab.id
                  ? "text-sky-700 dark:text-[#7FD5FF] font-bold"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200",
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-700 dark:bg-[#0369A1] shadow-sm dark:shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {canAccessStrategicDashboard && (
          <button
            type="button"
            onClick={() => navigate("/dashboard/strategic")}
            className="mb-3 inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#0A4D66] hover:bg-[#083c50] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm border border-transparent transition-all active:scale-[0.98]"
          >
            <Icon
              icon="mdi:radar"
              className="h-4 w-4 text-white !text-white"
              style={{ color: "#ffffff" }}
            />
            <span>Strategic Command Dashboard</span>
          </button>
        )}
      </div>

      {activeTab === "operations" && (
        <div className="space-y-4">
          <div className="text-xs font-bold tracking-wide text-gray-200 uppercase">
            Operations
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {operationsCards.map((c) => (
              <CardItem
                key={c.label}
                card={c}
                onClick={() =>
                  navigate(
                    `/dashboard/operations?status=${c.label.toLowerCase()}`,
                    { state: { from: "/dashboard", fromLabel: "Dashboard" } },
                  )
                }
              />
            ))}
          </div>

          <TableShell
            title={
              <div className="inline-flex items-center space-x-1 p-1 rounded-lg border border-[#0A4D66]/50 bg-[#001825]">
                <button
                  type="button"
                  onClick={() => setOperationsTab("upcoming")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                    operationsTab === "upcoming"
                      ? "bg-[#0A4D66] text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-slate-800/40",
                  )}
                >
                  <span>Upcoming Operations</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      operationsTab === "upcoming"
                        ? "bg-white/20 text-white font-bold"
                        : "bg-slate-800 text-gray-400",
                    )}
                  >
                    {filteredOperationsRows.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOperationsTab("recent")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                    operationsTab === "recent"
                      ? "bg-[#0A4D66] text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-slate-800/40",
                  )}
                >
                  <span>Recent Operations</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      operationsTab === "recent"
                        ? "bg-white/20 text-white font-bold"
                        : "bg-slate-800 text-gray-400",
                    )}
                  >
                    {conductedOperationsRows.length}
                  </span>
                </button>
              </div>
            }
            right={
              <TableToolbar
                resetCount={operations?.total_operations ?? 0}
                unitOptions={operationsUnitOptions}
                selectedUnit={selectedOperationsUnit}
                onChangeUnit={(value) => setTabUnitFilter("operations", value)}
                onResetFilter={() => resetTabUnitFilter("operations")}
                onDownload={handleDownloadOperations}
                isDownloadDisabled={
                  operationsTab === "upcoming"
                    ? filteredOperationsRows.length === 0
                    : conductedOperationsRows.length === 0
                }
                viewMode={operationsViewMode}
                onViewList={() => setOperationsViewMode("table")}
                onViewGrid={() => setOperationsViewMode("card")}
              />
            }
          >
            {operationsTab === "upcoming" ? (
              <>
                {/* Mobile card list — always shown on small screens */}
            <div className="md:hidden divide-y divide-[#0A4D66]/20">
              {isFetchingOps && (
                <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
              )}
              {!isFetchingOps && filteredOperationsRows.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400">
                  No upcoming operations
                </div>
              )}
              {filteredOperationsRows.map((op) => (
                <div
                  key={op.id ?? `${op.name ?? "operation"}-${op.created_at ?? ""}`}
                  tabIndex={op.id ? 0 : undefined}
                  role={op.id ? "button" : undefined}
                  title={op.id ? "Click to view operation details" : undefined}
                  onClick={(e) =>
                    op.id
                      ? onInteractiveRowClick(e, () =>
                          navigate(`/dashboard/operations/${op.id}`, {
                            state: { from: "/dashboard", fromLabel: "Dashboard" },
                          }),
                        )
                      : undefined
                  }
                  onKeyDown={(e) =>
                    op.id
                      ? onInteractiveRowKeyDown(e, () =>
                          navigate(`/dashboard/operations/${op.id}`, {
                            state: { from: "/dashboard", fromLabel: "Dashboard" },
                          }),
                        )
                      : undefined
                  }
                  className={cn(
                    "space-y-3 px-4 py-4 transition-colors",
                    op.id && "cursor-pointer hover:bg-[#0A4D66]/20 focus:outline-none focus:bg-[#0A4D66]/30",
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{op.name || "—"}</p>
                    <p className="text-xs text-gray-400">
                      {op.operation_type?.name || "—"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-gray-400">Unit</p>
                    <p className="text-right text-gray-200">{op.unit?.name || "—"}</p>
                    <p className="text-gray-400">Priority</p>
                    <p className="text-right text-gray-200">{op.priority || "—"}</p>
                    <p className="text-gray-400">Status</p>
                    <p className="text-right text-gray-200">{op.status || "—"}</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        op.id
                          ? navigate(`/dashboard/operations/${op.id}`, {
                              state: { from: "/dashboard", fromLabel: "Dashboard" },
                            })
                          : undefined
                      }
                      className={cn(
                        "inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors",
                        op.id
                          ? "text-gray-200"
                          : "text-gray-500 cursor-not-allowed",
                      )}
                      disabled={!op.id}
                      title="View operation details"
                      aria-label="View operation details"
                    >
                      <Icon icon="mdi:eye-outline" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Card view — desktop */}
            {operationsViewMode === "card" && (
              <div className="hidden md:block p-4">
                {isFetchingOps && (
                  <p className="text-sm text-gray-400 py-4">Loading…</p>
                )}
                {!isFetchingOps && filteredOperationsRows.length === 0 && (
                  <p className="text-sm text-gray-400 py-4">No upcoming operations</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredOperationsRows.map((op: DashboardOperationsRecentOperation) => {
                    const statusColors: Record<string, string> = {
                      planned: "bg-blue-400",
                      completed: "bg-emerald-400",
                      ongoing: "bg-amber-400",
                      aborted: "bg-red-500",
                    };
                    const priorityColors: Record<string, string> = {
                      low: "text-emerald-400",
                      medium: "text-amber-300",
                      high: "text-red-400",
                    };
                    return (
                      <div
                        key={op.id ?? `${op.name ?? "operation"}-${op.created_at ?? ""}`}
                        className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 flex flex-col gap-3 hover:border-[#7FD5FF]/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {op.name || "—"}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {op.operation_type?.name || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full",
                                statusColors[op.status ?? ""] ?? "bg-gray-400",
                              )}
                            />
                            <span className="text-xs capitalize text-gray-300">
                              {op.status || "—"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-gray-400">Unit</span>
                          <span className="text-gray-200 text-right truncate">
                            {op.unit?.name || "—"}
                          </span>
                          <span className="text-gray-400">Priority</span>
                          <span
                            className={cn(
                              "text-right capitalize font-medium",
                              priorityColors[op.priority ?? ""] ?? "text-gray-200",
                            )}
                          >
                            {op.priority || "—"}
                          </span>
                        </div>

                        <div className="flex justify-end pt-1 border-t border-[#0A4D66]/30">
                          <button
                            type="button"
                            onClick={() =>
                              op.id
                                ? navigate(`/dashboard/operations/${op.id}`)
                                : undefined
                            }
                            disabled={!op.id}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded hover:bg-[#0A4D66]/40 transition-colors",
                              op.id ? "text-[#7FD5FF]" : "text-gray-500 cursor-not-allowed",
                            )}
                            title="View operation details"
                            aria-label="View operation details"
                          >
                            <Icon icon="mdi:eye-outline" className="w-4 h-4" />
                            View
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Table view — desktop */}
            {operationsViewMode === "table" && (
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Operation</th>
                    <th className="px-4 py-3 text-left">Purpose</th>
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
                      <td className="px-4 py-6 text-gray-400" colSpan={7}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingOps &&
                    filteredOperationsRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={7}>
                          No upcoming operations
                        </td>
                      </tr>
                    )}
                  {filteredOperationsRows.map(
                    (op: DashboardOperationsRecentOperation) => (
                      <tr
                        key={
                          op.id ??
                          `${op.name ?? "operation"}-${op.created_at ?? ""}`
                        }
                        tabIndex={op.id ? 0 : undefined}
                        role={op.id ? "button" : undefined}
                        title={op.id ? "Click to view operation details" : undefined}
                        onClick={(e) =>
                          op.id
                            ? onInteractiveRowClick(e, () =>
                                navigate(`/dashboard/operations/${op.id}`, {
                                  state: { from: "/dashboard", fromLabel: "Dashboard" },
                                }),
                              )
                            : undefined
                        }
                        onKeyDown={(e) =>
                          op.id
                            ? onInteractiveRowKeyDown(e, () =>
                                navigate(`/dashboard/operations/${op.id}`, {
                                  state: { from: "/dashboard", fromLabel: "Dashboard" },
                                }),
                              )
                            : undefined
                        }
                        className={cn(
                          "border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 transition-colors",
                          op.id && "cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30",
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {op.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {op.description || "—"}
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
                                ? navigate(`/dashboard/operations/${op.id}`, {
                                    state: { from: "/dashboard", fromLabel: "Dashboard" },
                                  })
                                : undefined
                            }
                            className={cn(
                              "inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors",
                              op.id
                                ? "text-gray-200"
                                : "text-gray-500 cursor-not-allowed",
                            )}
                            title="View operation details"
                            aria-label="View operation details"
                            disabled={!op.id}
                          >
                            <Icon
                              icon="mdi:eye-outline"
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
            )}
          </>
        ) : (
          <>
            <div className="md:hidden divide-y divide-[#0A4D66]/20">
              {isFetchingOps && (
                <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
              )}
              {!isFetchingOps && conductedOperationsRows.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400">
                  No operations conducted in the last 24 hours
                </div>
              )}
              {conductedOperationsRows.map((op) => (
                <div
                  key={op.id ?? `${op.name ?? "operation"}-${op.created_at ?? ""}`}
                  tabIndex={op.id ? 0 : undefined}
                  role={op.id ? "button" : undefined}
                  title={op.id ? "Click to view operation details" : undefined}
                  onClick={(e) =>
                    op.id
                      ? onInteractiveRowClick(e, () =>
                          navigate(`/dashboard/operations/${op.id}`, {
                            state: { from: "/dashboard", fromLabel: "Dashboard" },
                          }),
                        )
                      : undefined
                  }
                  onKeyDown={(e) =>
                    op.id
                      ? onInteractiveRowKeyDown(e, () =>
                          navigate(`/dashboard/operations/${op.id}`, {
                            state: { from: "/dashboard", fromLabel: "Dashboard" },
                          }),
                        )
                      : undefined
                  }
                  className={cn(
                    "space-y-3 px-4 py-4 transition-colors",
                    op.id && "cursor-pointer hover:bg-[#0A4D66]/20 focus:outline-none focus:bg-[#0A4D66]/30",
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{op.name || "—"}</p>
                    <p className="text-xs text-gray-400">
                      {op.operation_type?.name || "—"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-gray-400">Unit</p>
                    <p className="text-right text-gray-200">{op.unit?.name || "—"}</p>
                    <p className="text-gray-400">Status</p>
                    <p className="text-right text-gray-200 capitalize">{op.status || "—"}</p>
                    <p className="text-gray-400">Conducted</p>
                    <p className="text-right text-gray-200">
                      {formatDateTime(op.start_date_time ?? op.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Operation</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Conducted</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {isFetchingOps && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={5}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingOps && conductedOperationsRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={5}>
                        No operations conducted in the last 24 hours
                      </td>
                    </tr>
                  )}
                  {conductedOperationsRows.map((op) => (
                    <tr
                      key={op.id ?? `${op.name ?? "operation"}-${op.created_at ?? ""}`}
                      tabIndex={op.id ? 0 : undefined}
                      role={op.id ? "button" : undefined}
                      title={op.id ? "Click to view operation details" : undefined}
                      onClick={(e) =>
                        op.id
                          ? onInteractiveRowClick(e, () =>
                              navigate(`/dashboard/operations/${op.id}`, {
                                state: { from: "/dashboard", fromLabel: "Dashboard" },
                              }),
                            )
                          : undefined
                      }
                      onKeyDown={(e) =>
                        op.id
                          ? onInteractiveRowKeyDown(e, () =>
                              navigate(`/dashboard/operations/${op.id}`, {
                                state: { from: "/dashboard", fromLabel: "Dashboard" },
                              }),
                            )
                          : undefined
                      }
                      className={cn(
                        "border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 transition-colors",
                        op.id && "cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30",
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {op.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {op.unit?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {op.operation_type?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300 capitalize">
                        {op.status || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {formatDateTime(op.start_date_time ?? op.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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
              <CardItem
                key={c.label}
                card={c}
                onClick={() =>
                  navigate(
                    c.label === "Total" ? "/dashboard/assets" : "/dashboard/maintenance",
                    { state: { from: "/dashboard", fromLabel: "Dashboard" } },
                  )
                }
              />
            ))}
          </div>

          <TableShell
            title="Maintenance tracking"
            right={
              <TableToolbar
                resetCount={maintenance?.total_aircraft ?? 0}
                unitOptions={maintenanceUnitOptions}
                selectedUnit={selectedMaintenanceUnit}
                onChangeUnit={(value) => setTabUnitFilter("maintenance", value)}
                onResetFilter={() => resetTabUnitFilter("maintenance")}
                onDownload={handleDownloadMaintenance}
                isDownloadDisabled={filteredMaintenanceRows.length === 0}
              />
            }
          >
            <div className="md:hidden divide-y divide-[#0A4D66]/20">
              {isFetchingMaintenance && (
                <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
              )}
              {!isFetchingMaintenance && filteredMaintenanceRows.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400">
                  No recent aircrafts
                </div>
              )}
              {filteredMaintenanceRows.map((a) => (
                <div
                  key={a.id}
                  tabIndex={0}
                  role="button"
                  title="Click to view aircraft details"
                  onClick={(e) =>
                    onInteractiveRowClick(e, () =>
                      navigate(`/dashboard/assets/${a.id}`, {
                        state: { from: "/dashboard", fromLabel: "Dashboard" },
                      }),
                    )
                  }
                  onKeyDown={(e) =>
                    onInteractiveRowKeyDown(e, () =>
                      navigate(`/dashboard/assets/${a.id}`, {
                        state: { from: "/dashboard", fromLabel: "Dashboard" },
                      }),
                    )
                  }
                  className="space-y-3 px-4 py-4 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{a.name || "—"}</p>
                    <p className="text-xs text-gray-400">{a.tail_number || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-gray-400">Insp (Hrs)</p>
                    <p className="text-right text-gray-200">
                      {formatMetric(a.inspection_interval, "hrs", { space: false })}
                    </p>
                    <p className="text-gray-400">Insp (Cyc)</p>
                    <p className="text-right text-gray-200">
                      {formatMetric(a.inspection_interval_cycle, "cyc")}
                    </p>
                    <p className="text-gray-400">Total Hrs</p>
                    <p className="text-right text-gray-200">
                      {formatMetric(a.total_airframe_hours, "hrs", { space: false })}
                    </p>
                    <p className="text-gray-400">Total Cyc</p>
                    <p className="text-right text-gray-200">
                      {formatMetric(a.total_cycles, "cyc")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Tail No.</th>
                    <th className="px-4 py-3 text-left">Aircraft Name</th>
                    <th className="px-4 py-3 text-left">Insp Type (Hrs)</th>
                    <th className="px-4 py-3 text-left">Insp Type (Cyc)</th>
                    <th className="px-4 py-3 text-left">Remaining (Hrs)</th>
                    <th className="px-4 py-3 text-left">Remaining (Cyc)</th>
                    <th className="px-4 py-3 text-left">Total hrs</th>
                    <th className="px-4 py-3 text-left">Total Cyc</th>
                    <th className="px-4 py-3 text-left">Last Insp</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {isFetchingMaintenance && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={9}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingMaintenance &&
                    filteredMaintenanceRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={9}>
                          No recent aircrafts
                        </td>
                      </tr>
                    )}
                  {filteredMaintenanceRows.map((a) => {
                    const totalHours = Number(a.total_airframe_hours);
                    const totalCycles = Number(a.total_cycles);
                    const lastInspectionHours = Number(a.last_inspection_hours);
                    const lastInspectionCycles = Number(
                      a.last_inspection_cycles,
                    );
                    const intervalHours = Number(a.inspection_interval);
                    const intervalCycles = Number(a.inspection_interval_cycle);

                    const hasHourInterval =
                      intervalHours && !Number.isNaN(intervalHours);
                    const hasCycleInterval =
                      intervalCycles && !Number.isNaN(intervalCycles);

                    const remainingHours = hasHourInterval
                      ? (Number.isNaN(lastInspectionHours)
                          ? 0
                          : lastInspectionHours) +
                        intervalHours -
                        (Number.isNaN(totalHours) ? 0 : totalHours)
                      : null;

                    const remainingCycles = hasCycleInterval
                      ? (Number.isNaN(lastInspectionCycles)
                          ? 0
                          : lastInspectionCycles) +
                        intervalCycles -
                        (Number.isNaN(totalCycles) ? 0 : totalCycles)
                      : null;

                    const remainingHoursDisplay =
                      typeof remainingHours === "number"
                        ? formatRemainingMetric(remainingHours, "hrs", {
                            warnThreshold: 10,
                          })
                        : { text: "—", className: "text-gray-400" };

                    const remainingCyclesDisplay =
                      typeof remainingCycles === "number"
                        ? formatRemainingMetric(remainingCycles, "cyc", {
                            warnThreshold: 10,
                          })
                        : { text: "—", className: "text-gray-400" };

                    return (
                      <tr
                        key={a.id}
                        tabIndex={0}
                        role="button"
                        title="Click to view aircraft details"
                        onClick={(e) =>
                          onInteractiveRowClick(e, () =>
                            navigate(`/dashboard/assets/${a.id}`, {
                              state: { from: "/dashboard", fromLabel: "Dashboard" },
                            }),
                          )
                        }
                        onKeyDown={(e) =>
                          onInteractiveRowKeyDown(e, () =>
                            navigate(`/dashboard/assets/${a.id}`, {
                              state: { from: "/dashboard", fromLabel: "Dashboard" },
                            }),
                          )
                        }
                        className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
                      >
                        <td className="px-4 py-3 text-gray-300">
                          {a.tail_number || "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-7 rounded bg-[#001219] border border-[#0A4D66]/40 flex items-center justify-center">
                              <Icon
                                icon="mdi:airplane"
                                className="w-5 h-5 text-gray-200"
                              />
                            </span>
                            <span>{a.name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatMetric(a.inspection_interval, "hrs", {
                            space: false,
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatMetric(a.inspection_interval_cycle, "cyc")}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3",
                            remainingHoursDisplay.className,
                          )}
                        >
                          {remainingHoursDisplay.text}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3",
                            remainingCyclesDisplay.className,
                          )}
                        >
                          {remainingCyclesDisplay.text}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatMetric(a.total_airframe_hours, "hrs", {
                            space: false,
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatMetric(a.total_cycles, "cyc")}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatMetric(a.last_inspection_hours, "hrs")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TableShell>

          <TableShell title="Spares Coming Due">
            <div className="md:hidden divide-y divide-[#0A4D66]/20">
              {isFetchingMaintenance && (
                <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
              )}
              {!isFetchingMaintenance && comingDueRows.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400">
                  No spares approaching their remaining hours/cycles limit
                </div>
              )}
              {comingDueRows.map((item) => {
                const hoursDisplay =
                  item.hours_remaining !== null
                    ? formatRemainingMetric(item.hours_remaining, "hrs")
                    : null;
                const cyclesDisplay =
                  item.cycles_remaining !== null
                    ? formatRemainingMetric(item.cycles_remaining, "cyc")
                    : null;
                const destUrl = item.asset_id
                  ? `/dashboard/assets/${item.asset_id}`
                  : "/dashboard/maintenance";
                return (
                  <div
                    key={`${item.part_type}-${item.part_id}`}
                    tabIndex={0}
                    role="button"
                    title="Click to view details"
                    onClick={(e) =>
                      onInteractiveRowClick(e, () =>
                        navigate(destUrl, {
                          state: { from: "/dashboard", fromLabel: "Dashboard" },
                        }),
                      )
                    }
                    onKeyDown={(e) =>
                      onInteractiveRowKeyDown(e, () =>
                        navigate(destUrl, {
                          state: { from: "/dashboard", fromLabel: "Dashboard" },
                        }),
                      )
                    }
                    className="space-y-3 px-4 py-4 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.part_label}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.asset_name}
                        {item.asset_tail_number ? ` (${item.asset_tail_number})` : ""}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <p className="text-gray-400">Type</p>
                      <p className="text-right text-gray-200 capitalize">
                        {item.part_type}
                      </p>
                      <p className="text-gray-400">Remaining Hrs</p>
                      <p className={cn("text-right", hoursDisplay?.className ?? "text-gray-400")}>
                        {hoursDisplay?.text ?? "—"}
                      </p>
                      <p className="text-gray-400">Remaining Cyc</p>
                      <p className={cn("text-right", cyclesDisplay?.className ?? "text-gray-400")}>
                        {cyclesDisplay?.text ?? "—"}
                      </p>
                      <p className="text-gray-400">Status</p>
                      <p
                        className={cn(
                          "text-right capitalize",
                          item.status === "overdue" ? "text-red-400" : "text-amber-400",
                        )}
                      >
                        {item.status.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-[#0A4D66]/30">
                    <th className="px-4 py-3 text-left">Part</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Aircraft</th>
                    <th className="px-4 py-3 text-left">Remaining Hrs</th>
                    <th className="px-4 py-3 text-left">Remaining Cyc</th>
                    <th className="px-4 py-3 text-left">Status</th>
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
                  {!isFetchingMaintenance && comingDueRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={6}>
                        No spares approaching their remaining hours/cycles limit
                      </td>
                    </tr>
                  )}
                  {comingDueRows.map((item) => {
                    const hoursDisplay =
                      item.hours_remaining !== null
                        ? formatRemainingMetric(item.hours_remaining, "hrs")
                        : null;
                    const cyclesDisplay =
                      item.cycles_remaining !== null
                        ? formatRemainingMetric(item.cycles_remaining, "cyc")
                        : null;
                    const destUrl = item.asset_id
                      ? `/dashboard/assets/${item.asset_id}`
                      : "/dashboard/maintenance";
                    return (
                      <tr
                        key={`${item.part_type}-${item.part_id}`}
                        tabIndex={0}
                        role="button"
                        title="Click to view details"
                        onClick={(e) =>
                          onInteractiveRowClick(e, () =>
                            navigate(destUrl, {
                              state: { from: "/dashboard", fromLabel: "Dashboard" },
                            }),
                          )
                        }
                        onKeyDown={(e) =>
                          onInteractiveRowKeyDown(e, () =>
                            navigate(destUrl, {
                              state: { from: "/dashboard", fromLabel: "Dashboard" },
                            }),
                          )
                        }
                        className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {item.part_label}
                        </td>
                        <td className="px-4 py-3 text-gray-300 capitalize">
                          {item.part_type}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {item.asset_name}
                          {item.asset_tail_number ? ` (${item.asset_tail_number})` : ""}
                        </td>
                        <td className={cn("px-4 py-3", hoursDisplay?.className ?? "text-gray-400")}>
                          {hoursDisplay?.text ?? "—"}
                        </td>
                        <td className={cn("px-4 py-3", cyclesDisplay?.className ?? "text-gray-400")}>
                          {cyclesDisplay?.text ?? "—"}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 capitalize",
                            item.status === "overdue" ? "text-red-400" : "text-amber-400",
                          )}
                        >
                          {item.status.replace("_", " ")}
                        </td>
                      </tr>
                    );
                  })}
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
              <CardItem
                key={c.label}
                card={c}
                onClick={() =>
                  navigate("/dashboard/finance", {
                    state: { from: "/dashboard", fromLabel: "Dashboard" },
                  })
                }
              />
            ))}
          </div>

          <TableShell
            title="Recent finance log"
            right={
              <TableToolbar
                resetCount={expenses.length}
                unitOptions={financeUnitOptions}
                selectedUnit={selectedFinanceUnit}
                onChangeUnit={(value) => setTabUnitFilter("finances", value)}
                onResetFilter={() => resetTabUnitFilter("finances")}
                onDownload={handleDownloadFinance}
                isDownloadDisabled={filteredFinanceRows.length === 0}
              />
            }
          >
            <div className="md:hidden divide-y divide-[#0A4D66]/20">
              {isFetchingFinance && (
                <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
              )}
              {!isFetchingFinance && filteredFinanceRows.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400">
                  No recent finance logs
                </div>
              )}
              {filteredFinanceRows.slice(0, 7).map((e) => (
                <div
                  key={e.id}
                  tabIndex={0}
                  role="button"
                  title="Click to view finance details"
                  onClick={(ev) =>
                    onInteractiveRowClick(ev, () =>
                      navigate("/dashboard/finance", {
                        state: {
                          from: "/dashboard",
                          fromLabel: "Dashboard",
                          activeTab: "expenses",
                          expenseId: e.id,
                        },
                      }),
                    )
                  }
                  onKeyDown={(ev) =>
                    onInteractiveRowKeyDown(ev, () =>
                      navigate("/dashboard/finance", {
                        state: {
                          from: "/dashboard",
                          fromLabel: "Dashboard",
                          activeTab: "expenses",
                          expenseId: e.id,
                        },
                      }),
                    )
                  }
                  className="space-y-3 px-4 py-4 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{e.part_name || "—"}</p>
                    <p className="text-xs text-gray-400">{e.expense_category?.name || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-gray-400">Quantity</p>
                    <p className="text-right text-gray-200">{e.quantity ?? "—"}</p>
                    <p className="text-gray-400">Unit Cost</p>
                    <p className="text-right text-gray-200">
                      {typeof e.unit_cost === "number" ? `₦${e.unit_cost.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-gray-400">Total Cost</p>
                    <p className="text-right text-gray-200">
                      {typeof e.total_cost === "number" ? `₦${e.total_cost.toLocaleString()}` : "—"}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/dashboard/finance", {
                          state: {
                            from: "/dashboard",
                            fromLabel: "Dashboard",
                            activeTab: "expenses",
                            expenseId: e.id,
                          },
                        })
                      }
                      className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                      title="View finance details"
                      aria-label="View finance details"
                    >
                      <Icon icon="mdi:dots-horizontal" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
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
                      <td className="px-4 py-6 text-gray-400" colSpan={7}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingFinance && filteredFinanceRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-400" colSpan={7}>
                        No recent finance logs
                      </td>
                    </tr>
                  )}
                  {filteredFinanceRows.slice(0, 7).map((e) => (
                    <tr
                      key={e.id}
                      tabIndex={0}
                      role="button"
                      title="Click to view finance details"
                      onClick={(ev) =>
                        onInteractiveRowClick(ev, () =>
                          navigate("/dashboard/finance", {
                            state: {
                              from: "/dashboard",
                              fromLabel: "Dashboard",
                              activeTab: "expenses",
                              expenseId: e.id,
                            },
                          }),
                        )
                      }
                      onKeyDown={(ev) =>
                        onInteractiveRowKeyDown(ev, () =>
                          navigate("/dashboard/finance", {
                            state: {
                              from: "/dashboard",
                              fromLabel: "Dashboard",
                              activeTab: "expenses",
                              expenseId: e.id,
                            },
                          }),
                        )
                      }
                      className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
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
                          onClick={() =>
                            navigate("/dashboard/finance", {
                              state: {
                                activeTab: "expenses",
                                expenseId: e.id,
                              },
                            })
                          }
                          className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                          title="View finance details"
                          aria-label="View finance details"
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
              <CardItem
                key={c.label}
                card={c}
                onClick={() =>
                  navigate("/dashboard/inventory", {
                    state: { from: "/dashboard", fromLabel: "Dashboard" },
                  })
                }
              />
            ))}
          </div>

          <TableShell
            title="Recent inventories"
            right={
              <TableToolbar
                resetCount={inventories?.recent_inventories?.length ?? 0}
                unitOptions={inventoryUnitOptions}
                selectedUnit={selectedInventoryUnit}
                onChangeUnit={(value) => setTabUnitFilter("inventory", value)}
                onResetFilter={() => resetTabUnitFilter("inventory")}
                onDownload={handleDownloadInventory}
                isDownloadDisabled={filteredInventoryRows.length === 0}
              />
            }
          >
            <div className="md:hidden divide-y divide-[#0A4D66]/20">
              {isFetchingInventory && (
                <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
              )}
              {!isFetchingInventory && filteredInventoryRows.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400">
                  No recent inventories
                </div>
              )}
              {filteredInventoryRows.slice(0, 7).map((i) => (
                <div
                  key={i.id}
                  tabIndex={0}
                  role="button"
                  title="Click to view inventory details"
                  onClick={(ev) =>
                    onInteractiveRowClick(ev, () =>
                      navigate(`/dashboard/inventory/${i.id}`, {
                        state: { from: "/dashboard", fromLabel: "Dashboard" },
                      }),
                    )
                  }
                  onKeyDown={(ev) =>
                    onInteractiveRowKeyDown(ev, () =>
                      navigate(`/dashboard/inventory/${i.id}`, {
                        state: { from: "/dashboard", fromLabel: "Dashboard" },
                      }),
                    )
                  }
                  className="space-y-3 px-4 py-4 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{i.description || "—"}</p>
                    <p className="text-xs text-gray-400">{i.part_number || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-gray-400">Current Stock</p>
                    <p className="text-right text-gray-200">
                      {typeof i.current_stock === "number" ? i.current_stock : "—"}
                    </p>
                    <p className="text-gray-400">Unit</p>
                    <p className="text-right text-gray-200">{i.unit?.name || "—"}</p>
                    <p className="text-gray-400">Expiry</p>
                    <p className="text-right text-gray-200">{i.expiry_date || "—"}</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/dashboard/inventory/${i.id}`, {
                          state: { from: "/dashboard", fromLabel: "Dashboard" },
                        })
                      }
                      className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                      title="View inventory details"
                      aria-label="View inventory details"
                    >
                      <Icon icon="mdi:dots-horizontal" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
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
                      <td className="px-4 py-6 text-gray-400" colSpan={7}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingInventory &&
                    filteredInventoryRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={7}>
                          No recent inventories
                        </td>
                      </tr>
                    )}
                  {filteredInventoryRows
                    .slice(0, 7)
                    .map((i) => (
                      <tr
                        key={i.id}
                        tabIndex={0}
                        role="button"
                        title="Click to view inventory details"
                        onClick={(ev) =>
                          onInteractiveRowClick(ev, () =>
                            navigate(`/dashboard/inventory/${i.id}`, {
                              state: { from: "/dashboard", fromLabel: "Dashboard" },
                            }),
                          )
                        }
                        onKeyDown={(ev) =>
                          onInteractiveRowKeyDown(ev, () =>
                            navigate(`/dashboard/inventory/${i.id}`, {
                              state: { from: "/dashboard", fromLabel: "Dashboard" },
                            }),
                          )
                        }
                        className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
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
                            title="View inventory details"
                            aria-label="View inventory details"
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
              <CardItem
                key={c.label}
                card={c}
                onClick={() =>
                  navigate("/dashboard/personnel", {
                    state: { from: "/dashboard", fromLabel: "Dashboard" },
                  })
                }
              />
            ))}
          </div>

          <TableShell
            title="Recent personnel"
            right={
              <TableToolbar
                resetCount={personnel?.recent_personnel?.length ?? 0}
                unitOptions={personnelUnitOptions}
                selectedUnit={selectedPersonnelUnit}
                onChangeUnit={(value) => setTabUnitFilter("personnel", value)}
                onResetFilter={() => resetTabUnitFilter("personnel")}
                onDownload={handleDownloadPersonnel}
                isDownloadDisabled={filteredPersonnelRows.length === 0}
              />
            }
          >
            <div className="md:hidden divide-y divide-[#0A4D66]/20">
              {isFetchingPersonnel && (
                <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
              )}
              {!isFetchingPersonnel && filteredPersonnelRows.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400">
                  No recent personnel
                </div>
              )}
              {filteredPersonnelRows.slice(0, 7).map((p) => (
                <div
                  key={p.id}
                  tabIndex={0}
                  role="button"
                  title="Click to view personnel details"
                  onClick={(ev) =>
                    onInteractiveRowClick(ev, () =>
                      navigate(`/dashboard/personnel/${p.id}`, {
                        state: { from: "/dashboard", fromLabel: "Dashboard" },
                      }),
                    )
                  }
                  onKeyDown={(ev) =>
                    onInteractiveRowKeyDown(ev, () =>
                      navigate(`/dashboard/personnel/${p.id}`, {
                        state: { from: "/dashboard", fromLabel: "Dashboard" },
                      }),
                    )
                  }
                  className="space-y-3 px-4 py-4 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {p.full_name ||
                        `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() ||
                        "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.rank?.abbreviation || p.rank?.name || "—"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-gray-400">Unit</p>
                    <p className="text-right text-gray-200">{p.unit?.name || "—"}</p>
                    <p className="text-gray-400">Branch</p>
                    <p className="text-right text-gray-200">{p.branch?.name || "—"}</p>
                    <p className="text-gray-400">Status</p>
                    <p className="text-right text-gray-200">{p.status || "—"}</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/dashboard/personnel/${p.id}`, {
                          state: { from: "/dashboard", fromLabel: "Dashboard" },
                        })
                      }
                      className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[#0A4D66]/30 transition-colors text-gray-200"
                      title="View personnel details"
                      aria-label="View personnel details"
                    >
                      <Icon icon="mdi:dots-horizontal" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block w-full overflow-x-auto">
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
                      <td className="px-4 py-6 text-gray-400" colSpan={7}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!isFetchingPersonnel &&
                    filteredPersonnelRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-gray-400" colSpan={7}>
                          No recent personnel
                        </td>
                      </tr>
                    )}
                  {filteredPersonnelRows.slice(0, 7).map((p) => (
                    <tr
                      key={p.id}
                      tabIndex={0}
                      role="button"
                      title="Click to view personnel details"
                      onClick={(ev) =>
                        onInteractiveRowClick(ev, () =>
                          navigate(`/dashboard/personnel/${p.id}`, {
                            state: { from: "/dashboard", fromLabel: "Dashboard" },
                          }),
                        )
                      }
                      onKeyDown={(ev) =>
                        onInteractiveRowKeyDown(ev, () =>
                          navigate(`/dashboard/personnel/${p.id}`, {
                            state: { from: "/dashboard", fromLabel: "Dashboard" },
                          }),
                        )
                      }
                      className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:bg-[#0A4D66]/30"
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
                          title="View personnel details"
                          aria-label="View personnel details"
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
