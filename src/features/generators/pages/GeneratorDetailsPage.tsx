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
  useDeleteFuelDayMutation,
  useDeleteGeneratorMutation,
  useDeleteMaintenanceLogMutation,
  useDeleteUsageLogMutation,
  useGetFuelDaysQuery,
  useGetGeneratorQuery,
  useGetMaintenanceLogsQuery,
  useGetUsageLogsQuery,
  type GeneratorFuelDay,
  type GeneratorMaintenanceLog,
  type GeneratorUsageLog,
} from "../api";
import { FuelDayModal } from "../components/FuelDayModal";
import { GeneratorFormModal } from "../components/GeneratorFormModal";
import { MaintenanceLogModal } from "../components/MaintenanceLogModal";
import { UsageLogModal } from "../components/UsageLogModal";
import { GENERATOR_STATUS_LABEL, GENERATOR_STATUS_TONE, MAINTENANCE_TYPE_LABEL, apiError, fmtDate, hoursMinutes, num, serviceCountdown } from "../generatorHelpers";

/** Litres, or a dash when the figure wasn't recorded. */
const litres = (value: number | null | undefined) => (value === null || value === undefined ? "–" : num(value));

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
  const [fuelDay, setFuelDay] = useState<GeneratorFuelDay | null>(null);
  const [maintModal, setMaintModal] = useState<{ open: boolean; log: GeneratorMaintenanceLog | null }>({ open: false, log: null });
  const { data: generator, isLoading, isError } = useGetGeneratorQuery(generatorId);
  const { data: logs = [], isLoading: logsLoading } = useGetUsageLogsQuery({ generator_id: generatorId, from: from || undefined, to: to || undefined });
  const { data: days = [], isLoading: daysLoading } = useGetFuelDaysQuery({ generator_id: generatorId, from: from || undefined, to: to || undefined });
  const { data: maintenanceLogs = [], isLoading: maintLoading } = useGetMaintenanceLogsQuery(generatorId);
  const [deleteGenerator] = useDeleteGeneratorMutation();
  const [deleteLog] = useDeleteUsageLogMutation();
  const [deleteFuelDay] = useDeleteFuelDayMutation();
  const [deleteMaintenance] = useDeleteMaintenanceLogMutation();

  if (isLoading) return <div className="p-10 text-center text-sm opacity-60">Loading…</div>;
  if (isError || !generator) return <div className="p-10 text-center text-sm opacity-60">Generator not found.</div>;

  const s = generator.summary;
  const service = serviceCountdown(s.maintenance);
  const canMaintain = has("generator-maintenance-logs.create");
  const canLog = has("generator-usage-logs.create");
  const canEditLog = has("generator-usage-logs.update");
  const canDeleteLog = has("generator-usage-logs.delete");

  // Total time worked per day, from the server's daily figures. Shown on the
  // first row of each date in the run log (the list is newest first, so that's
  // the day's last run).
  const dayHours = new Map(days.map((d) => [d.date.slice(0, 10), d.hours_worked]));
  const firstRunOfDate = new Set(
    logs.filter((l, i) => i === 0 || logs[i - 1].usage_date.slice(0, 10) !== l.usage_date.slice(0, 10)).map((l) => l.id),
  );
  const dayTotal = (l: GeneratorUsageLog) => (firstRunOfDate.has(l.id) ? dayHours.get(l.usage_date.slice(0, 10)) ?? null : null);

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
    [
      "Last service",
      `${num(s.maintenance.last_service_hours)} hrs${s.maintenance.last_service_date ? ` (${fmtDate(s.maintenance.last_service_date)})` : ""}`,
    ],
    ["Next service due", s.maintenance.next_service_at_hours !== null ? `${num(s.maintenance.next_service_at_hours)} hrs` : "–"],
  ];

  const csvRows = (rows: GeneratorUsageLog[]) => [
    ["Date", "Time on", "Time off", "Hours worked", "Day total hours", "Cumulative hours", "Opening fuel (L)", "Received (L)", "Total available (L)", "Closing fuel (L)", "Consumed (L)", "Operator", "Signed at", "Remarks"],
    ...rows.map((l) => [
      l.usage_date.slice(0, 10),
      l.time_on,
      l.time_off,
      String(l.hours_worked),
      dayTotal(l) !== null ? String(dayTotal(l)) : "",
      String(l.cumulative_hours),
      String(l.fuel_opening_litres ?? ""),
      String(l.fuel_received_litres),
      String(l.fuel_total_available_litres ?? ""),
      String(l.fuel_closing_litres ?? ""),
      String(l.fuel_consumed_litres ?? ""),
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
        ["Next service", service.text],
      ],
      tables: [
        {
          heading: "Run log",
          headers: ["Date", "On–Off", "Hrs", "Day total", "Cum. hrs", "Open/Recv (L)", "Close/Used (L)", "Operator"],
          rows: [...logs].reverse().map((l) => [
            fmtDate(l.usage_date),
            `${l.time_on}–${l.time_off}`,
            num(l.hours_worked, 2),
            dayTotal(l) !== null ? hoursMinutes(dayTotal(l)) : "",
            num(l.cumulative_hours),
            `${litres(l.fuel_opening_litres)} / ${num(l.fuel_received_litres)}`,
            `${litres(l.fuel_closing_litres)} / ${litres(l.fuel_consumed_litres)}`,
            `${l.operator_name} (signed)`,
          ]),
          empty: "No runs recorded",
        },
        {
          heading: "Daily fuel",
          headers: ["Date", "Times used", "Total time worked", "Cum. hrs", "Opening (L)", "Received (L)", "Day closing (L)", "Used (L)", "L/hr"],
          rows: [...days].reverse().map((d) => [
            fmtDate(d.date),
            String(d.runs),
            `${hoursMinutes(d.hours_worked)} (${num(d.hours_worked, 2)} h)`,
            d.cumulative_hours !== null ? num(d.cumulative_hours) : "–",
            litres(d.fuel_opening_litres),
            num(d.fuel_received_litres),
            `${litres(d.fuel_closing_litres)}${d.closing_source === "day" ? ` (signed: ${d.fuel_day?.operator_name})` : ""}`,
            litres(d.fuel_consumed_litres),
            d.litres_per_hour !== null ? num(d.litres_per_hour, 2) : "–",
          ]),
          empty: "No days recorded",
        },
        {
          heading: "Maintenance",
          headers: ["Date", "Hour-meter", "Type", "Work done", "By", "Restarts countdown"],
          rows: [...maintenanceLogs].reverse().map((m) => [
            fmtDate(m.service_date),
            `${num(m.hour_meter_reading)} hrs`,
            MAINTENANCE_TYPE_LABEL[m.maintenance_type] ?? m.maintenance_type,
            m.description ?? "",
            m.performed_by ?? "",
            m.resets_service_counter ? "Yes" : "No",
          ]),
          empty: "No maintenance logged",
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

  const clearDay = async (day: GeneratorFuelDay) => {
    if (!window.confirm(`Remove the signed closing balance for ${fmtDate(day.date)}? The day will fall back to its last run's closing balance.`)) return;
    try {
      await deleteFuelDay({ generator_id: generator.id, date: day.date }).unwrap();
      dispatch(showToast({ type: "success", message: "Day closing balance removed." }));
    } catch (err) {
      dispatch(showToast({ type: "error", message: apiError(err) }));
    }
  };

  const removeMaintenance = async (m: GeneratorMaintenanceLog) => {
    if (!window.confirm(`Delete the ${MAINTENANCE_TYPE_LABEL[m.maintenance_type] ?? "maintenance"} entry of ${fmtDate(m.service_date)}?`)) return;
    try {
      await deleteMaintenance({ id: m.id, generator_id: generator.id }).unwrap();
      dispatch(showToast({ type: "success", message: "Maintenance entry deleted." }));
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
          {canMaintain && (
            <SecondaryButton icon="mdi:wrench-outline" onClick={() => setMaintModal({ open: true, log: null })}>
              Log maintenance
            </SecondaryButton>
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Cumulative hours" value={num(s.cumulative_hours)} sub={`${s.total_runs} runs · ${num(s.hours_logged)} hrs logged`} icon="mdi:timer-outline" />
        <StatTile label="Fuel balance" value={s.fuel_balance_litres != null ? `${num(s.fuel_balance_litres)} L` : "–"} sub="Latest closing balance" icon="mdi:gas-station-outline" />
        <StatTile label="Fuel consumed" value={`${num(s.fuel_consumed_litres)} L`} sub={`${num(s.fuel_received_litres)} L received`} icon="mdi:fuel" tone="amber" />
        <StatTile label="Average use" value={s.litres_per_hour != null ? `${num(s.litres_per_hour, 2)} L/hr` : "–"} sub={`Last run ${fmtDate(s.last_run_date)}`} icon="mdi:chart-line" tone="emerald" />
        <StatTile
          label="Next service"
          value={service.text}
          sub={
            s.maintenance.next_service_at_hours !== null
              ? `Due at ${num(s.maintenance.next_service_at_hours)} hrs · ${num(s.maintenance.hours_since_service)} hrs since last`
              : "Set a service interval to count down"
          }
          icon="mdi:wrench-clock"
          tone={service.tone}
        />
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
              {
                key: "day",
                label: "Day total",
                render: (l) => {
                  const total = dayTotal(l);
                  return total === null ? null : (
                    <span className="whitespace-nowrap font-semibold" title={`${num(total, 2)} hours worked on ${fmtDate(l.usage_date)}`}>
                      {hoursMinutes(total)}
                    </span>
                  );
                },
              },
              { key: "cum", label: "Cum. hrs", render: (l) => <span className="font-semibold">{num(l.cumulative_hours)}</span> },
              { key: "open", label: "Opening (L)", render: (l) => litres(l.fuel_opening_litres) },
              { key: "recv", label: "Received (L)", render: (l) => (l.fuel_received_litres ? num(l.fuel_received_litres) : "–") },
              { key: "avail", label: "Total avail. (L)", render: (l) => litres(l.fuel_total_available_litres) },
              { key: "close", label: "Closing (L)", render: (l) => litres(l.fuel_closing_litres) },
              { key: "used", label: "Used (L)", render: (l) => litres(l.fuel_consumed_litres) },
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

      <SqPanel
        title="Daily fuel"
        subtitle="One line per day, however many runs. Used = day opening + received − day closing. Record the day's closing balance when the individual run balances aren't known."
      >
        <SqTable<GeneratorFuelDay>
          rows={days}
          loading={daysLoading}
          rowKey={(d) => d.date}
          empty="No days recorded yet."
          columns={[
            { key: "date", label: "Date", render: (d) => <span className="whitespace-nowrap font-semibold">{fmtDate(d.date)}</span> },
            { key: "runs", label: "Times used", render: (d) => d.runs },
            {
              key: "hrs",
              label: "Total time worked",
              render: (d) => (
                <span className="whitespace-nowrap">
                  <span className="font-semibold">{hoursMinutes(d.hours_worked)}</span>
                  <span className="opacity-60"> ({num(d.hours_worked, 2)} h)</span>
                </span>
              ),
            },
            {
              key: "cum",
              label: "Cum. hrs (end of day)",
              render: (d) => <span className="font-semibold">{d.cumulative_hours !== null ? num(d.cumulative_hours) : "–"}</span>,
            },
            { key: "open", label: "Opening (L)", render: (d) => litres(d.fuel_opening_litres) },
            { key: "recv", label: "Received (L)", render: (d) => (d.fuel_received_litres ? num(d.fuel_received_litres) : "–") },
            {
              key: "close",
              label: "Day closing (L)",
              render: (d) => (
                <div className="min-w-[120px]">
                  <div className="font-semibold">{litres(d.fuel_closing_litres)}</div>
                  {d.closing_source === "day" && d.fuel_day ? (
                    <div className="text-[10px] opacity-70">
                      Signed by {d.fuel_day.operator_name}
                      <SignatureImage path={d.fuel_day.signature_url_path} className="h-8 mt-1" />
                    </div>
                  ) : d.closing_source === "last_run" ? (
                    <div className="text-[10px] opacity-60">From the last run</div>
                  ) : (
                    <div className="text-[10px] text-amber-600 dark:text-amber-300">Not recorded</div>
                  )}
                </div>
              ),
            },
            { key: "used", label: "Used (L)", render: (d) => <span className="font-semibold">{litres(d.fuel_consumed_litres)}</span> },
            { key: "lph", label: "L / hr", render: (d) => (d.litres_per_hour !== null ? num(d.litres_per_hour, 2) : "–") },
            {
              key: "actions",
              label: "",
              align: "right",
              render: (d) => (
                <div className="flex justify-end gap-1">
                  {canLog && (
                    <button
                      type="button"
                      title={d.fuel_day ? "Correct the day closing (needs re-signing)" : "Record the day closing balance"}
                      onClick={() => setFuelDay(d)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border border-slate-300 dark:border-[#0A4D66] hover:bg-slate-100 dark:hover:bg-white/10 whitespace-nowrap"
                    >
                      <Icon icon={d.fuel_day ? "mdi:pencil-outline" : "mdi:gas-station-outline"} className="w-3.5 h-3.5" />
                      {d.fuel_day ? "Correct" : "Day closing"}
                    </button>
                  )}
                  {canDeleteLog && d.fuel_day && (
                    <button type="button" aria-label="Remove day closing" onClick={() => clearDay(d)} className="p-1.5 rounded text-red-500 hover:bg-red-500/10">
                      <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </SqPanel>

      <SqPanel
        title="Maintenance"
        subtitle={
          generator.service_interval_hours
            ? `Serviced every ${num(generator.service_interval_hours, 0)} hrs. Logging a service restarts the countdown from its hour-meter reading.`
            : "Set a service interval on the generator (Edit) to count down to the next service."
        }
        action={
          canMaintain ? (
            <PrimaryButton icon="mdi:wrench-outline" onClick={() => setMaintModal({ open: true, log: null })}>
              Log maintenance
            </PrimaryButton>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <SqStatus value={service.badge} label={service.label} />
          <span>{service.text}</span>
          {s.maintenance.next_service_at_hours !== null && (
            <span className="opacity-70">
              · next at {num(s.maintenance.next_service_at_hours)} hrs, now {num(s.cumulative_hours)} hrs
            </span>
          )}
        </div>
        <SqTable<GeneratorMaintenanceLog>
          rows={maintenanceLogs}
          loading={maintLoading}
          rowKey={(m) => m.id}
          empty="No maintenance logged yet."
          columns={[
            { key: "date", label: "Date", render: (m) => <span className="whitespace-nowrap">{fmtDate(m.service_date)}</span> },
            { key: "reading", label: "Hour-meter", render: (m) => <span className="font-semibold">{num(m.hour_meter_reading)} hrs</span> },
            { key: "type", label: "Type", render: (m) => MAINTENANCE_TYPE_LABEL[m.maintenance_type] ?? m.maintenance_type },
            { key: "work", label: "Work done", render: (m) => <span className="block max-w-[320px] whitespace-pre-wrap">{m.description ?? "–"}</span> },
            { key: "by", label: "Performed by", render: (m) => m.performed_by ?? "–" },
            { key: "cost", label: "Cost", render: (m) => (m.cost != null ? num(m.cost, 2) : "–") },
            {
              key: "reset",
              label: "Countdown",
              render: (m) => (m.resets_service_counter ? <SqStatus value="completed" label="Restarted" /> : <span className="opacity-60">Not restarted</span>),
            },
            {
              key: "actions",
              label: "",
              align: "right",
              render: (m) => (
                <div className="flex justify-end gap-1">
                  {has("generator-maintenance-logs.update") && (
                    <button type="button" aria-label="Edit entry" onClick={() => setMaintModal({ open: true, log: m })} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10">
                      <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                    </button>
                  )}
                  {has("generator-maintenance-logs.delete") && (
                    <button type="button" aria-label="Delete entry" onClick={() => removeMaintenance(m)} className="p-1.5 rounded text-red-500 hover:bg-red-500/10">
                      <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </SqPanel>

      {fuelDay && <FuelDayModal generator={generator} day={fuelDay} onClose={() => setFuelDay(null)} />}
      {maintModal.open && <MaintenanceLogModal generator={generator} log={maintModal.log} onClose={() => setMaintModal({ open: false, log: null })} />}
      {editing && <GeneratorFormModal generator={generator} onClose={() => setEditing(false)} />}
      {logModal.open && <UsageLogModal generator={generator} log={logModal.log} onClose={() => setLogModal({ open: false, log: null })} />}
    </div>
  );
};
