import type { GeneratorMaintenance } from "./api";

export const GENERATOR_STATUS_LABEL: Record<string, string> = {
  operational: "Operational",
  under_maintenance: "Under maintenance",
  unserviceable: "Unserviceable",
  decommissioned: "Decommissioned",
};

/** Generator statuses mapped onto the shared badge colours. */
export const GENERATOR_STATUS_TONE: Record<string, string> = {
  operational: "approved",
  under_maintenance: "in_progress",
  unserviceable: "rejected",
  decommissioned: "cancelled",
};

export const num = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? "–" : value.toLocaleString(undefined, { maximumFractionDigits: digits });

/** Decimal hours as "5 h 30 min" (the run log's total time worked). */
export const hoursMinutes = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined) return "–";
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
};

export const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "–";

/** Same rule as the server: a run whose off time is before its on time crosses midnight. */
export const previewHours = (timeOn: string, timeOff: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(timeOn) || !/^\d{2}:\d{2}$/.test(timeOff) || timeOn === timeOff) return null;
  const [h1, m1] = timeOn.split(":").map(Number);
  const [h2, m2] = timeOff.split(":").map(Number);
  let minutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
};

export const apiError = (error: unknown, fallback = "Something went wrong.") => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || fallback;
};

export const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  routine_service: "Routine service",
  oil_change: "Oil change",
  filter_change: "Filter change",
  repair: "Repair",
  overhaul: "Overhaul",
  inspection: "Inspection",
  other: "Other",
};

/** Headline for the service countdown (GeneratorUsageService::maintenance()). */
export const serviceCountdown = (m?: GeneratorMaintenance | null): { text: string; tone: "sky" | "amber" | "red" | "emerald"; badge: string; label: string } => {
  if (!m || m.status === "not_set" || m.hours_remaining === null) {
    return { text: "No interval set", tone: "sky", badge: "general", label: "Not set" };
  }
  if (m.status === "overdue") {
    return { text: `Overdue by ${num(Math.abs(m.hours_remaining))} hrs`, tone: "red", badge: "overdue", label: "Service overdue" };
  }
  if (m.status === "due_soon") {
    return { text: `${num(m.hours_remaining)} hrs left`, tone: "amber", badge: "medium", label: "Service due soon" };
  }
  return { text: `${num(m.hours_remaining)} hrs left`, tone: "emerald", badge: "on_track", label: "OK" };
};
