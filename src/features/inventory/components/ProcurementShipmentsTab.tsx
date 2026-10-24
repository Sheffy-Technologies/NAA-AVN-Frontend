import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type Shipment,
  type ShipmentStatus,
  type ShipmentPurpose,
  useGetShipmentsQuery,
  useSyncShipmentLiveMutation,
} from "../api";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "../inventoryUtils";
import { CreateShipmentModal, SHIPMENT_PURPOSES } from "./CreateShipmentModal";
import { ShipmentDetailsModal } from "./ShipmentDetailsModal";
import { NumberedPagination } from "@/shared/ui/pagination/NumberedPagination";

const STATUS_TABS: { key: "all" | ShipmentStatus; label: string; countColor: string }[] = [
  { key: "all", label: "All Stages", countColor: "bg-gray-700 text-gray-200" },
  { key: "picked_up", label: "1. Picked Up", countColor: "bg-sky-500/20 text-sky-400" },
  { key: "customs_clearance", label: "2. Customs Clearance", countColor: "bg-amber-500/20 text-amber-400" },
  { key: "in_transit", label: "3. In Transit", countColor: "bg-indigo-500/20 text-indigo-400" },
  { key: "delivered", label: "4. Delivered", countColor: "bg-emerald-500/20 text-emerald-400" },
];

const PURPOSE_FILTER_OPTIONS: { key: "all" | "standalone" | ShipmentPurpose; label: string; icon: string }[] = [
  { key: "all", label: "All Consignments", icon: "mdi:all-inclusive" },
  { key: "standalone", label: "Standalone (No PO)", icon: "mdi:package-variant-closed-check" },
  { key: "procurement", label: "Procurement (PO)", icon: "mdi:cart-outline" },
  { key: "repair_overhaul", label: "Repair & Overhaul (R&O)", icon: "mdi:wrench-clock" },
  { key: "inter_base_transfer", label: "Base Transfers", icon: "mdi:swap-horizontal" },
  { key: "aog_emergency", label: "AOG Critical", icon: "mdi:alert-octagon" },
  { key: "exchange_loan", label: "Loan / Exchange", icon: "mdi:handshake-outline" },
  { key: "direct_consignment", label: "Direct Consignment", icon: "mdi:package-variant" },
];

export const ProcurementShipmentsTab: React.FC = () => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  // Filters
  const [activePurpose, setActivePurpose] = useState<"all" | "standalone" | ShipmentPurpose>("all");
  const [activeStatus, setActiveStatus] = useState<"all" | ShipmentStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Selection
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateStandalone, setIsCreateStandalone] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const { data: shipments = [], isLoading, refetch } = useGetShipmentsQuery();
  const [syncShipmentLive, { isLoading: isSyncing }] = useSyncShipmentLiveMutation();

  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      // Purpose filter
      if (activePurpose === "standalone") {
        if (s.purchase_order_id) return false;
      } else if (activePurpose !== "all") {
        const itemPurpose = s.purpose || (s.purchase_order_id ? "procurement" : "direct_consignment");
        if (itemPurpose !== activePurpose) return false;
      }
      // Status filter
      if (activeStatus !== "all" && s.status !== activeStatus) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const awbMatch = (s.tracking_number || "").toLowerCase().includes(q);
        const carrierMatch = (s.carrier_name || "").toLowerCase().includes(q);
        const titleMatch = (s.title || "").toLowerCase().includes(q);
        const refMatch = (s.reference_numbers || "").toLowerCase().includes(q);
        const poMatch = s.purchase_order_id ? `po #${s.purchase_order_id}`.toLowerCase().includes(q) : false;
        const customsMatch = (s.customs_reference || "").toLowerCase().includes(q);
        const supplierMatch = (s.supplier?.name || s.vendor_name || "").toLowerCase().includes(q);
        const originMatch = (s.origin || "").toLowerCase().includes(q);
        const destMatch = (s.destination || "").toLowerCase().includes(q);
        return awbMatch || carrierMatch || titleMatch || refMatch || poMatch || customsMatch || supplierMatch || originMatch || destMatch;
      }
      return true;
    });
  }, [shipments, activePurpose, activeStatus, searchQuery]);

  // Reset pagination on filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activePurpose, activeStatus, searchQuery]);

  const totalPages = Math.ceil(filteredShipments.length / PAGE_SIZE) || 1;
  const pagedShipments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredShipments.slice(start, start + PAGE_SIZE);
  }, [filteredShipments, currentPage]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: shipments.length,
      picked_up: 0,
      customs_clearance: 0,
      in_transit: 0,
      delivered: 0,
    };
    for (const s of shipments) {
      if (counts[s.status] !== undefined) counts[s.status]++;
    }
    return counts;
  }, [shipments]);

  const kpis = useMemo(() => {
    return {
      total: shipments.length,
      inTransit: shipments.filter((s) => s.status === "in_transit").length,
      customs: shipments.filter((s) => s.status === "customs_clearance").length,
      aog: shipments.filter((s) => s.purpose === "aog_emergency").length,
      delivered: shipments.filter((s) => s.status === "delivered").length,
    };
  }, [shipments]);

  const handleSync = async (shipmentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await syncShipmentLive(shipmentId).unwrap();
      dispatch(showToast({ message: "Live tracking synchronized.", type: "success" }));
      refetch();
    } catch {
      dispatch(showToast({ message: "Live sync failed.", type: "error" }));
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case "picked_up":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Icon icon="mdi:package-variant-closed" className="w-3.5 h-3.5" />
            <span>Picked Up</span>
          </span>
        );
      case "customs_clearance":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Icon icon="mdi:shield-check-outline" className="w-3.5 h-3.5" />
            <span>Customs Clearance</span>
          </span>
        );
      case "in_transit":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Icon icon="mdi:truck-fast-outline" className="w-3.5 h-3.5" />
            <span>In Transit</span>
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Icon icon="mdi:check-decagram-outline" className="w-3.5 h-3.5" />
            <span>Delivered</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getPurposeBadge = (purpose?: ShipmentPurpose) => {
    const meta = SHIPMENT_PURPOSES.find((p) => p.key === (purpose || "procurement"));
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
          meta?.badgeClass || "bg-sky-500/15 text-sky-400 border-sky-500/30",
        )}
      >
        <Icon icon={meta?.icon || "mdi:package"} className="w-3 h-3" />
        <span>{meta?.label.split("/")[0].trim() || "Procurement"}</span>
      </span>
    );
  };

  const handleOpenShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Executive Command Header */}
      <div
        className={cn(
          "rounded-2xl border p-5 shadow-sm transition-all",
          isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800",
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/15 text-sky-500 border border-sky-500/30 tracking-wider">
                Logistics & Fleet Consignments
              </span>
              <span className="text-xs text-gray-400">• Independent Multi-Purpose Tracking</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#0A4D66] dark:text-[#7FD5FF]">
              Shipment & Consignment Tracking Hub
            </h1>
            <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
              Track cargo across all procurement orders, MRO repair overhauls, AOG emergency parts, and inter-base transfers without needing a single purchase order.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsCreateStandalone(true);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95"
            >
              <Icon icon="mdi:package-variant" className="w-4 h-4 text-emerald-200" />
              <span>+ Add Standalone Tracking (No PO)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreateStandalone(false);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0A4D66] hover:bg-[#083c50] text-white shadow-sm transition-all active:scale-95"
            >
              <Icon icon="mdi:cart-plus" className="w-4 h-4 text-sky-400" />
              <span>+ Link to PO</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-[#0A4D66]/20">
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">Total Consignments</span>
            <span className="text-xl font-black text-sky-500 mt-0.5 block">{kpis.total}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">In Transit</span>
            <span className="text-xl font-black text-indigo-400 mt-0.5 block">{kpis.inTransit}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">Customs Clearance</span>
            <span className="text-xl font-black text-amber-400 mt-0.5 block">{kpis.customs}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">AOG Emergency</span>
            <span className="text-xl font-black text-rose-500 mt-0.5 block">{kpis.aog}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">Delivered / In Stores</span>
            <span className="text-xl font-black text-emerald-500 mt-0.5 block">{kpis.delivered}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar: Purpose Tabs & Status Pills */}
      <div className="space-y-3">
        {/* Purpose Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
            Purpose:
          </span>
          {PURPOSE_FILTER_OPTIONS.map((opt) => {
            const isSelected = activePurpose === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setActivePurpose(opt.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  isSelected
                    ? "bg-[#0A4D66] text-white shadow-sm"
                    : isDark
                    ? "bg-[#001825] border border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100",
                )}
              >
                <Icon icon={opt.icon} className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Stage Pills & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
              Stage:
            </span>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStatus(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  activeStatus === tab.key
                    ? "bg-sky-600 text-white shadow-sm"
                    : isDark
                    ? "bg-[#001825] border border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    activeStatus === tab.key ? "bg-white/20 text-white" : tab.countColor,
                  )}
                >
                  {statusCounts[tab.key] || 0}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search AWB, cargo, PO, carrier, supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/40 text-white placeholder:text-gray-500"
                  : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
              )}
            />
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div
        className={cn(
          "rounded-2xl border overflow-hidden shadow-sm",
          isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800",
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px] text-xs">
            <thead>
              <tr
                className={cn(
                  "border-b uppercase tracking-wider text-[11px] font-semibold",
                  isDark
                    ? "bg-[#001825] text-gray-400 border-[#0A4D66]/30"
                    : "bg-slate-50 text-slate-500 border-slate-200",
                )}
              >
                <th className="px-4 py-3 font-semibold">Purpose & Cargo</th>
                <th className="px-4 py-3 font-semibold">Tracking # / AWB</th>
                <th className="px-4 py-3 font-semibold">Carrier</th>
                <th className="px-4 py-3 font-semibold">Route (Origin &rarr; Destination)</th>
                <th className="px-4 py-3 font-semibold">Reference / PO</th>
                <th className="px-4 py-3 font-semibold">Status Stage</th>
                <th className="px-4 py-3 font-semibold">Est. Arrival</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    Loading consignments & multi-purpose shipments...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <Icon icon="mdi:truck-outline" className="w-9 h-9 mx-auto mb-2 opacity-40 text-sky-400" />
                    <p className="font-semibold text-sm text-slate-800 dark:text-gray-200">
                      No shipments matching your criteria
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Click "+ New Shipment / Consignment" to register tracking for any logistics movement.
                    </p>
                  </td>
                </tr>
              ) : (
                pagedShipments.map((s) => {
                  return (
                    <tr
                      key={s.id}
                      tabIndex={0}
                      role="button"
                      title="Click to view full consignment timeline and checkpoints"
                      onClick={(e) => onInteractiveRowClick(e, () => handleOpenShipment(s))}
                      onKeyDown={(e) => onInteractiveRowKeyDown(e, () => handleOpenShipment(s))}
                      className={cn(
                        "cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500/50",
                        isDark ? "hover:bg-[#0A4D66]/20" : "hover:bg-sky-50/60",
                      )}
                    >
                      {/* Purpose & Title */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div>{getPurposeBadge(s.purpose)}</div>
                          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-56">
                            {s.title || `Consignment #${s.id}`}
                          </span>
                        </div>
                      </td>

                      {/* Tracking / AWB */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-sky-500 dark:text-sky-400">
                            {s.tracking_number}
                          </span>
                          {s.customs_reference && (
                            <span className="text-[10px] text-amber-500 font-mono">
                              Customs: {s.customs_reference}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Carrier */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon icon="mdi:airplane-landing" className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium text-slate-700 dark:text-gray-300">
                            {s.carrier_name || "Air Freight"}
                          </span>
                        </div>
                      </td>

                      {/* Route */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-[11px]">
                          <span className="text-gray-400 truncate max-w-44">From: {s.origin || "Origin Depot"}</span>
                          <span className="font-medium text-slate-800 dark:text-gray-200 truncate max-w-44">
                            To: {s.destination || "Central Air Wing"}
                          </span>
                        </div>
                      </td>

                      {/* Reference / PO */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          {s.purchase_order_id ? (
                            <Link
                              to={`/dashboard/inventory/purchase-orders/${s.purchase_order_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-sky-500 hover:underline inline-flex items-center gap-1"
                            >
                              <span>PO #{s.purchase_order_id}</span>
                              <Icon icon="mdi:arrow-top-right" className="w-3 h-3" />
                            </Link>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Icon icon="mdi:check-circle" className="w-2.5 h-2.5" />
                                Standalone
                              </span>
                              {s.reference_numbers && (
                                <span className="font-mono text-gray-300 font-semibold truncate max-w-28 text-[11px]">
                                  {s.reference_numbers}
                                </span>
                              )}
                            </div>
                          )}
                          {(s.supplier?.name || s.vendor_name) && (
                            <span className="text-[10px] text-gray-400 truncate max-w-36">
                              {s.supplier?.name || s.vendor_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Stage */}
                      <td className="px-4 py-3">
                        {getStatusBadge(s.status)}
                      </td>

                      {/* Estimated Arrival */}
                      <td className="px-4 py-3">
                        <span className="text-slate-600 dark:text-gray-300">
                          {formatDate(s.estimated_delivery_date)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenShipment(s)}
                            className="px-2 py-1 rounded text-xs font-semibold text-sky-500 hover:bg-sky-500/10 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleSync(s.id, e)}
                            disabled={isSyncing}
                            title="Sync live carrier tracking"
                            className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                          >
                            <Icon icon="mdi:refresh" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Numbered Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#0A4D66]/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, filteredShipments.length)} of{" "}
              {filteredShipments.length} consignments
            </span>
            <NumberedPagination
              currentPage={currentPage}
              lastPage={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateShipmentModal
        isOpen={isCreateModalOpen}
        initialStandalone={isCreateStandalone}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsCreateModalOpen(false);
        }}
      />

      {selectedShipment && (
        <ShipmentDetailsModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedShipment(null);
          }}
          shipment={selectedShipment}
          onRefresh={refetch}
        />
      )}
    </div>
  );
};
