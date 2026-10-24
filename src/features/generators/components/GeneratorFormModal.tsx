import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetUnitsQuery } from "@/shared/api/units";
import { PrimaryButton, SecondaryButton } from "@/features/safety/components/sqUi";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import {
  useCreateGeneratorMutation,
  useUpdateGeneratorMutation,
  useUploadGeneratorImageMutation,
  type Generator,
  type GeneratorPayload,
} from "../api";
import { GENERATOR_STATUS_LABEL, apiError } from "../generatorHelpers";

type Values = Record<keyof GeneratorPayload, string>;

const FIELDS: Array<keyof GeneratorPayload> = [
  "name",
  "serial_number",
  "manufacturer",
  "model",
  "capacity_kva",
  "fuel_type",
  "fuel_tank_capacity_litres",
  "date_purchased",
  "purchase_cost",
  "supplier",
  "unit_id",
  "location",
  "opening_hours",
  "service_interval_hours",
  "hours_at_last_service",
  "status",
  "image",
  "notes",
];
const NUMERIC = new Set(["capacity_kva", "fuel_tank_capacity_litres", "purchase_cost", "opening_hours", "service_interval_hours", "hours_at_last_service", "unit_id"]);

const toValues = (g: Generator | null): Values =>
  Object.fromEntries(
    FIELDS.map((f) => {
      const v = g ? (g as Record<string, unknown>)[f] : f === "status" ? "operational" : f === "fuel_type" ? "diesel" : "";
      return [f, v === null || v === undefined ? "" : String(v).slice(0, f === "date_purchased" ? 10 : undefined)];
    }),
  ) as Values;

export const GeneratorFormModal = ({ generator, onClose, onSaved }: { generator: Generator | null; onClose: () => void; onSaved?: (id: number) => void }) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const { data: units = [] } = useGetUnitsQuery();
  const [create, { isLoading: creating }] = useCreateGeneratorMutation();
  const [update, { isLoading: updating }] = useUpdateGeneratorMutation();
  const [upload, { isLoading: uploading }] = useUploadGeneratorImageMutation();
  const [values, setValues] = useState<Values>(() => toValues(generator));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof GeneratorPayload, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const onImage = async (file?: File) => {
    if (!file) return;
    try {
      const res = await upload(file).unwrap();
      set("image", res.data);
    } catch (err) {
      setError(apiError(err, "The photo could not be uploaded."));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const data = Object.fromEntries(
      FIELDS.map((f) => [f, values[f] === "" ? null : NUMERIC.has(f) ? Number(values[f]) : values[f]]),
    ) as GeneratorPayload;
    try {
      const saved = generator ? await update({ id: generator.id, data }).unwrap() : await create(data).unwrap();
      dispatch(showToast({ type: "success", message: generator ? "Generator updated." : "Generator added." }));
      onSaved?.(saved.id);
      onClose();
    } catch (err) {
      setError(apiError(err, "Could not save the generator."));
    }
  };

  const input = (k: keyof GeneratorPayload, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="block text-xs font-semibold mb-1">
        {label} {props.required && <span className="text-red-500">*</span>}
      </span>
      <input {...props} value={values[k]} onChange={(e) => set(k, e.target.value)} className={fieldClass} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn("w-full max-w-3xl rounded-xl border p-6 shadow-2xl my-8", isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900")}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF] flex items-center gap-2">
            <Icon icon="mdi:engine-outline" className="w-5 h-5" />
            {generator ? `Edit ${generator.name}` : "Add generator"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-xs">
          {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300">{error}</div>}

          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-lg border border-dashed border-slate-300 dark:border-[#0A4D66] overflow-hidden grid place-items-center bg-slate-50 dark:bg-white/5 shrink-0">
              {values.image ? <img src={values.image} alt="" className="w-full h-full object-cover" /> : <Icon icon="mdi:image-outline" className="w-8 h-8 text-slate-400" />}
            </div>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#0A4D66] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5">
                <Icon icon={uploading ? "mdi:loading" : "mdi:camera-outline"} className={cn("w-4 h-4", uploading && "animate-spin")} />
                {uploading ? "Uploading…" : values.image ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
              </label>
              {values.image && (
                <button type="button" onClick={() => set("image", "")} className="block text-red-500 hover:underline">
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">{input("name", "Name / identifier", { required: true, placeholder: "e.g. HQ Gen 1" })}</div>
            <label className="block">
              <span className="block text-xs font-semibold mb-1">Status</span>
              <select value={values.status} onChange={(e) => set("status", e.target.value)} className={fieldClass}>
                {Object.entries(GENERATOR_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {input("manufacturer", "Manufacturer", { placeholder: "e.g. Perkins" })}
            {input("model", "Model")}
            {input("serial_number", "Serial number")}
            {input("capacity_kva", "Capacity (kVA)", { type: "number", min: 0, step: "0.1" })}
            <label className="block">
              <span className="block text-xs font-semibold mb-1">Fuel type</span>
              <select value={values.fuel_type} onChange={(e) => set("fuel_type", e.target.value)} className={fieldClass}>
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
                <option value="gas">Gas</option>
                <option value="other">Other</option>
              </select>
            </label>
            {input("fuel_tank_capacity_litres", "Tank capacity (L)", { type: "number", min: 0, step: "0.1" })}
            {input("date_purchased", "Date purchased", { type: "date", max: new Date().toISOString().slice(0, 10) })}
            {input("purchase_cost", "Purchase cost", { type: "number", min: 0, step: "0.01" })}
            {input("supplier", "Supplier")}
            <label className="block">
              <span className="block text-xs font-semibold mb-1">Unit</span>
              <select value={values.unit_id} onChange={(e) => set("unit_id", e.target.value)} className={fieldClass}>
                <option value="">Select unit…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            {input("location", "Location", { placeholder: "e.g. Hangar 2 power house" })}
            <label className="block">
              <span className="block text-xs font-semibold mb-1">Opening hour-meter reading</span>
              <input type="number" min={0} step="0.1" value={values.opening_hours} onChange={(e) => set("opening_hours", e.target.value)} className={fieldClass} />
              <span className="block mt-1 opacity-60">Cumulative hours count on from this.</span>
            </label>
            {input("service_interval_hours", "Service interval (hrs)", { type: "number", min: 0, step: "1" })}
            <label className="block">
              <span className="block text-xs font-semibold mb-1">Hour-meter at last service</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={values.hours_at_last_service}
                onChange={(e) => set("hours_at_last_service", e.target.value)}
                className={fieldClass}
              />
              <span className="block mt-1 opacity-60">Where the service countdown starts until maintenance is logged. Blank: the opening reading.</span>
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold mb-1">Notes</span>
            <textarea rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} className={fieldClass} />
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" icon="mdi:content-save-outline" disabled={creating || updating || uploading}>
              {creating || updating ? "Saving…" : generator ? "Save changes" : "Add generator"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
