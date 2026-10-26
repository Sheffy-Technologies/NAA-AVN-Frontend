import { useMemo, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useDeleteTrackerDocumentMutation, useGetDocumentTypesQuery, useGetTrackerDocumentsQuery, useUploadTrackerDocumentMutation, type TrackerFleetRow } from "../api";
import { apiError, fmtDate, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { FieldLabel, HelpHeader } from "../trackerUi";
import { ConfirmDialog, TrackerDialog } from "../components/TrackerDialog";

/*
 * The maintenance document library: manuals, textbooks, task cards, ADs and
 * SBs. Files go into the Documents module as `classification: open` and
 * `module: maintenance`, so they're readable by everyone with documents
 * access and listed here.
 */

const CATEGORIES = ["Maintenance manual", "Textbook", "Illustrated parts catalogue", "Airworthiness directive / service bulletin", "Task card / procedure", "Training material", "Other"];

const UploadDialog = ({ fleet, assetId, onClose }: { fleet: TrackerFleetRow[]; assetId: number | null; onClose: () => void }) => {
  const c = useTrackerClasses();
  const dispatch = useAppDispatch();
  const { data: types = [] } = useGetDocumentTypesQuery();
  const [upload, { isLoading }] = useUploadTrackerDocumentMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: "", category: CATEGORIES[0], document_type_id: "", asset_id: assetId ? String(assetId) : "", file_reference: "", issue_date: "", expiry_date: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!file) return dispatch(showToast({ message: "Choose a file to upload.", type: "error" }));
    const data = new FormData();
    data.append("file", file);
    data.append("title", form.title.trim() || file.name);
    data.append("classification", "open");
    data.append("module", "maintenance");
    data.append("file_header", form.category);
    if (form.document_type_id) data.append("document_type_id", form.document_type_id);
    if (form.asset_id) data.append("asset_id", form.asset_id);
    if (form.file_reference.trim()) data.append("file_reference", form.file_reference.trim());
    if (form.issue_date) data.append("issue_date", form.issue_date);
    if (form.expiry_date) data.append("expiry_date", form.expiry_date);
    try {
      await upload(data).unwrap();
      dispatch(showToast({ message: "Document uploaded.", type: "success" }));
      onClose();
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't upload the document."), type: "error" }));
    }
  };

  return (
    <TrackerDialog
      title="Upload maintenance document"
      subtitle="Filed as an open (unclassified) document."
      onClose={onClose}
      footer={
        <>
          <Button size="sm" onClick={save} isLoading={isLoading}>
            Upload
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel label="File" />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              Choose file
            </Button>
            <span className={cn("truncate text-xs", c.muted)}>{file?.name ?? "No file chosen"}</span>
            <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel label="Title" />
          <input className={c.field} placeholder="Defaults to the file name" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <FieldLabel label="Category" />
          <select className={c.field} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {types.length > 0 && (
          <div>
            <FieldLabel label="Document type" />
            <select className={c.field} value={form.document_type_id} onChange={(e) => set("document_type_id", e.target.value)}>
              <option value="">—</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <FieldLabel label="Aircraft (optional)" help={{ title: "Aircraft", text: "Link the document to one aircraft, or leave it general (e.g. a textbook for the type)." }} />
          <select className={c.field} value={form.asset_id} onChange={(e) => set("asset_id", e.target.value)}>
            <option value="">General</option>
            {fleet.map((a) => (
              <option key={a.id} value={a.id}>
                {a.registration}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel label="Reference / revision" />
          <input className={c.field} placeholder="e.g. TM 55-1520-210-23, Rev 12" value={form.file_reference} onChange={(e) => set("file_reference", e.target.value)} />
        </div>
        <div>
          <FieldLabel label="Issue date" />
          <input type="date" className={c.field} value={form.issue_date} onChange={(e) => set("issue_date", e.target.value)} />
        </div>
        <div>
          <FieldLabel label="Expiry / review date" />
          <input type="date" className={c.field} value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
        </div>
      </div>
    </TrackerDialog>
  );
};

export const TrackerDocumentsTab = ({ assetId, fleet }: { assetId: number | null; fleet: TrackerFleetRow[] }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const { data: documents = [], isLoading } = useGetTrackerDocumentsQuery();
  const [deleteDocument] = useDeleteTrackerDocumentMutation();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "aircraft">("all");
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return documents.filter(
      (d) =>
        (scope === "all" || !d.asset_id || d.asset_id === assetId) &&
        (!needle || [d.title, d.file_reference, d.document_type?.name, (d as { file_header?: string }).file_header, d.asset?.tail_number].join(" ").toLowerCase().includes(needle)),
    );
  }, [documents, q, scope, assetId]);

  return (
    <div>
      <div className="mt-bar">
        <input type="search" className={cn(c.field, "w-auto min-w-[240px]")} placeholder="Search title, reference, category…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={cn(c.field, "w-auto")} value={scope} onChange={(e) => setScope(e.target.value as "all" | "aircraft")}>
          <option value="all">All documents</option>
          <option value="aircraft">This aircraft + general</option>
        </select>
        <InfoTip title="Maintenance documents">
          Manuals, textbooks, parts catalogues, ADs/SBs and task cards for the maintainers. They are filed in the Documents module as open (unclassified) documents.
        </InfoTip>
        <span className="flex-1" />
        {perms.has("documents.create") && (
          <Button size="sm" onClick={() => setUploading(true)}>
            Upload document
          </Button>
        )}
      </div>

      <div className={c.tableWrap}>
        <table style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <HelpHeader label="Title" />
              <HelpHeader label="Category" />
              <HelpHeader label="Aircraft" />
              <HelpHeader label="Reference" />
              <HelpHeader label="Issued" />
              <HelpHeader label="Status" help={{ title: "Status", text: "Open: an unclassified document anyone with documents access can read." }} />
              <th className={c.th} />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="mt-empty">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="mt-empty">
                  No maintenance documents yet. Upload manuals, textbooks and task cards here.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id} >
                <td className={cn(c.td, "font-medium")}>{d.title ?? "Untitled"}</td>
                <td>{(d as { file_header?: string | null }).file_header ?? d.document_type?.name ?? "–"}</td>
                <td>{d.asset?.tail_number ?? d.asset?.name ?? "General"}</td>
                <td>{d.file_reference ?? "–"}</td>
                <td>{fmtDate(d.issue_date ?? d.created_at)}</td>
                <td>
                  <span className="mt-pill ok">
                    {d.classification === "open" ? "Open" : "Classified"}
                  </span>
                </td>
                <td className={cn(c.td, "whitespace-nowrap text-right")}>
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="mt-link" style={{ marginRight: 8 }}>
                      Open
                    </a>
                  )}
                  {perms.has("documents.delete") && (
                    <button type="button" className="mt-x" title="Delete" onClick={() => setRemoving(d.id)}>
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {uploading && <UploadDialog fleet={fleet} assetId={assetId} onClose={() => setUploading(false)} />}
      {removing && (
        <ConfirmDialog
          destructive
          confirmLabel="Delete"
          message="Delete this document?"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            deleteDocument(removing)
              .unwrap()
              .catch((e) => dispatch(showToast({ message: apiError(e, "Couldn't delete the document."), type: "error" })));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
};
