import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton } from "@/shared/ui/button/BackButton";
import { downloadCsvFile } from "@/shared/utils/csv";
import { SignatureImage } from "@/features/approvals/components/ApprovalPanel";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus, SqTable, StatTile } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import { downloadSummaryPdf } from "@/features/safety/sqExport";
import {
  useDeleteGeneratorMutation,
  useDeleteUsageLogMutation,
  useGetGeneratorQuery,
  useGetUsageLogsQuery,
  type GeneratorUsageLog,
} from "../api";
import { GeneratorFormModal } from "../components/GeneratorFormModal";
import { UsageLogModal } from "../components/UsageLogModal";
import { GENERATOR_STATUS_LABEL, GENERATOR_STATUS_TONE, apiError, fmtDate, num } from "../generatorHelpers";

export const GeneratorDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const generatorId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState(false);
  const [logModal, setLogModal] = useState<{ open: boolean; log: GeneratorUsageLog | null }>({ open: false, log: null });
  const { data: generator, isLoading, isError } = useGetGeneratorQuery(generatorId);
  const { data: logs = [], isLoading: logsLoading } = useGetUsageLogsQuery({ generator_id: generatorId, from: from || undefined, to: to || undefined });
  const [deleteGenerator] = useDeleteGeneratorMutation();
  const [deleteLog] = useDeleteUsageLogMutation();

  if (isLoading) return <div className="p-10 text-center text-sm opacity-60">Loading…</div>;
  if (isError || !generator) return <div className="p-10 text-center text-sm opacity-60">Generator not found.</div>;

  const s = generator.summary;
  const canLog = has("generator-usage-logs.create");
  const canEditLog = has("generator-usage-logs.update");
  const canDeleteLog = has("generator-usage-logs.delete");

  const profile: Array<[string, string]> = [
    ["Manufacturer", generator.manufacturer ?? "–"],
    ["Model", generator.model ?? "–"],
    ["Serial number", generator.serial_number ?? "–"],
    ["Capacity", generator.capacity_kva ? `${num(generator.capacity_kva)} kVA` : "–"],
    ["Fuel type", generator.fuel_type ? generator.fuel_type[0].toUpperCase() + generator.fuel_type.slice(1) : "–"],
    ["Tank capacity", generator.fuel_tank_capacity_litres ? `${num(generator.fuel_tank_capacity_litres)} L` : "–"],
    ["Date purchased", fmtDate(generator.date_purchased)],
    ["Purchase cost", generator.purchase_cost != null ? num(generator.purchase_cost, 2) : "–"],
    ["Supplier", generator.supplier ?? "–"],
    ["Unit", generator.unit?.name ?? "–"],
    ["Location", generator.location ?? "–"],
    ["Opening hour-meter", `${num(generator.opening_hours)} hrs`],
    ["Service interval", generator.service_interval_hours ? `${num(generator.service_interval_hours, 0)} hrs` : "–"],
  ];

  const csvRows = (rows: GeneratorUsageLog[]) => [
    ["Date", "Time on", "Time off", "Hours worked", "Cumulative hours", "Opening fuel (L)", "Received (L)", "Total available (L)", "Closing fuel (L)", "Consumed (L)", "Operator", "Signed at", "Remarks"],
    ...rows.map((l) => [
      l.usage_date.slice(0, 10),
      l.time_on,
      l.time_off,
      String(l.hours_worked),
      String(l.cumulative_hours),
      String(l.fuel_opening_litres),
      String(l.fuel_received_litres),
      String(l.fuel_total_available_litres),
      String(l.fuel_closing_litres),
      String(l.fuel_consumed_litres),
      l.operator_name,
      new Date(l.signed_at).toLocaleString("en-GB"),
      l.remarks ?? "",
    ]),
  ];

  const exportPdf = () =>
    downloadSummaryPdf({
      formTitle: "GENERATOR LOG",
      title: `${generator.name}${generator.serial_number ? ` (S/N ${generator.serial_number})` : ""}`,
      fileName: `Generator log ${generator.name}`,
      fields: [
        ["Manufacturer", generator.manufacturer ?? "-"],
        ["Capacity", generator.capacity_kva ? `${num(generator.capacity_kva)} kVA` : "-"],
        ["Unit / location", [generator.unit?.name, generator.location].filter(Boolean).join(", ") || "-"],
        ["Period", from || to ? `${fmtDate(from || null)} – ${fmtDate(to || null)}` : "All entries"],
        ["Cumulative hours", `${num(s.cumulative_hours)} hrs`],
        ["Fuel consumed", `${num(s.fuel_consumed_litres)} L`],
        ["Average use", s.litres_per_hour != null ? `${num(s.litres_per_hour, 2)} L/hr` : "-"],
        ["Fuel balance", s.fuel_balance_litres != null ? `${num(s.fuel_balance_litres)} L` : "-"],
      ],
      tables: [
        {
          heading: "Run log",
          headers: ["Date", "On–Off", "Hrs", "Cum. hrs", "Open/Recv (L)", "Close/Used (L)", "Operator"],
          rows: [...logs].reverse().map((l) => [
            fmtDate(l.usage_date),
            `${l.time_on}–${l.time_off}`,
            num(l.hours_worked, 2),
            num(l.cumulative_hours),
            `${num(l.fuel_opening_litres)} / ${num(l.fuel_received_litres)}`,
            `${num(l.fuel_closing_litres)} / ${num(l.fuel_consumed_litres)}`,
            `${l.operator_name} (signed)`,
          ]),
          empty: "No runs recorded",
        },
      ],
    });

  const removeLog = async (log: GeneratorUsageLog) => {
    if (!window.confirm(`Delete the run of ${fmtDate(log.usage_date)} ${log.time_on}–${log.time_off}? Cumulative hours will be recalculated.`)) return;
    try {
      await deleteLog({ id: log.id, generator_id: generator.id }).unwrap();
      dispatch(showToast({ type: "success", message: "Run deleted." }));
    } catch (err) {
      dispatch(showToast({ type: "error", message: apiError(err) }));
    }
  };

  return (
    <div className="space-y-6">
      <BackButton fallbackUrl="/dashboard/assets?tab=generator" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 grid place-items-center shrink-0">
            {generator.image ? <img src={generator.image} alt="" className="w-full h-full object-cover" /> : <Icon icon="mdi:engine-outline" className="w-10 h-10 text-slate-400" />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>{generator.name}</h1>
              <SqStatus value={GENERATOR_STATUS_TONE[generator.status]} label={GENERATOR_STATUS_LABEL[generator.status]} />
            </div>
            <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-slate-500")}>
              {[generator.manufacturer, generator.model, generator.capacity_kva ? `${num(generator.capacity_kva)} kVA` : null].filter(Boolean).join(" · ") || "Generator"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canLog && generator.status !== "decommissioned" && (
            <PrimaryButton icon="mdi:clipboard-plus-outline" onClick={() => setLogModal({ open: true, log: null })}>
              Record run
            </PrimaryButton>
          )}
          {has("generators.update") && (
            <SecondaryButton icon="mdi:pencil-outline" onClick={() => setEditing(true)}>
              Edit
            </SecondaryButton>
          )}
          {has("generators.delete") && (
            <SecondaryButton
              icon="mdi:trash-can-outline"
              onClick={async () => {
                if (!window.confirm(`Delete ${generator.name} and its run log?`)) return;
                try {
                  await deleteGenerator(generator.id).unwrap();
                  navigate("/dashboard/assets?tab=generator");
                } catch (err) {
                  dispatch(showToast({ type: "error", message: apiError(err) }));
                }
              }}
            >
              Delete
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Cumulative hours" value={num(s.cumulative_hours)} sub={`${s.total_runs} runs · ${num(s.hours_logged)} hrs logged`} icon="mdi:timer-outline" />
        <StatTile label="Fuel balance" value={s.fuel_balance_litres != null ? `${num(s.fuel_balance_litres)} L` : "–"} sub="Closing balance of the last run" icon="mdi:gas-station-outline" />
        <StatTile label="Fuel consumed" value={`${num(s.fuel_consumed_litres)} L`} sub={`${num(s.fuel_received_litres)} L received`} icon="mdi:fuel" tone="amber" />
        <StatTile label="Average use" value={s.litres_per_hour != null ? `${num(s.litres_per_hour, 2)} L/hr` : "–"} sub={`Last run ${fmtDate(s.last_run_date)}`} icon="mdi:chart-line" tone="emerald" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SqPanel title="Generator details" className="xl:col-span-1">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            {profile.map(([k, v]) => (
              <div key={k}>
                <dt className={cn(isDark ? "text-gray-400" : "text-slate-500")}>{k}</dt>
                <dd className="font-semibold break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {generator.notes && <p className="text-xs mt-4 pt-3 border-t dark:border-[#0A4D66]/40 whitespace-pre-wrap">{generator.notes}</p>}
        </SqPanel>

        <SqPanel
          title="Usage log"
          subtitle="Hours worked, cumulative hours, total available and fuel used are calculated. Each entry is signed by the operator."
          className="xl:col-span-2"
          action={
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                icon="mdi:file-delimited-outline"
                disabled={!logs.length}
                onClick={() => downloadCsvFile(`generator-${generator.name}-log-${new Date().toISOString().slice(0, 10)}.csv`, csvRows([...logs].reverse()))}
              >
                CSV
              </SecondaryButton>
              <SecondaryButton icon="mdi:file-pdf-box" disabled={!logs.length} onClick={exportPdf}>
                PDF
              </SecondaryButton>
            </div>
          }
        >
          <div className="flex flex-wrap items-end gap-3 mb-4 text-xs">
            <label>
              <span className="block font-semibold mb-1">From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
            </label>
            <label>
              <span className="block font-semibold mb-1">To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
            </label>
            {(from || to) && (
              <SecondaryButton
                icon="mdi:close"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Clear
              </SecondaryButton>
            )}
          </div>
          <SqTable<GeneratorUsageLog>
            rows={logs}
            loading={logsLoading}
            rowKey={(l) => l.id}
            empty={canLog ? "No runs recorded yet. Use Record run to add the first entry." : "No runs recorded yet."}
            columns={[
              { key: "date", label: "Date", render: (l) => <span className="whitespace-nowrap">{fmtDate(l.usage_date)}</span> },
              { key: "on", label: "Time on", render: (l) => l.time_on },
              { key: "off", label: "Time off", render: (l) => (l.time_off < l.time_on ? `${l.time_off} (+1)` : l.time_off) },
              { key: "hrs", label: "Hrs worked", render: (l) => num(l.hours_worked, 2) },
              { key: "cum", label: "Cum. hrs", render: (l) => <span className="font-semibold">{num(l.cumulative_hours)}</span> },
              { key: "open", label: "Opening (L)", render: (l) => num(l.fuel_opening_litres) },
              { key: "recv", label: "Received (L)", render: (l) => (l.fuel_received_litres ? num(l.fuel_received_litres) : "–") },
              { key: "avail", label: "Total avail. (L)", render: (l) => num(l.fuel_total_available_litres) },
              { key: "close", label: "Closing (L)", render: (l) => num(l.fuel_closing_litres) },
              { key: "used", label: "Used (L)", render: (l) => num(l.fuel_consumed_litres) },
              {
                key: "op",
                label: "Operator",
                render: (l) => (
                  <div className="min-w-[150px]">
                    <div className="font-semibold">{l.operator_name}</div>
                    <SignatureImage path={l.signature_url_path} className="h-9 mt-1" />
                    <div className="text-[10px] opacity-60">Signed {new Date(l.signed_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</div>
                  </div>
                ),
              },
              {
                key: "actions",
                label: "",
                align: "right",
                render: (l) => (
                  <div className="flex justify-end gap-1">
                    {canEditLog && (
                      <button type="button" aria-label="Correct entry" title="Correct (needs re-signing)" onClick={() => setLogModal({ open: true, log: l })} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10">
                        <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                      </button>
                    )}
                    {canDeleteLog && (
                      <button type="button" aria-label="Delete entry" onClick={() => removeLog(l)} className="p-1.5 rounded text-red-500 hover:bg-red-500/10">
                        <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {logs.some((l) => l.remarks) && (
            <div className="mt-4 pt-3 border-t dark:border-[#0A4D66]/40 text-xs space-y-1">
              <div className="font-semibold">Remarks</div>
              {logs
                .filter((l) => l.remarks)
                .map((l) => (
                  <p key={l.id}>
                    <span className="opacity-60">{fmtDate(l.usage_date)}:</span> {l.remarks}
                  </p>
                ))}
            </div>
          )}
        </SqPanel>
      </div>

      {editing && <GeneratorFormModal generator={generator} onClose={() => setEditing(false)} />}
      {logModal.open && <UsageLogModal generator={generator} log={logModal.log} onClose={() => setLogModal({ open: false, log: null })} />}
    </div>
  );
};
