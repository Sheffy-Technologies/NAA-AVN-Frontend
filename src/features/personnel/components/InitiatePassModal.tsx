import { useState, useEffect, useMemo, useRef } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetPassFormOptionsQuery,
  useInitiatePassMutation,
  useUploadPassAttachmentMutation,
  type PassRecordStatus,
} from "../passApi";
import { emptyPassForm, passFormPayload, withoutOfficerFields, type PassFormValues } from "../passForm";
import {
  PassApplicationFields,
  PassAttachmentInput,
  type PassApplicationFieldsHandle,
} from "./PassApplicationFields";
import { useGetPersonnelQuery } from "../api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

type Props = {
  open: boolean;
  onClose: () => void;
  personnelId?: number;
  personnelName?: string;
};

const statusOptions: { value: PassRecordStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
];

const passStatusColors: Record<string, string> = {
  upcoming: "text-blue-400",
  due_for_pass: "text-amber-400",
  pending_approval: "text-purple-400",
  on_pass: "text-emerald-400",
  overdue: "text-red-400",
};

const passStatusLabels: Record<string, string> = {
  upcoming: "Upcoming",
  due_for_pass: "Due for Pass",
  pending_approval: "Pending Approval",
  on_pass: "On Pass",
  overdue: "Overdue",
};

export const InitiatePassModal = ({
  open,
  onClose,
  personnelId,
  personnelName,
}: Props) => {
  const dispatch = useAppDispatch();
  const [initiatePass, { isLoading }] = useInitiatePassMutation();
  const [uploadAttachment, { isLoading: isUploading }] = useUploadPassAttachmentMutation();
  const fieldsRef = useRef<PassApplicationFieldsHandle>(null);
  const { data: formOptions } = useGetPassFormOptionsQuery(undefined, { skip: !open });
  const officersViaWorkflow = formOptions?.officers_via_workflow ?? false;
  const [application, setApplication] = useState<PassFormValues>(emptyPassForm);
  const [attachment, setAttachment] = useState<File | null>(null);
  const setField = <K extends keyof PassFormValues>(key: K, value: PassFormValues[K]) =>
    setApplication((prev) => ({ ...prev, [key]: value }));
  const { data: allPersonnelData = [] } = useGetPersonnelQuery(
    { units: [], ranks: [], branches: [], specialties: [], status: [], corps: [] },
    { skip: !!personnelId },
  );
  // Expatriates aren't tracked through the pass/leave workflow.
  const allPersonnel = useMemo(
    () => allPersonnelData.filter((p) => !p.is_expatriate),
    [allPersonnelData],
  );

  const [form, setForm] = useState({
    personnel_id: personnelId ? String(personnelId) : "",
    start_date: "",
    end_date: "",
    status: "pending" as PassRecordStatus,
    remarks: "",
  });

  useEffect(() => {
    if (personnelId) setForm((f) => ({ ...f, personnel_id: String(personnelId) }));
  }, [personnelId]);

  const computedDuration =
    form.start_date && form.end_date
      ? Math.max(
          1,
          Math.round(
            (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) /
              86400000,
          ) + 1,
        )
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id || !form.start_date || !form.end_date) return;

    try {
      const saved = await initiatePass({
        ...(officersViaWorkflow ? withoutOfficerFields(passFormPayload(application)) : passFormPayload(application)),
        ...fieldsRef.current?.collectSignatures(),
        personnel_id: Number(form.personnel_id),
        start_date: form.start_date,
        end_date: form.end_date,
        duration: computedDuration ?? undefined,
        status: form.status,
        remarks: form.remarks || null,
      }).unwrap();

      if (attachment) {
        try {
          await uploadAttachment({ id: saved.id, file: attachment }).unwrap();
        } catch {
          dispatch(showToast({ message: "Pass saved, but the attachment couldn't be uploaded. Add it from the pass's page.", type: "error" }));
        }
      }

      dispatch(showToast({ message: "Pass initiated successfully", type: "success" }));
      setApplication(emptyPassForm());
      setAttachment(null);
      setForm({
        personnel_id: personnelId ? String(personnelId) : "",
        start_date: "",
        end_date: "",
        status: "pending",
        remarks: "",
      });
      onClose();
    } catch (err) {
      const data = (err as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
      const message = (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Failed to initiate pass";
      dispatch(showToast({ message, type: "error" }));
    }
  };

  const selectedPersonnel = personnelId
    ? null
    : allPersonnel.find((p) => String(p.id) === form.personnel_id);

  return (
    <Modal open={open} onClose={onClose} title="Leave / Pass Application" className="max-w-3xl! max-h-[92vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {/* Personnel selector — hidden when personnelId is pre-set */}
        {!personnelId && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Personnel</label>
            <select
              value={form.personnel_id}
              onChange={(e) => {
                const id = e.target.value;
                setForm((f) => ({ ...f, personnel_id: id }));
                // Prefill from the personnel record; anything already typed stays.
                const person = allPersonnel.find((p) => String(p.id) === id);
                if (person) {
                  setApplication((a) => ({
                    ...a,
                    place_of_deployment: a.place_of_deployment || person.unit?.name || "",
                    contact_phone: a.contact_phone || person.phone_number || "",
                    contact_address: a.contact_address || person.address || "",
                  }));
                }
              }}
              required
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            >
              <option value="">Select personnel...</option>
              {allPersonnel.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstname} {p.lastname} — {p.rank?.name ?? ""}
                  {p.pass_status
                    ? ` (${passStatusLabels[p.pass_status] ?? p.pass_status})`
                    : ""}
                </option>
              ))}
            </select>
            {selectedPersonnel?.pass_status && (
              <p
                className={cn(
                  "mt-1 text-xs",
                  passStatusColors[selectedPersonnel.pass_status] ?? "text-gray-400",
                )}
              >
                Current status:{" "}
                {passStatusLabels[selectedPersonnel.pass_status] ??
                  selectedPersonnel.pass_status}
              </p>
            )}
          </div>
        )}

        {personnelId && personnelName && (
          <div className="rounded border border-[#0A4D66]/40 bg-[#001825]/60 px-3 py-2 text-sm text-white">
            <span className="text-gray-400 text-xs">Personnel: </span>
            {personnelName}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1"><span className="font-semibold text-[#7FD5FF] mr-1">9.</span>Effective date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              required
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ends</label>
            <input
              type="date"
              value={form.end_date}
              min={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              required
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            />
          </div>
        </div>

        {computedDuration !== null && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Icon icon="mdi:calendar-range" className="w-4 h-4" />
            <span><span className="font-semibold text-[#7FD5FF] mr-1">8.</span>Number of days required: <strong className="text-white">{computedDuration} day{computedDuration !== 1 ? "s" : ""}</strong></span>
          </div>
        )}

        <PassApplicationFields
          ref={fieldsRef}
          values={application}
          onChange={setField}
          officersViaWorkflow={officersViaWorkflow}
          attachment={<PassAttachmentInput file={attachment} onFile={setAttachment} />}
        />

        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as PassRecordStatus }))
            }
            className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Remarks</label>
          <textarea
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            rows={3}
            placeholder="Optional remarks..."
            className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || isUploading}
            className="px-4 py-2 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90 disabled:opacity-50"
          >
            {isLoading ? "Submitting..." : "Initiate Pass"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
