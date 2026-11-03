import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetAssetsQuery } from "@/features/assets/api";
import {
  useCreateUnserviceableSpareMutation,
  type UnserviceableSpareDisposition,
  type CreateUnserviceableSparePayload,
} from "../api";

interface LogUnserviceableSpareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAssetId?: number;
  onSuccess?: () => void;
}

const REMOVAL_REASONS = [
  "Defect / Premature Malfunction",
  "Scheduled Life Limit / TBO Reached",
  "Calendar Life Expiration",
  "Cannibalization for Operational Sortie",
  "Damage / Foreign Object Debris (FOD)",
  "Routine System Upgrade / Modification",
  "Other Unserviceable Condition",
];

const DISPOSITIONS: { value: UnserviceableSpareDisposition; label: string; badge: string }[] = [
  { value: "quarantine", label: "Quarantine Inspection (Pending Quality Review)", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { value: "awaiting_mro", label: "Awaiting MRO / External Overhaul Shipment", badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
  { value: "in_house_repair", label: "In-House Workshop Maintenance", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { value: "ber_scrap", label: "Beyond Economical Repair (BER) / Scrap", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  { value: "serviceable_reclaimed", label: "Re-certified Serviceable / Recalibrated", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
];

export const LogUnserviceableSpareModal: React.FC<LogUnserviceableSpareModalProps> = ({
  isOpen,
  onClose,
  initialAssetId,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  const { data: aircraftAssets = [] } = useGetAssetsQuery({ type: "aircraft" }, { skip: !isOpen });
  const [createSpare, { isLoading }] = useCreateUnserviceableSpareMutation();

  const [assetId, setAssetId] = useState<string>(initialAssetId ? String(initialAssetId) : "");
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [dateRemoved, setDateRemoved] = useState(new Date().toISOString().slice(0, 10));
  const [reasonForRemoval, setReasonForRemoval] = useState(REMOVAL_REASONS[0]);
  const [dispositionStatus, setDispositionStatus] = useState<UnserviceableSpareDisposition>("quarantine");
  const [storageLocation, setStorageLocation] = useState("Quarantine Bay A1, Central Hangar");
  const [removalRemarks, setRemovalRemarks] = useState("");

  // Operating life accumulators at removal
  const [tsnHours, setTsnHours] = useState("");
  const [tsoHours, setTsoHours] = useState("");
  const [tsiHours, setTsiHours] = useState("");
  const [csnCycles, setCsnCycles] = useState("");
  const [csoCycles, setCsoCycles] = useState("");

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assetId) {
      setError("Please select the source aircraft (e.g. NA 010 or NA 011).");
      return;
    }
    if (!partName.trim()) {
      setError("Please provide the part description or name.");
      return;
    }
    if (!partNumber.trim()) {
      setError("Please enter the manufacturer part number (P/N).");
      return;
    }
    if (!dateRemoved) {
      setError("Please specify the date of removal.");
      return;
    }

    const payload: CreateUnserviceableSparePayload = {
      asset_id: Number(assetId),
      part_name: partName.trim(),
      part_number: partNumber.trim(),
      serial_number: serialNumber.trim() || null,
      date_removed: dateRemoved,
      reason_for_removal: reasonForRemoval,
      disposition_status: dispositionStatus,
      storage_location: storageLocation.trim() || null,
      removal_remarks: removalRemarks.trim() || null,
      tsn_hours: tsnHours ? parseFloat(tsnHours) : null,
      tso_hours: tsoHours ? parseFloat(tsoHours) : null,
      tsi_hours: tsiHours ? parseFloat(tsiHours) : null,
      csn_cycles: csnCycles ? parseInt(csnCycles, 10) : null,
      cso_cycles: csoCycles ? parseInt(csoCycles, 10) : null,
    };

    try {
      await createSpare(payload).unwrap();
      dispatch(showToast({ message: "Unserviceable component logged to register.", type: "success" }));
      onSuccess?.();
      onClose();
    } catch {
      setError("Failed to log component. Please verify the entries and try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl border p-6 shadow-2xl transition-all my-8 max-h-[90vh] overflow-y-auto",
          isDark ? "bg-[#001219] border-[#0A4D66]/60 text-white" : "bg-white border-slate-200 text-slate-900 shadow-xl",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Icon icon="mdi:wrench-clock" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Log Unserviceable Spare / Component Removal
              </h3>
              <p className={cn("text-xs", isDark ? "text-gray-400" : "text-slate-500")}>
                Maintenance Inventory &middot; Official Component Removal &amp; Quarantine Register
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identification & Airframe */}
          <div className="p-3.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]/60 space-y-3">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold uppercase text-[11px] tracking-wide">
              <Icon icon="mdi:airplane" className="w-4 h-4" />
              <span>1. Component Identification &amp; Aircraft Source</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Source Aircraft Registration <span className="text-red-400">*</span>
                </label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">Select Aircraft (e.g. NA 010 / NA 011)...</option>
                  {aircraftAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tail_number || a.name} {a.serial_number ? `(${a.serial_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Date Removed from Airframe <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={dateRemoved}
                  onChange={(e) => setDateRemoved(e.target.value)}
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Part Name / Description <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="e.g. Swashplate Assembly, Boost Pump"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Part Number (P/N) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g. 206-011-100-019"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs font-mono text-sky-400 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Component Serial Number (S/N)
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. SN-880214 (or leave blank if non-serialized)"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Operating Life Accumulators */}
          <div className="p-3.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]/60 space-y-3">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase text-[11px] tracking-wide">
              <Icon icon="mdi:clock-time-four-outline" className="w-4 h-4" />
              <span>2. Operating Life Accumulators at Removal</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="block text-gray-400 text-[10px] font-semibold uppercase mb-1">
                  TSN (Hrs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={tsnHours}
                  onChange={(e) => setTsnHours(e.target.value)}
                  placeholder="0.0"
                  title="Time Since New"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-2 py-1.5 text-xs text-center font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[10px] font-semibold uppercase mb-1">
                  TSO (Hrs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={tsoHours}
                  onChange={(e) => setTsoHours(e.target.value)}
                  placeholder="0.0"
                  title="Time Since Overhaul"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-2 py-1.5 text-xs text-center font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[10px] font-semibold uppercase mb-1">
                  TSI (Hrs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={tsiHours}
                  onChange={(e) => setTsiHours(e.target.value)}
                  placeholder="0.0"
                  title="Time Since Installation"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-2 py-1.5 text-xs text-center font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[10px] font-semibold uppercase mb-1">
                  CSN (Cycles)
                </label>
                <input
                  type="number"
                  min="0"
                  value={csnCycles}
                  onChange={(e) => setCsnCycles(e.target.value)}
                  placeholder="0"
                  title="Cycles Since New"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-2 py-1.5 text-xs text-center font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-[10px] font-semibold uppercase mb-1">
                  CSO (Cycles)
                </label>
                <input
                  type="number"
                  min="0"
                  value={csoCycles}
                  onChange={(e) => setCsoCycles(e.target.value)}
                  placeholder="0"
                  title="Cycles Since Overhaul"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-2 py-1.5 text-xs text-center font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Reason for Removal & Disposition */}
          <div className="p-3.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]/60 space-y-3">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase text-[11px] tracking-wide">
              <Icon icon="mdi:shield-alert" className="w-4 h-4" />
              <span>3. Reason for Removal &amp; Immediate Disposition</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Primary Reason for Removal <span className="text-red-400">*</span>
                </label>
                <select
                  value={reasonForRemoval}
                  onChange={(e) => setReasonForRemoval(e.target.value)}
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {REMOVAL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Initial Disposition Status
                </label>
                <select
                  value={dispositionStatus}
                  onChange={(e) => setDispositionStatus(e.target.value as UnserviceableSpareDisposition)}
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {DISPOSITIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Physical Storage Location / Quarantine Bay
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g. Quarantine Shelf 2, Central Hangar 1"
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                  Removal Remarks / Defect Description
                </label>
                <textarea
                  rows={2}
                  value={removalRemarks}
                  onChange={(e) => setRemovalRemarks(e.target.value)}
                  placeholder="Record failure symptoms, warning flags, or reasons for component replacement..."
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#0A4D66]/20">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Icon icon={isLoading ? "mdi:loading" : "mdi:check"} className={cn("w-4 h-4", isLoading && "animate-spin")} />
              <span>{isLoading ? "Logging Component…" : "Record in Unserviceable Register"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

