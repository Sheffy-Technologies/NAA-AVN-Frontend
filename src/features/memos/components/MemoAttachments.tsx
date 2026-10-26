import { useRef } from "react";
import { Icon } from "@/shared/icons/Icon";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useAddMemoAttachmentsMutation, useDeleteMemoAttachmentMutation, type Memo } from "../api";
import {
  MEMO_ATTACHMENT_ACCEPT,
  MEMO_ATTACHMENT_MAX_BYTES,
  downloadMemoAttachment,
  formatFileSize,
  memoErrorMessage,
} from "../memoHelpers";

const fileIcon = (mime?: string | null, name?: string) => {
  const n = (name ?? "").toLowerCase();
  if (mime?.startsWith("image/")) return "mdi:file-image-outline";
  if (mime === "application/pdf" || n.endsWith(".pdf")) return "mdi:file-pdf-box";
  if (/\.(docx?)$/.test(n)) return "mdi:file-word-outline";
  if (/\.(xlsx?|csv)$/.test(n)) return "mdi:file-excel-outline";
  if (/\.(pptx?)$/.test(n)) return "mdi:file-powerpoint-outline";
  return "mdi:file-document-outline";
};

/** Drops files over the server's size limit, with a toast naming them. */
const useCheckedFiles = () => {
  const dispatch = useAppDispatch();
  return (list: FileList | null) => {
    const files = Array.from(list ?? []);
    const tooBig = files.filter((f) => f.size > MEMO_ATTACHMENT_MAX_BYTES);
    if (tooBig.length) {
      dispatch(showToast({ type: "error", message: `Over 20 MB, not added: ${tooBig.map((f) => f.name).join(", ")}` }));
    }
    return files.filter((f) => f.size <= MEMO_ATTACHMENT_MAX_BYTES);
  };
};

const AddButton = ({ onFiles, busy, label = "Add documents" }: { onFiles: (files: File[]) => void; busy?: boolean; label?: string }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const checked = useCheckedFiles();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={MEMO_ATTACHMENT_ACCEPT}
        className="hidden"
        aria-label="Choose supporting documents"
        onChange={(e) => {
          const files = checked(e.target.files);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30 disabled:opacity-50"
      >
        <Icon icon={busy ? "mdi:loading" : "mdi:paperclip"} className={busy ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
        {busy ? "Uploading…" : label}
      </button>
    </>
  );
};

/**
 * Supporting documents on a saved memo. Everyone who can see the memo can
 * download them; the originator adds and removes them while it's a draft or
 * rejected (`can.attach`).
 */
export const MemoAttachments = ({ memo }: { memo: Memo }) => {
  const dispatch = useAppDispatch();
  const [add, { isLoading: adding }] = useAddMemoAttachmentsMutation();
  const [remove, { isLoading: removing }] = useDeleteMemoAttachmentMutation();

  const upload = async (files: File[]) => {
    try {
      await add({ id: memo.id, files: files.map((file) => ({ file })) }).unwrap();
      dispatch(showToast({ type: "success", message: `${files.length} document${files.length === 1 ? "" : "s"} attached.` }));
    } catch (err) {
      dispatch(showToast({ type: "error", message: memoErrorMessage(err) }));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-[11px] font-bold uppercase text-[#7FD5FF]">Supporting Documents ({memo.attachments.length})</h3>
        {memo.can.attach && <AddButton onFiles={(f) => void upload(f)} busy={adding} label="Add" />}
      </div>
      {memo.attachments.length === 0 ? (
        <p className="text-gray-500">{memo.can.attach ? "None yet. Attach anything the approving officer should see with the memo." : "None."}</p>
      ) : (
        <ul className="space-y-1.5">
          {memo.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <Icon icon={fileIcon(a.mime_type, a.file_name)} className="w-4 h-4 shrink-0 text-[#7FD5FF]" />
              <button
                type="button"
                onClick={() => void downloadMemoAttachment(a)}
                className="min-w-0 flex-1 text-left hover:text-white"
                title={`Download ${a.file_name}`}
              >
                <span className="block truncate">{a.name}</span>
                <span className="block text-[10px] text-gray-500 truncate">
                  {a.file_name}
                  {a.file_size ? ` · ${formatFileSize(a.file_size)}` : ""}
                </span>
              </button>
              {memo.can.attach && (
                <button
                  type="button"
                  disabled={removing}
                  aria-label={`Remove ${a.name}`}
                  title="Remove"
                  onClick={() => {
                    if (!window.confirm(`Remove "${a.name}" from this memo?`)) return;
                    remove({ id: a.id, memoId: memo.id })
                      .unwrap()
                      .catch((err) => dispatch(showToast({ type: "error", message: memoErrorMessage(err) })));
                  }}
                  className="p-1 rounded text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** New memo form: documents picked before the memo exists, uploaded right after it's saved. */
export const PendingMemoAttachments = ({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400">Supporting documents</span>
      <AddButton onFiles={(added) => onChange([...files, ...added])} />
    </div>
    {files.length === 0 ? (
      <p className="text-[11px] text-gray-500">Optional. PDF, Word, Excel, PowerPoint, CSV, text or images, up to 20 MB each.</p>
    ) : (
      <ul className="space-y-1.5 text-xs text-gray-300">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex items-center gap-2">
            <Icon icon={fileIcon(f.type, f.name)} className="w-4 h-4 shrink-0 text-[#7FD5FF]" />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="text-[10px] text-gray-500">{formatFileSize(f.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${f.name}`}
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="p-1 rounded text-red-400 hover:bg-red-500/10"
            >
              <Icon icon="mdi:close" className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);
