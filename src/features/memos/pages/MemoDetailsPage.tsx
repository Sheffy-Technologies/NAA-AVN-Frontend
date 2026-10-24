import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { BackButton } from "@/shared/ui/button/BackButton";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { MultiSelect } from "@/shared/ui/multi-select/MultiSelect";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SignaturePad, type SignaturePadHandle } from "@/features/approvals/components/SignaturePad";
import {
  useApproveMemoMutation,
  useCopyMemoMutation,
  useDeleteMemoMutation,
  useGetMemoOptionsQuery,
  useGetMemoQuery,
  useRejectMemoMutation,
  useSubmitMemoMutation,
  useWithdrawMemoMutation,
  type Memo,
} from "../api";
import { MemoSheet } from "../components/MemoSheet";
import { MemoStatusBadge } from "../components/MemosTab";
import { downloadMemo, formatDateTime, memoErrorMessage } from "../memoHelpers";

type DialogKind = "submit" | "approve" | "reject" | "copy" | null;

const actionButton =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-50 whitespace-nowrap";

/** /dashboard/documents/memos/:id — the memo in its template layout, with the workflow actions. */
export const MemoDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const memoId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const { data: memo, isLoading, isError } = useGetMemoQuery(memoId, { skip: !memoId });
  const [withdrawMemo, { isLoading: withdrawing }] = useWithdrawMemoMutation();
  const [deleteMemo, { isLoading: deleting }] = useDeleteMemoMutation();

  if (isLoading) return <div className="px-6 py-16 text-center text-xs text-gray-400">Loading memo…</div>;
  if (isError || !memo) {
    return (
      <div className="px-6 py-16 text-center space-y-3">
        <p className="text-sm text-gray-300">This memo doesn't exist or hasn't been shared with you.</p>
        <BackButton fallbackUrl="/dashboard/documents?tab=memos" />
      </div>
    );
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      dispatch(showToast({ message: success, type: "success" }));
    } catch (error) {
      dispatch(showToast({ message: memoErrorMessage(error), type: "error" }));
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this draft memo?")) return;
    await run(() => deleteMemo(memo.id).unwrap(), "Draft deleted.");
    navigate("/dashboard/documents?tab=memos");
  };

  return (
    <div className="px-2 sm:px-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton fallbackUrl="/dashboard/documents?tab=memos" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{memo.subject}</h1>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="font-mono">{memo.reference ?? "No reference yet"}</span>
              <MemoStatusBadge status={memo.status} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {memo.can.edit && (
            <button
              type="button"
              onClick={() => navigate(`/dashboard/documents/memos/${memo.id}/edit`)}
              className={cn(actionButton, "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30")}
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              Edit
            </button>
          )}
          {memo.can.delete && (
            <button type="button" onClick={() => void remove()} disabled={deleting} className={cn(actionButton, "border-red-500/40 text-red-300 hover:bg-red-500/10")}>
              <Icon icon="mdi:delete-outline" className="w-4 h-4" />
              Delete
            </button>
          )}
          {memo.can.withdraw && (
            <button
              type="button"
              disabled={withdrawing}
              onClick={() => void run(() => withdrawMemo(memo.id).unwrap(), "Memo withdrawn. You can edit it again.")}
              className={cn(actionButton, "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30")}
            >
              <Icon icon="mdi:undo-variant" className="w-4 h-4" />
              Withdraw
            </button>
          )}
          {memo.can.copy && (
            <button type="button" onClick={() => setDialog("copy")} className={cn(actionButton, "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30")}>
              <Icon icon="mdi:account-multiple-plus-outline" className="w-4 h-4" />
              Copy To
            </button>
          )}
          <button
            type="button"
            onClick={() => void downloadMemo(memo.id, "pdf", memo.reference)}
            className={cn(actionButton, "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30")}
          >
            <Icon icon="mdi:file-pdf-box" className="w-4 h-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => void downloadMemo(memo.id, "docx", memo.reference)}
            className={cn(actionButton, "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30")}
          >
            <Icon icon="mdi:file-word-box" className="w-4 h-4" />
            Word
          </button>
          {memo.can.submit && (
            <button type="button" onClick={() => setDialog("submit")} className={cn(actionButton, "bg-[#0369A1] border-[#0369A1] text-white hover:bg-[#0369A1]/90")}>
              <Icon icon="mdi:send-outline" className="w-4 h-4" />
              {memo.status === "rejected" ? "Resubmit" : "Submit for Approval"}
            </button>
          )}
          {memo.can.decide && (
            <>
              <button type="button" onClick={() => setDialog("reject")} className={cn(actionButton, "border-red-500/40 text-red-300 hover:bg-red-500/10")}>
                <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
                Reject
              </button>
              <button type="button" onClick={() => setDialog("approve")} className={cn(actionButton, "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600/90")}>
                <Icon icon="mdi:check-decagram-outline" className="w-4 h-4" />
                Approve
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="overflow-x-auto rounded-xl bg-[#0b1720] p-2 sm:p-4">
          <MemoSheet memo={memo} />
        </div>
        <MemoSidePanel memo={memo} />
      </div>

      {dialog === "submit" && <SubmitDialog memo={memo} onClose={() => setDialog(null)} />}
      {(dialog === "approve" || dialog === "reject") && <DecideDialog memo={memo} mode={dialog} onClose={() => setDialog(null)} />}
      {dialog === "copy" && <CopyDialog memo={memo} onClose={() => setDialog(null)} />}
    </div>
  );
};

const MemoSidePanel = ({ memo }: { memo: Memo }) => (
  <aside className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 space-y-4 text-xs text-gray-300">
    <div>
      <h3 className="text-[11px] font-bold uppercase text-[#7FD5FF] mb-2">Workflow</h3>
      <dl className="space-y-1.5">
        <Row label="Originator" value={memo.originator?.name} />
        <Row label="Approving officer" value={memo.approving_officer?.name ?? "Not chosen yet"} />
        <Row label="Submitted" value={memo.submitted_at ? formatDateTime(memo.submitted_at) : "—"} />
        {memo.decision && (
          <Row label={memo.decision.action === "approved" ? "Approved" : "Rejected"} value={formatDateTime(memo.decision.signed_at)} />
        )}
      </dl>
      {memo.decision?.comment && (
        <div
          className={cn(
            "mt-3 rounded border px-3 py-2",
            memo.decision.action === "approved" ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10",
          )}
        >
          <div className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">
            {memo.decision.action === "approved" ? "Approval note" : "Reason for rejection"}
          </div>
          <p className="whitespace-pre-wrap text-black dark:text-gray-100">{memo.decision.comment}</p>
          <div className="text-[10px] text-gray-500 mt-1">— {memo.decision.by?.name}</div>
        </div>
      )}
    </div>

    <div>
      <h3 className="text-[11px] font-bold uppercase text-[#7FD5FF] mb-2">Copied To ({memo.recipients.length})</h3>
      {memo.recipients.length === 0 ? (
        <p className="text-gray-500">
          {memo.status === "approved" ? "Not copied to anyone yet." : "The memo can be copied to others once it is approved."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {memo.recipients.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span>{r.name}</span>
              <span className={cn("text-[10px]", r.read_at ? "text-emerald-300" : "text-gray-500")}>
                {r.read_at ? `Seen ${formatDateTime(r.read_at)}` : "Not opened"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </aside>
);

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-gray-500">{label}</dt>
    <dd className="text-right text-gray-200">{value ?? "—"}</dd>
  </div>
);

const DialogShell = ({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true">
    <div className="w-full max-w-lg rounded-xl border border-[#0A4D66]/60 bg-[#001219] text-gray-200 shadow-2xl">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#0A4D66]/40">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Icon icon={icon} className="w-4 h-4 text-[#7FD5FF]" />
          {title}
        </h2>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/5" aria-label="Close">
          <Icon icon="mdi:close" className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  </div>
);

const DialogFooter = ({ onClose, onConfirm, busy, label, tone = "primary" }: { onClose: () => void; onConfirm: () => void; busy: boolean; label: string; tone?: "primary" | "danger" | "success" }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button type="button" onClick={onClose} className={cn(actionButton, "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30")}>
      Cancel
    </button>
    <button
      type="button"
      onClick={onConfirm}
      disabled={busy}
      className={cn(
        actionButton,
        "text-white",
        tone === "danger" && "bg-red-600 border-red-600 hover:bg-red-600/90",
        tone === "success" && "bg-emerald-600 border-emerald-600 hover:bg-emerald-600/90",
        tone === "primary" && "bg-[#0369A1] border-[#0369A1] hover:bg-[#0369A1]/90",
      )}
    >
      {busy ? "Please wait…" : label}
    </button>
  </div>
);

const SignatureField = ({ padRef, label }: { padRef: React.RefObject<SignaturePadHandle | null>; label: string }) => (
  <div className="space-y-1">
    <span className="text-xs text-gray-400">{label}</span>
    <SignaturePad ref={padRef} height={150} />
  </div>
);

const useUserOptions = (excludeIds: number[] = []) => {
  const { data } = useGetMemoOptionsQuery();
  return (data?.users ?? [])
    .filter((u) => !excludeIds.includes(u.id))
    .map((u) => ({ value: u.id, label: u.name, description: u.email ?? undefined }));
};

const SubmitDialog = ({ memo, onClose }: { memo: Memo; onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const padRef = useRef<SignaturePadHandle>(null);
  const [approverId, setApproverId] = useState<number | null>(memo.approving_officer?.id ?? null);
  const [submitMemo, { isLoading }] = useSubmitMemoMutation();
  const options = useUserOptions(memo.originator ? [memo.originator.id] : []);

  const confirm = async () => {
    const signature = padRef.current?.toDataUrl();
    if (!approverId) return void dispatch(showToast({ message: "Choose the approving officer.", type: "error" }));
    if (!signature) return void dispatch(showToast({ message: "Sign the memo before submitting.", type: "error" }));
    try {
      await submitMemo({ id: memo.id, approving_officer_id: approverId, signature }).unwrap();
      dispatch(showToast({ message: "Memo sent for approval.", type: "success" }));
      onClose();
    } catch (error) {
      dispatch(showToast({ message: memoErrorMessage(error), type: "error" }));
    }
  };

  return (
    <DialogShell title="Submit for Approval" icon="mdi:send-outline" onClose={onClose}>
      <div className="space-y-1">
        <span className="text-xs text-gray-400">Approving officer</span>
        <SearchableSelect
          placeholder="Select approving officer"
          searchPlaceholder="Search users..."
          options={options}
          value={approverId}
          onChange={(value) => setApproverId(value === null ? null : Number(value))}
        />
        <p className="text-[11px] text-gray-500">They'll get an in-app message asking them to approve this memo.</p>
      </div>
      <SignatureField padRef={padRef} label="Your signature" />
      {!memo.reference && <p className="text-[11px] text-gray-500">A reference number will be generated for this memo.</p>}
      <DialogFooter onClose={onClose} onConfirm={() => void confirm()} busy={isLoading} label="Sign & Submit" />
    </DialogShell>
  );
};

const DecideDialog = ({ memo, mode, onClose }: { memo: Memo; mode: "approve" | "reject"; onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const padRef = useRef<SignaturePadHandle>(null);
  const [comment, setComment] = useState("");
  const [recipientIds, setRecipientIds] = useState<number[]>([]);
  const [approveMemo, { isLoading: approving }] = useApproveMemoMutation();
  const [rejectMemo, { isLoading: rejecting }] = useRejectMemoMutation();
  const options = useUserOptions(memo.originator ? [memo.originator.id] : []);
  const approve = mode === "approve";

  const confirm = async () => {
    const signature = padRef.current?.toDataUrl();
    if (!signature) return void dispatch(showToast({ message: "Sign before you continue.", type: "error" }));
    if (!approve && !comment.trim()) return void dispatch(showToast({ message: "Give a reason for the rejection.", type: "error" }));
    try {
      if (approve) {
        await approveMemo({ id: memo.id, signature, comment: comment.trim() || undefined, recipient_ids: recipientIds }).unwrap();
      } else {
        await rejectMemo({ id: memo.id, signature, comment: comment.trim() }).unwrap();
      }
      dispatch(showToast({ message: approve ? "Memo approved." : "Memo rejected and returned to the originator.", type: "success" }));
      onClose();
    } catch (error) {
      dispatch(showToast({ message: memoErrorMessage(error), type: "error" }));
    }
  };

  return (
    <DialogShell title={approve ? "Approve Memo" : "Reject Memo"} icon={approve ? "mdi:check-decagram-outline" : "mdi:close-circle-outline"} onClose={onClose}>
      <label className="block space-y-1">
        <span className="text-xs text-gray-400">{approve ? "Approval note (optional)" : "Reason for rejection *"}</span>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#7FD5FF]"
          placeholder={approve ? "e.g. Approved. D Fin to release funds." : "Tell the originator what to change."}
        />
      </label>
      {approve && (
        <div className="space-y-1">
          <MultiSelect
            label="Copy to (optional)"
            placeholder="Select users"
            searchable
            options={options}
            selectedValues={recipientIds}
            onChange={(values) => setRecipientIds(values.map(Number))}
          />
          <p className="text-[11px] text-gray-500">Each person gets an in-app message that the memo needs their attention.</p>
        </div>
      )}
      <SignatureField padRef={padRef} label="Your signature" />
      <DialogFooter
        onClose={onClose}
        onConfirm={() => void confirm()}
        busy={approving || rejecting}
        label={approve ? "Sign & Approve" : "Sign & Reject"}
        tone={approve ? "success" : "danger"}
      />
    </DialogShell>
  );
};

const CopyDialog = ({ memo, onClose }: { memo: Memo; onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const [userIds, setUserIds] = useState<number[]>([]);
  const [copyMemo, { isLoading }] = useCopyMemoMutation();
  const options = useUserOptions([...(memo.originator ? [memo.originator.id] : []), ...memo.recipients.map((r) => r.id)]);

  const confirm = async () => {
    if (userIds.length === 0) return void dispatch(showToast({ message: "Choose at least one person.", type: "error" }));
    try {
      await copyMemo({ id: memo.id, user_ids: userIds }).unwrap();
      dispatch(showToast({ message: "Memo copied. Each person has been sent a message.", type: "success" }));
      onClose();
    } catch (error) {
      dispatch(showToast({ message: memoErrorMessage(error), type: "error" }));
    }
  };

  return (
    <DialogShell title="Copy Memo To" icon="mdi:account-multiple-plus-outline" onClose={onClose}>
      <MultiSelect
        label="People"
        placeholder="Select users"
        searchable
        options={options}
        selectedValues={userIds}
        onChange={(values) => setUserIds(values.map(Number))}
      />
      <p className="text-[11px] text-gray-500">They can read the memo in the app and download it as PDF or Word.</p>
      <DialogFooter onClose={onClose} onConfirm={() => void confirm()} busy={isLoading} label="Copy & Notify" />
    </DialogShell>
  );
};
