import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { PrimaryButton, SecondaryButton } from "@/features/safety/components/sqUi";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import {
  useCreateMaintenanceLogMutation,
  useUpdateMaintenanceLogMutation,
  type GeneratorDetails,
  type GeneratorMaintenanceLog,
  type MaintenanceType,
} from "../api";
import { MAINTENANCE_TYPE_LABEL, apiError } from "../generatorHelpers";

const today = () => new Date().toISOString().slice(0, 10);

/** Types that are a service by default, so they restart the countdown. */
const RESETS_BY_DEFAULT: MaintenanceType[] = ["routine_service", "overhaul"];

/**
 * Log maintenance on a generator. A service restarts the hours-to-next-service
 * countdown from this hour-meter reading; a repair usually doesn't.
 */
export const MaintenanceLogModal = ({ generator, log, onClose }: { generator: GeneratorDetails; log: GeneratorMaintenanceLog | null; onClose: () => void }) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const [create, { isLoading: creating }] = useCreateMaintenanceLogMutation();
  const [update, { isLoading: updating }] = useUpdateMaintenanceLogMutation();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    service_date: log?.service_date.slice(0, 10) ?? today(),
    hour_meter_reading: String(log?.hour_meter_reading ?? generator.summary.cumulative_hours),
    maintenance_type: (log?.maintenance_type ?? "routine_service") as MaintenanceType,
    description: log?.description ?? "",
    performed_by: log?.performed_by ?? "",
    cost: log?.cost != null ? String(log.cost) : "",
    resets_service_counter: log?.resets_service_counter ?? true,
  });
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => setValues((p) => ({ ...p, [k]: v }));

  const interval = generator.service_interval_hours;
  const reading = Number(values.hour_meter_reading || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const data = {
      service_date: values.service_date,
      hour_meter_reading: reading,
      maintenance_type: values.maintenance_type,
      description: values.description.trim() || null,
      performed_by: values.performed_by.trim() || null,
      cost: values.cost === "" ? null : Number(values.cost),
      resets_service_counter: values.resets_service_counter,
    };
    try {
      if (log) await update({ id: log.id, generator_id: generator.id, data }).unwrap();
      else await create({ ...data, generator_id: generator.id }).unwrap();
      dispatch(showToast({ type: "success", message: log ? "Maintenance entry updated." : "Maintenance logged." }));
      onClose();
    } catch (err) {
      setError(apiError(err, "Could not save the maintenance entry."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn("w-full max-w-xl rounded-xl border p-6 shadow-2xl my-8", isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900")}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">{log ? "Edit maintenance" : "Log maintenance"}</h3>
            <div className="text-xs opacity-70">{generator.name}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-xs">
          {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block font-semibold mb-1">
                Date <span className="text-red-500">*</span>
              </span>
              <input type="date" required max={today()} value={values.service_date} onChange={(e) => set("service_date", e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">
                Hour-meter reading <span className="text-red-500">*</span>
              </span>
              <input type="number" required min={0} step="0.1" value={values.hour_meter_reading} onChange={(e) => set("hour_meter_reading", e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">
                Type <span className="text-red-500">*</span>
              </span>
              <select
                value={values.maintenance_type}
                onChange={(e) => {
                  const type = e.target.value as MaintenanceType;
                  setValues((p) => ({ ...p, maintenance_type: type, resets_service_counter: RESETS_BY_DEFAULT.includes(type) }));
                }}
                className={fieldClass}
              >
                {(Object.keys(MAINTENANCE_TYPE_LABEL) as MaintenanceType[]).map((t) => (
                  <option key={t} value={t}>
                    {MAINTENANCE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block font-semibold mb-1">Work done</span>
            <textarea
              rows={3}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Engine oil and oil filter changed, fuel filter replaced, air filter cleaned"
              className={fieldClass}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block font-semibold mb-1">Performed by</span>
              <input value={values.performed_by} onChange={(e) => set("performed_by", e.target.value)} placeholder="Technician or contractor" className={fieldClass} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Cost</span>
              <input type="number" min={0} step="0.01" value={values.cost} onChange={(e) => set("cost", e.target.value)} className={fieldClass} />
            </label>
          </div>

          <label
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer",
              values.resets_service_counter ? "border-emerald-500/40 bg-emerald-500/5" : isDark ? "border-[#0A4D66]/50" : "border-slate-200",
            )}
          >
            <input
              type="checkbox"
              checked={values.resets_service_counter}
              onChange={(e) => set("resets_service_counter", e.target.checked)}
              className="mt-0.5 accent-emerald-600"
            />
            <span>
              <span className="block font-semibold">This was the scheduled service: restart the countdown</span>
              <span className="block opacity-70 mt-0.5">
                {interval
                  ? values.resets_service_counter
                    ? `Next service will be due at ${(reading + interval).toLocaleString()} hrs (every ${interval.toLocaleString()} hrs).`
                    : "Leave unticked for repairs and checks that don't count as the scheduled service."
                  : "Set a service interval on the generator to get a countdown to the next service."}
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" icon="mdi:wrench-check-outline" disabled={creating || updating}>
              {creating || updating ? "Saving…" : log ? "Save changes" : "Log maintenance"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
