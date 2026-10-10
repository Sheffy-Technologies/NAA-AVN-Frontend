import { useEffect, useState } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { Icon } from "@/shared/icons/Icon";
import { useUpdateCourseMutation, type Course, type CourseStatus } from "../courseApi";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

type Props = {
  course: Course | null;
  onClose: () => void;
};

const statusOptions: { value: CourseStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const EditCourseModal = ({ course, onClose }: Props) => {
  const dispatch = useAppDispatch();
  const [updateCourse, { isLoading }] = useUpdateCourseMutation();

  const [form, setForm] = useState({
    title: "",
    institution: "",
    location: "",
    start_date: "",
    end_date: "",
    status: "scheduled" as CourseStatus,
    remarks: "",
  });

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title,
        institution: course.institution ?? "",
        location: course.location ?? "",
        start_date: course.start_date?.slice(0, 10) ?? "",
        end_date: course.end_date?.slice(0, 10) ?? "",
        status: course.status,
        remarks: course.remarks ?? "",
      });
    }
  }, [course]);

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
    if (!course || !form.title || !form.start_date || !form.end_date) return;

    try {
      await updateCourse({
        id: course.id,
        data: {
          title: form.title,
          institution: form.institution || null,
          location: form.location || null,
          start_date: form.start_date,
          end_date: form.end_date,
          status: form.status,
          remarks: form.remarks || null,
        },
      }).unwrap();

      dispatch(showToast({ message: "Course updated successfully", type: "success" }));
      onClose();
    } catch {
      dispatch(showToast({ message: "Failed to update course", type: "error" }));
    }
  };

  const personnelName = course?.personnel
    ? `${course.personnel.firstname} ${course.personnel.lastname}`
    : null;

  return (
    <Modal open={!!course} onClose={onClose} title="Edit Course" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {personnelName && (
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
            className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Institution</label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
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

        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CourseStatus }))}
            className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {form.status === "cancelled" && (
            <p className="mt-1 text-xs text-amber-400">
              Cancelling will also decline the linked pass/leave record.
            </p>
          )}
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
