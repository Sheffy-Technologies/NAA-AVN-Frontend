import axios from "axios";
import { store } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import type { IssueDocumentType, StockIssueDocument, StockIssueStatus } from "./api";

export const ISSUE_STATUS_LABEL: Record<StockIssueStatus, string> = {
  draft: "Draft",
  pending_approval: "Awaiting approval",
  approved: "Approved · ready to issue",
  rejected: "Rejected",
  issued: "Issued · in transit",
  received: "Received",
  cancelled: "Cancelled",
};

/** Maps issue statuses onto the shared status-badge colours. */
export const ISSUE_STATUS_TONE: Record<StockIssueStatus, string> = {
  draft: "draft",
  pending_approval: "in_progress",
  approved: "approved",
  rejected: "rejected",
  issued: "in_progress",
  received: "completed",
  cancelled: "cancelled",
};

export const DOCUMENT_TYPES: Array<{ value: IssueDocumentType; label: string }> = [
  { value: "voucher_photo", label: "Picture of the voucher" },
  { value: "afg_1033", label: "AFG/1033 document" },
  { value: "other", label: "Other document" },
];

export type DocumentRow = { key: string; name: string; document_type: IssueDocumentType; file: File | null };

export const newDocumentRow = (name = "", document_type: IssueDocumentType = "other"): DocumentRow => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name,
  document_type,
  file: null,
});

/** Appends only rows that actually have a file, as documents[i][...]. */
export const appendDocuments = (form: FormData, rows: DocumentRow[]) => {
  rows
    .filter((r) => r.file)
    .forEach((r, i) => {
      form.append(`documents[${i}][name]`, r.name.trim() || r.file!.name);
      form.append(`documents[${i}][document_type]`, r.document_type);
      form.append(`documents[${i}][file]`, r.file as File);
    });
};

/** Documents are private: fetched with the token, never via a public URL. */
export const downloadIssueDocument = async (doc: StockIssueDocument) => {
  try {
    const token = store.getState().auth.token;
    const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/stock-issue-documents/${doc.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    store.dispatch(showToast({ type: "error", message: "The document could not be downloaded." }));
  }
};

export const officerName = (p: { firstname: string; lastname: string; service_number?: string; rank?: { name: string } | null } | null) =>
  p ? `${p.rank?.name ? `${p.rank.name} ` : ""}${p.firstname} ${p.lastname}${p.service_number ? ` (${p.service_number})` : ""}` : "-";

export const formatIssueDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
