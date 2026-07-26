import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { PersonnelModuleTabs } from "../components/PersonnelModuleTabs";
import { InitiatePassModal } from "../components/InitiatePassModal";
import {
  useGetPersonnelPassQuery,
  useGetPassesQuery,
  useDeletePassMutation,
  type PassStatus,
  type PassRecordStatus,
} from "../passApi";
import { useGetPersonnelRanksQuery } from "../api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

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
  const [statusFilter, setStatusFilter] = useState<PassStatus | "">("");
  const [passSearch, setPassSearch] = useState("");

  // Filters – History tab
  const [historyStatus, setHistoryStatus] = useState<PassRecordStatus | "">("");
  const [historyUnitFilter, setHistoryUnitFilter] = useState<number | "">("");
  const [historyRankFilter, setHistoryRankFilter] = useState<number | "">("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLTableCellElement>(null);

  useClickOutside(actionMenuRef, () => setOpenActionId(null), openActionId !== null);

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

  const handleDeletePass = async (id: number) => {
    if (!window.confirm("Delete this pass record?")) return;
    try {
      await deletePass(id).unwrap();
      dispatch(showToast({ message: "Pass deleted", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to delete pass", type: "error" }));
    }
  };

  const filteredPersonnel = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    if (!q) return personnelPass;
    return personnelPass.filter(
      (p) =>
        p.firstname.toLowerCase().includes(q) ||
        p.lastname.toLowerCase().includes(q) ||
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

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">

        {/* Module-level tab bar */}
        <PersonnelModuleTabs />

        {/* Pass page header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
            Pass Management
          </h2>
          <button
            type="button"
            onClick={() => setShowInitiateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90"
          >
            <Icon icon="mdi:plus" className="w-4 h-4" />
            Initiate Pass
          </button>
        </div>

        {/* Inner tabs: Personnel | Pass History */}
        <div className="flex items-center gap-1 border-b border-[#0A4D66]/40 px-4 sm:px-6">
          {(["personnel", "history"] as PassTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors capitalize",
                activeTab === tab
                  ? "border-[#7FD5FF] text-white"
                  : "border-transparent text-gray-400 hover:text-gray-200",
              )}
            >
              {tab === "personnel" ? "Personnel" : "Pass History"}
            </button>
          ))}
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

              <select
                value={unitFilter}
                onChange={(e) =>
                  setUnitFilter(e.target.value ? Number(e.target.value) : "")
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">All Units</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                value={rankFilter}
                onChange={(e) =>
                  setRankFilter(e.target.value ? Number(e.target.value) : "")
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">All Ranks</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

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
                        className={cn(
                          "border-t border-[#0A4D66]/40",
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

              <select
                value={historyUnitFilter}
                onChange={(e) =>
                  setHistoryUnitFilter(e.target.value ? Number(e.target.value) : "")
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">All Units</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                value={historyRankFilter}
                onChange={(e) =>
                  setHistoryRankFilter(e.target.value ? Number(e.target.value) : "")
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">All Ranks</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

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
                        className={cn(
                          "border-t border-[#0A4D66]/40",
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
                        <td
                          className="relative px-4 sm:px-6 py-3 text-right"
                          ref={openActionId === pass.id ? actionMenuRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionId((c) =>
                                c === pass.id ? null : pass.id,
                              )
                            }
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                          >
                            <Icon icon="mdi:dots-vertical" className="w-4 h-4" />
                          </button>
                          {openActionId === pass.id && (
                            <div className="absolute right-4 top-9 z-20 w-40 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl">
                              <div className="py-1 text-xs text-gray-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(
                                      `/dashboard/personnel/${pass.personnel_id}`,
                                    );
                                    setOpenActionId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                                >
                                  <Icon
                                    icon="mdi:account-outline"
                                    className="w-4 h-4"
                                  />
                                  View Personnel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeletePass(pass.id);
                                    setOpenActionId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400"
                                >
                                  <Icon
                                    icon="mdi:trash-can-outline"
                                    className="w-4 h-4"
                                  />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
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
    </div>
  );
};
