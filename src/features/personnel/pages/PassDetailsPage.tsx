import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { store, useAppSelector } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton } from "@/shared/ui/button/BackButton";
import { ApprovalPanel, SignatureImage } from "@/features/approvals/components/ApprovalPanel";
import { useGetPassQuery, type Pass, type PassSigner } from "../passApi";
import { PASS_TYPE_LABEL } from "../passForm";
import { EditPassModal } from "../components/EditPassModal";

const fmtDate = (v?: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  approved: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  completed: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
};

const userName = (u?: { firstname: string | null; lastname: string | null; email: string } | null) =>
  u ? [u.firstname, u.lastname].filter(Boolean).join(" ") || u.email : "";

/** Downloads item 11 through the API (private file, needs the token). */
const downloadAttachment = async (pass: Pass) => {
  try {
    const token = store.getState().auth.token;
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/passes/${pass.id}/attachment`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pass.attachment_name || `pass-${pass.id}-attachment`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    store.dispatch(showToast({ type: "error", message: "The attachment could not be downloaded." }));
  }
};

/** A numbered line of the paper form: "4. Place of Deployment: …". */
const Line = ({ n, label, children }: { n?: string; label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[2rem_minmax(9rem,14rem)_1fr] gap-x-2 py-2 border-b border-dotted border-slate-300 dark:border-[#0A4D66]/40 text-sm">
    <span className="font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">{n ? `${n}.` : ""}</span>
    <span className="opacity-70">{label}:</span>
    <span className="font-medium whitespace-pre-wrap break-words">{children || <span className="opacity-40">—</span>}</span>
  </div>
);

const Signature = ({ pass, signer, shown }: { pass: Pass; signer: PassSigner; shown?: boolean }) =>
  (shown ?? pass.signatures?.[signer]) ? <SignatureImage path={`/passes/${pass.id}/signature/${signer}`} /> : null;

/**
 * Items 14 and 15. With the approval workflow they come from its signed
 * stages (the stage before the final one, and the final one); otherwise
 * they are the details typed on the form.
 */
const OfficerBlock = ({ pass, n, title, prefix }: { pass: Pass; n: string; title: string; prefix: "recommending_officer" | "approving_officer" }) => {
  const officer = pass.sign_off?.[prefix] ?? null;
  const viaWorkflow = pass.sign_off?.source === "workflow";

  return (
    <div className="pt-3">
      <Line n={n} label={title}>
        {officer ? (
          <span>
            {officer.action && (
              <span
                className={cn(
                  "mr-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border",
                  officer.action === "approved" ? "border-emerald-500/40 text-emerald-500" : "border-red-500/40 text-red-400",
                )}
              >
                {officer.action === "approved" ? (prefix === "approving_officer" ? "Approved" : "Recommended") : "Rejected"}
              </span>
            )}
            {officer.comment}
          </span>
        ) : viaWorkflow ? (
          <span className="opacity-60 italic">Awaiting signature in the approval workflow</span>
        ) : null}
      </Line>
      <div className="grid sm:grid-cols-2 gap-x-6">
        <Line label="Rank / Name">{officer?.name}</Line>
        <Line label="Appt">{officer?.appointment}</Line>
        <Line label="Date">{fmtDate(officer?.date)}</Line>
        <Line label="Signature">
          <Signature pass={pass} signer={prefix} shown={officer?.has_signature ?? false} />
        </Line>
      </div>
    </div>
  );
};

/** /dashboard/personnel/pass/:id: one leave/pass application, laid out like NA FORM/00001/07. */
export const PassDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const passId = Number(id);
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);
  const { data: pass, isLoading, isError, refetch } = useGetPassQuery(passId, { skip: !passId });
  const [editing, setEditing] = useState(false);

  if (isLoading) return <div className="p-10 text-center text-sm opacity-60">Loading pass…</div>;
  if (isError || !pass) return <div className="p-10 text-center text-sm opacity-60">Pass not found.</div>;

  const p = pass.personnel;
  const name = p ? [p.firstname, p.othernames, p.lastname].filter(Boolean).join(" ") : "";

  return (
    <div className="px-2 sm:px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/personnel/pass" />
          <h1 className="text-sm font-semibold uppercase tracking-wide">Leave / Pass #{pass.id}</h1>
          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize", STATUS_CLASS[pass.status])}>{pass.status}</span>
        </div>
        <div className="flex items-center gap-2">
          {p && (
            <button
              type="button"
              onClick={() => navigate(`/dashboard/personnel/${pass.personnel_id}`)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#0A4D66]/60 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30"
            >
              Personnel record
            </button>
          )}
          {permissions.includes("passes.update") && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0369A1] text-white hover:bg-[#0369A1]/90"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] items-start">
        <article
          className={cn(
            "rounded-xl border p-5 sm:p-8",
            isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-900 shadow-sm",
          )}
        >
          <header className="text-center mb-5">
            <div className="text-xs font-semibold tracking-widest">RESTRICTED</div>
            <div className="text-right text-xs opacity-70">NA FORM/00001/07</div>
            <h2 className="mt-1 text-sm sm:text-base font-bold underline underline-offset-4">NIGERIAN ARMY LEAVE/PASS APPLICATION PROFORMA</h2>
            <div className="text-sm font-bold underline underline-offset-4">OFFICERS/ SOLDIERS</div>
          </header>

          <Line n="1" label="Service Number">{p?.service_number}</Line>
          <Line n="2" label="Rank">{p?.rank?.name}</Line>
          <Line n="3" label="Name">{name}</Line>
          <Line n="4" label="Place of Deployment">{pass.place_of_deployment}</Line>
          <Line n="5" label="Appointment">{pass.appointment}</Line>
          <Line n="6" label="Leave/Pass Description">{pass.pass_type ? PASS_TYPE_LABEL[pass.pass_type] : ""}</Line>
          <Line n="7" label="Request Made Through">
            {pass.request_through || pass.request_to ? `${pass.request_through ?? "—"}  To  ${pass.request_to ?? "—"}` : ""}
          </Line>
          <Line n="8" label="Number of Day(s) Required">{`${pass.duration} day${pass.duration === 1 ? "" : "s"}`}</Line>
          <Line n="9" label="Effective Date">{`${fmtDate(pass.start_date)} – ${fmtDate(pass.end_date)}`}</Line>
          <Line n="10" label="Reason for Application">{pass.reason}</Line>
          <Line n="11" label="Attachment of Application">
            {pass.has_attachment ? (
              <button type="button" onClick={() => void downloadAttachment(pass)} className="inline-flex items-center gap-1 text-[#0369A1] dark:text-[#7FD5FF] hover:underline">
                <Icon icon="mdi:paperclip" className="w-4 h-4" />
                {pass.attachment_name || "Download attachment"}
              </button>
            ) : (
              ""
            )}
          </Line>
          <Line n="12" label="Place of Travel Intended">{pass.travel_destination}</Line>
          <Line n="13" label="Contact Address">{pass.contact_address}</Line>
          <div className="grid sm:grid-cols-2 gap-x-6">
            <Line label="Tel">{pass.contact_phone}</Line>
            <Line label="Signature">
              <Signature pass={pass} signer="applicant" />
            </Line>
          </div>

          <OfficerBlock pass={pass} n="14" title="Recommending officer's comment" prefix="recommending_officer" />
          <OfficerBlock pass={pass} n="15" title="Approving officer's comment" prefix="approving_officer" />

          <footer className="mt-5 text-center text-xs font-semibold tracking-widest">RESTRICTED</footer>
        </article>

        <aside className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-4 text-xs space-y-2",
              isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
            )}
          >
            <h3 className="text-[11px] font-bold uppercase text-[#0A4D66] dark:text-[#7FD5FF]">Record</h3>
            <div className="flex justify-between gap-2"><span className="opacity-60">Unit</span><span>{p?.unit?.name ?? "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="opacity-60">Recorded by</span><span>{userName(pass.created_by_user) || "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="opacity-60">Recorded on</span><span>{fmtDate(pass.created_at)}</span></div>
            {pass.approved_by_user && (
              <div className="flex justify-between gap-2"><span className="opacity-60">Approved by</span><span>{userName(pass.approved_by_user)}</span></div>
            )}
            {pass.remarks && (
              <div>
                <div className="opacity-60">Remarks</div>
                <p className="whitespace-pre-wrap">{pass.remarks}</p>
              </div>
            )}
          </div>
          <ApprovalPanel module="passes" recordId={pass.id} onChanged={() => void refetch()} />
        </aside>
      </div>

      <EditPassModal pass={editing ? pass : null} onClose={() => setEditing(false)} />
    </div>
  );
};
