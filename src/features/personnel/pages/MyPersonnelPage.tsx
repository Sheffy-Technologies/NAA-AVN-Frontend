import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton } from "@/shared/ui/button";
import {
  useGetMyPersonnelQuery,
  useUpdateMyPersonnelMutation,
  useUploadMyPersonnelImageMutation,
  type MyPersonnelField,
  type MyPersonnelResponse,
} from "../api";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

type FormValues = Record<MyPersonnelField, string>;

const inputCls =
  "w-full bg-[#001825] border border-[#0A4D66]/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#7FD5FF]";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const errorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Could not save your changes.";
};

const toValues = (p: MyPersonnelResponse["personnel"]): FormValues => ({
  othernames: p.othernames ?? "",
  dob: p.dob ? String(p.dob).slice(0, 10) : "",
  email: p.email ?? "",
  phone_number: p.phone_number ?? "",
  address: p.address ?? "",
  blood_group: p.blood_group ?? "",
  qualifications: p.qualifications ?? "",
});

/** Self-service view of the logged-in user's own personnel record. */
export const MyPersonnelPage = () => {
  const { data, isLoading, error } = useGetMyPersonnelQuery();

  return (
    <div className="space-y-6">
      <BackButton fallbackUrl="/dashboard/users" />
      {isLoading ? (
        <div className="text-sm text-gray-400">Loading your personnel record…</div>
      ) : !data ? (
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-sm text-gray-300 flex items-start gap-3">
          <Icon icon="mdi:link-variant-off" className="w-5 h-5 text-amber-400 shrink-0" />
          {(error as { data?: { message?: string } })?.data?.message ??
            "Your user account is not linked to a personnel record yet. Ask an administrator to link it."}
        </div>
      ) : (
        <MyPersonnelForm key={data.personnel.id} data={data} />
      )}
    </div>
  );
};

const MyPersonnelForm = ({ data }: { data: MyPersonnelResponse }) => {
  const dispatch = useAppDispatch();
  const p = data.personnel;
  const [values, setValues] = useState<FormValues>(() => toValues(p));
  const [error, setError] = useState<string | null>(null);
  const [updateMine, { isLoading: saving }] = useUpdateMyPersonnelMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadMyPersonnelImageMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = toValues(p);
  const dirty = (Object.keys(values) as MyPersonnelField[]).filter((k) => values[k] !== initial[k]);

  const set = (field: MyPersonnelField, value: string) => setValues((prev) => ({ ...prev, [field]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const body = Object.fromEntries(dirty.map((k) => [k, values[k] === "" ? null : values[k]]));
      const result = await updateMine(body).unwrap();
      setValues(toValues(result.personnel));
      dispatch(showToast({ type: "success", message: "Your personnel record has been updated." }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try {
      await uploadImage(file).unwrap();
      dispatch(showToast({ type: "success", message: "Photo updated." }));
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
    }
  };

  const official: Array<[string, string]> = [
    ["Service number", p.service_number ?? "-"],
    ["Rank", p.rank?.name ?? "-"],
    ["Unit", p.unit?.name ?? "-"],
    ["Corps", p.corp?.name ?? "-"],
    ["Branch", p.branch?.name ?? "-"],
    ["Specialty", p.specialty?.name ?? "-"],
    ["Status", p.status ? p.status.replace(/_/g, " ") : "-"],
    ["Call sign", p.call_sign ?? "-"],
    ["Type rating", p.rating_type ?? "-"],
    ["Date taken on strength", formatDate((p as { date_taken?: string | null }).date_taken)],
  ];

  return (
    <>
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative shrink-0">
          {p.image ? (
            <img src={p.image} alt="" className="w-20 h-20 rounded-full object-cover border border-[#0A4D66]" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#0A4D66]/40 grid place-items-center">
              <Icon icon="mdi:account" className="w-10 h-10 text-[#7FD5FF]" />
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Change photo"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#0A4D66] text-white grid place-items-center border-2 border-[#001219] disabled:opacity-50"
          >
            <Icon icon={uploading ? "mdi:loading" : "mdi:camera"} className={uploading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            {p.rank?.name ? `${p.rank.name} ` : ""}
            {p.firstname} {p.lastname}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {p.service_number} · {p.unit?.name ?? "No unit"}
          </p>
        </div>
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Service details</h2>
          <p className="text-xs text-gray-400 mt-0.5">Maintained by your unit's administration. Contact them if anything here is wrong.</p>
        </div>
        <dl className="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {official.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase text-gray-400">{label}</dt>
              <dd className="text-sm text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <form onSubmit={save} className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">My personal & contact details</h2>
          <p className="text-xs text-gray-400 mt-0.5">You can keep these up to date yourself.</p>
        </div>
        <div className="px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {error && <div className="lg:col-span-2 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">{error}</div>}
          <label className="space-y-1">
            <span className="text-[11px] uppercase text-gray-400">Other names</span>
            <input value={values.othernames} onChange={(e) => set("othernames", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase text-gray-400">Date of birth</span>
            <input type="date" value={values.dob} onChange={(e) => set("dob", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase text-gray-400">Email</span>
            <input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase text-gray-400">Phone number</span>
            <input value={values.phone_number} onChange={(e) => set("phone_number", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase text-gray-400">Blood group</span>
            <select value={values.blood_group} onChange={(e) => set("blood_group", e.target.value)} className={inputCls}>
              <option value="">Not recorded</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-[11px] uppercase text-gray-400">Address</span>
            <textarea rows={2} value={values.address} onChange={(e) => set("address", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-[11px] uppercase text-gray-400">Qualifications</span>
            <textarea rows={3} value={values.qualifications} onChange={(e) => set("qualifications", e.target.value)} className={inputCls} />
          </label>
          <div className="lg:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || dirty.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] disabled:opacity-50"
            >
              <Icon icon="mdi:content-save-outline" className="w-4 h-4" />
              {saving ? "Saving…" : "Save my details"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
};
