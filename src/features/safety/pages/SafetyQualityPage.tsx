import { useMemo } from "react";
import { Icon } from "@iconify/react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { SafetyOverviewTab } from "../components/SafetyOverviewTab";
import {
  AuditsRegister,
  ComplianceRegister,
  CorrectiveActionsRegister,
  DocumentsRegister,
  FindingsRegister,
  InvestigationsRegister,
  RisksRegister,
  SafetyReportsRegister,
} from "../components/registers";
import { PilotCurrencySection, QualificationsSection, TrainingSection } from "../components/PersonnelSections";
import { AdminSection, ReportsSection, UnitOversightSection } from "../components/OversightSections";
import { useSqPermissions } from "../components/sqHelpers";

export type SqSectionKey =
  | "overview"
  | "hazards"
  | "risks"
  | "investigations"
  | "audits"
  | "findings"
  | "actions"
  | "compliance"
  | "manuals"
  | "qualifications"
  | "currency"
  | "training"
  | "units"
  | "reports"
  | "admin";

type MainTabKey = "overview" | "safety" | "quality" | "documents" | "personnel" | "oversight" | "reports" | "admin";

/** Keep the permissions in step with SAFETY_QUALITY_ROUTE_PERMISSIONS (routes.tsx) and the Sidebar entry. */
const SECTIONS: Record<SqSectionKey, { label: string; icon: string; tab: MainTabKey; permission: string }> = {
  overview: { label: "Overview", icon: "mdi:view-dashboard-outline", tab: "overview", permission: "safety-quality.dashboard.view" },
  hazards: { label: "Hazards & Occurrences", icon: "mdi:alert-outline", tab: "safety", permission: "safety-reports.viewAny" },
  risks: { label: "Risk Register", icon: "mdi:shield-alert-outline", tab: "safety", permission: "safety-risks.viewAny" },
  investigations: { label: "Investigations", icon: "mdi:magnify-scan", tab: "safety", permission: "safety-investigations.viewAny" },
  audits: { label: "Audits & Inspections", icon: "mdi:clipboard-search-outline", tab: "quality", permission: "quality-audits.viewAny" },
  findings: { label: "Findings", icon: "mdi:clipboard-alert-outline", tab: "quality", permission: "quality-findings.viewAny" },
  actions: { label: "Corrective Actions", icon: "mdi:checkbox-marked-circle-outline", tab: "quality", permission: "corrective-actions.viewAny" },
  compliance: { label: "Compliance Register", icon: "mdi:clipboard-check-multiple-outline", tab: "quality", permission: "compliance-requirements.viewAny" },
  manuals: { label: "Manuals & Documents", icon: "mdi:book-open-page-variant-outline", tab: "documents", permission: "controlled-documents.viewAny" },
  qualifications: { label: "Ratings & Qualifications", icon: "mdi:card-account-details-star-outline", tab: "personnel", permission: "personnel-qualifications.viewAny" },
  currency: { label: "Pilot Currency", icon: "mdi:clock-check-outline", tab: "personnel", permission: "safety-quality.pilot-currency.view" },
  training: { label: "Training & Currency", icon: "mdi:school-outline", tab: "personnel", permission: "safety-quality.training.view" },
  units: { label: "Unit Oversight", icon: "mdi:sitemap-outline", tab: "oversight", permission: "safety-quality.unit-oversight.view" },
  reports: { label: "Reports & Analytics", icon: "mdi:file-chart-outline", tab: "reports", permission: "safety-quality.reports.view" },
  admin: { label: "Administration", icon: "mdi:cog-outline", tab: "admin", permission: "safety-quality.dashboard.view" },
};

const MAIN_TABS: Array<{ id: MainTabKey; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "mdi:view-dashboard-outline" },
  { id: "safety", label: "Safety Reporting", icon: "mdi:alert-outline" },
  { id: "quality", label: "Quality Assurance", icon: "mdi:clipboard-search-outline" },
  { id: "documents", label: "Manuals & Documents", icon: "mdi:book-open-page-variant-outline" },
  { id: "personnel", label: "Qualifications & Currency", icon: "mdi:account-tie-hat-outline" },
  { id: "oversight", label: "Unit Oversight", icon: "mdi:sitemap-outline" },
  { id: "reports", label: "Reports", icon: "mdi:file-chart-outline" },
  { id: "admin", label: "Administration", icon: "mdi:cog-outline" },
];

const isSection = (value: string | undefined): value is SqSectionKey => Boolean(value && value in SECTIONS);

export const SafetyQualityPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { section: param, recordId: recordParam } = useParams<{ section?: string; recordId?: string }>();
  const recordId = recordParam && /^\d+$/.test(recordParam) ? Number(recordParam) : undefined;
  const { has } = useSqPermissions();

  const canAccess = (key: SqSectionKey) => has(SECTIONS[key].permission);
  const accessible = (Object.keys(SECTIONS) as SqSectionKey[]).filter(canAccess);
  const visibleTabs = MAIN_TABS.filter((t) => accessible.some((s) => SECTIONS[s].tab === t.id));

  const section: SqSectionKey | undefined = isSection(param) && canAccess(param) ? param : accessible[0];
  const activeTab = section ? SECTIONS[section].tab : undefined;
  const subSections = useMemo(
    () => accessible.filter((s) => activeTab && SECTIONS[s].tab === activeTab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, accessible.join(",")],
  );

  if (!section) {
    return <Navigate to="/dashboard" replace />;
  }
  if (param !== section) {
    return <Navigate to={`/dashboard/safety-quality/${section}`} replace />;
  }

  const go = (key: SqSectionKey) => navigate(`/dashboard/safety-quality/${key}`);
  const openTab = (tab: MainTabKey) => {
    const first = accessible.find((s) => SECTIONS[s].tab === tab);
    if (first) go(first);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-2xl font-bold uppercase tracking-wide", isDark ? "text-white" : "text-slate-900")}>
            Safety & Quality Hub
          </h1>
          <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-slate-500")}>
            Aviation safety reporting, risk management, quality assurance, controlled manuals and compliance oversight
          </p>
        </div>
      </div>

      <div className={cn("border-b relative overflow-x-auto", isDark ? "border-[#0A4D66]/40" : "border-slate-300")}>
        <div className="flex space-x-2 sm:space-x-4">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => openTab(tab.id)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-3 text-sm transition-all relative outline-none rounded-t-lg whitespace-nowrap",
                  isActive
                    ? isDark
                      ? "text-[#7FD5FF] font-bold bg-[#7FD5FF]/10"
                      : "text-sky-600 font-bold bg-sky-50"
                    : isDark
                      ? "text-gray-400 font-medium hover:text-white hover:bg-white/5"
                      : "text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                <Icon
                  icon={tab.icon}
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? (isDark ? "text-[#7FD5FF]" : "text-sky-600") : isDark ? "text-gray-400" : "text-slate-500",
                  )}
                />
                <span>{tab.label}</span>
                {isActive && (
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full transition-all",
                      isDark ? "bg-[#00A3E0] shadow-[0_0_12px_rgba(0,163,224,0.9)]" : "bg-sky-600 shadow-sm",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {subSections.length > 1 && (
        <div className="overflow-x-auto">
          <div
            className={cn(
              "inline-flex items-center space-x-1 p-1 rounded-xl border",
              isDark ? "bg-[#0A4D66] border-[#0A4D66]" : "bg-slate-200 border-slate-300",
            )}
          >
            {subSections.map((key) => {
              const isActive = section === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => go(key)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                    isActive
                      ? isDark
                        ? "bg-[#001825] text-[#7FD5FF] font-bold shadow-md border border-[#7FD5FF]/50"
                        : "bg-white text-sky-700 font-bold shadow-md border border-slate-300"
                      : isDark
                        ? "text-gray-200 hover:text-white"
                        : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <Icon icon={SECTIONS[key].icon} className="w-4 h-4" />
                  <span>{SECTIONS[key].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {section === "overview" && <SafetyOverviewTab canAccess={canAccess} onNavigate={go} />}
      {section === "hazards" && <SafetyReportsRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "risks" && <RisksRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "investigations" && <InvestigationsRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "audits" && <AuditsRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "findings" && <FindingsRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "actions" && <CorrectiveActionsRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "compliance" && <ComplianceRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "manuals" && <DocumentsRegister key={recordId ?? "list"} recordId={recordId} />}
      {section === "qualifications" && <QualificationsSection />}
      {section === "currency" && <PilotCurrencySection />}
      {section === "training" && <TrainingSection />}
      {section === "units" && <UnitOversightSection />}
      {section === "reports" && <ReportsSection />}
      {section === "admin" && <AdminSection />}
    </div>
  );
};
