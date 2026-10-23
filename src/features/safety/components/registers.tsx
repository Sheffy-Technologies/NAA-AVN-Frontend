import { Icon } from "@iconify/react";
import type { SqRecord } from "../api";
import type { SqFieldOption } from "./RecordFormModal";
import type { SqRegisterConfig } from "./RegisterSection";
import { SqStatus, StatTile } from "./sqUi";
import { formatDate, humanize } from "./sqHelpers";
import { FileBadge, RefCell, StatGrid } from "./registerCells";
import { RegisterSection } from "./RegisterSection";
import { downloadControlledDocument } from "./documentDownload";

const opts = (values: string[]): SqFieldOption[] => values.map((v) => ({ value: v, label: humanize(v) }));

const str = (r: SqRecord, key: string) => (r[key] === null || r[key] === undefined ? "" : String(r[key]));
const rel = (r: SqRecord, key: string, field = "name") => {
  const v = r[key] as Record<string, unknown> | null | undefined;
  return v && v[field] ? String(v[field]) : "-";
};
const isPast = (value?: string) => Boolean(value) && new Date(value as string) < new Date(new Date().toDateString());

const count = (records: SqRecord[], pred: (r: SqRecord) => boolean) => records.filter(pred).length;

const RISK_LEVELS = opts(["low", "medium", "high"]);
const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));

const safetyReportsRegister: SqRegisterConfig = {
  formTitle: "SAFETY REPORT",
  resource: "safety-reports",
  title: "Hazards & Occurrences",
  subtitle: "Capture safety reports, triage hazards and track occurrences through to closure.",
  singular: "Safety report",
  icon: "mdi:alert-outline",
  createLabel: "New safety report",
  lookups: ["units", "aircraft"],
  filters: [
    { name: "report_type", label: "All report types", options: opts(["hazard", "occurrence"]) },
    { name: "risk_level", label: "All risk levels", options: RISK_LEVELS },
    { name: "status", label: "All statuses", options: opts(["open", "under_review", "investigation", "closed"]) },
    { name: "unit_id", label: "All units", options: (l) => l.units },
  ],
  stats: (rs) => (
    <StatGrid>
      <StatTile label="New / open" value={count(rs, (r) => r.status === "open")} sub="Needs triage" icon="mdi:alert-outline" />
      <StatTile label="Under investigation" value={count(rs, (r) => r.status === "investigation")} sub="Assigned investigators" icon="mdi:magnify" tone="amber" />
      <StatTile label="High risk (open)" value={count(rs, (r) => r.risk_level === "high" && r.status !== "closed")} sub="Prompt review required" icon="mdi:alert-octagon-outline" tone="red" />
      <StatTile label="Closed" value={count(rs, (r) => r.status === "closed")} sub="All time" icon="mdi:check-circle-outline" tone="emerald" />
    </StatGrid>
  ),
  columns: [
    { key: "ref", label: "Reference / description", render: (r) => <RefCell r={r} sub={humanize(str(r, "report_type"))} /> },
    { key: "unit", label: "Unit / area", render: (r) => [rel(r, "unit"), str(r, "area")].filter((x) => x && x !== "-").join(" · ") || "-" },
    { key: "aircraft", label: "Aircraft", render: (r) => rel(r, "asset", "tail_number") },
    { key: "risk", label: "Risk", render: (r) => <SqStatus value={str(r, "risk_level")} /> },
    { key: "date", label: "Reported", render: (r) => formatDate(str(r, "occurred_at") || str(r, "created_at")) },
    { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={str(r, "status")} /> },
  ],
  fields: (l, record) => [
    { name: "report_type", label: "Report type", type: "select", required: true, options: opts(["hazard", "occurrence"]) },
    { name: "risk_level", label: "Initial risk rating", type: "select", required: true, options: RISK_LEVELS },
    { name: "title", label: "Report title", type: "text", required: true, wide: true, placeholder: "Brief description" },
    { name: "unit_id", label: "Unit", type: "search-select", options: l.units },
    { name: "area", label: "Work area", type: "text", placeholder: "e.g. Flight line, hangar 2" },
    { name: "asset_id", label: "Aircraft involved", type: "search-select", options: l.aircraft },
    { name: "occurred_at", label: "Date / time observed", type: "datetime" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Describe what happened or the hazard observed" },
    { name: "immediate_action", label: "Immediate action taken", type: "textarea" },
    ...(record ? [{ name: "status", label: "Status", type: "select" as const, options: opts(["open", "under_review", "investigation", "closed"]) }] : []),
  ],
  footerNote: "Reports follow a just culture: record what happened, not who to blame.",
};

const risksRegister: SqRegisterConfig = {
  formTitle: "RISK ASSESSMENT",
  resource: "safety-risks",
  title: "Risk Register",
  subtitle: "Risk ownership, mitigation controls and review schedule. Ratings are calculated from likelihood × severity.",
  singular: "Risk",
  icon: "mdi:shield-alert-outline",
  createLabel: "Add risk",
  lookups: ["units", "safetyReports"],
  filters: [
    { name: "risk_level", label: "All ratings", options: RISK_LEVELS },
    { name: "status", label: "All statuses", options: opts(["active", "under_review", "monitoring", "accepted", "closed"]) },
    { name: "unit_id", label: "All units", options: (l) => l.units },
  ],
  stats: (rs) => {
    const open = rs.filter((r) => r.status !== "closed");
    return (
      <StatGrid>
        <StatTile label="High" value={count(open, (r) => r.risk_level === "high")} sub="Escalate / review" icon="mdi:arrow-up-bold" tone="red" />
        <StatTile label="Medium" value={count(open, (r) => r.risk_level === "medium")} sub="Monitor controls" icon="mdi:shield-half-full" tone="amber" />
        <StatTile label="Low" value={count(open, (r) => r.risk_level === "low")} sub="Routine oversight" icon="mdi:arrow-down-bold" tone="emerald" />
        <StatTile label="Overdue reviews" value={count(open, (r) => isPast(str(r, "next_review_date")))} sub="Owner follow-up needed" icon="mdi:calendar-alert" tone="red" />
      </StatGrid>
    );
  },
  columns: [
    { key: "ref", label: "Risk ID / hazard", render: (r) => <RefCell r={r} /> },
    { key: "owner", label: "Owner", render: (r) => str(r, "owner") || rel(r, "unit") },
    { key: "score", label: "L × S", render: (r) => `${str(r, "likelihood")} × ${str(r, "severity")} = ${str(r, "risk_score")}` },
    { key: "rating", label: "Rating", render: (r) => <SqStatus value={str(r, "risk_level")} /> },
    { key: "controls", label: "Controls", render: (r) => <span className="line-clamp-2">{str(r, "controls") || "-"}</span> },
    {
      key: "review",
      label: "Next review",
      render: (r) => (
        <span className={isPast(str(r, "next_review_date")) && r.status !== "closed" ? "text-red-500 font-semibold" : ""}>
          {formatDate(str(r, "next_review_date"))}
        </span>
      ),
    },
    { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={str(r, "status")} /> },
  ],
  fields: (l) => [
    { name: "title", label: "Hazard / risk description", type: "text", required: true, wide: true },
    { name: "likelihood", label: "Likelihood (1–5)", type: "select", required: true, options: SCALE, help: "1 = extremely improbable, 5 = frequent" },
    { name: "severity", label: "Severity (1–5)", type: "select", required: true, options: SCALE, help: "1 = negligible, 5 = catastrophic" },
    { name: "owner", label: "Risk owner", type: "text", placeholder: "Responsible office" },
    { name: "unit_id", label: "Unit", type: "search-select", options: l.units },
    { name: "safety_report_id", label: "Source safety report", type: "search-select", options: l.safetyReports },
    { name: "next_review_date", label: "Next review date", type: "date" },
    { name: "controls", label: "Mitigation controls", type: "textarea" },
    { name: "residual_risk_level", label: "Residual risk", type: "select", options: RISK_LEVELS },
    { name: "acceptance_authority", label: "Acceptance authority", type: "text" },
    { name: "status", label: "Status", type: "select", options: opts(["active", "under_review", "monitoring", "accepted", "closed"]) },
    { name: "description", label: "Notes", type: "textarea" },
  ],
  footerNote: "Score ≥ 15 is high, 6–14 medium, below 6 low.",
};

const investigationsRegister: SqRegisterConfig = {
  formTitle: "OCCURRENCE INVESTIGATION",
  resource: "safety-investigations",
  title: "Occurrence Investigations",
  subtitle: "Investigation assignment, evidence, analysis and recommendations.",
  singular: "Investigation",
  icon: "mdi:magnify-scan",
  createLabel: "Start investigation",
  lookups: ["units", "personnel", "safetyReports"],
  filters: [{ name: "status", label: "All statuses", options: opts(["open", "in_progress", "evidence_review", "closed"]) }],
  columns: [
    { key: "ref", label: "Investigation", render: (r) => <RefCell r={r} /> },
    { key: "report", label: "Source report", render: (r) => rel(r, "safety_report", "reference") },
    {
      key: "lead",
      label: "Lead",
      render: (r) => {
        const p = r.lead_personnel as { firstname?: string; lastname?: string } | null;
        return p ? `${p.firstname} ${p.lastname}` : str(r, "lead_investigator") || "-";
      },
    },
    {
      key: "target",
      label: "Target date",
      render: (r) => (
        <span className={isPast(str(r, "target_date")) && r.status !== "closed" ? "text-red-500 font-semibold" : ""}>
          {formatDate(str(r, "target_date"))}
        </span>
      ),
    },
    { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={str(r, "status")} /> },
  ],
  fields: (l) => [
    { name: "title", label: "Investigation title", type: "text", required: true, wide: true },
    { name: "safety_report_id", label: "Source safety report", type: "search-select", options: l.safetyReports, help: "Opening an investigation moves the report to the investigation stage." },
    { name: "unit_id", label: "Unit", type: "search-select", options: l.units, help: "Defaults to the report's unit." },
    { name: "lead_personnel_id", label: "Lead investigator (personnel)", type: "search-select", options: l.personnel },
    { name: "lead_investigator", label: "Lead investigator (name / office)", type: "text" },
    { name: "target_date", label: "Target completion", type: "date" },
    { name: "status", label: "Status", type: "select", options: opts(["open", "in_progress", "evidence_review", "closed"]) },
    { name: "evidence_summary", label: "Evidence summary", type: "textarea" },
    { name: "findings", label: "Findings", type: "textarea" },
    { name: "root_cause", label: "Root cause", type: "textarea" },
    { name: "recommendations", label: "Recommendations", type: "textarea", help: "Raise corrective actions from these under Quality → Corrective Actions." },
  ],
};

const auditsRegister: SqRegisterConfig = {
  formTitle: "QUALITY AUDIT",
  related: [
    {
      heading: "Findings",
      rows: (r) => (r.findings as SqRecord[] | undefined) ?? [],
      columns: [
        { header: "Reference", value: (f) => str(f, "reference") },
        { header: "Finding", value: (f) => str(f, "title") },
        { header: "Severity", value: (f) => humanize(str(f, "severity")) },
        { header: "Status", value: (f) => humanize(str(f, "status")) },
      ],
      empty: "No findings recorded against this audit",
    },
  ],
  resource: "quality-audits",
  title: "Audits & Inspections",
  subtitle: "Plan assurance activities and record their outcome. Findings are logged against each audit.",
  singular: "Audit",
  icon: "mdi:clipboard-search-outline",
  createLabel: "Schedule audit",
  lookups: ["units"],
  filters: [
    { name: "audit_type", label: "Audits & inspections", options: opts(["audit", "inspection"]) },
    { name: "status", label: "All statuses", options: opts(["planned", "in_progress", "completed", "cancelled"]) },
    { name: "unit_id", label: "All units", options: (l) => l.units },
  ],
  columns: [
    { key: "ref", label: "Audit / subject", render: (r) => <RefCell r={r} sub={humanize(str(r, "audit_type"))} /> },
    { key: "unit", label: "Unit / area", render: (r) => [rel(r, "unit"), str(r, "area")].filter((x) => x && x !== "-").join(" · ") || "-" },
    { key: "lead", label: "Lead auditor", render: (r) => str(r, "lead_auditor") || "-" },
    { key: "date", label: "Scheduled", render: (r) => formatDate(str(r, "scheduled_date")) },
    { key: "findings", label: "Findings", render: (r) => String((r.findings as unknown[] | undefined)?.length ?? 0) },
    { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={str(r, "status")} /> },
  ],
  fields: (l) => [
    { name: "title", label: "Audit subject", type: "text", required: true, wide: true },
    { name: "audit_type", label: "Type", type: "select", required: true, options: opts(["audit", "inspection"]) },
    { name: "unit_id", label: "Unit", type: "search-select", options: l.units },
    { name: "area", label: "Area", type: "text" },
    { name: "lead_auditor", label: "Lead auditor", type: "text" },
    { name: "scheduled_date", label: "Scheduled date", type: "date" },
    { name: "completed_date", label: "Completed date", type: "date" },
    { name: "status", label: "Status", type: "select", options: opts(["planned", "in_progress", "completed", "cancelled"]) },
    { name: "scope", label: "Scope", type: "textarea" },
    { name: "summary", label: "Summary / outcome", type: "textarea" },
  ],
};

const findingsRegister: SqRegisterConfig = {
  formTitle: "QUALITY FINDING",
  related: [
    {
      heading: "Corrective actions",
      rows: (r) => (r.corrective_actions as SqRecord[] | undefined) ?? [],
      columns: [
        { header: "Reference", value: (a) => str(a, "reference") },
        { header: "Action", value: (a) => str(a, "title") },
        { header: "Due", value: (a) => formatDate(str(a, "due_date")) },
        { header: "Status", value: (a) => humanize(str(a, "status")) },
      ],
      empty: "No corrective actions raised for this finding",
    },
  ],
  resource: "quality-findings",
  title: "Quality Findings",
  subtitle: "Non-conformities raised by audits and inspections. Status follows the linked corrective actions.",
  singular: "Finding",
  icon: "mdi:clipboard-alert-outline",
  createLabel: "Record finding",
  lookups: ["units", "qualityAudits"],
  filters: [
    { name: "severity", label: "All severities", options: RISK_LEVELS },
    { name: "status", label: "All statuses", options: opts(["open", "action_in_progress", "awaiting_verification", "closed"]) },
    { name: "unit_id", label: "All units", options: (l) => l.units },
  ],
  columns: [
    { key: "ref", label: "Finding", render: (r) => <RefCell r={r} /> },
    { key: "audit", label: "Audit", render: (r) => rel(r, "audit", "reference") },
    { key: "unit", label: "Unit / area", render: (r) => [rel(r, "unit"), str(r, "area")].filter((x) => x && x !== "-").join(" · ") || "-" },
    { key: "severity", label: "Severity", render: (r) => <SqStatus value={str(r, "severity")} /> },
    { key: "actions", label: "Actions", render: (r) => String((r.corrective_actions as unknown[] | undefined)?.length ?? 0) },
    { key: "date", label: "Found", render: (r) => formatDate(str(r, "found_date")) },
    { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={str(r, "status")} /> },
  ],
  fields: (l) => [
    { name: "title", label: "Finding", type: "text", required: true, wide: true },
    { name: "severity", label: "Severity", type: "select", required: true, options: RISK_LEVELS },
    { name: "quality_audit_id", label: "Audit / inspection", type: "search-select", options: l.qualityAudits },
    { name: "unit_id", label: "Unit", type: "search-select", options: l.units, help: "Defaults to the audit's unit." },
    { name: "area", label: "Area", type: "text" },
    { name: "found_date", label: "Date found", type: "date" },
    { name: "status", label: "Status", type: "select", options: opts(["open", "action_in_progress", "awaiting_verification", "closed"]) },
    { name: "description", label: "Description / evidence", type: "textarea" },
  ],
};

const actionsRegister: SqRegisterConfig = {
  formTitle: "CORRECTIVE ACTION",
  resource: "corrective-actions",
  title: "Corrective & Preventive Actions",
  subtitle: "Assigned actions, deadlines, evidence and effectiveness verification.",
  singular: "Corrective action",
  icon: "mdi:checkbox-marked-circle-outline",
  createLabel: "Create action",
  lookups: ["units", "personnel", "qualityFindings", "investigations", "safetyReports"],
  filters: [
    { name: "status", label: "All statuses", options: opts(["open", "in_progress", "awaiting_verification", "closed"]) },
    { name: "action_type", label: "Corrective & preventive", options: opts(["corrective", "preventive"]) },
    { name: "unit_id", label: "All units", options: (l) => l.units },
  ],
  stats: (rs) => (
    <StatGrid>
      <StatTile label="Open" value={count(rs, (r) => r.status !== "closed")} sub="Not yet verified" icon="mdi:progress-check" />
      <StatTile label="Awaiting verification" value={count(rs, (r) => r.status === "awaiting_verification")} sub="Ready for effectiveness check" icon="mdi:shield-search" tone="amber" />
      <StatTile label="Overdue" value={count(rs, (r) => r.is_overdue === true)} sub="Past due date" icon="mdi:calendar-alert" tone="red" />
      <StatTile label="Verified & closed" value={count(rs, (r) => r.status === "closed")} sub="All time" icon="mdi:check-decagram-outline" tone="emerald" />
    </StatGrid>
  ),
  columns: [
    { key: "ref", label: "Action / reference", render: (r) => <RefCell r={r} sub={humanize(str(r, "action_type"))} /> },
    {
      key: "source",
      label: "Source",
      render: (r) =>
        [rel(r, "finding", "reference"), rel(r, "investigation", "reference"), rel(r, "safety_report", "reference")].find((x) => x !== "-") ?? "-",
    },
    { key: "owner", label: "Responsible owner", render: (r) => str(r, "owner") || rel(r, "unit") },
    {
      key: "due",
      label: "Due date",
      render: (r) => <span className={r.is_overdue ? "text-red-500 font-semibold" : ""}>{formatDate(str(r, "due_date"))}</span>,
    },
    { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={r.is_overdue ? "overdue" : str(r, "status")} label={r.is_overdue ? `Overdue · ${humanize(str(r, "status"))}` : undefined} /> },
  ],
  fields: (l) => [
    { name: "title", label: "Action", type: "text", required: true, wide: true },
    { name: "action_type", label: "Type", type: "select", options: opts(["corrective", "preventive"]) },
    { name: "due_date", label: "Due date", type: "date" },
    { name: "quality_finding_id", label: "From finding", type: "search-select", options: l.qualityFindings },
    { name: "safety_investigation_id", label: "From investigation", type: "search-select", options: l.investigations },
    { name: "safety_report_id", label: "From safety report", type: "search-select", options: l.safetyReports },
    { name: "unit_id", label: "Unit", type: "search-select", options: l.units },
    { name: "owner", label: "Responsible owner", type: "text" },
    { name: "assigned_personnel_id", label: "Assigned to", type: "search-select", options: l.personnel },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: opts(["open", "in_progress", "awaiting_verification", "closed"]),
      help: "Closing verifies effectiveness and needs the corrective-actions.verify permission.",
    },
    { name: "description", label: "Description", type: "textarea" },
    { name: "root_cause", label: "Root cause", type: "textarea" },
    { name: "evidence", label: "Completion evidence", type: "textarea" },
    { name: "effectiveness_notes", label: "Effectiveness verification notes", type: "textarea" },
  ],
};

const complianceRegister: SqRegisterConfig = {
  formTitle: "COMPLIANCE REQUIREMENT",
  resource: "compliance-requirements",
  title: "Compliance Register",
  subtitle: "Map applicable requirements to responsible owners and evidence. Evidence past its review date shows as review due.",
  singular: "Requirement",
  icon: "mdi:clipboard-check-multiple-outline",
  createLabel: "Add requirement",
  lookups: ["units", "documents"],
  filters: [
    { name: "evidence_status", label: "All evidence statuses", options: opts(["current", "review_due", "missing", "not_applicable"]) },
    { name: "unit_id", label: "All units", options: (l) => l.units },
  ],
  columns: [
    { key: "ref", label: "Requirement", render: (r) => <RefCell r={r} sub={str(r, "source")} /> },
    { key: "owner", label: "Owner", render: (r) => str(r, "owner") || rel(r, "unit") },
    { key: "doc", label: "Controlled document", render: (r) => rel(r, "controlled_document", "document_number") },
    { key: "evidence", label: "Evidence", render: (r) => str(r, "evidence_reference") || "-" },
    { key: "review", label: "Review date", render: (r) => formatDate(str(r, "review_date")) },
    { key: "status", label: "Evidence status", align: "right", render: (r) => <SqStatus value={str(r, "effective_status")} /> },
  ],
  fields: (l) => [
    { name: "title", label: "Requirement", type: "text", required: true, wide: true },
    { name: "source", label: "Source / reference", type: "text", placeholder: "Directive, policy or standard" },
    { name: "evidence_status", label: "Evidence status", type: "select", required: true, options: opts(["current", "review_due", "missing", "not_applicable"]) },
    { name: "owner", label: "Owner", type: "text" },
    { name: "unit_id", label: "Unit", type: "search-select", options: l.units },
    { name: "controlled_document_id", label: "Controlled document", type: "search-select", options: l.documents },
    { name: "evidence_reference", label: "Evidence reference", type: "text" },
    { name: "review_date", label: "Review date", type: "date" },
    { name: "description", label: "Notes", type: "textarea" },
  ],
};

const DOCUMENT_CATEGORIES = opts(["safety", "quality", "risk_management", "forms_checklists", "policy", "compliance"]);

const documentsRegister: SqRegisterConfig = {
  formTitle: "CONTROLLED DOCUMENT RECORD",
  resource: "controlled-documents",
  title: "Safety & Quality Manuals Library",
  subtitle: "Current approved manuals, procedures, forms and checklists. Always check revision and access status.",
  singular: "Document",
  icon: "mdi:book-open-page-variant-outline",
  createLabel: "Add document",
  lookups: [],
  filters: [
    { name: "category", label: "All categories", options: DOCUMENT_CATEGORIES },
    { name: "status", label: "All statuses", options: opts(["draft", "approved", "superseded"]) },
    { name: "access_level", label: "All access levels", options: opts(["general", "restricted"]) },
  ],
  columns: [
    {
      key: "doc",
      label: "Document title / ID",
      render: (r) => (
        <div className="flex items-center gap-3 min-w-[240px]">
          <FileBadge type={str(r, "file_type")} />
          <div>
            <div className="font-semibold">{str(r, "title")}</div>
            <div className="text-[11px] opacity-70">
              <span className="font-mono">{str(r, "document_number")}</span>
              {str(r, "description") ? ` · ${str(r, "description")}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    { key: "category", label: "Category", render: (r) => humanize(str(r, "category")) },
    { key: "revision", label: "Revision", render: (r) => str(r, "revision") || "-" },
    { key: "effective", label: "Effective", render: (r) => formatDate(str(r, "effective_date")) },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <SqStatus value={str(r, "status")} />
          {r.access_level === "restricted" && <SqStatus value="restricted" />}
        </div>
      ),
    },
    {
      key: "download",
      label: "Action",
      align: "right",
      render: (r) =>
        r.can_download ? (
          <button
            type="button"
            onClick={() => downloadControlledDocument(r)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50]"
          >
            <Icon icon="mdi:download" className="w-3.5 h-3.5" />
            Download
          </button>
        ) : (
          <span className="text-[11px] opacity-60">{r.has_file ? "Restricted" : "No file"}</span>
        ),
    },
  ],
  fields: (_l, record) => [
    { name: "title", label: "Document title", type: "text", required: true, wide: true },
    { name: "document_number", label: "Document number", type: "text", required: true, placeholder: "e.g. SQ-PRO-011" },
    { name: "category", label: "Category", type: "select", required: true, options: DOCUMENT_CATEGORIES },
    { name: "revision", label: "Revision", type: "text", placeholder: "e.g. Rev 1.0" },
    { name: "access_level", label: "Access classification", type: "select", required: true, options: opts(["general", "restricted"]) },
    { name: "effective_date", label: "Effective date", type: "date" },
    { name: "review_date", label: "Next review date", type: "date" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: opts(["draft", "approved", "superseded"]),
      help: "Publishing (approved) requires the controlled-documents.approve permission.",
    },
    {
      name: "file",
      label: record?.has_file ? "Replace file" : "Attach file",
      type: "file",
      accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
      help: record?.file_name ? `Current: ${str(record, "file_name")}` : "PDF, Word, Excel or PowerPoint, up to 50 MB.",
    },
    { name: "description", label: "Description", type: "textarea" },
  ],
  footerNote: "Files are stored privately and served only to users with access. Drafts are visible only to document controllers.",
};

export const SafetyReportsRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={safetyReportsRegister} recordId={recordId} />;
export const RisksRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={risksRegister} recordId={recordId} />;
export const InvestigationsRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={investigationsRegister} recordId={recordId} />;
export const AuditsRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={auditsRegister} recordId={recordId} />;
export const FindingsRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={findingsRegister} recordId={recordId} />;
export const CorrectiveActionsRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={actionsRegister} recordId={recordId} />;
export const ComplianceRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={complianceRegister} recordId={recordId} />;
export const DocumentsRegister = ({ recordId }: { recordId?: number }) => <RegisterSection config={documentsRegister} recordId={recordId} />;
