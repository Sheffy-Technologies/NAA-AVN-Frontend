import type { OccupantPersonnel, OccupancyStatus } from "./api";

export const OCCUPANCY_STATUS: Record<OccupancyStatus, { label: string; tone: string }> = {
  vacant: { label: "Vacant", tone: "current" },
  partly_occupied: { label: "Partly occupied", tone: "medium" },
  occupied: { label: "Occupied", tone: "open" },
  under_maintenance: { label: "Under maintenance", tone: "in_progress" },
  condemned: { label: "Condemned", tone: "high" },
};

export const STAY_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "In residence", tone: "current" },
  vacated: { label: "Vacated", tone: "cancelled" },
};

export const RESIDENCE_STATUS_LABEL: Record<string, string> = {
  available: "In use",
  under_maintenance: "Under maintenance",
  condemned: "Condemned",
};

export const personName = (p?: OccupantPersonnel | null) =>
  p ? [p.rank?.name, p.firstname, p.othernames, p.lastname].filter(Boolean).join(" ") : "Personnel outside your units";

export const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "–";

export const today = () => new Date().toISOString().slice(0, 10);

export const apiError = (error: unknown, fallback = "Something went wrong.") => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || fallback;
};
