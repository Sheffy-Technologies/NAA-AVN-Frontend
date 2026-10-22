import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { SignaturePad, type SignaturePadHandle } from "@/features/approvals/components/SignaturePad";
import { PrimaryButton, SecondaryButton } from "@/features/safety/components/sqUi";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import { useCreateUsageLogMutation, useUpdateUsageLogMutation, type GeneratorDetails, type GeneratorUsageLog } from "../api";
import { apiError, num, previewHours } from "../generatorHelpers";

const ALL_PERSONNEL = { branches: [], units: [], ranks: [], corps: [], specialties: [], status: [] };

type Values = {
  usage_date: string;
  time_on: string;
  time_off: string;
  fuel_opening_litres: string;
  fuel_received_litres: string;
  fuel_closing_litres: string;
  operator_personnel_id: string;
  operator_name: string;
  remarks: string;
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record (or correct) one generator run. The operator signs on the touch pad
 * to confirm the figures; editing an entry needs a fresh signature.
 */
export const UsageLogModal = ({ generator, log, onClose }: { generator: GeneratorDetails; log: GeneratorUsageLog | null; onClose: () => void }) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const pad = useRef<SignaturePadHandle>(null);
  const { data: personnel = [] } = useGetPersonnelQuery(ALL_PERSONNEL);
  const [create, { isLoading: creating }] = useCreateUsageLogMutation();
  const [update, { isLoading: updating }] = useUpdateUsageLogMutation();
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Values>(() =>
    log
      ? {
          usage_date: log.usage_date.slice(0, 10),
          time_on: log.time_on,
          time_off: log.time_off,
          fuel_opening_litres: String(log.fuel_opening_litres),
          fuel_received_litres: log.fuel_received_litres ? String(log.fuel_received_litres) : "",
          fuel_closing_litres: String(log.fuel_closing_litres),
          operator_personnel_id: log.operator_personnel_id ? String(log.operator_personnel_id) : "",
          operator_name: log.operator_personnel_id ? "" : log.operator_name,
          remarks: log.remarks ?? "",
        }
      : {
          usage_date: today(),
          time_on: "",
          time_off: "",
          fuel_opening_litres: String(generator.summary.next_entry_defaults.fuel_opening_litres ?? 0),
          fuel_received_litres: "",
          fuel_closing_litres: "",
          operator_personnel_id: "",
          operator_name: "",
          remarks: "",
        },
  );
  const set = (k: keyof Values, v: string) => setValues((p) => ({ ...p, [k]: v }));

  // Live preview of what the server will calculate.
  const hours = previewHours(values.time_on, values.time_off);
  const opening = Number(values.fuel_opening_litres || 0);
  const received = Number(values.fuel_received_litres || 0);
  const available = opening + received;
  const closing = values.fuel_closing_litres === "" ? null : Number(values.fuel_closing_litres);
  const consumed = closing === null ? null : available - closing;
  const closingTooHigh = closing !== null && closing > available;
  const crossesMidnight = hours !== null && values.time_off < values.time_on;
  const tankOverflow = generator.fuel_tank_capacity_litres ? available > generator.fuel_tank_capacity_litres : false;
  const previousClosing = generator.summary.next_entry_defaults.fuel_opening_litres;
  const openingDiffers = !log && generator.summary.total_runs > 0 && opening !== previousClosing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const signature = pad.current?.toDataUrl();
    if (!signature) {
      setError("The operator must sign on the pad to confirm this entry.");
      return;
    }
    if (!values.operator_personnel_id && !values.operator_name.trim()) {
      setError("Select the operator or type their name.");
      return;
    }
    const data = {
      usage_date: values.usage_date,
      time_on: values.time_on,
      time_off: values.time_off,
      fuel_opening_litres: opening,
      fuel_received_litres: values.fuel_received_litres === "" ? null : received,
      fuel_closing_litres: Number(values.fuel_closing_litres),
      operator_personnel_id: values.operator_personnel_id ? Number(values.operator_personnel_id) : null,
      operator_name: values.operator_personnel_id ? null : values.operator_name.trim(),
      signature,
      remarks: values.remarks.trim() || null,
    };
    try {
      if (log) await update({ id: log.id, generator_id: generator.id, data }).unwrap();
      else await create({ ...data, generator_id: generator.id }).unwrap();
      dispatch(showToast({ type: "success", message: log ? "Run updated and re-signed." : "Run recorded." }));
      onClose();
    } catch (err) {
      setError(apiError(err, "Could not save the run."));
    }
  };

  const busy = creating || updating;
  const stat = (label: string, value: React.ReactNode, warn = false) => (
    <div className={cn("rounded-lg border px-3 py-2", isDark ? "border-[#0A4D66]/50" : "border-slate-200", warn && "border-red-500/60")}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className={cn("text-sm font-bold", warn && "text-red-500")}>{value}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn("w-full max-w-2xl rounded-xl border p-6 shadow-2xl my-8", isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900")}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">{log ? "Correct run entry" : "Record generator run"}</h3>
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
              <input type="date" required max={today()} value={values.usage_date} onChange={(e) => set("usage_date", e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">
                Time on <span className="text-red-500">*</span>
              </span>
              <input type="time" required value={values.time_on} onChange={(e) => set("time_on", e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">
                Time off <span className="text-red-500">*</span>
              </span>
              <input type="time" required value={values.time_off} onChange={(e) => set("time_off", e.target.value)} className={fieldClass} />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block font-semibold mb-1">
                Opening balance (L) <span className="text-red-500">*</span>
              </span>
              <input type="number" required min={0} step="0.1" value={values.fuel_opening_litres} onChange={(e) => set("fuel_opening_litres", e.target.value)} className={fieldClass} />
              {openingDiffers && <span className="block mt-1 text-amber-600 dark:text-amber-300">Last closing balance was {num(previousClosing)} L.</span>}
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Received (L)</span>
              <input type="number" min={0} step="0.1" placeholder="0" value={values.fuel_received_litres} onChange={(e) => set("fuel_received_litres", e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">
                Closing balance (L) <span className="text-red-500">*</span>
              </span>
              <input type="number" required min={0} step="0.1" value={values.fuel_closing_litres} onChange={(e) => set("fuel_closing_litres", e.target.value)} className={fieldClass} />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stat("Hours worked", hours === null ? "–" : `${num(hours, 2)} h${crossesMidnight ? " ↻" : ""}`)}
            {stat("Total available", `${num(available)} L`, tankOverflow)}
            {stat("Fuel used", consumed === null ? "–" : `${num(consumed)} L`, closingTooHigh)}
            {stat("Litres / hour", hours && consumed !== null && consumed >= 0 ? num(consumed / hours, 2) : "–")}
          </div>
          {crossesMidnight && <p className="opacity-70">↻ Time off is earlier than time on, so the run is counted as continuing past midnight.</p>}
          {closingTooHigh && <p className="text-red-500">Closing balance can't be more than the total available.</p>}
          {tankOverflow && <p className="text-amber-600 dark:text-amber-300">Total available is more than the tank capacity ({num(generator.fuel_tank_capacity_litres)} L). Check the figures.</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block font-semibold mb-1">
                Operator <span className="text-red-500">*</span>
              </span>
              <SearchableSelect
                size="sm"
                placeholder="Select personnel…"
                value={values.operator_personnel_id || null}
                onChange={(v) => set("operator_personnel_id", v === null ? "" : String(v))}
                options={personnel.map((p) => ({ value: String(p.id), label: `${p.firstname} ${p.lastname} (${p.service_number})` }))}
              />
            </label>
            {!values.operator_personnel_id && (
              <label className="block">
                <span className="block font-semibold mb-1">…or operator name</span>
                <input value={values.operator_name} onChange={(e) => set("operator_name", e.target.value)} placeholder="If not in personnel records" className={fieldClass} />
              </label>
            )}
          </div>

          <label className="block">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea rows={2} value={values.remarks} onChange={(e) => set("remarks", e.target.value)} className={fieldClass} />
          </label>

          <div>
            <span className="block font-semibold mb-1">
              Operator's signature <span className="text-red-500">*</span>
            </span>
            <SignaturePad ref={pad} onChange={setHasInk} height={150} />
            <p className="opacity-60 mt-1">
              {log ? "Correcting an entry needs the operator to sign again." : "The operator signs to confirm the times and fuel figures above."}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" icon="mdi:draw-pen" disabled={busy || !hasInk || closingTooHigh || hours === null}>
              {busy ? "Saving…" : log ? "Sign & save" : "Sign & record run"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
