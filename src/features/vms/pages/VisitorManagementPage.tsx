import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { format, parseISO } from "date-fns";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { AppTabs } from "@/shared/ui/tabs/AppTabs";
import { NumberedPagination } from "@/shared/ui/pagination/NumberedPagination";
import { downloadCsvFile } from "@/shared/utils/csv";
import { SecondaryButton, SqPanel, SqTable, StatTile } from "@/features/safety/components/sqUi";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import {
  VISIT_STATUSES,
  useGetVmsSummaryQuery,
  useGetVmsVisitorsQuery,
  useGetVmsVisitsQuery,
  vmsErrorMessage,
  type VisitStatus,
  type VmsVisit,
  type VmsVisitor,
  type VmsVisitRow,
} from "../api";
import {
  BarList,
  BadgeStatusBadge,
  ColumnChart,
  VisitStatusBadge,
} from "../components/VmsCharts";
import { VisitorDetailsModal } from "../components/VisitorDetailsModal";
import {
  formatMinutes,
  formatVmsDate,
  formatVmsDateTime,
  formatVmsTime,
  hourLabel,
  useDebouncedValue,
  VISIT_STATUS_BAR,
  VISIT_STATUS_LABEL,
} from "../vmsHelpers";

type Tab = "overview" | "visits" | "visitors";

const TABS = [
  { id: "overview" as const, label: "Overview", icon: "mdi:chart-box-outline" },
  { id: "visits" as const, label: "Visits", icon: "mdi:calendar-account-outline" },
  { id: "visitors" as const, label: "Visitors", icon: "mdi:account-group-outline" },
];

const PAGE_SIZE = 25;

/**
 * Visitor Management: read-only view of the NAAC Visitor Management System
 * (external), at /dashboard/visitors. Needs `vms.view`.
 */
export const VisitorManagementPage = () => {
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === searchParams.get("tab"))?.id ?? "overview") as Tab;
  const [visitorId, setVisitorId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-slate-900")}>Visitor Management</h1>
        <p className={cn("mt-1 text-sm", isDark ? "text-gray-400" : "text-slate-500")}>
          Visitors, visits and badges from the NAAC Visitor Management System. Read-only: records are created and
          approved in the VMS itself.
        </p>
      </div>

      <AppTabs
        tabs={TABS}
        activeTab={tab}
        onChange={(id) => setSearchParams(id === "overview" ? {} : { tab: id }, { replace: true })}
      />

      {tab === "overview" && <OverviewTab />}
      {tab === "visits" && <VisitsTab />}
      {tab === "visitors" && <VisitorsTab onOpen={setVisitorId} />}

      <VisitorDetailsModal visitorId={visitorId} onClose={() => setVisitorId(null)} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

const OverviewTab = () => {
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [department, setDepartment] = useState("");
  const [refresh, setRefresh] = useState(0);

  const { data, isLoading, isFetching, isError, error, refetch } = useGetVmsSummaryQuery({
    from: from || undefined,
    to: to || undefined,
    department: department || undefined,
    refresh: refresh || undefined,
  });

  // A filter change after a refresh reads the cache the refresh just renewed.
  const withCache = <T,>(set: (value: T) => void) => (value: T) => {
    setRefresh(0);
    set(value);
  };
  const changeFrom = withCache(setFrom);
  const changeTo = withCache(setTo);
  const changeDepartment = withCache(setDepartment);

  const muted = isDark ? "text-gray-400" : "text-slate-500";
  const rangeInvalid = Boolean(from && to && from > to);

  const dayPoints = useMemo(
    () =>
      (data?.by_day ?? []).map((d) => ({
        key: d.date,
        label: format(parseISO(d.date), "d MMM"),
        value: d.count,
      })),
    [data],
  );

  if (isLoading) {
    return (
      <div className={cn("flex h-72 items-center justify-center text-sm", muted)}>
        <Icon icon="mdi:loading" className="mr-2 h-5 w-5 animate-spin" />
        Loading from the visitor management system…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={cn("flex h-72 flex-col items-center justify-center gap-3 text-sm", muted)}>
        <Icon icon="mdi:cloud-alert-outline" className="h-8 w-8" />
        {vmsErrorMessage(error)}
        <SecondaryButton icon="mdi:refresh" onClick={() => refetch()}>
          Try again
        </SecondaryButton>
      </div>
    );
  }

  const { totals } = data;
  const periodLabel = from || to ? `${from ? formatVmsDate(from) : "start"} – ${to ? formatVmsDate(to) : "today"}` : "All time";

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-40">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>Scheduled from</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => changeFrom(e.target.value)} className={fieldClass} />
        </label>
        <label className="w-40">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => changeTo(e.target.value)} className={fieldClass} />
        </label>
        <label className="w-56">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>Host department</span>
          <select value={department} onChange={(e) => changeDepartment(e.target.value)} className={fieldClass}>
            <option value="">All departments</option>
            {data.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>
        </label>
        {(from || to || department) && (
          <SecondaryButton
            icon="mdi:filter-remove-outline"
            onClick={() => {
              changeFrom("");
              changeTo("");
              changeDepartment("");
            }}
          >
            Clear
          </SecondaryButton>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className={cn("text-[11px]", muted)}>Updated {formatVmsDateTime(data.fetched_at)}</span>
          <SecondaryButton icon={isFetching ? "mdi:loading" : "mdi:refresh"} disabled={isFetching} onClick={() => setRefresh(Date.now())}>
            Refresh
          </SecondaryButton>
        </div>
      </div>

      {rangeInvalid && <Notice tone="warning">The start date is after the end date.</Notice>}
      {data.truncated && (
        <Notice tone="warning">
          The VMS holds {data.visits_in_vms.toLocaleString()} visits; these figures cover the most recent{" "}
          {data.visits_read.toLocaleString()}. Raise <code>VMS_SUMMARY_MAX_PAGES</code> on the server to include more.
        </Notice>
      )}

      {/* Headline figures */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Registered visitors" value={totals.visitors.toLocaleString()} sub="All time, in the VMS" icon="mdi:account-group-outline" />
        <StatTile label="Visits" value={totals.visits.toLocaleString()} sub={periodLabel} icon="mdi:calendar-account-outline" />
        <StatTile label="On site now" value={totals.on_site} sub="Checked in, not out" icon="mdi:map-marker-account-outline" tone="emerald" />
        <StatTile label="Awaiting approval" value={totals.pending} sub="Pending visits" icon="mdi:timer-sand" tone="amber" />
        <StatTile label="Scheduled today" value={totals.today} sub={format(new Date(), "d MMM yyyy")} icon="mdi:calendar-today" />
        <StatTile
          label="Average time on site"
          value={formatMinutes(totals.average_duration_minutes)}
          sub={`${totals.unique_visitors} distinct visitors`}
          icon="mdi:clock-outline"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SqPanel
          title="Visits per day"
          subtitle={from || to ? "By scheduled date" : "By scheduled date, last 30 days"}
          className="xl:col-span-2"
        >
          <ColumnChart points={dayPoints} formatTitle={(p) => `${p.label}: ${p.value} visit${p.value === 1 ? "" : "s"}`} />
        </SqPanel>
        <SqPanel title="Visit status">
          <BarList
            rows={data.by_status.map((s) => ({
              key: s.status,
              label: VISIT_STATUS_LABEL[s.status] ?? s.status,
              value: s.count,
              barClassName: VISIT_STATUS_BAR[s.status],
            }))}
          />
        </SqPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SqPanel title="Visits by host department" subtitle="Click a department to filter the page">
          <BarList
            activeKey={department || null}
            onSelect={(key) => changeDepartment(department === key ? "" : key)}
            rows={data.by_department.map((d) => ({
              key: d.department,
              label: d.department,
              value: d.visits,
              sub: d.on_site ? `${d.on_site} on site` : undefined,
            }))}
          />
        </SqPanel>
        <SqPanel title="Check-ins by hour" subtitle={`Local time (${data.timezone})`}>
          <ColumnChart
            height={140}
            points={data.by_check_in_hour.map((h) => ({ key: String(h.hour), label: String(h.hour).padStart(2, "0"), value: h.count }))}
            formatTitle={(p) => `${hourLabel(Number(p.label))}: ${p.value} check-in${p.value === 1 ? "" : "s"}`}
          />
        </SqPanel>
        <SqPanel title="Badges" subtitle={`${data.badges.total} issued for these visits`}>
          <BarList
            rows={data.badges.by_status
              .filter((b) => b.count > 0)
              .map((b) => ({
                key: b.status,
                label: b.status,
                value: b.count,
                barClassName: ["Lost", "Damaged", "Revoked"].includes(b.status) ? "bg-red-500" : b.status === "Active" ? "bg-emerald-500" : "bg-slate-400",
              }))}
            empty="No badges issued."
          />
        </SqPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SqPanel title="Most visited hosts">
          <BarList rows={data.top_hosts.map((h) => ({ key: h.name, label: h.name, value: h.count, sub: h.department }))} />
        </SqPanel>
        <SqPanel title="Visitor organisations">
          <BarList rows={data.top_organizations.map((o) => ({ key: o.name, label: o.name, value: o.count }))} />
        </SqPanel>
        <SqPanel title="Purpose of visit">
          <BarList rows={data.top_purposes.map((p) => ({ key: p.name, label: p.name, value: p.count }))} />
        </SqPanel>
      </div>

      <SqPanel title="On site now" subtitle="Visitors checked in and not yet checked out">
        <VisitRowsTable rows={data.on_site_now} empty="No visitors are on site." />
      </SqPanel>

      <SqPanel
        title="Latest visits"
        subtitle="The ten most recently booked"
        action={
          data.recent_visits.length ? (
            <SecondaryButton icon="mdi:file-delimited-outline" onClick={() => exportVisitRows(data.recent_visits)}>
              Export CSV
            </SecondaryButton>
          ) : undefined
        }
      >
        <VisitRowsTable rows={data.recent_visits} empty="No visits for this period." />
      </SqPanel>
    </div>
  );
};

const VisitRowsTable = ({ rows, empty }: { rows: VmsVisitRow[]; empty: string }) => (
  <SqTable<VmsVisitRow>
    rows={rows}
    rowKey={(r) => r.id}
    empty={empty}
    columns={[
      { key: "visitor", label: "Visitor", render: (r) => <PersonCell name={r.visitor} sub={r.organization} /> },
      { key: "host", label: "Host", render: (r) => <PersonCell name={r.host} sub={r.department} /> },
      { key: "purpose", label: "Purpose", render: (r) => r.purpose || "—" },
      { key: "date", label: "Scheduled", render: (r) => formatVmsDate(r.scheduled_date) },
      { key: "in", label: "In", render: (r) => formatVmsTime(r.check_in_time) },
      { key: "out", label: "Out", render: (r) => formatVmsTime(r.check_out_time) },
      { key: "badges", label: "Badges", render: (r) => <Badges badges={r.badges} /> },
      { key: "status", label: "Status", render: (r) => <VisitStatusBadge status={r.status} /> },
    ]}
  />
);

const exportVisitRows = (rows: VmsVisitRow[]) =>
  downloadCsvFile(`vms-visits-${format(new Date(), "yyyy-MM-dd")}.csv`, [
    ["Visitor", "Organisation", "Host", "Department", "Purpose", "Scheduled", "Check in", "Check out", "Badges", "Status"],
    ...rows.map((r) => [
      r.visitor ?? "",
      r.organization ?? "",
      r.host ?? "",
      r.department,
      r.purpose ?? "",
      r.scheduled_date?.slice(0, 10) ?? "",
      r.check_in_time ?? "",
      r.check_out_time ?? "",
      r.badges.map((b) => `${b.badge_number ?? ""} (${b.badge_status})`).join("; "),
      VISIT_STATUS_LABEL[r.status] ?? r.status,
    ]),
  ]);

/* ------------------------------------------------------------------ */
/* Visits                                                              */
/* ------------------------------------------------------------------ */

const VisitsTab = () => {
  const fieldClass = useFieldClass();
  const { isDark } = useTheme();
  const muted = isDark ? "text-gray-400" : "text-slate-500";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VisitStatus | "">("");
  const [visitDate, setVisitDate] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isFetching, isError, error } = useGetVmsVisitsQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    visit_date: visitDate || undefined,
  });

  const rows = data?.data ?? [];

  return (
    <SqPanel
      title="Visits"
      subtitle={data?.pagination ? `${data.pagination.total.toLocaleString()} matching visits` : undefined}
      action={
        rows.length ? (
          <SecondaryButton
            icon="mdi:file-delimited-outline"
            onClick={() =>
              exportVisitRows(
                rows.map((v) => ({
                  id: v.id,
                  visitor: v.visitor?.full_name ?? null,
                  organization: v.visitor?.visitor_organization ?? null,
                  host: v.employee?.full_name ?? null,
                  department: v.employee?.department || "Unassigned",
                  purpose: v.purpose,
                  status: v.status,
                  scheduled_date: v.scheduled_date,
                  check_in_time: v.check_in_time,
                  check_out_time: v.check_out_time,
                  badges: v.badges,
                })),
              )
            }
          >
            Export page
          </SecondaryButton>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-64">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>Visitor name</span>
          <input
            type="search"
            value={search}
            placeholder="Search…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={fieldClass}
          />
        </label>
        <label className="w-44">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as VisitStatus | "");
              setPage(1);
            }}
            className={fieldClass}
          >
            <option value="">All statuses</option>
            {VISIT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-44">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>Scheduled on</span>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => {
              setVisitDate(e.target.value);
              setPage(1);
            }}
            className={fieldClass}
          />
        </label>
      </div>

      {isError ? (
        <Notice tone="danger">{vmsErrorMessage(error)}</Notice>
      ) : (
        <SqTable<VmsVisit>
          rows={rows}
          loading={isFetching && !data}
          rowKey={(v) => v.id}
          empty="No visits match these filters."
          columns={[
            {
              key: "visitor",
              label: "Visitor",
              render: (v) => <PersonCell name={v.visitor?.full_name} sub={v.visitor?.visitor_organization} />,
            },
            {
              key: "host",
              label: "Host",
              render: (v) => <PersonCell name={v.employee?.full_name} sub={v.employee?.department} />,
            },
            { key: "purpose", label: "Purpose", render: (v) => v.purpose || "—" },
            { key: "date", label: "Scheduled", render: (v) => formatVmsDate(v.scheduled_date) },
            { key: "in", label: "Check in", render: (v) => formatVmsDateTime(v.check_in_time) },
            { key: "out", label: "Check out", render: (v) => formatVmsDateTime(v.check_out_time) },
            { key: "badges", label: "Badges", render: (v) => <Badges badges={v.badges} /> },
            { key: "status", label: "Status", render: (v) => <VisitStatusBadge status={v.status} /> },
          ]}
        />
      )}

      {data?.pagination && (
        <div className="mt-4">
          <NumberedPagination currentPage={page} lastPage={data.pagination.total_pages} onPageChange={setPage} />
        </div>
      )}
    </SqPanel>
  );
};

/* ------------------------------------------------------------------ */
/* Visitors                                                            */
/* ------------------------------------------------------------------ */

const VisitorsTab = ({ onOpen }: { onOpen: (id: string) => void }) => {
  const fieldClass = useFieldClass();
  const { isDark } = useTheme();
  const muted = isDark ? "text-gray-400" : "text-slate-500";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const rangeInvalid = Boolean(from && to && from > to);

  const { data, isFetching, isError, error } = useGetVmsVisitorsQuery(
    {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      from: from || undefined,
      to: to || undefined,
    },
    { skip: rangeInvalid },
  );

  const rows = data?.data ?? [];

  return (
    <SqPanel
      title="Visitors"
      subtitle={data?.pagination ? `${data.pagination.total.toLocaleString()} registered · click a visitor to see their visits` : undefined}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="w-64">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>Name or organisation</span>
          <input
            type="search"
            value={search}
            placeholder="Search…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={fieldClass}
          />
        </label>
        <label className="w-40">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>Registered from</span>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={fieldClass} />
        </label>
        <label className="w-40">
          <span className={cn("mb-1 block text-[11px] font-semibold uppercase", muted)}>To</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={fieldClass} />
        </label>
      </div>

      {rangeInvalid ? (
        <Notice tone="warning">The start date is after the end date.</Notice>
      ) : isError ? (
        <Notice tone="danger">{vmsErrorMessage(error)}</Notice>
      ) : (
        <SqTable<VmsVisitor>
          rows={rows}
          loading={isFetching && !data}
          rowKey={(v) => v.id}
          onRowClick={(v) => onOpen(v.id)}
          empty="No visitors match these filters."
          columns={[
            { key: "name", label: "Name", render: (v) => <span className="font-semibold">{v.full_name}</span> },
            { key: "org", label: "Organisation", render: (v) => v.visitor_organization || "Not stated" },
            { key: "created", label: "Registered", render: (v) => formatVmsDateTime(v.created_at) },
            {
              key: "open",
              label: "",
              align: "right",
              render: () => <Icon icon="mdi:chevron-right" className={cn("inline h-4 w-4", muted)} />,
            },
          ]}
        />
      )}

      {data?.pagination && (
        <div className="mt-4">
          <NumberedPagination currentPage={page} lastPage={data.pagination.total_pages} onPageChange={setPage} />
        </div>
      )}
    </SqPanel>
  );
};

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

const PersonCell = ({ name, sub }: { name?: string | null; sub?: string | null }) => {
  const { isDark } = useTheme();
  if (!name) return <span className={isDark ? "text-gray-500" : "text-slate-400"}>—</span>;
  return (
    <div>
      <div className="font-semibold">{name}</div>
      {sub && <div className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>{sub}</div>}
    </div>
  );
};

const Badges = ({ badges }: { badges: VmsVisit["badges"] }) =>
  badges.length ? (
    <div className="flex flex-wrap gap-1">
      {badges.map((b, i) => (
        <BadgeStatusBadge key={`${b.badge_number}-${i}`} status={b.badge_status} number={b.badge_number} />
      ))}
    </div>
  ) : (
    <span>—</span>
  );

const Notice = ({ tone, children }: { tone: "warning" | "danger"; children: React.ReactNode }) => (
  <div
    className={cn(
      "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
      tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-400",
    )}
  >
    <Icon icon={tone === "warning" ? "mdi:alert-outline" : "mdi:alert-circle-outline"} className="mt-0.5 h-4 w-4 shrink-0" />
    <div>{children}</div>
  </div>
);
