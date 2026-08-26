import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { PersonnelModuleTabs } from "../components/PersonnelModuleTabs";
import { RegisterCourseModal } from "../components/RegisterCourseModal";
import { EditCourseModal } from "../components/EditCourseModal";
import {
  useGetCoursesQuery,
  useDeleteCourseMutation,
  type Course,
  type CourseStatus,
} from "../courseApi";
import { useGetPersonnelRanksQuery } from "../api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

const STATUS_COLORS: Record<CourseStatus, string> = {
  scheduled: "text-blue-400",
  ongoing: "text-emerald-400",
  completed: "text-gray-400",
  cancelled: "text-red-400",
};

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const CoursePage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [statusFilter, setStatusFilter] = useState<CourseStatus | "">("");
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [rankFilter, setRankFilter] = useState<number | "">("");
  const [search, setSearch] = useState("");

  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLTableCellElement>(null);
  useClickOutside(actionMenuRef, () => setOpenActionId(null), openActionId !== null);

  const { data: units = [] } = useGetUnitsQuery();
  const { data: ranks = [] } = useGetPersonnelRanksQuery();

  const { data: courses = [], isLoading } = useGetCoursesQuery({
    status: statusFilter || undefined,
    unit_id: unitFilter || undefined,
    rank_id: rankFilter || undefined,
  });

  const [deleteCourse] = useDeleteCourseMutation();

  const handleDeleteCourse = async (id: number) => {
    if (!window.confirm("Delete this course? Its linked pass/leave record will also be removed.")) return;
    try {
      await deleteCourse(id).unwrap();
      dispatch(showToast({ message: "Course deleted", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to delete course", type: "error" }));
    }
  };

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const name = `${c.personnel?.firstname ?? ""} ${c.personnel?.lastname ?? ""}`.toLowerCase();
      return name.includes(q) || c.title.toLowerCase().includes(q);
    });
  }, [courses, search]);

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        {/* Module-level tab bar */}
        <PersonnelModuleTabs />

        {/* Course page header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
            Course Management
          </h2>
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90"
          >
            <Icon icon="mdi:plus" className="w-4 h-4" />
            Register Course
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Icon
              icon="mdi:magnify"
              className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel or course..."
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40"
            />
          </div>

          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value ? Number(e.target.value) : "")}
            className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
          >
            <option value="">All Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value ? Number(e.target.value) : "")}
            className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
          >
            <option value="">All Ranks</option>
            {ranks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CourseStatus | "")}
            className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
          >
            <option value="">All Status</option>
            {(["scheduled", "ongoing", "completed", "cancelled"] as CourseStatus[]).map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Courses Table */}
        <div className="overflow-x-auto pb-2">
          <table className="min-w-max w-full text-xs text-gray-200 whitespace-nowrap">
            <thead>
              <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
                <th className="px-4 sm:px-6 py-3 text-left">Personnel</th>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Institution</th>
                <th className="px-4 py-3 text-left">Start Date</th>
                <th className="px-4 py-3 text-left">End Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                    <div className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No courses found.
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course, i) => (
                  <tr
                    key={course.id}
                    className={cn(
                      "border-t border-[#0A4D66]/40",
                      i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                    )}
                  >
                    <td className="px-4 sm:px-6 py-3 text-white">
                      {course.personnel
                        ? `${course.personnel.firstname} ${course.personnel.lastname}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {course.personnel?.rank?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white">{course.title}</td>
                    <td className="px-4 py-3 text-white">
                      {course.institution ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {formatDate(course.start_date)}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {formatDate(course.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          STATUS_COLORS[course.status],
                        )}
                      >
                        {course.status}
                      </span>
                    </td>
                    <td
                      className="relative px-4 sm:px-6 py-3 text-right"
                      ref={openActionId === course.id ? actionMenuRef : undefined}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenActionId((c) => (c === course.id ? null : course.id))
                        }
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                      >
                        <Icon icon="mdi:dots-vertical" className="w-4 h-4" />
                      </button>
                      {openActionId === course.id && (
                        <div className="absolute right-4 top-9 z-20 w-40 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl">
                          <div className="py-1 text-xs text-gray-200">
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/dashboard/personnel/${course.personnel_id}`);
                                setOpenActionId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                            >
                              <Icon icon="mdi:account-outline" className="w-4 h-4" />
                              View Personnel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCourse(course);
                                setOpenActionId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                            >
                              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleDeleteCourse(course.id);
                                setOpenActionId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400"
                            >
                              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <RegisterCourseModal
        open={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
      />

      <EditCourseModal course={editingCourse} onClose={() => setEditingCourse(null)} />
    </div>
  );
};
