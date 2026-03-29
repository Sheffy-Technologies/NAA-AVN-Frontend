import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useGetOperationsQuery } from "../api";
import { OperationsMapView } from "../components/OperationsMapView";

type ViewMode = "table" | "grid" | "map" | "schedule";

const parseApiDateTime = (value: string): Date | null => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(" ")
    ? trimmed.replace(" ", "T")
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseDateOnly = (value: string): Date | null => {
  const trimmed = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return new Date(year, monthIndex, day);
};

const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addLocalDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  completed: "bg-emerald-400",
  active: "bg-amber-400",
  aborted: "bg-red-500",
};

const priorityTextColor: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-300",
  high: "text-red-400",
};

export const OperationsPage = () => {
  const navigate = useNavigate();
  const { data: operations = [], isLoading } = useGetOperationsQuery();
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [scheduleDate, setScheduleDate] = useState<Date>(() =>
    startOfLocalDay(new Date()),
  );
  const [scheduleDateInput, setScheduleDateInput] =
    useState<HTMLInputElement | null>(null);

  const stats = useMemo(() => {
    return {
      planned: operations.filter((op) => op.status === "planned").length,
      completed: operations.filter((op) => op.status === "completed").length,
      ongoing: operations.filter((op) => op.status === "active").length,
      aborted: operations.filter((op) => op.status === "aborted").length,
    };
  }, [operations]);

  const renderScheduleView = () => {
    const timelineHours = Array.from({ length: 24 }, (_, i) => i);
    const dayStart = startOfLocalDay(scheduleDate);
    const dayEnd = addLocalDays(dayStart, 1);
    const today = startOfLocalDay(new Date());
    const isToday = dayStart.getTime() === today.getTime();
    const timelineColumnWidth = 128;
    const timelineGridStyle = {
      gridTemplateColumns: `repeat(24, ${timelineColumnWidth}px)`,
    };

    const scheduleOperations = operations
      .map((op) => {
        const start = parseApiDateTime(op.start_date_time);
        const end =
          parseApiDateTime(op.end_date_time) ??
          (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
        return { op, start, end };
      })
      .filter(
        ({ start, end }) => start && end && start < dayEnd && end > dayStart,
      )
      .sort((a, b) => (a.start!.getTime() ?? 0) - (b.start!.getTime() ?? 0));

    const headerLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
      .format(dayStart)
      .toUpperCase();

    const scheduleDateValue = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-${String(dayStart.getDate()).padStart(2, "0")}`;

    const formatTime = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);

    return (
      <div className="bg-[#00121a] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <input
          ref={setScheduleDateInput}
          type="date"
          value={scheduleDateValue}
          onChange={(e) => {
            const parsed = parseDateOnly(e.target.value);
            if (!parsed) return;
            setScheduleDate(startOfLocalDay(parsed));
          }}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          tabIndex={-1}
          aria-hidden="true"
        />

        <div
          className="relative overflow-x-auto overscroll-x-contain scroll-smooth"
          style={{
            background:
              "linear-gradient(to right, #001722 0rem, #001722 17rem, transparent 17rem)",
          }}
        >
          <div className="w-max min-w-full">
            <div className="flex border-b border-[#0A4D66]/40">
              <div className="w-68 shrink-0 sticky left-0 z-20 border-r border-[#0A4D66]/40 bg-[#001722] p-3">
                <div className="space-y-2">
                  <div className="flex items-stretch border border-[#0A4D66]/50 bg-[#021420] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        if (!scheduleDateInput) return;
                        const anyInput =
                          scheduleDateInput as HTMLInputElement & {
                            showPicker?: () => void;
                          };
                        if (typeof anyInput.showPicker === "function") {
                          anyInput.showPicker();
                        } else {
                          scheduleDateInput.click();
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 bg-[#021420] px-4 text-left hover:bg-[#08283a] transition-colors"
                    >
                      <Icon
                        icon="mdi:calendar-blank-outline"
                        className="w-4 h-4 shrink-0 text-[#B7E6FF]"
                      />
                      <span className="truncate text-sm font-semibold uppercase tracking-wide text-white">
                        {headerLabel}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setScheduleDate((d) => addLocalDays(d, -1))
                      }
                      className="flex h-12 w-11 items-center justify-center border-l border-[#0A4D66]/50 bg-[#08283a] text-[#B7E6FF] hover:bg-[#0d3951] transition-colors"
                      aria-label="Previous day"
                    >
                      <Icon icon="mdi:chevron-left" className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleDate((d) => addLocalDays(d, 1))}
                      className="flex h-12 w-11 items-center justify-center border-l border-[#0A4D66]/50 bg-[#08283a] text-[#B7E6FF] hover:bg-[#0d3951] transition-colors"
                      aria-label="Next day"
                    >
                      <Icon icon="mdi:chevron-right" className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-wide text-[#9DDCFF]">
                      Selected Date
                    </span>
                    <button
                      type="button"
                      onClick={() => setScheduleDate(today)}
                      disabled={isToday}
                      className={cn(
                        "rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                        isToday
                          ? "border-[#0A4D66]/30 text-gray-500 cursor-default"
                          : "border-[#0A4D66]/50 text-[#B7E6FF] hover:bg-[#08283a]",
                      )}
                    >
                      Today
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid bg-[#001722]" style={timelineGridStyle}>
                {timelineHours.map((h) => (
                  <div
                    key={h}
                    className="flex h-16 items-center justify-center border-l border-[#0A4D66]/40 bg-[#0d4d6b] px-3 text-xs font-medium tracking-wide text-[#D9F3FF]"
                  >
                    {h.toString().padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-100 relative bg-[#001722]">
              {scheduleOperations.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  No operations scheduled for this date.
                </div>
              ) : (
                <>
                  <div className="absolute inset-y-0 left-68 pointer-events-none">
                    <div className="grid h-full" style={timelineGridStyle}>
                      {timelineHours.map((h) => (
                        <div
                          key={h}
                          className="h-full border-l border-[#0A4D66]/30 bg-[#00273a]/35"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="relative z-10 min-h-100 divide-y divide-[#0A4D66]/30">
                    {scheduleOperations.map(({ op, start, end }) => {
                      const safeStart = start!;
                      const safeEnd = end!;
                      const visibleStart =
                        safeStart < dayStart ? dayStart : safeStart;
                      const visibleEnd = safeEnd > dayEnd ? dayEnd : safeEnd;
                      const startMinutes = clamp(
                        Math.round(
                          (visibleStart.getTime() - dayStart.getTime()) / 60000,
                        ),
                        0,
                        1440,
                      );
                      const endMinutes = clamp(
                        Math.round(
                          (visibleEnd.getTime() - dayStart.getTime()) / 60000,
                        ),
                        0,
                        1440,
                      );
                      const leftPct = (startMinutes / 1440) * 100;
                      const widthPct = Math.max(
                        ((endMinutes - startMinutes) / 1440) * 100,
                        0.5,
                      );
                      const barLabel = `${op.name} • ${formatTime(safeStart)} - ${formatTime(safeEnd)}`;

                      return (
                        <div
                          key={op.id}
                          className="flex h-[78px] group relative"
                        >
                          <div className="w-68 shrink-0 sticky left-0 z-20 border-r border-[#0A4D66]/40 bg-[#001722] p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-[#14506d] text-[#B7E6FF]">
                                <Icon
                                  icon={
                                    op.is_flight
                                      ? "mdi:helicopter"
                                      : "mdi:briefcase-outline"
                                  }
                                  className="w-7 h-7"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold uppercase leading-5 text-white">
                                  {op.unit.name}
                                </p>
                                <p className="truncate text-sm font-semibold text-[#9DDCFF]">
                                  {op.name}
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-sm text-white/90">
                                  <span
                                    className={cn(
                                      "h-2.5 w-2.5 rounded-full",
                                      statusDotColor[op.status] ||
                                        "bg-gray-400",
                                    )}
                                  />
                                  <span className="capitalize">
                                    {op.status}
                                  </span>
                                  <span className="text-white/45">•</span>
                                  <span>{op.duration_label}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div
                            className="h-full relative border-b border-[#0A4D66]/20"
                            style={{ width: `${timelineColumnWidth * 24}px` }}
                          >
                            <div
                              className={cn(
                                "absolute left-0 top-1/2 flex h-12 -translate-y-1/2 items-center rounded-sm px-3 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
                                op.status === "completed"
                                  ? "bg-emerald-500"
                                  : op.status === "planned"
                                    ? "bg-blue-500"
                                    : op.status === "aborted"
                                      ? "bg-red-500"
                                      : "bg-amber-500",
                              )}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                              title={barLabel}
                            >
                              <span className="truncate">{barLabel}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => (
    <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-200">
          <thead className="bg-[#021a27] text-gray-400 uppercase text-xs">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Purpose</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Departure</th>
              <th className="text-left px-4 py-3 font-medium">Destination</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op, idx) => (
              <tr
                key={op.id}
                onClick={() => navigate(String(op.id))}
                className={cn(
                  "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors",
                  idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                )}
              >
                <td className="px-6 py-3 font-medium text-white">
                  {op.description}
                </td>
                <td className="px-4 py-3 text-gray-200">{op.name}</td>
                <td className="px-4 py-3 text-gray-200">{op.unit.name}</td>
                <td className="px-4 py-3 text-gray-200">{op.unit.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        statusDotColor[op.status] || "bg-gray-400",
                      )}
                    />
                    <span className="capitalize">{op.status}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-right">
                  <button className="text-gray-400 hover:text-white">
                    <Icon icon="mdi:dots-horizontal" className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {operations.map((op) => (
        <div
          key={op.id}
          onClick={() => navigate(String(op.id))}
          className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-[#7FD5FF]/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{op.unit.name}</p>
              <p className="text-base font-semibold text-white">{op.name}</p>
            </div>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border border-current",
                priorityTextColor[op.priority],
              )}
            >
              {op.priority}
            </span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-2">{op.description}</p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-2 border-t border-[#0A4D66]/20">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  statusDotColor[op.status] || "bg-gray-400",
                )}
              />
              <span className="capitalize">{op.status}</span>
            </div>
            <span>{new Date(op.start_date_time).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#021019] text-gray-200">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-wide">
            OPERATIONS
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search"
                className="bg-[#001219] border border-[#0A4D66]/40 rounded text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:border-cyan-500/50 w-64"
              />
            </div>
            <div className="flex gap-2">
              <button className="relative p-2 text-gray-400 hover:text-white">
                <Icon icon="mdi:bell" className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#001219] p-3 rounded-lg border border-[#0A4D66]/40">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>{" "}
              Planned:{" "}
              <span className="font-bold text-white">{stats.planned}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>{" "}
              Completed:{" "}
              <span className="font-bold text-white">{stats.completed}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>{" "}
              Ongoing:{" "}
              <span className="font-bold text-white">{stats.ongoing}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Aborted:{" "}
              <span className="font-bold text-white">{stats.aborted}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#021a27] rounded-md p-1 flex border border-[#0A4D66]/40">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "table"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:table" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "map"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:map" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("schedule")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "schedule"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:calendar-month" className="w-4 h-4" />
              </button>

              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:view-grid" className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-[#0A4D66]/40 mx-1"></div>

            <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 flex items-center gap-1">
              All Units <Icon icon="mdi:chevron-down" className="w-4 h-4" />
            </button>
            <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 flex items-center gap-1">
              All Priority <Icon icon="mdi:chevron-down" className="w-4 h-4" />
            </button>

            <button className="p-1.5 text-gray-400 hover:text-white">
              <Icon icon="mdi:download" className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate("/dashboard/operations/add")}
              className="bg-[#7FD5FF] text-black text-xs font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              ADD OPERATION
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mr-2" />{" "}
            Loading operations...
          </div>
        ) : (
          <>
            {viewMode === "map" && (
              <OperationsMapView
                operations={operations}
                onSelectOperation={(id) => navigate(String(id))}
              />
            )}
            {viewMode === "schedule" && renderScheduleView()}
            {viewMode === "table" && renderTableView()}
            {viewMode === "grid" && renderGridView()}
          </>
        )}
      </div>
    </div>
  );
};
