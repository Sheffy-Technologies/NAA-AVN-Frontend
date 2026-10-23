import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import {
  useCreateSqRecordMutation,
  useDeleteSqRecordMutation,
  useUpdateSqRecordMutation,
  type SqRecord,
  type SqResource,
} from "../api";
import { useFieldClass } from "./sqHelpers";

export type SqFieldOption = { value: string | number; label: string };

export type SqField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "search-select" | "date" | "datetime" | "number" | "file";
  required?: boolean;
  options?: SqFieldOption[];
  placeholder?: string;
  help?: string;
  /** Span both columns of the two-column grid. */
  wide?: boolean;
  accept?: string;
  min?: number;
  max?: number;
};

type Values = Record<string, string | File | null>;

const toInputValue = (field: SqField, value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (field.type === "date") return text.slice(0, 10);
  if (field.type === "datetime") return text.slice(0, 16);
  return text;
};

const extractError = (error: unknown): string => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
  return first || data?.message || "Something went wrong. Please try again.";
};

export const RecordFormModal = ({
  open,
  onClose,
  resource,
  title,
  icon = "mdi:file-document-edit-outline",
  fields,
  record,
  defaults,
  canDelete,
  footerNote,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  resource: SqResource;
  title: string;
  icon?: string;
  fields: SqField[];
  /** When set, the modal edits this record instead of creating one. */
  record?: SqRecord | null;
  defaults?: Record<string, string>;
  canDelete?: boolean;
  footerNote?: string;
  /** Called after a successful delete, e.g. to leave a record page that no longer exists. */
  onDeleted?: () => void;
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const [createRecord, { isLoading: isCreating }] = useCreateSqRecordMutation();
  const [updateRecord, { isLoading: isUpdating }] = useUpdateSqRecordMutation();
  const [deleteRecord, { isLoading: isDeleting }] = useDeleteSqRecordMutation();
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const initialValues = useMemo(() => {
    const next: Values = {};
    fields.forEach((f) => {
      next[f.name] = f.type === "file" ? null : toInputValue(f, record ? record[f.name] : defaults?.[f.name]);
    });
    return next;
  }, [fields, record, defaults]);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setError(null);
      setConfirmDelete(false);
    }
    // Only reset when the modal opens or switches record, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  if (!open) return null;

  const set = (name: string, value: string | File | null) => setValues((prev) => ({ ...prev, [name]: value }));

  const buildBody = (): Record<string, unknown> | FormData => {
    const hasFile = fields.some((f) => f.type === "file" && values[f.name] instanceof File);
    if (hasFile) {
      const form = new FormData();
      fields.forEach((f) => {
        const v = values[f.name];
        if (v instanceof File) form.append(f.name, v);
        else if (typeof v === "string" && v !== "") form.append(f.name, v);
      });
      return form;
    }

    const body: Record<string, unknown> = {};
    fields.forEach((f) => {
      if (f.type === "file") return;
      const v = values[f.name];
      if (record && v === initialValues[f.name]) return;
      body[f.name] = v === "" ? null : v;
    });
    return body;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const body = buildBody();
      if (record) {
        await updateRecord({ resource, id: record.id, body }).unwrap();
      } else {
        await createRecord({ resource, body }).unwrap();
      }
      dispatch(showToast({ message: record ? "Record updated." : "Record created.", type: "success" }));
      onClose();
    } catch (err) {
      setError(extractError(err));
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteRecord({ resource, id: record.id }).unwrap();
      dispatch(showToast({ message: "Record deleted.", type: "success" }));
      onClose();
      onDeleted?.();
    } catch (err) {
      setError(extractError(err));
    }
  };

  const busy = isCreating || isUpdating || isDeleting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full max-w-2xl rounded-xl border p-6 shadow-2xl transition-all my-8",
          isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Icon icon={icon} className="w-5 h-5 text-[#0A4D66] dark:text-[#7FD5FF]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">{title}</h3>
            {typeof record?.reference === "string" && (
              <span className={cn("text-xs font-mono", isDark ? "text-gray-400" : "text-slate-500")}>{record.reference}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 dark:text-red-300">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => {
              const value = values[f.name];
              const text = typeof value === "string" ? value : "";
              return (
                <div key={f.name} className={cn(f.wide || f.type === "textarea" ? "sm:col-span-2" : "")}>
                  <label className="block text-xs font-semibold mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      rows={3}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={text}
                      onChange={(e) => set(f.name, e.target.value)}
                      className={fieldClass}
                    />
                  ) : f.type === "select" ? (
                    <select
                      required={f.required}
                      value={text}
                      onChange={(e) => set(f.name, e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">{f.placeholder ?? "Select…"}</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "search-select" ? (
                    <SearchableSelect
                      size="sm"
                      placeholder={f.placeholder ?? "Select…"}
                      value={text === "" ? null : text}
                      onChange={(v) => set(f.name, v === null ? "" : String(v))}
                      options={(f.options ?? []).map((o) => ({ value: String(o.value), label: o.label }))}
                    />
                  ) : f.type === "file" ? (
                    <input
                      type="file"
                      accept={f.accept}
                      onChange={(e) => set(f.name, e.target.files?.[0] ?? null)}
                      className={fieldClass}
                    />
                  ) : (
                    <input
                      type={f.type === "datetime" ? "datetime-local" : f.type}
                      required={f.required}
                      placeholder={f.placeholder}
                      min={f.min}
                      max={f.max}
                      value={text}
                      onChange={(e) => set(f.name, e.target.value)}
                      className={fieldClass}
                    />
                  )}
                  {f.help && <p className={cn("text-[11px] mt-1", isDark ? "text-gray-400" : "text-slate-500")}>{f.help}</p>}
                </div>
              );
            })}
          </div>

          {footerNote && <p className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>{footerNote}</p>}

          <div className="flex items-center justify-between gap-3 pt-3 border-t dark:border-slate-700">
            <div>
              {record && canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                  {confirmDelete ? "Click again to confirm" : "Delete"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors disabled:opacity-50"
              >
                <Icon icon="mdi:check" className="w-4 h-4" />
                {busy ? "Saving…" : record ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
