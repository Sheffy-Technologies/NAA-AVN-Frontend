import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { downloadCsvFile } from "@/shared/utils/csv";
import { downloadSummaryPdf } from "../sqExport";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import {
  useGetSqRecordsQuery,
  useGetUnitOversightQuery,
  useLazyGetSqReportQuery,
  type SqReport,
  type SqReportType,
  type UnitOversightRow,
} from "../api";
import { RecordFormModal, type SqField } from "./RecordFormModal";
import { useSqLookups } from "./useSqLookups";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus, SqTable, StatTile } from "./sqUi";
import { formatDate, humanize, useFieldClass, useSqPermissions } from "./sqHelpers";

const REVIEW_TYPES = ["scheduled_review", "occurrence_follow_up", "quality_audit", "capa_verification", "document_compliance"];
const OUTCOMES = ["on_track", "review_due", "attention_required"];
const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: humanize(v) }));

export const UnitOversightSection = () => {
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const lookups = useSqLookups(["units"]);
  const { data, isLoading } = useGetUnitOversightQuery();
  const { data: reviews = [] } = useGetSqRecordsQuery({ resource: "unit-oversight-reviews" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<UnitOversightRow | null>(null);
  const [adding, setAdding] = useState<{ open: boolean; unitId?: number }>({ open: false });

  const rows = data?.data ?? [];
  const filtered = rows.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) && (!status || u.overall_status === status),
  );
  const count = (s: string) => rows.filter((u) => u.overall_status === s).length;

  const reviewFields: SqField[] = [
    { name: "unit_id", label: "Formation", type: "search-select", required: true, options: lookups.units },
    { name: "review_type", label: "Oversight type", type: "select", required: true, options: toOptions(REVIEW_TYPES) },
    { name: "review_date", label: "Review date", type: "date", required: true },
    { name: "outcome", label: "Outcome", type: "select", required: true, options: toOptions(OUTCOMES) },
    { name: "summary", label: "Summary & findings", type: "textarea" },
    { name: "follow_up", label: "Required follow-up / owner", type: "textarea" },
  ];

  const exportCsv = () =>
    downloadCsvFile("unit-oversight.csv", [
      ["Unit", "Open safety reports", "High-risk reports", "Open findings", "Overdue actions", "Pilots", "Lapsed pilots", "Last review", "Safety", "Quality", "Overall"],
      ...filtered.map((u) => [
        u.name,
        String(u.open_safety_reports),
        String(u.high_risk_reports),
        String(u.open_findings),
        String(u.overdue_actions),
        String(u.pilots),
        String(u.lapsed_pilots),
        u.last_review_date ?? "Never",
        humanize(u.safety_status),
        humanize(u.quality_status),
        humanize(u.overall_status),
      ]),
    ]);

  const unitReviews = selected ? reviews.filter((r) => r.unit_id === selected.unit_id).slice(0, 5) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Formations in scope" value={rows.length} sub="Units you oversee" icon="mdi:sitemap-outline" />
        <StatTile label="On track" value={count("on_track")} sub="No outstanding issues" icon="mdi:check-circle-outline" tone="emerald" />
        <StatTile label="Review due" value={count("review_due")} sub={`No review in ${data?.review_interval_months ?? 3} months, or open items`} icon="mdi:calendar-clock" tone="amber" />
        <StatTile label="Attention required" value={count("attention_required")} sub="High risk, overdue CAPA or lapsed pilots" icon="mdi:alert-octagon-outline" tone="red" />
      </div>

      <SqPanel
        title="Command-wide Unit Oversight"
        subtitle="Safety and quality assurance status across formations, computed from each unit's live reports, findings, actions, pilot currency and last Directorate review."
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon="mdi:file-delimited-outline" onClick={exportCsv}>
              Export CSV
            </SecondaryButton>
            {has("unit-oversight-reviews.create") && (
              <PrimaryButton onClick={() => setAdding({ open: true })}>Add oversight entry</PrimaryButton>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search formation…"
            className={cn(fieldClass, "flex-1 min-w-[200px]")}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All oversight statuses</option>
            {OUTCOMES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>

        <SqTable<UnitOversightRow>
          rows={filtered}
          loading={isLoading}
          rowKey={(u) => u.unit_id}
          onRowClick={setSelected}
          empty="No formations match these filters."
          columns={[
            {
              key: "unit",
              label: "Formation / unit",
              render: (u) => (
                <div>
                  <div className="font-semibold">{u.name}</div>
                  {u.description && <div className="text-[11px] opacity-70">{u.description}</div>}
                </div>
              ),
            },
            { key: "reports", label: "Safety reports", render: (u) => `${u.open_safety_reports} open${u.high_risk_reports ? ` · ${u.high_risk_reports} high` : ""}` },
            { key: "findings", label: "Findings / CAPA", render: (u) => `${u.open_findings} open · ${u.overdue_actions} overdue` },
            { key: "pilots", label: "Pilots lapsed", render: (u) => `${u.lapsed_pilots} / ${u.pilots}` },
            { key: "safety", label: "Safety oversight", render: (u) => <SqStatus value={u.safety_status} /> },
            { key: "quality", label: "Quality assurance", render: (u) => <SqStatus value={u.quality_status} /> },
            { key: "review", label: "Last review", render: (u) => (u.last_review_date ? formatDate(u.last_review_date) : "Never") },
            { key: "overall", label: "Overall", align: "right", render: (u) => <SqStatus value={u.overall_status} /> },
          ]}
        />
      </SqPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SqPanel title="Directorate oversight cycle">
          <ol className={cn("list-decimal pl-5 space-y-1.5 text-xs", isDark ? "text-gray-300" : "text-slate-600")}>
            <li>Unit returns and occurrence reporting (Hazards & Occurrences).</li>
            <li>Safety and quality assurance visits (Audits & Inspections).</li>
            <li>Findings and corrective action tracking with effectiveness verification.</li>
            <li>Command-level management review (Reports & Analytics).</li>
          </ol>
        </SqPanel>
        <SqPanel title="How unit status is worked out">
          <ul className={cn("list-disc pl-5 space-y-1.5 text-xs", isDark ? "text-gray-300" : "text-slate-600")}>
            <li>
              <b>Attention required</b>: an open high-risk report or risk, a lapsed pilot (safety); a high-severity finding or overdue
              corrective action (quality).
            </li>
            <li>
              <b>Review due</b>: no oversight review in {data?.review_interval_months ?? 3} months, or open items.
            </li>
            <li>
              <b>On track</b>: reviewed recently with nothing open.
            </li>
          </ul>
        </SqPanel>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              "w-full max-w-lg rounded-xl border p-6 shadow-2xl my-8",
              isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">Oversight profile</h3>
                <div className="text-sm font-semibold mt-1">{selected.name}</div>
              </div>
              <SqStatus value={selected.overall_status} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs mb-4">
              {[
                ["Open safety reports", selected.open_safety_reports],
                ["High-risk reports / risks", `${selected.high_risk_reports} / ${selected.high_risks}`],
                ["Open findings (high)", `${selected.open_findings} (${selected.high_findings})`],
                ["Open / overdue actions", `${selected.open_actions} / ${selected.overdue_actions}`],
                ["Pilots / lapsed", `${selected.pilots} / ${selected.lapsed_pilots}`],
                ["Last review", selected.last_review_date ? `${formatDate(selected.last_review_date)} · ${humanize(selected.last_review_type)}` : "Never"],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="opacity-60">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="text-xs font-semibold mb-2">Recent oversight entries</div>
            {unitReviews.length ? (
              <ul className="space-y-2 text-xs mb-4">
                {unitReviews.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div>
                        {humanize(String(r.review_type))} · {formatDate(String(r.review_date))}
                      </div>
                      {r.summary ? <div className="opacity-70">{String(r.summary)}</div> : null}
                    </div>
                    <SqStatus value={String(r.outcome)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs opacity-60 mb-4">No oversight entries yet.</p>
            )}
            <div className="flex justify-end gap-2">
              {has("unit-oversight-reviews.create") && (
                <PrimaryButton
                  onClick={() => {
                    setAdding({ open: true, unitId: selected.unit_id });
                    setSelected(null);
                  }}
                >
                  Add oversight entry
                </PrimaryButton>
              )}
              <SecondaryButton
                icon="mdi:file-pdf-box"
                onClick={() =>
                  downloadSummaryPdf({
                    formTitle: "UNIT OVERSIGHT PROFILE",
                    title: selected.name,
                    fileName: `Unit oversight ${selected.name}`,
                    fields: [
                      ["Overall status", humanize(selected.overall_status)],
                      ["Safety oversight", humanize(selected.safety_status)],
                      ["Quality assurance", humanize(selected.quality_status)],
                      ["Last review", selected.last_review_date ? `${formatDate(selected.last_review_date)} (${humanize(selected.last_review_type)})` : "Never"],
                      ["Open safety reports", String(selected.open_safety_reports)],
                      ["High-risk reports / risks", `${selected.high_risk_reports} / ${selected.high_risks}`],
                      ["Open findings (high)", `${selected.open_findings} (${selected.high_findings})`],
                      ["Open / overdue actions", `${selected.open_actions} / ${selected.overdue_actions}`],
                      ["Pilots / lapsed", `${selected.pilots} / ${selected.lapsed_pilots}`],
                    ],
                    tables: [
                      {
                        heading: "Recent oversight entries",
                        headers: ["Type", "Date", "Outcome", "Summary"],
                        rows: unitReviews.map((r) => [
                          humanize(String(r.review_type)),
                          formatDate(String(r.review_date)),
                          humanize(String(r.outcome)),
                          r.summary ? String(r.summary) : "-",
                        ]),
                        empty: "No oversight entries yet",
                      },
                    ],
                  })
                }
              >
                Download PDF
              </SecondaryButton>
              <SecondaryButton onClick={() => setSelected(null)}>Close</SecondaryButton>
            </div>
          </div>
        </div>
      )}

      <RecordFormModal
        open={adding.open}
        onClose={() => setAdding({ open: false })}
        resource="unit-oversight-reviews"
        title="Add unit oversight entry"
        icon="mdi:sitemap-outline"
        fields={reviewFields}
        defaults={{
          ...(adding.unitId ? { unit_id: String(adding.unitId) } : {}),
          review_date: new Date().toISOString().slice(0, 10),
          review_type: "scheduled_review",
          outcome: "on_track",
        }}
      />
    </div>
  );
};

const REPORTS: Array<{ type: SqReportType; title: string; description: string; icon: string; dated: boolean }> = [
  { type: "safety-summary", title: "Monthly Safety Summary", description: "Reports, hazard trends, investigations and risk status.", icon: "mdi:alert-outline", dated: true },
  { type: "quality-summary", title: "Quality Assurance Summary", description: "Audit findings, non-conformities and action closure.", icon: "mdi:clipboard-search-outline", dated: true },
  { type: "document-control", title: "Document Control Report", description: "Manual inventory, revision status and review dates.", icon: "mdi:book-open-page-variant-outline", dated: false },
  { type: "risk-register", title: "Risk Register Snapshot", description: "Open risks by rating, controls and review dates.", icon: "mdi:shield-alert-outline", dated: false },
  { type: "pilot-currency", title: "Pilot Currency Report", description: "Currency status for every pilot, with due dates.", icon: "mdi:clock-check-outline", dated: false },
  { type: "unit-oversight", title: "Unit Oversight Summary", description: "Consolidated safety and quality status per formation.", icon: "mdi:sitemap-outline", dated: false },
];

export const ReportsSection = () => {
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const panel = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [type, setType] = useState<SqReportType>("safety-summary");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [fetchReport, { data: report, isFetching, isError }] = useLazyGetSqReportQuery();
  const selected = REPORTS.find((r) => r.type === type)!;

  const generate = (next: SqReportType = type) => {
    setType(next);
    void fetchReport({ type: next, from, to });
  };

  const exportCsv = (r: SqReport) =>
    downloadCsvFile(`${r.type}-${r.period.from}-to-${r.period.to}.csv`, [
      [r.title],
      [`Period: ${r.period.from} to ${r.period.to}`],
      [],
      ...r.metrics.map((m) => [m.label, String(m.value)]),
      [],
      r.columns,
      ...r.rows.map((row) => row.map((c) => (c === null ? "" : String(c)))),
    ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORTS.map((r) => (
          <button
            key={r.type}
            type="button"
            onClick={() => generate(r.type)}
            className={cn(
              "text-left border rounded-xl p-4 transition-colors",
              isDark ? "bg-[#001219] border-[#0A4D66]/40 hover:border-[#7FD5FF]/60" : "bg-white border-slate-200 hover:border-sky-400 shadow-sm",
              type === r.type && (isDark ? "border-[#7FD5FF]" : "border-sky-500"),
            )}
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Icon icon={r.icon} className="w-5 h-5 text-[#0A4D66] dark:text-[#7FD5FF]" />
              {r.title}
            </div>
            <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-slate-500")}>{r.description}</p>
          </button>
        ))}
      </div>

      <SqPanel title={selected.title} subtitle="Every figure is computed live from the registers, not typed in.">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          {selected.dated && (
            <>
              <label className="text-xs">
                <span className="block font-semibold mb-1">From</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
              </label>
              <label className="text-xs">
                <span className="block font-semibold mb-1">To</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
              </label>
            </>
          )}
          <PrimaryButton icon="mdi:file-chart-outline" onClick={() => generate()} disabled={isFetching}>
            {isFetching ? "Generating…" : "Generate report"}
          </PrimaryButton>
          {report && report.type === type && (
            <>
              <SecondaryButton icon="mdi:file-delimited-outline" onClick={() => exportCsv(report)}>
                Export CSV
              </SecondaryButton>
              <SecondaryButton
                icon="mdi:file-pdf-box"
                onClick={() =>
                  panel.current &&
                  downloadElementAsPdf({
                    element: panel.current,
                    fileName: `${report.type}-${report.period.to}`,
                    backgroundColor: isDark ? "#001219" : "#ffffff",
                  })
                }
              >
                Download PDF
              </SecondaryButton>
            </>
          )}
        </div>

        {isError && <p className="text-xs text-red-500">The report could not be generated.</p>}

        {report && report.type === type && (
          <div ref={panel} className="space-y-4">
            <div>
              <div className="text-sm font-bold">{report.title}</div>
              <div className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>
                {selected.dated ? `Period ${formatDate(report.period.from)} – ${formatDate(report.period.to)} · ` : ""}
                Generated {new Date(report.generated_at).toLocaleString("en-GB")}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {report.metrics.map((m) => (
                <div key={m.label} className={cn("border rounded-lg p-3", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                  <div className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>{m.label}</div>
                  <div className="text-xl font-bold">{m.value}</div>
                </div>
              ))}
            </div>
            <SqTable<{ index: number; cells: SqReport["rows"][number] }>
              rows={report.rows.map((cells, index) => ({ index, cells }))}
              rowKey={(r) => r.index}
              empty="No records in this report."
              columns={report.columns.map((label, i) => ({ key: String(i), label, render: (r) => r.cells[i] ?? "-" }))}
            />
          </div>
        )}
      </SqPanel>
    </div>
  );
};

const ADMIN_MATRIX: Array<{ capability: string; permission: string }> = [
  { capability: "View the Safety & Quality dashboard", permission: "safety-quality.dashboard.view" },
  { capability: "Raise and manage safety reports", permission: "safety-reports.create" },
  { capability: "Manage the risk register", permission: "safety-risks.update" },
  { capability: "Run investigations", permission: "safety-investigations.update" },
  { capability: "Plan audits and record findings", permission: "quality-audits.update" },
  { capability: "Verify and close corrective actions", permission: "corrective-actions.verify" },
  { capability: "Upload draft manuals", permission: "controlled-documents.create" },
  { capability: "Approve / publish document revisions", permission: "controlled-documents.approve" },
  { capability: "Download restricted documents", permission: "controlled-documents.restricted.view" },
  { capability: "Record qualifications", permission: "personnel-qualifications.create" },
  { capability: "Record pilot checks", permission: "pilot-check-records.create" },
  { capability: "View pilot currency", permission: "safety-quality.pilot-currency.view" },
  { capability: "View command-wide unit oversight", permission: "safety-quality.unit-oversight.view" },
  { capability: "Record unit oversight reviews", permission: "unit-oversight-reviews.create" },
  { capability: "Generate management reports", permission: "safety-quality.reports.view" },
];

export const AdminSection = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { has, hasAny } = useSqPermissions();

  return (
    <SqPanel
      title="Administration & Permissions"
      subtitle="Access is enforced on the server. Assign these permissions to roles (e.g. Safety & Quality Officer, Document Controller, Approving Authority) in Security."
      action={
        hasAny(["roles.viewAny", "permissions.viewAny"]) ? (
          <SecondaryButton icon="mdi:shield-account-outline" onClick={() => navigate("/dashboard/security")}>
            Manage roles
          </SecondaryButton>
        ) : undefined
      }
    >
      <SqTable
        rows={ADMIN_MATRIX}
        rowKey={(r) => r.permission}
        columns={[
          { key: "cap", label: "Capability", render: (r) => r.capability },
          { key: "perm", label: "Permission", render: (r) => <code className="text-[11px]">{r.permission}</code> },
          {
            key: "you",
            label: "Your access",
            align: "right",
            render: (r) => (has(r.permission) ? <SqStatus value="current" label="Granted" /> : <SqStatus value="not_applicable" label="Not granted" />),
          },
        ]}
      />
      <p className={cn("text-[11px] mt-3", isDark ? "text-gray-500" : "text-slate-400")}>
        Restricted documents also require the document to be approved; drafts are only visible to holders of
        controlled-documents.approve. The unit review interval is the <code>safety_review_interval_months</code> system setting.
      </p>
    </SqPanel>
  );
};
