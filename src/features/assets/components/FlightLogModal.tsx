import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useCreateFlightLogMutation } from "../api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

type Props = {
  open: boolean;
  onClose: () => void;
  assetId: number;
  assetName?: string;
  initialValues?: {
    operation_id?: number | null;
    flight_date?: string;
    hours_flown?: number | string;
    remarks?: string;
  };
};

const inputClass =
  "w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]";
const labelClass = "text-[#7FD5FF] text-xs font-semibold uppercase mb-1 block";

export const FlightLogModal = ({ open, onClose, assetId, assetName, initialValues }: Props) => {
  const dispatch = useAppDispatch();
  const [createFlightLog, { isLoading }] = useCreateFlightLogMutation();

  const [form, setForm] = useState({
    flight_date: new Date().toISOString().slice(0, 10),
    hours_flown: "",
    landings: "",
    cycles: "",
    remarks: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        flight_date: initialValues?.flight_date || new Date().toISOString().slice(0, 10),
        hours_flown: initialValues?.hours_flown ? String(initialValues.hours_flown) : "",
        landings: "",
        cycles: "",
        remarks: initialValues?.remarks || "",
      });
    }
  }, [open, initialValues]);

  if (!open) return null;

  const resetForm = () =>
    setForm({
      flight_date: new Date().toISOString().slice(0, 10),
      hours_flown: "",
      landings: "",
      cycles: "",
      remarks: "",
    });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const hours = Number(form.hours_flown);
    if (!hours || hours <= 0) return;

    try {
      await createFlightLog({
        asset_id: assetId,
        operation_id: initialValues?.operation_id ?? undefined,
        flight_date: form.flight_date,
        hours_flown: hours,
        landings: form.landings ? Number(form.landings) : undefined,
        cycles: form.cycles ? Number(form.cycles) : undefined,
        remarks: form.remarks || null,
      }).unwrap();

      dispatch(showToast({ message: "Flight hours logged", type: "success" }));
      resetForm();
      onClose();
    } catch (error) {
      const message =
        (error as { data?: { message?: string } })?.data?.message ||
        "Failed to log flight hours";
      dispatch(showToast({ message, type: "error" }));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#0A4D66]/50 bg-[#001219] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Log Flight Hours</h3>
            {assetName && (
              <p className="mt-1 text-sm text-gray-400">for {assetName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {initialValues?.operation_id && (
            <div className="rounded-lg bg-sky-950/50 border border-sky-500/40 p-3 text-xs text-sky-200 flex items-start gap-2">
              <Icon icon="mdi:link-variant" className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Logging from Operation #{initialValues.operation_id}</span>
                <p className="text-[11px] text-sky-300/80 mt-0.5">
                  Flight date and flown hours have been prefilled from this operation. Enter landings and cycles to record in maintenance flight logs.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Flight Date</label>
            <input
              type="date"
              value={form.flight_date}
              onChange={(e) => setForm((f) => ({ ...f, flight_date: e.target.value }))}
              max={new Date().toISOString().slice(0, 10)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Hours Flown</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="48"
              value={form.hours_flown}
              onChange={(e) => setForm((f) => ({ ...f, hours_flown: e.target.value }))}
              placeholder="e.g. 2.5"
              required
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Landings</label>
              <input
                type="number"
                min="0"
                value={form.landings}
                onChange={(e) => setForm((f) => ({ ...f, landings: e.target.value }))}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cycles</label>
              <input
                type="number"
                min="0"
                value={form.cycles}
                onChange={(e) => setForm((f) => ({ ...f, cycles: e.target.value }))}
                placeholder="Defaults to landings"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              rows={3}
              placeholder="Optional notes about this flight..."
              className={cn(inputClass, "resize-none")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90 disabled:opacity-50"
            >
              {isLoading ? "Logging..." : "Log Flight"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
