import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type Shipment,
  useSyncShipmentLiveMutation,
} from "../api";
import { ShipmentTrackerStepper } from "./ShipmentTrackerStepper";
import { UpdateShipmentStatusModal } from "./UpdateShipmentStatusModal";
import { SHIPMENT_PURPOSES } from "./CreateShipmentModal";
import { Link } from "react-router-dom";

interface ShipmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  onRefresh?: () => void;
}

export const ShipmentDetailsModal: React.FC<ShipmentDetailsModalProps> = ({
  isOpen,
  onClose,
  shipment,
  onRefresh,
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const [syncShipmentLive, { isLoading: isSyncing }] = useSyncShipmentLiveMutation();

  if (!isOpen || !shipment) return null;

  const purposeMeta = SHIPMENT_PURPOSES.find((p) => p.key === (shipment.purpose || "procurement"));

  const handleSync = async () => {
    try {
      await syncShipmentLive(shipment.id).unwrap();
      dispatch(showToast({ message: "Live tracking synchronized.", type: "success" }));
      onRefresh?.();
    } catch {
      dispatch(showToast({ message: "Live sync failed.", type: "error" }));
    }
  };

  const handleCopyAwb = () => {
    navigator.clipboard.writeText(shipment.tracking_number);
    dispatch(showToast({ message: "AWB copied to clipboard", type: "success" }));
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <div
          className={cn(
            "w-full max-w-3xl rounded-2xl border p-6 shadow-2xl transition-all my-8 max-h-[90vh] overflow-y-auto",
            isDark
              ? "bg-[#001219] border-[#0A4D66]/60 text-white"
              : "bg-white border-slate-200 text-slate-900 shadow-xl",
          )}
        >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#0A4D66]/20">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                    purposeMeta?.badgeClass || "bg-sky-500/15 text-sky-400 border-sky-500/30",
                  )}
                >
                  <Icon icon={purposeMeta?.icon || "mdi:package"} className="w-3.5 h-3.5" />
                  <span>{purposeMeta?.label || "Procurement"}</span>
                </span>

                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 flex items-center gap-1">
                  <span>AWB: {shipment.tracking_number}</span>
                  <button
                    type="button"
                    onClick={handleCopyAwb}
                    title="Copy AWB"
                    className="hover:text-white"
                  >
                    <Icon icon="mdi:content-copy" className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {shipment.title || `Consignment ${shipment.tracking_number}`}
              </h2>

              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-2">
                <span>Carrier: <strong>{shipment.carrier_name || "Commercial Carrier"}</strong></span>
                {shipment.customs_reference && (
                  <span>• Customs Ref: <strong className="text-amber-500">{shipment.customs_reference}</strong></span>
                )}
                {shipment.reference_numbers && (
                  <span>• Ref: <strong className="font-mono">{shipment.reference_numbers}</strong></span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  isDark
                    ? "border-sky-500/40 text-sky-300 hover:bg-sky-950/40"
                    : "border-sky-300 text-sky-700 hover:bg-sky-50",
                )}
              >
                <Icon
                  icon={isSyncing ? "mdi:loading" : "mdi:refresh"}
                  className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")}
                />
                <span>Sync Live</span>
              </button>

              <button
                type="button"
                onClick={() => setIsUpdateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] hover:bg-[#083c50] text-white transition-colors shadow-sm"
              >
                <Icon icon="mdi:pencil" className="w-3.5 h-3.5" />
                <span>Update Status</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stepper Tracking Visualizer */}
          <div className="my-4">
            <ShipmentTrackerStepper
              shipment={shipment}
              onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
            />
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-4">
            <div className={cn("p-3 rounded-xl border text-xs", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
              <span className="text-gray-400 block text-[10px] uppercase font-semibold">Origin</span>
              <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">
                {shipment.origin || "Supplier / OEM Hub"}
              </span>
              {shipment.origin_unit && (
                <span className="text-[10px] text-sky-500 block mt-0.5">
                  Base: {shipment.origin_unit.name}
                </span>
              )}
            </div>

            <div className={cn("p-3 rounded-xl border text-xs", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
              <span className="text-gray-400 block text-[10px] uppercase font-semibold">Destination</span>
              <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">
                {shipment.destination || "NAA Aviation Wing, Hangar 1"}
              </span>
              {shipment.destination_unit && (
                <span className="text-[10px] text-sky-500 block mt-0.5">
                  Base: {shipment.destination_unit.name}
                </span>
              )}
            </div>

            <div className={cn("p-3 rounded-xl border text-xs", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
              <span className="text-gray-400 block text-[10px] uppercase font-semibold">Estimated Arrival</span>
              <span className="font-semibold text-emerald-500 mt-0.5 block">
                {shipment.estimated_delivery_date ? formatDate(shipment.estimated_delivery_date) : "Pending Schedule"}
              </span>
            </div>

            {shipment.purchase_order_id ? (
              <div className={cn("p-3 rounded-xl border text-xs", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Linked Purchase Order</span>
                <Link
                  to={`/dashboard/inventory/purchase-orders/${shipment.purchase_order_id}`}
                  state={{
                    from: "/dashboard/inventory?tab=procurement&subtab=shipments",
                    fromLabel: "Consignments & Shipments",
                  }}
                  className="font-semibold text-sky-500 hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  <span>PO #{shipment.purchase_order_id}</span>
                  <Icon icon="mdi:arrow-top-right" className="w-3.5 h-3.5" />
                </Link>
                {shipment.purchase_order?.name && (
                  <span className="text-[10px] text-gray-400 block truncate">
                    {shipment.purchase_order.name}
                  </span>
                )}
              </div>
            ) : (
              <div className={cn("p-3 rounded-xl border text-xs", isDark ? "bg-[#001825] border-emerald-500/30" : "bg-emerald-50/50 border-emerald-200")}>
                <span className="text-emerald-500 dark:text-emerald-400 block text-[10px] uppercase font-semibold">Procurement Linkage</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 mt-0.5">
                  <Icon icon="mdi:check-decagram-outline" className="w-3.5 h-3.5" />
                  <span>Standalone Consignment (No PO)</span>
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Direct freight / inter-base / MRO transfer
                </span>
              </div>
            )}

            {(shipment.supplier || shipment.vendor_name) && (
              <div className={cn("p-3 rounded-xl border text-xs", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Supplier / MRO Agency</span>
                <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">
                  {shipment.supplier?.name || shipment.vendor_name}
                </span>
              </div>
            )}

            {shipment.asset && (
              <div className={cn("p-3 rounded-xl border text-xs", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Target Aircraft</span>
                <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 inline-flex items-center gap-1">
                  <Icon icon="mdi:airplane" className="w-3.5 h-3.5 text-sky-400" />
                  <span>{shipment.asset.tail_number || shipment.asset.name}</span>
                </span>
              </div>
            )}
          </div>

          {shipment.notes && (
            <div className={cn("p-3 rounded-xl border text-xs mb-4", isDark ? "bg-[#001825] border-[#0A4D66]/40 text-gray-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
              <strong className="block text-gray-400 text-[10px] uppercase mb-1">Handling Notes:</strong>
              <p>{shipment.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#0A4D66]/20">
            <span className="text-[11px] text-gray-400">
              Registered on {formatDate(shipment.created_at)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>

      {isUpdateModalOpen && (
        <UpdateShipmentStatusModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          shipment={shipment}
          onSuccess={() => {
            setIsUpdateModalOpen(false);
            onRefresh?.();
          }}
        />
      )}
    </>
  );
};
