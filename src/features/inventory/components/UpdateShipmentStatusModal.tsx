import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type Shipment,
  type ShipmentStatus,
  useUpdateShipmentStatusMutation,
} from "../api";

interface UpdateShipmentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment;
  onSuccess?: () => void;
}

const STAGES: { key: ShipmentStatus; label: string; desc: string }[] = [
  { key: "picked_up", label: "1. Picked Up", desc: "Cargo collected by carrier from vendor/OEM" },
  { key: "customs_clearance", label: "2. Customs Clearance", desc: "Port inspection, duty exemption & defense clearance" },
  { key: "in_transit", label: "3. In Transit", desc: "Cargo en route via air freight or tactical haulage" },
  { key: "delivered", label: "4. Delivered", desc: "Consignment arrived at QM stores / hangar ready for GRN" },
];

export const UpdateShipmentStatusModal: React.FC<UpdateShipmentStatusModalProps> = ({
  isOpen,
  onClose,
  shipment,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  const [status, setStatus] = useState<ShipmentStatus>(shipment.status);
  const [location, setLocation] = useState(
    shipment.status === "customs_clearance"
      ? "NAIA Cargo Customs Terminal"
      : shipment.destination || "Base Hangar 1",
  );
  const [description, setDescription] = useState("");
  const [customsReference, setCustomsReference] = useState(
    shipment.customs_reference || "",
  );
  const [customsNotes, setCustomsNotes] = useState(shipment.customs_notes || "");
  const [error, setError] = useState<string | null>(null);

  const [updateStatus, { isLoading }] = useUpdateShipmentStatusMutation();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateStatus({
        id: shipment.id,
        status,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        customs_reference: customsReference.trim() || undefined,
        customs_notes: customsNotes.trim() || undefined,
      }).unwrap();

      dispatch(
        showToast({
          message: `Shipment status advanced to ${status.replace("_", " ")}.`,
          type: "success",
        }),
      );
      onSuccess?.();
      onClose();
    } catch {
      setError("Failed to update status. Please try again.");
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/20 text-indigo-400">
              <Icon icon="mdi:truck-fast-outline" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Advance Consignment Status
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)] font-mono">
                AWB: {shipment.tracking_number} ({shipment.carrier_name || "Carrier"})
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
            <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-2">
              Select Current Milestone Stage
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    status === s.key
                      ? "border-sky-400 bg-sky-500/15 ring-1 ring-sky-400"
                      : "border-[#0A4D66]/30 bg-[var(--theme-bg-input)] hover:border-[#0A4D66]/60",
                  )}
                >
                  <p className="text-xs font-bold text-[var(--theme-text-primary)]">
                    {s.label}
                  </p>
                  <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5 line-clamp-2">
                    {s.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
              Checkpoint Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. NAIA Cargo Terminal / Base Hangar"
              className="w-full rounded-md border border-[#0A4D66]/40 bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[#7FD5FF]"
            />
          </div>

          {status === "customs_clearance" && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Icon icon="mdi:shield-check-outline" className="w-4 h-4" />
                <span>Customs Clearance Details</span>
              </div>
              <div>
                <label className="block text-[11px] text-amber-300 mb-1">
                  Customs Reference / Bill of Entry #
                </label>
                <input
                  type="text"
                  value={customsReference}
                  onChange={(e) => setCustomsReference(e.target.value)}
                  placeholder="e.g. CUST-NAA-2026-9021"
                  className="w-full rounded-md border border-amber-500/40 bg-[var(--theme-bg-input)] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-amber-300 mb-1">
                  Customs & Exemption Notes
                </label>
                <input
                  type="text"
                  value={customsNotes}
                  onChange={(e) => setCustomsNotes(e.target.value)}
                  placeholder="e.g. End-user certificate signed; duty-free military clearance"
                  className="w-full rounded-md border border-amber-500/40 bg-[var(--theme-bg-input)] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text-secondary)] mb-1">
              Event Description / Officer Remark
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Remarks for ${status.replace("_", " ")}`}
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
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Icon
                icon={isLoading ? "mdi:loading" : "mdi:check"}
                className={cn("w-4 h-4", isLoading && "animate-spin")}
              />
              <span>{isLoading ? "Saving..." : "Update Milestone"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
