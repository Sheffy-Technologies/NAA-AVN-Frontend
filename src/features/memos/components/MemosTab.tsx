import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppSelector } from "@/app/store";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useGetMemosQuery, type MemoBox, type MemoStatus } from "../api";
import { MEMO_STATUS_CLASSES, MEMO_STATUS_LABELS, formatMemoDate } from "../memoHelpers";

const BOXES: { key: MemoBox; label: string; icon: string }[] = [
  { key: "mine", label: "My Memos", icon: "mdi:file-document-edit-outline" },
  { key: "approvals", label: "Awaiting My Approval", icon: "mdi:draw-pen" },
  { key: "shared", label: "Shared With Me", icon: "mdi:account-arrow-left-outline" },
  { key: "all", label: "All Memos", icon: "mdi:file-cabinet" },
];

export const MemoStatusBadge = ({ status }: { status: MemoStatus }) => (
  <span className={cn("inline-flex px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap", MEMO_STATUS_CLASSES[status])}>
    {MEMO_STATUS_LABELS[status]}
  </span>
);

/** Documents page → Memos tab. */
export const MemosTab = () => {
  const navigate = useNavigate();
  const canViewAll = useAppSelector((state) => (state.auth.user?.permissions ?? []).includes("memos.viewAll"));
  const [box, setBox] = useState<MemoBox>("mine");
  const [status, setStatus] = useState<"" | MemoStatus>("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isFetching, isError, refetch } = useGetMemosQuery({
    box,
    status: status || undefined,
    q: search.trim() || undefined,
  });
  const memos = data?.data ?? [];
  const counts = data?.counts;

  const badge = (key: MemoBox) =>
    key === "approvals" ? counts?.awaiting_my_approval : key === "shared" ? counts?.unread_shared : undefined;

  const open = (id: number) => navigate(`/dashboard/documents/memos/${id}`);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
        <div className="flex flex-wrap gap-1.5">
          {BOXES.filter((b) => b.key !== "all" || canViewAll).map((b) => {
            const count = badge(b.key);
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBox(b.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors",
                  box === b.key
                    ? "bg-[#0A4D66] border-[#0A4D66] text-white"
                    : "border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30",
                )}
              >
                <Icon icon={b.icon} className="w-3.5 h-3.5" />
                {b.label}
                {!!count && <span className="ml-0.5 min-w-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-black">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="p-1.5 rounded border border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30"
            title="Refresh"
          >
            <Icon icon="mdi:refresh" className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard/documents/memos/new")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0369A1] text-white text-xs font-medium hover:bg-[#0369A1]/90"
          >
            <Icon icon="mdi:plus" className="w-4 h-4" />
            New Memo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, reference, to, from..."
            className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | MemoStatus)}
          className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
        >
          <option value="">All statuses</option>
          {(Object.keys(MEMO_STATUS_LABELS) as MemoStatus[]).map((s) => (
            <option key={s} value={s}>
              {MEMO_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="px-6 py-12 text-center text-xs text-gray-400">Loading memos…</div>
      ) : isError ? (
        <div className="px-6 py-12 text-center text-xs text-red-300">Memos could not be loaded.</div>
      ) : memos.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <Icon icon="mdi:file-document-outline" className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400">
            {box === "approvals" ? "No memos are waiting for your approval." : box === "shared" ? "No memos have been shared with you." : "No memos yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse text-xs text-gray-200">
            <thead>
              <tr className="border-b border-[#0A4D66]/40 text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-4 sm:px-6 py-2.5 font-medium">Reference</th>
                <th className="px-3 py-2.5 font-medium">Subject</th>
                <th className="px-3 py-2.5 font-medium">To / From</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">{box === "mine" ? "Approving Officer" : "Originator"}</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {memos.map((memo) => {
                const unread = memo.is_recipient && !memo.read_at;
                return (
                  <tr
                    key={memo.id}
                    tabIndex={0}
                    onClick={(e) => onInteractiveRowClick(e, () => open(memo.id))}
                    onKeyDown={(e) => onInteractiveRowKeyDown(e, () => open(memo.id))}
                    className="border-b border-[#0A4D66]/20 hover:bg-[#0A4D66]/20 cursor-pointer focus:outline-none focus:bg-[#0A4D66]/20"
                  >
                    <td className="px-4 sm:px-6 py-2.5 font-mono text-[11px] text-gray-300">
                      {memo.reference ?? <span className="text-gray-500">—</span>}
                    </td>
                    <td className={cn("px-3 py-2.5 max-w-80 truncate", unread && "font-semibold text-white")}>
                      {unread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7FD5FF] mr-1.5 align-middle" />}
                      {memo.subject}
                    </td>
                    <td className="px-3 py-2.5 text-gray-300">
                      {memo.to} <span className="text-gray-500">/</span> {memo.from}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatMemoDate(memo.memo_date)}</td>
                    <td className="px-3 py-2.5">{(box === "mine" ? memo.approving_officer?.name : memo.originator?.name) ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <MemoStatusBadge status={memo.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
