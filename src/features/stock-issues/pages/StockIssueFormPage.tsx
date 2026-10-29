import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton, CancelButton } from "@/shared/ui/button";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { Icon } from "@/shared/icons/Icon";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useCreateStockIssueMutation, useGetStockIssueQuery, useUpdateStockIssueMutation, type StockIssue } from "../api";
import { DocumentRowsEditor } from "../components/DocumentRowsEditor";
import { appendDocuments, newDocumentRow, type DocumentRow } from "../stockIssueHelpers";
import { SPECIAL_STORAGE_OPTIONS } from "@/features/inventory/components/AircraftSparePartsForm";

const ALL_PERSONNEL = { branches: [], units: [], ranks: [], corps: [], specialties: [], status: [] };

type FormState = {
  inventory_id: string;
  description: string;
  part_number: string;
  alternate_support_part_no: string;
  nsn: string;
  cage_code: string;
  manufacturer: string;
  ata_chapter: string;
  special_storage: string;
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
  alternate_support_part_no: "",
  nsn: "",
  cage_code: "",
  manufacturer: "",
  ata_chapter: "",
  special_storage: "standard",
  quantity: "1",
  unit_of_issue: "EA",
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
  alternate_support_part_no: "",
  nsn: issue.nsn ?? "",
  cage_code: "",
  manufacturer: "",
  ata_chapter: "",
  special_storage: "standard",
  quantity: String(issue.quantity),
  unit_of_issue: issue.unit_of_issue ?? "EA",
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
    return (
      <div className="p-12 text-center text-sm font-semibold opacity-60 flex flex-col items-center justify-center gap-2">
        <Icon icon="mdi:loading" className="w-6 h-6 animate-spin text-sky-500" />
        <span>{isLoading ? "Loading issue voucher..." : "Issue voucher not found."}</span>
      </div>
    );
  }

  return <StockIssueForm key={existing?.id ?? "new"} existing={existing ?? null} />;
};

const StockIssueForm = ({ existing }: { existing: StockIssue | null }) => {
  const editingId = existing?.id ?? null;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data: units = [] } = useGetUnitsQuery();
  const { data: inventories = [] } = useGetInventoriesQuery();
  const { data: personnel = [] } = useGetPersonnelQuery(ALL_PERSONNEL);
  const [createIssue, { isLoading: creating }] = useCreateStockIssueMutation();
  const [updateIssue, { isLoading: updating }] = useUpdateStockIssueMutation();

  const [form, setForm] = useState<FormState>(() => (existing ? toFormState(existing) : EMPTY));
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>(
    editingId ? [] : [newDocumentRow("Issue voucher photo", "voucher_photo"), newDocumentRow("AFG/1033", "afg_1033")],
  );
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(() => inventories.find((i) => String(i.id) === form.inventory_id), [inventories, form.inventory_id]);
  const sendingUnit = useMemo(() => {
    if (selectedItem?.unit) return selectedItem.unit;
    return units[0] || null;
  }, [selectedItem, units]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const pickItem = (value: string) => {
    const item = inventories.find((i) => String(i.id) === value);
    setSelectedSerialNumbers([]);
    set({
      inventory_id: value,
      ...(item
        ? {
            description: item.description ?? "",
            part_number: item.part_number ?? "",
            alternate_support_part_no: item.alternate_support_part_no ?? "",
            nsn: item.nsn ?? "",
            cage_code: item.cage_code ?? "",
            manufacturer: item.manufacturer ?? "",
            ata_chapter: item.ata_chapter ?? item.ata_chapter_rel?.code ?? "",
            special_storage: item.special_storage || (item.store && item.store !== "general" ? item.store : "standard"),
            unit_of_issue: item.unit_of_issue ?? item.measurement_unit ?? "EA",
          }
        : {}),
    });
  };

  const personnelOptions = personnel.map((p) => ({
    value: String(p.id),
    label: `${p.firstname} ${p.lastname} (${p.service_number})`,
  }));

  const inputClasses =
    "w-full rounded-lg border border-slate-300 dark:border-[#0A4D66]/50 bg-white dark:bg-[#001825] px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:border-[#7FD5FF] focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40 disabled:opacity-50 transition-colors";
  const selectClasses =
    "w-full rounded-lg border border-slate-300 dark:border-[#0A4D66]/50 bg-white dark:bg-[#001825] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-[#7FD5FF] focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40 disabled:opacity-50 transition-colors appearance-none";
  const labelClasses = "block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1";

  const availableUnits = useMemo(() => {
    if (!selectedItem?.units) return [];
    return selectedItem.units.filter((u) => u.serial_number && (!u.status || u.status === "in_stock" || u.status === "serviceable"));
  }, [selectedItem]);

  const toggleSerial = (serial: string) => {
    setSelectedSerialNumbers((prev) => {
      const exists = prev.includes(serial);
      const next = exists ? prev.filter((s) => s !== serial) : [...prev, serial];
      if (!exists && next.length > Number(form.quantity)) {
        set({ quantity: String(next.length) });
      }
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedItem && Number(form.quantity) > selectedItem.current_stock) {
      setError(`Only ${selectedItem.current_stock} of this item are in stock at the sending unit.`);
      return;
    }

    const remarksWithSerials = selectedSerialNumbers.length > 0
      ? `${form.remarks ? `${form.remarks}\n` : ""}Dispatched Serials: ${selectedSerialNumbers.join(", ")}`
      : form.remarks;

    const body = new FormData();
    const payloadFields: Record<string, string> = {
      inventory_id: form.inventory_id,
      description: form.description,
      part_number: form.part_number,
      nsn: form.nsn,
      quantity: form.quantity,
      unit_of_issue: form.unit_of_issue,
      issue_date: form.issue_date,
      receiving_unit_id: form.receiving_unit_id,
      authorizing_officer_id: form.authorizing_officer_id,
      receiving_officer_id: form.receiving_officer_id,
      remarks: remarksWithSerials,
    };

    Object.entries(payloadFields).forEach(([k, v]) => {
      if (v !== "") body.append(k, v);
    });
    appendDocuments(body, documents);

    try {
      const saved = editingId ? await updateIssue({ id: editingId, body }).unwrap() : await createIssue(body).unwrap();
      dispatch(showToast({ type: "success", message: editingId ? "Issue voucher updated." : `Issue voucher ${saved.reference ?? ""} created.` }));
      navigate(`/dashboard/inventory/issues/${saved.id}`, {
        replace: true,
        state: { from: "/dashboard/inventory?tab=issues", fromLabel: "Issues" },
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/inventory?tab=issues" label="Back to Issues" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>{editingId ? `Edit Issue Voucher — ${existing?.reference ?? ""}` : "Issue Voucher — Stock Dispatch"}</span>
              <span className="rounded bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                Aviation Spares Workflow
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Transfer spares and materials from your unit to another unit with full traceability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CancelButton fallbackUrl="/dashboard/inventory?tab=issues" label="Cancel" size="md" onCancel={() => navigate("/dashboard/inventory?tab=issues")} />
          <button
            type="button"
            onClick={submit}
            disabled={creating || updating || !form.receiving_unit_id}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0369A1] hover:bg-[#025682] text-white shadow-sm transition-colors",
              (creating || updating || !form.receiving_unit_id) && "opacity-60 cursor-not-allowed",
            )}
          >
            {creating || updating ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Saving Voucher...</span>
              </>
            ) : (
              <>
                <Icon icon="mdi:content-save-check" className="w-4 h-4" />
                <span>{editingId ? "Save Changes" : "Create Issue Voucher"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-center gap-3">
          <Icon icon="mdi:alert-circle-outline" className="w-5 h-5 flex-shrink-0 text-red-500" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      {/* Top Context Bar: Units & Stock Source */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Sending Unit Badge */}
          <div className="space-y-1">
            <span className={labelClasses}>Sending Unit (Source)</span>
            <div className="rounded-lg border border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825] px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="truncate">{sendingUnit?.name ?? "Current Unit"}</span>
              <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800">
                Dispatch
              </span>
            </div>
          </div>

          {/* Receiving Unit Selector */}
          <div className="space-y-1">
            <label className={labelClasses}>
              Receiving Unit <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              size="sm"
              placeholder="Select destination unit…"
              value={form.receiving_unit_id || null}
              onChange={(v) => set({ receiving_unit_id: v === null ? "" : String(v) })}
              options={units.filter((u) => u.id !== selectedItem?.unit_id).map((u) => ({ value: String(u.id), label: u.name }))}
            />
          </div>

          {/* Issue Date */}
          <div className="space-y-1">
            <label className={labelClasses}>
              Date of Issue <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => set({ issue_date: e.target.value })}
              className={inputClasses}
              required
            />
          </div>

          {/* Stock Item Source */}
          <div className="space-y-1">
            <label className={labelClasses}>Stock Ledger Item</label>
            <SearchableSelect
              size="sm"
              placeholder="Select stock or type manually…"
              value={form.inventory_id || null}
              onChange={(v) => pickItem(v === null ? "" : String(v))}
              options={inventories.map((i) => ({
                value: String(i.id),
                label: `${i.description ?? "Item"}${i.part_number ? ` · P/N ${i.part_number}` : ""}`,
                description: `${i.unit?.name ?? ""} · ${i.current_stock} in stock`,
              }))}
            />
          </div>
        </div>
      </div>

      {/* 1. COMMON PART INFORMATION SECTION */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
            <span>1. COMMON PART INFORMATION</span>
            <span className="rounded bg-[#0A4D66]/30 px-2 py-0.5 text-[10px] font-semibold text-[#7FD5FF]">
              Shared Specifications
            </span>
          </div>
          {selectedItem && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
              {selectedItem.current_stock} Available In Stock
            </span>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Part Name / Description */}
            <div className="space-y-1 sm:col-span-2">
              <label className={labelClasses}>
                Part Name / Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                className={inputClasses}
                placeholder="e.g. HYDRAULIC ACTUATOR CYLINDER ASSY"
                required
              />
            </div>

            {/* Part Number (P/N) */}
            <div className="space-y-1">
              <label className={labelClasses}>Part Number (P/N)</label>
              <input
                type="text"
                value={form.part_number}
                onChange={(e) => set({ part_number: e.target.value })}
                className={cn(inputClasses, "font-mono font-medium")}
                placeholder="e.g. HP-60750"
              />
            </div>

            {/* Alternate Part Number (Alt P/N) */}
            <div className="space-y-1">
              <label className={labelClasses}>Alternate Part Number (Alt P/N)</label>
              <input
                type="text"
                value={form.alternate_support_part_no}
                onChange={(e) => set({ alternate_support_part_no: e.target.value })}
                className={cn(inputClasses, "font-mono")}
                placeholder="e.g. ALT-109-88 / 10-60750-2"
              />
            </div>

            {/* Manufacturer (MFR) */}
            <div className="space-y-1">
              <label className={labelClasses}>Manufacturer (MFR)</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => set({ manufacturer: e.target.value })}
                className={inputClasses}
                placeholder="e.g. Leonardo, Honeywell, Safran"
              />
            </div>

            {/* ATA Chapter */}
            <div className="space-y-1">
              <label className={labelClasses}>ATA Chapter</label>
              <input
                type="text"
                value={form.ata_chapter}
                onChange={(e) => set({ ata_chapter: e.target.value })}
                className={inputClasses}
                placeholder="e.g. ATA 29 - Hydraulic Power"
              />
            </div>

            {/* NATO Stock Number (NSN) */}
            <div className="space-y-1">
              <label className={labelClasses}>NATO Stock Number (NSN)</label>
              <input
                type="text"
                value={form.nsn}
                onChange={(e) => set({ nsn: e.target.value })}
                className={cn(inputClasses, "font-mono")}
                placeholder="e.g. 2840-01-523-9988"
              />
            </div>

            {/* CAGE Code */}
            <div className="space-y-1">
              <label className={labelClasses}>CAGE Code</label>
              <input
                type="text"
                value={form.cage_code}
                onChange={(e) => set({ cage_code: e.target.value })}
                className={cn(inputClasses, "font-mono uppercase")}
                placeholder="e.g. 77272"
              />
            </div>

            {/* Storage Environment */}
            <div className="space-y-1">
              <label className={labelClasses}>Storage Environment</label>
              <div className="relative">
                <select
                  value={form.special_storage}
                  onChange={(e) => set({ special_storage: e.target.value })}
                  className={selectClasses}
                >
                  {SPECIAL_STORAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>

            {/* Quantity to Issue */}
            <div className="space-y-1">
              <label className={labelClasses}>
                Quantity to Issue <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={selectedItem?.current_stock}
                  value={form.quantity}
                  onChange={(e) => set({ quantity: e.target.value })}
                  className={cn(inputClasses, "font-bold text-sm")}
                  required
                />
                <input
                  type="text"
                  value={form.unit_of_issue}
                  onChange={(e) => set({ unit_of_issue: e.target.value })}
                  placeholder="UOM"
                  className={cn(inputClasses, "w-24 text-center uppercase font-semibold")}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. UNIT & SERIAL NUMBER DISPATCH SECTION */}
      {availableUnits.length > 0 && (
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
              <Icon icon="mdi:barcode-scan" className="w-4 h-4 text-sky-500" />
              <span>2. UNIT &amp; SERIAL NUMBER DISPATCH</span>
              <span className="rounded bg-[#0A4D66]/30 px-2 py-0.5 text-[10px] font-semibold text-[#7FD5FF]">
                Traceable Stock
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {selectedSerialNumbers.length} of {form.quantity} selected
            </span>
          </div>

          <div className="p-4 sm:p-6 space-y-3">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Select specific serial numbers from the available serialized stock inventory:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {availableUnits.map((u, i) => {
                const serial = u.serial_number || `Unit #${i + 1}`;
                const isSelected = selectedSerialNumbers.includes(serial);
                return (
                  <button
                    key={u.id || i}
                    type="button"
                    onClick={() => toggleSerial(serial)}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all",
                      isSelected
                        ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-300 font-bold ring-1 ring-sky-500/30"
                        : "bg-slate-50 dark:bg-[#001825] border-slate-200 dark:border-[#0A4D66]/30 text-slate-700 dark:text-gray-300 hover:border-slate-300 dark:hover:border-[#0A4D66]",
                    )}
                  >
                    <div className="text-[10px] uppercase text-slate-400">Unit {i + 1}</div>
                    <div className="font-mono text-xs truncate">{serial}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. MILITARY AUTHORIZATION & TRANSFER DETAILS */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
            <Icon icon="mdi:shield-account" className="w-4 h-4 text-sky-500" />
            <span>3. MILITARY AUTHORIZATION &amp; TRANSFER DETAILS</span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClasses}>Authorizing Officer</label>
              <SearchableSelect
                size="sm"
                placeholder="Select authorizing officer…"
                value={form.authorizing_officer_id || null}
                onChange={(v) => set({ authorizing_officer_id: v === null ? "" : String(v) })}
                options={personnelOptions}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClasses}>Receiving Officer</label>
              <SearchableSelect
                size="sm"
                placeholder="Select receiving officer…"
                value={form.receiving_officer_id || null}
                onChange={(v) => set({ receiving_officer_id: v === null ? "" : String(v) })}
                options={personnelOptions}
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className={labelClasses}>Internal Remarks / Purpose of Issue</label>
              <textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => set({ remarks: e.target.value })}
                className={inputClasses}
                placeholder="e.g. Dispatched for Scheduled Phase Inspection on Airframe NAF-541, AFG/1033 Ref #..."
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. SUPPORTING VOUCHER DOCUMENTS */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
            <Icon icon="mdi:file-document-multiple-outline" className="w-4 h-4 text-sky-500" />
            <span>4. SUPPORTING VOUCHER DOCUMENTS</span>
          </div>
          <span className="text-[11px] text-slate-400">Voucher photo, AFG/1033 &amp; Airworthiness release</span>
        </div>

        <div className="p-4 sm:p-6">
          <DocumentRowsEditor rows={documents} onChange={setDocuments} />
        </div>
      </section>

      {/* Bottom Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <CancelButton fallbackUrl="/dashboard/inventory?tab=issues" label="Cancel" size="md" onCancel={() => navigate("/dashboard/inventory?tab=issues")} />
        <button
          type="button"
          onClick={submit}
          disabled={creating || updating || !form.receiving_unit_id}
          className={cn(
            "inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#025682] text-white shadow-md transition-colors",
            (creating || updating || !form.receiving_unit_id) && "opacity-60 cursor-not-allowed",
          )}
        >
          {creating || updating ? (
            <>
              <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
              <span>Saving Voucher...</span>
            </>
          ) : (
            <>
              <Icon icon="mdi:content-save-check" className="w-4 h-4" />
              <span>{editingId ? "Save Changes" : "Create Issue Voucher"}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

