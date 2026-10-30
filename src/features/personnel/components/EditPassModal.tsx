import { useEffect, useRef, useState } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { Icon } from "@/shared/icons/Icon";
import {
  useDeletePassAttachmentMutation,
  useGetPassFormOptionsQuery,
  useUpdatePassMutation,
  useUploadPassAttachmentMutation,
  type Pass,
  type PassRecordStatus,
} from "../passApi";
import { emptyPassForm, passFormFromPass, passFormPayload, withoutOfficerFields, type PassFormValues } from "../passForm";
import {
  PassApplicationFields,
  PassAttachmentInput,
  type PassApplicationFieldsHandle,
} from "./PassApplicationFields";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

type Props = {
  pass: Pass | null;
  onClose: () => void;
};

const statusOptions: { value: PassRecordStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

export const EditPassModal = ({ pass, onClose }: Props) => {
  const dispatch = useAppDispatch();
  const [updatePass, { isLoading }] = useUpdatePassMutation();
  const [uploadAttachment, { isLoading: isUploading }] = useUploadPassAttachmentMutation();
  const [deleteAttachment] = useDeletePassAttachmentMutation();
  const fieldsRef = useRef<PassApplicationFieldsHandle>(null);
  const { data: formOptions } = useGetPassFormOptionsQuery(undefined, { skip: !pass });
  // A pass already in the workflow stays there even if the workflow is later switched off.
  const officersViaWorkflow = pass?.officers_via_workflow ?? formOptions?.officers_via_workflow ?? false;
  const [application, setApplication] = useState<PassFormValues>(emptyPassForm);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentRemoved, setAttachmentRemoved] = useState(false);
  const setField = <K extends keyof PassFormValues>(key: K, value: PassFormValues[K]) =>
    setApplication((prev) => ({ ...prev, [key]: value }));

  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    status: "pending" as PassRecordStatus,
    remarks: "",
  });

  useEffect(() => {
    if (pass) {
      setForm({
        start_date: pass.start_date?.slice(0, 10) ?? "",
        end_date: pass.end_date?.slice(0, 10) ?? "",
        status: pass.status,
        remarks: pass.remarks ?? "",
      });
      setApplication(passFormFromPass(pass));
      setAttachment(null);
      setAttachmentRemoved(false);
    }
  }, [pass]);

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
    if (!pass || !form.start_date || !form.end_date) return;

    try {
      await updatePass({
        id: pass.id,
        data: {
          ...(officersViaWorkflow ? withoutOfficerFields(passFormPayload(application)) : passFormPayload(application)),
          ...fieldsRef.current?.collectSignatures(),
          start_date: form.start_date,
          end_date: form.end_date,
          duration: computedDuration ?? undefined,
          status: form.status,
          remarks: form.remarks || null,
        },
      }).unwrap();

      if (attachment) {
        try {
          await uploadAttachment({ id: pass.id, file: attachment }).unwrap();
        } catch {
          dispatch(showToast({ message: "Pass saved, but the attachment couldn't be uploaded.", type: "error" }));
        }
      }

      dispatch(showToast({ message: "Pass updated successfully", type: "success" }));
      onClose();
    } catch (err) {
      const data = (err as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
      const message = (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Failed to update pass";
      dispatch(showToast({ message, type: "error" }));
    }
  };

  const personnelName = pass?.personnel
    ? `${pass.personnel.firstname} ${pass.personnel.lastname}`
    : null;

  return (
    <Modal open={!!pass} onClose={onClose} title="Edit Leave / Pass Application" className="max-w-3xl! max-h-[92vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {personnelName && (
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
            <span>
              <span className="font-semibold text-[#7FD5FF] mr-1">8.</span>Number of days required:{" "}
              <strong className="text-white">
                {computedDuration} day{computedDuration !== 1 ? "s" : ""}
              </strong>
            </span>
          </div>
        )}

        {pass && (
          <PassApplicationFields
            key={pass.id}
            ref={fieldsRef}
            values={application}
            onChange={setField}
            passId={pass.id}
            savedSignatures={pass.signatures}
            officersViaWorkflow={officersViaWorkflow}
            attachment={
              <PassAttachmentInput
                file={attachment}
                onFile={setAttachment}
                savedName={pass.has_attachment && !attachmentRemoved ? (pass.attachment_name ?? "Attachment") : null}
                onRemoveSaved={() => {
                  if (!window.confirm("Remove the attached file?")) return;
                  deleteAttachment(pass.id)
                    .unwrap()
                    .then(() => {
                      setAttachmentRemoved(true);
                      dispatch(showToast({ message: "Attachment removed.", type: "success" }));
                    })
                    .catch(() => dispatch(showToast({ message: "The attachment couldn't be removed.", type: "error" })));
                }}
              />
            }
          />
        )}

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
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
