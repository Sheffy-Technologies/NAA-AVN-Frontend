import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type ShipmentStatus,
  useCreateShipmentMutation,
} from "../api";

interface CreateShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: number;
  poName?: string;
  defaultExpectedDate?: string | null;
  onSuccess?: () => void;
}

const CARRIERS = [
  { code: "auto-detect", name: "Auto-Detect Carrier (TrackingMore)" },
  { code: "dhl", name: "DHL Aviation / Express" },
  { code: "fedex", name: "FedEx Cargo" },
  { code: "ups", name: "UPS Air Freight" },
  { code: "naf-cargo", name: "NAF Tactical Air Transport (Military)" },
  { code: "panalpina", name: "Panalpina / DSV Air & Sea" },
  { code: "bollore", name: "Bolloré Africa Logistics" },
  { code: "other", name: "Other Commercial Forwarder" },
];

export const CreateShipmentModal: React.FC<CreateShipmentModalProps> = ({
  isOpen,
  onClose,
  purchaseOrderId,
  poName,
  defaultExpectedDate,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierCode, setCarrierCode] = useState("auto-detect");
  const [origin, setOrigin] = useState("Supplier Hub / OEM Facility");
  const [destination, setDestination] = useState("NAA Central Aviation Wing, Hangar 1");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(
    defaultExpectedDate || "",
  );
  const [initialStatus, setInitialStatus] = useState<ShipmentStatus>("picked_up");
  const [customsReference, setCustomsReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [createShipment, { isLoading }] = useCreateShipmentMutation();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!trackingNumber.trim()) {
      setError("Please provide a Tracking ID or Air Waybill (AWB) number.");
      return;
    }

    try {
      const selectedCarrier = CARRIERS.find((c) => c.code === carrierCode);

      await createShipment({
        purchase_order_id: purchaseOrderId,
        tracking_number: trackingNumber.trim(),
        carrier_code: carrierCode === "other" ? "auto-detect" : carrierCode,
        carrier_name: selectedCarrier ? selectedCarrier.name : "Carrier Freight",
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        estimated_delivery_date: estimatedDeliveryDate || undefined,
        status: initialStatus,
        customs_reference: customsReference.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();

      dispatch(
        showToast({
          message: "Shipment tracking registered successfully.",
          type: "success",
        }),
      );
      onSuccess?.();
      onClose();
    } catch {
      setError("Failed to register shipment. Please verify details.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-lg rounded-xl border p-6 shadow-2xl transition-all",
          isDark
            ? "bg-[#001219] border-[#0A4D66]/60 text-white"
            : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/20 text-sky-400">
              <Icon icon="mdi:airplane-takeoff" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Register Consignment Tracking
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)]">
                PO #{purchaseOrderId} {poName ? `• ${poName}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
              Tracking Number / Air Waybill (AWB) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1234567890 or 020-8849201"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF] font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
                Logistics Carrier
              </label>
              <select
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
              >
                {CARRIERS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
                Initial Status
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as ShipmentStatus)}
                className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
              >
                <option value="picked_up">1. Picked Up</option>
                <option value="customs_clearance">2. Customs Clearance</option>
                <option value="in_transit">3. In Transit</option>
                <option value="delivered">4. Delivered</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
                Origin
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Origin location"
                className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
                Destination
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination air wing"
                className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
                Est. Delivery Date
              </label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
                Customs Ref / Entry #
              </label>
              <input
                type="text"
                value={customsReference}
                onChange={(e) => setCustomsReference(e.target.value)}
                placeholder="e.g. CUST-NAA-901"
                className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
              Logistics Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Aircraft rotable spares, priority handling"
              className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#0A4D66]/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-semibold border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Icon
                icon={isLoading ? "mdi:loading" : "mdi:check"}
                className={cn("w-4 h-4", isLoading && "animate-spin")}
              />
              <span>{isLoading ? "Registering..." : "Register Tracking"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
