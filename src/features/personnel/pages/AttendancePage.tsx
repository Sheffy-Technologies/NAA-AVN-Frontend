import { useMemo, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { PersonnelModuleTabs } from "../components/PersonnelModuleTabs";
import {
  useGetAttendanceQuery,
  useGetTodayAttendanceQuery,
  useDeleteAttendanceMutation,
  type AttendanceStatus,
} from "../attendanceApi";
import { useGetUnitsQuery } from "@/shared/api/units";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

type AttendanceTab = "today" | "history";

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "text-emerald-400 bg-emerald-400/10",
  absent: "text-red-400 bg-red-400/10",
  late: "text-amber-400 bg-amber-400/10",
  half_day: "text-blue-400 bg-blue-400/10",
};

const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: "bg-emerald-400",
  absent: "bg-red-400",
  late: "bg-amber-400",
  half_day: "bg-blue-400",
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
};

const formatTime = (t: string | null) => {
  if (!t) return "—";
  const d = new Date(`1970-01-01T${t}`);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const durationLabel = (mins: number | null) => {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const AttendancePage = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<AttendanceTab>("today");

  // Today filters
  const [todayUnit, setTodayUnit] = useState<number | "">("");

  // History filters
  const [historyUnit, setHistoryUnit] = useState<number | "">("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyStatus, setHistoryStatus] = useState<AttendanceStatus | "">("");
  const [historySearch, setHistorySearch] = useState("");

  const { data: units = [] } = useGetUnitsQuery();

  const { data: todayData, isLoading: isTodayLoading } = useGetTodayAttendanceQuery(
    { unit_id: todayUnit || undefined },
    { skip: activeTab !== "today" },
  );

  const { data: historyData = [], isLoading: isHistoryLoading } = useGetAttendanceQuery(
    {
      unit_id: historyUnit || undefined,
      date_from: historyDateFrom || undefined,
      date_to: historyDateTo || undefined,
      status: historyStatus || undefined,
    },
    { skip: activeTab !== "history" },
  );

  const [deleteAttendance] = useDeleteAttendanceMutation();

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this attendance record?")) return;
    try {
      await deleteAttendance(id).unwrap();
      dispatch(showToast({ message: "Attendance record deleted", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to delete record", type: "error" }));
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyData;
    return historyData.filter((log) => {
      const name = `${log.personnel?.firstname ?? ""} ${log.personnel?.lastname ?? ""}`.toLowerCase();
      const sn = (log.personnel?.service_number ?? "").toLowerCase();
      return name.includes(q) || sn.includes(q);
    });
  }, [historyData, historySearch]);

  const exportCsv = (rows: typeof historyData) => {
    const headers = ["Date", "Personnel", "Service No", "Rank", "Clock In", "Clock Out", "Duration", "Status", "In Range"];
    const lines = rows.map((r) => [
      r.date,
      `${r.personnel?.firstname ?? ""} ${r.personnel?.lastname ?? ""}`.trim(),
      r.personnel?.service_number ?? "",
      r.personnel?.rank?.name ?? "",
      r.clock_in ?? "",
      r.clock_out ?? "",
      durationLabel(r.duration_minutes),
      r.status,
      r.is_within_range ? "Yes" : "No",
    ]);
    const csv = [headers, ...lines].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <PersonnelModuleTabs />

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
            Attendance
          </h2>
          {activeTab === "history" && (
            <button
              type="button"
              onClick={() => exportCsv(filteredHistory)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0A4D66]/40 text-xs text-gray-200 hover:bg-[#0A4D66]/30"
            >
              <Icon icon="mdi:download-outline" className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>

        {/* Summary cards (today only) */}
        {activeTab === "today" && todayData && (
          <div className="grid grid-cols-3 divide-x divide-[#0A4D66]/40 border-b border-[#0A4D66]/40">
            {[
              { label: "Present", value: todayData.summary.present_count, color: "text-emerald-400" },
              { label: "Absent", value: todayData.summary.absent_count, color: "text-red-400" },
              { label: "Clocked Out", value: todayData.summary.clocked_out, color: "text-gray-300" },
            ].map((s) => (
              <div key={s.label} className="px-4 sm:px-6 py-3 text-center">
                <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                <div className="text-[11px] text-gray-400 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Inner tabs */}
        <div className="flex items-center gap-1 border-b border-[#0A4D66]/40 px-4 sm:px-6">
          {(["today", "history"] as AttendanceTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors capitalize",
                activeTab === tab
                  ? "border-[#7FD5FF] text-white"
                  : "border-transparent text-gray-400 hover:text-gray-200",
              )}
            >
              {tab === "today" ? "Today" : "History"}
            </button>
          ))}
        </div>

        {/* ── Today Tab ─────────────────────────────────────── */}
        {activeTab === "today" && (
          <>
            <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
              <SearchableSelect
                placeholder="All Units"
                searchPlaceholder="Search unit..."
                buttonClassName="py-1.5 px-2 text-xs"
                className="w-36"
                options={units.map((u) => ({ value: u.id, label: u.name }))}
                value={todayUnit || null}
                onChange={(value) =>
                  setTodayUnit(value === null ? "" : Number(value))
                }
              />
              {todayData && (
                <span className="text-[11px] text-gray-500">
                  {todayData.date}
                </span>
              )}
            </div>

            {isTodayLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
                <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                {/* Present */}
                <div className="px-4 sm:px-6 pt-4 pb-2 text-[11px] uppercase tracking-wide text-emerald-400 font-semibold">
                  Present ({todayData?.present.length ?? 0})
                </div>
                <table className="min-w-max w-full text-xs text-gray-200 whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
                      <th className="px-4 sm:px-6 py-2.5 text-left">Personnel</th>
                      <th className="px-4 py-2.5 text-left">Service No.</th>
                      <th className="px-4 py-2.5 text-left">Rank</th>
                      <th className="px-4 py-2.5 text-left">Unit</th>
                      <th className="px-4 py-2.5 text-left">Clock In</th>
                      <th className="px-4 py-2.5 text-left">Clock Out</th>
                      <th className="px-4 py-2.5 text-left">Duration</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-left">In Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(todayData?.present ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 text-center text-gray-500">No present records.</td>
                      </tr>
                    ) : (
                      (todayData?.present ?? []).map((log, i) => (
                        <tr
                          key={log.id}
                          className={cn("border-t border-[#0A4D66]/40", i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]")}
                        >
                          <td className="px-4 sm:px-6 py-3 text-white">
                            {log.personnel ? `${log.personnel.firstname} ${log.personnel.lastname}` : "—"}
                          </td>
                          <td className="px-4 py-3">{log.personnel?.service_number ?? "—"}</td>
                          <td className="px-4 py-3">{log.personnel?.rank?.name ?? "—"}</td>
                          <td className="px-4 py-3">{log.personnel?.unit?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-emerald-400">{formatTime(log.clock_in)}</td>
                          <td className="px-4 py-3 text-red-400">{formatTime(log.clock_out)}</td>
                          <td className="px-4 py-3">{durationLabel(log.duration_minutes)}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
                              STATUS_COLORS[log.status] ?? "text-gray-400 bg-gray-400/10",
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[log.status] ?? "bg-gray-400")} />
                              {STATUS_LABELS[log.status] ?? log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {log.is_within_range ? (
                              <Icon icon="mdi:check-circle-outline" className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Icon icon="mdi:map-marker-off-outline" className="w-4 h-4 text-amber-400" />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Absent */}
                <div className="px-4 sm:px-6 pt-5 pb-2 text-[11px] uppercase tracking-wide text-red-400 font-semibold">
                  Absent ({todayData?.absent.length ?? 0})
                </div>
                <table className="min-w-max w-full text-xs text-gray-200 whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
                      <th className="px-4 sm:px-6 py-2.5 text-left">Personnel</th>
                      <th className="px-4 py-2.5 text-left">Service No.</th>
                      <th className="px-4 py-2.5 text-left">Rank</th>
                      <th className="px-4 py-2.5 text-left">Unit</th>
                      <th className="px-4 py-2.5 text-left">Pass Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(todayData?.absent ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">All personnel clocked in.</td>
                      </tr>
                    ) : (
                      (todayData?.absent ?? []).map((p, i) => (
                        <tr
                          key={p.id}
                          className={cn("border-t border-[#0A4D66]/40", i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]")}
                        >
                          <td className="px-4 sm:px-6 py-3 text-white">{p.firstname} {p.lastname}</td>
                          <td className="px-4 py-3">{p.service_number}</td>
                          <td className="px-4 py-3">{p.rank?.name ?? "—"}</td>
                          <td className="px-4 py-3">{p.unit?.name ?? "—"}</td>
                          <td className="px-4 py-3">
                            {p.pass_status ? (
                              <span className="text-amber-400 capitalize">{p.pass_status.replace(/_/g, " ")}</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── History Tab ────────────────────────────────────── */}
        {activeTab === "history" && (
          <>
            <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
              <div className="relative flex-1 min-w-48 max-w-xs">
                <Icon
                  icon="mdi:magnify"
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by personnel..."
                  className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40"
                />
              </div>

              <SearchableSelect
                placeholder="All Units"
                searchPlaceholder="Search unit..."
                buttonClassName="py-1.5 px-2 text-xs"
                className="w-36"
                options={units.map((u) => ({ value: u.id, label: u.name }))}
                value={historyUnit || null}
                onChange={(value) =>
                  setHistoryUnit(value === null ? "" : Number(value))
                }
              />

              <select
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value as AttendanceStatus | "")}
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">All Status</option>
                {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>

              <input
                type="date"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
                title="From date"
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              />
              <input
                type="date"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
                title="To date"
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto pb-2">
              <table className="min-w-max w-full text-xs text-gray-200 whitespace-nowrap">
                <thead>
                  <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
                    <th className="px-4 sm:px-6 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Personnel</th>
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">Clock In</th>
                    <th className="px-4 py-3 text-left">Clock Out</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">In Range</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isHistoryLoading ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-gray-400">
                        <div className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-gray-500">No records found.</td>
                    </tr>
                  ) : (
                    filteredHistory.map((log, i) => (
                      <tr
                        key={log.id}
                        className={cn("border-t border-[#0A4D66]/40", i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]")}
                      >
                        <td className="px-4 sm:px-6 py-3 text-white">{formatDate(log.date)}</td>
                        <td className="px-4 py-3 text-white">
                          {log.personnel ? `${log.personnel.firstname} ${log.personnel.lastname}` : "—"}
                        </td>
                        <td className="px-4 py-3">{log.personnel?.rank?.name ?? "—"}</td>
                        <td className="px-4 py-3">{log.personnel?.unit?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-emerald-400">{formatTime(log.clock_in)}</td>
                        <td className="px-4 py-3 text-red-400">{formatTime(log.clock_out)}</td>
                        <td className="px-4 py-3">{durationLabel(log.duration_minutes)}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
                            STATUS_COLORS[log.status] ?? "text-gray-400 bg-gray-400/10",
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[log.status] ?? "bg-gray-400")} />
                            {STATUS_LABELS[log.status] ?? log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.is_within_range ? (
                            <Icon icon="mdi:check-circle-outline" className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Icon icon="mdi:map-marker-off-outline" className="w-4 h-4 text-amber-400" />
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
                            title="Delete record"
                            className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-red-900/40 text-red-400"
                          >
                            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
