import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { PrimaryButton, SecondaryButton } from "@/features/safety/components/sqUi";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import { apiError } from "../accommodationHelpers";

export type AccOption = { value: string | number; label: string; description?: string };

export type AccField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "search-select" | "checkbox";
  required?: boolean;
  options?: AccOption[];
  placeholder?: string;
  help?: string;
  wide?: boolean;
  min?: number;
  max?: string;
};

export type AccValues = Record<string, string | boolean>;

export const AccFormModal = ({
  title,
  icon,
  fields,
  initial,
  submitLabel = "Save",
  intro,
  onSubmit,
  onDelete,
  onClose,
}: {
  title: string;
  icon: string;
  fields: AccField[];
  initial: AccValues;
  submitLabel?: string;
  intro?: React.ReactNode;
  /** Resolve to close; throw (an RTK Query error) to show its message. */
  onSubmit: (values: AccValues) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
  onClose: () => void;
}) => {
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const [values, setValues] = useState<AccValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (name: string, value: string | boolean) => setValues((prev) => ({ ...prev, [name]: value }));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(apiError(err, "Could not save. Please check the details and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full max-w-2xl rounded-xl border p-6 shadow-2xl my-8",
          isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF] flex items-center gap-2">
            <Icon icon={icon} className="w-5 h-5" />
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => onSubmit(values));
          }}
          className="space-y-4 text-xs"
        >
          {intro}
          {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <label key={f.name} className={cn("block", (f.wide || f.type === "textarea") && "sm:col-span-2")}>
                {f.type === "checkbox" ? (
                  <span className="flex items-center gap-2 pt-5">
                    <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
                    <span className="font-semibold">{f.label}</span>
                  </span>
                ) : (
                  <>
                    <span className="block font-semibold mb-1">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </span>
                    {f.type === "textarea" ? (
                      <textarea rows={2} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className={fieldClass} />
                    ) : f.type === "select" ? (
                      <select required={f.required} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className={fieldClass}>
                        <option value="">{f.placeholder ?? "Select…"}</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "search-select" ? (
                      <SearchableSelect
                        options={f.options ?? []}
                        value={values[f.name] ? Number(values[f.name]) : null}
                        onChange={(v) => set(f.name, v === null ? "" : String(v))}
                        placeholder={f.placeholder ?? "Search…"}
                        clearable
                      />
                    ) : (
                      <input
                        type={f.type}
                        required={f.required}
                        min={f.min}
                        max={f.max}
                        placeholder={f.placeholder}
                        value={String(values[f.name] ?? "")}
                        onChange={(e) => set(f.name, e.target.value)}
                        className={fieldClass}
                      />
                    )}
                  </>
                )}
                {f.help && <span className="block mt-1 opacity-60">{f.help}</span>}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t dark:border-slate-700">
            <div>
              {onDelete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => window.confirm("Delete this record? This cannot be undone.") && void run(onDelete)}
                  className="inline-flex items-center gap-1 text-red-500 font-semibold hover:underline disabled:opacity-50"
                >
                  <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
              <PrimaryButton type="submit" icon="mdi:content-save-outline" disabled={busy}>
                {busy ? "Saving…" : submitLabel}
              </PrimaryButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
