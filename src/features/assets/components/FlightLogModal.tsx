import { useState } from "react";
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
};

const inputClass =
  "w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]";
const labelClass = "text-[#7FD5FF] text-xs font-semibold uppercase mb-1 block";

export const FlightLogModal = ({ open, onClose, assetId, assetName }: Props) => {
  const dispatch = useAppDispatch();
  const [createFlightLog, { isLoading }] = useCreateFlightLogMutation();

  const [form, setForm] = useState({
    flight_date: new Date().toISOString().slice(0, 10),
    hours_flown: "",
    landings: "",
    cycles: "",
    remarks: "",
  });

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
              className="px-4 py-2 rounded border border-[#0A4D66]/40 text-xs text-gray-300 hover:bg-[#0A4D66]/20"
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
