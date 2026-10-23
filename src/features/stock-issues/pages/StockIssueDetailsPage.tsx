import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton } from "@/shared/ui/button/BackButton";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import { ApprovalPanel } from "@/features/approvals/components/ApprovalPanel";
import { useGetRecordApprovalQuery } from "@/features/approvals/api";
import {
  useAddStockIssueDocumentsMutation,
  useDeleteStockIssueDocumentMutation,
  useDeleteStockIssueMutation,
  useGetStockIssueQuery,
  useIssueStockMutation,
  useReceiveStockMutation,
} from "../api";
import { DocumentRowsEditor } from "../components/DocumentRowsEditor";
import {
  DOCUMENT_TYPES,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_TONE,
  appendDocuments,
  downloadIssueDocument,
  formatIssueDate,
  newDocumentRow,
  officerName,
  type DocumentRow,
} from "../stockIssueHelpers";

const errorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Something went wrong.";
};

const STEPS = [
  { key: "draft", label: "Drafted" },
  { key: "approved", label: "Approved" },
  { key: "issued", label: "Issued" },
  { key: "received", label: "Received" },
] as const;

export const StockIssueDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const issueId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const canViewApprovals = useAppSelector((s) => (s.auth.user?.permissions ?? []).includes("approvals.viewAny"));
  const { data: issue, isLoading, isError, refetch } = useGetStockIssueQuery(issueId);
  const { data: approval } = useGetRecordApprovalQuery({ module: "stock-issues", id: issueId }, { skip: !canViewApprovals });
  const [issueStock, { isLoading: issuing }] = useIssueStockMutation();
  const [receiveStock, { isLoading: receiving }] = useReceiveStockMutation();
  const [addDocuments, { isLoading: uploading }] = useAddStockIssueDocumentsMutation();
  const [deleteDocument] = useDeleteStockIssueDocumentMutation();
  const [deleteIssue] = useDeleteStockIssueMutation();
  const [showReceive, setShowReceive] = useState(false);
  const [receivedQty, setReceivedQty] = useState("");
  const [receiptRemarks, setReceiptRemarks] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [newDocs, setNewDocs] = useState<DocumentRow[]>([newDocumentRow()]);

  if (isLoading) return <div className="p-10 text-center text-sm opacity-60">Loading…</div>;
  if (isError || !issue) return <div className="p-10 text-center text-sm opacity-60">Issue voucher not found.</div>;

  const editable = issue.status === "draft" || issue.status === "rejected";
  // Without an active workflow a draft can be issued directly; the server enforces this either way.
  const approvalRequired = Boolean(approval?.workflow);
  const canIssue = has("stock-issues.issue") && (issue.status === "approved" || (issue.status === "draft" && !approvalRequired));
  const canReceive = has("stock-issues.receive") && issue.status === "issued";
  const reachedIndex = { draft: 0, pending_approval: 0, rejected: 0, cancelled: 0, approved: 1, issued: 2, received: 3 }[issue.status];

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      dispatch(showToast({ type: "success", message }));
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
    }
  };

  const info: Array<[string, React.ReactNode]> = [
    ["Description", issue.description],
    ["Part number", issue.part_number ?? "-"],
    ["NSN", issue.nsn ?? "-"],
    ["Quantity", `${issue.quantity}${issue.unit_of_issue ? ` ${issue.unit_of_issue}` : ""}`],
    ["Date of issue", formatIssueDate(issue.issue_date)],
    ["Sending unit", issue.unit?.name ?? "-"],
    ["Receiving unit", issue.receiving_unit?.name ?? "-"],
    ["Authorizing officer", officerName(issue.authorizing_officer)],
    ["Receiving officer", officerName(issue.receiving_officer)],
    ["Raised by", issue.creator ? `${issue.creator.firstname} ${issue.creator.lastname}` : "-"],
    ["Issued", issue.issued_at ? `${formatIssueDate(issue.issued_at)}${issue.issuer ? ` by ${issue.issuer.firstname} ${issue.issuer.lastname}` : ""}` : "-"],
    [
      "Received",
      issue.received_at
        ? `${issue.quantity_received ?? issue.quantity} on ${formatIssueDate(issue.received_at)}${issue.receiver ? ` by ${issue.receiver.firstname} ${issue.receiver.lastname}` : ""}`
        : "-",
    ],
  ];

  return (
    <div className="space-y-6">
      <BackButton fallbackUrl="/dashboard/inventory?tab=issues" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className={cn("text-2xl font-bold uppercase tracking-wide", isDark ? "text-white" : "text-slate-900")}>
              Issue voucher {issue.reference}
            </h1>
            <SqStatus value={ISSUE_STATUS_TONE[issue.status]} label={ISSUE_STATUS_LABEL[issue.status]} />
          </div>
          <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-slate-500")}>
            {issue.quantity} × {issue.description} · {issue.unit?.name ?? "-"} → {issue.receiving_unit?.name ?? "-"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && has("stock-issues.update") && (
            <SecondaryButton icon="mdi:pencil-outline" onClick={() => navigate(`/dashboard/inventory/issues/${issue.id}/edit`)}>
              Edit
            </SecondaryButton>
          )}
          {canIssue && (
            <PrimaryButton icon="mdi:truck-delivery-outline" disabled={issuing} onClick={() => run(() => issueStock({ id: issue.id }).unwrap(), "Stock issued. It is now in transit to the receiving unit.")}>
              {issuing ? "Issuing…" : "Issue stock"}
            </PrimaryButton>
          )}
          {canReceive && (
            <PrimaryButton icon="mdi:package-variant-closed-check" onClick={() => setShowReceive(true)}>
              Confirm receipt
            </PrimaryButton>
          )}
          {editable && has("stock-issues.delete") && (
            <SecondaryButton
              icon="mdi:trash-can-outline"
              onClick={() => {
                if (window.confirm("Delete this issue voucher?")) {
                  run(async () => {
                    await deleteIssue(issue.id).unwrap();
                    navigate("/dashboard/inventory?tab=issues");
                  }, "Issue voucher deleted.");
                }
              }}
            >
              Delete
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className={cn("flex items-center gap-2 text-xs overflow-x-auto", isDark ? "text-gray-300" : "text-slate-600")}>
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold",
                i <= reachedIndex && issue.status !== "rejected" ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-white/10",
              )}
            >
              {i <= reachedIndex && issue.status !== "rejected" ? <Icon icon="mdi:check" className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={cn(i === reachedIndex && "font-semibold")}>{step.label}</span>
            {i < STEPS.length - 1 && <span className="w-8 h-px bg-slate-300 dark:bg-white/20" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <SqPanel title="Voucher details">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
              {info.map(([k, v]) => (
                <div key={k}>
                  <dt className={cn(isDark ? "text-gray-400" : "text-slate-500")}>{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {(issue.remarks || issue.receipt_remarks) && (
              <div className="mt-4 pt-3 border-t dark:border-[#0A4D66]/40 text-xs space-y-1">
                {issue.remarks && <p><b>Remarks:</b> {issue.remarks}</p>}
                {issue.receipt_remarks && <p><b>Receipt remarks:</b> {issue.receipt_remarks}</p>}
              </div>
            )}
          </SqPanel>

          <SqPanel
            title="Documents"
            subtitle="Voucher photo, AFG/1033 and other supporting documents."
            action={
              issue.status !== "received" && has("stock-issues.update") ? (
                <SecondaryButton icon="mdi:paperclip-plus" onClick={() => setShowUpload((v) => !v)}>
                  {showUpload ? "Close" : "Add documents"}
                </SecondaryButton>
              ) : undefined
            }
          >
            {showUpload && (
              <div className={cn("mb-4 p-3 rounded-lg border", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                <DocumentRowsEditor rows={newDocs} onChange={setNewDocs} />
                <div className="flex justify-end mt-3">
                  <PrimaryButton
                    icon="mdi:upload"
                    disabled={uploading || !newDocs.some((d) => d.file)}
                    onClick={() => {
                      const body = new FormData();
                      appendDocuments(body, newDocs);
                      run(async () => {
                        await addDocuments({ id: issue.id, body }).unwrap();
                        setNewDocs([newDocumentRow()]);
                        setShowUpload(false);
                      }, "Documents uploaded.");
                    }}
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </PrimaryButton>
                </div>
              </div>
            )}
            {issue.documents.length ? (
              <ul className={cn("divide-y", isDark ? "divide-[#0A4D66]/30" : "divide-slate-100")}>
                {issue.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 py-2.5 text-xs">
                    <Icon
                      icon={doc.mime_type?.startsWith("image/") ? "mdi:file-image-outline" : doc.mime_type === "application/pdf" ? "mdi:file-pdf-box" : "mdi:file-document-outline"}
                      className="w-6 h-6 text-[#0A4D66] dark:text-[#7FD5FF] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{doc.name}</div>
                      <div className="opacity-60 truncate">
                        {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label} · {doc.file_name}
                      </div>
                    </div>
                    <SecondaryButton icon="mdi:download" onClick={() => downloadIssueDocument(doc)}>
                      Download
                    </SecondaryButton>
                    {editable && has("stock-issues.update") && (
                      <button
                        type="button"
                        aria-label="Remove document"
                        onClick={() => run(() => deleteDocument({ issueId: issue.id, documentId: doc.id }).unwrap(), "Document removed.")}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs opacity-60">No documents uploaded yet.</p>
            )}
          </SqPanel>
        </div>

        <div className="space-y-4">
          <ApprovalPanel module="stock-issues" recordId={issue.id} onChanged={refetch} />
          {!approvalRequired && issue.status === "draft" && (
            <p className={cn("text-[11px]", isDark ? "text-gray-500" : "text-slate-400")}>
              No approval workflow is active for issue vouchers, so this draft can be issued directly.
            </p>
          )}
        </div>
      </div>

      {showReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className={cn("w-full max-w-md rounded-xl border p-6 shadow-2xl", isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900")}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF] mb-1">Confirm receipt</h3>
            <p className="text-xs opacity-70 mb-4">
              The quantity received is added to {issue.receiving_unit?.name}'s inventory for this part.
            </p>
            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="block font-semibold mb-1">Quantity received (issued: {issue.quantity})</span>
                <input
                  type="number"
                  min={0}
                  max={issue.quantity}
                  value={receivedQty}
                  placeholder={String(issue.quantity)}
                  onChange={(e) => setReceivedQty(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="block font-semibold mb-1">Remarks (condition, shortages…)</span>
                <textarea rows={2} value={receiptRemarks} onChange={(e) => setReceiptRemarks(e.target.value)} className={fieldClass} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <SecondaryButton onClick={() => setShowReceive(false)}>Cancel</SecondaryButton>
                <PrimaryButton
                  icon="mdi:check"
                  disabled={receiving}
                  onClick={() =>
                    run(async () => {
                      await receiveStock({
                        id: issue.id,
                        quantity_received: receivedQty === "" ? undefined : Number(receivedQty),
                        receipt_remarks: receiptRemarks || undefined,
                      }).unwrap();
                      setShowReceive(false);
                    }, "Receipt confirmed. Stock added to the receiving unit.")
                  }
                >
                  {receiving ? "Saving…" : "Confirm receipt"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
