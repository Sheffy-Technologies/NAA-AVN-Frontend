import React, { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { useGetApprovalsQuery, useGetPendingApprovalCountQuery } from "@/features/approvals/api";
import { useGetMemosQuery } from "@/features/memos/api";
import { useGetDefectRecordsQuery } from "@/features/maintenance/api";

export const C2DirectivesModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"approvals" | "memos" | "urgent_snags">("approvals");

  const { data: approvalsData, isLoading: loadingApprovals } = useGetApprovalsQuery({ status: "pending" });
  const { data: pendingCount } = useGetPendingApprovalCountQuery();
  const { data: memosData, isLoading: loadingMemos } = useGetMemosQuery({ box: "mine" });
  const { data: defects = [], isLoading: loadingDefects } = useGetDefectRecordsQuery();

  const approvals = (approvalsData ?? []).slice(0, 15);
  const memos = (memosData?.data ?? []).slice(0, 10);
  const urgentSnags = defects.filter((d: any) => d.severity === "critical" || d.status === "open" || d.severity === "high");

  return (
    <div className="h-full flex flex-col space-y-3 p-3 overflow-y-auto text-xs">
      {/* Top Directive Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-xl border border-purple-500/30 bg-purple-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Pending Actions</span>
          <span className="text-xl font-black text-purple-300 mt-0.5 block">
            {pendingCount?.count ?? approvals.length}
          </span>
          <span className="text-[10px] text-purple-400">Awaiting executive signature</span>
        </div>

        <div className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Official Memos</span>
          <span className="text-xl font-black text-sky-400 mt-0.5 block">
            {loadingMemos ? "..." : memos.length}
          </span>
          <span className="text-[10px] text-sky-300">Correspondence active</span>
        </div>

        <div className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Urgent Snags</span>
          <span className="text-xl font-black text-rose-400 mt-0.5 block">
            {loadingDefects ? "..." : urgentSnags.length}
          </span>
          <span className="text-[10px] text-rose-300">High priority maintenance</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-[#0A4D66]/30">
        <button
          type="button"
          onClick={() => setActiveTab("approvals")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1",
            activeTab === "approvals"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm"
              : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
          )}
        >
          <span>Pending Approvals</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-500/30 text-purple-200">
            {pendingCount?.count ?? approvals.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("memos")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1",
            activeTab === "memos"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm"
              : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
          )}
        >
          <span>Memos &amp; Directives</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500/30 text-sky-200">
            {memos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("urgent_snags")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1",
            activeTab === "urgent_snags"
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm"
              : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
          )}
        >
          <span>Urgent Technical</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/30 text-rose-200">
            {urgentSnags.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Pending Approvals */}
      {activeTab === "approvals" && (
        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {loadingApprovals ? (
            <div className="text-center text-gray-500 py-6">Checking pending approvals...</div>
          ) : approvals.length === 0 ? (
            <div className="p-4 text-center text-gray-400 border border-dashed border-[#0A4D66]/30 rounded-xl">
              No approval actions currently pending commander review
            </div>
          ) : (
            approvals.map((req) => (
              <div
                key={req.id}
                className="p-2.5 rounded-xl border border-purple-500/30 bg-[#001825] flex items-center justify-between space-x-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                      {req.module_label || req.module}
                    </span>
                    <span className="font-bold text-white text-[11px] truncate max-w-[220px]">{req.title}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Initiator: <span className="text-gray-200">{req.submitted_by?.name || "Command Staff"}</span> &middot;{" "}
                    Unit: <span className="text-gray-300">{req.unit?.name || "HQ NA AVN"}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 block">
                    Pending Stage {req.current_stage ?? 1}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Memos & Correspondence */}
      {activeTab === "memos" && (
        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {loadingMemos ? (
            <div className="text-center text-gray-500 py-6">Loading memos...</div>
          ) : memos.length === 0 ? (
            <div className="p-4 text-center text-gray-400 border border-dashed border-[#0A4D66]/30 rounded-xl">
              No recent memos logged
            </div>
          ) : (
            memos.map((memo) => (
              <div
                key={memo.id}
                className="p-2 rounded-xl border border-sky-500/30 bg-[#001825] flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[10px] text-sky-300">{memo.reference}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded text-[8px] font-bold uppercase border",
                        memo.classification === "SECRET"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : memo.classification === "CONFIDENTIAL"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      )}
                    >
                      {memo.classification || "RESTRICTED"}
                    </span>
                  </div>
                  <div className="font-semibold text-white text-[11px] truncate max-w-[260px]">{memo.subject}</div>
                  <div className="text-[10px] text-gray-400">
                    To: <span className="text-gray-200">{memo.to || "Comd"}</span> &middot; From:{" "}
                    <span className="text-gray-200">{memo.from || "HQ"}</span> &middot;{" "}
                    {memo.memo_date || memo.updated_at ? new Date(memo.memo_date || memo.updated_at).toLocaleDateString() : ""}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold uppercase border",
                      memo.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : memo.status === "rejected"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    )}
                  >
                    {memo.status || "Draft"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Urgent Snags */}
      {activeTab === "urgent_snags" && (
        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {loadingDefects ? (
            <div className="text-center text-gray-500 py-6">Loading defect snags...</div>
          ) : urgentSnags.length === 0 ? (
            <div className="p-4 text-center text-emerald-400 border border-dashed border-emerald-500/30 rounded-xl">
              No open or high severity technical defects recorded
            </div>
          ) : (
            urgentSnags.map((snag: any) => (
              <div
                key={snag.id}
                className="p-2.5 rounded-xl border border-rose-500/40 bg-[#001825] flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-rose-300 text-[11px]">{snag.title || snag.description}</span>
                    <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-[#0A4D66]/40 text-sky-300 border border-[#0A4D66]/50">
                      {snag.aircraft_registration || snag.asset_tail_number || "NA 011"}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Component: <span className="text-gray-200">{snag.component || "Airframe / Avionics"}</span> &middot; Severity:{" "}
                    <span className="text-rose-400 font-bold uppercase">{snag.severity || "Open Defect"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    AOG Action Req
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

