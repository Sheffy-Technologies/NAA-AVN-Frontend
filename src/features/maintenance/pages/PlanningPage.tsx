import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useGetMaintenanceProgramsQuery, type MaintenanceProgram } from "../api";
import { useGetAtaChaptersQuery, useGetAssetsQuery } from "@/features/assets/api";
import { NumberedPagination } from "@/shared/ui/pagination/NumberedPagination";
import { CreateWorkOrderModal } from "../components/CreateWorkOrderModal";

interface ParsedInterval {
  basis: "all" | "hours" | "calendar" | "cycles" | "conditional" | "other";
  hours: number | null;
  months: number | null;
  cycles: number | null;
  badgeLabel: string;
}

/**
 * Intelligent Aviation Maintenance Interval Extractor:
 * Parses intervals from database fields or aerospace task titles/descriptions
 */
function parseProgramInterval(program: MaintenanceProgram): ParsedInterval {
  const name = program.name || "";
  const desc = program.description || "";
  const combined = `${name} ${desc}`;

  // 1. Direct explicit database columns
  if (program.interval_hours && Number(program.interval_hours) > 0) {
    return {
      basis: "hours",
      hours: Number(program.interval_hours),
      months: null,
      cycles: null,
      badgeLabel: `${program.interval_hours} Flight Hours`,
    };
  }
  if (program.interval_months && Number(program.interval_months) > 0) {
    return {
      basis: "calendar",
      hours: null,
      months: Number(program.interval_months),
      cycles: null,
      badgeLabel: `${program.interval_months} Months Calendar`,
    };
  }
  if (program.interval_cycles && Number(program.interval_cycles) > 0) {
    return {
      basis: "cycles",
      hours: null,
      months: null,
      cycles: Number(program.interval_cycles),
      badgeLabel: `${program.interval_cycles} Operating Cycles`,
    };
  }

  // 2. Pattern extraction from flight hours descriptions (e.g. "Each 25 Hours", "50-Hour", "100-Hr")
  const hoursMatch = combined.match(/(?:each\s+)?(\d+)\s*(?:-| )*(?:hours?|hrs?)\b/i);
  if (hoursMatch) {
    const hrs = parseInt(hoursMatch[1], 10);
    if (!isNaN(hrs) && hrs > 0) {
      return {
        basis: "hours",
        hours: hrs,
        months: null,
        cycles: null,
        badgeLabel: `${hrs} Flight Hours`,
      };
    }
  }

  // 3. Calendar time pattern matching (e.g. "Each 12 Months", "6 Months", "24-Month")
  const monthsMatch = combined.match(/(?:each\s+)?(\d+)\s*(?:-| )*(?:months?|mo\b)/i);
  if (monthsMatch) {
    const mo = parseInt(monthsMatch[1], 10);
    if (!isNaN(mo) && mo > 0) {
      return {
        basis: "calendar",
        hours: null,
        months: mo,
        cycles: null,
        badgeLabel: `${mo} Months Calendar`,
      };
    }
  }

  // 4. Conditional & Event-based inspections
  if (
    /conditional|hard landing|sudden stoppage|overspeed|overtorque|lightning|strike|washing|salt|installation|first flight|event|special inspection/i.test(
      combined
    )
  ) {
    return {
      basis: "conditional",
      hours: null,
      months: null,
      cycles: null,
      badgeLabel: "Conditional / Event-Based",
    };
  }

  if (program.interval_type === "hours") {
    return { basis: "hours", hours: null, months: null, cycles: null, badgeLabel: "Hourly Phase Check" };
  }
  if (program.interval_type === "calendar") {
    return { basis: "calendar", hours: null, months: null, cycles: null, badgeLabel: "Calendar Periodic" };
  }
  if (program.interval_type === "cycles") {
    return { basis: "cycles", hours: null, months: null, cycles: null, badgeLabel: "Cycle Threshold" };
  }

  return {
    basis: "other",
    hours: null,
    months: null,
    cycles: null,
    badgeLabel: "Standard Service Task",
  };
}

/**
 * Clean up legacy encoding artifacts from imported OEM technical manuals
 */
function cleanAviationText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/,Äì/g, "–")
    .replace(/,â§/g, "≤")
    .replace(/Äì/g, "–")
    .replace(/â§/g, "≤")
    .replace(/Â/g, "")
    .trim();
}

export const PlanningPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Queries
  const { data: programs = [], isLoading, refetch } = useGetMaintenanceProgramsQuery();
  const { data: ataChapters = [] } = useGetAtaChaptersQuery();
  const { data: aircraftAssets = [] } = useGetAssetsQuery({ type: "aircraft" });

  // Filter States
  const [search, setSearch] = useState("");
  const [basisFilter, setBasisFilter] = useState<"all" | "hours" | "calendar" | "cycles" | "conditional">("all");
  const [hourFilter, setHourFilter] = useState<number | "all">("all");
  const [applicabilityFilter, setApplicabilityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal State for Planning a Work Order directly from this program
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [selectedAssetForWorkOrder, setSelectedAssetForWorkOrder] = useState<number | null>(null);

  // ATA lookup map
  const ataMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const ch of ataChapters) {
      const code = (ch as any).chapter_number ?? (ch as any).chapter_code ?? "";
      const title = ch.name ?? (ch as any).title ?? "";
      map.set(ch.id, `${code ? `ATA ${code} - ` : ""}${title}`);
    }
    return map;
  }, [ataChapters]);

  // Aircraft lookup map
  const assetMap = useMemo(() => {
    const map = new Map<number, { name: string; tail: string }>();
    for (const a of aircraftAssets) {
      map.set(a.id, {
        name: a.name,
        tail: a.tail_number || "",
      });
    }
    return map;
  }, [aircraftAssets]);

  // Dynamically extract all available flight-hour intervals present in the loaded dataset
  const dynamicHourOptions = useMemo(() => {
    const hoursSet = new Set<number>();
    for (const p of programs) {
      const parsed = parseProgramInterval(p);
      if (parsed.hours && parsed.hours > 0) {
        hoursSet.add(parsed.hours);
      }
    }
    // Sort numerically ascending
    const sorted = Array.from(hoursSet).sort((a, b) => a - b);
    // If empty or small default set, provide standard aviation intervals
    if (sorted.length === 0) {
      return [25, 50, 100, 150, 200, 300, 600];
    }
    return sorted;
  }, [programs]);

  // Metrics summary counts
  const metrics = useMemo(() => {
    let phaseHoursCount = 0;
    let calendarCount = 0;
    let complianceCount = 0;
    let conditionalCount = 0;

    for (const p of programs) {
      const parsed = parseProgramInterval(p);
      if (parsed.basis === "hours") phaseHoursCount++;
      else if (parsed.basis === "calendar") calendarCount++;
      else if (parsed.basis === "conditional") conditionalCount++;

      if (p.category === "airworthiness_directive" || p.category === "service_bulletin") {
        complianceCount++;
      }
    }

    return {
      total: programs.length,
      phaseHoursCount,
      calendarCount,
      complianceCount,
      conditionalCount,
    };
  }, [programs]);

  // Robust Client-side Multi-criteria Filtering
  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();

    return programs.filter((p) => {
      const parsed = parseProgramInterval(p);
      const cleanedName = cleanAviationText(p.name).toLowerCase();
      const cleanedDesc = cleanAviationText(p.description).toLowerCase();
      const ref = (p.reference_number || "").toLowerCase();
      const ataTitle = p.ata_chapter_id ? (ataMap.get(p.ata_chapter_id) || "").toLowerCase() : "";

      // 1. Text Search Filter
      if (q) {
        const matchesText =
          cleanedName.includes(q) ||
          cleanedDesc.includes(q) ||
          ref.includes(q) ||
          ataTitle.includes(q) ||
          String(p.id).includes(q);
        if (!matchesText) return false;
      }

      // 2. Inspection Basis / Trigger Filter
      if (basisFilter !== "all") {
        if (parsed.basis !== basisFilter) return false;
      }

      // 3. Flight Hour Filter (Functioning & Reliable)
      if (hourFilter !== "all") {
        if (parsed.hours !== hourFilter) return false;
      }

      // 4. Applicability Filter (Normalizing "engine" vs "engines")
      if (applicabilityFilter !== "all") {
        const app = (p.applicability || "").toLowerCase();
        if (applicabilityFilter === "engine") {
          if (!app.startsWith("engine")) return false;
        } else if (app !== applicabilityFilter) {
          return false;
        }
      }

      // 5. Category Filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "conditional") {
          if (parsed.basis !== "conditional") return false;
        } else if (p.category !== categoryFilter) {
          return false;
        }
      }

      // 6. Airframe / Asset Filter
      if (assetFilter !== "all") {
        if (assetFilter === "fleet") {
          if (p.asset_id !== null && p.asset_id !== undefined) return false;
        } else if (String(p.asset_id) !== assetFilter) {
          return false;
        }
      }

      return true;
    });
  }, [programs, search, basisFilter, hourFilter, applicabilityFilter, categoryFilter, assetFilter, ataMap]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, basisFilter, hourFilter, applicabilityFilter, categoryFilter, assetFilter, pageSize]);

  // Paginated Slices
  const totalItems = filteredPrograms.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedPrograms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPrograms.slice(start, start + pageSize);
  }, [filteredPrograms, currentPage, pageSize]);

  const handleOpenScheduleModal = (p: MaintenanceProgram) => {
    setSelectedAssetForWorkOrder(p.asset_id || (aircraftAssets[0] ? aircraftAssets[0].id : null));
    setIsWorkOrderModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Executive Top Header */}
      <div
        className={cn(
          "border rounded-xl p-5 sm:p-6 transition-all",
          isDark
            ? "bg-[#001219] border-[#0A4D66]/40 text-white shadow-lg"
            : "bg-white border-slate-200 text-slate-800 shadow-sm",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0A4D66]/20 border border-[#7FD5FF]/40 flex items-center justify-center text-[#7FD5FF]">
                <Icon icon="mdi:calendar-check-outline" className="w-5 h-5" />
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-wide uppercase text-[#0A4D66] dark:text-[#7FD5FF]">
                Maintenance Programs &amp; Inspection Planning
              </h1>
            </div>
            <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-slate-500")}>
              Standardized OEM inspection checklists, periodic airframe/engine phase intervals, ADs &amp; conditional servicing
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              title="Refresh programs"
              className={cn(
                "p-2 rounded-lg border text-xs font-semibold transition-colors",
                isDark
                  ? "border-[#0A4D66]/50 bg-[#001825] text-gray-300 hover:text-white hover:border-[#7FD5FF]"
                  : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon icon="mdi:refresh" className="w-4 h-4" />
            </button>

            {/* View Mode Switcher */}
            <div
              className={cn(
                "flex items-center p-0.5 rounded-lg border",
                isDark ? "bg-[#001825] border-[#0A4D66]/50" : "bg-slate-100 border-slate-300",
              )}
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                title="Cards View"
                className={cn(
                  "p-1.5 rounded text-xs transition-all",
                  viewMode === "cards"
                    ? isDark
                      ? "bg-[#0A4D66] text-[#7FD5FF] font-bold shadow"
                      : "bg-white text-sky-700 font-bold shadow-sm"
                    : isDark
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Table View"
                className={cn(
                  "p-1.5 rounded text-xs transition-all",
                  viewMode === "table"
                    ? isDark
                      ? "bg-[#0A4D66] text-[#7FD5FF] font-bold shadow"
                      : "bg-white text-sky-700 font-bold shadow-sm"
                    : isDark
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon icon="mdi:table" className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/maintenance/add-task")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4D66] hover:bg-[#083c50] text-white text-xs font-semibold shadow-sm border border-[#7FD5FF]/40 transition-colors"
            >
              <Icon icon="mdi:plus-circle" className="w-4 h-4 text-[#7FD5FF]" />
              <span>Add Task / Program</span>
            </button>
          </div>
        </div>

        {/* 2. KPI Summary Metrics Strip (Adopted from First Pages) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-200 dark:border-[#0A4D66]/30">
          <div className={cn("p-3 rounded-lg border", isDark ? "bg-[#001825]/80 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200")}>
            <span className={cn("text-[11px] uppercase font-bold block", isDark ? "text-gray-400" : "text-slate-500")}>
              Total Program Tasks
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold font-mono text-[#0A4D66] dark:text-[#7FD5FF]">{metrics.total}</span>
              <Icon icon="mdi:clipboard-list-outline" className="w-5 h-5 text-[#0A4D66]/60 dark:text-[#7FD5FF]/50" />
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border", isDark ? "bg-[#001825]/80 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200")}>
            <span className={cn("text-[11px] uppercase font-bold block", isDark ? "text-gray-400" : "text-slate-500")}>
              Phase Flight-Hours
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{metrics.phaseHoursCount}</span>
              <Icon icon="mdi:airplane-clock" className="w-5 h-5 text-emerald-500/50" />
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border", isDark ? "bg-[#001825]/80 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200")}>
            <span className={cn("text-[11px] uppercase font-bold block", isDark ? "text-gray-400" : "text-slate-500")}>
              Periodic Calendar
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{metrics.calendarCount}</span>
              <Icon icon="mdi:calendar-month-outline" className="w-5 h-5 text-purple-500/50" />
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border", isDark ? "bg-[#001825]/80 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200")}>
            <span className={cn("text-[11px] uppercase font-bold block", isDark ? "text-gray-400" : "text-slate-500")}>
              Compliance ADs / SBs
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{metrics.complianceCount}</span>
              <Icon icon="mdi:shield-check-outline" className="w-5 h-5 text-amber-500/50" />
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border col-span-2 sm:col-span-1", isDark ? "bg-[#001825]/80 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200")}>
            <span className={cn("text-[11px] uppercase font-bold block", isDark ? "text-gray-400" : "text-slate-500")}>
              Conditional Events
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">{metrics.conditionalCount}</span>
              <Icon icon="mdi:alert-circle-check-outline" className="w-5 h-5 text-sky-500/50" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Aerospace Filter Command Bar */}
      <div
        className={cn(
          "border rounded-xl p-5 space-y-4",
          isDark
            ? "bg-[#001219] border-[#0A4D66]/40 text-white shadow-sm"
            : "bg-white border-slate-200 text-slate-800 shadow-sm",
        )}
      >
        {/* Row 1: Search, Target Aircraft & Category */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <Icon icon="mdi:magnify" className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by task title, description, ATA Chapter, or ref #..."
              className={cn(
                "w-full rounded-lg pl-9 pr-8 py-2 text-xs outline-none transition-colors border",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-gray-500 focus:border-[#7FD5FF]"
                  : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-sky-600",
              )}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-200"
              >
                <Icon icon="mdi:close-circle" className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors border",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/50 text-white focus:border-[#7FD5FF]"
                  : "bg-white border-slate-300 text-slate-800 focus:border-sky-600",
              )}
            >
              <option value="all">All Aircraft / Fleet</option>
              <option value="fleet">Fleet-Wide Only</option>
              {aircraftAssets.map((asset) => (
                <option key={asset.id} value={String(asset.id)}>
                  {asset.name} {asset.tail_number ? `(${asset.tail_number})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors border",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/50 text-white focus:border-[#7FD5FF]"
                  : "bg-white border-slate-300 text-slate-800 focus:border-sky-600",
              )}
            >
              <option value="all">All Program Categories</option>
              <option value="scheduled">Scheduled Phase Inspections</option>
              <option value="airworthiness_directive">Airworthiness Directives (AD)</option>
              <option value="service_bulletin">Service Bulletins (SB / ASB)</option>
              <option value="conditional">Conditional / Event-Based Servicing</option>
            </select>
          </div>
        </div>

        {/* Row 2: Inspection Trigger / Basis Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#0A4D66]/30">
          <span className={cn("text-xs font-bold uppercase tracking-wider mr-1", isDark ? "text-gray-400" : "text-slate-600")}>
            Inspection Trigger:
          </span>
          {[
            { id: "all", label: "All Triggers", icon: "mdi:all-inclusive" },
            { id: "hours", label: "Phase Flying Hours", icon: "mdi:airplane-clock" },
            { id: "calendar", label: "Calendar Periodic", icon: "mdi:calendar-range" },
            { id: "cycles", label: "Operating Cycles", icon: "mdi:rotate-3d-variant" },
            { id: "conditional", label: "Conditional & Events", icon: "mdi:alert-octagon-outline" },
          ].map((item) => {
            const isActive = basisFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setBasisFilter(item.id as typeof basisFilter);
                  if (item.id !== "hours" && item.id !== "all") {
                    setHourFilter("all");
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  isActive
                    ? isDark
                      ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF] shadow"
                      : "bg-sky-600 border-sky-600 text-white shadow-sm"
                    : isDark
                      ? "border-[#0A4D66]/40 bg-[#001825] text-gray-300 hover:border-[#7FD5FF]/40 hover:text-white"
                      : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100",
                )}
              >
                <Icon icon={item.icon} className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Flying Hours Specific Interval Filter (FIXED & FUNCTIONING!) */}
        {(basisFilter === "all" || basisFilter === "hours") && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-[#0A4D66]/30">
            <span className={cn("text-xs font-medium mr-1.5", isDark ? "text-gray-400" : "text-slate-600")}>
              Filter By Hours:
            </span>
            <button
              type="button"
              onClick={() => setHourFilter("all")}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold transition-colors border",
                hourFilter === "all"
                  ? isDark
                    ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                    : "bg-sky-600 border-sky-600 text-white"
                  : isDark
                    ? "border-[#0A4D66]/40 bg-[#001825] text-gray-400 hover:text-gray-200"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
              )}
            >
              All Hours
            </button>
            {dynamicHourOptions.map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setHourFilter(hrs)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-mono font-semibold transition-colors border",
                  hourFilter === hrs
                    ? isDark
                      ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF] shadow-sm"
                      : "bg-sky-600 border-sky-600 text-white shadow-sm"
                    : isDark
                      ? "border-[#0A4D66]/40 bg-[#001825] text-gray-300 hover:border-[#7FD5FF]/40 hover:text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {hrs} hrs
              </button>
            ))}
          </div>
        )}

        {/* Row 4: Applicability Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-[#0A4D66]/30">
          <span className={cn("text-xs font-medium mr-1.5", isDark ? "text-gray-400" : "text-slate-600")}>
            Applicability:
          </span>
          {[
            { id: "all", label: "All Systems" },
            { id: "component", label: "Component" },
            { id: "engine", label: "Engine / Turbine" },
            { id: "avionics", label: "Avionics & Electrical" },
            { id: "airframe", label: "Airframe & Structure" },
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setApplicabilityFilter(type.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors border capitalize",
                applicabilityFilter === type.id
                  ? isDark
                    ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                    : "bg-sky-600 border-sky-600 text-white"
                  : isDark
                    ? "border-[#0A4D66]/40 bg-[#001825] text-gray-400 hover:text-gray-200"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Filter Status & Results Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium", isDark ? "text-gray-400" : "text-slate-600")}>
            Showing <strong className={isDark ? "text-white" : "text-slate-900"}>{paginatedPrograms.length}</strong> of{" "}
            <strong className={isDark ? "text-white" : "text-slate-900"}>{totalItems}</strong> matching programs
          </span>
          {(search || basisFilter !== "all" || hourFilter !== "all" || applicabilityFilter !== "all" || categoryFilter !== "all" || assetFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setBasisFilter("all");
                setHourFilter("all");
                setApplicabilityFilter("all");
                setCategoryFilter("all");
                setAssetFilter("all");
              }}
              className="text-xs text-[#0A4D66] dark:text-[#7FD5FF] hover:underline flex items-center gap-1 font-semibold"
            >
              <Icon icon="mdi:filter-remove-outline" className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className={cn(isDark ? "text-gray-400" : "text-slate-500")}>Items per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className={cn(
              "rounded px-2 py-1 text-xs border outline-none font-semibold",
              isDark
                ? "bg-[#001825] border-[#0A4D66]/50 text-gray-200 focus:border-[#7FD5FF]"
                : "bg-white border-slate-300 text-slate-700",
            )}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* 5. Program Display: Cards or Table */}
      {isLoading ? (
        <div
          className={cn(
            "rounded-xl border p-12 text-center text-xs space-y-2",
            isDark ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400" : "bg-white border-slate-200 text-slate-500 shadow-sm",
          )}
        >
          <Icon icon="mdi:loading" className="w-6 h-6 animate-spin mx-auto text-[#7FD5FF]" />
          <p>Loading maintenance programs and planning database...</p>
        </div>
      ) : paginatedPrograms.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border p-12 text-center text-xs space-y-3",
            isDark ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400" : "bg-white border-slate-200 text-slate-500 shadow-sm",
          )}
        >
          <Icon icon="mdi:clipboard-text-search-outline" className="w-10 h-10 mx-auto text-gray-500 opacity-60" />
          <h3 className="text-sm font-bold text-gray-300">No maintenance programs match the selected filters</h3>
          <p className="max-w-md mx-auto text-gray-500">
            Try adjusting your search criteria, clearing the hours filter, or adding a new task to the maintenance planning schedule.
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard/maintenance/add-task")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A4D66] text-white text-xs font-semibold hover:bg-[#083c50]"
          >
            <Icon icon="mdi:plus" className="w-4 h-4 text-[#7FD5FF]" />
            <span>Create New Task</span>
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 gap-3.5">
          {paginatedPrograms.map((p) => {
            const parsed = parseProgramInterval(p);
            const ataChapterName = p.ata_chapter_id ? ataMap.get(p.ata_chapter_id) : null;
            const assignedAsset = p.asset_id ? assetMap.get(p.asset_id) : null;

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border p-4 sm:p-5 transition-all space-y-3",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/40 hover:border-[#7FD5FF]/60 text-white"
                    : "bg-white border-slate-200 hover:border-sky-400 text-slate-800 shadow-sm",
                )}
              >
                {/* Header Row: Title & Badges */}
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="space-y-1.5 flex-1 min-w-[280px]">
                    {/* Badge Pill Strip */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Interval Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase font-mono border",
                          parsed.basis === "hours"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                            : parsed.basis === "calendar"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30"
                              : parsed.basis === "conditional"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30"
                                : "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",
                        )}
                      >
                        <Icon
                          icon={
                            parsed.basis === "hours"
                              ? "mdi:airplane-clock"
                              : parsed.basis === "calendar"
                                ? "mdi:calendar-range"
                                : parsed.basis === "conditional"
                                  ? "mdi:alert-octagon-outline"
                                  : "mdi:clock-outline"
                          }
                          className="w-3.5 h-3.5"
                        />
                        <span>{parsed.badgeLabel}</span>
                      </span>

                      {/* ATA Chapter Pill */}
                      {ataChapterName && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#0A4D66]/20 text-[#0A4D66] dark:text-[#7FD5FF] border border-[#7FD5FF]/30">
                          <Icon icon="mdi:book-open-page-variant-outline" className="w-3 h-3" />
                          <span>{ataChapterName}</span>
                        </span>
                      )}

                      {/* Applicability Pill */}
                      {p.applicability && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-500/10 text-slate-600 dark:text-gray-300 border border-slate-500/20">
                          {p.applicability}
                        </span>
                      )}

                      {/* Category Pill */}
                      {p.category && (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border",
                            p.category === "airworthiness_directive"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                              : p.category === "service_bulletin"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30"
                                : "bg-slate-500/10 text-slate-600 dark:text-gray-300 border-slate-500/20",
                          )}
                        >
                          {p.category === "airworthiness_directive"
                            ? "Airworthiness Directive"
                            : p.category === "service_bulletin"
                              ? "Service Bulletin"
                              : "Scheduled"}
                        </span>
                      )}
                    </div>

                    {/* Task Title */}
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {cleanAviationText(p.name)}
                    </h3>
                  </div>

                  {/* ID & Ref Number */}
                  <div className="text-right text-xs font-mono text-gray-400 shrink-0">
                    <div>ID: <span className="text-slate-700 dark:text-gray-200 font-semibold">#{p.id}</span></div>
                    {p.reference_number && (
                      <div className="text-[11px] text-[#0A4D66] dark:text-[#7FD5FF]">
                        Ref: {cleanAviationText(p.reference_number)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description / Scope */}
                {p.description && (
                  <p className={cn("text-xs leading-relaxed", isDark ? "text-gray-300" : "text-slate-600")}>
                    {cleanAviationText(p.description)}
                  </p>
                )}

                {/* Bottom Row: Airframe Applicability & Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-[#0A4D66]/20 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px]">
                    <Icon icon="mdi:airplane" className="w-3.5 h-3.5 text-[#7FD5FF]" />
                    <span>
                      {assignedAsset
                        ? `Airframe: ${assignedAsset.name} (${assignedAsset.tail})`
                        : "Airframe: Fleet-Wide Standard"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenScheduleModal(p)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0A4D66] hover:bg-[#083c50] text-white text-xs font-semibold shadow-sm border border-[#7FD5FF]/40 transition-colors"
                    >
                      <Icon icon="mdi:calendar-plus" className="w-3.5 h-3.5 text-[#7FD5FF]" />
                      <span>Plan Work Order</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/maintenance/add-task?id=${p.id}`)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                        isDark
                          ? "border-[#0A4D66]/60 bg-[#001219] text-gray-300 hover:text-white hover:border-[#7FD5FF]"
                          : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <Icon icon="mdi:pencil-outline" className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div
          className={cn(
            "rounded-xl border overflow-x-auto shadow-sm",
            isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-white border-slate-200",
          )}
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead
              className={cn(
                "border-b uppercase font-bold text-[10px] tracking-wider",
                isDark ? "bg-[#001219] text-gray-400 border-[#0A4D66]/40" : "bg-slate-50 text-slate-500 border-slate-200",
              )}
            >
              <tr>
                <th className="p-3">ID / Ref</th>
                <th className="p-3">Task Name &amp; Description</th>
                <th className="p-3">ATA Chapter</th>
                <th className="p-3">Interval / Trigger</th>
                <th className="p-3">Applicability</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", isDark ? "divide-[#0A4D66]/20 text-gray-200" : "divide-slate-100 text-slate-700")}>
              {paginatedPrograms.map((p) => {
                const parsed = parseProgramInterval(p);
                const ataChapterName = p.ata_chapter_id ? ataMap.get(p.ata_chapter_id) : null;

                return (
                  <tr key={p.id} className={cn("transition-colors", isDark ? "hover:bg-[#0A4D66]/20" : "hover:bg-sky-50/50")}>
                    <td className="p-3 font-mono font-semibold">
                      <div className="text-[#0A4D66] dark:text-[#7FD5FF]">#{p.id}</div>
                      {p.reference_number && (
                        <div className="text-[10px] text-gray-400">{cleanAviationText(p.reference_number)}</div>
                      )}
                    </td>
                    <td className="p-3 max-w-sm">
                      <div className="font-bold text-slate-900 dark:text-white">{cleanAviationText(p.name)}</div>
                      {p.description && (
                        <div className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">
                          {cleanAviationText(p.description)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {ataChapterName ? (
                        <span className="text-[11px] font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">
                          {ataChapterName}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {parsed.badgeLabel}
                      </span>
                    </td>
                    <td className="p-3 uppercase font-semibold text-[11px]">
                      {p.applicability || "General"}
                    </td>
                    <td className="p-3">
                      <span className="capitalize text-[11px]">
                        {p.category === "airworthiness_directive"
                          ? "AD"
                          : p.category === "service_bulletin"
                            ? "SB"
                            : "Scheduled"}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenScheduleModal(p)}
                          className="px-2.5 py-1 rounded bg-[#0A4D66] hover:bg-[#083c50] text-white text-xs font-semibold"
                        >
                          Plan WO
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/maintenance/add-task?id=${p.id}`)}
                          className={cn(
                            "px-2 py-1 rounded border text-xs",
                            isDark
                              ? "border-[#0A4D66]/50 bg-[#001825] text-gray-300 hover:text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Numbered Pagination Controls */}
      {totalPages > 1 && (
        <div
          className={cn(
            "flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border",
            isDark ? "bg-[#001825] border-[#0A4D66]/30 text-gray-300" : "bg-white border-slate-200 text-slate-600 shadow-sm",
          )}
        >
          <div className="text-xs">
            Page <strong className={isDark ? "text-white" : "text-slate-900"}>{currentPage}</strong> of{" "}
            <strong className={isDark ? "text-white" : "text-slate-900"}>{totalPages}</strong> ({totalItems} total tasks)
          </div>
          <NumberedPagination
            currentPage={currentPage}
            lastPage={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}

      {/* 7. Modal to Schedule / Plan Work Order */}
      {isWorkOrderModalOpen && (
        <CreateWorkOrderModal
          isOpen={isWorkOrderModalOpen}
          onClose={() => setIsWorkOrderModalOpen(false)}
          initialAssetId={selectedAssetForWorkOrder}
          onSuccess={() => {
            setIsWorkOrderModalOpen(false);
            navigate("/dashboard/maintenance/work-orders");
          }}
        />
      )}
    </div>
  );
};

export default PlanningPage;
