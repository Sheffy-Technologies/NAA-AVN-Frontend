import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type Shipment,
  type ShipmentCargoItem,
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

  const manifestItems: ShipmentCargoItem[] = (shipment.cargo_manifest && shipment.cargo_manifest.length > 0)
    ? shipment.cargo_manifest
    : (shipment.purchase_order?.items && shipment.purchase_order.items.length > 0)
    ? shipment.purchase_order.items.map((it, idx) => ({
        id: it.id || idx,
        part_name: it.inventory?.description || it.inventory?.part_name || "Aircraft Spare Part",
        part_number: it.inventory?.part_number || it.part_number || "P/N-N/A",
        alternate_part_number: it.inventory?.alternate_support_part_no || null,
        serial_number: it.inventory?.serial_number || null,
        nsn: it.inventory?.nsn || null,
        quantity: Number(it.quantity_ordered) || 1,
        uom: it.inventory?.unit_of_issue || it.inventory?.measurement_unit || "EA",
        condition: "Serviceable",
        remarks: null,
      }))
    : [];

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

          {/* Consignment Cargo Manifest Section */}
          <div className={cn("p-4 rounded-xl border mb-4 space-y-3", isDark ? "bg-[#001825] border-[#0A4D66]/50" : "bg-slate-50 border-slate-200")}>
            <div className="flex items-center justify-between pb-2 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:package-variant-closed" className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
                  Consignment Cargo Manifest ({manifestItems.length} {manifestItems.length === 1 ? "Item" : "Items"})
                </h3>
              </div>
              <span className="text-[11px] text-gray-400">
                Tracked under AWB: <strong className="font-mono text-sky-400">{shipment.tracking_number}</strong>
              </span>
            </div>

            {manifestItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">
                No individual parts recorded for this consignment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                  <thead>
                    <tr className="border-b border-[#0A4D66]/40 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 px-2">Part Description</th>
                      <th className="pb-2 px-2">Part Number (P/N)</th>
                      <th className="pb-2 px-2">Serial / NSN</th>
                      <th className="pb-2 px-2 text-center">Qty / UOM</th>
                      <th className="pb-2 pl-2">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A4D66]/20">
                    {manifestItems.map((item, idx) => (
                      <tr key={item.id ?? idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 pr-2 font-mono text-[11px] text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-2 font-medium text-slate-900 dark:text-white">{item.part_name}</td>
                        <td className="py-2 px-2 font-mono font-semibold text-sky-500 dark:text-sky-400">{item.part_number}</td>
                        <td className="py-2 px-2 font-mono text-[11px] text-gray-300">
                          {item.serial_number ? <span>S/N: {item.serial_number}</span> : item.nsn ? <span>NSN: {item.nsn}</span> : <span className="text-gray-500">—</span>}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-500 dark:text-emerald-400">
                          {item.quantity} {item.uom || "EA"}
                        </td>
                        <td className="py-2 pl-2">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {item.condition || "Serviceable"}
                          </span>
                        </td>
                      </tr>
                    ))} 
                  </tbody>
                </table>
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
