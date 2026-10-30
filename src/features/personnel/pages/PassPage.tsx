import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { PersonnelModuleTabs } from "../components/PersonnelModuleTabs";
import { InitiatePassModal } from "../components/InitiatePassModal";
import { EditPassModal } from "../components/EditPassModal";
import {
  useGetPersonnelPassQuery,
  useGetPassesQuery,
  useDeletePassMutation,
  useUpdatePassMutation,
  useRecomputePassStatusesMutation,
  type Pass,
  type PassStatus,
  type PassRecordStatus,
} from "../passApi";
import { useGetPersonnelRanksQuery } from "../api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { AppTabs } from "@/shared/ui/tabs/AppTabs";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { FloatingActionMenu } from "@/shared/ui/menu/FloatingActionMenu";
import { useGetActiveApprovalModulesQuery } from "@/features/approvals/api";
import { ApprovalDialog } from "@/features/approvals/components/ApprovalPanel";

type PassTab = "personnel" | "history";

const PASS_STATUS_COLORS: Record<PassStatus, string> = {
  upcoming: "text-blue-400 bg-blue-400/10",
  due_for_pass: "text-amber-400 bg-amber-400/10",
  pending_approval: "text-purple-400 bg-purple-400/10",
  on_pass: "text-emerald-400 bg-emerald-400/10",
  overdue: "text-red-400 bg-red-400/10",
};

const PASS_STATUS_DOT: Record<PassStatus, string> = {
  upcoming: "bg-blue-400",
  due_for_pass: "bg-amber-400",
  pending_approval: "bg-purple-400",
  on_pass: "bg-emerald-400",
  overdue: "bg-red-400",
};

const PASS_STATUS_LABELS: Record<PassStatus, string> = {
  upcoming: "Upcoming",
  due_for_pass: "Due for Pass",
  pending_approval: "Pending Approval",
  on_pass: "On Pass",
  overdue: "Overdue",
};

const RECORD_STATUS_COLORS: Record<PassRecordStatus, string> = {
  pending: "text-amber-400",
  approved: "text-blue-400",
  active: "text-emerald-400",
  completed: "text-gray-400",
  rejected: "text-red-400",
};

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const dueInLabel = (nextPassDate: string | null) => {
  if (!nextPassDate) return "—";
  const diff = Math.ceil(
    (new Date(nextPassDate).getTime() - Date.now()) / 86400000,
  );
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  return `${diff}d`;
};

export const PassPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<PassTab>("personnel");
  const [showInitiateModal, setShowInitiateModal] = useState(false);

  // Filters – Personnel tab
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [rankFilter, setRankFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<PassStatus | "">(() => {
    // ?pass_status= (e.g. from the Strategic Dashboard) pre-filters the list.
    const status = new URLSearchParams(window.location.search).get("pass_status");
    return status && status in PASS_STATUS_LABELS ? (status as PassStatus) : "";
  });
  const [passSearch, setPassSearch] = useState("");

  // Filters – History tab
  const [historyStatus, setHistoryStatus] = useState<PassRecordStatus | "">("");
  const [historyUnitFilter, setHistoryUnitFilter] = useState<number | "">("");
  const [historyRankFilter, setHistoryRankFilter] = useState<number | "">("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [editingPass, setEditingPass] = useState<Pass | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);

  const authUser = useAppSelector((state) => state.auth.user);
  const currentUserId = authUser?.id ? Number(authUser.id) : null;
  // When a pass approval workflow is active, passes are approved only through
  // signed approval (the server refuses the direct approve/decline).
  const canViewApprovals = (authUser?.permissions ?? []).includes("approvals.viewAny");
  const { data: activeApprovalModules = [] } = useGetActiveApprovalModulesQuery(undefined, { skip: !canViewApprovals });
  const passesNeedApproval = activeApprovalModules.includes("passes");
  // ?pass=ID (from the approvals inbox) opens that pass's approval.
  const [searchParams, setSearchParams] = useSearchParams();
  const [approvalPassId, setApprovalPassId] = useState<number | null>(() => Number(searchParams.get("pass")) || null);

  const { data: units = [] } = useGetUnitsQuery();
  const { data: ranks = [] } = useGetPersonnelRanksQuery();

  const { data: personnelPass = [], isLoading: isPersonnelLoading } =
    useGetPersonnelPassQuery({
      unit_id: unitFilter || undefined,
      rank_id: rankFilter || undefined,
      pass_status: statusFilter || undefined,
    });

  const { data: passHistory = [], isLoading: isHistoryLoading } = useGetPassesQuery({
    status: historyStatus || undefined,
    unit_id: historyUnitFilter || undefined,
    rank_id: historyRankFilter || undefined,
    date_from: historyDateFrom || undefined,
    date_to: historyDateTo || undefined,
  });

  const [deletePass] = useDeletePassMutation();
  const [updatePass, { isLoading: isUpdatingPass }] = useUpdatePassMutation();
  const [recomputePassStatuses, { isLoading: isRecomputing }] =
    useRecomputePassStatusesMutation();

  const handleRecomputeStatuses = async () => {
    try {
      const result = await recomputePassStatuses().unwrap();
      dispatch(
        showToast({
          message: `Recalculated pass status for ${result.personnel_count} personnel.`,
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({ message: "Failed to recalculate pass statuses", type: "error" }),
      );
    }
  };

  const handleDeletePass = async (id: number) => {
    if (!window.confirm("Delete this pass record?")) return;
    try {
      await deletePass(id).unwrap();
      dispatch(showToast({ message: "Pass deleted", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to delete pass", type: "error" }));
    }
  };

  const handleDecidePass = async (id: number, decision: "approved" | "rejected") => {
    try {
      await updatePass({
        id,
        data: { status: decision, approved_by: currentUserId },
      }).unwrap();
      dispatch(
        showToast({
          message: decision === "approved" ? "Pass approved" : "Pass declined",
          type: "success",
        }),
      );
    } catch {
      dispatch(showToast({ message: "Failed to update pass", type: "error" }));
    }
  };

  const filteredPersonnel = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    if (!q) return personnelPass;
    return personnelPass.filter(
      (p) =>
        p.firstname?.toLowerCase().includes(q) ||
        p.lastname?.toLowerCase().includes(q) ||
        p.service_number?.toLowerCase().includes(q) ||
        p.rank?.name?.toLowerCase().includes(q),
    );
  }, [personnelPass, passSearch]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return passHistory;
    return passHistory.filter((p) => {
      const name = `${p.personnel?.firstname ?? ""} ${p.personnel?.lastname ?? ""}`.toLowerCase();
      return name.includes(q);
    });
  }, [passHistory, historySearch]);

  const openActionPass = useMemo(
    () =>
      openActionId
        ? (filteredHistory.find((p) => p.id === openActionId) ?? null)
        : null,
    [filteredHistory, openActionId],
  );

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">

        {/* Module-level tab bar */}
        <PersonnelModuleTabs />

        {/* Pass page header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
            Pass Management
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRecomputeStatuses()}
              disabled={isRecomputing}
              title="Recalculate last/next pass date and status for all personnel"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#0A4D66]/40 text-xs text-gray-300 hover:bg-[#0A4D66]/30 disabled:opacity-50"
            >
              <Icon
                icon={isRecomputing ? "mdi:loading" : "mdi:refresh"}
                className={cn("w-4 h-4", isRecomputing && "animate-spin")}
              />
              {isRecomputing ? "Recalculating..." : "Recalculate"}
            </button>
            <button
              type="button"
              onClick={() => setShowInitiateModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              Initiate Pass
            </button>
          </div>
        </div>

        {/* Inner tabs: Personnel | Pass History */}
        <div className="px-4 sm:px-6">
          <AppTabs<PassTab>
            tabs={[
              { id: "personnel", label: "Personnel Pass Status", icon: "mdi:account-badge-outline" },
              { id: "history", label: "Pass History Records", icon: "mdi:history" },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab)}
            size="sm"
          />
        </div>

        {/* ── Personnel Tab ─────────────────────────────────── */}
        {activeTab === "personnel" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
              <div className="relative flex-1 min-w-48 max-w-xs">
                <Icon
                  icon="mdi:magnify"
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  value={passSearch}
                  onChange={(e) => setPassSearch(e.target.value)}
                  placeholder="Search personnel..."
                  className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40"
                />
              </div>

              <SearchableSelect
                placeholder="All Units"
                searchPlaceholder="Search unit..."
                buttonClassName="py-1.5 px-2 text-xs"
                className="w-36"
                options={units.map((u) => ({ value: u.id, label: u.name }))}
                value={unitFilter || null}
                onChange={(value) =>
                  setUnitFilter(value === null ? "" : Number(value))
                }
              />

              <SearchableSelect
                placeholder="All Ranks"
                searchPlaceholder="Search rank..."
                buttonClassName="py-1.5 px-2 text-xs"
                className="w-36"
                options={ranks.map((r) => ({ value: r.id, label: r.name }))}
                value={rankFilter || null}
                onChange={(value) =>
                  setRankFilter(value === null ? "" : Number(value))
                }
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as PassStatus | "")
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">All Status</option>
                {(Object.entries(PASS_STATUS_LABELS) as [PassStatus, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Personnel Pass Table */}
            <div className="overflow-x-auto pb-2">
              <table className="min-w-max w-full text-xs text-gray-200 whitespace-nowrap">
                <thead>
                  <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
                    <th className="px-4 sm:px-6 py-3 text-left">Service No.</th>
                    <th className="px-4 py-3 text-left">Personnel</th>
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Last Pass</th>
                    <th className="px-4 py-3 text-left">Next Pass</th>
                    <th className="px-4 py-3 text-left">Due In</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isPersonnelLoading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-400">
                        <div className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : filteredPersonnel.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        No personnel found.
                      </td>
                    </tr>
                  ) : (
                    filteredPersonnel.map((p, i) => (
                      <tr
                        key={p.id}
                        tabIndex={0}
                        role="button"
                        title="Click to view personnel details"
                        onClick={(e) =>
                          onInteractiveRowClick(e, () =>
                            navigate(`/dashboard/personnel/${p.id}`),
                          )
                        }
                        onKeyDown={(e) =>
                          onInteractiveRowKeyDown(e, () =>
                            navigate(`/dashboard/personnel/${p.id}`),
                          )
                        }
                        className={cn(
                          "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors focus:outline-none focus:bg-[#0A4D66]/30",
                          i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                        )}
                      >
                        <td className="px-4 sm:px-6 py-3 text-white">
                          {p.service_number}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {p.firstname} {p.lastname}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {p.rank?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {p.pass_status ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
                                PASS_STATUS_COLORS[p.pass_status as PassStatus] ??
                                  "text-gray-400 bg-gray-400/10",
                              )}
                            >
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  PASS_STATUS_DOT[p.pass_status as PassStatus] ??
                                    "bg-gray-400",
                                )}
                              />
                              {PASS_STATUS_LABELS[p.pass_status as PassStatus] ??
                                p.pass_status}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {formatDate(p.last_pass_date)}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {formatDate(p.next_pass_date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              p.next_pass_date &&
                                new Date(p.next_pass_date) < new Date()
                                ? "text-red-400"
                                : "text-white",
                            )}
                          >
                            {dueInLabel(p.next_pass_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white">
                          {p.unit?.name ?? "—"}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/dashboard/personnel/${p.id}`)
                              }
                              title="View personnel"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0A4D66]/40 text-[10px] text-gray-300 hover:bg-[#0A4D66]/30"
                            >
                              <Icon icon="mdi:eye-outline" className="w-3 h-3" />
                              View
                            </button>
                            {p.pass_status === "pending_approval" &&
                            p.pending_pass &&
                            passesNeedApproval ? (
                              <button
                                type="button"
                                onClick={() => setApprovalPassId(p.pending_pass!.id)}
                                title="Submit, approve or decline with signature"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500/60 text-[10px] text-amber-300 hover:bg-amber-500/20"
                              >
                                <Icon icon="mdi:file-sign" className="w-3 h-3" />
                                Approval
                              </button>
                            ) : p.pass_status === "pending_approval" &&
                            p.pending_pass ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDecidePass(p.pending_pass!.id, "approved")
                                  }
                                  disabled={isUpdatingPass}
                                  title="Approve pass"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/60 text-[10px] text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                                >
                                  <Icon icon="mdi:check" className="w-3 h-3" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDecidePass(p.pending_pass!.id, "rejected")
                                  }
                                  disabled={isUpdatingPass}
                                  title="Decline pass"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/60 text-[10px] text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                                >
                                  <Icon icon="mdi:close" className="w-3 h-3" />
                                  Decline
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowInitiateModal(true)}
                                title="Initiate pass"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0369A1]/60 text-[10px] text-[#7FD5FF] hover:bg-[#0369A1]/20"
                              >
                                <Icon
                                  icon="mdi:calendar-plus-outline"
                                  className="w-3 h-3"
                                />
                                Pass
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Pass History Tab ──────────────────────────────── */}
        {activeTab === "history" && (
          <>
            {/* History Filters */}
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
                value={historyUnitFilter || null}
                onChange={(value) =>
                  setHistoryUnitFilter(value === null ? "" : Number(value))
                }
              />

              <SearchableSelect
                placeholder="All Ranks"
                searchPlaceholder="Search rank..."
                buttonClassName="py-1.5 px-2 text-xs"
                className="w-36"
                options={ranks.map((r) => ({ value: r.id, label: r.name }))}
                value={historyRankFilter || null}
                onChange={(value) =>
                  setHistoryRankFilter(value === null ? "" : Number(value))
                }
              />

              <select
                value={historyStatus}
                onChange={(e) =>
                  setHistoryStatus(e.target.value as PassRecordStatus | "")
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">All Status</option>
                {(
                  [
                    "pending",
                    "approved",
                    "active",
                    "completed",
                    "rejected",
                  ] as PassRecordStatus[]
                ).map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
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

            {/* Pass History Table */}
            <div className="overflow-x-auto pb-2">
              <table className="min-w-max w-full text-xs text-gray-200 whitespace-nowrap">
                <thead>
                  <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
                    <th className="px-4 sm:px-6 py-3 text-left">Personnel</th>
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Start Date</th>
                    <th className="px-4 py-3 text-left">End Date</th>
                    <th className="px-4 py-3 text-left">Duration</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Remarks</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isHistoryLoading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                        <div className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        No pass records found.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((pass, i) => (
                      <tr
                        key={pass.id}
                        tabIndex={0}
                        role="button"
                        title="Click to view the pass application"
                        onClick={(e) =>
                          onInteractiveRowClick(e, () =>
                            navigate(`/dashboard/personnel/pass/${pass.id}`),
                          )
                        }
                        onKeyDown={(e) =>
                          onInteractiveRowKeyDown(e, () =>
                            navigate(`/dashboard/personnel/pass/${pass.id}`),
                          )
                        }
                        className={cn(
                          "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors focus:outline-none focus:bg-[#0A4D66]/30",
                          i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                        )}
                      >
                        <td className="px-4 sm:px-6 py-3 text-white">
                          {pass.personnel
                            ? `${pass.personnel.firstname} ${pass.personnel.lastname}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {pass.personnel?.rank?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {formatDate(pass.start_date)}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {formatDate(pass.end_date)}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {pass.duration}d
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-xs font-medium capitalize",
                              RECORD_STATUS_COLORS[pass.status],
                            )}
                          >
                            {pass.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                          {pass.remarks ?? "—"}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <button
                            type="button"
                            ref={openActionId === pass.id ? actionButtonRef : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openActionId === pass.id) {
                                setOpenActionId(null);
                              } else {
                                actionButtonRef.current = e.currentTarget;
                                setOpenActionId(pass.id);
                              }
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                          >
                            <Icon icon="mdi:dots-vertical" className="w-4 h-4" />
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

      <InitiatePassModal
        open={showInitiateModal}
        onClose={() => setShowInitiateModal(false)}
      />

      <EditPassModal pass={editingPass} onClose={() => setEditingPass(null)} />
      {approvalPassId && (
        <ApprovalDialog
          module="passes"
          recordId={approvalPassId}
          title="Pass approval"
          onClose={() => {
            setApprovalPassId(null);
            if (searchParams.has("pass")) {
              searchParams.delete("pass");
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}

      <FloatingActionMenu
        open={openActionId !== null && openActionPass !== null}
        anchorRef={actionButtonRef}
        onClose={() => setOpenActionId(null)}
        widthClassName="w-40"
      >
        {openActionPass && (
          <div className="py-1 text-xs text-gray-200">
            <button
              type="button"
              onClick={() => {
                navigate(`/dashboard/personnel/pass/${openActionPass.id}`);
                setOpenActionId(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
            >
              <Icon icon="mdi:file-document-outline" className="w-4 h-4" />
              View Pass
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(`/dashboard/personnel/${openActionPass.personnel_id}`);
                setOpenActionId(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
            >
              <Icon icon="mdi:account-outline" className="w-4 h-4" />
              View Personnel
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingPass(openActionPass);
                setOpenActionId(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                handleDeletePass(openActionPass.id);
                setOpenActionId(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400"
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </FloatingActionMenu>
    </div>
  );
};
