import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import {
  useDeleteWorkflowMutation,
  useGetApprovalModulesQuery,
  useGetWorkflowsQuery,
  useSaveWorkflowMutation,
  type ApprovalModuleInfo,
  type ApprovalModulesResponse,
  type ApprovalWorkflow,
  type ApproverType,
  type WorkflowStageInput,
} from "../api";

const humanizeStatus = (s: string | null) => (s ? s.replace(/_/g, " ") : "unchanged");

const errorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Could not save the workflow.";
};

const WorkflowEditor = ({
  module,
  workflow,
  options,
  onClose,
}: {
  module: ApprovalModuleInfo;
  workflow: ApprovalWorkflow | null;
  options: ApprovalModulesResponse;
  onClose: () => void;
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const [save, { isLoading }] = useSaveWorkflowMutation();
  const [name, setName] = useState(workflow?.name ?? `${module.label} approval`);
  const [active, setActive] = useState(workflow?.is_active ?? true);
  const [stages, setStages] = useState<WorkflowStageInput[]>(
    workflow?.stages.map((s) => ({ name: s.name, approver_type: s.approver_type, approver_value: String(s.approver_value) })) ?? [
      { name: "Approving Officer", approver_type: "role", approver_value: "" },
    ],
  );
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<WorkflowStageInput>) =>
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setStages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const valueOptions = (type: ApproverType) =>
    type === "role"
      ? options.roles.map((r) => ({ value: r, label: r }))
      : type === "permission"
        ? options.permissions.map((p) => ({ value: p, label: p }))
        : options.users.map((u) => ({ value: String(u.id), label: `${u.firstname} ${u.lastname} (${u.email})` }));

  const submit = async () => {
    if (stages.some((s) => !s.name.trim() || !s.approver_value)) {
      setError("Every stage needs a name and an approver.");
      return;
    }
    try {
      await save({ id: workflow?.id, module: module.key, name, is_active: active, stages }).unwrap();
      dispatch(showToast({ type: "success", message: "Workflow saved." }));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn("w-full max-w-2xl rounded-xl border p-6 shadow-2xl my-8", isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900")}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">{module.label} · approval workflow</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-300">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="sm:col-span-2">
              <span className="block font-semibold mb-1">Workflow name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </label>
            <label className="flex items-end gap-2 pb-2 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
              <span className="font-semibold">Approval required</span>
            </label>
          </div>

          <div className={cn("p-3 rounded-lg border", isDark ? "border-[#0A4D66]/40 bg-white/5" : "border-slate-200 bg-slate-50")}>
            <b>What approval controls for {module.label}:</b> records can't be set to{" "}
            {module.gated_statuses.map((s) => `"${humanizeStatus(s)}"`).join(", ") || "any locked status"} without approval. On submit the
            status becomes <i>{humanizeStatus(module.status_on_submit)}</i>, on approval <i>{humanizeStatus(module.status_on_approve)}</i>, and on
            rejection <i>{humanizeStatus(module.status_on_reject)}</i>.
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Stages (signed in this order)</span>
              <SecondaryButton
                icon="mdi:plus"
                onClick={() => setStages((prev) => [...prev, { name: `Stage ${prev.length + 1}`, approver_type: "role", approver_value: "" }])}
                disabled={stages.length >= 10}
              >
                Add stage
              </SecondaryButton>
            </div>
            <ol className="space-y-3">
              {stages.map((stage, i) => (
                <li key={i} className={cn("rounded-lg border p-3", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold bg-[#0A4D66] text-white">{i + 1}</span>
                    <input
                      value={stage.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      placeholder="e.g. Officer Commanding"
                      className={cn(fieldClass, "flex-1")}
                    />
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1 disabled:opacity-30">
                      <Icon icon="mdi:arrow-up" className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === stages.length - 1} aria-label="Move down" className="p-1 disabled:opacity-30">
                      <Icon icon="mdi:arrow-down" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStages((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={stages.length === 1}
                      aria-label="Remove stage"
                      className="p-1 text-red-500 disabled:opacity-30"
                    >
                      <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={stage.approver_type}
                      onChange={(e) => update(i, { approver_type: e.target.value as ApproverType, approver_value: "" })}
                      className={fieldClass}
                    >
                      <option value="role">Anyone with role</option>
                      <option value="permission">Anyone with permission</option>
                      <option value="user">A specific user</option>
                    </select>
                    <div className="sm:col-span-2">
                      <SearchableSelect
                        size="sm"
                        placeholder="Select approver…"
                        value={stage.approver_value || null}
                        onChange={(v) => update(i, { approver_value: v === null ? "" : String(v) })}
                        options={valueOptions(stage.approver_type)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-2 opacity-60">
              The submitter can never approve their own request, and one person can sign only one stage of a request. Changing stages
              doesn't affect requests already in progress.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton icon="mdi:content-save-outline" onClick={submit} disabled={isLoading}>
              {isLoading ? "Saving…" : "Save workflow"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export const WorkflowSettings = () => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const { has } = useSqPermissions();
  const { data: options, isLoading } = useGetApprovalModulesQuery();
  const { data: workflows = [] } = useGetWorkflowsQuery();
  const [save] = useSaveWorkflowMutation();
  const [remove] = useDeleteWorkflowMutation();
  const [editing, setEditing] = useState<ApprovalModuleInfo | null>(null);
  const byModule = useMemo(() => new Map(workflows.map((w) => [w.module, w])), [workflows]);
  const canEdit = has("approval-workflows.create") || has("approval-workflows.update");

  const toggle = async (w: ApprovalWorkflow) => {
    try {
      await save({ id: w.id, module: w.module, name: w.name, is_active: !w.is_active, stages: w.stages }).unwrap();
      dispatch(showToast({ type: "success", message: w.is_active ? "Approval switched off." : "Approval switched on." }));
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
    }
  };

  return (
    <SqPanel
      title="Workflow settings"
      subtitle="Choose which modules need approval and who signs at each stage. New modules appear here once they're registered on the server."
    >
      {isLoading || !options ? (
        <p className="text-xs opacity-60">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {options.modules.map((m) => {
            const w = byModule.get(m.key);
            return (
              <div key={m.key} className={cn("rounded-xl border p-4 flex flex-col", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold text-sm">{m.label}</div>
                  {w ? <SqStatus value={w.is_active ? "approved" : "not_applicable"} label={w.is_active ? "Approval on" : "Off"} /> : <SqStatus value="not_applicable" label="Not set up" />}
                </div>
                {w ? (
                  <ol className="text-xs space-y-1 mb-3 flex-1">
                    {w.stages.map((s) => (
                      <li key={s.id}>
                        <b>{s.sequence}.</b> {s.name} <span className="opacity-60">· {s.approver_label}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs opacity-60 mb-3 flex-1">Records in this module don't need approval.</p>
                )}
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton icon={w ? "mdi:pencil-outline" : "mdi:plus"} onClick={() => setEditing(m)}>
                      {w ? "Edit stages" : "Set up approval"}
                    </PrimaryButton>
                    {w && (
                      <SecondaryButton icon={w.is_active ? "mdi:toggle-switch-off-outline" : "mdi:toggle-switch-outline"} onClick={() => toggle(w)}>
                        {w.is_active ? "Switch off" : "Switch on"}
                      </SecondaryButton>
                    )}
                    {w && has("approval-workflows.delete") && (
                      <SecondaryButton
                        icon="mdi:trash-can-outline"
                        onClick={() => {
                          if (window.confirm(`Remove the ${m.label} workflow? Requests already in progress keep their stages.`)) {
                            remove(w.id);
                          }
                        }}
                      >
                        Remove
                      </SecondaryButton>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && options && (
        <WorkflowEditor module={editing} workflow={byModule.get(editing.key) ?? null} options={options} onClose={() => setEditing(null)} />
      )}
    </SqPanel>
  );
};
