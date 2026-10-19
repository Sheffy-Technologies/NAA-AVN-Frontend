import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { MetricCard, type MetricBadgeColor } from "@/shared/ui/metric/MetricCard";
import {
  useGetMaintenanceMetricsQuery,
  useGetMaintenanceDueItemsQuery,
  useGetWorkOrdersQuery,
} from "@/features/maintenance/api";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useGetPurchaseOrdersQuery, useGetInventoriesQuery } from "@/features/inventory/api";

type MaintenanceOverviewTabProps = {
  onNavigateTab: (tabId: "maintenance" | "work-orders" | "inventory", subTabId?: string) => void;
  onOpenCreateWorkOrder?: () => void;
  onOpenLogDefect?: () => void;
};

export const MaintenanceOverviewTab = ({
  onNavigateTab,
  onOpenCreateWorkOrder,
  onOpenLogDefect,
}: MaintenanceOverviewTabProps) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const { data: metricsData } = useGetMaintenanceMetricsQuery();
  const { data: aircraftData, isLoading: isAircraftLoading } = useGetAssetsQuery({ type: "aircraft" });
  const { data: dueItemsData } = useGetMaintenanceDueItemsQuery({ asset_type: "aircraft" });
  const { data: purchaseOrdersData } = useGetPurchaseOrdersQuery();
  const { data: workOrdersData } = useGetWorkOrdersQuery();
  const { data: inventories = [], isLoading: isInventoriesLoading } = useGetInventoriesQuery();

  const summary = metricsData?.summary;
  const recentWorkOrders = useMemo(() => {
    if (workOrdersData && workOrdersData.length > 0) {
      return workOrdersData.slice(0, 5);
    }
    return (metricsData?.recent?.work_orders ?? []).map((wo) => ({
      id: wo.id,
      title: wo.title,
      asset_id: wo.asset_id,
      created_at: wo.created_at,
      status: "pending",
      tasks: [],
    }));
  }, [workOrdersData, metricsData]);

  const dueItems = useMemo(() => dueItemsData?.data ?? [], [dueItemsData]);
  const overdueCount = dueItemsData?.counts_by_status?.overdue ?? dueItems.filter((i) => i.status === "overdue").length;
  const dueSoonCount = dueItemsData?.counts_by_status?.due_soon ?? dueItems.filter((i) => i.status === "due_soon").length;

  // Filter state for Due / Overdue Components
  const [dueComponentFilter, setDueComponentFilter] = useState<"all" | "overdue" | "due_soon">("all");
  // Filter state for Spares Watchlist (Low in Stock / Expired / Critical)
  const [sparesWatchFilter, setSparesWatchFilter] = useState<"all" | "low" | "expired" | "critical">("all");

  const filteredDueItems = useMemo(() => {
    if (dueComponentFilter === "overdue") return dueItems.filter((i) => i.status === "overdue");
    if (dueComponentFilter === "due_soon") return dueItems.filter((i) => i.status === "due_soon");
    return dueItems;
  }, [dueItems, dueComponentFilter]);

  // Inventory Metrics & Watchlist Calculation
  const totalInventoryItems = inventories.length;
  const totalStockCount = useMemo(() => {
    return inventories.reduce((sum, item) => sum + (Number(item.current_stock) || 0), 0);
  }, [inventories]);

  const { criticalCount, lowStockCount, expiredCount, alertInventoryItems } = useMemo(() => {
    let critical = 0;
    let low = 0;
    let expired = 0;
    const alertList: Array<{
      item: (typeof inventories)[0];
      alertType: "critical" | "expired" | "low";
      badgeText: string;
    }> = [];

    const now = new Date();

    for (const item of inventories) {
      const isItemExpired = Boolean(
        item.expiry_date && !Number.isNaN(new Date(item.expiry_date).getTime()) && new Date(item.expiry_date) < now,
      );

      const level = (item.stock_level ?? "").toLowerCase();
      const currentStock = Number(item.current_stock) || 0;
      const reorderLevel = Number(item.re_order_level) || 0;

      const isItemCritical =
        level === "critical" || level === "out of stock" || (reorderLevel > 0 && currentStock <= 0) || currentStock <= 0;
      const isItemLow = (level === "low" || (reorderLevel > 0 && currentStock <= reorderLevel)) && !isItemCritical;

      if (isItemExpired) {
        expired++;
        alertList.push({ item, alertType: "expired", badgeText: "Expired" });
      } else if (isItemCritical) {
        critical++;
        alertList.push({ item, alertType: "critical", badgeText: "Critical" });
      } else if (isItemLow) {
        low++;
        alertList.push({ item, alertType: "low", badgeText: "Low Stock" });
      }
    }

    alertList.sort((a, b) => {
      const priority = { critical: 0, expired: 1, low: 2 };
      return priority[a.alertType] - priority[b.alertType];
    });

    return {
      criticalCount: critical,
      lowStockCount: low,
      expiredCount: expired,
      alertInventoryItems: alertList,
    };
  }, [inventories]);

  const filteredAlertInventoryItems = useMemo(() => {
    if (sparesWatchFilter === "all") return alertInventoryItems;
    return alertInventoryItems.filter((a) => a.alertType === sparesWatchFilter);
  }, [alertInventoryItems, sparesWatchFilter]);

  // Formatter for hours, cycles, and calendar months due/overdue
  const formatDueItemSubtitle = (item: (typeof dueItems)[0]) => {
    const isOverdue = item.status === "overdue";
    const parts: string[] = [];

    if (item.hours_remaining !== null) {
      const h = Math.abs(item.hours_remaining);
      parts.push(isOverdue ? `${h.toLocaleString()} hrs overdue` : `${h.toLocaleString()} hrs left`);
    }

    if (item.cycles_remaining !== null) {
      const c = Math.abs(item.cycles_remaining);
      parts.push(isOverdue ? `${c} cyc overdue` : `${c} cyc left`);
    }

    if (item.days_remaining !== null) {
      const d = Math.abs(item.days_remaining);
      const mo = Math.ceil(d / 30);
      if (isOverdue) {
        parts.push(`${d} days (${mo} mo) overdue`);
      } else {
        parts.push(d <= 30 ? `${d} days left (<1 mo)` : `${mo} mo left (${d} days)`);
      }
    }

    if (parts.length > 0) {
      return parts.join(" · ");
    }

    if (item.projected_due_date || item.next_due_date) {
      return `Due: ${formatDate(item.projected_due_date || item.next_due_date)}`;
    }

    return isOverdue ? "Overdue for maintenance" : "Inspection scheduled";
  };

  // Fleet Readiness Calculation
  const totalAircraft = aircraftData?.length ?? 0;
  const serviceableAircraft = useMemo(() => {
    return (aircraftData ?? []).filter(
      (a) =>
        a.serviceability_status === "serviceable" ||
        a.operation_status === "operational" ||
        a.operation_status === "serviceable",
    ).length;
  }, [aircraftData]);

  // 8 Core Metrics
  const coreMetrics = useMemo(
    () => [
      {
        id: "total_aircraft",
        label: "Total Aircraft",
        value: isAircraftLoading ? "..." : String(totalAircraft),
        icon: "mdi:airplane",
        badge: `${serviceableAircraft} Serviceable`,
        badgeColor: "emerald",
        onClick: () => navigate("/dashboard/assets"),
      },
      {
        id: "work_orders",
        label: "Work Orders",
        value: String(summary?.total_work_orders ?? workOrdersData?.length ?? 0),
        icon: "mdi:file-document-edit-outline",
        badge: "Active Orders",
        badgeColor: "sky",
        onClick: () => onNavigateTab("work-orders", "work-orders"),
      },
      {
        id: "purchase_orders",
        label: "Purchase Orders",
        value: String(purchaseOrdersData?.length ?? 0),
        icon: "mdi:cart-outline",
        badge: "Supply Chain",
        badgeColor: "indigo",
        onClick: () => onNavigateTab("inventory", "purchase-orders"),
      },
      {
        id: "open_defects",
        label: "Open Defects",
        value: String(summary?.open_defects ?? 0),
        icon: "mdi:alert-circle-outline",
        badge: (summary?.open_defects ?? 0) > 0 ? "Requires Attention" : "Clear",
        badgeColor: (summary?.open_defects ?? 0) > 0 ? "amber" : "emerald",
        onClick: () => onNavigateTab("work-orders", "defects"),
      },
      {
        id: "compliance_due",
        label: "Compliance Due (30d)",
        value: String(summary?.compliance_due_next_30_days ?? 0),
        icon: "mdi:clipboard-text-clock-outline",
        badge: "AD / SB / Phase",
        badgeColor: "blue",
        onClick: () => onNavigateTab("maintenance", "compliance"),
      },
      {
        id: "resolution_rate",
        label: "Resolution Rate",
        value: `${summary?.defect_resolution_rate ?? 0}%`,
        icon: "mdi:check-decagram-outline",
        badge: "MRO Target: 85%+",
        badgeColor: "teal",
        onClick: () => onNavigateTab("work-orders", "defects"),
      },
      {
        id: "total_components",
        label: "Components Tracked",
        value: String(dueItemsData?.count ?? dueItems.length),
        icon: "mdi:cogs",
        badge: `${overdueCount} Overdue`,
        badgeColor: overdueCount > 0 ? "red" : "emerald",
        onClick: () => onNavigateTab("maintenance", "tracking"),
      },
      {
        id: "inventory_spares",
        label: "Inventory Spares",
        value: isInventoriesLoading ? "..." : String(totalInventoryItems),
        icon: "mdi:package-variant-closed",
        badge:
          alertInventoryItems.length > 0
            ? `${alertInventoryItems.length} Low / Alert`
            : `${totalStockCount.toLocaleString()} In Stock`,
        badgeColor: alertInventoryItems.length > 0 ? "amber" : "emerald",
        onClick: () => onNavigateTab("inventory", "stocks"),
      },
    ],
    [
      totalAircraft,
      serviceableAircraft,
      isAircraftLoading,
      summary,
      workOrdersData,
      purchaseOrdersData,
      dueItemsData,
      dueItems.length,
      overdueCount,
      totalInventoryItems,
      totalStockCount,
      alertInventoryItems.length,
      isInventoriesLoading,
      navigate,
      onNavigateTab,
    ],
  );

  const formatDate = (val?: string | null) => {
    if (!val) return "-";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* 7 Core Metrics Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-600")}>
            Core Key Performance Indicators
          </h3>
          <span className={cn("text-[11px]", isDark ? "text-gray-500" : "text-slate-400")}>
            Click any metric to drill down
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {coreMetrics.map((item) => (
            <MetricCard
              key={item.id}
              id={item.id}
              label={item.label}
              value={item.value}
              icon={item.icon}
              badge={item.badge}
              badgeColor={item.badgeColor as MetricBadgeColor}
              onClick={item.onClick}
            />
          ))}
        </div>
      </div>

      {/* Quick Action Dispatcher */}
      <div
        className={cn(
          "rounded-xl border p-4",
          isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">
              Quick Maintenance Dispatcher
            </h4>
            <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
              Immediate access to critical MRO workflows and requisition issuance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (onOpenCreateWorkOrder ? onOpenCreateWorkOrder() : onNavigateTab("work-orders", "work-orders"))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm transition-colors"
            >
              <Icon icon="mdi:plus-circle-outline" className="w-4 h-4" />
              <span>Create Work Order</span>
            </button>
            <button
              type="button"
              onClick={() => (onOpenLogDefect ? onOpenLogDefect() : onNavigateTab("work-orders", "defects"))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm transition-colors"
            >
              <Icon icon="mdi:alert-octagon-outline" className="w-4 h-4" />
              <span>Log Defect / Snag</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("maintenance", "programs")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm transition-colors"
            >
              <Icon icon="mdi:calendar-clock" className="w-4 h-4" />
              <span>Schedule Inspection</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("inventory", "parts-requisitions")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm transition-colors"
            >
              <Icon icon="mdi:package-variant-plus" className="w-4 h-4" />
              <span>Request Spare Part</span>
            </button>
          </div>
        </div>
      </div>

      {/* Three Column Layout: Recent Work Orders, Due Inspections, and Low Stock Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Work Orders */}
        <div
          className={cn(
            "rounded-xl border p-5 flex flex-col justify-between",
            isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:file-document-edit-outline" className="w-5 h-5 text-[#0A4D66] dark:text-[#7FD5FF]" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Recent Work Orders</h4>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("work-orders", "work-orders")}
                className="text-xs font-medium text-[#0A4D66] dark:text-[#7FD5FF] hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <Icon icon="mdi:chevron-right" className="w-4 h-4" />
              </button>
            </div>

            {recentWorkOrders.length === 0 ? (
              <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                No work orders recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentWorkOrders.map((wo) => (
                  <div
                    key={wo.id}
                    onClick={() => navigate(`/dashboard/maintenance/work-orders/${wo.id}`)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      isDark
                        ? "bg-[#001825] border-[#0A4D66]/30 hover:border-[#7FD5FF]/50"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100",
                    )}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-semibold truncate">
                        {wo.title || `Work Order #${wo.id}`}
                      </div>
                      <div className={cn("text-[11px] mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
                        Asset ID: {wo.asset_id ?? "-"} • Created: {formatDate(wo.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        WO #{wo.id}
                      </span>
                      <Icon icon="mdi:chevron-right" className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Critical Inspections & Due Tracking (Components) */}
        <div
          className={cn(
            "rounded-xl border p-5 flex flex-col justify-between",
            isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:timeline-clock-outline" className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Component Alerts</h4>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("maintenance", "tracking")}
                className="text-xs font-medium text-[#0A4D66] dark:text-[#7FD5FF] hover:underline flex items-center gap-1"
              >
                <span>View tracking</span>
                <Icon icon="mdi:chevron-right" className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs for Due / Overdue */}
            <div className="flex items-center gap-1.5 mb-3.5 pb-1 border-b border-slate-200/50 dark:border-slate-800/60 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => setDueComponentFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors shrink-0",
                  dueComponentFilter === "all"
                    ? "bg-[#0A4D66] text-white shadow-sm font-semibold"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-slate-800/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                All ({dueItems.length})
              </button>
              <button
                type="button"
                onClick={() => setDueComponentFilter("overdue")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors shrink-0",
                  dueComponentFilter === "overdue"
                    ? "bg-[#0A4D66] text-white shadow-sm font-semibold"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-slate-800/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                Overdue ({overdueCount})
              </button>
              <button
                type="button"
                onClick={() => setDueComponentFilter("due_soon")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors shrink-0",
                  dueComponentFilter === "due_soon"
                    ? "bg-[#0A4D66] text-white shadow-sm font-semibold"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-slate-800/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                Due Soon ({dueSoonCount})
              </button>
            </div>

            {filteredDueItems.length === 0 ? (
              <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                {dueComponentFilter === "overdue"
                  ? "No overdue components detected."
                  : dueComponentFilter === "due_soon"
                    ? "No components due soon."
                    : "No due or overdue components currently detected."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredDueItems.slice(0, 5).map((item, idx) => {
                  const isOverdue = item.status === "overdue";
                  const isDueSoon = item.status === "due_soon";
                  return (
                    <div
                      key={`${item.part_type}-${item.part_id}-${idx}`}
                      onClick={() => onNavigateTab("maintenance", "tracking")}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        isOverdue
                          ? isDark
                            ? "bg-red-950/20 border-red-500/30 text-white hover:bg-red-950/30"
                            : "bg-red-50/80 border-red-200 text-red-900 hover:bg-red-100/70"
                          : isDueSoon
                            ? isDark
                              ? "bg-amber-950/20 border-amber-500/30 text-white hover:bg-amber-950/30"
                              : "bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/70"
                            : isDark
                              ? "bg-emerald-950/15 border-emerald-500/20 text-white hover:bg-emerald-950/25"
                              : "bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70",
                      )}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-semibold truncate">
                          {item.part_label}
                          <span className="font-normal opacity-80 text-[11px] ml-1.5">
                            ({item.asset_name})
                          </span>
                        </div>
                        <div
                          className={cn(
                            "text-[11px] mt-0.5 font-medium",
                            isOverdue
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : isDueSoon
                                ? "text-amber-700 dark:text-amber-400"
                                : "opacity-75",
                          )}
                        >
                          {formatDueItemSubtitle(item)}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0",
                          isOverdue
                            ? isDark
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : "bg-red-100 text-red-800 border-red-300 font-bold"
                            : isDueSoon
                              ? isDark
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                              : isDark
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
                        )}
                      >
                        {isOverdue ? "Overdue" : isDueSoon ? "Due Soon" : "OK"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock & Critical Inventory Watchlist (Spares) */}
        <div
          className={cn(
            "rounded-xl border p-5 flex flex-col justify-between",
            isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:package-variant-alert" className="w-5 h-5 text-red-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Inventory Alerts</h4>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("inventory", "stocks")}
                className="text-xs font-medium text-[#0A4D66] dark:text-[#7FD5FF] hover:underline flex items-center gap-1"
              >
                <span>View inventory</span>
                <Icon icon="mdi:chevron-right" className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs for Spares Watch */}
            <div className="flex items-center gap-1.5 mb-3.5 pb-1 border-b border-slate-200/50 dark:border-slate-800/60 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => setSparesWatchFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors shrink-0",
                  sparesWatchFilter === "all"
                    ? "bg-[#0A4D66] text-white shadow-sm font-semibold"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-slate-800/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                All ({alertInventoryItems.length})
              </button>
              <button
                type="button"
                onClick={() => setSparesWatchFilter("low")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors shrink-0",
                  sparesWatchFilter === "low"
                    ? "bg-[#0A4D66] text-white shadow-sm font-semibold"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-slate-800/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                Low Stock ({lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setSparesWatchFilter("expired")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors shrink-0",
                  sparesWatchFilter === "expired"
                    ? "bg-[#0A4D66] text-white shadow-sm font-semibold"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-slate-800/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                Expired ({expiredCount})
              </button>
              <button
                type="button"
                onClick={() => setSparesWatchFilter("critical")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors shrink-0",
                  sparesWatchFilter === "critical"
                    ? "bg-[#0A4D66] text-white shadow-sm font-semibold"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-slate-800/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                Critical ({criticalCount})
              </button>
            </div>

            {filteredAlertInventoryItems.length === 0 ? (
              <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                {sparesWatchFilter === "expired"
                  ? "No expired inventory items."
                  : sparesWatchFilter === "critical"
                    ? "No critical out-of-stock items."
                    : sparesWatchFilter === "low"
                      ? "No low stock items."
                      : "All inventory stock levels are healthy."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAlertInventoryItems.slice(0, 5).map(({ item, alertType, badgeText }) => {
                  const isCritical = alertType === "critical";
                  const isExpired = alertType === "expired";
                  return (
                    <div
                      key={item.id}
                      onClick={() => onNavigateTab("inventory", "stocks")}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        isCritical
                          ? isDark
                            ? "bg-red-950/20 border-red-500/30 text-white hover:bg-red-950/30"
                            : "bg-red-50/80 border-red-200 text-red-900 hover:bg-red-100/70"
                          : isExpired
                            ? isDark
                              ? "bg-rose-950/20 border-rose-500/30 text-white hover:bg-rose-950/30"
                              : "bg-rose-50/80 border-rose-200 text-rose-900 hover:bg-rose-100/70"
                            : isDark
                              ? "bg-amber-950/20 border-amber-500/30 text-white hover:bg-amber-950/30"
                              : "bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/70",
                      )}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-semibold truncate">
                          {item.description || item.part_name || item.part_number}
                          <span className="font-normal opacity-80 text-[11px] ml-1.5">
                            ({item.part_number})
                          </span>
                        </div>
                        <div
                          className={cn(
                            "text-[11px] mt-0.5 font-medium",
                            isCritical
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : isExpired
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {isExpired
                            ? `Expired: ${formatDate(item.expiry_date)} • Qty: ${item.current_stock} remaining`
                            : isCritical
                              ? `Critical Shortage • Out of Stock (0 remaining / Min: ${item.re_order_level})`
                              : `Current: ${item.current_stock} ${item.measurement_unit || "units"} (Reorder Level: ${item.re_order_level})`}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0",
                          isCritical
                            ? isDark
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : "bg-red-100 text-red-800 border-red-300 font-bold"
                            : isExpired
                              ? isDark
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                              : isDark
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-amber-100 text-amber-900 border-amber-300 font-bold",
                        )}
                      >
                        {badgeText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
