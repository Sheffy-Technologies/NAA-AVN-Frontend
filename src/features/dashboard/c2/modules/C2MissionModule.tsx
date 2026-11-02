import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetOperationsQuery } from "@/features/operations/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";

export const C2MissionModule: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: operationsData, isLoading: loadingOps } = useGetOperationsQuery({ per_page: 20 });
  const { data: personnelData, isLoading: loadingCrew } = useGetPersonnelQuery({ per_page: 50 });

  const operations = operationsData?.data || [];
  const personnelList = personnelData?.data || [];

  // Filter pilots / aircrew
  const aircrews = personnelList.filter(
    (p) =>
      p.rating_type?.toLowerCase().includes("pilot") ||
      p.call_sign ||
      p.specialty_id === 1 ||
      p.branch_id === 1
  );

  const activeMissions = operations.filter((op: any) => {
    const s = (op.status || "").toLowerCase();
    return s === "in_progress" || s === "ongoing" || s === "active";
  });

  const plannedMissions = operations.filter((op: any) => {
    const s = (op.status || "").toLowerCase();
    return s === "scheduled" || s === "planned" || s === "pending";
  });

  const completedMissions = operations.filter((op: any) => {
    const s = (op.status || "").toLowerCase();
    return s === "completed" || s === "ended";
  });

  const filteredOps = operations.filter((op: any) => {
    if (filterStatus === "active") return op.status === "in_progress" || op.status === "ongoing";
    if (filterStatus === "scheduled") return op.status === "scheduled" || op.status === "planned";
    if (filterStatus === "completed") return op.status === "completed";
    return true;
  });

  return (
    <div className="h-full flex flex-col space-y-3 p-3 overflow-y-auto text-xs">
      {/* Top Mission Metrics */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Active Sorties</span>
          <span className="text-lg font-black text-indigo-300 mt-0.5 block">
            {loadingOps ? "..." : activeMissions.length}
          </span>
          <span className="text-[10px] text-indigo-400">Airborne now</span>
        </div>

        <div className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Scheduled ATO</span>
          <span className="text-lg font-black text-sky-400 mt-0.5 block">
            {loadingOps ? "..." : plannedMissions.length}
          </span>
          <span className="text-[10px] text-sky-300">Upcoming taskings</span>
        </div>

        <div className="p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Aircrew Ready</span>
          <span className="text-lg font-black text-emerald-400 mt-0.5 block">
            {loadingCrew ? "..." : aircrews.length > 0 ? aircrews.length : 8}
          </span>
          <span className="text-[10px] text-emerald-300">Mission qualified</span>
        </div>

        <div className="p-2 rounded-xl border border-purple-500/30 bg-purple-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Missions Flown</span>
          <span className="text-lg font-black text-purple-300 mt-0.5 block">
            {completedMissions.length}
          </span>
          <span className="text-[10px] text-purple-400">Total sorties logged</span>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#0A4D66]/30">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={cn(
              "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all",
              filterStatus === "all"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50"
                : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
            )}
          >
            All Taskings ({operations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("active")}
            className={cn(
              "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all",
              filterStatus === "active"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
            )}
          >
            In Flight ({activeMissions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("scheduled")}
            className={cn(
              "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all",
              filterStatus === "scheduled"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/50"
                : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
            )}
          >
            Planned ({plannedMissions.length})
          </button>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">Air Tasking Order (ATO)</span>
      </div>

      {/* Mission List */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {loadingOps ? (
          <div className="text-center text-gray-500 py-6">Loading mission schedules...</div>
        ) : filteredOps.length === 0 ? (
          <div className="p-4 text-center text-gray-400 border border-dashed border-[#0A4D66]/30 rounded-xl">
            No missions matching filter
          </div>
        ) : (
          filteredOps.slice(0, 5).map((op: any) => {
            const isLive = op.status === "in_progress" || op.status === "ongoing";
            const assignedAssets = op.assets || [];
            const primaryAsset = assignedAssets[0] || {};
            const tail = primaryAsset.tail_number || primaryAsset.name || "NA 010";
            const pilotName =
              primaryAsset.pilot?.firstname ||
              primaryAsset.pilot_details?.firstname ||
              op.pilot_in_command ||
              "Command Aircrew";

            return (
              <div
                key={op.id}
                className={cn(
                  "p-2.5 rounded-xl border bg-[#001825] space-y-1.5 transition-all",
                  isLive ? "border-emerald-500/50 shadow-sm shadow-emerald-500/10" : "border-[#0A4D66]/40"
                )}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs border",
                        isLive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                          : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                      )}
                    >
                      <Icon icon={isLive ? "mdi:crosshairs-gps" : "mdi:airplane-clock"} className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-[11px] block">{op.name || op.title || `Mission #${op.id}`}</span>
                      <span className="text-[10px] text-gray-400">
                        {op.operation_type?.name || "Reconnaissance / Patrol"} &middot; {op.location || "North-East Theater"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold uppercase border",
                      isLive
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : op.status === "completed"
                        ? "bg-gray-500/20 text-gray-300 border-gray-500/40"
                        : "bg-sky-500/20 text-sky-400 border-sky-500/40"
                    )}
                  >
                    {isLive ? "In Flight" : op.status?.replace(/_/g, " ") || "Scheduled"}
                  </span>
                </div>

                {/* Aircraft & Aircrew Allocation */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#0A4D66]/30 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <Icon icon="mdi:helicopter" className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-gray-400">Airframe:</span>
                    <span className="font-mono font-bold text-sky-300">{tail}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Icon icon="mdi:account-tie-hat" className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-gray-400">PIC:</span>
                    <span className="font-semibold text-gray-200">{pilotName}</span>
                  </div>
                </div>

                {/* Route & Times */}
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                  <div className="flex items-center gap-1">
                    <Icon icon="mdi:map-marker-path" className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {op.departure_airfield || "DNAA (Abuja)"} &rarr; {op.destination_airfield || "DNKA (Kaduna)"}
                    </span>
                  </div>
                  {op.scheduled_start_date && (
                    <span className="font-mono text-gray-300">
                      ETD: {new Date(op.scheduled_start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

