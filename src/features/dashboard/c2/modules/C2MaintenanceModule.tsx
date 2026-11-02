import React from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetMaintenanceMetricsQuery,
  useGetMaintenanceDueItemsQuery,
  useGetDefectRecordsQuery,
  useGetWorkOrdersQuery,
} from "@/features/maintenance/api";

export const C2MaintenanceModule: React.FC = () => {
  const { data: metrics } = useGetMaintenanceMetricsQuery();
  const { data: dueData, isLoading: loadingDue } = useGetMaintenanceDueItemsQuery();
  const { data: defectRecords = [] } = useGetDefectRecordsQuery();
  const { data: workOrdersData } = useGetWorkOrdersQuery({ status: "in_progress" });
  const openWips = workOrdersData?.data || [];

  const dueItems = dueData?.data || [];
  const openDefects = defectRecords.filter((d: any) => d.status !== "resolved" && d.status !== "closed");

  return (
    <div className="h-full flex flex-col space-y-3 p-3 overflow-y-auto text-xs">
      {/* Fleet Readiness Status */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Serviceable</span>
          <span className="text-xl font-black text-emerald-400 mt-0.5 block">
            {metrics?.fleet_readiness?.serviceable ?? 1}
          </span>
          <span className="text-[10px] text-emerald-300">Airframe NA 010</span>
        </div>

        <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">AOG / Grounded</span>
          <span className="text-xl font-black text-rose-400 mt-0.5 block">
            {metrics?.fleet_readiness?.grounded ?? 1}
          </span>
          <span className="text-[10px] text-rose-300">Airframe NA 011</span>
        </div>

        <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Open Defects</span>
          <span className="text-xl font-black text-amber-300 mt-0.5 block">
            {openDefects.length}
          </span>
          <span className="text-[10px] text-amber-300">Technical snags</span>
        </div>
      </div>

      {/* Components Approaching Overhaul Horizon (Due ≤ 50h / 100h) */}
      <div className="space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between pb-1 border-b border-[#0A4D66]/30">
          <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase text-[11px] tracking-wider">
            <Icon icon="mdi:alarm-light-outline" className="w-3.5 h-3.5 animate-pulse" />
            <span>Components Approaching Horizon (&le; 100h)</span>
          </div>
          <span className="text-[10px] text-gray-400">{dueItems.length} Monitored</span>
        </div>

        {loadingDue ? (
          <div className="text-center text-gray-500 py-4">Checking component wear meters...</div>
        ) : dueItems.length === 0 ? (
          <div className="p-3 text-center text-gray-500 border border-dashed border-[#0A4D66]/30 rounded-xl">
            No components currently within overdue threshold
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
            {dueItems.slice(0, 4).map((item, idx) => {
              const isOverdue = item.status === "overdue";
              return (
                <div
                  key={idx}
                  className="p-2 rounded-xl border border-[#0A4D66]/40 bg-[#001825] flex items-center justify-between text-[11px]"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-white truncate max-w-[160px]">{item.item_name}</span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {item.asset_tail_number || "NA 010"} &middot; {item.part_number || "P/N-N/A"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border",
                        isOverdue
                          ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/40",
                      )}
                    >
                      {item.remaining_hours !== undefined ? `${item.remaining_hours}h remaining` : item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ongoing Maintenance WIP */}
      <div className="p-2.5 rounded-xl border border-[#0A4D66]/40 bg-[#001219] space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-sky-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Icon icon="mdi:progress-wrench" className="w-3.5 h-3.5" />
            <span>Active Maintenance Work Orders (WIP)</span>
          </span>
          <span className="text-[10px] text-gray-400">{openWips.length} Active</span>
        </div>
        {openWips.length === 0 ? (
          <div className="text-[11px] text-gray-500 text-center py-2">
            No scheduled heavy maintenance work in progress today.
          </div>
        ) : (
          openWips.slice(0, 2).map((wo: any) => (
            <div key={wo.id} className="p-1.5 rounded bg-[#001825] border border-[#0A4D66]/30 flex items-center justify-between">
              <span className="font-semibold text-gray-200">WO #{wo.id}: {wo.title || "Scheduled Inspection"}</span>
              <span className="text-[10px] font-mono text-sky-400">In Progress</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
