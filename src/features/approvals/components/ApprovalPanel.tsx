import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SqStatus, PrimaryButton, SecondaryButton } from "@/features/safety/components/sqUi";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import {
  useCancelApprovalMutation,
  useDecideApprovalMutation,
  useGetRecordApprovalQuery,
  useSubmitForApprovalMutation,
  type ApprovalModuleKey,
  type ApprovalRequestRow,
} from "../api";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

const errorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Something went wrong.";
};

/** Signatures are served only to authenticated users, so they're fetched with the token. */
export const SignatureImage = ({ path, className }: { path: string; className?: string }) => {
  const token = useAppSelector((state) => state.auth.token);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        responseType: "blob",
      })
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data as Blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, token]);

  if (!src) return <div className={cn("h-12 w-36 rounded bg-slate-100 dark:bg-white/5 animate-pulse", className)} />;
  return <img src={src} alt="Signature" className={cn("h-12 max-w-[180px] object-contain rounded bg-white border border-slate-200", className)} />;
};

const DialogShell = ({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) => {
  const { isDark } = useTheme();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full max-w-lg rounded-xl border p-6 shadow-2xl my-8",
          isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Icon icon={icon} className="w-5 h-5 text-[#0A4D66] dark:text-[#7FD5FF]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/** Approve or reject: the approver draws their signature and confirms. */
export const SignDialog = ({
  request,
  decision,
  onClose,
  onDone,
}: {
  request: ApprovalRequestRow;
  decision: "approve" | "reject";
  onClose: () => void;
  onDone?: () => void;
}) => {
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const pad = useRef<SignaturePadHandle>(null);
  const [hasInk, setHasInk] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decide, { isLoading }] = useDecideApprovalMutation();
  const stage = request.stages.find((s) => s.state === "current");
  const isReject = decision === "reject";

  const confirm = async () => {
    const signature = pad.current?.toDataUrl();
    if (!signature) {
      setError("Please draw your signature before confirming.");
      return;
    }
    if (isReject && !comment.trim()) {
      setError("Give a reason for rejecting this request.");
      return;
    }
    setError(null);
    try {
      const result = await decide({
        requestId: request.id,
        decision,
        signature,
        comment: comment.trim() || undefined,
        module: request.module,
        recordId: request.approvable_id,
      }).unwrap();
      dispatch(
        showToast({
          type: "success",
          message: isReject
            ? "Request rejected."
            : result.status === "approved"
              ? "Approved. The request is complete."
              : "Signed. Sent to the next approval stage.",
        }),
      );
      onDone?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <DialogShell title={isReject ? "Reject request" : "Approve & sign"} icon={isReject ? "mdi:close-octagon-outline" : "mdi:draw-pen"} onClose={onClose}>
      <div className="space-y-4 text-xs">
        <div>
          <div className="font-semibold text-sm">{request.title}</div>
          <div className="opacity-70">
            {request.module_label}
            {stage ? ` · Stage ${stage.sequence}: ${stage.name}` : ""}
          </div>
        </div>
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300">{error}</div>}
        <label className="block">
          <span className="block font-semibold mb-1">
            {isReject ? "Reason for rejection" : "Comment (optional)"} {isReject && <span className="text-red-500">*</span>}
          </span>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className={fieldClass} />
        </label>
        <div>
          <span className="block font-semibold mb-1">
            Signature <span className="text-red-500">*</span>
          </span>
          <SignaturePad ref={pad} onChange={setHasInk} />
        </div>
        <p className="opacity-60">
          By signing you confirm this decision. Your signature, name and the time are recorded against this stage and cannot be changed.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-700">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            icon={isReject ? "mdi:close" : "mdi:check-decagram"}
            onClick={confirm}
            disabled={isLoading || !hasInk}
            className={isReject ? "!bg-red-600 hover:!bg-red-700" : undefined}
          >
            {isLoading ? "Saving…" : isReject ? "Sign & reject" : "Sign & approve"}
          </PrimaryButton>
        </div>
      </div>
    </DialogShell>
  );
};

const STATE_STYLE: Record<string, { icon: string; tone: string }> = {
  approved: { icon: "mdi:check-circle", tone: "text-emerald-500" },
  rejected: { icon: "mdi:close-circle", tone: "text-red-500" },
  current: { icon: "mdi:progress-clock", tone: "text-amber-500" },
  waiting: { icon: "mdi:circle-outline", tone: "text-slate-400" },
};

/** Stage timeline + signatures + the actions this user may take. */
export const ApprovalRequestCard = ({ request, onChanged }: { request: ApprovalRequestRow; onChanged?: () => void }) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [cancel, { isLoading: cancelling }] = useCancelApprovalMutation();
  const submitted = request.actions.find((a) => a.action === "submitted");

  const withdraw = async () => {
    try {
      await cancel({ requestId: request.id, module: request.module, recordId: request.approvable_id }).unwrap();
      dispatch(showToast({ type: "success", message: "Request withdrawn." }));
      onChanged?.();
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-xs">
          <div className={cn(isDark ? "text-gray-400" : "text-slate-500")}>
            Submitted by <b>{request.submitted_by?.name ?? "-"}</b> · {formatDateTime(request.submitted_at)}
          </div>
          {submitted?.comment && <div className="mt-1 italic opacity-80">“{submitted.comment}”</div>}
        </div>
        <SqStatus value={request.status === "pending" ? "in_progress" : request.status} label={request.status === "pending" ? "Awaiting approval" : undefined} />
      </div>

      <ol className="space-y-3">
        {request.stages.map((stage) => {
          const style = STATE_STYLE[stage.state];
          return (
            <li key={stage.sequence} className="flex gap-3">
              <Icon icon={style.icon} className={cn("w-5 h-5 shrink-0 mt-0.5", style.tone)} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <div className="text-xs font-semibold">
                    {stage.sequence}. {stage.name}
                  </div>
                  <div className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>{stage.approver_label}</div>
                </div>
                {stage.decision ? (
                  <div className="mt-1.5 flex flex-wrap items-end gap-3">
                    {stage.decision.signature_path && <SignatureImage path={stage.decision.signature_path} />}
                    <div className="text-[11px]">
                      <div>
                        <b>{stage.decision.user?.name}</b> {stage.decision.action === "approved" ? "approved" : "rejected"}
                      </div>
                      <div className="opacity-70">{formatDateTime(stage.decision.signed_at)}</div>
                      {stage.decision.comment && <div className="italic mt-0.5">“{stage.decision.comment}”</div>}
                    </div>
                  </div>
                ) : stage.state === "current" ? (
                  <div className="text-[11px] mt-0.5 text-amber-600 dark:text-amber-300">Awaiting signature</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {(request.can_act || request.can_cancel) && (
        <div className="flex flex-wrap gap-2 pt-3 border-t dark:border-[#0A4D66]/40">
          {request.can_act && (
            <>
              <PrimaryButton icon="mdi:draw-pen" onClick={() => setDialog("approve")}>
                Approve & sign
              </PrimaryButton>
              <SecondaryButton icon="mdi:close" onClick={() => setDialog("reject")} className="text-red-600 dark:text-red-400">
                Reject
              </SecondaryButton>
            </>
          )}
          {request.can_cancel && (
            <SecondaryButton icon="mdi:undo-variant" onClick={withdraw} disabled={cancelling}>
              Withdraw request
            </SecondaryButton>
          )}
        </div>
      )}

      {dialog && <SignDialog request={request} decision={dialog} onClose={() => setDialog(null)} onDone={onChanged} />}
    </div>
  );
};

/**
 * Drop-in approval block for any registered module's record page. Renders
 * nothing when the module has no workflow and the record has no history.
 */
export const ApprovalPanel = ({
  module,
  recordId,
  onChanged,
  className,
}: {
  module: ApprovalModuleKey;
  recordId: number;
  /** Called after submit/approve/reject/withdraw so the host page can refetch its record. */
  onChanged?: () => void;
  className?: string;
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);
  const canView = permissions.includes("approvals.viewAny");
  const { data, isLoading } = useGetRecordApprovalQuery({ module, id: recordId }, { skip: !canView || !recordId });
  const [submit, { isLoading: submitting }] = useSubmitForApprovalMutation();
  const [showSubmit, setShowSubmit] = useState(false);
  const [notes, setNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  if (!canView || isLoading || !data) return null;
  if (!data.workflow && !data.current) return null;

  const doSubmit = async () => {
    try {
      await submit({ module, id: recordId, notes: notes.trim() || undefined }).unwrap();
      dispatch(showToast({ type: "success", message: "Submitted for approval." }));
      setShowSubmit(false);
      setNotes("");
      onChanged?.();
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-[#0A4D66] dark:text-[#7FD5FF] uppercase tracking-wide flex items-center gap-2">
            <Icon icon="mdi:file-sign" className="w-5 h-5" />
            Approval
          </h2>
          <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
            {data.workflow
              ? `${data.workflow.name} · ${data.workflow.stages.length} stage${data.workflow.stages.length === 1 ? "" : "s"}`
              : "Approval workflow is currently switched off for this module."}
          </p>
        </div>
        {data.can_submit && (
          <PrimaryButton icon="mdi:send-check-outline" onClick={() => setShowSubmit(true)}>
            {data.current?.status === "rejected" ? "Resubmit for approval" : "Submit for approval"}
          </PrimaryButton>
        )}
      </div>

      {data.current ? (
        <ApprovalRequestCard request={data.current} onChanged={onChanged} />
      ) : (
        <div className="text-xs">
          <p className={cn("mb-3", isDark ? "text-gray-400" : "text-slate-500")}>
            Not yet submitted. Once submitted it will be signed off in this order:
          </p>
          <ol className="space-y-1.5">
            {data.workflow?.stages.map((s) => (
              <li key={s.sequence} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold bg-slate-100 dark:bg-white/10">{s.sequence}</span>
                <span className="font-semibold">{s.name}</span>
                <span className="opacity-60">· {s.approver_label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.history.length > 0 && (
        <div className="mt-4 pt-3 border-t dark:border-[#0A4D66]/40">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs font-semibold text-[#0A4D66] dark:text-[#7FD5FF] hover:underline">
            {showHistory ? "Hide" : "Show"} previous approval rounds ({data.history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-5">
              {data.history.map((r) => (
                <ApprovalRequestCard key={r.id} request={r} onChanged={onChanged} />
              ))}
            </div>
          )}
        </div>
      )}

      {showSubmit && (
        <DialogShell title="Submit for approval" icon="mdi:send-check-outline" onClose={() => setShowSubmit(false)}>
          <div className="space-y-4 text-xs">
            <div className="font-semibold text-sm">{data.record_title}</div>
            <label className="block">
              <span className="block font-semibold mb-1">Note to approvers (optional)</span>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
            </label>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setShowSubmit(false)}>Cancel</SecondaryButton>
              <PrimaryButton icon="mdi:send" onClick={doSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </PrimaryButton>
            </div>
          </div>
        </DialogShell>
      )}
    </div>
  );
};

/** The approval panel in a modal, for list pages without a record details page (passes, courses). */
export const ApprovalDialog = ({
  module,
  recordId,
  title,
  onClose,
  onChanged,
}: {
  module: ApprovalModuleKey;
  recordId: number;
  title?: string;
  onClose: () => void;
  onChanged?: () => void;
}) => (
  <DialogShell title={title ?? "Approval"} icon="mdi:file-sign" onClose={onClose}>
    <ApprovalPanel module={module} recordId={recordId} onChanged={onChanged} className="!border-0 !p-0 !shadow-none !bg-transparent" />
  </DialogShell>
);
