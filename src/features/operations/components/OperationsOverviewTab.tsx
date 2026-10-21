import { useMemo, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useTheme } from "@/context/ThemeContext";
import { MetricCard, type MetricBadgeColor } from "@/shared/ui/metric/MetricCard";
import {
  useGetOperationsQuery,
  useGetOperationCategoriesQuery,
  useGetWeatherBriefingQuery,
} from "../api";
import { useGetAssetsQuery } from "@/features/assets/api";

type OperationsOverviewTabProps = {
  onNavigateTab: (tabId: "overview" | "missions" | "operations", filterStatus?: string) => void;
  onOpenCreateCampaign?: () => void;
};

const parseApiDateTime = (value?: string | null): Date | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(" ") ? trimmed.replace(" ", "T") : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  completed: "bg-emerald-400",
  ongoing: "bg-amber-400 animate-pulse",
  aborted: "bg-red-500",
};

const priorityBadgeStyle: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/40",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

export const OperationsOverviewTab = ({
  onNavigateTab,
  onOpenCreateCampaign,
}: OperationsOverviewTabProps) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Queries
  const { data: operations = [], isLoading: isLoadingOperations } = useGetOperationsQuery();
  const { data: categories = [], isLoading: isLoadingCategories } = useGetOperationCategoriesQuery();
  const { data: aircraftData = [], isLoading: isLoadingAircraft } = useGetAssetsQuery({ type: "aircraft" });
  const { data: weatherBriefing } = useGetWeatherBriefingQuery({
    stations: "DNAA,DNMA,DNKA,DNKN,DNPO",
  });

  // Clock for Military Zulu & Local time
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const zuluTimeStr = useMemo(() => {
    const hours = String(currentTime.getUTCHours()).padStart(2, "0");
    const minutes = String(currentTime.getUTCMinutes()).padStart(2, "0");
    const seconds = String(currentTime.getUTCSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}Z`;
  }, [currentTime]);

  const localTimeStr = useMemo(() => {
    return currentTime.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [currentTime]);

  // Operational metrics
  const ongoingMissions = useMemo(
    () => operations.filter((op) => op.status === "ongoing"),
    [operations],
  );
  const plannedMissions = useMemo(
    () => operations.filter((op) => op.status === "planned"),
    [operations],
  );
  const completedMissions = useMemo(
    () => operations.filter((op) => op.status === "completed"),
    [operations],
  );
  const abortedMissions = useMemo(
    () => operations.filter((op) => op.status === "aborted"),
    [operations],
  );

  // Total Flight Hours logged or estimated
  const totalFlightHours = useMemo(() => {
    return operations.reduce((sum, op) => {
      const assigned = op.assets ?? [];
      const opHours = assigned.reduce((subSum, a) => {
        const actual = Number(a.actual_flight_hours || a.flight_hours) || 0;
        const estimated = Number(a.estimated_flight_hours) || 0;
        return subSum + (actual > 0 ? actual : estimated);
      }, 0);
      return sum + opHours;
    }, 0);
  }, [operations]);

  // Fleet Readiness Calculation
  const totalAircraft = aircraftData.length;
  const serviceableAircraft = useMemo(() => {
    return aircraftData.filter(
      (a) =>
        a.serviceability_status === "serviceable" ||
        a.operation_status === "operational" ||
        a.operation_status === "serviceable",
    ).length;
  }, [aircraftData]);

  const readinessPct = totalAircraft > 0 ? Math.round((serviceableAircraft / totalAircraft) * 100) : 0;

  // Active campaigns
  const activeCampaigns = useMemo(() => {
    return categories.filter((cat) => (cat.ongoing_count || 0) > 0 || (cat.planned_count || 0) > 0).length;
  }, [categories]);

  // Primary theater weather
  const weatherStations = useMemo(() => {
    if (!weatherBriefing?.stations) return [];
    return Object.values(weatherBriefing.stations);
  }, [weatherBriefing]);

  const primaryCategory = useMemo(() => {
    if (weatherStations.length === 0) return "VFR";
    const ifrCount = weatherStations.filter((s) => s.flight_category === "IFR" || s.flight_category === "LIFR").length;
    const mvfrCount = weatherStations.filter((s) => s.flight_category === "MVFR").length;
    if (ifrCount > 0) return "IFR";
    if (mvfrCount > 0) return "MVFR";
    return "VFR";
  }, [weatherStations]);

  // Tasked airframes count
  const taskedAircraftCount = useMemo(() => {
    const assignedIds = new Set<number>();
    [...ongoingMissions, ...plannedMissions].forEach((op) => {
      (op.assets ?? []).forEach((a) => {
        if (a.asset_id) assignedIds.add(a.asset_id);
      });
    });
    return assignedIds.size;
  }, [ongoingMissions, plannedMissions]);

  // Filter state for Sortie Board
  const [sortieFilter, setSortieFilter] = useState<"all" | "ongoing" | "planned" | "completed">("all");

  const filteredSorties = useMemo(() => {
    if (sortieFilter === "ongoing") return ongoingMissions;
    if (sortieFilter === "planned") return plannedMissions;
    if (sortieFilter === "completed") return completedMissions;
    return operations;
  }, [sortieFilter, ongoingMissions, plannedMissions, completedMissions, operations]);

  // Core Tactical KPI Cards
  const kpiMetrics = useMemo(
    () => [
      {
        id: "airborne_sorties",
        label: "Airborne Sorties",
        value: isLoadingOperations ? "..." : String(ongoingMissions.length),
        icon: "mdi:airplane-takeoff",
        badge: ongoingMissions.length > 0 ? `${ongoingMissions.length} Active in Flight` : "Ramp Clear",
        badgeColor: (ongoingMissions.length > 0 ? "emerald" : "sky") as MetricBadgeColor,
        onClick: () => onNavigateTab("missions", "ongoing"),
      },
      {
        id: "due_out_sorties",
        label: "Due Out (Planned)",
        value: isLoadingOperations ? "..." : String(plannedMissions.length),
        icon: "mdi:clock-fast",
        badge: `${plannedMissions.length} Scheduled Sorties`,
        badgeColor: "sky" as MetricBadgeColor,
        onClick: () => onNavigateTab("missions", "planned"),
      },
      {
        id: "fleet_availability",
        label: "Fleet Readiness",
        value: isLoadingAircraft ? "..." : `${serviceableAircraft} / ${totalAircraft}`,
        icon: "mdi:shield-airplane",
        badge: `${readinessPct}% Operational`,
        badgeColor: (readinessPct >= 75 ? "teal" : readinessPct >= 50 ? "amber" : "red") as MetricBadgeColor,
        onClick: () =>
          navigate("/dashboard/assets", {
            state: { from: "/dashboard/operations", fromLabel: "Operations Overview" },
          }),
      },
      {
        id: "active_campaigns",
        label: "Active Operations",
        value: isLoadingCategories ? "..." : String(categories.length),
        icon: "mdi:shield-cross-outline",
        badge: `${activeCampaigns} Theaters`,
        badgeColor: "indigo" as MetricBadgeColor,
        onClick: () => onNavigateTab("operations"),
      },
      {
        id: "missions_completed",
        label: "Sorties Completed",
        value: isLoadingOperations ? "..." : String(completedMissions.length),
        icon: "mdi:check-decagram-outline",
        badge: "Airspace Missions Logged",
        badgeColor: "blue" as MetricBadgeColor,
        onClick: () => onNavigateTab("missions", "completed"),
      },
      {
        id: "aborted_sorties",
        label: "Aborted / Needs Review",
        value: isLoadingOperations ? "..." : String(abortedMissions.length),
        icon: "mdi:alert-octagon-outline",
        badge: abortedMissions.length > 0 ? "Requires Debrief" : "Nominal",
        badgeColor: (abortedMissions.length > 0 ? "red" : "emerald") as MetricBadgeColor,
        onClick: () => onNavigateTab("missions", "aborted"),
      },
      {
        id: "total_flight_hours",
        label: "Total Flight Hours",
        value: `${totalFlightHours.toFixed(1)} hrs`,
        icon: "mdi:timer-outline",
        badge: "Aggregated Sortie Time",
        badgeColor: "purple" as MetricBadgeColor,
      },
      {
        id: "theater_weather",
        label: "Theater Weather Rules",
        value: primaryCategory,
        icon: "mdi:weather-partly-cloudy",
        badge: `${weatherStations.length} Bases Monitored`,
        badgeColor: (primaryCategory === "VFR" ? "emerald" : primaryCategory === "MVFR" ? "amber" : "red") as MetricBadgeColor,
      },
    ],
    [
      ongoingMissions.length,
      plannedMissions.length,
      serviceableAircraft,
      totalAircraft,
      readinessPct,
      categories.length,
      activeCampaigns,
      completedMissions.length,
      abortedMissions.length,
      totalFlightHours,
      primaryCategory,
      weatherStations.length,
      isLoadingOperations,
      isLoadingAircraft,
      isLoadingCategories,
      onNavigateTab,
      navigate,
    ],
  );

  // Watchkeeping Alerts
  const watchkeepingAlerts = useMemo(() => {
    const list: Array<{ id: string; type: "critical" | "warning" | "info"; title: string; desc: string }> = [];

    // Check for ongoing missions without assigned pilots
    operations.forEach((op) => {
      const assigned = op.assets ?? [];
      const hasUnassignedCrew = assigned.some((a) => !a.pilot_id);
      if (hasUnassignedCrew && (op.status === "ongoing" || op.status === "planned")) {
        list.push({
          id: `crew-${op.id}`,
          type: "warning",
          title: `Incomplete Flight Crew: ${op.name}`,
          desc: `Mission "${op.name}" has aircraft assigned without an identified Pilot in Command.`,
        });
      }

      // Check for overdue planned sorties
      if (op.status === "planned" && op.start_date_time) {
        const startDate = parseApiDateTime(op.start_date_time);
        if (startDate && startDate < new Date()) {
          list.push({
            id: `overdue-${op.id}`,
            type: "critical",
            title: `Planned Sortie Past Departure: ${op.name}`,
            desc: `Scheduled departure was ${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Update status to ongoing or completed.`,
          });
        }
      }
    });

    if (weatherBriefing?.flight_schedule?.status === "TODAY_ACTIVE" && primaryCategory === "IFR") {
      list.push({
        id: "weather-ifr",
        type: "warning",
        title: "Instrument Conditions (IFR) in Effect",
        desc: "Low ceilings or degraded visibility reported at monitored airfields. Verify alternate landing grounds.",
      });
    }

    return list;
  }, [operations, weatherBriefing, primaryCategory]);

  return (
    <div className="space-y-6">
      {/* 1. Tactical Command Clock Ribbon & Actions */}
      <div
        className={cn(
          "rounded-xl border p-3.5 sm:p-4 relative overflow-hidden transition-all",
          isDark
            ? "bg-[#001825] border-[#0A4D66]/50 text-white shadow-lg"
            : "bg-white border-slate-200 text-slate-800 shadow-sm",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Clock Strip & Status summary on the left */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={cn(
                "px-3 py-1.5 rounded-lg border text-center",
                isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
              )}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Zulu (UTC)</div>
              <div className="text-sm font-mono font-bold text-[#7FD5FF]">{zuluTimeStr}</div>
            </div>

            <div
              className={cn(
                "px-3 py-1.5 rounded-lg border text-center",
                isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
              )}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Local (WAT)</div>
              <div className="text-sm font-mono font-bold text-white dark:text-gray-200">{localTimeStr}</div>
            </div>

            <div
              className={cn(
                "px-3 py-1.5 rounded-lg border flex items-center gap-2",
                isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
              )}
            >
              <Icon icon="mdi:radar" className="w-5 h-5 text-emerald-400 animate-spin" />
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400">Tasked Assets</div>
                <div className="text-sm font-bold text-emerald-400">{taskedAircraftCount} Airframes</div>
              </div>
            </div>
          </div>

          {/* Action CTAs on the right */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                navigate("/dashboard/operations/add", {
                  state: { from: "/dashboard/operations", fromLabel: "Operations Overview" },
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Plan Mission</span>
            </button>

            {onOpenCreateCampaign && (
              <button
                type="button"
                onClick={onOpenCreateCampaign}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#0A4D66] hover:bg-[#0c5d7a] text-white border border-[#7FD5FF]/30 transition-all shadow-sm"
              >
                <Icon icon="mdi:shield-plus-outline" className="w-4 h-4" />
                <span>New Operation</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                navigate("/dashboard/flight-programme", {
                  state: { from: "/dashboard/operations", fromLabel: "Operations Overview" },
                })
              }
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all",
                isDark
                  ? "bg-[#001219] border-[#0A4D66]/60 text-[#7FD5FF] hover:bg-[#0A4D66]/30"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50",
              )}
            >
              <Icon icon="mdi:calendar-clock" className="w-4 h-4 text-sky-400" />
              <span>Flying Programme</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Performance Indicators Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-600")}>
            Tactical Key Performance Indicators
          </h3>
          <span className={cn("text-[11px]", isDark ? "text-gray-500" : "text-slate-400")}>
            Click any metric to drill down to filtered sorties
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {kpiMetrics.map((item) => (
            <MetricCard
              key={item.id}
              id={item.id}
              label={item.label}
              value={item.value}
              icon={item.icon}
              badge={item.badge}
              badgeColor={item.badgeColor}
              onClick={item.onClick}
            />
          ))}
        </div>
      </div>

      {/* 3. Main Split View Grid: Sortie Board (65%) + Intelligence & FOB Weather (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Section: Tactical Sortie Tasking Board (8 columns on lg) */}
        <div className="lg:col-span-8 space-y-4">
          <div
            className={cn(
              "rounded-xl border overflow-hidden",
              isDark ? "bg-[#001825] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
            )}
          >
            {/* Header with Subtabs */}
            <div className="p-4 border-b border-[#0A4D66]/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:airplane-cog" className="w-5 h-5 text-[#7FD5FF]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white dark:text-white">
                  Active & Scheduled Tactical Sorties
                </h3>
              </div>

              {/* Sortie filter pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#001219] border border-[#0A4D66]/40 text-xs">
                {(
                  [
                    { id: "all", label: `All (${operations.length})` },
                    { id: "ongoing", label: `Airborne (${ongoingMissions.length})` },
                    { id: "planned", label: `Due Out (${plannedMissions.length})` },
                    { id: "completed", label: `Completed (${completedMissions.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSortieFilter(tab.id)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-semibold transition-all",
                      sortieFilter === tab.id
                        ? "bg-[#0A4D66] text-white shadow-sm"
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sortie Cards List */}
            <div className="p-4 space-y-3">
              {filteredSorties.slice(0, 8).map((op) => {
                const isOngoing = op.status === "ongoing";
                const isPlanned = op.status === "planned";
                const isCompleted = op.status === "completed";
                const assignedAsset = op.assets?.[0];
                const pilot = assignedAsset?.pilot_details || assignedAsset?.pilot;
                const coPilot = assignedAsset?.co_pilot_details || assignedAsset?.co_pilot;

                const pilotName = pilot
                  ? `${pilot.rank?.name ? `${pilot.rank.name} ` : ""}${pilot.lastname || ""} ${pilot.firstname || ""}`.trim()
                  : "Unassigned";

                const coPilotName = coPilot
                  ? `${coPilot.rank?.name ? `${coPilot.rank.name} ` : ""}${coPilot.lastname || ""} ${coPilot.firstname || ""}`.trim()
                  : null;

                const startDate = parseApiDateTime(op.start_date_time);
                const endDate = parseApiDateTime(op.end_date_time);

                return (
                  <div
                    key={op.id}
                    tabIndex={0}
                    role="button"
                    title="Click to view sortie details"
                    onClick={(e) =>
                      onInteractiveRowClick(e, () =>
                        navigate(`/dashboard/operations/${op.id}`, {
                          state: { from: "/dashboard/operations", fromLabel: "Operations Overview" },
                        }),
                      )
                    }
                    onKeyDown={(e) =>
                      onInteractiveRowKeyDown(e, () =>
                        navigate(`/dashboard/operations/${op.id}`, {
                          state: { from: "/dashboard/operations", fromLabel: "Operations Overview" },
                        }),
                      )
                    }
                    className={cn(
                      "rounded-lg border p-4 cursor-pointer transition-all hover:border-[#7FD5FF]/60 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                      isDark
                        ? "bg-[#001219] border-[#0A4D66]/40 hover:bg-[#001b2a]"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100",
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#0A4D66]/20 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full", statusDotColor[op.status] || "bg-gray-400")} />
                        <span className="font-bold text-sm text-white">{op.name}</span>
                        {op.operation_category?.name && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#0A4D66]/30 text-[#7FD5FF] border border-[#0A4D66]/60">
                            {op.operation_category.name}
                          </span>
                        )}
                        {op.priority && (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                              priorityBadgeStyle[op.priority.toLowerCase()] || "bg-gray-800 text-gray-300 border-gray-700",
                            )}
                          >
                            {op.priority}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                            isOngoing
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : isPlanned
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              : isCompleted
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-red-500/20 text-red-300 border border-red-500/40",
                          )}
                        >
                          {op.status}
                        </span>
                      </div>
                    </div>

                    {/* Flight Details Matrix */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Assigned Airframe</span>
                        <div className="font-medium text-white flex items-center gap-1 mt-0.5">
                          <Icon icon="mdi:airplane" className="w-3.5 h-3.5 text-sky-400" />
                          <span>{assignedAsset?.tail_number || assignedAsset?.serial_number || "Awaiting Tasking"}</span>
                        </div>
                        {assignedAsset?.model && (
                          <span className="text-[10px] text-gray-400">{assignedAsset.model}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Crew (PIC / Co-Pilot)</span>
                        <div className="font-medium text-white flex items-center gap-1 mt-0.5">
                          <Icon icon="mdi:account-tie" className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="truncate">{pilotName}</span>
                        </div>
                        {coPilotName && (
                          <span className="text-[10px] text-gray-400 block truncate">CP: {coPilotName}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Departure / Schedule</span>
                        <div className="font-medium text-white flex items-center gap-1 mt-0.5">
                          <Icon icon="mdi:clock-outline" className="w-3.5 h-3.5 text-amber-400" />
                          <span>{startDate ? startDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "TBD"}</span>
                        </div>
                        {startDate && (
                          <span className="text-[10px] text-gray-400">
                            {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {endDate && ` - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Operating Unit</span>
                        <div className="font-medium text-[#7FD5FF] flex items-center gap-1 mt-0.5">
                          <Icon icon="mdi:shield-outline" className="w-3.5 h-3.5" />
                          <span className="truncate">{op.unit?.name || "Joint Task Force"}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">{op.operation_type?.name || "Tactical Flight"}</span>
                      </div>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="mt-3 pt-2.5 border-t border-[#0A4D66]/20 flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        {op.description && (
                          <span className="line-clamp-1 text-[11px] text-gray-400 italic">
                            "{op.description}"
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/operations/${op.id}`, {
                              state: { from: "/dashboard/operations", fromLabel: "Operations Overview" },
                            });
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#0A4D66]/40 hover:bg-[#0A4D66] text-[#7FD5FF] hover:text-white transition-colors"
                        >
                          Briefing & NavLog
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/operations/${op.id}/edit`, {
                              state: { from: "/dashboard/operations", fromLabel: "Operations Overview" },
                            });
                          }}
                          className="p-1 rounded text-gray-400 hover:text-amber-300 transition-colors"
                          title="Edit Sortie"
                        >
                          <Icon icon="mdi:pencil-outline" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredSorties.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <Icon icon="mdi:airplane-off" className="w-10 h-10 mx-auto mb-2 text-gray-500" />
                  <p className="text-sm font-semibold">No sorties found for this filter.</p>
                  <button
                    type="button"
                    onClick={() => setSortieFilter("all")}
                    className="mt-2 text-xs text-[#7FD5FF] hover:underline"
                  >
                    View all tactical operations
                  </button>
                </div>
              )}
            </div>

            {filteredSorties.length > 8 && (
              <div className="p-3 bg-[#001219]/60 border-t border-[#0A4D66]/30 text-center">
                <button
                  type="button"
                  onClick={() => onNavigateTab("missions")}
                  className="text-xs font-bold text-[#7FD5FF] hover:underline"
                >
                  View All {filteredSorties.length} Sorties in Tactical Roster &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Airfield Weather & Watchkeeping Alerts (4 columns on lg) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Forward Operating Base METAR Feed */}
          <div
            className={cn(
              "rounded-xl border p-4 space-y-3",
              isDark ? "bg-[#001825] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
            )}
          >
            <div className="flex items-center justify-between border-b border-[#0A4D66]/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:weather-partly-cloudy" className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7FD5FF]">
                  Airfield METAR & Weather Watch
                </h4>
              </div>
              <span className="text-[10px] text-gray-400">NOAA/ICAO Live</span>
            </div>

            <div className="space-y-2.5">
              {weatherStations.map((station) => {
                const category = station.flight_category || "UNKNOWN";
                const isVfr = category === "VFR";
                const isMvfr = category === "MVFR";
                const isIfr = category === "IFR" || category === "LIFR";

                return (
                  <div
                    key={station.icao}
                    className={cn(
                      "p-3 rounded-lg border text-xs transition-colors",
                      isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white text-sm">{station.icao}</span>
                        <span className="text-gray-400 text-[11px] truncate max-w-[130px]">{station.name}</span>
                      </div>

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                          isVfr
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : isMvfr
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : isIfr
                            ? "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-gray-800 text-gray-400 border-gray-700",
                        )}
                      >
                        {category}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] text-gray-300 border-t border-[#0A4D66]/20 pt-1.5">
                      <div>
                        <span className="text-gray-500 block text-[9px] uppercase">Wind</span>
                        <span className="font-mono">{station.wind?.label || "Calm"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[9px] uppercase">Altimeter</span>
                        <span className="font-mono">{station.altimeter_hpa ? `${station.altimeter_hpa} hPa` : "1013"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[9px] uppercase">Temp</span>
                        <span className="font-mono">{station.temperature_c !== null ? `${station.temperature_c}°C` : "-"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {weatherStations.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">
                  <Icon icon="mdi:cloud-question" className="w-6 h-6 mx-auto mb-1 text-gray-500" />
                  Fetching forward airfield telemetry...
                </div>
              )}
            </div>
          </div>

          {/* Watchkeeping Tactical Alerts Feed */}
          <div
            className={cn(
              "rounded-xl border p-4 space-y-3",
              isDark ? "bg-[#001825] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
            )}
          >
            <div className="flex items-center justify-between border-b border-[#0A4D66]/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:shield-alert-outline" className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Watchkeeping Notices ({watchkeepingAlerts.length})
                </h4>
              </div>
              <span className="text-[10px] text-gray-400">TOC Log</span>
            </div>

            <div className="space-y-2.5">
              {watchkeepingAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-lg border text-xs space-y-1",
                    alert.type === "critical"
                      ? "bg-red-500/10 border-red-500/40 text-red-200"
                      : alert.type === "warning"
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                      : "bg-blue-500/10 border-blue-500/40 text-blue-200",
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <Icon
                      icon={
                        alert.type === "critical"
                          ? "mdi:alert-octagon"
                          : alert.type === "warning"
                          ? "mdi:alert-triangle"
                          : "mdi:information-outline"
                      }
                      className="w-4 h-4 shrink-0"
                    />
                    <span>{alert.title}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-300">{alert.desc}</p>
                </div>
              ))}

              {watchkeepingAlerts.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">
                  <Icon icon="mdi:check-circle-outline" className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                  All tactical sorties and airfield watches nominal.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
