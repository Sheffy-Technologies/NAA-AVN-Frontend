import { useMemo, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { BackButton } from "@/shared/ui/button/BackButton";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
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
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

type DocumentsViewMode = "table" | "grid";

const FILE_BASE_URL = (import.meta.env.VITE_FILE_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

const normalizeDocumentUrl = (value: string) =>
  value.replace("/storage/documents/", "/documents/");

const buildDocumentFileUrl = (document: DocumentItem) => {
  if (document.file_url) return normalizeDocumentUrl(document.file_url);
  const filePath = document.file || document.file_path;
  if (!FILE_BASE_URL || !filePath) return null;
  const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return normalizeDocumentUrl(`${FILE_BASE_URL}${normalizedPath}`);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatFileSize = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const bytes = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

// ── Types ─────────────────────────────────────────────────────────────────────

type AssignedEntry = { id: number; name: string; access: "read" | "write" };

// ── Create Modal ──────────────────────────────────────────────────────────────

type CreateDocumentModalProps = { onClose: (saved?: boolean) => void };

const inputCls =
  "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-white text-xs outline-none focus:ring-1 focus:ring-[#7FD5FF]/40 placeholder:text-gray-500";
const labelCls = "block text-[10px] uppercase tracking-wide text-gray-400 mb-1";

const CreateDocumentModal = ({ onClose }: CreateDocumentModalProps) => {
  const dispatch = useAppDispatch();

  // Core fields
  const [title, setTitle] = useState("");
  const [fileHeader, setFileHeader] = useState("");
  const [fileReference, setFileReference] = useState("");
  const [classification, setClassification] = useState<"classified" | "open">("classified");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [currentAction, setCurrentAction] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Personnel assignment
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [assigned, setAssigned] = useState<AssignedEntry[]>([]);
  const [showPersonnelDropdown, setShowPersonnelDropdown] = useState(false);

  const { data: assetsData } = useGetAssetsQuery();
  const { data: documentTypesData } = useGetDocumentTypesQuery();
  const { data: personnelData = [] } = useGetPersonnelQuery({
    branches: [], units: [], ranks: [], corps: [], specialties: [], status: [],
  });
  const [createDocument, { isLoading }] = useCreateDocumentMutation();

  const assets = (assetsData ?? []) as Asset[];
  const documentTypes = (documentTypesData ?? []) as DocumentType[];

  const filteredPersonnel = useMemo(() => {
    const q = personnelSearch.trim().toLowerCase();
    const assignedIds = new Set(assigned.map((a) => a.id));
    return personnelData
      .filter((p) => !assignedIds.has(p.id))
      .filter((p) => {
        if (!q) return true;
        const name = `${p.firstname} ${p.lastname}`.toLowerCase();
        return name.includes(q) || (p.service_number ?? "").toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [personnelData, personnelSearch, assigned]);

  const addPersonnel = (p: { id: number; firstname: string; lastname: string }) => {
    setAssigned((prev) => [
      ...prev,
      { id: p.id, name: `${p.firstname} ${p.lastname}`, access: "read" },
    ]);
    setPersonnelSearch("");
    setShowPersonnelDropdown(false);
  };

  const removePersonnel = (id: number) =>
    setAssigned((prev) => prev.filter((a) => a.id !== id));

  const toggleAccess = (id: number) =>
    setAssigned((prev) =>
      prev.map((a) => (a.id === id ? { ...a, access: a.access === "read" ? "write" : "read" } : a)),
    );

  const handleSubmit = async () => {
    const formData = new FormData();

    if (title) formData.append("title", title);
    if (fileHeader) formData.append("file_header", fileHeader);
    if (fileReference) formData.append("file_reference", fileReference);
    formData.append("classification", classification);
    if (documentTypeId) formData.append("document_type_id", documentTypeId);
    if (assetId) formData.append("asset_id", assetId);
    if (issueDate) formData.append("issue_date", issueDate);
    if (expiryDate) formData.append("expiry_date", expiryDate);
    if (currentLocation) formData.append("current_location", currentLocation);
    if (currentAction) formData.append("current_action", currentAction);
    if (file) formData.append("file", file);

    // Assigned personnel as JSON — backend reads assigned_personnel[0][id], etc.
    assigned.forEach((a, i) => {
      formData.append(`assigned_personnel[${i}][id]`, String(a.id));
      formData.append(`assigned_personnel[${i}][access]`, a.access);
    });

    try {
      await createDocument(formData).unwrap();
      dispatch(showToast({ message: "Document added", type: "success" }));
      onClose(true);
    } catch {
      dispatch(showToast({ message: "Failed to add document", type: "error" }));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-2xl bg-[#001219] border border-[#0A4D66]/60 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#0A4D66]/40 shrink-0">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:file-plus-outline" className="w-4 h-4 text-[#7FD5FF]" />
            <span className="text-sm font-semibold text-white uppercase tracking-wide">Add Document</span>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Document Identity ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#7FD5FF] mb-3 font-semibold">
              Document Identity
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document title"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>File Reference</label>
                <input
                  type="text"
                  value={fileReference}
                  onChange={(e) => setFileReference(e.target.value)}
                  placeholder="e.g. AVN/HQ/2026/001"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>File Header / Subject</label>
                <input
                  type="text"
                  value={fileHeader}
                  onChange={(e) => setFileHeader(e.target.value)}
                  placeholder="Document subject or header"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* ── Classification & Category ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#7FD5FF] mb-3 font-semibold">
              Classification &amp; Category
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Classification toggle */}
              <div>
                <label className={labelCls}>Classification</label>
                <div className="flex rounded-md border border-[#0A4D66]/40 overflow-hidden">
                  {(["classified", "open"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setClassification(opt)}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium transition-colors capitalize",
                        classification === opt
                          ? opt === "classified"
                            ? "bg-red-800/60 text-red-300"
                            : "bg-emerald-800/40 text-emerald-300"
                          : "bg-[#001825] text-gray-400 hover:text-gray-200",
                      )}
                    >
                      {opt === "classified" ? (
                        <span className="inline-flex items-center gap-1 justify-center">
                          <Icon icon="mdi:lock-outline" className="w-3.5 h-3.5" />
                          Classified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 justify-center">
                          <Icon icon="mdi:lock-open-outline" className="w-3.5 h-3.5" />
                          Open
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Document Type</label>
                <select
                  value={documentTypeId}
                  onChange={(e) => setDocumentTypeId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select type</option>
                  {documentTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Asset (Optional)</label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select asset</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Dates & File ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#7FD5FF] mb-3 font-semibold">
              Dates &amp; File
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Issue Date</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Expiry Date</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>File</label>
                <input
                  type="file"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
                  className={cn(inputCls, "file:mr-3 file:rounded file:border-0 file:bg-[#0A4D66] file:px-3 file:py-1 file:text-white file:text-xs")}
                />
              </div>
            </div>
          </div>

          {/* ── Tracking ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#7FD5FF] mb-3 font-semibold">
              Document Tracking
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Current Location</label>
                <input
                  type="text"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  placeholder="e.g. CO's Office"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Current Action</label>
                <input
                  type="text"
                  value={currentAction}
                  onChange={(e) => setCurrentAction(e.target.value)}
                  placeholder="e.g. Awaiting signature"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* ── Personnel Assignment ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#7FD5FF] mb-3 font-semibold">
              Assign Personnel
            </p>

            {/* Search */}
            <div className="relative mb-3">
              <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={personnelSearch}
                onChange={(e) => {
                  setPersonnelSearch(e.target.value);
                  setShowPersonnelDropdown(true);
                }}
                onFocus={() => setShowPersonnelDropdown(true)}
                placeholder="Search personnel by name or service no."
                className={cn(inputCls, "pl-9")}
              />
              {showPersonnelDropdown && filteredPersonnel.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl max-h-44 overflow-y-auto">
                  {filteredPersonnel.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => addPersonnel(p)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-200 hover:bg-[#0A4D66]/40 text-left"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#0A4D66] flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                        {p.firstname[0]}{p.lastname[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{p.firstname} {p.lastname}</div>
                        <div className="text-gray-500">{p.service_number} · {p.rank?.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned list */}
            {assigned.length === 0 ? (
              <p className="text-[11px] text-gray-500 italic">No personnel assigned yet.</p>
            ) : (
              <div className="space-y-1.5">
                {assigned.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#001825] border border-[#0A4D66]/30"
                  >
                    <span className="text-xs text-white truncate">{a.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Read / Write toggle */}
                      <button
                        type="button"
                        onClick={() => toggleAccess(a.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                          a.access === "write"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "bg-[#0A4D66]/30 text-[#7FD5FF] border border-[#0A4D66]/50",
                        )}
                      >
                        <Icon
                          icon={a.access === "write" ? "mdi:pencil-outline" : "mdi:eye-outline"}
                          className="w-3 h-3"
                        />
                        {a.access === "write" ? "Write" : "Read"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePersonnel(a.id)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#0A4D66]/40 shrink-0">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-3 py-1.5 rounded border border-[#0A4D66]/50 text-gray-300 text-xs hover:bg-[#0A4D66]/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={cn(
              "px-4 py-1.5 rounded text-xs font-medium transition-colors",
              isLoading
                ? "bg-[#0369A1]/40 text-white/60 cursor-not-allowed"
                : "bg-[#0369A1] text-white hover:bg-[#0369A1]/90",
            )}
          >
            {isLoading ? "Saving..." : "Add Document"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Documents Page ────────────────────────────────────────────────────────────

export const DocumentsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<DocumentsViewMode>("table");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<"" | "classified" | "open">("");

  const { data: documentsData, isLoading, isError, refetch } = useGetDocumentsQuery();

  const documents = useMemo(() => {
    let list = documentsData ?? [];
    if (classFilter) list = list.filter((d) => d.classification === classFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          (d.title ?? "").toLowerCase().includes(q) ||
          (d.file_header ?? "").toLowerCase().includes(q) ||
          (d.file_reference ?? "").toLowerCase().includes(q) ||
          (d.document_type?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [documentsData, search, classFilter]);

  return (
    <div className="px-2 sm:px-0 space-y-4">
      {location.state?.from && (
        <div className="flex items-center">
          <BackButton fallbackUrl="/dashboard" />
        </div>
      )}
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden min-h-90">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Documents</h2>
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 p-1">
              <button
                type="button"
                aria-label="Table view"
                onClick={() => setViewMode("table")}
                className={cn("w-7 h-7 rounded flex items-center justify-center text-gray-300", viewMode === "table" && "bg-[#0A4D66] text-white")}
              >
                <Icon icon="mdi:view-list-outline" className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={cn("w-7 h-7 rounded flex items-center justify-center text-gray-300", viewMode === "grid" && "bg-[#0A4D66] text-white")}
              >
                <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline px-2.5 py-1 rounded border border-[#0A4D66]/40 text-xs text-gray-300">
              {documents.length}
            </span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="p-1.5 rounded border border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30"
              title="Refresh"
            >
              <Icon icon="mdi:refresh" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0369A1] text-white text-xs font-medium hover:bg-[#0369A1]/90"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              Add Document
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, reference, type..."
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40"
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value as "" | "classified" | "open")}
            className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
          >
            <option value="">All Classification</option>
            <option value="classified">Classified</option>
            <option value="open">Open</option>
          </select>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {isLoading && documents.length === 0 ? (
            <div className="min-h-60 flex items-center justify-center text-gray-400 text-sm gap-2">
              <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
              Loading documents...
            </div>
          ) : isError ? (
            <div className="min-h-60 flex items-center justify-center text-red-300 text-sm">
              Failed to load documents.
            </div>
          ) : documents.length === 0 ? (
            <div className="min-h-60 flex items-center justify-center text-gray-400 text-sm">
              No documents found.
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse text-xs text-gray-200">
                <thead>
                  <tr className="text-[11px] uppercase text-gray-400 border-b border-[#0A4D66]/30">
                    <th className="py-2.5 pr-4 font-medium">Title / Header</th>
                    <th className="py-2.5 pr-4 font-medium">Reference</th>
                    <th className="py-2.5 pr-4 font-medium">Type</th>
                    <th className="py-2.5 pr-4 font-medium">Classification</th>
                    <th className="py-2.5 pr-4 font-medium">Size</th>
                    <th className="py-2.5 pr-4 font-medium">Personnel</th>
                    <th className="py-2.5 pr-4 font-medium">Created</th>
                    <th className="py-2.5 pr-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc: DocumentItem) => {
                    const fileUrl = buildDocumentFileUrl(doc);
                    const title = doc.title || doc.file_header || doc.file_name || "—";
                    const assignedCount = doc.assigned_personnel?.length ?? 0;

                    return (
                      <tr
                        key={doc.id}
                        tabIndex={0}
                        role="button"
                        title="Click to view document correspondence"
                        onClick={(e) =>
                          onInteractiveRowClick(e, () =>
                            navigate(`/dashboard/documents/${doc.id}`, {
                              state: { from: "/dashboard/documents", fromLabel: "Documents" },
                            }),
                          )
                        }
                        onKeyDown={(e) =>
                          onInteractiveRowKeyDown(e, () =>
                            navigate(`/dashboard/documents/${doc.id}`, {
                              state: { from: "/dashboard/documents", fromLabel: "Documents" },
                            }),
                          )
                        }
                        className="border-b border-[#0A4D66]/20 last:border-b-0 hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50"
                      >
                        <td className="py-2.5 pr-4">
                          <div className="font-medium text-white leading-5 max-w-xs truncate">{title}</div>
                          {doc.file_header && doc.title && (
                            <div className="text-gray-500 text-[10px] truncate max-w-xs">{doc.file_header}</div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-400 font-mono text-[11px]">
                          {doc.file_reference ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-300">
                          {doc.document_type?.name ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                              doc.classification === "open"
                                ? "text-emerald-400 bg-emerald-400/10"
                                : "text-red-400 bg-red-400/10",
                            )}
                          >
                            <Icon
                              icon={doc.classification === "open" ? "mdi:lock-open-outline" : "mdi:lock-outline"}
                              className="w-3 h-3"
                            />
                            {doc.classification === "open" ? "Open" : "Classified"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-400">
                          {formatFileSize(doc.file_size ?? doc.size)}
                        </td>
                        <td className="py-2.5 pr-4">
                          {assignedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#7FD5FF]">
                              <Icon icon="mdi:account-multiple-outline" className="w-3.5 h-3.5" />
                              {assignedCount}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-400">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/documents/${doc.id}`, {
                                  state: { from: "/dashboard/documents", fromLabel: "Documents" },
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded border border-[#0A4D66]/50 px-2 py-1 text-[11px] text-gray-200 hover:bg-[#0A4D66]/30 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50"
                            >
                              <Icon icon="mdi:eye-outline" className="w-3.5 h-3.5" />
                              Open
                            </button>
                            {fileUrl && (
                              <a
                                href={fileUrl}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded border border-[#0A4D66]/50 px-2 py-1 text-[11px] text-gray-200 hover:bg-[#0A4D66]/30 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50"
                              >
                                <Icon icon="mdi:download" className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc: DocumentItem) => {
                const title = doc.title || doc.file_header || doc.file_name || "Untitled";
                const assignedCount = doc.assigned_personnel?.length ?? 0;

                return (
                  <article
                    key={doc.id}
                    tabIndex={0}
                    role="button"
                    title="Click to view document correspondence"
                    onClick={(e) =>
                      onInteractiveRowClick(e, () =>
                        navigate(`/dashboard/documents/${doc.id}`, {
                          state: { from: "/dashboard/documents", fromLabel: "Documents" },
                        }),
                      )
                    }
                    onKeyDown={(e) =>
                      onInteractiveRowKeyDown(e, () =>
                        navigate(`/dashboard/documents/${doc.id}`, {
                          state: { from: "/dashboard/documents", fromLabel: "Documents" },
                        }),
                      )
                    }
                    className="rounded-lg border border-[#0A4D66]/40 bg-[#001825] p-4 cursor-pointer hover:border-[#7FD5FF]/50 transition-colors focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white leading-5 truncate">{title}</h3>
                        {doc.file_reference && (
                          <p className="text-[11px] text-gray-500 font-mono mt-0.5">{doc.file_reference}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                          doc.classification === "open"
                            ? "text-emerald-400 bg-emerald-400/10"
                            : "text-red-400 bg-red-400/10",
                        )}
                      >
                        <Icon
                          icon={doc.classification === "open" ? "mdi:lock-open-outline" : "mdi:lock-outline"}
                          className="w-3 h-3"
                        />
                        {doc.classification === "open" ? "Open" : "Classified"}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-400">
                      <p>Type: <span className="text-gray-200">{doc.document_type?.name ?? "—"}</span></p>
                      <p>Size: <span className="text-gray-200">{formatFileSize(doc.file_size ?? doc.size)}</span></p>
                      <p>Created: <span className="text-gray-200">{formatDate(doc.created_at)}</span></p>
                      {assignedCount > 0 && (
                        <p className="flex items-center gap-1 text-[#7FD5FF]">
                          <Icon icon="mdi:account-multiple-outline" className="w-3.5 h-3.5" />
                          {assignedCount} personnel assigned
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {isCreateModalOpen && (
        <CreateDocumentModal
          onClose={(saved) => {
            setIsCreateModalOpen(false);
            if (saved) void refetch();
          }}
        />
      )}
    </div>
  );
};
