import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton } from "@/shared/ui/button/BackButton";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { PrimaryButton, SecondaryButton, SqPanel } from "@/features/safety/components/sqUi";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import { useCreateStockIssueMutation, useGetStockIssueQuery, useUpdateStockIssueMutation, type StockIssue } from "../api";
import { DocumentRowsEditor } from "../components/DocumentRowsEditor";
import { appendDocuments, newDocumentRow, type DocumentRow } from "../stockIssueHelpers";

const ALL_PERSONNEL = { branches: [], units: [], ranks: [], corps: [], specialties: [], status: [] };

type FormState = {
  inventory_id: string;
  description: string;
  part_number: string;
  nsn: string;
  quantity: string;
  unit_of_issue: string;
  issue_date: string;
  receiving_unit_id: string;
  authorizing_officer_id: string;
  receiving_officer_id: string;
  remarks: string;
};

const EMPTY: FormState = {
  inventory_id: "",
  description: "",
  part_number: "",
  nsn: "",
  quantity: "1",
  unit_of_issue: "",
  issue_date: new Date().toISOString().slice(0, 10),
  receiving_unit_id: "",
  authorizing_officer_id: "",
  receiving_officer_id: "",
  remarks: "",
};

const errorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Could not save the issue voucher.";
};

const toFormState = (issue: StockIssue): FormState => ({
  inventory_id: issue.inventory_id ? String(issue.inventory_id) : "",
  description: issue.description ?? "",
  part_number: issue.part_number ?? "",
  nsn: issue.nsn ?? "",
  quantity: String(issue.quantity),
  unit_of_issue: issue.unit_of_issue ?? "",
  issue_date: issue.issue_date?.slice(0, 10) ?? EMPTY.issue_date,
  receiving_unit_id: String(issue.receiving_unit_id),
  authorizing_officer_id: issue.authorizing_officer?.id ? String(issue.authorizing_officer.id) : "",
  receiving_officer_id: issue.receiving_officer?.id ? String(issue.receiving_officer.id) : "",
  remarks: issue.remarks ?? "",
});

/** Loads the voucher when editing, then renders the form seeded from it. */
export const StockIssueFormPage = () => {
  const { id } = useParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const { data: existing, isLoading } = useGetStockIssueQuery(editingId as number, { skip: !editingId });

  if (editingId && (isLoading || !existing)) {
    return <div className="p-10 text-center text-sm opacity-60">{isLoading ? "Loading…" : "Issue voucher not found."}</div>;
  }

  return <StockIssueForm key={existing?.id ?? "new"} existing={existing ?? null} />;
};

const StockIssueForm = ({ existing }: { existing: StockIssue | null }) => {
  const editingId = existing?.id ?? null;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const { data: units = [] } = useGetUnitsQuery();
  const { data: inventories = [] } = useGetInventoriesQuery();
  const { data: personnel = [] } = useGetPersonnelQuery(ALL_PERSONNEL);
  const [createIssue, { isLoading: creating }] = useCreateStockIssueMutation();
  const [updateIssue, { isLoading: updating }] = useUpdateStockIssueMutation();
  const [form, setForm] = useState<FormState>(() => (existing ? toFormState(existing) : EMPTY));
  const [documents, setDocuments] = useState<DocumentRow[]>(
    editingId ? [] : [newDocumentRow("Issue voucher photo", "voucher_photo"), newDocumentRow("AFG/1033", "afg_1033")],
  );
  const [error, setError] = useState<string | null>(null);


  const selectedItem = useMemo(() => inventories.find((i) => String(i.id) === form.inventory_id), [inventories, form.inventory_id]);
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const pickItem = (value: string) => {
    const item = inventories.find((i) => String(i.id) === value);
    set({
      inventory_id: value,
      ...(item
        ? {
            description: item.description ?? "",
            part_number: item.part_number ?? "",
            nsn: item.nsn ?? "",
            unit_of_issue: item.unit_of_issue ?? item.measurement_unit ?? "",
          }
        : {}),
    });
  };

  const personnelOptions = personnel.map((p) => ({ value: String(p.id), label: `${p.firstname} ${p.lastname} (${p.service_number})` }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedItem && Number(form.quantity) > selectedItem.current_stock) {
      setError(`Only ${selectedItem.current_stock} of this item are in stock at the sending unit.`);
      return;
    }
    const body = new FormData();
    (Object.entries(form) as Array<[keyof FormState, string]>).forEach(([k, v]) => {
      if (v !== "") body.append(k, v);
    });
    appendDocuments(body, documents);

    try {
      const saved = editingId ? await updateIssue({ id: editingId, body }).unwrap() : await createIssue(body).unwrap();
      dispatch(showToast({ type: "success", message: editingId ? "Issue voucher updated." : `Issue voucher ${saved.reference ?? ""} created.` }));
      navigate(`/dashboard/inventory/issues/${saved.id}`, { replace: true, state: { from: "/dashboard/inventory?tab=issues", fromLabel: "Issues" } });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const label = (text: string, required = false) => (
    <span className="block text-xs font-semibold mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </span>
  );

  return (
    <div className="space-y-6">
      <BackButton fallbackUrl="/dashboard/inventory?tab=issues" />
      <div>
        <h1 className={cn("text-2xl font-bold uppercase tracking-wide", isDark ? "text-white" : "text-slate-900")}>
          {editingId ? `Edit issue voucher ${existing?.reference ?? ""}` : "New issue voucher"}
        </h1>
        <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-slate-500")}>
          Send inventory from your unit to another unit. Approval (if required), issue and receipt follow from the voucher page.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 dark:text-red-300">{error}</div>}

        <SqPanel title="Item">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label className="md:col-span-2">
              {label("Stock item (from your unit's inventory)")}
              <SearchableSelect
                size="sm"
                placeholder="Search stock… or leave blank to describe an item"
                value={form.inventory_id || null}
                onChange={(v) => pickItem(v === null ? "" : String(v))}
                options={inventories.map((i) => ({
                  value: String(i.id),
                  label: `${i.description ?? "Item"}${i.part_number ? ` · P/N ${i.part_number}` : ""}`,
                  description: `${i.unit?.name ?? ""} · ${i.current_stock} in stock`,
                }))}
              />
              {selectedItem && <span className="block mt-1 opacity-70">{selectedItem.current_stock} in stock at {selectedItem.unit?.name ?? "the sending unit"}.</span>}
            </label>
            <label className="md:col-span-2">
              {label("Description", !form.inventory_id)}
              <input value={form.description} onChange={(e) => set({ description: e.target.value })} required={!form.inventory_id} className={fieldClass} />
            </label>
            <label>
              {label("Part number")}
              <input value={form.part_number} onChange={(e) => set({ part_number: e.target.value })} className={fieldClass} />
            </label>
            <label>
              {label("NSN")}
              <input value={form.nsn} onChange={(e) => set({ nsn: e.target.value })} className={fieldClass} />
            </label>
            <label>
              {label("Quantity", true)}
              <input type="number" min={1} value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} required className={fieldClass} />
            </label>
            <label>
              {label("Unit of issue")}
              <input value={form.unit_of_issue} onChange={(e) => set({ unit_of_issue: e.target.value })} placeholder="e.g. EA, set, litre" className={fieldClass} />
            </label>
          </div>
        </SqPanel>

        <SqPanel title="Issue details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label>
              {label("Date of issue", true)}
              <input type="date" value={form.issue_date} onChange={(e) => set({ issue_date: e.target.value })} required className={fieldClass} />
            </label>
            <label>
              {label("Receiving unit", true)}
              <SearchableSelect
                size="sm"
                placeholder="Select unit…"
                value={form.receiving_unit_id || null}
                onChange={(v) => set({ receiving_unit_id: v === null ? "" : String(v) })}
                options={units.filter((u) => u.id !== selectedItem?.unit_id).map((u) => ({ value: String(u.id), label: u.name }))}
              />
            </label>
            <label>
              {label("Authorizing officer")}
              <SearchableSelect
                size="sm"
                placeholder="Select officer…"
                value={form.authorizing_officer_id || null}
                onChange={(v) => set({ authorizing_officer_id: v === null ? "" : String(v) })}
                options={personnelOptions}
              />
            </label>
            <label>
              {label("Receiving officer")}
              <SearchableSelect
                size="sm"
                placeholder="Select officer…"
                value={form.receiving_officer_id || null}
                onChange={(v) => set({ receiving_officer_id: v === null ? "" : String(v) })}
                options={personnelOptions}
              />
            </label>
            <label className="md:col-span-2">
              {label("Remarks")}
              <textarea rows={2} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} className={fieldClass} />
            </label>
          </div>
        </SqPanel>

        <SqPanel title="Documents" subtitle="Upload the voucher photo, the AFG/1033 and any other supporting documents, each with a name.">
          <DocumentRowsEditor rows={documents} onChange={setDocuments} />
        </SqPanel>

        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => navigate(-1)}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" icon="mdi:content-save-outline" disabled={creating || updating || !form.receiving_unit_id}>
            {creating || updating ? "Saving…" : editingId ? "Save changes" : "Create issue voucher"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
};
