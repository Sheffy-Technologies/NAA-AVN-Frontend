import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { SqPanel, SqStatus, SqTable, SecondaryButton } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import { useGetApprovalModulesQuery, useGetApprovalsQuery, type ApprovalRequestRow, type ApprovalStatus } from "../api";
import { ApprovalRequestCard } from "../components/ApprovalPanel";
import { WorkflowSettings } from "../components/WorkflowSettings";

type Box = "inbox" | "submitted" | "all" | "settings";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const Progress = ({ r }: { r: ApprovalRequestRow }) => {
  const done = r.stages.filter((s) => s.state === "approved").length;
  const current = r.stages.find((s) => s.state === "current");
  return (
    <div>
      <div className="flex gap-1 mb-1">
        {r.stages.map((s) => (
          <span
            key={s.sequence}
            className={cn(
              "h-1.5 w-6 rounded-full",
              s.state === "approved" ? "bg-emerald-500" : s.state === "rejected" ? "bg-red-500" : s.state === "current" ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-600",
            )}
          />
        ))}
      </div>
      <div className="text-[11px] opacity-70">{current ? `Stage ${current.sequence}: ${current.name}` : `${done}/${r.stages.length} signed`}</div>
    </div>
  );
};

export const ApprovalsPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const canConfigure = has("approval-workflows.viewAny");
  const [box, setBox] = useState<Box>("inbox");
  const [module, setModule] = useState("");
  const [status, setStatus] = useState<ApprovalStatus | "">("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: rows = [], isFetching, refetch } = useGetApprovalsQuery(
    { box: box === "settings" ? "inbox" : box, module: module || undefined, status: status || undefined },
    { skip: box === "settings" },
  );
  const { data: modules } = useGetApprovalModulesQuery(undefined, { skip: !canConfigure });
  const { data: inbox = [] } = useGetApprovalsQuery({ box: "inbox" });
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const moduleOptions = useMemo(() => {
    const fromRows = rows.map((r) => [r.module, r.module_label] as const);
    const fromConfig = (modules?.modules ?? []).map((m) => [m.key, m.label] as const);
    return Array.from(new Map([...fromConfig, ...fromRows]).entries());
  }, [rows, modules]);

  const tabs: Array<{ id: Box; label: string; icon: string; count?: number }> = [
    { id: "inbox", label: "Awaiting my approval", icon: "mdi:inbox-arrow-down-outline", count: inbox.length },
    { id: "submitted", label: "My submissions", icon: "mdi:send-outline" },
    { id: "all", label: "All requests", icon: "mdi:format-list-checks" },
    ...(canConfigure ? [{ id: "settings" as const, label: "Workflow settings", icon: "mdi:cog-outline" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={cn("text-2xl font-bold uppercase tracking-wide", isDark ? "text-white" : "text-slate-900")}>Approvals</h1>
        <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-slate-500")}>
          Review and sign requests sent to you. Each stage is signed with a drawn signature.
        </p>
      </div>

      <div className={cn("border-b overflow-x-auto", isDark ? "border-[#0A4D66]/40" : "border-slate-300")}>
        <div className="flex space-x-2 sm:space-x-4">
          {tabs.map((tab) => {
            const active = box === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setBox(tab.id);
                  setSelectedId(null);
                }}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap rounded-t-lg transition-all",
                  active
                    ? isDark
                      ? "text-[#7FD5FF] font-bold bg-[#7FD5FF]/10"
                      : "text-sky-600 font-bold bg-sky-50"
                    : isDark
                      ? "text-gray-400 hover:text-white hover:bg-white/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                <Icon icon={tab.icon} className="w-5 h-5" />
                <span>{tab.label}</span>
                {!!tab.count && <span className="ml-1 px-1.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{tab.count}</span>}
                {active && <div className={cn("absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full", isDark ? "bg-[#00A3E0]" : "bg-sky-600")} />}
              </button>
            );
          })}
        </div>
      </div>

      {box === "settings" ? (
        <WorkflowSettings />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <SqPanel
            className="xl:col-span-3"
            title={tabs.find((t) => t.id === box)?.label}
            action={
              <SecondaryButton icon="mdi:refresh" onClick={() => refetch()} disabled={isFetching}>
                Refresh
              </SecondaryButton>
            }
          >
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={module} onChange={(e) => setModule(e.target.value)} className={cn(fieldClass, "w-auto")}>
                <option value="">All modules</option>
                {moduleOptions.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              {box !== "inbox" && (
                <select value={status} onChange={(e) => setStatus(e.target.value as ApprovalStatus | "")} className={cn(fieldClass, "w-auto")}>
                  <option value="">All statuses</option>
                  {["pending", "approved", "rejected", "cancelled"].map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <SqTable<ApprovalRequestRow>
              rows={rows}
              loading={isFetching && !rows.length}
              rowKey={(r) => r.id}
              onRowClick={(r) => setSelectedId(r.id)}
              empty={box === "inbox" ? "Nothing is waiting for your signature." : "No approval requests."}
              columns={[
                {
                  key: "title",
                  label: "Request",
                  render: (r) => (
                    <div className={cn(selectedId === r.id && "text-sky-600 dark:text-[#7FD5FF]")}>
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-[11px] opacity-70">
                        {r.module_label}
                        {r.unit ? ` · ${r.unit.name}` : ""}
                      </div>
                    </div>
                  ),
                },
                { key: "by", label: "Submitted", render: (r) => <div>{r.submitted_by?.name ?? "-"}<div className="text-[11px] opacity-70">{formatDate(r.submitted_at)}</div></div> },
                { key: "progress", label: "Progress", render: (r) => <Progress r={r} /> },
                { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={r.status === "pending" ? "in_progress" : r.status} label={r.status === "pending" ? "Pending" : undefined} /> },
              ]}
            />
          </SqPanel>

          <SqPanel className="xl:col-span-2" title={selected ? selected.title : "Request details"} subtitle={selected?.module_label}>
            {selected ? (
              <div className="space-y-4">
                <ApprovalRequestCard request={selected} />
                {selected.frontend_path && (
                  <SecondaryButton icon="mdi:open-in-new" onClick={() => navigate(selected.frontend_path as string, { state: { from: "/dashboard/approvals", fromLabel: "Approvals" } })}>
                    Open the record
                  </SecondaryButton>
                )}
              </div>
            ) : (
              <p className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>Select a request to review and sign it.</p>
            )}
          </SqPanel>
        </div>
      )}
    </div>
  );
};
