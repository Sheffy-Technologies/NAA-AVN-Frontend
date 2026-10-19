import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useCreateDefectMutation } from "@/features/maintenance/api";
import { useDispatch } from "react-redux";
import { showToast } from "@/shared/store/toastSlice";

const PERSONNEL_FILTERS = {
  branches: [],
  units: [],
  ranks: [],
  corps: [],
  specialties: [],
  status: [],
};

type LogDefectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialAssetId?: number | null;
};

export const LogDefectModal: React.FC<LogDefectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialAssetId,
}) => {
  const { isDark } = useTheme();
  const dispatch = useDispatch();

  const { data: aircraftData = [], isLoading: isAssetsLoading } = useGetAssetsQuery({
    type: "aircraft",
  });
  const { data: personnelData = [], isLoading: isPersonnelLoading } =
    useGetPersonnelQuery(PERSONNEL_FILTERS);
  const [createDefect, { isLoading: isSubmitting }] = useCreateDefectMutation();

  const [assetId, setAssetId] = useState<string>(initialAssetId ? String(initialAssetId) : "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [reportedOn, setReportedOn] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportedHours, setReportedHours] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedAssetId = Number(assetId);
    if (!parsedAssetId || Number.isNaN(parsedAssetId)) {
      setErrorMsg("Please select an aircraft asset.");
      return;
    }

    if (!title.trim()) {
      setErrorMsg("Please enter a defect title.");
      return;
    }

    try {
      await createDefect({
        asset_id: parsedAssetId,
        title: title.trim(),
        description: description.trim() || null,
        severity, // explicitly lowercase: "low" | "medium" | "high" | "critical"
        status: "open",
        reported_at: reportedOn ? new Date(reportedOn).toISOString() : null,
        reported_hours: reportedHours ? Number(reportedHours) : null,
        reported_by: reportedBy ? Number(reportedBy) : null,
        remarks: remarks.trim() || null,
      }).unwrap();

      dispatch(
        showToast({
          type: "success",
          message: "Defect logged successfully.",
        }),
      );

      // Reset form
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setReportedHours("");
      setReportedBy("");
      setRemarks("");

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const serverMessage =
        err?.data?.message ||
        (err?.data?.errors
          ? Object.values(err.data.errors).flat().join(" ")
          : "Failed to log defect. Please check the inputs.");
      setErrorMsg(serverMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        className={cn(
          "w-full max-w-xl rounded-xl border p-6 shadow-2xl transition-all my-8",
          isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:alert-octagon-outline" className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">
              Log New Defect / Snag
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Asset Select */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              Asset <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              disabled={isAssetsLoading}
              className={cn(
                "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                isDark
                  ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                  : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
              )}
            >
              <option value="">Select asset</option>
              {aircraftData.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} {asset.tail_number ? `(${asset.tail_number})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Hydraulic leak on left main gear"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                isDark
                  ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                  : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Describe the defect in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors resize-none",
                isDark
                  ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                  : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
              )}
            />
          </div>

          {/* Row: Severity, Reported On, Reported At (Hours) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className={cn(
                  "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors capitalize",
                  isDark
                    ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                    : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
                )}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Reported On</label>
              <input
                type="date"
                value={reportedOn}
                onChange={(e) => setReportedOn(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                  isDark
                    ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                    : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Reported At (Hours)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="Airframe hours"
                value={reportedHours}
                onChange={(e) => setReportedHours(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                  isDark
                    ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                    : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
                )}
              />
            </div>
          </div>

          {/* Reported By */}
          <div>
            <label className="block text-xs font-semibold mb-1">Reported By</label>
            <select
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              disabled={isPersonnelLoading}
              className={cn(
                "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                isDark
                  ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                  : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
              )}
            >
              <option value="">Select personnel (optional)</option>
              {personnelData.map((person) => {
                const name = [person.firstname, person.othernames, person.lastname]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                const rank = person.rank?.name || "";
                return (
                  <option key={person.id} value={person.id}>
                    {rank ? `${rank} ` : ""}{name} {person.service_number ? `(${person.service_number})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold mb-1">Remarks</label>
            <input
              type="text"
              placeholder="Optional remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={cn(
                "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                isDark
                  ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                  : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
              )}
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors disabled:opacity-50"
            >
              <Icon icon="mdi:check" className="w-4 h-4" />
              <span>{isSubmitting ? "Logging Defect..." : "Log Defect"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
