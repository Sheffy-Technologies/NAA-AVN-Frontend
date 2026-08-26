import { useEffect, useState } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { Icon } from "@/shared/icons/Icon";
import { useRegisterCourseMutation } from "../courseApi";
import { useGetPersonnelQuery } from "../api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

type Props = {
  open: boolean;
  onClose: () => void;
  personnelId?: number;
  personnelName?: string;
};

export const RegisterCourseModal = ({
  open,
  onClose,
  personnelId,
  personnelName,
}: Props) => {
  const dispatch = useAppDispatch();
  const [registerCourse, { isLoading }] = useRegisterCourseMutation();
  const { data: allPersonnel = [] } = useGetPersonnelQuery(
    { units: [], ranks: [], branches: [], specialties: [], status: [], corps: [] },
    { skip: !!personnelId },
  );

  const [form, setForm] = useState({
    personnel_id: personnelId ? String(personnelId) : "",
    title: "",
    institution: "",
    location: "",
    start_date: "",
    end_date: "",
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

  const resetForm = () =>
    setForm({
      personnel_id: personnelId ? String(personnelId) : "",
      title: "",
      institution: "",
      location: "",
      start_date: "",
      end_date: "",
      remarks: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id || !form.title || !form.start_date || !form.end_date) return;

    try {
      await registerCourse({
        personnel_id: Number(form.personnel_id),
        title: form.title,
        institution: form.institution || null,
        location: form.location || null,
        start_date: form.start_date,
        end_date: form.end_date,
        remarks: form.remarks || null,
      }).unwrap();

      dispatch(
        showToast({
          message: "Course registered — a pass has been created for the duration.",
          type: "success",
        }),
      );
      resetForm();
      onClose();
    } catch {
      dispatch(showToast({ message: "Failed to register course", type: "error" }));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Register Course" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {!personnelId && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Personnel</label>
            <select
              value={form.personnel_id}
              onChange={(e) => setForm((f) => ({ ...f, personnel_id: e.target.value }))}
              required
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            >
              <option value="">Select personnel...</option>
              {allPersonnel.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstname} {p.lastname} — {p.rank?.name ?? ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {personnelId && personnelName && (
          <div className="rounded border border-[#0A4D66]/40 bg-[#001825]/60 px-3 py-2 text-sm text-white">
            <span className="text-gray-400 text-xs">Personnel: </span>
            {personnelName}
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Course Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder="e.g. Instrument Rating Course"
            className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Institution</label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              placeholder="Optional"
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Optional"
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            />
          </div>
        </div>

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

        <div className="rounded border border-[#0369A1]/30 bg-[#0369A1]/10 px-3 py-2 text-xs text-[#B7E6FF] flex items-start gap-2">
          <Icon icon="mdi:information-outline" className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            A pass/leave record will automatically be registered for the personnel
            covering the course dates.
          </span>
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
            {isLoading ? "Registering..." : "Register Course"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
