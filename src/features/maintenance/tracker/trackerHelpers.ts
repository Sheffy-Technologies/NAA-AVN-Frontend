import { useTheme } from "@/context/ThemeContext";
import { useAppSelector } from "@/app/store";
import type { TrackerBasis, TrackerCategory, TrackerComputed, TrackerItem, TrackerStatus, TrackerUnit } from "./api";

/*
 * Shared, non-component pieces of the maintenance tracker: labels, number
 * formatting, permission checks, class names and every ⓘ text. The help
 * texts describe the backend's TrackingCalculator; keep them in step with it.
 */

export const STATUS_LABEL: Record<TrackerStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  watch: "Watch",
  ok: "OK",
  no_data: "No data",
  completed: "Completed",
  on_condition: "On condition",
  daily: "Daily",
};

/** How much of the life or interval is left, as a bar. */
export const UNIT_LABEL: Record<TrackerUnit, string> = { hours: "hrs", cycles: "cycles", rin: "RIN", days: "days" };

export const fmt = (value: number | string | null | undefined, digits = 1) => {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "–";
};

export const fmtDate = (value?: string | null) => {
  if (!value) return "–";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const remainingText = (t: TrackerComputed) => (t.remaining === null ? "–" : `${fmt(t.remaining)} ${UNIT_LABEL[t.unit]}`);

export const dueText = (t: TrackerComputed) => (t.due_value !== null ? `${fmt(t.due_value)} hrs` : t.due_date ? fmtDate(t.due_date) : "–");

/** The API's own message ("error.data.message"), else a fallback. */
export const apiError = (error: unknown, fallback = "Something went wrong.") => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
  return first || data?.message || fallback;
};

export const useTrackerPermissions = () => {
  const user = useAppSelector((state) => state.auth.user);
  const permissions: string[] = user?.permissions ?? [];
  const roles: string[] = user?.role_names ?? user?.roles?.map((r) => r.name) ?? [];
  const has = (p: string) => permissions.includes(p);
  return {
    has,
    isSuperAdmin: roles.includes("super-admin"),
    canEditItems: has("maintenance-tracking-items.create") && has("maintenance-tracking-items.update"),
    canRecord: has("maintenance-tracking.record"),
    canSetCounters: has("maintenance-tracking.counters.update"),
    canRaiseWo: has("work-orders.create"),
    canEditWo: has("work-orders.update"),
  };
};

/**
 * Class names from the tracker theme (trackerTheme.ts, the HTML tracker's
 * stylesheet). Kept as a hook so components read one place.
 */
export const useTrackerClasses = () => {
  const { isDark } = useTheme();
  return {
    isDark,
    panel: "mt",
    card: "mt-card",
    field: "mt-input",
    label: "mt-label",
    muted: "mt-sub",
    tableWrap: "mt-tw",
    th: "",
    td: "",
    row: "click",
    groupRow: "gh",
  };
};

/** A column header with its ⓘ. */
export type Help = { title: string; text: string; formula?: string };

export const CATEGORY_TABS: { category: TrackerCategory; label: string }[] = [
  { category: "component", label: "Airframe components" },
  { category: "engine", label: "Engine components" },
  { category: "inspection", label: "Inspections, ADs & retorques" },
];

export const BASIS_LABEL: Record<TrackerBasis, string> = {
  airframe_hours: "Airframe hours",
  engine_hours: "Engine hours",
  rin: "RIN (hours × multiplier)",
  starts: "Engine starts",
  starts_landings: "Starts + landing factor × landings",
  interval_airframe_hours: "Inspection – A/F hours",
  interval_engine_hours: "Inspection – engine hours",
  phase: "Phase inspection",
  calendar: "Calendar (days)",
  expiry: "Expiry date",
  on_condition: "On condition",
  daily: "Daily",
};

export const STATUS_HELP: Help = {
  title: "Status",
  text: "Overdue: past the limit. Due soon: 10 hours or less, or 10% of the life/interval or less. Watch: 25% or less. Calendar items: due soon within 30 days, watch within 90. On condition and Daily items have no due point. A component or engine part that is overdue grounds the aircraft; inspections are advisory.",
};

export const COUNTER_HELP: Record<"airframe_hours" | "engine_hours" | "engine_starts" | "landings" | "hobbs_hours" | "as_of", Help> = {
  airframe_hours: {
    title: "A/C total time",
    text: "The airframe's total flying hours: the baseline entered for the aircraft plus every flight recorded (operations and the flight log). Airframe-hour parts, RIN parts, A/F-hour inspections and phases run on it.",
  },
  engine_hours: {
    title: "Engine total time",
    text: "The engine's total hours: its baseline plus every flight recorded. Engine-hour parts (engine overhaul, hot section) and engine inspections run on it. Blank until a baseline is entered.",
  },
  engine_starts: {
    title: "Engine starts",
    text: "Engine starts to date: the baseline plus the starts logged per flight. Compressor parts count their cycles in starts.",
  },
  landings: {
    title: "Landings",
    text: "Landings to date: baseline plus landings logged per flight. Gas producer and power turbine parts count cycles as starts + a fraction of landings.",
    formula: "GP/PT cycles = starts + landing factor (usually 0.1) × landings",
  },
  hobbs_hours: { title: "Hobbs", text: "The Hobbs meter reading: its baseline plus every flight hour recorded. Shown for reference; no item runs on it." },
  as_of: { title: "Counters as of", text: "When the counters were last confirmed against the aircraft's meters and logbook (set when you save the counters)." },
};

export const ITEM_COLUMNS: Record<"part" | "action" | "current" | "life" | "remaining" | "meter" | "lastDone" | "interval" | "due", Help> = {
  part: { title: "Description / P/N / S/N", text: "What the part is, its part number and serial number, and any note (e.g. near the life limit)." },
  action: {
    title: "Service action",
    text: "Basis and action at the limit. HRS = flying hours, CYC = cycles, RIN = rotor/mast RIN, CAL = calendar, COND = on condition. RET = retire, OH = overhaul, INSP = inspect, REP = replace.",
    formula: "e.g. HRS/RET = retire at a flying-hours limit",
  },
  current: {
    title: "Current",
    text: "The part's own time now (TSN/TSO/I): its time when fitted plus what the counter has run since. RIN parts multiply the hours flown since fitting.",
    formula: "Current = value @ inst + (counter now − counter @ inst)\nRIN: value @ inst + (A/C T.T. − A/F @ inst) × multiplier",
  },
  life: { title: "Life", text: "The life limit in hours, cycles or RIN (retire or overhaul life), or the interval in days for calendar items." },
  remaining: {
    title: "Remaining",
    text: "What is left before the limit, in the item's own unit. Negative means overdue.",
    formula: "Remaining = Life − Current",
  },
  meter: { title: "Life left", text: "The share of the life or interval still remaining." },
  lastDone: { title: "Last done", text: "When the task was last done: the counter reading (hours) or the date, as recorded through compliance or a closed work order." },
  interval: { title: "Interval", text: "How often the task repeats: every N airframe or engine hours, every N days, or the expiry date." },
  due: {
    title: "Due",
    text: "The counter reading or date when the task falls due. Phase n falls due one interval after phase n−1 was done (or was due); Phase 1 one interval after the previous cycle ended.",
    formula: "Due = Last done + Interval",
  },
};

export const FIELD_HELP: Partial<Record<string, Help>> = {
  basis: { title: "Tracking basis", text: "Which counter the item runs on, and so which fields apply. Choose a part-life basis for parts and an inspection basis for recurring tasks." },
  life_limit: { title: "Life / interval", text: "Part-life items: the life limit (hours, cycles or RIN). Recurring items: the interval between inspections in hours." },
  counter_at_install: {
    title: "Counter at install",
    text: "The aircraft's counter reading when the part was fitted: A/F hours, engine hours, or engine starts (cycle parts may leave it blank = 0).",
  },
  value_at_install: { title: "Part time at install", text: "The part's own time when fitted (TSN, TSO or TSI, or its RIN), from its log card." },
  rin_multiplier: { title: "RIN multiplier", text: "RIN accrued per flight hour, e.g. 20 for a trunnion or mast pole.", formula: "RIN = hours × multiplier" },
  landing_factor: { title: "Landing factor", text: "Fraction of a cycle each landing adds for gas producer and power turbine parts (usually 0.1)." },
  last_done_value: { title: "Last done at", text: "The counter reading (hours) the task was last done at." },
  last_done_date: { title: "Last done / installed", text: "The date the task was last done, or the date the item was installed." },
  interval_days: { title: "Interval (days)", text: "How many days between inspections." },
  expiry_date: { title: "Expiry date", text: "The fixed date the item expires (e.g. a fire extinguisher bottle)." },
  phase_number: { title: "Phase number", text: "Its place in the phase sequence. Recording the last phase completes the cycle and restarts the sequence." },
  service_action: { title: "Service action", text: "Code shown in the Action column, e.g. HRS/RET, HRS/OH, CYC/RET, CAL/INSP." },
  system_group: { title: "Group / system", text: "The system the item belongs to (Main Rotor Head, Transmission, AD & ASB …). Rows are grouped by it." },
};

export const itemSearchText = (item: TrackerItem) =>
  [item.description, item.part_number, item.serial_number, item.system_group, item.notes, item.service_action].filter(Boolean).join(" ").toLowerCase();

/** Writes a CSV and downloads it. */
export const downloadCsv = (fileName: string, rows: (string | number | null | undefined)[][]) => {
  const text = rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadText(fileName, text, "text/csv");
};

export const downloadText = (fileName: string, text: string, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const safeFileName = (value: string) => value.replace(/[\\/:*?"<>|\s]+/g, "-");

export type DueHorizon =
  | "all"
  | "hrs_50"
  | "hrs_100"
  | "hrs_200"
  | "hrs_500"
  | "custom_hrs"
  | "cal_1m"
  | "cal_2m"
  | "cal_3m"
  | "cal_6m"
  | "cal_1y"
  | "custom_days"
  | "combo_50h_1m"
  | "combo_100h_2m"
  | "combo_200h_3m";

export const DUE_HORIZON_OPTIONS: Array<{
  value: DueHorizon;
  label: string;
  group?: string;
  hours?: number;
  days?: number;
}> = [
  { value: "all", label: "All due horizons" },
  // Hours
  { value: "hrs_50", label: "Due in ≤ 50 hours", group: "Operating Hours Remaining", hours: 50 },
  { value: "hrs_100", label: "Due in ≤ 100 hours", group: "Operating Hours Remaining", hours: 100 },
  { value: "hrs_200", label: "Due in ≤ 200 hours", group: "Operating Hours Remaining", hours: 200 },
  { value: "hrs_500", label: "Due in ≤ 500 hours", group: "Operating Hours Remaining", hours: 500 },
  { value: "custom_hrs", label: "Custom hours…", group: "Operating Hours Remaining" },
  // Calendar
  { value: "cal_1m", label: "Due in ≤ 1 month (30 days)", group: "Calendar Time Remaining", days: 30 },
  { value: "cal_2m", label: "Due in ≤ 2 months (60 days)", group: "Calendar Time Remaining", days: 60 },
  { value: "cal_3m", label: "Due in ≤ 3 months (90 days)", group: "Calendar Time Remaining", days: 90 },
  { value: "cal_6m", label: "Due in ≤ 6 months (180 days)", group: "Calendar Time Remaining", days: 180 },
  { value: "cal_1y", label: "Due in ≤ 1 year (365 days)", group: "Calendar Time Remaining", days: 365 },
  { value: "custom_days", label: "Custom days…", group: "Calendar Time Remaining" },
  // Combined
  { value: "combo_50h_1m", label: "Due in ≤ 50 hrs OR ≤ 1 month", group: "Combined (Hours or Calendar)", hours: 50, days: 30 },
  { value: "combo_100h_2m", label: "Due in ≤ 100 hrs OR ≤ 2 months", group: "Combined (Hours or Calendar)", hours: 100, days: 60 },
  { value: "combo_200h_3m", label: "Due in ≤ 200 hrs OR ≤ 3 months", group: "Combined (Hours or Calendar)", hours: 200, days: 90 },
];

export const getItemDaysRemaining = (item: TrackerItem, referenceDate?: string): number | null => {
  if (item.tracking.unit === "days" && item.tracking.remaining !== null) {
    return item.tracking.remaining;
  }
  const dateStr = item.tracking.due_date || (item.basis === "expiry" ? item.expiry_date : null);
  if (dateStr) {
    const baseDate = referenceDate ? new Date(referenceDate) : new Date();
    baseDate.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
    if (!Number.isNaN(targetDate.getTime()) && !Number.isNaN(baseDate.getTime())) {
      return Math.round((targetDate.getTime() - baseDate.getTime()) / 86400000);
    }
  }
  return null;
};

export const matchesDueHorizon = (
  item: TrackerItem,
  horizon: DueHorizon | string,
  customHours = 50,
  customDays = 30,
  referenceDate?: string
): boolean => {
  if (!horizon || horizon === "all") return true;

  const hoursRemaining =
    item.tracking.unit === "hours" && item.tracking.remaining !== null
      ? item.tracking.remaining
      : null;

  const daysRemaining = getItemDaysRemaining(item, referenceDate);

  switch (horizon) {
    case "hrs_50":
      return hoursRemaining !== null && hoursRemaining <= 50;
    case "hrs_100":
      return hoursRemaining !== null && hoursRemaining <= 100;
    case "hrs_200":
      return hoursRemaining !== null && hoursRemaining <= 200;
    case "hrs_500":
      return hoursRemaining !== null && hoursRemaining <= 500;
    case "custom_hrs":
      return hoursRemaining !== null && hoursRemaining <= customHours;

    case "cal_1m":
      return daysRemaining !== null && daysRemaining <= 30;
    case "cal_2m":
      return daysRemaining !== null && daysRemaining <= 60;
    case "cal_3m":
      return daysRemaining !== null && daysRemaining <= 90;
    case "cal_6m":
      return daysRemaining !== null && daysRemaining <= 180;
    case "cal_1y":
      return daysRemaining !== null && daysRemaining <= 365;
    case "custom_days":
      return daysRemaining !== null && daysRemaining <= customDays;

    case "combo_50h_1m":
      return (hoursRemaining !== null && hoursRemaining <= 50) || (daysRemaining !== null && daysRemaining <= 30);
    case "combo_100h_2m":
      return (hoursRemaining !== null && hoursRemaining <= 100) || (daysRemaining !== null && daysRemaining <= 60);
    case "combo_200h_3m":
      return (hoursRemaining !== null && hoursRemaining <= 200) || (daysRemaining !== null && daysRemaining <= 90);

    default:
      return true;
  }
};

