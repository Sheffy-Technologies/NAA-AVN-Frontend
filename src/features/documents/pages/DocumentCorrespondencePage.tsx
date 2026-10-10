import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateDocumentMinuteMutation,
  useGetDocumentByIdQuery,
  useGetDocumentMinutesQuery,
  type DocumentUser,
} from "@/features/documents/api";
import { useGetUsersQuery } from "@/features/users/api";

const FILE_BASE_URL = (import.meta.env.VITE_FILE_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

const normalizeDocumentUrl = (value: string) => {
  if (!value) return value;
  return value.replace("/storage/documents/", "/documents/");
};

const buildDocumentFileUrl = (
  document: { file_url?: string | null; file?: string | null } | undefined,
) => {
  if (!document) return null;
  if (document.file_url) return normalizeDocumentUrl(document.file_url);
  if (!FILE_BASE_URL || !document.file) return null;
  const normalizedPath = document.file.startsWith("/")
    ? document.file
    : `/${document.file}`;
  return normalizeDocumentUrl(`${FILE_BASE_URL}${normalizedPath}`);
};

const isImageFile = (url: string | null) => {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url.split("?")[0] ?? "");
};

const userName = (user?: DocumentUser | null) => {
  if (!user) return "Unknown User";
  const fullName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return user.username;
  return user.email || "Unknown User";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const DocumentCorrespondencePage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const authUser = useAppSelector((state) => state.auth.user);
  const currentUserId = Number(authUser?.id || 0);

  const [comment, setComment] = useState("");
  const [forwardToId, setForwardToId] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    data: document,
    isLoading: isDocumentLoading,
    isError: isDocumentError,
  } = useGetDocumentByIdQuery(id ?? "", { skip: !id });

  const {
    data: minutes = [],
    isLoading: isMinutesLoading,
  } = useGetDocumentMinutesQuery(id ?? "", { skip: !id });

  const { data: users = [] } = useGetUsersQuery();

  const [createMinute, { isLoading: isSubmitting }] =
    useCreateDocumentMinuteMutation();

  const fileUrl = useMemo(() => buildDocumentFileUrl(document), [document]);
  const showImagePreview = isImageFile(fileUrl);

  const forwardableUsers = useMemo(
    () => users.filter((user) => user.id !== currentUserId),
    [users, currentUserId],
  );

  const handleExit = () => {
    navigate("/dashboard/documents");
  };

  const handleSubmit = async () => {
    if (!document) return;
    setSubmitError(null);

    if (!comment.trim()) {
      setSubmitError("Enter a comment before submitting.");
      return;
    }

    try {
      await createMinute({
        document_id: document.id,
        body: comment.trim(),
        forwarded_to_user_id: forwardToId ? Number(forwardToId) : null,
      }).unwrap();

      dispatch(
        showToast({
          message: forwardToId ? "Comment added and forwarded" : "Comment added",
          type: "success",
        }),
      );
      setComment("");
      setForwardToId("");
    } catch {
      setSubmitError("Failed to add comment. Please try again.");
    }
  };

  if (!id) {
    return <div className="p-6 text-center text-gray-400">Invalid document.</div>;
  }

  if (isDocumentLoading) {
    return <div className="p-6 text-center text-gray-400">Loading document...</div>;
  }

  if (isDocumentError || !document) {
    return (
      <div className="p-6 text-center text-red-300">
        Failed to load document.
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExit}
            title="Back to documents"
            aria-label="Back to documents"
            className="inline-flex items-center justify-center p-1.5 rounded hover:bg-[#0A4D66]/30 text-gray-400 hover:text-white transition-colors"
          >
            <Icon icon="mdi:arrow-left" className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-white uppercase tracking-wide">
              {document.title || document.name || `Document #${document.id}`}
            </h1>
            <p className="text-xs text-gray-400">
              {document.document_type?.name || "Uncategorized"}
              {document.uploaded_by ? ` · Uploaded by ${userName(document.uploaded_by)}` : ""}
            </p>
          </div>
        </div>

        {fileUrl && (
          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-[#0A4D66]/50 px-3 py-1.5 text-xs text-gray-200 hover:bg-[#0A4D66]/30"
            >
              <Icon icon="mdi:eye-outline" className="w-3.5 h-3.5" />
              View
            </a>
            <a
              href={fileUrl}
              download
              className="inline-flex items-center gap-1.5 rounded border border-[#0A4D66]/50 px-3 py-1.5 text-xs text-gray-200 hover:bg-[#0A4D66]/30"
            >
              <Icon icon="mdi:download" className="w-3.5 h-3.5" />
              Download
            </a>
          </div>
        )}
      </div>

      {showImagePreview && fileUrl && (
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex justify-center">
          <img
            src={fileUrl}
            alt={document.title || "Document preview"}
            className="max-h-96 w-auto rounded-lg object-contain"
          />
        </div>
      )}

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <h2 className="text-xs font-semibold text-[#7FD5FF] uppercase">
            Minutes
          </h2>
        </div>

        <div className="px-4 sm:px-6 py-4 space-y-3">
          {isMinutesLoading ? (
            <div className="text-sm text-gray-400">Loading minutes...</div>
          ) : minutes.length === 0 ? (
            <div className="text-sm text-gray-400">
              No comments yet. Be the first to leave one.
            </div>
          ) : (
            minutes.map((minute) => (
              <div
                key={minute.id}
                className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-white">
                    {minute.user_id === currentUserId
                      ? "You"
                      : userName(minute.author)}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {formatDateTime(minute.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-200">
                  {minute.body}
                </p>
                {minute.forwarded_to && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#7FD5FF]">
                    <Icon icon="mdi:arrow-right-circle-outline" className="w-3.5 h-3.5" />
                    Forwarded to {userName(minute.forwarded_to)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-[#0A4D66]/40 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400">Add Comment</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="h-20 w-full resize-none rounded-md border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]"
              placeholder="Enter your comment"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">
                Forward To (optional)
              </label>
              <select
                title="Forward to"
                value={forwardToId}
                onChange={(event) => setForwardToId(event.target.value)}
                className="w-full rounded-md border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white outline-none focus:border-[#7FD5FF] appearance-none"
              >
                <option value="">Don't forward</option>
                {forwardableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userName(user)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {submitError && (
            <div className="text-[11px] text-red-400">{submitError}</div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className={cn(
                "inline-flex items-center gap-2 rounded bg-[#0369A1] px-5 py-2 text-xs font-semibold text-black hover:bg-[#0369A1]/90 transition-colors",
                isSubmitting && "opacity-70 cursor-not-allowed",
              )}
            >
              <Icon
                icon={isSubmitting ? "mdi:loading" : forwardToId ? "mdi:send" : "mdi:comment-check-outline"}
                className={cn("w-4 h-4", isSubmitting && "animate-spin")}
              />
              {isSubmitting
                ? "Saving..."
                : forwardToId
                  ? "Add & Forward"
                  : "Add Comment"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
