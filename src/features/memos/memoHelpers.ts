import axios from "axios";
import DOMPurify from "dompurify";
import { store } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import type { MemoAttachment, MemoStatus } from "./api";

/**
 * Same allowlist as the backend (App\Support\Memos\MemoHtml). The server
 * already sanitises on save; this guards the live preview of unsaved text.
 */
export const sanitizeMemoHtml = (html: string | null | undefined) =>
  DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "ol", "ul", "li", "table", "thead", "tbody", "tr", "th", "td"],
    ALLOWED_ATTR: ["style", "colspan", "rowspan"],
  });

/** "26 Sep 26", the memo template's date style. */
export const formatMemoDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";

export const MEMO_STATUS_LABELS: Record<MemoStatus, string> = {
  draft: "Draft",
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const MEMO_STATUS_CLASSES: Record<MemoStatus, string> = {
  draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const memoErrorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Something went wrong.";
};

/** Exports go through the API (auth + memo visibility), never a public URL. */
export const downloadMemo = async (id: number, format: "pdf" | "docx", reference?: string | null) => {
  try {
    const token = store.getState().auth.token;
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/memos/${id}/export/${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(reference || `memo-${id}`).replace(/[^A-Za-z0-9._-]+/g, "-")}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    store.dispatch(showToast({ message: "The memo could not be downloaded.", type: "error" }));
  }
};

/** File types the server accepts for supporting documents (MemoController::addAttachments). */
export const MEMO_ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp,.heic";

export const MEMO_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Supporting documents are on the private disk: fetched through the API, never a public URL. */
export const downloadMemoAttachment = async (attachment: MemoAttachment) => {
  try {
    const token = store.getState().auth.token;
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/memo-attachments/${attachment.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.file_name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    store.dispatch(showToast({ message: "The document could not be downloaded.", type: "error" }));
  }
};
