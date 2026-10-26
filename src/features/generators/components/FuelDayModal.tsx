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
import { useSetFuelDayMutation, type GeneratorDetails, type GeneratorFuelDay } from "../api";
import { apiError, fmtDate, num } from "../generatorHelpers";

const ALL_PERSONNEL = { branches: [], units: [], ranks: [], corps: [], specialties: [], status: [] };

/**
 * The fuel balance at the end of one day, however many times the generator
 * ran. The day's consumption is worked out from it. Signed by the operator,
 * and re-signed whenever it is corrected.
 */
export const FuelDayModal = ({ generator, day, onClose }: { generator: GeneratorDetails; day: GeneratorFuelDay; onClose: () => void }) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const pad = useRef<SignaturePadHandle>(null);
  const { data: personnel = [] } = useGetPersonnelQuery(ALL_PERSONNEL);
  const [save, { isLoading }] = useSetFuelDayMutation();
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = day.fuel_day;
  const [closingText, setClosingText] = useState(existing ? String(existing.closing_litres) : "");
  const [operatorId, setOperatorId] = useState(existing?.operator_personnel_id ? String(existing.operator_personnel_id) : "");
  const [operatorName, setOperatorName] = useState(existing && !existing.operator_personnel_id ? existing.operator_name : "");
  const [remarks, setRemarks] = useState(existing?.remarks ?? "");

  const closing = closingText === "" ? null : Number(closingText);
  const available = day.fuel_total_available_litres;
  const consumed = closing !== null && available !== null ? available - closing : null;
  const tooHigh = closing !== null && available !== null && closing > available;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const signature = pad.current?.toDataUrl();
    if (closing === null) return setError("Enter the closing balance.");
    if (!signature) return setError("The operator must sign on the pad to confirm the closing balance.");
    if (!operatorId && !operatorName.trim()) return setError("Select the operator or type their name.");
    try {
      await save({
        generator_id: generator.id,
        date: day.date,
        data: {
          closing_litres: closing,
          operator_personnel_id: operatorId ? Number(operatorId) : null,
          operator_name: operatorId ? null : operatorName.trim(),
          signature,
          remarks: remarks.trim() || null,
        },
      }).unwrap();
      dispatch(showToast({ type: "success", message: "Day closing balance recorded." }));
      onClose();
    } catch (err) {
      setError(apiError(err, "Could not save the closing balance."));
    }
  };

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
        className={cn("w-full max-w-xl rounded-xl border p-6 shadow-2xl my-8", isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900")}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">Day closing balance</h3>
            <div className="text-xs opacity-70">
              {generator.name} · {fmtDate(day.date)} · {day.runs} run{day.runs === 1 ? "" : "s"}, {num(day.hours_worked, 2)} hrs
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-xs">
          {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300">{error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stat("Day opening", day.fuel_opening_litres === null ? "–" : `${num(day.fuel_opening_litres)} L`)}
            {stat("Received", `${num(day.fuel_received_litres)} L`)}
            {stat("Used today", consumed === null ? "–" : `${num(consumed)} L`, tooHigh)}
            {stat("Litres / hour", consumed !== null && consumed >= 0 && day.hours_worked > 0 ? num(consumed / day.hours_worked, 2) : "–")}
          </div>
          {day.fuel_opening_litres === null && (
            <p className="text-amber-600 dark:text-amber-300">
              The day's opening balance isn't known (no opening on the first run and no earlier closing), so fuel used can't be worked out for this day.
            </p>
          )}

          <label className="block">
            <span className="block font-semibold mb-1">
              Closing balance at end of day (L) <span className="text-red-500">*</span>
            </span>
            <input type="number" required min={0} step="0.1" value={closingText} onChange={(e) => setClosingText(e.target.value)} className={fieldClass} autoFocus />
            {tooHigh && <span className="block mt-1 text-red-500">Can't be more than the day's opening plus fuel received ({num(available)} L).</span>}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block font-semibold mb-1">
                Operator <span className="text-red-500">*</span>
              </span>
              <SearchableSelect
                size="sm"
                placeholder="Select personnel…"
                value={operatorId || null}
                onChange={(v) => setOperatorId(v === null ? "" : String(v))}
                options={personnel.map((p) => ({ value: String(p.id), label: `${p.firstname} ${p.lastname} (${p.service_number})` }))}
              />
            </label>
            {!operatorId && (
              <label className="block">
                <span className="block font-semibold mb-1">…or operator name</span>
                <input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="If not in personnel records" className={fieldClass} />
              </label>
            )}
          </div>

          <label className="block">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={fieldClass} />
          </label>

          <div>
            <span className="block font-semibold mb-1">
              Operator's signature <span className="text-red-500">*</span>
            </span>
            <SignaturePad ref={pad} onChange={setHasInk} height={150} />
            <p className="opacity-60 mt-1">{existing ? "Correcting the balance needs the operator to sign again." : "The operator signs to confirm the day's closing balance."}</p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" icon="mdi:draw-pen" disabled={isLoading || !hasInk || tooHigh || closing === null}>
              {isLoading ? "Saving…" : "Sign & save"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
