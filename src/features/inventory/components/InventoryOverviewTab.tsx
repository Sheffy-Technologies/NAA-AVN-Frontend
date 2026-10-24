import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { MetricCard } from "@/shared/ui/metric/MetricCard";
import {
  useGetInventoriesQuery,
  useGetStoresQuery,
  useGetInventoryRequisitionsQuery,
  useGetPurchaseOrdersQuery,
  useGetShipmentsQuery,
  useGetStockMovementsQuery,
  useGetSuppliersQuery,
  useGetExpenseCategoriesQuery,
  type InventoryItem,
} from "../api";
import {
  formatDateShort,
  formatCategoryName,
  normalizeRequisitionStatus,
} from "../inventoryUtils";

interface InventoryOverviewTabProps {
  onNavigateTab: (
    tabId: "Stock" | "Requisitions" | "Issues" | "Procurement" | "Suppliers" | "Stores",
    filter?: {
      stockFilter?: "all" | "inStock" | "low" | "expired" | "critical";
      storeId?: number | "all";
      category?: string;
    },
  ) => void;
  onOpenCreateRequisition?: () => void;
}

export const InventoryOverviewTab: React.FC<InventoryOverviewTabProps> = ({
  onNavigateTab,
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Queries
  const { data: inventories = [] } =
    useGetInventoriesQuery();
  const { data: stores = [] } = useGetStoresQuery();
  const { data: requisitions = [] } = useGetInventoryRequisitionsQuery();
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery();
  const { data: shipments = [] } = useGetShipmentsQuery();
  const { data: stockMovements = [] } = useGetStockMovementsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: expenseCategories = [] } = useGetExpenseCategoriesQuery();

  // Date helpers
  const now = useMemo(() => new Date(), []);
  const in60Days = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  }, []);

  // Stock Metrics Calculations
  const stockMetrics = useMemo(() => {
    let totalUnits = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let criticalStockCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let serializedCount = 0;

    const criticalItems: InventoryItem[] = [];
    const lowStockItems: InventoryItem[] = [];
    const expiredItems: InventoryItem[] = [];

    for (const item of inventories) {
      const currentStock = Number(item.current_stock) || 0;
      const reorderLevel = Number(item.re_order_level) || 0;
      const unitCost = Number(item.unit_cost) || 0;

      totalUnits += currentStock;
      totalValuation += currentStock * unitCost;

      if (item.is_serialized) {
        serializedCount++;
      }

      // Critical (Out of stock / AOG risk)
      if (currentStock <= 0) {
        criticalStockCount++;
        criticalItems.push(item);
      }
      // Low stock (reorder reached, but > 0)
      else if (currentStock <= reorderLevel) {
        lowStockCount++;
        lowStockItems.push(item);
      }

      // Expiry checks
      if (item.expiry_date) {
        const expDate = new Date(item.expiry_date);
        if (!Number.isNaN(expDate.getTime())) {
          if (expDate <= now) {
            expiredCount++;
            expiredItems.push(item);
          } else if (expDate <= in60Days) {
            expiringSoonCount++;
          }
        }
      }
    }

    return {
      totalItems: inventories.length,
      totalUnits,
      totalValuation,
      lowStockCount,
      criticalStockCount,
      expiredCount,
      expiringSoonCount,
      serializedCount,
      criticalItems,
      lowStockItems,
      expiredItems,
    };
  }, [inventories, now, in60Days]);

  // Requisitions Metrics
  const requisitionMetrics = useMemo(() => {
    let pendingCount = 0;
    let underReviewCount = 0;
    let approvedCount = 0;
    let receivedCount = 0;

    for (const req of requisitions) {
      const status = normalizeRequisitionStatus(req.status);
      if (status === "Pending") pendingCount++;
      else if (status === "Under Review") underReviewCount++;
      else if (status === "Approved") approvedCount++;
      else if (status === "Received") receivedCount++;
    }

    return {
      total: requisitions.length,
      pendingCount,
      underReviewCount,
      approvedCount,
      receivedCount,
      actionRequired: pendingCount + underReviewCount,
    };
  }, [requisitions]);

  // Procurement & Logistics Metrics
  const procurementMetrics = useMemo(() => {
    const openPOs = purchaseOrders.filter((po) => {
      const status = (po.status ?? "").toLowerCase();
      return status !== "received" && status !== "delivered" && status !== "cancelled";
    });

    const activeShipments = shipments.filter(
      (s) => (s.status ?? "").toLowerCase() !== "delivered",
    );

    const totalCommittedPoValue = openPOs.reduce((acc, po) => {
      const itemsVal = (po.items ?? []).reduce(
        (sum, it) => sum + (Number(it.quantity_ordered) || 0) * (Number(it.unit_price) || 0),
        0,
      );
      return acc + itemsVal;
    }, 0);

    return {
      totalPOs: purchaseOrders.length,
      openPOCount: openPOs.length,
      activeShipmentCount: activeShipments.length,
      totalCommittedPoValue,
      openPOs,
      activeShipments,
    };
  }, [purchaseOrders, shipments]);

  // Stores breakdown
  const storesBreakdown = useMemo(() => {
    return stores.map((store) => {
      const storeInventories = inventories.filter(
        (item) => item.store_id === store.id || (item.store_location && item.store_location.id === store.id),
      );
      const itemsCount = storeInventories.length;
      const stockCount = storeInventories.reduce(
        (sum, it) => sum + (Number(it.current_stock) || 0),
        0,
      );
      const valuation = storeInventories.reduce(
        (sum, it) => sum + (Number(it.current_stock) || 0) * (Number(it.unit_cost) || 0),
        0,
      );
      const percent = stockMetrics.totalUnits > 0 ? (stockCount / stockMetrics.totalUnits) * 100 : 0;

      return {
        ...store,
        computedItemsCount: itemsCount,
        computedStockCount: stockCount,
        computedValuation: valuation,
        percent,
      };
    });
  }, [stores, inventories, stockMetrics.totalUnits]);

  // Category distribution breakdown
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, { count: number; units: number }>();

    for (const item of inventories) {
      const cat = formatCategoryName(
        expenseCategories.find((c) => c.id === item.expense_category_id)?.name ?? item.type,
      );
      const existing = categoryMap.get(cat) || { count: 0, units: 0 };
      existing.count += 1;
      existing.units += Number(item.current_stock) || 0;
      categoryMap.set(cat, existing);
    }

    const list = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      units: data.units,
      percent: inventories.length > 0 ? (data.count / inventories.length) * 100 : 0,
    }));

    // Sort by count descending
    return list.sort((a, b) => b.count - a.count);
  }, [inventories, expenseCategories]);

  // Currency Formatter
  const formatValuation = (val: number) => {
    if (val >= 1_000_000) {
      return `$${(val / 1_000_000).toFixed(2)}M`;
    }
    if (val >= 1_000) {
      return `$${(val / 1_000).toFixed(1)}k`;
    }
    return `$${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Overview Header Banner with Tactical Action Shortcuts */}
      <div
        className={cn(
          "rounded-xl border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all shadow-sm",
          isDark
            ? "bg-[#001219] border-[#0A4D66]/40 text-white"
            : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              Aviation Inventory & Supply Chain Overview
            </h2>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                isDark
                  ? "bg-[#0A4D66]/40 text-[#7FD5FF] border-[#7FD5FF]/30"
                  : "bg-sky-50 text-sky-800 border-sky-200",
              )}
            >
              C2 Logistics Command
            </span>
          </div>
          <p
            className={cn(
              "text-xs max-w-3xl",
              isDark ? "text-gray-400" : "text-slate-600",
            )}
          >
            Tactical oversight across stores, unit spare requisitions, procurement pipeline, carrier consignments, and shelf-life compliance.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab("Stock")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
              isDark
                ? "bg-[#001825] border-[#0A4D66]/60 text-gray-200 hover:text-white hover:border-[#7FD5FF]/50"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100",
            )}
          >
            <Icon icon="mdi:cube-outline" className="w-4 h-4 text-sky-400" />
            <span>View All Stock</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard/inventory/purchase-orders/new")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Icon icon="mdi:cart-plus" className="w-4 h-4 text-white" />
            <span>Create Purchase Order</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard/inventory/issues/new")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
              isDark
                ? "bg-[#001825] border-[#0A4D66]/60 text-gray-200 hover:text-white hover:border-amber-400/50"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100",
            )}
          >
            <Icon icon="mdi:truck-delivery-outline" className="w-4 h-4 text-amber-400" />
            <span>Issue Voucher</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard/inventory/add")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#0369A1]/90 text-white shadow-sm transition-all cursor-pointer"
          >
            <Icon icon="mdi:plus" className="w-4 h-4 text-white" />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Row 1: Primary Stock Health & Catalog KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <MetricCard
          id="metric-total-catalog"
          label="Total Catalog Items"
          value={stockMetrics.totalItems}
          badge="Catalog"
          badgeColor="sky"
          subtext={`${stockMetrics.serializedCount} serialized parts tracked`}
          icon="mdi:cube-outline"
          onClick={() => onNavigateTab("Stock")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-total-stock-units"
          label="Total In Stock"
          value={stockMetrics.totalUnits.toLocaleString()}
          badge="Healthy"
          badgeColor="emerald"
          subtext={`Est. Value: ${formatValuation(stockMetrics.totalValuation)}`}
          icon="mdi:package-variant-closed"
          onClick={() => onNavigateTab("Stock")}
          className="cursor-pointer hover:border-emerald-500 transition-all"
        />

        <MetricCard
          id="metric-low-stock"
          label="Low in Stock"
          value={stockMetrics.lowStockCount}
          badge="Reorder"
          badgeColor={stockMetrics.lowStockCount > 0 ? "amber" : "neutral"}
          subtext={
            stockMetrics.lowStockCount > 0
              ? `${stockMetrics.lowStockCount} items at or below safety level`
              : "All stock levels optimal"
          }
          icon="mdi:alert-outline"
          onClick={() => onNavigateTab("Stock", { stockFilter: "low" })}
          className={cn(
            "cursor-pointer transition-all",
            stockMetrics.lowStockCount > 0 && "ring-1 ring-amber-400/40 hover:border-amber-400",
          )}
        />

        <MetricCard
          id="metric-critical-stock"
          label="Critical Shortages"
          value={stockMetrics.criticalStockCount}
          badge="Shortage"
          badgeColor={stockMetrics.criticalStockCount > 0 ? "red" : "neutral"}
          subtext={
            stockMetrics.criticalStockCount > 0
              ? "Items completely depleted (AOG Risk)"
              : "Zero depleted catalog items"
          }
          icon="mdi:alert-octagon-outline"
          onClick={() => onNavigateTab("Stock", { stockFilter: "critical" })}
          className={cn(
            "cursor-pointer transition-all",
            stockMetrics.criticalStockCount > 0 && "ring-1 ring-red-500/50 hover:border-red-500",
          )}
        />

        <MetricCard
          id="metric-expired-stock"
          label="Expired Shelf-Life"
          value={stockMetrics.expiredCount}
          badge="Shelf-Life"
          badgeColor={stockMetrics.expiredCount > 0 ? "red" : "neutral"}
          subtext={
            stockMetrics.expiringSoonCount > 0
              ? `+${stockMetrics.expiringSoonCount} expiring within 60 days`
              : "No upcoming expirations"
          }
          icon="mdi:clock-alert-outline"
          onClick={() => onNavigateTab("Stock", { stockFilter: "expired" })}
          className={cn(
            "cursor-pointer transition-all",
            stockMetrics.expiredCount > 0 && "ring-1 ring-rose-500/40 hover:border-rose-500",
          )}
        />
      </div>

      {/* Row 2: Secondary Operational Modules & Logistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <MetricCard
          id="metric-requisitions"
          label="Unit Requisitions"
          value={requisitionMetrics.total}
          badge={`${requisitionMetrics.actionRequired} Pending`}
          badgeColor={requisitionMetrics.actionRequired > 0 ? "amber" : "neutral"}
          subtext={`${requisitionMetrics.approvedCount} approved for issue`}
          icon="mdi:file-document-outline"
          onClick={() => onNavigateTab("Requisitions")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-stock-issues"
          label="Issue Vouchers"
          value={stockMovements.length}
          badge="Inter-Unit"
          badgeColor="sky"
          subtext="Transfers & maintenance draws"
          icon="mdi:truck-delivery-outline"
          onClick={() => onNavigateTab("Issues")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-purchase-orders"
          label="Purchase Orders"
          value={procurementMetrics.totalPOs}
          badge={`${procurementMetrics.openPOCount} Active`}
          badgeColor={procurementMetrics.openPOCount > 0 ? "indigo" : "neutral"}
          subtext={`Pipeline Value: ${formatValuation(procurementMetrics.totalCommittedPoValue)}`}
          icon="mdi:cart-outline"
          onClick={() => onNavigateTab("Procurement")}
          className="cursor-pointer hover:border-indigo-500 transition-all"
        />

        <MetricCard
          id="metric-active-shipments"
          label="In-Transit Cargo"
          value={procurementMetrics.activeShipmentCount}
          badge="Logistics"
          badgeColor={procurementMetrics.activeShipmentCount > 0 ? "teal" : "neutral"}
          subtext={`${shipments.length} total consignments`}
          icon="mdi:truck-fast-outline"
          onClick={() => onNavigateTab("Procurement")}
          className="cursor-pointer hover:border-teal-500 transition-all"
        />

        <MetricCard
          id="metric-active-stores"
          label="Stores & Warehouses"
          value={stores.length}
          badge={`${suppliers.length} Vendors`}
          badgeColor="neutral"
          subtext="Main HQ, Bonded, Rubber & Unit stores"
          icon="mdi:store-outline"
          onClick={() => onNavigateTab("Stores")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />
      </div>

      {/* Critical Tactical Alerts & Action Center */}
      {(stockMetrics.criticalStockCount > 0 ||
        stockMetrics.lowStockCount > 0 ||
        stockMetrics.expiredCount > 0 ||
        requisitionMetrics.actionRequired > 0) && (
        <div
          className={cn(
            "rounded-xl border p-4 sm:p-5 space-y-3 shadow-md",
            isDark
              ? "bg-[#001219] border-amber-500/40 shadow-amber-950/10"
              : "bg-amber-50/50 border-amber-200 text-slate-800 shadow-sm",
          )}
        >
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <Icon
                icon="mdi:alert-decagram"
                className="w-5 h-5 text-amber-400 animate-pulse"
              />
              <h3 className="text-sm font-bold tracking-wide uppercase text-amber-400">
                Operational Logistics Attention Center
              </h3>
            </div>
            <span
              className={cn(
                "text-xs px-2.5 py-0.5 rounded-full font-semibold",
                isDark
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-amber-100 text-amber-800 border border-amber-300",
              )}
            >
              {stockMetrics.criticalStockCount +
                stockMetrics.lowStockCount +
                stockMetrics.expiredCount +
                requisitionMetrics.actionRequired}{" "}
              Actionable Items
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {/* Depleted Critical Items */}
            {stockMetrics.criticalItems.slice(0, 3).map((item) => (
              <div
                key={`crit-${item.id}`}
                onClick={() => navigate(`/dashboard/inventory/${item.id}`)}
                className={cn(
                  "p-3 rounded-lg border flex items-start justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01]",
                  isDark
                    ? "bg-[#001825] border-red-500/40 hover:border-red-400"
                    : "bg-white border-red-200 hover:border-red-400 shadow-sm",
                )}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                      Depleted Stock (0 Units)
                    </span>
                  </div>
                  <div className="font-semibold text-xs truncate" title={item.part_number}>
                    {item.part_number}
                  </div>
                  <div
                    className={cn(
                      "text-[11px] truncate",
                      isDark ? "text-gray-400" : "text-slate-600",
                    )}
                  >
                    {item.store_location?.name ?? "General Store"} · Reorder @ {item.re_order_level}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/dashboard/inventory/purchase-orders/new");
                  }}
                  className="px-2.5 py-1 text-[11px] rounded font-bold bg-red-600 hover:bg-red-700 text-white shrink-0 shadow-sm"
                >
                  Procure
                </button>
              </div>
            ))}

            {/* Low Stock Replenishment Items */}
            {stockMetrics.lowStockItems.slice(0, 3).map((item) => (
              <div
                key={`low-${item.id}`}
                onClick={() => navigate(`/dashboard/inventory/${item.id}`)}
                className={cn(
                  "p-3 rounded-lg border flex items-start justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01]",
                  isDark
                    ? "bg-[#001825] border-amber-500/40 hover:border-amber-400"
                    : "bg-white border-amber-200 hover:border-amber-400 shadow-sm",
                )}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Low Stock Threshold
                    </span>
                  </div>
                  <div className="font-semibold text-xs truncate" title={item.part_number}>
                    {item.part_number}
                  </div>
                  <div
                    className={cn(
                      "text-[11px] truncate",
                      isDark ? "text-gray-400" : "text-slate-600",
                    )}
                  >
                    Current: <strong className="text-amber-400">{item.current_stock}</strong> / Safety: {item.re_order_level}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateTab("Stock", { stockFilter: "low" });
                  }}
                  className="px-2.5 py-1 text-[11px] rounded font-semibold bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-sm"
                >
                  Restock
                </button>
              </div>
            ))}

            {/* Expired Shelf-Life Items */}
            {stockMetrics.expiredItems.slice(0, 2).map((item) => (
              <div
                key={`exp-${item.id}`}
                onClick={() => navigate(`/dashboard/inventory/${item.id}`)}
                className={cn(
                  "p-3 rounded-lg border flex items-start justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01]",
                  isDark
                    ? "bg-[#001825] border-rose-500/40 hover:border-rose-400"
                    : "bg-white border-rose-200 hover:border-rose-400 shadow-sm",
                )}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                      Shelf-Life Exceeded
                    </span>
                  </div>
                  <div className="font-semibold text-xs truncate" title={item.part_number}>
                    {item.part_number}
                  </div>
                  <div
                    className={cn(
                      "text-[11px] truncate",
                      isDark ? "text-gray-400" : "text-slate-600",
                    )}
                  >
                    Expired on {formatDateShort(item.expiry_date)}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 self-center">
                  Quarantine
                </span>
              </div>
            ))}

            {/* Pending Requisitions */}
            {requisitionMetrics.actionRequired > 0 && (
              <div
                onClick={() => onNavigateTab("Requisitions")}
                className={cn(
                  "p-3 rounded-lg border flex items-start justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01]",
                  isDark
                    ? "bg-[#001825] border-sky-500/40 hover:border-sky-400"
                    : "bg-white border-sky-200 hover:border-sky-400 shadow-sm",
                )}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                      Requisitions Awaiting Authorization
                    </span>
                  </div>
                  <div className="font-semibold text-xs">
                    {requisitionMetrics.actionRequired} Part Requisitions Pending
                  </div>
                  <div
                    className={cn(
                      "text-[11px]",
                      isDark ? "text-gray-400" : "text-slate-600",
                    )}
                  >
                    Maintenance units demanding stock draws
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateTab("Requisitions");
                  }}
                  className="px-2.5 py-1 text-[11px] rounded font-bold bg-[#0369A1] hover:bg-[#0369A1]/90 text-white shrink-0 shadow-sm"
                >
                  Review
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row 3: Deep Visual Breakdown Grids (Warehouse Distribution + Category Composition) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stores & Warehouses Distribution Card */}
        <div
          className={cn(
            "rounded-xl border p-5 flex flex-col justify-between space-y-4 shadow-sm",
            isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200",
          )}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:store-outline" className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-sm">Store & Warehouse Repositories</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("Stores")}
              className="text-xs text-[#7FD5FF] hover:underline font-semibold"
            >
              Manage Stores →
            </button>
          </div>

          <div className="space-y-3.5 flex-1">
            {storesBreakdown.length === 0 ? (
              <div className="text-xs text-gray-500 py-6 text-center">
                No stores configured yet.
              </div>
            ) : (
              storesBreakdown.map((store) => (
                <div
                  key={`store-${store.id}`}
                  onClick={() => onNavigateTab("Stock", { storeId: store.id })}
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/30 hover:border-[#7FD5FF]/50"
                      : "bg-slate-50 border-slate-200 hover:border-sky-300 hover:bg-sky-50/40",
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{store.name}</span>
                      {store.code && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-sky-500/15 text-sky-400 border border-sky-500/30">
                          {store.code}
                        </span>
                      )}
                      {store.is_system && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold bg-gray-500/15 text-gray-400">
                          System
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono">
                        {store.computedStockCount.toLocaleString()} units
                      </span>
                      <span className="text-[11px] text-gray-400 ml-1.5">
                        ({store.computedItemsCount} items)
                      </span>
                    </div>
                  </div>

                  {/* Progress Distribution Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-700/30 overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0369A1] to-[#7FD5FF] transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(3, store.percent))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>{store.unit?.name ?? "Base Warehouse"}</span>
                    <span>Valuation: {formatValuation(store.computedValuation)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            className={cn(
              "pt-3 border-t text-xs flex items-center justify-between font-semibold",
              isDark ? "border-[#0A4D66]/30 text-gray-300" : "border-slate-200 text-slate-700",
            )}
          >
            <span>Total Warehoused Stock:</span>
            <span className="font-bold font-mono text-sm text-[#7FD5FF]">
              {stockMetrics.totalUnits.toLocaleString()} Units
            </span>
          </div>
        </div>

        {/* Aviation Categories Breakdown Card */}
        <div
          className={cn(
            "rounded-xl border p-5 flex flex-col justify-between space-y-4 shadow-sm",
            isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200",
          )}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:tag-multiple-outline" className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm">Stock by Aviation Category</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("Stock")}
              className="text-xs text-[#7FD5FF] hover:underline font-semibold"
            >
              Filter in Catalog →
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {categoryBreakdown.slice(0, 6).map((cat, idx) => {
              const colors = [
                "from-emerald-600 to-emerald-400",
                "from-[#0369A1] to-[#7FD5FF]",
                "from-indigo-600 to-indigo-400",
                "from-amber-600 to-amber-400",
                "from-teal-600 to-teal-400",
                "from-purple-600 to-purple-400",
              ];
              const gradient = colors[idx % colors.length];

              return (
                <div
                  key={`cat-${cat.name}`}
                  onClick={() => onNavigateTab("Stock", { category: cat.name })}
                  className={cn(
                    "p-2.5 rounded-lg border transition-all cursor-pointer",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/30 hover:border-emerald-400/40"
                      : "bg-slate-50 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30",
                  )}
                >
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-semibold">{cat.name}</span>
                    <span className="font-mono text-gray-400">
                      <strong className={isDark ? "text-white" : "text-slate-900"}>
                        {cat.count}
                      </strong>{" "}
                      items · {cat.units.toLocaleString()} units
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-700/30 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r", gradient)}
                      style={{ width: `${Math.min(100, Math.max(4, cat.percent))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "pt-3 border-t text-xs flex items-center justify-between font-semibold",
              isDark ? "border-[#0A4D66]/30 text-gray-300" : "border-slate-200 text-slate-700",
            )}
          >
            <span>Active Catalog Classifications:</span>
            <span className="font-bold text-sm text-emerald-400">
              {categoryBreakdown.length} Categories
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Procurement Pipeline & Inbound Logistics Snapshot */}
      <div
        className={cn(
          "rounded-xl border p-5 space-y-4 shadow-sm",
          isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200",
        )}
      >
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#0A4D66]/30">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:cart-outline" className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">Procurement Lifecycle & Consignments</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("Procurement")}
            className="text-xs text-[#7FD5FF] hover:underline font-semibold"
          >
            Open Procurement Pipeline →
          </button>
        </div>

        {/* 4-Step Visual Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => onNavigateTab("Requisitions")}
            className={cn(
              "p-3.5 rounded-lg border text-xs space-y-2 cursor-pointer transition-all hover:scale-[1.01]",
              isDark ? "bg-[#001825] border-[#0A4D66]/30" : "bg-slate-50 border-slate-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                1. Demand / Requisitions
              </span>
              <Icon icon="mdi:wrench-clock" className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono">
              {requisitions.length}
            </div>
            <p className={isDark ? "text-gray-400" : "text-slate-600"}>
              {requisitionMetrics.pendingCount} pending authorization from maintenance units.
            </p>
          </div>

          <div
            onClick={() => onNavigateTab("Procurement")}
            className={cn(
              "p-3.5 rounded-lg border text-xs space-y-2 cursor-pointer transition-all hover:scale-[1.01]",
              isDark ? "bg-[#001825] border-[#0A4D66]/30" : "bg-slate-50 border-slate-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                2. Purchase Orders
              </span>
              <Icon icon="mdi:cart-outline" className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-lg font-bold font-mono">
              {procurementMetrics.openPOCount} Active
            </div>
            <p className={isDark ? "text-gray-400" : "text-slate-600"}>
              {formatValuation(procurementMetrics.totalCommittedPoValue)} committed procurement value.
            </p>
          </div>

          <div
            onClick={() => onNavigateTab("Procurement")}
            className={cn(
              "p-3.5 rounded-lg border text-xs space-y-2 cursor-pointer transition-all hover:scale-[1.01]",
              isDark ? "bg-[#001825] border-[#0A4D66]/30" : "bg-slate-50 border-slate-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                3. In-Transit Shipments
              </span>
              <Icon icon="mdi:truck-fast-outline" className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-lg font-bold font-mono">
              {procurementMetrics.activeShipmentCount} Consignments
            </div>
            <p className={isDark ? "text-gray-400" : "text-slate-600"}>
              Tracked via air cargo, courier and customs clear.
            </p>
          </div>

          <div
            onClick={() => onNavigateTab("Stock")}
            className={cn(
              "p-3.5 rounded-lg border text-xs space-y-2 cursor-pointer transition-all hover:scale-[1.01]",
              isDark ? "bg-[#001825] border-[#0A4D66]/30" : "bg-slate-50 border-slate-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                4. Stores Receipt (GRN)
              </span>
              <Icon icon="mdi:check-circle-outline" className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-bold font-mono">
              {stockMetrics.totalUnits.toLocaleString()} In Stock
            </div>
            <p className={isDark ? "text-gray-400" : "text-slate-600"}>
              Inspected, batched, and allocated to warehouses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
