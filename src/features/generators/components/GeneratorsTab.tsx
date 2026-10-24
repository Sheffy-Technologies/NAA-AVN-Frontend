import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { downloadCsvFile } from "@/shared/utils/csv";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus, SqTable, StatTile } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import { useGetGeneratorsQuery, type Generator } from "../api";
import { GENERATOR_STATUS_LABEL, GENERATOR_STATUS_TONE, fmtDate, num, serviceCountdown } from "../generatorHelpers";
import { GeneratorFormModal } from "./GeneratorFormModal";

/** "Generators" tab of the Assets page. */
export const GeneratorsTab = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"table" | "grid">("table");
  const [adding, setAdding] = useState(false);
  const { data: generators = [], isLoading } = useGetGeneratorsQuery({ q: q || undefined, status: status || undefined });
  const { data: all = [] } = useGetGeneratorsQuery();
  const open = (id: number) => navigate(`/dashboard/assets/generators/${id}`, { state: { from: "/dashboard/assets?tab=generator", fromLabel: "Generators" } });

  const exportCsv = () =>
    downloadCsvFile(`generators-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Name", "Manufacturer", "Model", "Serial", "Capacity (kVA)", "Fuel", "Unit", "Location", "Date purchased", "Cumulative hours", "Fuel balance (L)", "Last run", "Next service", "Status"],
      ...generators.map((g) => [
        g.name,
        g.manufacturer ?? "",
        g.model ?? "",
        g.serial_number ?? "",
        g.capacity_kva != null ? String(g.capacity_kva) : "",
        g.fuel_type ?? "",
        g.unit?.name ?? "",
        g.location ?? "",
        g.date_purchased?.slice(0, 10) ?? "",
        String(g.cumulative_hours ?? g.opening_hours),
        g.fuel_balance_litres != null ? String(g.fuel_balance_litres) : "",
        g.last_run_date ?? "",
        serviceCountdown(g.maintenance).text,
        GENERATOR_STATUS_LABEL[g.status],
      ]),
    ]);

  const count = (s: string) => all.filter((g) => g.status === s).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Generators" value={all.length} sub="In your units" icon="mdi:engine-outline" />
        <StatTile label="Operational" value={count("operational")} sub="Ready to run" icon="mdi:check-circle-outline" tone="emerald" />
        <StatTile label="Under maintenance" value={count("under_maintenance")} sub="Being serviced" icon="mdi:wrench-outline" tone="amber" />
        <StatTile label="Unserviceable" value={count("unserviceable")} sub="Not available" icon="mdi:alert-octagon-outline" tone="red" />
      </div>

      <SqPanel
        title="Generators"
        subtitle="Each generator's run log records time on/off, hours, fuel and the operator's signature. Open a generator to record a run."
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon="mdi:file-delimited-outline" onClick={exportCsv} disabled={!generators.length}>
              Export CSV
            </SecondaryButton>
            {has("generators.create") && <PrimaryButton onClick={() => setAdding(true)}>Add generator</PrimaryButton>}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <div className={cn("flex items-center p-1 rounded-lg border", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
            {(["table", "grid"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-label={`${v} view`}
                onClick={() => setView(v)}
                className={cn("p-1.5 rounded", view === v ? "bg-[#0A4D66] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-white")}
              >
                <Icon icon={v === "table" ? "mdi:table" : "mdi:view-grid"} className="w-4 h-4" />
              </button>
            ))}
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, manufacturer, serial or location…"
            className={cn(fieldClass, "flex-1 min-w-[200px]")}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All statuses</option>
            {Object.entries(GENERATOR_STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {view === "table" ? (
          <SqTable<Generator>
            rows={generators}
            loading={isLoading}
            rowKey={(g) => g.id}
            onRowClick={(g) => open(g.id)}
            empty="No generators yet."
            columns={[
              {
                key: "name",
                label: "Generator",
                render: (g) => (
                  <div className="flex items-center gap-3">
                    {g.image ? (
                      <img src={g.image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-100 dark:bg-white/5 grid place-items-center shrink-0">
                        <Icon icon="mdi:engine-outline" className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-[11px] opacity-70">{[g.manufacturer, g.model].filter(Boolean).join(" ") || "–"}</div>
                    </div>
                  </div>
                ),
              },
              { key: "cap", label: "Capacity", render: (g) => (g.capacity_kva ? `${num(g.capacity_kva)} kVA` : "–") },
              { key: "unit", label: "Unit / location", render: (g) => [g.unit?.name, g.location].filter(Boolean).join(" · ") || "–" },
              { key: "purchased", label: "Purchased", render: (g) => fmtDate(g.date_purchased) },
              { key: "hours", label: "Cumulative hrs", render: (g) => num(g.cumulative_hours ?? g.opening_hours) },
              { key: "fuel", label: "Fuel balance", render: (g) => (g.fuel_balance_litres != null ? `${num(g.fuel_balance_litres)} L` : "–") },
              { key: "last", label: "Last run", render: (g) => fmtDate(g.last_run_date) },
              {
                key: "service",
                label: "Next service",
                render: (g) => {
                  const service = serviceCountdown(g.maintenance);
                  return g.maintenance?.status === "not_set" ? (
                    <span className="opacity-60">–</span>
                  ) : (
                    <span className={cn("whitespace-nowrap font-semibold", service.tone === "red" && "text-red-500", service.tone === "amber" && "text-amber-600 dark:text-amber-300")}>
                      {service.text}
                    </span>
                  );
                },
              },
              { key: "status", label: "Status", align: "right", render: (g) => <SqStatus value={GENERATOR_STATUS_TONE[g.status]} label={GENERATOR_STATUS_LABEL[g.status]} /> },
            ]}
          />
        ) : generators.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {generators.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => open(g.id)}
                className={cn(
                  "text-left rounded-xl border overflow-hidden transition-colors",
                  isDark ? "border-[#0A4D66]/40 hover:border-[#7FD5FF]/60" : "border-slate-200 hover:border-sky-400",
                )}
              >
                <div className="h-36 bg-slate-100 dark:bg-white/5 grid place-items-center">
                  {g.image ? <img src={g.image} alt="" className="w-full h-full object-cover" /> : <Icon icon="mdi:engine-outline" className="w-12 h-12 text-slate-400" />}
                </div>
                <div className="p-3 text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm">{g.name}</div>
                    <SqStatus value={GENERATOR_STATUS_TONE[g.status]} label={GENERATOR_STATUS_LABEL[g.status]} />
                  </div>
                  <div className="opacity-70">{[g.manufacturer, g.model, g.capacity_kva ? `${num(g.capacity_kva)} kVA` : null].filter(Boolean).join(" · ") || "–"}</div>
                  <div className="flex justify-between pt-1">
                    <span>{num(g.cumulative_hours ?? g.opening_hours)} hrs</span>
                    <span>{g.fuel_balance_litres != null ? `${num(g.fuel_balance_litres)} L fuel` : "No runs yet"}</span>
                  </div>
                  {g.maintenance && g.maintenance.status !== "not_set" && (
                    <div className={cn("flex items-center gap-1", g.maintenance.status === "overdue" ? "text-red-500" : g.maintenance.status === "due_soon" ? "text-amber-600 dark:text-amber-300" : "opacity-70")}>
                      <Icon icon="mdi:wrench-clock" className="w-3.5 h-3.5" />
                      Service: {serviceCountdown(g.maintenance).text}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-center py-10 opacity-60">{isLoading ? "Loading…" : "No generators yet."}</p>
        )}
      </SqPanel>

      {adding && <GeneratorFormModal generator={null} onClose={() => setAdding(false)} onSaved={open} />}
    </div>
  );
};
