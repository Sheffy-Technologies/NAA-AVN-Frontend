import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useGetMaintenanceProgramsQuery } from "../api";

export const PlanningPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [intervalFilter, setIntervalFilter] = useState<number | null>(null);
  const [applicabilityFilter, setApplicabilityFilter] = useState<string | null>(null);

  const filterParams = {
    ...(intervalFilter != null ? { interval_hours: intervalFilter } : {}),
    ...(applicabilityFilter ? { applicability: applicabilityFilter } : {}),
  };
  const { data: programs = [], isLoading } = useGetMaintenanceProgramsQuery(
    Object.keys(filterParams).length > 0 ? filterParams : undefined,
  );

  const filteredPrograms = useMemo(() => {
    if (!search.trim()) return programs;
    const q = search.toLowerCase();
    return programs.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.applicability?.toLowerCase().includes(q) ?? false)
    );
  }, [programs, search]);

  return (
    <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[#7FD5FF] uppercase">Maintenance Programs (Planning)</h2>
        <button
          className="rounded border border-emerald-400 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/20 transition-colors"
          onClick={() => navigate("/dashboard/maintenance/add-task")}
        >
          + Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Interval Hours filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Interval:</span>
          {([null, 10, 50, 100, 150, 200] as (number | null)[]).map((val) => (
            <button
              key={val ?? "all"}
              type="button"
              onClick={() => setIntervalFilter(val)}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors border",
                intervalFilter === val
                  ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                  : "border-[#0A4D66]/40 text-gray-400 hover:border-[#7FD5FF]/40 hover:text-gray-200",
              )}
            >
              {val == null ? "All" : `${val} hrs`}
            </button>
          ))}
        </div>

        {/* Applicability filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Type:</span>
          {([null, "component", "engine", "avionics"] as (string | null)[]).map((val) => (
            <button
              key={val ?? "all"}
              type="button"
              onClick={() => setApplicabilityFilter(val)}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors border capitalize",
                applicabilityFilter === val
                  ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                  : "border-[#0A4D66]/40 text-gray-400 hover:border-[#7FD5FF]/40 hover:text-gray-200",
              )}
            >
              {val == null ? "All" : val}
            </button>
          ))}
        </div>
      </div>

      <input
        className="w-full mb-4 rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
        placeholder="Search tasks by name, description, or type..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {isLoading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-gray-400">No maintenance programs found.</div>
      ) : (
        <div className="space-y-3">
          {filteredPrograms.map((p) => (
            <div key={p.id} className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{p.description}</div>
                  <div className="text-xs text-gray-400 mt-1">Applicability: {p.applicability}</div>
                </div>
                <div className="text-xs text-gray-400">ID: {p.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlanningPage;
