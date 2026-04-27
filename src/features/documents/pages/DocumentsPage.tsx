import { useMemo, useState, type ChangeEvent } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetAssetsQuery,
  useGetDocumentTypesQuery,
  type Asset,
  type DocumentType,
} from "@/features/assets/api";
import {
  useCreateDocumentMutation,
  useGetDocumentsQuery,
  type DocumentItem,
} from "@/features/documents/api";

type DocumentsViewMode = "table" | "grid";

type DocumentRow = {
  id: number;
  title: string;
  category: string;
  type: string;
  size: string;
  uploadedBy: string;
  createdAt: string;
  status: string;
  fileUrl: string | null;
};

const FILE_BASE_URL = (import.meta.env.VITE_FILE_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

const normalizeDocumentUrl = (value: string) => {
  if (!value) return value;

  // Backend can return links like /storage/documents/...; frontend expects /documents/...
  return value.replace("/storage/documents/", "/documents/");
};

const buildDocumentFileUrl = (document: DocumentItem) => {
  if (document.file_url) return normalizeDocumentUrl(document.file_url);
  const filePath = document.file || document.file_path;
  if (!FILE_BASE_URL || !filePath) return null;
  const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return normalizeDocumentUrl(`${FILE_BASE_URL}${normalizedPath}`);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "-";
  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatFileSize = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const bytes = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const mapDocumentRow = (document: DocumentItem): DocumentRow => {
  const uploader = document.uploaded_by || document.user;
  const uploadedBy =
    [uploader?.firstname, uploader?.lastname]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" ") ||
    uploader?.name ||
    uploader?.username ||
    "-";

  return {
    id: document.id,
    title:
      document.title ||
      document.name ||
      document.file_name ||
      document.filename ||
      "Untitled",
    category: document.document_type?.name || "Uncategorized",
    type: document.file_type || document.mime_type || "-",
    size: formatFileSize(document.file_size ?? document.size),
    uploadedBy,
    createdAt: formatDate(document.created_at),
    status: document.status || "Available",
    fileUrl: buildDocumentFileUrl(document),
  };
};

type CreateDocumentModalProps = {
  onClose: (shouldRefresh?: boolean) => void;
};

const CreateDocumentModal = ({ onClose }: CreateDocumentModalProps) => {
  const [assetId, setAssetId] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: assetsData } = useGetAssetsQuery();
  const { data: documentTypesData } = useGetDocumentTypesQuery();
  const [createDocument, { isLoading }] = useCreateDocumentMutation();

  const assets = (assetsData ?? []) as Asset[];
  const documentTypes = (documentTypesData ?? []) as DocumentType[];

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setSubmitError(null);
  };

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed <= 0) return NaN;
    return parsed;
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    const parsedAssetId = parseOptionalNumber(assetId);
    const parsedDocumentTypeId = parseOptionalNumber(documentTypeId);

    if (Number.isNaN(parsedAssetId) || Number.isNaN(parsedDocumentTypeId)) {
      setSubmitError("IDs must be valid positive numbers.");
      return;
    }

    const formData = new FormData();

    if (parsedAssetId !== null) {
      formData.append("asset_id", String(parsedAssetId));
    }
    if (parsedDocumentTypeId !== null) {
      formData.append("document_type_id", String(parsedDocumentTypeId));
    }
    if (file) {
      formData.append("file", file);
    }
    if (issueDate) {
      formData.append("issue_date", issueDate);
    }
    if (expiryDate) {
      formData.append("expiry_date", expiryDate);
    }

    try {
      await createDocument(formData).unwrap();
      onClose(true);
    } catch {
      setSubmitError("Failed to add document. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-2xl bg-[#001219] border border-[#0A4D66]/60 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:file-plus-outline" className="w-4 h-4 text-[#7FD5FF]" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
              Add Document
            </span>
          </div>
          <button
            type="button"
            aria-label="Close add document modal"
            onClick={() => onClose(false)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 grid gap-4 sm:grid-cols-2 text-xs sm:text-sm text-gray-200">
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Document Type</label>
            <select
              aria-label="Document type"
              value={documentTypeId}
              onChange={(event) => {
                setDocumentTypeId(event.target.value);
                setSubmitError(null);
              }}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-gray-100 outline-none appearance-none"
            >
              <option value="">Select document type</option>
              {documentTypes.map((documentType) => (
                <option key={documentType.id} value={documentType.id}>
                  {documentType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Asset (Optional) </label>
            <select
              aria-label="Document asset"
              value={documentTypeId}
              onChange={(event) => {
                setAssetId(event.target.value);
                setSubmitError(null);
              }}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-gray-100 outline-none appearance-none"
            >
              <option value="">Select asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">File</label>
            <input
              type="file"
              aria-label="Document file"
              onChange={handleFileChange}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-gray-100 outline-none file:mr-3 file:rounded file:border-0 file:bg-[#0A4D66] file:px-3 file:py-1 file:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Issue Date</label>
            <input
              type="date"
              aria-label="Issue date"
              value={issueDate}
              onChange={(event) => {
                setIssueDate(event.target.value);
                setSubmitError(null);
              }}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-gray-100 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Expiry Date</label>
            <input
              type="date"
              aria-label="Expiry date"
              value={expiryDate}
              onChange={(event) => {
                setExpiryDate(event.target.value);
                setSubmitError(null);
              }}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-gray-100 outline-none"
            />
          </div>

          {submitError ? (
            <p className="sm:col-span-2 text-[11px] text-red-400">{submitError}</p>
          ) : null}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-[#0A4D66]/40 bg-[#000f18] flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-3 py-1.5 rounded border border-[#0A4D66]/50 text-gray-300 text-xs sm:text-sm hover:bg-[#0A4D66]/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={cn(
              "px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors",
              isLoading
                ? "bg-[#7FD5FF]/40 text-black/60 cursor-not-allowed"
                : "bg-[#7FD5FF] text-black hover:bg-[#7FD5FF]/90",
            )}
          >
            {isLoading ? "Saving..." : "Add Document"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const DocumentsPage = () => {
  const [viewMode, setViewMode] = useState<DocumentsViewMode>("table");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: documentsData, isLoading, isError, refetch } = useGetDocumentsQuery();

  const documents = useMemo(() => {
    if (!documentsData) return [];
    return documentsData.map(mapDocumentRow);
  }, [documentsData]);

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden min-h-90">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-1.5 text-xs sm:text-sm rounded-md bg-[#0A4D66] text-white border border-[#0A4D66]"
            >
              Documents
            </button>
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#021a27] p-1">
              <button
                type="button"
                aria-label="Table view"
                onClick={() => setViewMode("table")}
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded text-gray-300",
                  viewMode === "table" && "bg-[#0A4D66] text-white",
                )}
              >
                <Icon icon="mdi:view-list-outline" className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded text-gray-300",
                  viewMode === "grid" && "bg-[#0A4D66] text-white",
                )}
              >
                <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200">
              {documents.length}
            </span>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Add Document</span>
            </button>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:refresh" className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {isLoading && documents.length === 0 ? (
            <div className="min-h-60 flex items-center justify-center text-gray-400 text-sm">
              <div className="inline-flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                <span>Loading documents...</span>
              </div>
            </div>
          ) : isError ? (
            <div className="min-h-60 flex items-center justify-center text-red-300 text-sm">
              Failed to load documents.
            </div>
          ) : documents.length === 0 ? (
            <div className="min-h-60 flex items-center justify-center text-gray-400 text-sm">
              No documents available.
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130 text-left border-collapse text-xs sm:text-sm text-gray-200">
                <thead>
                  <tr className="text-[11px] uppercase text-gray-400 border-b border-[#0A4D66]/30">
                    <th className="py-2 pr-3 font-medium">Document</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Size</th>
                    <th className="py-2 pr-3 font-medium">Uploaded By</th>
                    <th className="py-2 pr-3 font-medium">Created</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr
                      key={document.id}
                      className="border-b border-[#0A4D66]/20 last:border-b-0"
                    >
                      <td className="py-2 pr-3 text-gray-100 font-medium">
                        {document.title}
                      </td>
                      <td className="py-2 pr-3 text-gray-300">{document.category}</td>
                      <td className="py-2 pr-3 text-gray-300">{document.type}</td>
                      <td className="py-2 pr-3 text-gray-300">{document.size}</td>
                      <td className="py-2 pr-3 text-gray-300">{document.uploadedBy}</td>
                      <td className="py-2 pr-3 text-gray-300">{document.createdAt}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{document.status}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {document.fileUrl ? (
                          <div className="inline-flex items-center gap-2">
                            <a
                              href={document.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-[#0A4D66]/50 px-2 py-1 text-[11px] text-gray-200 hover:bg-[#0A4D66]/30"
                            >
                              <Icon icon="mdi:eye-outline" className="w-3.5 h-3.5" />
                              <span>View</span>
                            </a>
                            <a
                              href={document.fileUrl}
                              download
                              className="inline-flex items-center gap-1 rounded border border-[#0A4D66]/50 px-2 py-1 text-[11px] text-gray-200 hover:bg-[#0A4D66]/30"
                            >
                              <Icon icon="mdi:download" className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-[11px]">No file</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-lg border border-[#0A4D66]/40 bg-[#001825] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white leading-5">
                      {document.title}
                    </h3>
                    <Icon icon="mdi:file-document-outline" className="w-5 h-5 text-[#7FD5FF]" />
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-gray-300">
                    <p>Category: {document.category}</p>
                    <p>Type: {document.type}</p>
                    <p>Size: {document.size}</p>
                    <p>By: {document.uploadedBy}</p>
                    <p>Created: {document.createdAt}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {isCreateModalOpen ? (
        <CreateDocumentModal
          onClose={(shouldRefresh) => {
            setIsCreateModalOpen(false);
            if (shouldRefresh) {
              void refetch();
            }
          }}
        />
      ) : null}
    </div>
  );
};
