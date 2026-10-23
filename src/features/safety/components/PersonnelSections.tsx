import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import {
  useGetPilotCurrencyQuery,
  useGetQualificationsQuery,
  useGetSqRecordsQuery,
  useGetTrainingSummaryQuery,
  type PilotCurrencyRow,
  type QualificationRow,
  type SqRecord,
} from "../api";
import { RecordFormModal, type SqField } from "./RecordFormModal";
import { useSqLookups, type SqLookups } from "./useSqLookups";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus, SqTable, StatTile } from "./sqUi";
import { formatDate, humanize, useFieldClass, useSqPermissions } from "./sqHelpers";
import { downloadCsvFile } from "@/shared/utils/csv";
import { downloadSummaryPdf } from "../sqExport";

const ROLES = ["pilot", "aircraft_engineer", "aircraft_technician"].map((v) => ({ value: v, label: humanize(v) }));
const CHECK_TYPES = ["proficiency_check", "recurrent_training", "instrument_check", "medical", "other"].map((v) => ({
  value: v,
  label: humanize(v),
}));

const qualificationFields = (l: SqLookups): SqField[] => [
  { name: "personnel_id", label: "Personnel", type: "search-select", required: true, options: l.personnel },
  { name: "role", label: "Role", type: "select", required: true, options: ROLES },
  { name: "asset_type_id", label: "Aircraft type", type: "search-select", options: l.assetTypes, help: "From the aircraft type master list." },
  { name: "scope", label: "Rating / authorised scope", type: "text", placeholder: "e.g. Pilot-in-command, inspection & release" },
  { name: "issued_date", label: "Issued", type: "date" },
  { name: "valid_until", label: "Valid until", type: "date" },
  { name: "evidence_reference", label: "Evidence reference", type: "text", placeholder: "Licence, check or authorisation ref." },
  { name: "notes", label: "Notes", type: "textarea" },
];

const checkFields = (l: SqLookups): SqField[] => [
  { name: "personnel_id", label: "Pilot", type: "search-select", required: true, options: l.pilots },
  { name: "check_type", label: "Event type", type: "select", required: true, options: CHECK_TYPES },
  { name: "asset_type_id", label: "Aircraft type", type: "search-select", options: l.assetTypes },
  { name: "check_date", label: "Event date", type: "date", required: true },
  { name: "valid_until", label: "Valid until", type: "date", help: "Leave blank if this event doesn't expire." },
  { name: "evidence_reference", label: "Evidence reference", type: "text", placeholder: "Verified logbook or check record" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const QualificationsSection = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const lookups = useSqLookups(["personnel", "assetTypes"]);
  const { data, isLoading } = useGetQualificationsQuery();
  const { data: records = [] } = useGetSqRecordsQuery({ resource: "personnel-qualifications" });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState<{ open: boolean; record: SqRecord | null }>({ open: false, record: null });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const aircraftTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.aircraft_type).filter(Boolean))) as string[], [rows]);
  const filtered = rows.filter(
    (r) =>
      `${r.name} ${r.service_number} ${r.unit ?? ""} ${r.aircraft_type ?? ""}`.toLowerCase().includes(search.toLowerCase()) &&
      (!role || r.role === role) &&
      (!type || r.aircraft_type === type) &&
      (!status || r.status === status),
  );

  const counts = data?.counts;
  const canEdit = has("personnel-qualifications.update");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Ratings on record" value={counts?.total ?? 0} sub="Pilots, engineers & technicians" icon="mdi:card-account-details-outline" />
        <StatTile label="Current" value={counts?.current ?? 0} sub="Within validity" icon="mdi:check-circle-outline" tone="emerald" />
        <StatTile label="Expiring ≤ 30 days" value={counts?.expiring_soon ?? 0} sub="Renewal needed" icon="mdi:calendar-clock" tone="amber" />
        <StatTile label="Lapsed" value={counts?.lapsed ?? 0} sub="Not valid for duty" icon="mdi:alert-octagon-outline" tone="red" />
      </div>

      <SqPanel
        title="Aircraft Ratings & Technical Authorisations"
        subtitle="Who is qualified or authorised on each aircraft type, with scope and validity. Pilot type ratings from personnel profiles are included automatically."
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              icon="mdi:file-delimited-outline"
              disabled={!filtered.length}
              onClick={() =>
                downloadCsvFile(`qualifications-${new Date().toISOString().slice(0, 10)}.csv`, [
                  ["Name", "Service number", "Formation", "Role", "Aircraft type", "Scope", "Issued", "Valid until", "Evidence", "Source", "Status"],
                  ...filtered.map((r) => [
                    r.name,
                    r.service_number,
                    r.unit ?? "",
                    humanize(r.role),
                    r.aircraft_type ?? "",
                    r.scope ?? "",
                    r.issued_date ?? "",
                    r.valid_until ?? "",
                    r.evidence_reference ?? "",
                    r.source === "personnel_profile" ? "Personnel profile" : "Qualification record",
                    humanize(r.status),
                  ]),
                ])
              }
            >
              Export CSV
            </SecondaryButton>
            {has("personnel-qualifications.create") && (
              <PrimaryButton onClick={() => setModal({ open: true, record: null })}>Add qualification</PrimaryButton>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, service number or unit…"
            className={cn(fieldClass, "flex-1 min-w-[200px]")}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All personnel roles</option>
            {ROLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All aircraft types</option>
            {aircraftTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All statuses</option>
            {["current", "expiring_soon", "lapsed"].map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>

        <SqTable<QualificationRow>
          rows={filtered}
          loading={isLoading}
          rowKey={(r) => `${r.source}-${r.id ?? r.personnel_id}-${r.aircraft_type}`}
          onRowClick={(r) =>
            navigate(`/dashboard/personnel/${r.personnel_id}`, {
              state: { from: "/dashboard/safety-quality/qualifications", fromLabel: "Ratings & Qualifications" },
            })
          }
          empty="No qualifications match these filters."
          columns={[
            {
              key: "who",
              label: "Personnel / service no.",
              render: (r) => (
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-[11px] opacity-70">{r.service_number}</div>
                </div>
              ),
            },
            { key: "role", label: "Role", render: (r) => humanize(r.role) },
            { key: "unit", label: "Formation", render: (r) => r.unit ?? "-" },
            { key: "type", label: "Aircraft type", render: (r) => r.aircraft_type ?? "-" },
            {
              key: "scope",
              label: "Rating / scope",
              render: (r) => (
                <div>
                  <div>{r.scope ?? "-"}</div>
                  {r.source === "personnel_profile" && (
                    <div className={cn("text-[11px]", isDark ? "text-gray-500" : "text-slate-400")}>From personnel profile</div>
                  )}
                </div>
              ),
            },
            { key: "valid", label: "Validity", render: (r) => (r.valid_until ? formatDate(r.valid_until) : "No expiry recorded") },
            { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={r.status} /> },
            ...(canEdit
              ? [
                  {
                    key: "edit",
                    label: "",
                    align: "right" as const,
                    // Profile-sourced type ratings are edited on the personnel profile, not here.
                    render: (r: QualificationRow) =>
                      r.id === null ? null : (
                        <SecondaryButton
                          icon="mdi:pencil-outline"
                          onClick={() => setModal({ open: true, record: records.find((x) => x.id === r.id) ?? null })}
                        >
                          Edit
                        </SecondaryButton>
                      ),
                  },
                ]
              : []),
          ]}
        />
        <p className={cn("text-[11px] mt-3", isDark ? "text-gray-500" : "text-slate-400")}>
          Verify ratings and authorisations against official licensing, training and engineering approval records.
        </p>
      </SqPanel>

      <RecordFormModal
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        resource="personnel-qualifications"
        title={modal.record ? "Edit qualification" : "Add aircraft qualification"}
        icon="mdi:card-account-details-star-outline"
        fields={qualificationFields(lookups)}
        record={modal.record}
        canDelete={has("personnel-qualifications.delete")}
      />
    </div>
  );
};

const CURRENCY_TONE: Record<string, string> = {
  current: "Current",
  expiring_soon: "Expiring soon",
  action_required: "Action required",
  lapsed: "Currency lapsed",
};

export const PilotCurrencySection = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const lookups = useSqLookups(["pilots", "assetTypes"]);
  const { data, isLoading } = useGetPilotCurrencyQuery();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<PilotCurrencyRow | null>(null);
  const [recording, setRecording] = useState<{ open: boolean; personnelId?: number }>({ open: false });

  const rows = useMemo(() => data?.data ?? [], [data]);
  // A pilot can hold several ratings, so filter on each one, not the joined label.
  const ratingNames = (r: PilotCurrencyRow) => (r.ratings?.length ? r.ratings.map((x) => x.name) : r.aircraft_type ? [r.aircraft_type] : []);
  const aircraftTypes = useMemo(() => Array.from(new Set(rows.flatMap(ratingNames))).sort(), [rows]);
  const filtered = rows.filter(
    (r) =>
      `${r.name} ${r.service_number} ${r.unit ?? ""} ${r.call_sign ?? ""} ${r.aircraft_type ?? ""}`.toLowerCase().includes(search.toLowerCase()) &&
      (!status || r.currency_status === status) &&
      (!type || ratingNames(r).includes(type)),
  );

  const exportCsv = () =>
    downloadCsvFile(`pilot-currency-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Pilot", "Service number", "Call sign", "Unit", "Type ratings", "Last flight", "Next flight due", "Flight status", "Last check", "Last check type", "Currency due", "Currency status"],
      ...filtered.map((r) => [
        r.name,
        r.service_number,
        r.call_sign ?? "",
        r.unit ?? "",
        r.aircraft_type ?? "",
        r.last_flight_date ?? "",
        r.next_flight_due_date ?? "",
        humanize(r.flight_status),
        r.last_check_date ?? "",
        humanize(r.last_check_type),
        r.currency_due_date ?? "",
        CURRENCY_TONE[r.currency_status],
      ]),
    ]);

  const exportPdf = (r: PilotCurrencyRow) =>
    downloadSummaryPdf({
      formTitle: "PILOT CURRENCY RECORD",
      title: `${r.name}${r.call_sign ? ` (${r.call_sign})` : ""}`,
      fileName: `Pilot currency ${r.service_number} ${r.name}`,
      fields: [
        ["Service number", r.service_number],
        ["Call sign", r.call_sign ?? "-"],
        ["Unit", r.unit ?? "-"],
        ["Currency status", CURRENCY_TONE[r.currency_status]],
        ["Last flight", formatDate(r.last_flight_date)],
        ["Next flight due", formatDate(r.next_flight_due_date)],
        ["Flight status", humanize(r.flight_status)],
        ["Currency due", formatDate(r.currency_due_date)],
      ],
      tables: [
        {
          heading: "Type ratings",
          headers: ["Rating", "Expiry", "Status"],
          rows: (r.ratings ?? []).map((x) => [x.name, formatDate(x.expiry_date), humanize(x.status)]),
          empty: r.aircraft_type ? r.aircraft_type : "No type ratings recorded",
        },
        {
          heading: "Checks (latest of each type)",
          headers: ["Check", "Date", "Valid until", "Aircraft type", "Status"],
          rows: r.checks.map((c) => [humanize(c.check_type), formatDate(c.check_date), formatDate(c.valid_until), c.aircraft_type ?? "-", humanize(c.status)]),
          empty: "No checks recorded",
        },
      ],
    });
  const counts = data?.counts;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Pilots tracked" value={counts?.total ?? 0} sub="Personnel with a real call sign" icon="mdi:account-tie-hat-outline" />
        <StatTile label="Current" value={counts?.current ?? 0} sub="Flight and checks in date" icon="mdi:check-circle-outline" tone="emerald" />
        <StatTile
          label="Expiring / action due"
          value={(counts?.expiring_soon ?? 0) + (counts?.action_required ?? 0)}
          sub="Supervisor review"
          icon="mdi:calendar-clock"
          tone="amber"
        />
        <StatTile label="Currency lapsed" value={counts?.lapsed ?? 0} sub="Verify before assignment" icon="mdi:alert-octagon-outline" tone="red" />
      </div>

      <div className="p-3 rounded-lg border text-xs bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/30 dark:border-sky-500/30 dark:text-sky-200">
        <b>Operational safeguard:</b> lapsed or unverified currency must be reviewed before tasking. This tracker is advisory; it does not
        block operation assignment.
      </div>

      <SqPanel
        title="Pilot Currency & Loss-of-Currency Monitor"
        subtitle={`Flight recency comes from recorded operations (every ${data?.flight_interval_weeks ?? "-"} weeks, set in system settings). Checks come from recorded proficiency, recurrent, instrument and medical events.`}
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon="mdi:file-delimited-outline" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </SecondaryButton>
            {has("pilot-check-records.create") && (
              <PrimaryButton onClick={() => setRecording({ open: true })}>Record check / training</PrimaryButton>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pilot, call sign, service number or unit…"
            className={cn(fieldClass, "flex-1 min-w-[200px]")}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All aircraft types</option>
            {aircraftTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All currency statuses</option>
            {Object.entries(CURRENCY_TONE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <SqTable<PilotCurrencyRow>
          rows={filtered}
          loading={isLoading}
          rowKey={(r) => r.personnel_id}
          onRowClick={setSelected}
          empty="No pilots match these filters."
          columns={[
            {
              key: "pilot",
              label: "Pilot / formation",
              render: (r) => (
                <div>
                  <div className="font-semibold">
                    {r.name} {r.call_sign && <span className="font-normal opacity-70">({r.call_sign})</span>}
                  </div>
                  <div className="text-[11px] opacity-70">
                    {r.service_number} · {r.unit ?? "-"}
                  </div>
                </div>
              ),
            },
            { key: "type", label: "Type rating", render: (r) => r.aircraft_type ?? "-" },
            {
              key: "flight",
              label: "Last flight",
              render: (r) => (
                <div>
                  <div>{formatDate(r.last_flight_date)}</div>
                  {r.flight_status && r.flight_status !== "current" && <SqStatus value={r.flight_status} />}
                </div>
              ),
            },
            {
              key: "check",
              label: "Last check",
              render: (r) => (
                <div>
                  <div>{formatDate(r.last_check_date)}</div>
                  {r.last_check_type && <div className="text-[11px] opacity-70">{humanize(r.last_check_type)}</div>}
                </div>
              ),
            },
            { key: "due", label: "Currency due", render: (r) => formatDate(r.currency_due_date) },
            {
              key: "status",
              label: "Status",
              align: "right",
              render: (r) => <SqStatus value={r.currency_status} label={CURRENCY_TONE[r.currency_status]} />,
            },
          ]}
        />
      </SqPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SqPanel title="How currency is worked out">
          <ul className={cn("list-disc pl-5 space-y-1.5 text-xs", isDark ? "text-gray-300" : "text-slate-600")}>
            <li>
              <b>Lapsed</b>: next flight was due and has passed, or the latest check of any type has expired.
            </li>
            <li>
              <b>Action required</b>: no flight on record for this pilot yet.
            </li>
            <li>
              <b>Expiring soon</b>: flight due within 7 days, or a check expiring within 30 days.
            </li>
            <li>
              <b>Current</b>: everything in date.
            </li>
          </ul>
        </SqPanel>
        <SqPanel title="Loss-of-currency workflow">
          <ol className={cn("list-decimal pl-5 space-y-1.5 text-xs", isDark ? "text-gray-300" : "text-slate-600")}>
            <li>Detect and alert: the tracker flags due, expired or missing records.</li>
            <li>Notify the pilot, unit training/operations and the authorised supervisor.</li>
            <li>Restrict applicable tasking pending review (chain of command decision).</li>
            <li>Verify reinstatement: record refresher training, checks and approval here.</li>
          </ol>
        </SqPanel>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              "w-full max-w-lg rounded-xl border p-6 shadow-2xl",
              isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">Pilot currency record</h3>
                <div className="text-sm font-semibold mt-1">{selected.name}</div>
                <div className="text-xs opacity-70">
                  {selected.service_number} · {selected.unit ?? "-"} · {selected.aircraft_type ?? "No type rating"}
                </div>
              </div>
              <SqStatus value={selected.currency_status} label={CURRENCY_TONE[selected.currency_status]} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div>
                <dt className="opacity-60">Last recorded flight</dt>
                <dd className="font-semibold">{formatDate(selected.last_flight_date)}</dd>
              </div>
              <div>
                <dt className="opacity-60">Next flight due</dt>
                <dd className="font-semibold">{formatDate(selected.next_flight_due_date)}</dd>
              </div>
            </dl>
            <div className="text-xs font-semibold mb-2">Type ratings</div>
            {selected.ratings?.length ? (
              <ul className="space-y-1.5 text-xs mb-4">
                {selected.ratings.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2">
                    <span>
                      {x.name}
                      {x.expiry_date ? ` · expires ${formatDate(x.expiry_date)}` : ""}
                    </span>
                    <SqStatus value={x.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs opacity-60 mb-4">{selected.aircraft_type ?? "No type ratings recorded."}</p>
            )}
            <div className="text-xs font-semibold mb-2">Latest check of each type</div>
            {selected.checks.length ? (
              <ul className="space-y-1.5 text-xs mb-4">
                {selected.checks.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span>
                      {humanize(c.check_type)} · {formatDate(c.check_date)}
                      {c.valid_until ? ` → ${formatDate(c.valid_until)}` : ""}
                    </span>
                    <SqStatus value={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs opacity-60 mb-4">No checks recorded.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <SecondaryButton icon="mdi:file-pdf-box" onClick={() => exportPdf(selected)}>
                Download PDF
              </SecondaryButton>
              <SecondaryButton icon="mdi:account-outline" onClick={() => navigate(`/dashboard/personnel/${selected.personnel_id}`)}>
                Personnel profile
              </SecondaryButton>
              {has("pilot-check-records.create") && (
                <PrimaryButton
                  onClick={() => {
                    setRecording({ open: true, personnelId: selected.personnel_id });
                    setSelected(null);
                  }}
                >
                  Record check
                </PrimaryButton>
              )}
              <SecondaryButton onClick={() => setSelected(null)}>Close</SecondaryButton>
            </div>
          </div>
        </div>
      )}

      <RecordFormModal
        open={recording.open}
        onClose={() => setRecording({ open: false })}
        resource="pilot-check-records"
        title="Record check or training event"
        icon="mdi:clipboard-check-outline"
        fields={checkFields(lookups)}
        defaults={recording.personnelId ? { personnel_id: String(recording.personnelId) } : undefined}
        footerNote="Flights are not recorded here: they come from operations. Status updates as soon as the event is saved."
      />
    </div>
  );
};

export const TrainingSection = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useGetTrainingSummaryQuery();
  const courses = data?.courses;
  const recurrent = data?.recurrent_training;
  const total = (courses?.scheduled ?? 0) + (courses?.ongoing ?? 0) + (courses?.completed ?? 0);
  const recurrentCurrentPct = recurrent?.recorded ? Math.round((recurrent.current / recurrent.recorded) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Courses completed" value={courses?.completed ?? 0} sub={`of ${total} on record`} icon="mdi:school-outline" tone="emerald" />
        <StatTile label="Ongoing" value={courses?.ongoing ?? 0} sub="Personnel on course now" icon="mdi:progress-clock" />
        <StatTile label="Starting in 30 days" value={courses?.starting_next_30_days ?? 0} sub="Scheduled intake" icon="mdi:calendar-start" tone="amber" />
        <StatTile
          label="Recurrent training current"
          value={recurrent?.recorded ? `${recurrentCurrentPct}%` : "-"}
          sub={`${recurrent?.lapsed ?? 0} lapsed · ${recurrent?.expiring_soon ?? 0} expiring`}
          icon="mdi:refresh-circle"
          tone={(recurrent?.lapsed ?? 0) > 0 ? "red" : "emerald"}
        />
      </div>

      <SqPanel
        title="Training & Courses"
        subtitle="Drawn from the Personnel courses module. Recurrent training for pilots is recorded on the Pilot Currency tab."
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              icon="mdi:file-delimited-outline"
              disabled={!data?.recent_courses?.length}
              onClick={() =>
                downloadCsvFile(`training-courses-${new Date().toISOString().slice(0, 10)}.csv`, [
                  ["Course", "Personnel", "Service number", "Unit", "Institution", "Location", "Start", "End", "Status"],
                  ...(data?.recent_courses ?? []).map((c) => [
                    c.title,
                    c.personnel ? `${c.personnel.firstname} ${c.personnel.lastname}` : "",
                    c.personnel?.service_number ?? "",
                    c.personnel?.unit?.name ?? "",
                    c.institution ?? "",
                    c.location ?? "",
                    c.start_date ?? "",
                    c.end_date ?? "",
                    humanize(c.status),
                  ]),
                ])
              }
            >
              Export CSV
            </SecondaryButton>
            <SecondaryButton icon="mdi:open-in-new" onClick={() => navigate("/dashboard/personnel/courses")}>
              Manage courses
            </SecondaryButton>
          </div>
        }
      >
        <SqTable
          rows={data?.recent_courses ?? []}
          loading={isLoading}
          rowKey={(r) => r.id}
          empty="No courses recorded."
          columns={[
            { key: "title", label: "Course", render: (r) => <div className="font-semibold">{r.title}</div> },
            {
              key: "who",
              label: "Personnel",
              render: (r) =>
                r.personnel ? (
                  <div>
                    <div>
                      {r.personnel.firstname} {r.personnel.lastname}
                    </div>
                    <div className="text-[11px] opacity-70">{r.personnel.unit?.name ?? r.personnel.service_number}</div>
                  </div>
                ) : (
                  "-"
                ),
            },
            { key: "inst", label: "Institution", render: (r) => [r.institution, r.location].filter(Boolean).join(" · ") || "-" },
            { key: "dates", label: "Dates", render: (r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}` },
            { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={r.status} /> },
          ]}
        />
      </SqPanel>
    </div>
  );
};
