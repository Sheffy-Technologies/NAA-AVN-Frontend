import type { BadgeVariant } from "@/shared/ui/badge/StatusBadge";
import type { LocstatStatus } from "../api";
import { formatMgrsSpaced, latLonToMgrs } from "./coordinates";

/** Same labels as OperationLocstat::STATUSES on the server. */
export const LOCSTAT_STATUS_LABEL: Record<LocstatStatus, string> = {
  on_ground: "On ground",
  airborne: "Airborne",
  holding: "Holding",
  landed: "Landed",
  rtb: "Returning to base",
  emergency: "Emergency",
};

export const LOCSTAT_STATUS_VARIANT: Record<LocstatStatus, BadgeVariant> = {
  on_ground: "neutral",
  airborne: "info",
  holding: "warning",
  landed: "success",
  rtb: "info",
  emergency: "danger",
};

/** Map marker colours per status. */
export const LOCSTAT_STATUS_COLOR: Record<LocstatStatus, string> = {
  on_ground: "#94A3B8",
  airborne: "#38BDF8",
  holding: "#F59E0B",
  landed: "#34D399",
  rtb: "#A78BFA",
  emergency: "#EF4444",
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Military date-time group in Zulu (UTC), e.g. "180930Z NOV 26". */
export const toDtg = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}Z ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
};

export const formatLocalDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + " local"
    : "—";

/** Grid reference if known, else one worked out from the coordinates, then the location name. */
export const locstatPosition = (e: {
  mgrs: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
}): string => {
  const grid = e.mgrs || (e.latitude !== null && e.longitude !== null ? formatMgrsSpaced(latLonToMgrs(e.latitude, e.longitude)) : "");
  return [grid, e.location_name].filter(Boolean).join(" · ") || "—";
};
