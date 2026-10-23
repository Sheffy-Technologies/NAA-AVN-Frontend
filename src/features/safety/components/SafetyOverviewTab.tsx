import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { MetricCard, type MetricBadgeColor } from "@/shared/ui/metric/MetricCard";
import { useGetSqDashboardQuery, type SqRecord } from "../api";
import type { SqSectionKey } from "../pages/SafetyQualityPage";
import { PrimaryButton, SqPanel, SqStatus } from "./sqUi";
import { formatDate } from "./sqHelpers";

type Card = {
  section: SqSectionKey;
  label: string;
  value: string | number;
  icon: string;
  badge: string;
  badgeColor: MetricBadgeColor;
};

const Progress = ({ label, percent, caption, onOpen }: { label: string; percent: number; caption: string; onOpen: () => void }) => {
  const { isDark } = useTheme();
  return (
    <SqPanel title={label}>
      <div className={cn("h-2 rounded-full overflow-hidden", isDark ? "bg-[#0A4D66]/40" : "bg-slate-200")}>
        <div className="h-full rounded-full bg-[#0A4D66] dark:bg-[#7FD5FF]" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <div className={cn("text-[11px] mt-2 mb-3", isDark ? "text-gray-400" : "text-slate-500")}>{caption}</div>
      <button type="button" onClick={onOpen} className="text-xs font-semibold text-[#0A4D66] dark:text-[#7FD5FF] hover:underline">
        Open →
      </button>
    </SqPanel>
  );
};

const RecentList = ({ rows, empty, onOpen }: { rows: SqRecord[]; empty: string; onOpen: () => void }) => {
  const { isDark } = useTheme();
  if (!rows.length) {
    return <p className={cn("text-xs py-6 text-center", isDark ? "text-gray-400" : "text-slate-500")}>{empty}</p>;
  }
  return (
    <ul className={cn("divide-y", isDark ? "divide-[#0A4D66]/30" : "divide-slate-100")}>
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 py-2.5 text-left">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">
                <span className="font-mono opacity-70">{String(r.reference ?? "")}</span> · {String(r.title ?? "")}
              </div>
              <div className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>
                {(r.unit as { name?: string } | null)?.name ?? "No unit"} · {formatDate(String(r.created_at ?? ""))}
              </div>
            </div>
            <SqStatus value={String(r.risk_level ?? r.severity ?? "")} />
          </button>
        </li>
      ))}
    </ul>
  );
};

export const SafetyOverviewTab = ({
  canAccess,
  onNavigate,
}: {
  canAccess: (section: SqSectionKey) => boolean;
  onNavigate: (section: SqSectionKey) => void;
}) => {
  const { isDark } = useTheme();
  const { data, isLoading } = useGetSqDashboardQuery();
  const v = (n: number | undefined) => (isLoading ? "…" : String(n ?? 0));

  const cards: Card[] = [
    {
      section: "hazards",
      label: "Hazards & Occurrences",
      value: v(data?.safety_reports.open),
      icon: "mdi:alert-outline",
      badge: `${data?.safety_reports.high_priority ?? 0} high priority`,
      badgeColor: (data?.safety_reports.high_priority ?? 0) > 0 ? "red" : "emerald",
    },
    {
      section: "risks",
      label: "Risk Register",
      value: v(data?.risks.active),
      icon: "mdi:shield-alert-outline",
      badge: `${data?.risks.high ?? 0} high · ${data?.risks.overdue_reviews ?? 0} overdue review`,
      badgeColor: (data?.risks.high ?? 0) > 0 ? "red" : "sky",
    },
    {
      section: "investigations",
      label: "Investigations",
      value: v(data?.investigations.open),
      icon: "mdi:magnify-scan",
      badge: (data?.investigations.overdue ?? 0) > 0 ? `${data?.investigations.overdue} past target` : "On schedule",
      badgeColor: (data?.investigations.overdue ?? 0) > 0 ? "amber" : "emerald",
    },
    {
      section: "audits",
      label: "Audits & Inspections",
      value: v((data?.audits.planned ?? 0) + (data?.audits.in_progress ?? 0)),
      icon: "mdi:clipboard-search-outline",
      badge: `${data?.audits.completed_this_month ?? 0} completed this month`,
      badgeColor: "indigo",
    },
    {
      section: "findings",
      label: "Quality Findings",
      value: v(data?.findings.open),
      icon: "mdi:clipboard-alert-outline",
      badge: `${data?.findings.high ?? 0} high severity`,
      badgeColor: (data?.findings.high ?? 0) > 0 ? "red" : "sky",
    },
    {
      section: "actions",
      label: "Corrective Actions",
      value: v(data?.corrective_actions.open),
      icon: "mdi:checkbox-marked-circle-outline",
      badge: `${data?.corrective_actions.overdue ?? 0} overdue · ${data?.corrective_actions.awaiting_verification ?? 0} to verify`,
      badgeColor: (data?.corrective_actions.overdue ?? 0) > 0 ? "red" : "teal",
    },
    {
      section: "compliance",
      label: "Compliance Register",
      value: v(data?.compliance.current),
      icon: "mdi:clipboard-check-multiple-outline",
      badge: `${(data?.compliance.review_due ?? 0) + (data?.compliance.missing ?? 0)} need evidence`,
      badgeColor: (data?.compliance.missing ?? 0) > 0 ? "amber" : "emerald",
    },
    {
      section: "manuals",
      label: "Manuals & Documents",
      value: v(data?.documents.approved),
      icon: "mdi:book-open-page-variant-outline",
      badge: `${data?.documents.draft ?? 0} drafts · ${data?.documents.review_due ?? 0} review due`,
      badgeColor: (data?.documents.review_due ?? 0) > 0 ? "amber" : "sky",
    },
    {
      section: "qualifications",
      label: "Ratings & Qualifications",
      value: v(data?.qualifications.total),
      icon: "mdi:card-account-details-star-outline",
      badge: `${data?.qualifications.lapsed ?? 0} lapsed · ${data?.qualifications.expiring_soon ?? 0} expiring`,
      badgeColor: (data?.qualifications.lapsed ?? 0) > 0 ? "red" : "emerald",
    },
    {
      section: "currency",
      label: "Pilot Currency",
      value: v(data?.pilot_currency.total),
      icon: "mdi:clock-check-outline",
      badge: `${data?.pilot_currency.lapsed ?? 0} lapsed · ${data?.pilot_currency.expiring_soon ?? 0} expiring`,
      badgeColor: (data?.pilot_currency.lapsed ?? 0) > 0 ? "red" : "emerald",
    },
    {
      section: "training",
      label: "Training & Currency",
      value: "Courses",
      icon: "mdi:school-outline",
      badge: "Personnel courses",
      badgeColor: "indigo",
    },
    {
      section: "units",
      label: "Unit Oversight",
      value: v(data?.units.total),
      icon: "mdi:sitemap-outline",
      badge: `${data?.units.attention_required ?? 0} need attention`,
      badgeColor: (data?.units.attention_required ?? 0) > 0 ? "red" : "emerald",
    },
    {
      section: "reports",
      label: "Reports & Analytics",
      value: "6",
      icon: "mdi:file-chart-outline",
      badge: "Management reports",
      badgeColor: "neutral",
    },
  ];

  const visibleCards = cards.filter((c) => canAccess(c.section));
  const risksReviewedPct = data && data.risks.active > 0 ? Math.round(((data.risks.active - data.risks.overdue_reviews) / data.risks.active) * 100) : 100;
  const docsTotal = (data?.documents.approved ?? 0) + (data?.documents.draft ?? 0);
  const docsCurrentPct = docsTotal > 0 ? Math.round((((data?.documents.approved ?? 0) - (data?.documents.review_due ?? 0)) / docsTotal) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-600")}>
            Safety & Quality Functions
          </h3>
          <span className={cn("text-[11px]", isDark ? "text-gray-500" : "text-slate-400")}>Click any card to open it</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleCards.map((c) => (
            <MetricCard
              key={c.section}
              id={c.section}
              label={c.label}
              value={c.value}
              icon={c.icon}
              badge={c.badge}
              badgeColor={c.badgeColor}
              onClick={() => onNavigate(c.section)}
            />
          ))}
        </div>
      </div>

      <div className={cn("rounded-xl border p-4", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">Quick Safety Dispatcher</h4>
            <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
              Report a hazard, raise an action or open the manuals library
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAccess("hazards") && (
              <PrimaryButton icon="mdi:alert-plus-outline" onClick={() => onNavigate("hazards")}>
                Report hazard / occurrence
              </PrimaryButton>
            )}
            {canAccess("actions") && (
              <PrimaryButton icon="mdi:checkbox-marked-circle-plus-outline" onClick={() => onNavigate("actions")}>
                Create corrective action
              </PrimaryButton>
            )}
            {canAccess("audits") && (
              <PrimaryButton icon="mdi:calendar-clock" onClick={() => onNavigate("audits")}>
                Schedule audit
              </PrimaryButton>
            )}
            {canAccess("manuals") && (
              <PrimaryButton icon="mdi:book-search-outline" onClick={() => onNavigate("manuals")}>
                Find a manual
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canAccess("hazards") && (
          <SqPanel
            title="Recent safety reports"
            action={
              <button type="button" onClick={() => onNavigate("hazards")} className="text-xs font-semibold text-[#0A4D66] dark:text-[#7FD5FF] hover:underline">
                View all
              </button>
            }
          >
            <RecentList rows={data?.safety_reports.recent ?? []} empty="No safety reports yet." onOpen={() => onNavigate("hazards")} />
          </SqPanel>
        )}
        {canAccess("findings") && (
          <SqPanel
            title="Recent quality findings"
            action={
              <button type="button" onClick={() => onNavigate("findings")} className="text-xs font-semibold text-[#0A4D66] dark:text-[#7FD5FF] hover:underline">
                View all
              </button>
            }
          >
            <RecentList rows={data?.findings.recent ?? []} empty="No quality findings yet." onOpen={() => onNavigate("findings")} />
          </SqPanel>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {canAccess("risks") && (
          <Progress label="Risk management" percent={risksReviewedPct} caption={`${risksReviewedPct}% of open risks reviewed on schedule`} onOpen={() => onNavigate("risks")} />
        )}
        {canAccess("actions") && (
          <Progress
            label="Quality assurance"
            percent={data?.corrective_actions.on_track_percent ?? 100}
            caption={`${data?.corrective_actions.on_track_percent ?? 100}% of open corrective actions on track`}
            onOpen={() => onNavigate("actions")}
          />
        )}
        {canAccess("manuals") && (
          <Progress label="Document control" percent={docsCurrentPct} caption={`${docsCurrentPct}% of the library approved and within review date`} onOpen={() => onNavigate("manuals")} />
        )}
      </div>

      {data && (
        <p className={cn("text-[11px] flex items-center gap-1", isDark ? "text-gray-500" : "text-slate-400")}>
          <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
          Figures as of {formatDate(data.reference_date)}, limited to the units you have access to.
        </p>
      )}
    </div>
  );
};
