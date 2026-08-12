import { useEffect, useState } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { Icon } from "@/shared/icons/Icon";
import { useUpdatePassMutation, type Pass, type PassRecordStatus } from "../passApi";
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
          start_date: form.start_date,
          end_date: form.end_date,
          duration: computedDuration ?? undefined,
          status: form.status,
          remarks: form.remarks || null,
        },
      }).unwrap();

      dispatch(showToast({ message: "Pass updated successfully", type: "success" }));
      onClose();
    } catch {
      dispatch(showToast({ message: "Failed to update pass", type: "error" }));
    }
  };

  const personnelName = pass?.personnel
    ? `${pass.personnel.firstname} ${pass.personnel.lastname}`
    : null;

  return (
    <Modal open={!!pass} onClose={onClose} title="Edit Pass" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {personnelName && (
          <div className="rounded border border-[#0A4D66]/40 bg-[#001825]/60 px-3 py-2 text-sm text-white">
            <span className="text-gray-400 text-xs">Personnel: </span>
            {personnelName}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              required
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">End Date</label>
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
              Duration:{" "}
              <strong className="text-white">
                {computedDuration} day{computedDuration !== 1 ? "s" : ""}
              </strong>
            </span>
          </div>
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
            className="px-4 py-2 rounded border border-[#0A4D66]/40 text-xs text-gray-300 hover:bg-[#0A4D66]/20"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90 disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
