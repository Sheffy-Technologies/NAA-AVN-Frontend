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
