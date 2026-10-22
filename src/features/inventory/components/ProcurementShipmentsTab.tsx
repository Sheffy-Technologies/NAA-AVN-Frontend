import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type Shipment,
  type ShipmentStatus,
  useGetShipmentsQuery,
  useSyncShipmentLiveMutation,
} from "../api";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "../inventoryUtils";
import { UpdateShipmentStatusModal } from "./UpdateShipmentStatusModal";

const STATUS_TABS: { key: "all" | ShipmentStatus; label: string; countColor: string }[] = [
  { key: "all", label: "All Consignments", countColor: "bg-gray-700 text-gray-200" },
  { key: "picked_up", label: "1. Picked Up", countColor: "bg-sky-500/20 text-sky-400" },
  { key: "customs_clearance", label: "2. Customs Clearance", countColor: "bg-amber-500/20 text-amber-400" },
  { key: "in_transit", label: "3. In Transit", countColor: "bg-indigo-500/20 text-indigo-400" },
  { key: "delivered", label: "4. Delivered", countColor: "bg-emerald-500/20 text-emerald-400" },
];

export const ProcurementShipmentsTab: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [activeStatus, setActiveStatus] = useState<"all" | ShipmentStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const { data: shipments = [], isLoading, refetch } = useGetShipmentsQuery();
  const [syncShipmentLive, { isLoading: isSyncing }] = useSyncShipmentLiveMutation();

  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      if (activeStatus !== "all" && s.status !== activeStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const awbMatch = (s.tracking_number || "").toLowerCase().includes(q);
        const carrierMatch = (s.carrier_name || "").toLowerCase().includes(q);
        const poMatch = `po #${s.purchase_order_id}`.toLowerCase().includes(q) || String(s.purchase_order_id).includes(q);
        const customsMatch = (s.customs_reference || "").toLowerCase().includes(q);
        return awbMatch || carrierMatch || poMatch || customsMatch;
      }
      return true;
    });
  }, [shipments, activeStatus, searchQuery]);

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

  return (
    <div className="space-y-4">
      {/* Search and Status Pills Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
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

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search AWB, carrier, PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-[var(--theme-bg-input)] border border-[#0A4D66]/40 text-[var(--theme-text-primary)] placeholder:text-gray-400 focus:outline-none focus:border-[#7FD5FF]"
            />
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div
        className={cn(
          "rounded-xl border overflow-hidden shadow-sm",
          isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200",
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
                <th className="px-4 py-3 font-semibold">Tracking # / AWB</th>
                <th className="px-4 py-3 font-semibold">Purchase Order</th>
                <th className="px-4 py-3 font-semibold">Carrier</th>
                <th className="px-4 py-3 font-semibold">Origin &rarr; Destination</th>
                <th className="px-4 py-3 font-semibold">Status Stage</th>
                <th className="px-4 py-3 font-semibold">Est. Arrival</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Loading consignments & shipments...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    <Icon icon="mdi:truck-outline" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-sm text-[var(--theme-text-primary)]">
                      No shipments matching your filter
                    </p>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                      Attach tracking numbers on Purchase Orders to monitor live transit milestones.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredShipments.map((s) => {
                  const handleRowNavigate = () => {
                    navigate(`/dashboard/inventory/purchase-orders/${s.purchase_order_id}`);
                  };

                  return (
                    <tr
                      key={s.id}
                      tabIndex={0}
                      role="button"
                      title="Click to view Purchase Order and full tracking timeline"
                      onClick={(e) => onInteractiveRowClick(e, handleRowNavigate)}
                      onKeyDown={(e) => onInteractiveRowKeyDown(e, handleRowNavigate)}
                      className={cn(
                        "cursor-pointer hover:bg-[#0A4D66]/20 transition-colors focus:outline-none focus:bg-[#0A4D66]/30",
                        isDark ? "bg-[#001219]" : "bg-white",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-sky-400">
                            {s.tracking_number}
                          </span>
                          {s.customs_reference && (
                            <span className="text-[10px] text-amber-400 font-mono">
                              Customs: {s.customs_reference}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--theme-text-primary)]">
                            PO #{s.purchase_order_id}
                          </span>
                          <span className="text-[11px] text-[var(--theme-text-muted)] truncate max-w-48">
                            {s.purchase_order?.name || s.purchase_order?.supplier?.name || "Order"}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                        <div className="flex items-center gap-1.5">
                          <Icon icon="mdi:truck-fast-outline" className="w-3.5 h-3.5 text-sky-400" />
                          <span>{s.carrier_name || "Commercial Cargo"}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                        <div className="truncate max-w-56 text-[11px]">
                          <span>{s.origin || "Origin"}</span>
                          <span className="mx-1 text-gray-500">&rarr;</span>
                          <span className="text-[var(--theme-text-primary)] font-medium">
                            {s.destination || "Base Hangar"}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {getStatusBadge(s.status)}
                      </td>

                      <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                        {formatDate(s.estimated_delivery_date || s.delivered_at)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleSync(s.id, e)}
                            disabled={isSyncing}
                            title="Query TrackingMore live carrier updates"
                            className="p-1.5 rounded border border-[#7FD5FF]/40 text-[#7FD5FF] hover:bg-[#0A4D66]/30 transition-colors"
                          >
                            <Icon icon="mdi:refresh" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShipment(s);
                              setIsUpdateModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-[#0A4D66]/30 text-white hover:bg-[#0A4D66]/50 transition-colors"
                          >
                            Update
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
      </div>

      {/* Manual Status Milestone Update Modal */}
      {selectedShipment && (
        <UpdateShipmentStatusModal
          isOpen={isUpdateModalOpen}
          onClose={() => {
            setIsUpdateModalOpen(false);
            setSelectedShipment(null);
          }}
          shipment={selectedShipment}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};
