import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { BackButton } from "@/shared/ui/button/BackButton";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SignaturePad, type SignaturePadHandle } from "@/features/approvals/components/SignaturePad";
import {
  useCreateMemoMutation,
  useGetMemoOptionsQuery,
  useGetMemoQuery,
  useSubmitMemoMutation,
  useUpdateMemoMutation,
  type MemoPayload,
} from "../api";
import { MemoEditor } from "../components/MemoEditor";
import { MemoSheet } from "../components/MemoSheet";
import { memoErrorMessage } from "../memoHelpers";

type FormState = Omit<MemoPayload, "approving_officer_id"> & { approving_officer_id: number | null };

const EMPTY: FormState = {
  reference: "",
  classification: "RESTRICTED",
  to: "",
  from: "",
  memo_date: new Date().toISOString().slice(0, 10),
  subject: "",
  body: "",
  originator_rank: "",
  originator_name: "",
  approving_officer_id: null,
};

const inputClass =
  "w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#7FD5FF]";

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-xs text-gray-400">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
  </label>
);

/** /dashboard/documents/memos/new and /dashboard/documents/memos/:id/edit */
export const MemoFormPage = () => {
  const { id: idParam } = useParams<{ id?: string }>();
  const memoId = idParam ? Number(idParam) : undefined;
  const navigate = useNavigate();

  const { data: options } = useGetMemoOptionsQuery();
  const { data: existing, isLoading: loadingMemo } = useGetMemoQuery(memoId!, { skip: !memoId });

  if ((memoId && loadingMemo) || (!memoId && !options)) {
    return <div className="px-6 py-16 text-center text-xs text-gray-400">Loading memo…</div>;
  }

  if (memoId && existing && !existing.can.edit) {
    return (
      <div className="px-6 py-16 text-center text-sm text-gray-300 space-y-3">
        <p>This memo can no longer be edited.</p>
        <button type="button" className="text-[#7FD5FF] underline" onClick={() => navigate(`/dashboard/documents/memos/${memoId}`)}>
          View memo
        </button>
      </div>
    );
  }

  // The form mounts once its starting values are known: the memo being
  // edited, or the user's own rank and name for a new one.
  const initial: FormState = existing
    ? {
        reference: existing.reference ?? "",
        classification: existing.classification,
        to: existing.to,
        from: existing.from,
        memo_date: existing.memo_date ?? EMPTY.memo_date,
        subject: existing.subject,
        body: existing.body ?? "",
        originator_rank: existing.originator_rank ?? "",
        originator_name: existing.originator_name ?? "",
        approving_officer_id: existing.approving_officer?.id ?? null,
      }
    : {
        ...EMPTY,
        classification: options?.defaults.classification ?? EMPTY.classification,
        memo_date: options?.defaults.memo_date ?? EMPTY.memo_date,
        originator_rank: options?.defaults.originator_rank ?? "",
        originator_name: options?.defaults.originator_name ?? "",
      };

  return <MemoForm key={memoId ?? "new"} memoId={memoId} initial={initial} />;
};

const MemoForm = ({ memoId, initial }: { memoId?: number; initial: FormState }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: options } = useGetMemoOptionsQuery();
  const [createMemo, { isLoading: creating }] = useCreateMemoMutation();
  const [updateMemo, { isLoading: updating }] = useUpdateMemoMutation();
  const [submitMemo, { isLoading: submitting }] = useSubmitMemoMutation();
  const [form, setForm] = useState<FormState>(initial);
  const padRef = useRef<SignaturePadHandle>(null);
  // Drawn signature, mirrored into the preview after each stroke.
  const [signature, setSignature] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const persist = async () => {
    if (!form.to.trim() || !form.from.trim() || !form.subject.trim()) {
      dispatch(showToast({ message: "To, From and Subject are required.", type: "error" }));
      return null;
    }

    const payload: MemoPayload = {
      ...form,
      reference: form.reference?.trim() || null,
      originator_rank: form.originator_rank?.trim() || null,
      originator_name: form.originator_name?.trim() || null,
    };

    try {
      return memoId ? await updateMemo({ id: memoId, data: payload }).unwrap() : await createMemo(payload).unwrap();
    } catch (error) {
      dispatch(showToast({ message: memoErrorMessage(error), type: "error" }));
      return null;
    }
  };

  const save = async () => {
    const saved = await persist();
    if (!saved) return;
    dispatch(showToast({ message: "Memo saved as draft.", type: "success" }));
    navigate(`/dashboard/documents/memos/${saved.id}`, { replace: true });
  };

  /** Saves the draft, then signs and sends it to the approving officer in one go. */
  const signAndSubmit = async () => {
    const drawn = padRef.current?.toDataUrl();
    if (!form.approving_officer_id) {
      dispatch(showToast({ message: "Choose the approving officer.", type: "error" }));
      return;
    }
    if (!drawn) {
      dispatch(showToast({ message: "Sign on the pad before submitting.", type: "error" }));
      return;
    }

    const saved = await persist();
    if (!saved) return;

    try {
      await submitMemo({ id: saved.id, approving_officer_id: form.approving_officer_id, signature: drawn }).unwrap();
      dispatch(showToast({ message: "Memo signed and sent for approval.", type: "success" }));
    } catch (error) {
      // The draft is saved; it can be submitted again from its page.
      dispatch(showToast({ message: memoErrorMessage(error), type: "error" }));
    }
    navigate(`/dashboard/documents/memos/${saved.id}`, { replace: true });
  };

  const approverOptions = (options?.users ?? []).map((u) => ({
    value: u.id,
    label: u.name,
    description: [u.service_number, u.email].filter(Boolean).join(" · ") || undefined,
  }));
  const saving = creating || updating || submitting;

  return (
    <div className="px-2 sm:px-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/documents?tab=memos" />
          <h1 className="text-sm font-semibold tracking-wide text-white uppercase">{memoId ? "Edit Memo" : "New Memo"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-[#0A4D66]/60 text-gray-200 text-xs font-medium hover:bg-[#0A4D66]/30 disabled:opacity-50"
          >
            <Icon icon="mdi:content-save-outline" className="w-4 h-4" />
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={() => void signAndSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#0369A1] text-white text-xs font-medium hover:bg-[#0369A1]/90 disabled:opacity-50"
          >
            <Icon icon="mdi:draw-pen" className="w-4 h-4" />
            Sign &amp; Submit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="To *">
              <input className={inputClass} value={form.to} onChange={(e) => set("to", e.target.value)} placeholder="e.g. Comd" />
            </Field>
            <Field label="From *">
              <input className={inputClass} value={form.from} onChange={(e) => set("from", e.target.value)} placeholder="e.g. D Ops" />
            </Field>
            <Field label="Reference" hint="Leave blank to have one generated when you submit.">
              <input
                className={inputClass}
                value={form.reference ?? ""}
                onChange={(e) => set("reference", e.target.value)}
                placeholder="e.g. NA AVN COMD/G1/300/31"
              />
            </Field>
            <Field label="Date *">
              <input type="date" className={inputClass} value={form.memo_date} onChange={(e) => set("memo_date", e.target.value)} />
            </Field>
            <Field label="Classification">
              <select className={inputClass} value={form.classification} onChange={(e) => set("classification", e.target.value)}>
                {(options?.classifications ?? ["RESTRICTED"]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Approving Officer" hint="Needed to submit; not needed to save a draft.">
              <SearchableSelect
                placeholder="Select approving officer"
                searchPlaceholder="Search by name, rank or service number..."
                options={approverOptions}
                value={form.approving_officer_id}
                onChange={(value) => set("approving_officer_id", value === null ? null : Number(value))}
              />
            </Field>
          </div>

          <Field label="Subject *">
            <input
              className={inputClass}
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="e.g. Req for funds for prod NA and NA Avn Comd badges"
            />
          </Field>

          <div className="space-y-1">
            <span className="text-xs text-gray-400">Body</span>
            <MemoEditor value={form.body} onChange={(html) => set("body", html)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Rank (signature line)">
              <input className={inputClass} value={form.originator_rank ?? ""} onChange={(e) => set("originator_rank", e.target.value)} placeholder="e.g. Maj" />
            </Field>
            <Field label="Name (signature line)">
              <input className={inputClass} value={form.originator_name ?? ""} onChange={(e) => set("originator_name", e.target.value)} placeholder="e.g. PJ KAJAKO" />
            </Field>
          </div>
          <div className="space-y-1" onPointerUp={() => setSignature(padRef.current?.toDataUrl() ?? null)}>
            <span className="text-xs text-gray-400">Signature</span>
            <SignaturePad ref={padRef} height={170} onChange={(hasInk) => !hasInk && setSignature(null)} />
            <p className="text-[11px] text-gray-500">
              Sign with your finger, stylus or mouse, then Sign &amp; Submit. A saved draft isn't signed; you can also sign later from the memo's page.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-bold text-[#7FD5FF] uppercase">Preview</h2>
          <div className="overflow-x-auto rounded-xl bg-[#0b1720] p-2 sm:p-4">
            <MemoSheet memo={{ ...form, status: "draft", id: memoId, has_originator_signature: false, originator_signature_src: signature }} />
          </div>
        </section>
      </div>
    </div>
  );
};
