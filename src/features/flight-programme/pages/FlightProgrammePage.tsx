import { useMemo, useState, type ChangeEvent } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetAircraftQuery,
  type FinanceAircraft,
} from "@/features/finance/api";
import {
  useGetFlightProgramsQuery,
  type DashboardHomeFlightProgram,
} from "@/features/dashboard/api";

type FlightResourceStatus = "Serviceable" | "Grounded";

type FlightResource = {
  id: number;
  name: string;
  code: string;
  status: FlightResourceStatus;
  hours: number;
};

type FlightEvent = {
  id: number;
  resourceId: number;
  label: string;
  startHour: number;
  endHour: number;
  color: string;
};

const parseHour = (dateTime: string): number | null => {
  const [, timePart] = dateTime.split(" ");
  if (!timePart) {
    return null;
  }
  const [hourStr] = timePart.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return null;
  return hour;
};

const formatProgrammeLabel = (program: DashboardHomeFlightProgram) => {
  if (program?.pilot?.call_sign) {
    return program?.pilot?.call_sign;
  }

  const name =
    `${program?.pilot?.firstname || ""} ${program?.pilot?.lastname || ""}`.trim();
  if (name.length > 0) {
    return name;
  }

  return program.name;
};

export const FlightProgrammePage = () => {
  const { data: aircraftData, isLoading: isAircraftLoading } =
    useGetAircraftQuery();
  const { data: flightProgramsData, isLoading: isProgramsLoading } =
    useGetFlightProgramsQuery();

  const [openProgramId, setOpenProgramId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const resources: FlightResource[] = useMemo(() => {
    if (!aircraftData) return [];

    return (aircraftData as FinanceAircraft[]).map((aircraft) => {
      const status: FlightResourceStatus =
        aircraft.serviceability_status.toLowerCase() === "serviceable"
          ? "Serviceable"
          : "Grounded";

      const hours = Number.parseFloat(aircraft.total_flight_hours);

      return {
        id: aircraft.id,
        name: aircraft.name,
        code: aircraft.tail_number,
        status,
        hours: Number.isFinite(hours) ? hours : 0,
      };
    });
  }, [aircraftData]);

  const selectedDateKey = useMemo(
    () => selectedDate.toISOString().slice(0, 10),
    [selectedDate],
  );

  const flightPrograms: DashboardHomeFlightProgram[] = useMemo(() => {
    if (!flightProgramsData) return [];

    return flightProgramsData.filter((program) => {
      const [datePart] = program.start_time.split(" ");
      return datePart === selectedDateKey;
    });
  }, [flightProgramsData, selectedDateKey]);

  const timelineHours = useMemo(() => {
    const hours: number[] = [];

    flightPrograms.forEach((program) => {
      const start = parseHour(program.start_time);
      const end = parseHour(program.end_time);
      if (start !== null) {
        hours.push(start);
      }
      if (end !== null) {
        hours.push(end);
      }
    });

    if (hours.length === 0) {
      return Array.from({ length: 13 }, (_, i) => 6 + i);
    }

    const rawMin = Math.min(...hours);
    const rawMax = Math.max(...hours);

    const minHour = Math.max(0, Math.min(23, rawMin));
    const maxHour = Math.max(minHour + 1, Math.min(23, rawMax));

    return Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
  }, [flightPrograms]);

  const events: FlightEvent[] = useMemo(() => {
    if (!resources.length || !flightPrograms.length || !timelineHours.length) {
      return [];
    }

    const startTimeline = timelineHours[0];
    const endTimeline = timelineHours[timelineHours.length - 1];

    const colors = ["#2ecc71", "#f1c40f", "#ff9f43", "#74b9ff"];

    return flightPrograms.map((program, index) => {
      const rawStart = parseHour(program.start_time);
      const rawEnd = parseHour(program.end_time);

      let startHour =
        rawStart !== null ? rawStart : Math.max(startTimeline, endTimeline - 3);
      let endHour =
        rawEnd !== null ? rawEnd : Math.min(startHour + 3, endTimeline);

      if (startHour < startTimeline) startHour = startTimeline;
      if (startHour > endTimeline) startHour = endTimeline;

      if (endHour <= startHour) {
        endHour = Math.min(startHour + 1, endTimeline);
      }

      const resource = resources[index % resources.length];

      return {
        id: program.id,
        resourceId: resource.id,
        label: formatProgrammeLabel(program),
        startHour,
        endHour,
        color: colors[index % colors.length],
      };
    });
  }, [resources, flightPrograms, timelineHours]);

  const programmeMap = useMemo(() => {
    const map = new Map<number, DashboardHomeFlightProgram>();
    flightPrograms.forEach((program) => {
      map.set(program.id, program);
    });
    return map;
  }, [flightPrograms]);

  const headerDateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [selectedDate],
  );

  const isLoading = isAircraftLoading || isProgramsLoading;

  const handleChangeDate = (newDate: Date) => {
    setOpenProgramId(null);
    setSelectedDate(newDate);
  };

  const handlePrevDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() - 1);
    handleChangeDate(next);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    handleChangeDate(next);
  };

  const handleDateInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!value) return;
    const picked = new Date(value);
    if (Number.isNaN(picked.getTime())) return;
    handleChangeDate(picked);
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-base sm:text-lg font-semibold text-white">
            Flight Programme
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-400">
            {headerDateLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-300">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27]"
          >
            <Icon icon="mdi:refresh" className="w-4 h-4" />
            <span>Reset Filter</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27]"
          >
            All Units
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27]"
          >
            All Priority
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27]"
          >
            All Operations
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black font-medium"
          >
            <Icon icon="mdi:plus" className="w-4 h-4" />
            <span>Add Flight</span>
          </button>
        </div>
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden min-h-[420px]">
        <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-200">
            <button
              type="button"
              onClick={handlePrevDay}
              className="inline-flex items-center justify-center w-6 h-6 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30"
            >
              <Icon icon="mdi:chevron-left" className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 font-semibold tracking-wide uppercase relative"
            >
              <Icon
                icon="mdi:calendar-month-outline"
                className="w-4 h-4 text-cyan-300"
              />
              <span>{headerDateLabel}</span>
              <input
                type="date"
                value={selectedDate.toISOString().slice(0, 10)}
                onChange={handleDateInputChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="inline-flex items-center justify-center w-6 h-6 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30"
            >
              <Icon icon="mdi:chevron-right" className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <button className="px-2 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30">
              Day
            </button>
            <button className="px-2 py-1 rounded border border-transparent text-gray-500">
              Week
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row h-full">
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#0A4D66]/40 overflow-y-auto">
            <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-gray-400">
                Aircraft List
              </p>
            </div>
            <div className="divide-y divide-[#0A4D66]/30">
              {isLoading && !resources.length && (
                <div className="px-4 py-3 text-[11px] text-gray-400">
                  Loading aircraft...
                </div>
              )}
              {!isLoading && resources.length === 0 && (
                <div className="px-4 py-3 text-[11px] text-gray-400">
                  No aircraft available.
                </div>
              )}
              {resources.map((res) => (
                <div key={res.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
                    <Icon
                      icon="mdi:airplane"
                      className="w-5 h-5 text-cyan-300"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white">
                      {res.name}
                    </p>
                    <p className="text-[11px] text-gray-400">{res.code}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          res.status === "Serviceable"
                            ? "bg-emerald-400"
                            : "bg-red-500",
                        )}
                      />
                      {res.status} • {res.hours.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[640px] h-full">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `80px repeat(${timelineHours.length}, 1fr)`,
                }}
              >
                <div className="bg-[#021a27] border-b border-[#0A4D66]/40" />
                {timelineHours.map((h) => (
                  <div
                    key={h}
                    className="bg-[#021a27] border-b border-l border-[#0A4D66]/40 text-[11px] text-gray-400 flex items-center justify-center"
                  >
                    {h.toString().padStart(2, "0")}:00
                  </div>
                ))}

                {resources.map((res) => (
                  <div key={res.id} className="contents">
                    <div className="border-b border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-gray-300" />
                    {timelineHours.map((h) => (
                      <div
                        key={`${res.id}-${h}`}
                        className="border-b border-l border-[#0A4D66]/40 bg-[#001219]"
                      />
                    ))}

                    {events
                      .filter((ev) => ev.resourceId === res.id)
                      .map((ev) => {
                        const startIndex = timelineHours.indexOf(ev.startHour);
                        const endIndex = timelineHours.indexOf(ev.endHour);
                        if (
                          startIndex === -1 ||
                          endIndex === -1 ||
                          endIndex <= startIndex
                        ) {
                          return null;
                        }
                        const colStart = startIndex + 2;
                        const colEnd = endIndex + 2;
                        const program = programmeMap.get(ev.id);

                        return (
                          <div
                            key={ev.id}
                            className="row-start-auto h-8 mt-1 flex items-center relative"
                            style={{
                              gridColumnStart: colStart,
                              gridColumnEnd: colEnd,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOpenProgramId((current) =>
                                  current === ev.id ? null : ev.id,
                                )
                              }
                              className="h-full w-full"
                            >
                              <div
                                className="h-full rounded text-[11px] px-3 flex items-center text-[#021019] font-medium overflow-hidden whitespace-nowrap text-ellipsis"
                                style={{ backgroundColor: ev.color }}
                              >
                                {ev.label}
                              </div>
                            </button>

                            {openProgramId === ev.id && program && (
                              <div className="absolute left-0 top-9 z-20 w-80 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl text-xs text-gray-200">
                                <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-[11px] text-gray-400">
                                      {program.unit.name}
                                    </p>
                                    <p className="text-sm font-semibold text-white">
                                      {program.name}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-300">
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[#021a27]"
                                    >
                                      <Icon
                                        icon="mdi:download-outline"
                                        className="w-4 h-4"
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[#021a27]"
                                    >
                                      <Icon
                                        icon="mdi:printer-outline"
                                        className="w-4 h-4"
                                      />
                                    </button>
                                  </div>
                                </div>
                                <div className="px-4 py-3 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-400">
                                      Purpose:
                                    </span>
                                    <span className="font-semibold">
                                      {program.flight_program_type.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-400">Unit:</span>
                                    <span className="font-semibold">
                                      {program.unit.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-400">
                                      Pilot:
                                    </span>
                                    <span className="font-semibold">
                                      {program.pilot.firstname}{" "}
                                      {program.pilot.lastname}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-400">
                                      Total Hours:
                                    </span>
                                    <span className="font-semibold">
                                      {program.total_hours}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-400">
                                      Start Time:
                                    </span>
                                    <span className="font-semibold">
                                      {program.start_time}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-400">
                                      End Time:
                                    </span>
                                    <span className="font-semibold">
                                      {program.end_time}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-400">
                                      Status:
                                    </span>
                                    <span className="font-semibold text-emerald-400">
                                      {program.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
