import React from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useGetOperationsQuery } from "@/features/operations/api";

export const C2FlightOpsModule: React.FC = () => {
  const { data: aircraftAssets = [], isLoading: loadingAssets } = useGetAssetsQuery({ type: "aircraft" });
  const { data: operationsData, isLoading: loadingOps } = useGetOperationsQuery({ per_page: 8 });
  const operations = operationsData?.data || [];

  return (
    <div className="h-full flex flex-col space-y-3 p-3 overflow-y-auto text-xs">
      {/* Top Airframe Status Strip */}
      <div className="grid grid-cols-2 gap-2">
        {loadingAssets ? (
          <div className="col-span-2 text-center text-gray-500 py-3">Loading airframes...</div>
        ) : aircraftAssets.length === 0 ? (
          <div className="col-span-2 text-center text-gray-500 py-3">No aircraft registered</div>
        ) : (
          aircraftAssets.slice(0, 2).map((ac, idx) => {
            const isServiceable = ac.status !== "grounded" && ac.status !== "maintenance";
            const tail = ac.tail_number || ac.name || `NA 01${idx}`;
            return (
              <div
                key={ac.id}
                className="p-2.5 rounded-xl border border-[#0A4D66]/50 bg-[#001825] flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border",
                      isServiceable
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-400 border-rose-500/30",
                    )}
                  >
                    <Icon icon="mdi:airplane" className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">{tail}</span>
                    <span className="text-[10px] text-gray-400">Bell 412 / Armed Recon</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                    isServiceable
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-400 border-rose-500/40",
                  )}
                >
                  {isServiceable ? "Serviceable" : "Grounded (AOG)"}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Flight Operations Live Tracking Feed */}
      <div className="flex-1 flex flex-col space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-[#0A4D66]/30">
          <div className="flex items-center gap-1.5 text-sky-400 font-bold uppercase text-[11px] tracking-wider">
            <Icon icon="mdi:radar" className="w-3.5 h-3.5 animate-pulse" />
            <span>Active Sorties &amp; Flight Progress</span>
          </div>
          <span className="text-[10px] text-gray-400">{operations.length} Tracked</span>
        </div>

        {loadingOps ? (
          <div className="text-center text-gray-500 py-6">Connecting to telemetry feed...</div>
        ) : operations.length === 0 ? (
          <div className="text-center text-gray-500 py-6 border border-dashed border-[#0A4D66]/30 rounded-xl">
            <Icon icon="mdi:airplane-off" className="w-6 h-6 mx-auto opacity-40 text-gray-400 mb-1" />
            <span>No active sorties in progress</span>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 flex-1">
            {operations.map((op: any) => {
              const statusColors: Record<string, string> = {
                ongoing: "bg-sky-500/20 text-sky-400 border-sky-500/40",
                completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                planned: "bg-amber-500/20 text-amber-400 border-amber-500/40",
                aborted: "bg-rose-500/20 text-rose-400 border-rose-500/40",
              };
              const badgeClass = statusColors[op.status] || "bg-gray-500/20 text-gray-300 border-gray-500/40";

              return (
                <div
                  key={op.id}
                  className="p-2.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]/70 hover:bg-[#001825] transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{op.name || `Sortie #${op.id}`}</span>
                      <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-800/40">
                        {op.aircraft?.tail_number || "NA 010"}
                      </span>
                    </div>
                    <span className={cn("px-2 py-0.2 rounded-full text-[9px] font-bold uppercase border", badgeClass)}>
                      {op.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-300">
                    <span className="truncate max-w-[140px] text-gray-400">
                      Dep: <strong className="text-white">{op.location || "DNAA (Abuja)"}</strong>
                    </span>
                    <span className="text-gray-400">
                      ETA: <strong className="text-emerald-400 font-mono">{op.end_time ? op.end_time.slice(11, 16) : "14:30Z"}</strong>
                    </span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-[#001219] rounded-full h-1.5 overflow-hidden border border-[#0A4D66]/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        op.status === "completed" ? "bg-emerald-500 w-full" : "bg-sky-500 w-3/5 animate-pulse",
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

