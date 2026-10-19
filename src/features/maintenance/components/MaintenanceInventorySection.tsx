import { useState, useMemo, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { AppTabs } from "@/shared/ui/tabs/AppTabs";
import { MetricCard } from "@/shared/ui/metric/MetricCard";
import {
  useGetInventoriesQuery,
  useGetInventoryRequisitionsQuery,
  useGetStockMovementsQuery,
  useGetPurchaseOrdersQuery,
  useGetSuppliersQuery,
} from "@/features/inventory/api";
import {
  ProcurementSection,
  type ProcurementSubTabKey,
} from "@/features/inventory/components/ProcurementSection";
import { onInteractiveRowClick } from "@/features/inventory/inventoryUtils";
import { useGetUnitsQuery } from "@/shared/api/units";

export type MaintenanceInventorySubTab =
  | "stocks"
  | "requisitions"
  | "procurement"
  | "suppliers"
  | "parts-requisitions"
  | "purchase-orders";

interface MaintenanceInventorySectionProps {
  initialSubTab?: MaintenanceInventorySubTab;
}

export const MaintenanceInventorySection = ({
  initialSubTab = "stocks",
}: MaintenanceInventorySectionProps) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Primary subtab inside Maintenance Hub Inventory: stocks | requisitions | procurement | suppliers
  const [activeSubTab, setActiveSubTab] = useState<
    "stocks" | "requisitions" | "procurement" | "suppliers"
  >(() => {
    if (
      initialSubTab === "parts-requisitions" ||
      initialSubTab === "purchase-orders" ||
      initialSubTab === "procurement"
    ) {
      return "procurement";
    }
    if (initialSubTab === "requisitions") return "requisitions";
    if (initialSubTab === "suppliers") return "suppliers";
    return "stocks";
  });

  // Independent procurement subtab state for Maintenance Hub
  const [procurementSubTab, setProcurementSubTab] =
    useState<ProcurementSubTabKey>(() => {
      if (initialSubTab === "parts-requisitions") return "part-requisitions";
      if (initialSubTab === "purchase-orders") return "purchase-orders";
      return "overview";
    });

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "all" | "low" | "critical" | "expired"
  >("all");

  // Keep state in sync if initialSubTab prop changes
  useEffect(() => {
    if (initialSubTab === "parts-requisitions") {
      setActiveSubTab("procurement");
      setProcurementSubTab("part-requisitions");
    } else if (initialSubTab === "purchase-orders") {
      setActiveSubTab("procurement");
      setProcurementSubTab("purchase-orders");
    } else if (initialSubTab === "procurement") {
      setActiveSubTab("procurement");
    } else if (initialSubTab === "requisitions") {
      setActiveSubTab("requisitions");
    } else if (initialSubTab === "suppliers") {
      setActiveSubTab("suppliers");
    } else if (initialSubTab === "stocks") {
      setActiveSubTab("stocks");
    }
  }, [initialSubTab]);

  // Queries
  const { data: inventories = [], isLoading: isInventoryLoading } =
    useGetInventoriesQuery();
  const { data: requisitions = [], isLoading: isRequisitionsLoading } =
    useGetInventoryRequisitionsQuery();
  const { data: stockMovements = [] } = useGetStockMovementsQuery();
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery();
  const { data: suppliers = [], isLoading: isSuppliersLoading } =
    useGetSuppliersQuery();
  const { data: units = [] } = useGetUnitsQuery();

  const SUB_TABS = [
    {
      id: "stocks" as const,
      label: "Maintenance Spares & Stocks",
      icon: "mdi:cube-outline",
      badge: inventories.length,
    },
    {
      id: "requisitions" as const,
      label: "Internal Requisitions",
      icon: "mdi:file-document-outline",
      badge: requisitions.length,
    },
    {
      id: "procurement" as const,
      label: "Procurement Hub",
      icon: "mdi:source-merge",
      badge:
        stockMovements.filter((m) => m.work_order_id).length +
        purchaseOrders.length,
    },
    {
      id: "suppliers" as const,
      label: "Certified MRO Suppliers",
      icon: "mdi:truck-delivery-outline",
      badge: suppliers.length,
    },
  ];

  // Helper date format
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

  // Inventory Metrics Calculation (for Stocks view)
  const inventoryMetrics = useMemo(() => {
    let totalStock = 0;
    let lowStock = 0;
    let criticalStock = 0;
    let expired = 0;
    const now = new Date();

    for (const item of inventories) {
      const currentStock = Number(item.current_stock) || 0;
      const reorderLevel = Number(item.re_order_level) || 0;
      totalStock += currentStock;

      const isItemExpired = Boolean(
        item.expiry_date &&
          !Number.isNaN(new Date(item.expiry_date).getTime()) &&
          new Date(item.expiry_date) < now,
      );

      const level = (item.stock_level ?? "").toLowerCase();
      const isItemCritical =
        level === "critical" || (reorderLevel > 0 && currentStock <= 0);
      const isItemLow =
        level === "low" ||
        (reorderLevel > 0 && currentStock <= reorderLevel && !isItemCritical);

      if (isItemExpired) expired++;
      if (isItemCritical) criticalStock++;
      else if (isItemLow) lowStock++;
    }

    return {
      totalItems: inventories.length,
      totalStock,
      lowStock,
      criticalStock,
      expired,
    };
  }, [inventories]);

  // Filtered Inventories
  const filteredStocks = useMemo(() => {
    const now = new Date();
    return inventories.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.part_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.serial_number &&
          item.serial_number.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStore =
        selectedStore === "all" || item.store === selectedStore;
      if (!matchesSearch || !matchesStore) return false;

      if (stockStatusFilter === "all") return true;

      const currentStock = Number(item.current_stock) || 0;
      const reorderLevel = Number(item.re_order_level) || 0;
      const level = (item.stock_level ?? "").toLowerCase();
      const isItemExpired = Boolean(
        item.expiry_date &&
          !Number.isNaN(new Date(item.expiry_date).getTime()) &&
          new Date(item.expiry_date) < now,
      );
      const isItemCritical =
        level === "critical" || (reorderLevel > 0 && currentStock <= 0);
      const isItemLow =
        level === "low" ||
        (reorderLevel > 0 && currentStock <= reorderLevel && !isItemCritical);

      if (stockStatusFilter === "expired") return isItemExpired;
      if (stockStatusFilter === "critical") return isItemCritical;
      if (stockStatusFilter === "low") return isItemLow;

      return true;
    });
  }, [inventories, searchQuery, selectedStore, stockStatusFilter]);

  // Filtered Internal Requisitions
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const unitName =
        units.find((u) => u.id === r.requesting_unit_id)?.name || "";
      return (
        String(r.id).includes(q) ||
        r.status.toLowerCase().includes(q) ||
        unitName.toLowerCase().includes(q)
      );
    });
  }, [requisitions, searchQuery, units]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.contact && s.contact.toLowerCase().includes(q))
      );
    });
  }, [suppliers, searchQuery]);

  // Handle Export CSV
  const handleExportCsv = (
    filename: string,
    headers: string[],
    rows: (string | number)[][],
  ) => {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-5">
      {/* Subtab Pill Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AppTabs
          variant="segmented"
          tabs={SUB_TABS}
          activeTab={activeSubTab}
          onChange={(tab) => {
            setActiveSubTab(tab as typeof activeSubTab);
            setSearchQuery("");
            setStockStatusFilter("all");
          }}
        />

        {/* Global Action Shortcut for Inventory */}
        <div className="flex items-center gap-2">
          {activeSubTab === "stocks" && (
            <button
              type="button"
              onClick={() => navigate("/dashboard/inventory/new")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Add Stock Item</span>
            </button>
          )}

          {activeSubTab === "requisitions" && (
            <button
              type="button"
              onClick={() => navigate("/dashboard/inventory/requisitions/new")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>New Requisition</span>
            </button>
          )}

          {activeSubTab === "suppliers" && (
            <button
              type="button"
              onClick={() => navigate("/dashboard/inventory/suppliers/new")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 Inventory Key Metric Cards (Only on Stocks tab) */}
      {activeSubTab === "stocks" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Total Items"
            value={inventoryMetrics.totalItems}
            icon="mdi:cube-outline"
            badge="Catalog"
            badgeColor="sky"
            subtext="Unique catalog spares"
            isActive={stockStatusFilter === "all"}
            onClick={() => setStockStatusFilter("all")}
          />
          <MetricCard
            label="Total In Stock"
            value={inventoryMetrics.totalStock.toLocaleString()}
            icon="mdi:check-circle-outline"
            badge="Healthy"
            badgeColor="emerald"
            subtext="Combined unit volume"
          />
          <MetricCard
            label="Low In Stock"
            value={inventoryMetrics.lowStock}
            icon="mdi:alert-circle-outline"
            badge="Reorder"
            badgeColor="amber"
            subtext="At or below reorder level"
            isActive={stockStatusFilter === "low"}
            onClick={() =>
              setStockStatusFilter((curr) => (curr === "low" ? "all" : "low"))
            }
          />
          <MetricCard
            label="Critical Stock"
            value={inventoryMetrics.criticalStock}
            icon="mdi:alert-octagon-outline"
            badge="Shortage"
            badgeColor="red"
            subtext="Depleted / urgent restock"
            isActive={stockStatusFilter === "critical"}
            onClick={() =>
              setStockStatusFilter((curr) =>
                curr === "critical" ? "all" : "critical",
              )
            }
          />
          <MetricCard
            label="Expired Items"
            value={inventoryMetrics.expired}
            icon="mdi:calendar-alert"
            badge="Shelf-Life"
            badgeColor="red"
            subtext="Past shelf-life limit"
            isActive={stockStatusFilter === "expired"}
            onClick={() =>
              setStockStatusFilter((curr) =>
                curr === "expired" ? "all" : "expired",
              )
            }
          />
        </div>
      )}

      {/* Filter and Control Bar (For Stocks, Requisitions, and Suppliers) */}
      {activeSubTab !== "procurement" && (
        <div
          className={cn(
            "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border",
            isDark
              ? "bg-[#001219] border-[#0A4D66]/40"
              : "bg-white border-slate-200 shadow-sm",
          )}
        >
          <div className="flex items-center gap-3 flex-1 max-w-md">
            {/* Search Input */}
            <div className="relative flex-1">
              <Icon
                icon="mdi:magnify"
                className={cn(
                  "absolute left-3 top-2.5 w-4 h-4",
                  isDark ? "text-gray-400" : "text-slate-400",
                )}
              />
              <input
                type="text"
                placeholder={`Search in ${SUB_TABS.find((t) => t.id === activeSubTab)?.label}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-gray-500 focus:border-[#7FD5FF]"
                    : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#0A4D66] focus:bg-white",
                )}
              />
            </div>

            {/* Store Filter (Only on Stocks tab) */}
            {activeSubTab === "stocks" && (
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className={cn(
                  "px-2.5 py-1.5 text-xs rounded-lg border outline-none transition-colors",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-800",
                )}
              >
                <option value="all">All Stores</option>
                <option value="bonded">Bonded Store</option>
                <option value="quarantine">Quarantine Store</option>
                <option value="flammable">Flammable Store</option>
                <option value="rubber">Rubber Store</option>
                <option value="others">Other Stores</option>
              </select>
            )}
          </div>

          {/* View Mode & Export */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {activeSubTab === "stocks" && (
              <div
                className={cn(
                  "flex items-center space-x-1 p-1 rounded-lg border",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/40"
                    : "bg-slate-200 border-slate-300",
                )}
              >
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "table"
                      ? isDark
                        ? "bg-[#0A4D66] text-[#7FD5FF]"
                        : "bg-white text-sky-700 shadow-sm border border-slate-300 font-bold"
                      : isDark
                        ? "text-gray-400 hover:text-white"
                        : "text-slate-500 hover:text-slate-900",
                  )}
                  title="Table view"
                >
                  <Icon icon="mdi:table" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "grid"
                      ? isDark
                        ? "bg-[#0A4D66] text-[#7FD5FF]"
                        : "bg-white text-sky-700 shadow-sm border border-slate-300 font-bold"
                      : isDark
                        ? "text-gray-400 hover:text-white"
                        : "text-slate-500 hover:text-slate-900",
                  )}
                  title="Grid view"
                >
                  <Icon icon="mdi:view-grid" className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={() => {
                if (activeSubTab === "stocks") {
                  handleExportCsv(
                    "maintenance-stocks.csv",
                    [
                      "Part Number",
                      "Description",
                      "Store",
                      "Current Stock",
                      "Reorder Level",
                      "Unit Cost",
                      "Measurement Unit",
                    ],
                    filteredStocks.map((s) => [
                      s.part_number,
                      s.description,
                      s.store,
                      s.current_stock,
                      s.re_order_level,
                      s.unit_cost,
                      s.measurement_unit,
                    ]),
                  );
                } else if (activeSubTab === "requisitions") {
                  handleExportCsv(
                    "maintenance-requisitions.csv",
                    ["Req ID", "Requesting Unit", "Status", "Created At"],
                    filteredRequisitions.map((r) => [
                      r.id,
                      r.requesting_unit_id ?? "-",
                      r.status,
                      formatDate(r.created_at),
                    ]),
                  );
                } else if (activeSubTab === "suppliers") {
                  handleExportCsv(
                    "maintenance-suppliers.csv",
                    ["ID", "Name", "Phone Number", "Email", "Address"],
                    filteredSuppliers.map((s) => [
                      s.id,
                      s.name,
                      s.contact ?? "-",
                      s.email ?? "-",
                      s.address ?? "-",
                    ]),
                  );
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                isDark
                  ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/20"
                  : "border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100",
              )}
            >
              <Icon icon="mdi:microsoft-excel" className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 1: STOCKS */}
      {activeSubTab === "stocks" && (
        <div
          className={cn(
            "rounded-xl border p-4",
            isDark
              ? "bg-[#001219] border-[#0A4D66]/40 text-white"
              : "bg-white border-slate-200 text-slate-800 shadow-sm",
          )}
        >
          {isInventoryLoading ? (
            <div
              className={cn(
                "text-xs py-10 text-center",
                isDark ? "text-gray-400" : "text-slate-500",
              )}
            >
              Loading maintenance spares and stock records...
            </div>
          ) : filteredStocks.length === 0 ? (
            <div
              className={cn(
                "text-xs py-10 text-center",
                isDark ? "text-gray-400" : "text-slate-500",
              )}
            >
              No stock items found matching criteria.
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className={cn(
                      "text-left border-b font-semibold uppercase tracking-wider",
                      isDark
                        ? "text-gray-400 border-[#0A4D66]/40"
                        : "text-slate-500 border-slate-200",
                    )}
                  >
                    <th className="py-2.5 px-3">Part Number</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Store Location</th>
                    <th className="py-2.5 px-3">Current Stock</th>
                    <th className="py-2.5 px-3">Reorder Level</th>
                    <th className="py-2.5 px-3">Stock Level</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 dark:divide-[#0A4D66]/20 divide-slate-100">
                  {filteredStocks.map((item) => {
                    const isLow = item.current_stock <= item.re_order_level;
                    return (
                      <tr
                        key={item.id}
                        title="Click to view stock item details"
                        onClick={(e) =>
                          onInteractiveRowClick(e, () =>
                            navigate(`/dashboard/inventory/${item.id}`),
                          )
                        }
                        className={cn(
                          "transition-colors cursor-pointer",
                          isDark
                            ? "hover:bg-[#001825]/80 text-gray-200"
                            : "hover:bg-sky-50/80 text-slate-700",
                        )}
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">
                          {item.part_number}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {item.description}
                        </td>
                        <td className="py-2.5 px-3 capitalize">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {item.store}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          {item.current_stock} {item.measurement_unit}
                        </td>
                        <td className="py-2.5 px-3">{item.re_order_level}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                              isLow
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                            )}
                          >
                            {isLow ? "Low Stock" : "Sufficient"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/inventory/${item.id}`);
                            }}
                            className="text-[#0A4D66] dark:text-[#7FD5FF] hover:underline font-semibold text-xs"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStocks.map((item) => {
                const isLow = item.current_stock <= item.re_order_level;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-4 rounded-xl border flex flex-col justify-between transition-colors",
                      isDark
                        ? "bg-[#001825] border-[#0A4D66]/40 hover:border-[#7FD5FF]/60"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm",
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-[#0A4D66] dark:text-[#7FD5FF]">
                          {item.part_number}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                            isLow
                              ? "bg-red-500/10 text-red-400 border-red-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                          )}
                        >
                          {isLow ? "Low" : "Sufficient"}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold line-clamp-2">
                        {item.description}
                      </h5>
                      <div className="text-[11px] opacity-70 mt-2 space-y-1">
                        <div>
                          Store: <span className="capitalize">{item.store}</span>
                        </div>
                        <div>
                          Available:{" "}
                          <span className="font-bold">
                            {item.current_stock} {item.measurement_unit}
                          </span>
                        </div>
                        <div>Min Reorder: {item.re_order_level}</div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#0A4D66]/20 dark:border-[#0A4D66]/20 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/dashboard/inventory/${item.id}`)
                        }
                        className="text-xs font-semibold text-[#0A4D66] dark:text-[#7FD5FF] hover:underline"
                      >
                        Details →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: INTERNAL REQUISITIONS */}
      {activeSubTab === "requisitions" && (
        <div
          className={cn(
            "rounded-xl border p-4",
            isDark
              ? "bg-[#001219] border-[#0A4D66]/40 text-white"
              : "bg-white border-slate-200 text-slate-800 shadow-sm",
          )}
        >
          {isRequisitionsLoading ? (
            <div
              className={cn(
                "text-xs py-10 text-center",
                isDark ? "text-gray-400" : "text-slate-500",
              )}
            >
              Loading internal requisitions...
            </div>
          ) : filteredRequisitions.length === 0 ? (
            <div
              className={cn(
                "text-xs py-10 text-center",
                isDark ? "text-gray-400" : "text-slate-500",
              )}
            >
              No internal requisitions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className={cn(
                      "text-left border-b font-semibold uppercase tracking-wider",
                      isDark
                        ? "text-gray-400 border-[#0A4D66]/40"
                        : "text-slate-500 border-slate-200",
                    )}
                  >
                    <th className="py-2.5 px-3">Req ID</th>
                    <th className="py-2.5 px-3">Requesting Location / Unit</th>
                    <th className="py-2.5 px-3">Total Value</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 dark:divide-[#0A4D66]/20 divide-slate-100">
                  {filteredRequisitions.map((req) => (
                    <tr
                      key={req.id}
                      title="Click to view requisition details"
                      onClick={(e) =>
                        onInteractiveRowClick(e, () =>
                          navigate(
                            `/dashboard/inventory/requisitions/${req.id}`,
                          ),
                        )
                      }
                      className={cn(
                        "transition-colors cursor-pointer",
                        isDark
                          ? "hover:bg-[#001825]/80 text-gray-200"
                          : "hover:bg-sky-50/80 text-slate-700",
                      )}
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">
                        #{req.id}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {units.find((u) => u.id === req.requesting_unit_id)
                          ?.name || `Unit #${req.requesting_unit_id ?? "-"}`}
                      </td>
                      <td className="py-2.5 px-3">
                        {req.total_cost
                          ? `₦${Number(req.total_cost).toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="py-2.5 px-3">
                        {formatDate(req.created_at)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border",
                            req.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : req.status === "rejected"
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30",
                          )}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/dashboard/inventory/requisitions/${req.id}`,
                            );
                          }}
                          className="text-[#0A4D66] dark:text-[#7FD5FF] hover:underline font-semibold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: PROCUREMENT HUB (Consolidated Lifecycle) */}
      {activeSubTab === "procurement" && (
        <ProcurementSection
          activeSubTab={procurementSubTab}
          onSelectSubTab={setProcurementSubTab}
          onNavigateToRfq={(rfqId) =>
            navigate(`/dashboard/inventory/rfq/${rfqId}`)
          }
        />
      )}

      {/* SUBTAB 4: CERTIFIED MRO SUPPLIERS */}
      {activeSubTab === "suppliers" && (
        <div
          className={cn(
            "rounded-xl border p-4",
            isDark
              ? "bg-[#001219] border-[#0A4D66]/40 text-white"
              : "bg-white border-slate-200 text-slate-800 shadow-sm",
          )}
        >
          {isSuppliersLoading ? (
            <div
              className={cn(
                "text-xs py-10 text-center",
                isDark ? "text-gray-400" : "text-slate-500",
              )}
            >
              Loading certified MRO suppliers...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div
              className={cn(
                "text-xs py-10 text-center",
                isDark ? "text-gray-400" : "text-slate-500",
              )}
            >
              No certified suppliers registered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className={cn(
                      "text-left border-b font-semibold uppercase tracking-wider",
                      isDark
                        ? "text-gray-400 border-[#0A4D66]/40"
                        : "text-slate-500 border-slate-200",
                    )}
                  >
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-3">Phone Number</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Facility Address</th>
                    <th className="py-2.5 px-3">Certification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 dark:divide-[#0A4D66]/20 divide-slate-100">
                  {filteredSuppliers.map((s) => (
                    <tr
                      key={s.id}
                      className={cn(
                        "transition-colors",
                        isDark
                          ? "hover:bg-[#001825]/60 text-gray-200"
                          : "hover:bg-slate-50 text-slate-700",
                      )}
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-3">{s.contact || "-"}</td>
                      <td className="py-2.5 px-3">{s.email || "-"}</td>
                      <td className="py-2.5 px-3">{s.address || "-"}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Approved Vendor
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
