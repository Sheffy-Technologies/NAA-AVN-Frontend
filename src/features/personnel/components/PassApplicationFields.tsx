import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SignaturePad, type SignaturePadHandle } from "@/features/approvals/components/SignaturePad";
import { SignatureImage } from "@/features/approvals/components/ApprovalPanel";
import { PASS_TYPES, type PassSignaturePayload, type PassSigner } from "../passApi";
import { PASS_SIGNERS, type PassFormValues } from "../passForm";

export type PassApplicationFieldsHandle = {
  /** Signatures to send: drawn ones as PNG data URLs, removed ones as null. Unchanged ones are left out. */
  collectSignatures: () => PassSignaturePayload;
};

const inputClass =
  "w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40";

const Field = ({ n, label, children, wide }: { n?: string; label: string; children: React.ReactNode; wide?: boolean }) => (
  <label className={wide ? "block sm:col-span-2" : "block"}>
    <span className="block text-xs text-gray-400 mb-1">
      {n && <span className="font-semibold text-[#7FD5FF] mr-1">{n}.</span>}
      {label}
    </span>
    {children}
  </label>
);

/** One of the form's signatures: the saved one with Replace/Remove, or a pad to draw on. */
const SignatureField = ({
  label,
  savedPath,
  padRef,
  mode,
  setMode,
}: {
  label: string;
  savedPath: string | null;
  padRef: React.RefObject<SignaturePadHandle | null>;
  mode: "keep" | "draw" | "remove";
  setMode: (m: "keep" | "draw" | "remove") => void;
}) => (
  <div className="sm:col-span-2">
    <span className="block text-xs text-gray-400 mb-1">{label}</span>
    {savedPath && mode === "keep" ? (
      <div className="flex items-center gap-3">
        <SignatureImage path={savedPath} />
        <button type="button" onClick={() => setMode("draw")} className="text-xs font-semibold text-[#7FD5FF] hover:underline">
          Replace
        </button>
        <button type="button" onClick={() => setMode("remove")} className="text-xs font-semibold text-red-400 hover:underline">
          Remove
        </button>
      </div>
    ) : savedPath && mode === "remove" ? (
      <div className="flex items-center gap-3 text-xs text-red-300">
        Signature will be removed when you save.
        <button type="button" onClick={() => setMode("keep")} className="font-semibold text-[#7FD5FF] hover:underline">
          Undo
        </button>
      </div>
    ) : (
      <SignaturePad ref={padRef} height={120} />
    )}
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="rounded-lg border border-[#0A4D66]/40 p-3">
    <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#7FD5FF]">{title}</legend>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  </fieldset>
);

/**
 * Items 4–7 and 10–15 of NA FORM/00001/07. The person (1–3) and the dates
 * (8–9) stay in the modal that hosts this. `passId` shows saved signatures.
 */
export const PassApplicationFields = forwardRef<
  PassApplicationFieldsHandle,
  {
    values: PassFormValues;
    onChange: <K extends keyof PassFormValues>(key: K, value: PassFormValues[K]) => void;
    passId?: number;
    savedSignatures?: Partial<Record<PassSigner, boolean>>;
    attachment: React.ReactNode;
    /** Items 14–15 are signed through the pass approval workflow, so they aren't typed here. */
    officersViaWorkflow?: boolean;
  }
>(({ values, onChange, passId, savedSignatures, attachment, officersViaWorkflow }, ref) => {
  const pads = {
    applicant: useRef<SignaturePadHandle>(null),
    recommending_officer: useRef<SignaturePadHandle>(null),
    approving_officer: useRef<SignaturePadHandle>(null),
  };
  const [modes, setModes] = useState<Record<PassSigner, "keep" | "draw" | "remove">>({
    applicant: "keep",
    recommending_officer: "keep",
    approving_officer: "keep",
  });

  useImperativeHandle(ref, () => ({
    collectSignatures: () => {
      const payload: PassSignaturePayload = {};
      for (const { key } of PASS_SIGNERS) {
        if (officersViaWorkflow && key !== "applicant") continue;
        if (modes[key] === "remove") payload[`${key}_signature`] = null;
        else {
          const drawn = pads[key].current?.toDataUrl();
          if (drawn) payload[`${key}_signature`] = drawn;
        }
      }
      return payload;
    },
  }));

  const text = (key: keyof PassFormValues) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(key, e.target.value as never),
    className: inputClass,
  });
  const signature = (key: PassSigner) => {
    const label = PASS_SIGNERS.find((s) => s.key === key)!.label;
    return (
      <SignatureField
        label={label}
        savedPath={passId && savedSignatures?.[key] ? `/passes/${passId}/signature/${key}` : null}
        padRef={pads[key]}
        mode={modes[key]}
        setMode={(m) => setModes((prev) => ({ ...prev, [key]: m }))}
      />
    );
  };

  return (
    <div className="space-y-4">
      <Section title="Application">
        <Field n="4" label="Place of deployment">
          <input {...text("place_of_deployment")} placeholder="e.g. 601 Avn Bn, Giri" />
        </Field>
        <Field n="5" label="Appointment">
          <input {...text("appointment")} placeholder="e.g. Ops Officer" />
        </Field>
        <Field n="6" label="Leave/pass description">
          <select value={values.pass_type} onChange={(e) => onChange("pass_type", e.target.value as PassFormValues["pass_type"])} className={inputClass}>
            <option value="">Select…</option>
            {PASS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field n="7" label="Request made through">
            <input {...text("request_through")} placeholder="e.g. OC A Coy" />
          </Field>
          <Field label="To">
            <input {...text("request_to")} placeholder="e.g. CO" />
          </Field>
        </div>
        <Field n="10" label="Reason for application" wide>
          <textarea {...text("reason")} rows={2} />
        </Field>
        <div className="sm:col-span-2">
          <span className="block text-xs text-gray-400 mb-1">
            <span className="font-semibold text-[#7FD5FF] mr-1">11.</span>Attachment of application (if any)
          </span>
          {attachment}
        </div>
        <Field n="12" label="Place of travel intended" wide>
          <textarea {...text("travel_destination")} rows={2} />
        </Field>
        <Field n="13" label="Contact address">
          <textarea {...text("contact_address")} rows={2} />
        </Field>
        <Field label="Tel">
          <input {...text("contact_phone")} inputMode="tel" />
        </Field>
        {signature("applicant")}
      </Section>

      {officersViaWorkflow ? (
        <div className="flex items-start gap-2 rounded-lg border border-[#0A4D66]/40 bg-[#0A4D66]/10 p-3 text-xs text-gray-300">
          <Icon icon="mdi:file-sign" className="w-4 h-4 mt-0.5 shrink-0 text-[#7FD5FF]" />
          <span>
            <strong className="text-white">Items 14 and 15</strong> (recommending and approving officers) are signed through the
            approval workflow. Submit the pass for approval from its page; each officer's comment, rank and name, appointment,
            date and signature are filled in as they sign.
          </span>
        </div>
      ) : (
      <>
      <Section title="14. Recommending officer">
        <Field label="Comment" wide>
          <textarea {...text("recommending_officer_comment")} rows={2} />
        </Field>
        <Field label="Rank / name">
          <input {...text("recommending_officer_name")} />
        </Field>
        <Field label="Appointment">
          <input {...text("recommending_officer_appointment")} />
        </Field>
        <Field label="Date">
          <input type="date" {...text("recommending_officer_date")} />
        </Field>
        {signature("recommending_officer")}
      </Section>

      <Section title="15. Approving officer">
        <Field label="Comment" wide>
          <textarea {...text("approving_officer_comment")} rows={2} />
        </Field>
        <Field label="Rank / name">
          <input {...text("approving_officer_name")} />
        </Field>
        <Field label="Appointment">
          <input {...text("approving_officer_appointment")} />
        </Field>
        <Field label="Date">
          <input type="date" {...text("approving_officer_date")} />
        </Field>
        {signature("approving_officer")}
      </Section>
      </>
      )}
    </div>
  );
});

PassApplicationFields.displayName = "PassApplicationFields";

/** File picker for item 11, with the saved file and a remove button when there is one. */
export const PassAttachmentInput = ({
  file,
  onFile,
  savedName,
  onRemoveSaved,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  savedName?: string | null;
  onRemoveSaved?: () => void;
}) => {
  const dispatch = useAppDispatch();
  return (
  <div className="flex flex-wrap items-center gap-3 text-xs">
    {savedName && !file && (
      <span className="inline-flex items-center gap-1 text-gray-200">
        <Icon icon="mdi:paperclip" className="w-4 h-4" />
        {savedName}
        {onRemoveSaved && (
          <button type="button" onClick={onRemoveSaved} className="ml-1 font-semibold text-red-400 hover:underline">
            Remove
          </button>
        )}
      </span>
    )}
    {file && (
      <span className="inline-flex items-center gap-1 text-gray-200">
        <Icon icon="mdi:paperclip" className="w-4 h-4" />
        {file.name}
        <button type="button" onClick={() => onFile(null)} className="ml-1 font-semibold text-red-400 hover:underline">
          Clear
        </button>
      </span>
    )}
    <label className="cursor-pointer font-semibold text-[#7FD5FF] hover:underline">
      {savedName || file ? "Choose another file" : "Attach a file"}
      <input
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (f && f.size > 20 * 1024 * 1024) {
            dispatch(showToast({ type: "error", message: "The attachment must be 20 MB or smaller." }));
            return;
          }
          onFile(f);
        }}
      />
    </label>
    <span className="text-gray-500">PDF, Word or image, up to 20 MB.</span>
  </div>
  );
};
