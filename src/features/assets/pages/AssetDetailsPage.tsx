import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { useGetUnitsQuery } from "@/shared/api/units";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateWorkOrderMutation,
  useGetComplianceRecordsQuery,
  useGetMaintenanceProgramsQuery,
  useGetWorkOrdersQuery,
  useUpdateWorkOrderTaskMutation,
} from "@/features/maintenance/api";
import {
  useDeleteAssetMutation,
  useGetAssetByIdQuery,
  useGetAtaChaptersQuery,
  useGetAssetTypesQuery,
  useGetAvionicCategoriesQuery,
  useGetComponentTypesQuery,
  useCreateComponentTypeMutation,
  useGetEngineCategoriesQuery,
  useGetEnginePositionsQuery,
  useUpdateAssetMutation,
  useCreateAtaChapterMutation,
  useGetFlightLogsQuery,
  useDeleteFlightLogMutation,
  type Avionics,
  type Component,
  type Engine,
  type MaintenanceDueItem,
} from "../api";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import AssetMaintenanceProgramsSearchable from "./AssetMaintenanceProgramsSearchable";
import { FlightLogModal } from "../components/FlightLogModal";
import { getEchoClient } from "@/shared/realtime/echo";
import {
  ImportCsvModal,
  type ImportCsvField,
} from "@/shared/components/ImportCsvModal";
import { BackButton } from "@/shared/ui/button/BackButton";


// Mirrors AddAssetPage.tsx's fallback list, used when the engine positions
// lookup hasn't loaded yet.
const FALLBACK_ENGINE_POSITIONS = [
  "Engine 1",
  "Engine 2",
  "Main Rotor",
  "Tail Rotor",
];

const TABS = [
  { id: "info", label: "Aircraft Information" },
  { id: "components", label: "Components" },
  { id: "engines", label: "Engines" },
  { id: "avionics", label: "Avionics" },
  { id: "discrepancies", label: "Discrepancies" },
  { id: "operations", label: "Operations" },
  { id: "maintenance", label: "Maintenance Tracking" },
  { id: "after_action_report", label: "After Action Report" },
] as const;

type AssetTabId = (typeof TABS)[number]["id"];

const COMPONENT_IMPORT_FIELDS: ImportCsvField[] = [
  { key: "component_type", label: "Component Type", required: true, example: "Main Rotor Blade" },
  { key: "ata_chapter", label: "ATA Chapter", required: true, example: "62" },
  { key: "part_number", label: "Part Number", required: true, example: "PN-10234" },
  { key: "serial_number", label: "Serial Number", required: true, example: "SN-98213" },
  { key: "installed_at", label: "Installed Date (YYYY-MM-DD)", required: true, example: "2026-01-15" },
  { key: "removed_at", label: "Removed Date (YYYY-MM-DD)", required: false, example: "" },
  { key: "time_since_new", label: "Time Since New (hours)", required: false, example: "120" },
  { key: "service_life_limit_hours", label: "Service Life Limit (hours)", required: false, example: "5000" },
  { key: "inspection_interval_unit", label: "Inspection Interval Unit (hours/months/cycle)", required: false, example: "hours" },
  { key: "inspection_interval", label: "Inspection Interval", required: false, example: "100" },
  { key: "maintenance_strategy", label: "Maintenance Strategy (hard-time/on-condition/condition)", required: false, example: "hard-time" },
];

const ENGINE_IMPORT_FIELDS: ImportCsvField[] = [
  { key: "position", label: "Position", required: true, example: "Engine 1" },
  { key: "category", label: "Category", required: false, example: "Turboshaft" },
  { key: "ata_chapter", label: "ATA Chapter", required: false, example: "72" },
  { key: "serial_number", label: "Serial Number", required: true, example: "SN-44210" },
  { key: "model", label: "Model", required: true, example: "T700-GE-701" },
  { key: "installation_date", label: "Installation Date (YYYY-MM-DD)", required: true, example: "2026-01-15" },
  { key: "time_since_new", label: "Time Since New (hours)", required: false, example: "300" },
  { key: "service_life_limit", label: "Service Life Limit (hours)", required: false, example: "8000" },
  { key: "inspection_interval_unit", label: "Inspection Interval Unit (hours/months/cycle)", required: false, example: "hours" },
  { key: "inspection_interval", label: "Inspection Interval", required: false, example: "150" },
  { key: "maintenance_strategy", label: "Maintenance Strategy (hard-time/on-condition/condition)", required: false, example: "hard-time" },
];

const AVIONICS_IMPORT_FIELDS: ImportCsvField[] = [
  { key: "avionic_category", label: "Avionic Category", required: true, example: "Radio" },
  { key: "ata_chapter", label: "ATA Chapter", required: false, example: "23" },
  { key: "serial_number", label: "Serial Number", required: true, example: "SN-77410" },
  { key: "model", label: "Model", required: true, example: "ARC-210" },
  { key: "manufacturer", label: "Manufacturer", required: false, example: "Rockwell Collins" },
  { key: "installed_at", label: "Installed Date (YYYY-MM-DD)", required: true, example: "2026-01-15" },
  { key: "time_since_new", label: "Time Since New (hours)", required: false, example: "80" },
  { key: "service_life_limit", label: "Service Life Limit (hours)", required: false, example: "6000" },
  { key: "inspection_interval_unit", label: "Inspection Interval Unit (hours/months/cycle)", required: false, example: "hours" },
  { key: "inspection_interval", label: "Inspection Interval", required: false, example: "100" },
  { key: "maintenance_strategy", label: "Maintenance Strategy (hard-time/on-condition/condition)", required: false, example: "hard-time" },
];

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  completed: "bg-emerald-400",
  ongoing: "bg-amber-400",
  active: "bg-amber-400",
  aborted: "bg-red-500",
};

const formatStatus = (status: string | null | undefined) => {
  if (!status) return "-";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return parsed.toLocaleString();
};

const formatHours = (value: number | string | null | undefined) => {
  const formatted = formatNumber(value);
  return formatted === "-" ? "-" : `${formatted} hrs`;
};

const formatCycles = (value: number | string | null | undefined) => {
  const formatted = formatNumber(value);
  return formatted === "-" ? "-" : `${formatted} cyc`;
};

const getInstallationStatus = (timeSinceNew: number | string | null | undefined): string => {
  const hours = toNumeric(timeSinceNew);
  if (!hours) return "Added New";
  return `Added with ${hours} hrs`;
};


const formatInspectionInterval = (
  value: number | string | null | undefined,
  unit: string | null | undefined,
) => {
  const formatted = formatNumber(value);
  if (formatted === "-") return "-";

  const suffixMap: Record<string, string> = {
    hours: "hrs",
    months: "months",
    cycle: "cyc",
  };

  const suffix = suffixMap[String(unit || "").toLowerCase()] || "";
  return suffix ? `${formatted} ${suffix}` : formatted;
};

const parseConfiguration = (configuration: unknown) => {
  // coerce to string[]
  const list = Array.isArray(configuration)
    ? configuration
    : typeof configuration === "string"
    ? [configuration]
    : [];
  const entries = list.reduce<Record<string, string>>(
    (acc, item) => {
      const [key, ...rest] = String(item).split(":");
      if (!key || rest.length === 0) return acc;
      acc[key] = rest.join(":");
      return acc;
    },
    {},
  );

  return {
    role: entries.role ? formatStatus(entries.role) : "-",
    seats: entries.seats ?? "-",
  };
};

const toNumeric = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toDateOnly = (value: string | null | undefined) => {
  if (!value) return "";
  return value.split("T")[0];
};

const toIntervalUnit = (
  value: string | null | undefined,
): "hours" | "months" | "cycle" => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "months") return "months";
  if (normalized === "cycle") return "cycle";
  return "hours";
};

const toMaintenanceStrategy = (
  value: string | null | undefined,
): "hard-time" | "on-condition" | "condition" => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "on-condition") return "on-condition";
  if (normalized === "condition") return "condition";
  return "hard-time";
};

const toNullableNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getCurrentServiceHours = (value: {
  current_time_since_new?: number;
  time_since_new?: number | string;
}) => {
  return value.current_time_since_new ?? toNumeric(value.time_since_new);
};

const getOperationFlightHours = (value: { operation_flight_hours?: number }) => {
  return toNumeric(value.operation_flight_hours);
};

const getHoursTrackingMetrics = (value: {
  current_time_since_new?: number;
  time_since_new?: number | string;
  service_life_limit?: number | string | null;
  service_life_limit_hours?: number | string | null;
  last_inspection?: number | string | null;
  inspection_interval?: number | string | null;
  inspection_interval_hours?: number | string | null;
  inspection_interval_unit?: string | null;
}) => {
  const currentServiceHours = getCurrentServiceHours(value);
  const serviceLifeLimit =
    toNumeric(value.service_life_limit_hours) ?? toNumeric(value.service_life_limit);
  const hoursRemainingToEndOfLife =
    currentServiceHours !== null && serviceLifeLimit !== null
      ? serviceLifeLimit - currentServiceHours
      : null;

  const intervalUnit = String(value.inspection_interval_unit || "hours").toLowerCase();
  const interval =
    toNumeric(value.inspection_interval_hours) ??
    (intervalUnit !== "cycle" ? toNumeric(value.inspection_interval) : null);
  const lastInspection = toNumeric(value.last_inspection);

  const nextMaintenanceHours =
    interval !== null && lastInspection !== null
      ? lastInspection + interval
      : null;
  const hoursToNextMaintenance =
    nextMaintenanceHours !== null && currentServiceHours !== null
      ? nextMaintenanceHours - currentServiceHours
      : null;

  return {
    currentServiceHours,
    serviceLifeLimit,
    hoursRemainingToEndOfLife,
    interval,
    intervalUnit,
    lastInspection,
    nextMaintenanceHours,
    hoursToNextMaintenance,
  };
};

const cloneEngine = (engine: Engine): Engine => ({
  ...engine,
  position_id: Number(engine.position_id) || 1,
  serial_number: engine.serial_number || "",
  model: engine.model || "",
  installation_date: toDateOnly(engine.installation_date),
  time_since_new: engine.time_since_new ?? "",
  service_life_limit: engine.service_life_limit ?? "",
  inspection_interval_unit: toIntervalUnit(engine.inspection_interval_unit),
  inspection_interval: engine.inspection_interval ?? "",
  inspection_interval_hours:
    engine.inspection_interval_hours ??
    (toIntervalUnit(engine.inspection_interval_unit) !== "cycle"
      ? (engine.inspection_interval ?? null)
      : null),
  inspection_interval_cycles:
    engine.inspection_interval_cycles ??
    (toIntervalUnit(engine.inspection_interval_unit) === "cycle"
      ? (engine.inspection_interval ?? null)
      : null),
  maintenance_strategy: toMaintenanceStrategy(engine.maintenance_strategy),
});

const cloneComponent = (component: Component): Component => ({
  ...component,
  component_type_id: Number(component.component_type_id) || undefined,
  ata_chapter_id: Number(component.ata_chapter_id) || undefined,
  part_number: component.part_number || "",
  serial_number: component.serial_number || "",
  time_since_new: component.time_since_new ?? "",
  service_life_limit_hours: component.service_life_limit_hours ?? "",
  inspection_interval_unit: toIntervalUnit(component.inspection_interval_unit),
  inspection_interval: component.inspection_interval ?? "",
  inspection_interval_hours:
    component.inspection_interval_hours ??
    (toIntervalUnit(component.inspection_interval_unit) !== "cycle"
      ? (component.inspection_interval ?? null)
      : null),
  inspection_interval_cycles:
    component.inspection_interval_cycles ??
    (toIntervalUnit(component.inspection_interval_unit) === "cycle"
      ? (component.inspection_interval ?? null)
      : null),
  maintenance_strategy: toMaintenanceStrategy(component.maintenance_strategy),
  installed_at: toDateOnly(component.installed_at),
  removed_at: toDateOnly(component.removed_at),
});

const cloneAvionic = (avionic: Avionics): Avionics => ({
  ...avionic,
  avionic_category_id: Number(avionic.avionic_category_id) || undefined,
  ata_chapter_id: Number(avionic.ata_chapter_id) || undefined,
  serial_number: avionic.serial_number || "",
  model: avionic.model || "",
  manufacturer: avionic.manufacturer || "",
  installed_at: toDateOnly(avionic.installed_at),
  time_since_new: avionic.time_since_new ?? "",
  service_life_limit: avionic.service_life_limit ?? "",
  inspection_interval_unit: toIntervalUnit(avionic.inspection_interval_unit),
  inspection_interval: avionic.inspection_interval ?? "",
  maintenance_strategy: toMaintenanceStrategy(avionic.maintenance_strategy),
  removed_at: toDateOnly(avionic.removed_at),
});

// ---------------------------------------------------------------------------
// Cosmetic-only "Track By" UI state.
//
// The Add-asset form (AddAssetPage.tsx) shows a Hours/Cycles/Calendar toggle
// plus split calendar + cycle-counter fields that are NEVER sent to the API -
// they only drive a local "next due" preview. To make the Edit forms look and
// behave the same, we mirror that same local-only state here, keyed by array
// index alongside componentsDraft / enginesDraft / avionicsDraft. None of the
// fields below are read by handleSaveComponents / handleSaveEngines /
// handleSaveAvionics - only the already-real fields on Component / Engine /
// Avionics are persisted.
// ---------------------------------------------------------------------------

type TrackByKey = "hours" | "cycles" | "both";
type CalendarIntervalType = "monthly" | "quarterly" | "yearly";

type TrackingExtras = {
  track_by: TrackByKey;
  track_by_calendar: boolean;
  last_inspection_reading: string;
  cycles_since_new: string;
  cycle_limit: string;
  cycles_last_inspection: string;
  calendar_manufacture_date: string;
  calendar_last_inspection_date: string;
  calendar_expiry_date: string;
  calendar_interval_type: CalendarIntervalType;
};

const defaultTrackingExtras = (): TrackingExtras => ({
  track_by: "hours",
  track_by_calendar: false,
  last_inspection_reading: "",
  cycles_since_new: "",
  cycle_limit: "",
  cycles_last_inspection: "",
  calendar_manufacture_date: "",
  calendar_last_inspection_date: "",
  calendar_expiry_date: "",
  calendar_interval_type: "monthly",
});

const guessTrackBy = (
  intervalHours: number | string | null | undefined,
  intervalCycles: number | string | null | undefined,
  unit: string | null | undefined,
): TrackByKey => {
  const hasHours =
    intervalHours !== null &&
    intervalHours !== undefined &&
    String(intervalHours).trim() !== "";
  const hasCycles =
    intervalCycles !== null &&
    intervalCycles !== undefined &&
    String(intervalCycles).trim() !== "";
  if (hasHours && hasCycles) return "both";
  if (hasCycles || unit === "cycle") return "cycles";
  return "hours";
};

const trackingExtrasFromComponent = (item: {
  inspection_interval_hours?: number | string | null;
  inspection_interval_cycles?: number | string | null;
  inspection_interval_unit?: string | null;
}): TrackingExtras => ({
  ...defaultTrackingExtras(),
  track_by: guessTrackBy(
    item.inspection_interval_hours,
    item.inspection_interval_cycles,
    item.inspection_interval_unit,
  ),
});

const trackingExtrasFromAvionic = (item: {
  inspection_interval_unit?: string | null;
}): TrackingExtras => ({
  ...defaultTrackingExtras(),
  track_by: toIntervalUnit(item.inspection_interval_unit) === "cycle" ? "cycles" : "hours",
});

// Mirrors AddAssetPage.tsx's toggleTrackBy - always keeps at least one basis selected.
const toggleTrackBy = (
  current: TrackByKey,
  target: "hours" | "cycles",
): TrackByKey => {
  const hasHours = current === "hours" || current === "both";
  const hasCycles = current === "cycles" || current === "both";

  const nextHours = target === "hours" ? !hasHours : hasHours;
  const nextCycles = target === "cycles" ? !hasCycles : hasCycles;

  if (nextHours && nextCycles) return "both";
  if (nextHours) return "hours";
  if (nextCycles) return "cycles";

  return target === "hours" ? "cycles" : "hours";
};

function extraAt<T>(list: T[], index: number, factory: () => T): T {
  return list[index] ?? factory();
}

function withExtraAt<T>(
  list: T[],
  index: number,
  patch: Partial<T>,
  factory: () => T,
): T[] {
  const next = list.slice();
  while (next.length <= index) next.push(factory());
  next[index] = { ...next[index], ...patch };
  return next;
}

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

const computeHoursRemainingLabel = (
  used: number | string | null | undefined,
  limit: number | string | null | undefined,
  unitLabel: string,
): string => {
  const limitNum = Number(limit);
  if (!limitNum || Number.isNaN(limitNum)) return `00 ${unitLabel}`;
  const usedNum = Number(used);
  const remaining = limitNum - (Number.isNaN(usedNum) ? 0 : usedNum);
  return `${Math.max(0, remaining)} ${unitLabel}`;
};

// Matches the flat "Airframe Component" tab's due-date formula in AddAssetPage.tsx:
// nextDueAt = lastInspection + interval; remaining = nextDueAt - current.
const computeNextDueComponentStyle = (
  lastInspection: number | string | null | undefined,
  interval: number | string | null | undefined,
  current: number | string | null | undefined,
  unitLabel: string,
): { label: string; value: string } => {
  const intervalNum = Number(interval);
  if (!intervalNum || Number.isNaN(intervalNum)) {
    return { label: "Next Inspection Due", value: `00 ${unitLabel}` };
  }
  const lastNum = Number(lastInspection);
  const nextDueAt = (Number.isNaN(lastNum) ? 0 : lastNum) + intervalNum;
  const currentNum = Number(current);
  const remaining = nextDueAt - (Number.isNaN(currentNum) ? 0 : currentNum);
  if (remaining < 0) {
    return {
      label: "Inspection Overdue By",
      value: `${Math.abs(remaining)} ${unitLabel}`,
    };
  }
  return { label: "Next Inspection Due", value: `${remaining} ${unitLabel}` };
};

// Matches the Engine / Engine Component / Avionics due-date formula in
// AddAssetPage.tsx: delta = lastInspection - interval.
const computeNextDueDeltaStyle = (
  lastInspection: number | string | null | undefined,
  interval: number | string | null | undefined,
  unitLabel: string,
): { label: string; value: string } => {
  const intervalNum = Number(interval);
  if (!intervalNum || Number.isNaN(intervalNum)) {
    return { label: "next inspection due", value: `00 ${unitLabel}` };
  }
  const lastNum = Number(lastInspection);
  const delta = (Number.isNaN(lastNum) ? 0 : lastNum) - intervalNum;
  if (delta > 0) {
    return { label: "inspection overdue by", value: `${delta} ${unitLabel}` };
  }
  return { label: "next inspection due", value: `${Math.abs(delta)} ${unitLabel}` };
};

type CalendarDueInfo = {
  nextLabel: string;
  statusLabel: string;
  statusValue: string;
  statusClassName: string;
};

const computeCalendarDue = (
  lastInspectionDate: string,
  intervalType: CalendarIntervalType,
): CalendarDueInfo | null => {
  if (!lastInspectionDate) return null;
  const lastDate = new Date(lastInspectionDate);
  if (Number.isNaN(lastDate.getTime())) return null;

  const nextDate = new Date(lastDate);
  if (intervalType === "monthly") {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (intervalType === "quarterly") {
    nextDate.setMonth(nextDate.getMonth() + 3);
  } else if (intervalType === "yearly") {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.round(
    (nextDate.getTime() - today.getTime()) / msPerDay,
  );
  const nextLabel = nextDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let statusLabel: string;
  let statusValue: string;
  if (daysRemaining > 0) {
    statusLabel = "Inspection Due In";
    statusValue = `${daysRemaining} Days`;
  } else if (daysRemaining === 0) {
    statusLabel = "Inspection Due";
    statusValue = "Today";
  } else {
    statusLabel = "Inspection Overdue By";
    statusValue = `${Math.abs(daysRemaining)} Days`;
  }

  const statusClassName =
    daysRemaining < 0
      ? "text-red-400"
      : daysRemaining === 0
        ? "text-amber-400"
        : "text-white";

  return { nextLabel, statusLabel, statusValue, statusClassName };
};

// Builds the exact same real-field payload shape handleSaveComponents has
// always sent. Shared with the Engines tab's nested "Engine Component"
// sub-form so newly added engine components are persisted through the same
// flat components payload (there is no engine_id linkage field on Component).
const buildComponentPayload = (component: Component) => {
  const intervalHours = toNullableNumber(component.inspection_interval_hours);
  const intervalCycles = toNullableNumber(component.inspection_interval_cycles);
  const fallbackInterval = toNullableNumber(component.inspection_interval);

  return {
    component_type_id: Number(component.component_type_id) || 0,
    ata_chapter_id: Number(component.ata_chapter_id) || 0,
    part_number: component.part_number || "",
    serial_number: component.serial_number || "",
    time_since_new: toNumber(component.time_since_new),
    service_life_limit_hours: toNumber(component.service_life_limit_hours),
    inspection_interval_unit:
      intervalHours !== null
        ? "hours"
        : intervalCycles !== null
          ? "cycle"
          : toIntervalUnit(component.inspection_interval_unit),
    inspection_interval:
      intervalHours !== null
        ? intervalHours
        : intervalCycles !== null
          ? intervalCycles
          : fallbackInterval,
    inspection_interval_hours: intervalHours,
    inspection_interval_cycles: intervalCycles,
    maintenance_strategy: toMaintenanceStrategy(component.maintenance_strategy),
    installed_at: toDateOnly(component.installed_at),
    removed_at: toDateOnly(component.removed_at) || null,
  };
};

const blankEngineComponentDraft = (
  componentTypeId: number | undefined,
  ataChapterId: number | undefined,
): Component => ({
  component_type_id: componentTypeId,
  ata_chapter_id: ataChapterId,
  part_number: "",
  serial_number: "",
  time_since_new: "",
  service_life_limit_hours: "",
  inspection_interval_unit: "hours",
  inspection_interval: "",
  inspection_interval_hours: null,
  inspection_interval_cycles: null,
  maintenance_strategy: "hard-time",
  installed_at: "",
  removed_at: "",
});

export const AssetDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authToken = useAppSelector((state) => state.auth.token);
  const { data: asset, isLoading, refetch: refetchAsset } = useGetAssetByIdQuery(id || "");
  const { data: units = [] } = useGetUnitsQuery();
  const { data: assetTypes = [] } = useGetAssetTypesQuery();
  const { data: enginePositions = [] } = useGetEnginePositionsQuery();
  const { data: engineCategories = [] } = useGetEngineCategoriesQuery();
  const { data: ataChapters = [] } = useGetAtaChaptersQuery();
  const { data: componentTypes = [] } = useGetComponentTypesQuery();
  const { data: avionicCategories = [] } = useGetAvionicCategoriesQuery();
  const [activeTab, setActiveTab] = useState<AssetTabId>("info");
  const [programIntervalFilter, setProgramIntervalFilter] = useState<number | null>(null);
  const [programApplicabilityFilter, setProgramApplicabilityFilter] = useState<string | null>(null);

  // Clear selection when filters change so stale IDs don't carry over
  const handleIntervalFilterChange = (val: number | null) => {
    setProgramIntervalFilter(val);
    setSelectedProgramIds(new Set());
  };
  const handleApplicabilityFilterChange = (val: string | null) => {
    setProgramApplicabilityFilter(val);
    setSelectedProgramIds(new Set());
  };

  const programFilterParams = {
    ...(programIntervalFilter != null ? { interval_hours: programIntervalFilter } : {}),
    ...(programApplicabilityFilter ? { applicability: programApplicabilityFilter } : {}),
  };
  const { data: maintenancePrograms = [], isFetching: isLoadingPrograms } =
    useGetMaintenanceProgramsQuery(
      Object.keys(programFilterParams).length > 0 ? programFilterParams : undefined,
    );
  const [createWorkOrder] = useCreateWorkOrderMutation();
  const [updateWorkOrderTask, { isLoading: isUpdatingTaskStatus }] =
    useUpdateWorkOrderTaskMutation();
  const { data: assetWorkOrders = [] } = useGetWorkOrdersQuery(
    asset?.id ? { asset_id: asset.id } : undefined,
    { skip: !asset?.id },
  );
  const { data: complianceRecords = [], refetch: refetchComplianceRecords } = useGetComplianceRecordsQuery(
    asset?.id ? { asset_id: asset.id } : undefined,
    { skip: activeTab !== "maintenance" || !asset?.id },
  );
  const { data: flightLogs = [] } = useGetFlightLogsQuery(
    asset?.id ? { asset_id: asset.id } : undefined,
    { skip: !asset?.id },
  );
  const [deleteFlightLog, { isLoading: isDeletingFlightLog }] = useDeleteFlightLogMutation();
  const [deleteAsset, { isLoading: isDeleting }] = useDeleteAssetMutation();
  const [updateAsset, { isLoading: isUpdating }] = useUpdateAssetMutation();
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<number>>(new Set());
  // Ad-hoc task modal and handlers removed
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  const [creatingDueWorkOrderKey, setCreatingDueWorkOrderKey] = useState<string | null>(null);
  const [showFlightLogModal, setShowFlightLogModal] = useState(false);
  const [flightLogInitialValues, setFlightLogInitialValues] = useState<{
    operation_id?: number | null;
    flight_date?: string;
    hours_flown?: number | string;
    remarks?: string;
  } | undefined>(undefined);
  // (removed duplicate ad-hoc modal state)
  const [isDownloadingAssetExport, setIsDownloadingAssetExport] = useState(false);
  const [isDownloadingMaintenanceHistoryExport, setIsDownloadingMaintenanceHistoryExport] =
    useState(false);
  const [isEditingComponents, setIsEditingComponents] = useState(false);
  const [isEditingEngines, setIsEditingEngines] = useState(false);
  const [isEditingAvionics, setIsEditingAvionics] = useState(false);
  const [componentsDraft, setComponentsDraft] = useState<Component[]>([]);
  const [enginesDraft, setEnginesDraft] = useState<Engine[]>([]);
  const [avionicsDraft, setAvionicsDraft] = useState<Avionics[]>([]);
  // Cosmetic-only "Track By" UI state (hours/cycles/calendar toggle + the
  // split calendar/cycle-counter fields) mirroring AddAssetPage.tsx's Add
  // form. Kept parallel to the drafts above, indexed by array position.
  const [componentExtras, setComponentExtras] = useState<TrackingExtras[]>([]);
  const [engineExtras, setEngineExtras] = useState<TrackingExtras[]>([]);
  const [avionicsExtras, setAvionicsExtras] = useState<TrackingExtras[]>([]);
  // Per-engine tabbed editing (mirrors AddAssetPage's activeEngineIndex) plus
  // a nested, per-engine "Engine Component" sub-form. There is no engine_id
  // linkage field on Component, so these nested drafts only exist locally
  // while editing and get merged into the flat components payload on save.
  const [activeEngineIndex, setActiveEngineIndex] = useState(0);
  const [engineComponentsDraft, setEngineComponentsDraft] = useState<Component[][]>([]);
  const [engineComponentExtras, setEngineComponentExtras] = useState<TrackingExtras[][]>([]);

  const isAtaApplicableTo = (
    chapter: {
      maintenance_category?: string | null;
      applicability?: string | null;
      description?: string | null;
      chapter_name?: string;
      name?: string;
    },
    target: "component" | "engine" | "avionics",
  ) => {
    const maintenanceCategory = String(chapter.maintenance_category || "")
      .toLowerCase()
      .trim();
    const applicability = String(chapter.applicability || "")
      .toLowerCase()
      .trim();

    const acceptedTargets: Record<typeof target, string[]> = {
      component: ["component", "components"],
      engine: ["engine", "engines"],
      avionics: ["avionics", "avionic"],
    };
    const allowedValues = acceptedTargets[target];

    if (maintenanceCategory || applicability) {
      return (
        allowedValues.includes(maintenanceCategory) ||
        allowedValues.includes(applicability)
      );
    }

    const searchable = [
      chapter.description,
      chapter.chapter_name,
      chapter.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return allowedValues.some((value) => searchable.includes(value));
  };

  const componentAtaChapters = ataChapters.filter((chapter) =>
    isAtaApplicableTo(chapter, "component"),
  );
  const engineAtaChapters = ataChapters.filter((chapter) =>
    isAtaApplicableTo(chapter, "engine"),
  );
  const avionicsAtaChapters = ataChapters.filter((chapter) =>
    isAtaApplicableTo(chapter, "avionics"),
  );

  useEffect(() => {
    if (!asset) return;
    const nextComponents = (asset.components || []).map(cloneComponent);
    const nextEngines = (asset.engines || []).map(cloneEngine);
    const nextAvionics = (asset.avionics || []).map(cloneAvionic);
    setComponentsDraft(nextComponents);
    setEnginesDraft(nextEngines);
    setAvionicsDraft(nextAvionics);
    setComponentExtras(nextComponents.map(trackingExtrasFromComponent));
    setEngineExtras(nextEngines.map(trackingExtrasFromComponent));
    setAvionicsExtras(nextAvionics.map(trackingExtrasFromAvionic));
    setEngineComponentsDraft(nextEngines.map(() => []));
    setEngineComponentExtras(nextEngines.map(() => []));
    setActiveEngineIndex(0);
  }, [asset]);

  useEffect(() => {
    if (!asset?.id || !authToken) {
      return;
    }

    const echo = getEchoClient(authToken);

    if (!echo) {
      return;
    }

    const channelName = `asset.${asset.id}`;
    const privateChannelName = `private-${channelName}`;
    const eventName = ".asset.usage-hours-updated";

    echo.private(channelName).listen(eventName, () => {
      void refetchAsset();
    });

    return () => {
      echo.leaveChannel(privateChannelName);
    };
  }, [asset?.id, authToken, refetchAsset]);

  const inputClass =
    "w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]";

  const cancelComponentsEdit = () => {
    const cloned = (asset?.components || []).map(cloneComponent);
    setComponentsDraft(cloned);
    setComponentExtras(cloned.map(trackingExtrasFromComponent));
    setIsEditingComponents(false);
  };

  const cancelEnginesEdit = () => {
    const cloned = (asset?.engines || []).map(cloneEngine);
    setEnginesDraft(cloned);
    setEngineExtras(cloned.map(trackingExtrasFromComponent));
    setEngineComponentsDraft(cloned.map(() => []));
    setEngineComponentExtras(cloned.map(() => []));
    setActiveEngineIndex(0);
    setIsEditingEngines(false);
  };

  const cancelAvionicsEdit = () => {
    const cloned = (asset?.avionics || []).map(cloneAvionic);
    setAvionicsDraft(cloned);
    setAvionicsExtras(cloned.map(trackingExtrasFromAvionic));
    setIsEditingAvionics(false);
  };

  const blankComponent = (): Component => ({
    component_type_id: componentTypes[0]?.id,
    ata_chapter_id: componentAtaChapters[0]?.id,
    part_number: "",
    serial_number: "",
    time_since_new: "",
    service_life_limit_hours: "",
    inspection_interval_unit: "hours",
    inspection_interval: "",
    inspection_interval_hours: null,
    inspection_interval_cycles: null,
    maintenance_strategy: "hard-time",
    installed_at: "",
    removed_at: "",
  });

  const blankEngine = (): Engine => ({
    position_id: enginePositions[0]?.id ?? 1,
    category_id: engineCategories[0]?.id,
    ata_chapter_id: engineAtaChapters[0]?.id,
    serial_number: "",
    model: "",
    installation_date: "",
    time_since_new: "",
    service_life_limit: "",
    inspection_interval_unit: "hours",
    inspection_interval: "",
    inspection_interval_hours: null,
    inspection_interval_cycles: null,
    maintenance_strategy: "hard-time",
  });

  const blankAvionic = (): Avionics => ({
    avionic_category_id: avionicCategories[0]?.id,
    ata_chapter_id: avionicsAtaChapters[0]?.id,
    serial_number: "",
    model: "",
    manufacturer: "",
    installed_at: "",
    time_since_new: "",
    service_life_limit: "",
    inspection_interval_unit: "hours",
    inspection_interval: "",
    maintenance_strategy: "hard-time",
    removed_at: "",
  });

  const startAddComponent = () => {
    setComponentsDraft((prev) => [...prev, blankComponent()]);
    setIsEditingComponents(true);
  };

  const startAddEngine = () => {
    setEnginesDraft((prev) => [...prev, blankEngine()]);
    setIsEditingEngines(true);
  };

  const startAddAvionic = () => {
    setAvionicsDraft((prev) => [...prev, blankAvionic()]);
    setIsEditingAvionics(true);
  };

  const [createComponentType] = useCreateComponentTypeMutation();
  const [createAtaChapter] = useCreateAtaChapterMutation();
  const componentTypeCacheRef = useRef<Map<string, number>>(new Map());
  const ataChapterCacheRef = useRef<Map<string, number>>(new Map());

  const [isImportOpen, setIsImportOpen] = useState(false);

  const matchAtaChapter = (chapters: typeof ataChapters, value?: string) => {
    if (!value) return undefined;
    const clean = value.trim();
    if (!clean) return undefined;
    const needle = clean.toLowerCase();
    const noPrefix = needle.replace(/^ata[\s-_]*/i, "").trim();

    const findInList = (list: typeof ataChapters) =>
      list.find((chapter: any) => {
        const cCode = (chapter.code || "").toString().trim().toLowerCase();
        const cCodeNoPrefix = cCode.replace(/^ata[\s-_]*/i, "").trim();
        const cNum = (chapter.chapter_number || "").toString().trim().toLowerCase();
        const cNumNoPrefix = cNum.replace(/^ata[\s-_]*/i, "").trim();
        const cName = (chapter.name || "").toString().trim().toLowerCase();
        const cChName = (chapter.chapter_name || "").toString().trim().toLowerCase();

        return (
          cCode === needle ||
          (noPrefix && cCodeNoPrefix === noPrefix) ||
          cNum === needle ||
          (noPrefix && cNumNoPrefix === noPrefix) ||
          cName === needle ||
          cChName === needle ||
          (needle.length > 2 && (cName.includes(needle) || needle.includes(cName)))
        );
      });

    let match = findInList(chapters);
    if (!match && ataChapters && ataChapters !== chapters) {
      match = findInList(ataChapters);
    }
    return match;
  };

  const INTERVAL_UNITS = ["hours", "months", "cycle"];
  const MAINTENANCE_STRATEGIES = ["hard-time", "on-condition", "condition"];

  const handleImportComponentRow = async (row: Record<string, string>) => {
    const rawTypeName = (row.component_type || "").trim();
    if (!rawTypeName) {
      throw new Error("Component type is required");
    }

    let componentTypeId: number | undefined = componentTypes.find(
      (t) => t.name.trim().toLowerCase() === rawTypeName.toLowerCase(),
    )?.id;

    if (!componentTypeId) {
      const cachedId = componentTypeCacheRef.current.get(rawTypeName.toLowerCase());
      if (cachedId) {
        componentTypeId = cachedId;
      } else {
        try {
          const created = await createComponentType({ name: rawTypeName }).unwrap();
          componentTypeCacheRef.current.set(rawTypeName.toLowerCase(), created.id);
          componentTypeId = created.id;
        } catch (err: any) {
          const refound = componentTypes.find(
            (t) => t.name.trim().toLowerCase() === rawTypeName.toLowerCase(),
          );
          if (refound) {
            componentTypeId = refound.id;
          } else {
            throw new Error(
              `Component type "${rawTypeName}" could not be created: ${err?.data?.message || err?.message || "Unknown error"}`,
            );
          }
        }
      }
    }

    let ataChapterId: number | undefined = matchAtaChapter(componentAtaChapters, row.ata_chapter)?.id;
    if (!ataChapterId) {
      const ataCode = (row.ata_chapter || "").trim();
      if (!ataCode) {
        if (componentAtaChapters.length > 0) {
          ataChapterId = componentAtaChapters[0].id;
        } else if (ataChapters.length > 0) {
          ataChapterId = ataChapters[0].id;
        } else {
          throw new Error("ATA chapter is required");
        }
      } else {
        const cachedAtaId = ataChapterCacheRef.current.get(ataCode.toLowerCase());
        if (cachedAtaId) {
          ataChapterId = cachedAtaId;
        } else {
          try {
            const formattedCode = /^ata\b/i.test(ataCode) ? ataCode : `ATA ${ataCode}`;
            const createdAta = await createAtaChapter({
              code: formattedCode,
              name: ataCode,
              maintenance_category: "components",
            }).unwrap();
            ataChapterCacheRef.current.set(ataCode.toLowerCase(), createdAta.id);
            ataChapterId = createdAta.id;
          } catch {
            if (componentAtaChapters.length > 0) {
              ataChapterId = componentAtaChapters[0].id;
            } else if (ataChapters.length > 0) {
              ataChapterId = ataChapters[0].id;
            } else {
              throw new Error(`ATA chapter "${row.ata_chapter}" not found`);
            }
          }
        }
      }
    }

    const intervalUnit = row.inspection_interval_unit?.trim().toLowerCase() || "hours";
    if (!INTERVAL_UNITS.includes(intervalUnit)) {
      throw new Error(
        `Inspection Interval Unit must be one of: ${INTERVAL_UNITS.join(", ")}`,
      );
    }

    const strategy = row.maintenance_strategy?.trim().toLowerCase() || "hard-time";
    if (!MAINTENANCE_STRATEGIES.includes(strategy)) {
      throw new Error(
        `Maintenance Strategy must be one of: ${MAINTENANCE_STRATEGIES.join(", ")}`,
      );
    }

    const newComponent: Component = {
      component_type_id: componentTypeId,
      ata_chapter_id: ataChapterId,
      part_number: row.part_number,
      serial_number: row.serial_number,
      time_since_new: row.time_since_new || "",
      service_life_limit_hours: row.service_life_limit_hours || "",
      inspection_interval_unit: intervalUnit as Component["inspection_interval_unit"],
      inspection_interval: row.inspection_interval || "",
      inspection_interval_hours: null,
      inspection_interval_cycles: null,
      maintenance_strategy: strategy as Component["maintenance_strategy"],
      installed_at: row.installed_at,
      removed_at: row.removed_at || "",
    };

    setComponentsDraft((prev) => [...prev, newComponent]);
    setComponentExtras((prev) => [...prev, defaultTrackingExtras()]);
    setIsEditingComponents(true);
  };

  const handleImportEngineRow = async (row: Record<string, string>) => {
    const positionMatch = enginePositions.find(
      (p) => p.name.trim().toLowerCase() === row.position.trim().toLowerCase(),
    );
    if (!positionMatch) {
      throw new Error(`Position "${row.position}" not found`);
    }

    const categoryMatch = row.category
      ? engineCategories.find(
          (c) => c.name.trim().toLowerCase() === row.category.trim().toLowerCase(),
        )
      : undefined;
    if (row.category && !categoryMatch) {
      throw new Error(`Category "${row.category}" not found`);
    }

    const ataMatch = row.ata_chapter
      ? matchAtaChapter(engineAtaChapters, row.ata_chapter)
      : undefined;
    if (row.ata_chapter && !ataMatch) {
      throw new Error(`ATA chapter "${row.ata_chapter}" not found`);
    }

    const intervalUnit = row.inspection_interval_unit?.trim().toLowerCase() || "hours";
    if (!INTERVAL_UNITS.includes(intervalUnit)) {
      throw new Error(
        `Inspection Interval Unit must be one of: ${INTERVAL_UNITS.join(", ")}`,
      );
    }

    const strategy = row.maintenance_strategy?.trim().toLowerCase() || "hard-time";
    if (!MAINTENANCE_STRATEGIES.includes(strategy)) {
      throw new Error(
        `Maintenance Strategy must be one of: ${MAINTENANCE_STRATEGIES.join(", ")}`,
      );
    }

    const newEngine: Engine = {
      position_id: positionMatch.id,
      category_id: categoryMatch?.id,
      ata_chapter_id: ataMatch?.id,
      serial_number: row.serial_number,
      model: row.model,
      installation_date: row.installation_date,
      time_since_new: row.time_since_new || "",
      service_life_limit: row.service_life_limit || "",
      inspection_interval_unit: intervalUnit as Engine["inspection_interval_unit"],
      inspection_interval: row.inspection_interval || "",
      inspection_interval_hours: null,
      inspection_interval_cycles: null,
      maintenance_strategy: strategy as Engine["maintenance_strategy"],
    };

    setEnginesDraft((prev) => [...prev, newEngine]);
    setEngineExtras((prev) => [...prev, defaultTrackingExtras()]);
    setEngineComponentsDraft((prev) => [...prev, []]);
    setEngineComponentExtras((prev) => [...prev, []]);
    setIsEditingEngines(true);
  };

  const handleImportAvionicRow = async (row: Record<string, string>) => {
    const categoryMatch = avionicCategories.find(
      (c) =>
        c.name.trim().toLowerCase() === row.avionic_category.trim().toLowerCase(),
    );
    if (!categoryMatch) {
      throw new Error(`Avionic category "${row.avionic_category}" not found`);
    }

    const ataMatch = row.ata_chapter
      ? matchAtaChapter(avionicsAtaChapters, row.ata_chapter)
      : undefined;
    if (row.ata_chapter && !ataMatch) {
      throw new Error(`ATA chapter "${row.ata_chapter}" not found`);
    }

    const intervalUnit = row.inspection_interval_unit?.trim().toLowerCase() || "hours";
    if (!INTERVAL_UNITS.includes(intervalUnit)) {
      throw new Error(
        `Inspection Interval Unit must be one of: ${INTERVAL_UNITS.join(", ")}`,
      );
    }

    const strategy = row.maintenance_strategy?.trim().toLowerCase() || "hard-time";
    if (!MAINTENANCE_STRATEGIES.includes(strategy)) {
      throw new Error(
        `Maintenance Strategy must be one of: ${MAINTENANCE_STRATEGIES.join(", ")}`,
      );
    }

    const newAvionic: Avionics = {
      avionic_category_id: categoryMatch.id,
      ata_chapter_id: ataMatch?.id,
      serial_number: row.serial_number,
      model: row.model,
      manufacturer: row.manufacturer || "",
      installed_at: row.installed_at,
      time_since_new: row.time_since_new || "",
      service_life_limit: row.service_life_limit || "",
      inspection_interval_unit: intervalUnit as Avionics["inspection_interval_unit"],
      inspection_interval: row.inspection_interval || "",
      maintenance_strategy: strategy as Avionics["maintenance_strategy"],
      removed_at: "",
    };

    setAvionicsDraft((prev) => [...prev, newAvionic]);
    setAvionicsExtras((prev) => [...prev, defaultTrackingExtras()]);
    setIsEditingAvionics(true);
  };

  const handleSaveComponents = async () => {
    if (!asset?.id) return;

    const payload = componentsDraft
      .filter(
        (component) =>
          component.component_type_id ||
          component.part_number ||
          component.serial_number,
      )
      .map(buildComponentPayload)
      .filter((component) => component.component_type_id > 0);

    try {
      await updateAsset({ id: asset.id, data: { components: payload } }).unwrap();
      setIsEditingComponents(false);
      dispatch(showToast({ message: "Components updated", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update components", type: "error" }));
    }
  };

  const handleSaveEngines = async () => {
    if (!asset?.id) return;

    const defaultPositionId = enginePositions[0]?.id ?? 1;
    const defaultCategoryId = engineCategories[0]?.id ?? 1;
    const defaultAtaChapterId = ataChapters[0]?.id ?? 1;

    const payload = enginesDraft
      .filter((engine) => engine.serial_number || engine.model)
      .map((engine) => {
        const intervalHours = toNullableNumber(engine.inspection_interval_hours);
        const intervalCycles = toNullableNumber(engine.inspection_interval_cycles);
        const fallbackInterval = toNullableNumber(engine.inspection_interval);

        return {
          position_id: Number(engine.position_id) || defaultPositionId,
          category_id: Number(engine.category_id) || defaultCategoryId,
          ata_chapter_id: Number(engine.ata_chapter_id) || defaultAtaChapterId,
          serial_number: engine.serial_number || "",
          model: engine.model || "",
          installation_date: toDateOnly(engine.installation_date),
          time_since_new: toNumber(engine.time_since_new),
          service_life_limit: toNumber(engine.service_life_limit),
          inspection_interval_unit:
            intervalHours !== null
              ? "hours"
              : intervalCycles !== null
                ? "cycle"
                : toIntervalUnit(engine.inspection_interval_unit),
          inspection_interval:
            intervalHours !== null
              ? intervalHours
              : intervalCycles !== null
                ? intervalCycles
                : fallbackInterval,
          inspection_interval_hours: intervalHours,
          inspection_interval_cycles: intervalCycles,
          maintenance_strategy: toMaintenanceStrategy(engine.maintenance_strategy),
        };
      });

    // The nested "Engine Component" sub-form (per engine tab) has no
    // engine_id linkage field on Component, so - mirroring how
    // AddAssetPage.tsx merges engineComponentsByEngine into one flat
    // `components` list at submit time - any items added there get merged
    // into the same flat components payload handleSaveComponents uses.
    // When nothing was added there, this is a no-op and engines save exactly
    // as before.
    const nestedComponents = engineComponentsDraft.flat();
    const mergedComponentsPayload =
      nestedComponents.length > 0
        ? [...componentsDraft, ...nestedComponents]
            .filter(
              (component) =>
                component.component_type_id ||
                component.part_number ||
                component.serial_number,
            )
            .map(buildComponentPayload)
            .filter((component) => component.component_type_id > 0)
        : null;

    try {
      await updateAsset({
        id: asset.id,
        data: {
          engines: payload,
          ...(mergedComponentsPayload
            ? { components: mergedComponentsPayload }
            : {}),
        },
      }).unwrap();
      setIsEditingEngines(false);
      setEngineComponentsDraft(enginesDraft.map(() => []));
      setEngineComponentExtras(enginesDraft.map(() => []));
      dispatch(showToast({ message: "Engines updated", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update engines", type: "error" }));
    }
  };

  const handleSaveAvionics = async () => {
    if (!asset?.id) return;

    const defaultAtaChapterId = ataChapters[0]?.id ?? 1;

    const payload = avionicsDraft
      .filter((avionic) => avionic.avionic_category_id || avionic.serial_number)
      .map((avionic) => ({
        avionic_category_id: Number(avionic.avionic_category_id) || 0,
        ata_chapter_id: Number(avionic.ata_chapter_id) || defaultAtaChapterId,
        serial_number: avionic.serial_number || "",
        model: avionic.model || "",
        manufacturer: avionic.manufacturer || null,
        time_since_new: toNumber(avionic.time_since_new),
        service_life_limit: toNumber(avionic.service_life_limit),
        inspection_interval_unit: toIntervalUnit(avionic.inspection_interval_unit),
        inspection_interval: toNullableNumber(avionic.inspection_interval),
        maintenance_strategy: toMaintenanceStrategy(avionic.maintenance_strategy),
        installed_at: toDateOnly(avionic.installed_at),
        removed_at: toDateOnly(avionic.removed_at) || null,
      }))
      .filter((avionic) => avionic.avionic_category_id > 0);

    try {
      await updateAsset({ id: asset.id, data: { avionics: payload } }).unwrap();
      setIsEditingAvionics(false);
      dispatch(showToast({ message: "Avionics updated", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update avionics", type: "error" }));
    }
  };

  const handleDeleteAsset = async () => {
    if (!asset?.id || isDeleting) return;

    const confirmed = window.confirm(
      `Delete ${asset.name}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteAsset(asset.id).unwrap();
      dispatch(
        showToast({
          message: "Asset deleted successfully",
          type: "success",
        }),
      );
      navigate("/dashboard/assets");
    } catch {
      dispatch(
        showToast({
          message: "Failed to delete asset",
          type: "error",
        }),
      );
    }
  };

  const handleExportAssetDetails = async () => {
    if (!asset || isDownloadingAssetExport) return;

    setIsDownloadingAssetExport(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const summaryRows = [
        {
          "Asset ID": asset.id,
          Name: asset.name || "-",
          Type: assetTypeName,
          Unit: unitName,
          Model: asset.model || "-",
          Manufacturer: asset.manufacturer || "-",
          "Serial Number": asset.serial_number || "-",
          "Tail Number": asset.tail_number || "-",
          "Serviceability Status": formatStatus(asset.serviceability_status),
          "Operation Status": formatStatus(asset.operation_status),
          "Total Airframe Hours": formatHours(asset.total_airframe_hours),
          "Total Cycles": formatCycles(asset.total_cycles),
          "Last Inspection Date": formatDate(asset.last_inspection_date),
          "Next Annual Inspection": formatDate(asset.next_annual_inspection_date),
        },
      ];

      const componentsRows = (asset.components || []).map((component, index) => {
        const hourMetrics = getHoursTrackingMetrics(component);

        return {
        "S/N": index + 1,
        "Component Type": componentTypeMap.get(component.component_type_id || 0) || "-",
        "ATA Chapter": ataChapterMap.get(component.ata_chapter_id || 0) || "-",
        "Part Number": component.part_number || "-",
        "Serial Number": component.serial_number || "-",
        "Baseline Time Since New": formatHours(component.time_since_new),
        "Operation Flight Hours": formatHours(component.operation_flight_hours),
        "Current Service Hours": formatHours(hourMetrics.currentServiceHours),
        "Total Hours Used": formatHours(hourMetrics.currentServiceHours),
        "Service Life Limit": formatHours(component.service_life_limit_hours),
        "Hours Remaining To End Of Life": formatHours(hourMetrics.hoursRemainingToEndOfLife),
        "Inspection Interval": formatInspectionInterval(
          component.inspection_interval,
          component.inspection_interval_unit,
        ),
        "Next Maintenance Hours": formatHours(hourMetrics.nextMaintenanceHours),
        "Hours / Time Till Next Maintenance": formatHours(hourMetrics.hoursToNextMaintenance),
        Strategy: formatStatus(component.maintenance_strategy),
        "Current Asset Cycles": formatCycles(asset.operations_count ?? asset.operations.length),
        "Installation Status": getInstallationStatus(component.time_since_new),
      };
      });

      const enginesRows = (asset.engines || []).map((engine, index) => {
        const hourMetrics = getHoursTrackingMetrics(engine);

        return {
        "S/N": index + 1,
        Position: enginePositionMap.get(engine.position_id || 0) || "-",
        Category: engineCategoryMap.get(engine.category_id || 0) || "-",
        "ATA Chapter": ataChapterMap.get(engine.ata_chapter_id || 0) || "-",
        Model: engine.model || "-",
        "Serial Number": engine.serial_number || "-",
        "Baseline Time Since New": formatHours(engine.time_since_new),
        "Operation Flight Hours": formatHours(engine.operation_flight_hours),
        "Current Service Hours": formatHours(hourMetrics.currentServiceHours),
        "Total Hours Used": formatHours(hourMetrics.currentServiceHours),
        "Service Life Limit": formatHours(engine.service_life_limit),
        "Hours Remaining To End Of Life": formatHours(hourMetrics.hoursRemainingToEndOfLife),
        "Inspection Interval": formatInspectionInterval(
          engine.inspection_interval,
          engine.inspection_interval_unit,
        ),
        "Next Maintenance Hours": formatHours(hourMetrics.nextMaintenanceHours),
        "Hours / Time Till Next Maintenance": formatHours(hourMetrics.hoursToNextMaintenance),
        Strategy: formatStatus(engine.maintenance_strategy),
        "Current Asset Cycles": formatCycles(asset.operations_count ?? asset.operations.length),
        "Installation Status": getInstallationStatus(engine.time_since_new),
      };
      });

      const avionicsRows = (asset.avionics || []).map((avionic, index) => {
        const hourMetrics = getHoursTrackingMetrics(avionic);

        return {
        "S/N": index + 1,
        Category: avionicCategoryMap.get(avionic.avionic_category_id || 0) || "-",
        "ATA Chapter": ataChapterMap.get(avionic.ata_chapter_id || 0) || "-",
        Model: avionic.model || "-",
        Manufacturer: avionic.manufacturer || "-",
        "Serial Number": avionic.serial_number || "-",
        "Baseline Time Since New": formatHours(avionic.time_since_new),
        "Operation Flight Hours": formatHours(avionic.operation_flight_hours),
        "Current Service Hours": formatHours(hourMetrics.currentServiceHours),
        "Total Hours Used": formatHours(hourMetrics.currentServiceHours),
        "Service Life Limit": formatHours(avionic.service_life_limit),
        "Hours Remaining To End Of Life": formatHours(hourMetrics.hoursRemainingToEndOfLife),
        "Inspection Interval": formatInspectionInterval(
          avionic.inspection_interval,
          avionic.inspection_interval_unit,
        ),
        "Next Maintenance Hours": formatHours(hourMetrics.nextMaintenanceHours),
        "Hours / Time Till Next Maintenance": formatHours(hourMetrics.hoursToNextMaintenance),
        Strategy: formatStatus(avionic.maintenance_strategy),
        "Current Asset Cycles": formatCycles(asset.operations_count ?? asset.operations.length),
        "Installation Status": getInstallationStatus(avionic.time_since_new),
      };
      });

      const dueTrackingSheetRows = dueTrackingRows.map((row) => ({
        Category: row.part_type,
        Item: row.part_label,
        "Current Used Hrs": formatNumber(row.current_hours),
        "Current Used Cycles": formatNumber(row.current_cycles),
        "Hours Left": row.hours_remaining !== null ? formatNumber(row.hours_remaining) : "-",
        "Cycles Left": row.cycles_remaining !== null ? formatNumber(row.cycles_remaining) : "-",
        Status: row.status === "overdue" ? "Overdue" : "Due Soon",
      }));

      const componentById = new Map(
        asset.components
          .filter((component): component is Component & { id: number } =>
            typeof component.id === "number",
          )
          .map((component) => [component.id, component]),
      );
      const engineById = new Map(
        asset.engines
          .filter((engine): engine is Engine & { id: number } => typeof engine.id === "number")
          .map((engine) => [engine.id, engine]),
      );
      const avionicById = new Map(
        asset.avionics
          .filter((avionic): avionic is Avionics & { id: number } =>
            typeof avionic.id === "number",
          )
          .map((avionic) => [avionic.id, avionic]),
      );
      const taskById = new Map(
        assetWorkOrders.flatMap((order) =>
          (order.tasks || []).map((task) => [
            task.id,
            {
              orderId: order.id,
              orderTitle: order.title,
              task,
            },
          ]),
        ),
      );

      const maintenanceRows = (assetComplianceRecords || []).map((record) => {
        const taskInfo =
          record.work_order_task_id != null ? taskById.get(record.work_order_task_id) : undefined;
        const task = taskInfo?.task;

        const componentId = record.component_id ?? task?.component_id ?? null;
        const engineId = record.engine_id ?? task?.engine_id ?? null;
        const avionicId = record.avionics_id ?? task?.avionics_id ?? null;

        let itemCategory = "-";
        let itemLabel = "-";
        let itemSerial = "-";
        let itemHoursMetrics: ReturnType<typeof getHoursTrackingMetrics> | null = null;

        if (componentId && componentById.has(componentId)) {
          const component = componentById.get(componentId)!;
          itemCategory = "Component";
          itemLabel =
            componentTypeMap.get(component.component_type_id || 0) ||
            component.part_number ||
            component.serial_number ||
            `Component ${componentId}`;
          itemSerial = component.serial_number || "-";
          itemHoursMetrics = getHoursTrackingMetrics(component);
        } else if (engineId && engineById.has(engineId)) {
          const engine = engineById.get(engineId)!;
          itemCategory = "Engine";
          itemLabel =
            engineCategoryMap.get(engine.category_id || 0) ||
            engine.model ||
            engine.serial_number ||
            `Engine ${engineId}`;
          itemSerial = engine.serial_number || "-";
          itemHoursMetrics = getHoursTrackingMetrics(engine);
        } else if (avionicId && avionicById.has(avionicId)) {
          const avionic = avionicById.get(avionicId)!;
          itemCategory = "Avionics";
          itemLabel =
            avionicCategoryMap.get(avionic.avionic_category_id || 0) ||
            avionic.model ||
            avionic.serial_number ||
            `Avionics ${avionicId}`;
          itemSerial = avionic.serial_number || "-";
          itemHoursMetrics = getHoursTrackingMetrics(avionic);
        }

        const nextDueHours = toNumeric(record.next_due_hours);
        const hoursAtCompletion = toNumeric(record.hours_at_completion);
        const intervalHours =
          toNumeric(task?.program?.interval_hours) ??
          (itemHoursMetrics?.intervalUnit === "hours" ? itemHoursMetrics.interval : null);
        const maintenanceDoneAtHours =
          hoursAtCompletion ??
          (nextDueHours !== null && intervalHours !== null ? nextDueHours - intervalHours : null);
        const hoursToNextMaintenance =
          nextDueHours !== null && itemHoursMetrics?.currentServiceHours !== null
            ? nextDueHours - (itemHoursMetrics?.currentServiceHours ?? 0)
            : itemHoursMetrics?.hoursToNextMaintenance ?? null;

        const completionDate = record.completion_date ? new Date(record.completion_date) : null;
        const cyclesAtMaintenance = completionDate
          ? asset.operations.filter(
              (op) =>
                op.status === "completed" &&
                new Date(op.end_date_time || op.created_at) <= completionDate,
            ).length
          : null;

        return {
          "Work Order": taskInfo?.orderId ?? "-",
          "Work Order Title": taskInfo?.orderTitle || "-",
          "Task ID": record.work_order_task_id || "-",
          "Maintenance Done":
            task?.program?.name ||
            task?.description ||
            formatStatus(task?.task_type) ||
            "-",
          "Date/Time Done": formatDateTime(record.completion_date || task?.updated_at),
          "Performed On Type": itemCategory,
          "Performed On Item": itemLabel,
          "Item Serial": itemSerial,
          "Flight Hours When Maintenance Was Done": formatHours(maintenanceDoneAtHours),
          "Cycles When Maintenance Was Done": formatCycles(cyclesAtMaintenance),
          "Current Total Hours Used": formatHours(itemHoursMetrics?.currentServiceHours),
          "Next Maintenance Hours": formatHours(nextDueHours ?? itemHoursMetrics?.nextMaintenanceHours),
          "Hours / Time Till Next Maintenance": formatHours(hoursToNextMaintenance),
          "Hours Remaining Till End Of Life": formatHours(itemHoursMetrics?.hoursRemainingToEndOfLife),
          "Next Due Date": formatDate(record.next_due_date),
          Remarks: record.remarks || "-",
        };
      });

      const workOrderRows = assetWorkOrders.flatMap((order) =>
        (order.tasks || []).map((task) => ({
          "Work Order ID": order.id,
          Title: order.title || "-",
          "Task ID": task.id,
          "Task Type": task.task_type || "-",
          Description: task.description || "-",
          Status: formatStatus(task.status),
        })),
      );

      const defectsRows = (defects || []).map((defect) => ({
        ID: defect.id ?? "-",
        Title: defect.title || "-",
        Severity: formatStatus(defect.severity),
        Status: formatStatus(defect.status),
        "Reported At": formatDateTime(defect.reported_at),
        Description: defect.description || "-",
      }));

      const addSheet = (name: string, rows: Array<Record<string, string | number>>) => {
        const normalizedRows = rows.length > 0 ? rows : [{ Info: "No records" }];
        const sheet = XLSX.utils.json_to_sheet(normalizedRows);
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      addSheet("Summary", summaryRows);
      addSheet("Components", componentsRows);
      addSheet("Engines", enginesRows);
      addSheet("Avionics", avionicsRows);
      addSheet("Due Tracking", dueTrackingSheetRows);
      addSheet("Maintenance", maintenanceRows);
      addSheet("Work Orders", workOrderRows);
      addSheet("Defects", defectsRows);

      const safeName = String(asset.name || "asset")
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "asset";
      const fileName = `${safeName}-${asset.id}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      dispatch(showToast({ message: "Excel downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download Excel", type: "error" }));
    } finally {
      setIsDownloadingAssetExport(false);
    }
  };

  const handleDownloadMaintenanceHistory = async () => {
    if (!asset || isDownloadingMaintenanceHistoryExport) return;

    setIsDownloadingMaintenanceHistoryExport(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const componentById = new Map(
        asset.components
          .filter((component): component is Component & { id: number } =>
            typeof component.id === "number",
          )
          .map((component) => [component.id, component]),
      );
      const engineById = new Map(
        asset.engines
          .filter((engine): engine is Engine & { id: number } => typeof engine.id === "number")
          .map((engine) => [engine.id, engine]),
      );
      const avionicById = new Map(
        asset.avionics
          .filter((avionic): avionic is Avionics & { id: number } =>
            typeof avionic.id === "number",
          )
          .map((avionic) => [avionic.id, avionic]),
      );
      const taskById = new Map(
        assetWorkOrders.flatMap((order) =>
          (order.tasks || []).map((task) => [
            task.id,
            {
              orderId: order.id,
              orderTitle: order.title,
              task,
            },
          ]),
        ),
      );

      const maintenanceHistoryRows = (assetComplianceRecords || []).map((record) => {
        const taskInfo =
          record.work_order_task_id != null ? taskById.get(record.work_order_task_id) : undefined;
        const task = taskInfo?.task;

        const componentId = record.component_id ?? task?.component_id ?? null;
        const engineId = record.engine_id ?? task?.engine_id ?? null;
        const avionicId = record.avionics_id ?? task?.avionics_id ?? null;

        let itemCategory = "-";
        let itemName = "-";
        let itemSerial = "-";
        let itemHoursMetrics: ReturnType<typeof getHoursTrackingMetrics> | null = null;

        if (componentId && componentById.has(componentId)) {
          const component = componentById.get(componentId)!;
          itemCategory = "Component";
          itemName =
            componentTypeMap.get(component.component_type_id || 0) ||
            component.part_number ||
            component.serial_number ||
            `Component ${componentId}`;
          itemSerial = component.serial_number || "-";
          itemHoursMetrics = getHoursTrackingMetrics(component);
        } else if (engineId && engineById.has(engineId)) {
          const engine = engineById.get(engineId)!;
          itemCategory = "Engine";
          itemName =
            engineCategoryMap.get(engine.category_id || 0) ||
            engine.model ||
            engine.serial_number ||
            `Engine ${engineId}`;
          itemSerial = engine.serial_number || "-";
          itemHoursMetrics = getHoursTrackingMetrics(engine);
        } else if (avionicId && avionicById.has(avionicId)) {
          const avionic = avionicById.get(avionicId)!;
          itemCategory = "Avionics";
          itemName =
            avionicCategoryMap.get(avionic.avionic_category_id || 0) ||
            avionic.model ||
            avionic.serial_number ||
            `Avionics ${avionicId}`;
          itemSerial = avionic.serial_number || "-";
          itemHoursMetrics = getHoursTrackingMetrics(avionic);
        }

        const nextDueHours = toNumeric(record.next_due_hours);
        const hoursAtCompletion = toNumeric(record.hours_at_completion);
        const intervalHours =
          toNumeric(task?.program?.interval_hours) ??
          (itemHoursMetrics?.intervalUnit === "hours" ? itemHoursMetrics.interval : null);
        const maintenanceDoneAtHours =
          hoursAtCompletion ??
          (nextDueHours !== null && intervalHours !== null ? nextDueHours - intervalHours : null);
        const hoursToNextMaintenance =
          nextDueHours !== null && itemHoursMetrics?.currentServiceHours !== null
            ? nextDueHours - (itemHoursMetrics?.currentServiceHours ?? 0)
            : itemHoursMetrics?.hoursToNextMaintenance ?? null;

        const completionDate = record.completion_date ? new Date(record.completion_date) : null;
        const cyclesAtMaintenance = completionDate
          ? asset.operations.filter(
              (op) =>
                op.status === "completed" &&
                new Date(op.end_date_time || op.created_at) <= completionDate,
            ).length
          : null;

        return {
          "Work Order": taskInfo?.orderId ?? "-",
          "Task ID": record.work_order_task_id || "-",
          "Maintenance Done":
            task?.program?.name ||
            task?.description ||
            formatStatus(task?.task_type) ||
            "-",
          "Date/Time Done": formatDateTime(record.completion_date || task?.updated_at),
          "Performed On Type": itemCategory,
          "Performed On Item": itemName,
          "Item Serial": itemSerial,
          "Flight Hours When Maintenance Was Done": formatHours(maintenanceDoneAtHours),
          "Cycles When Maintenance Was Done": formatCycles(cyclesAtMaintenance),
          "Total Hours Used": formatHours(itemHoursMetrics?.currentServiceHours),
          "Next Maintenance Hours": formatHours(nextDueHours ?? itemHoursMetrics?.nextMaintenanceHours),
          "Hours / Time Till Next Maintenance": formatHours(hoursToNextMaintenance),
          "Hours Remaining Till End Of Life": formatHours(itemHoursMetrics?.hoursRemainingToEndOfLife),
          "Next Due Date": formatDate(record.next_due_date),
          Remarks: record.remarks || "-",
        };
      });

      const equipmentHoursRows = [
        ...asset.components.map((component, index) => {
          const hourMetrics = getHoursTrackingMetrics(component);
          return {
            Category: "Component",
            Item:
              componentTypeMap.get(component.component_type_id || 0) ||
              component.part_number ||
              component.serial_number ||
              `Component ${index + 1}`,
            "Serial Number": component.serial_number || "-",
            "Total Hours Used": formatHours(hourMetrics.currentServiceHours),
            "Hours Remaining": formatHours(hourMetrics.hoursRemainingToEndOfLife),
            "Next Maintenance Hours": formatHours(hourMetrics.nextMaintenanceHours),
            "Hours / Time Till Next Maintenance": formatHours(hourMetrics.hoursToNextMaintenance),
          };
        }),
        ...asset.engines.map((engine, index) => {
          const hourMetrics = getHoursTrackingMetrics(engine);
          return {
            Category: "Engine",
            Item:
              engineCategoryMap.get(engine.category_id || 0) ||
              engine.model ||
              engine.serial_number ||
              `Engine ${index + 1}`,
            "Serial Number": engine.serial_number || "-",
            "Total Hours Used": formatHours(hourMetrics.currentServiceHours),
            "Hours Remaining": formatHours(hourMetrics.hoursRemainingToEndOfLife),
            "Next Maintenance Hours": formatHours(hourMetrics.nextMaintenanceHours),
            "Hours / Time Till Next Maintenance": formatHours(hourMetrics.hoursToNextMaintenance),
          };
        }),
        ...asset.avionics.map((avionic, index) => {
          const hourMetrics = getHoursTrackingMetrics(avionic);
          return {
            Category: "Avionics",
            Item:
              avionicCategoryMap.get(avionic.avionic_category_id || 0) ||
              avionic.model ||
              avionic.serial_number ||
              `Avionics ${index + 1}`,
            "Serial Number": avionic.serial_number || "-",
            "Total Hours Used": formatHours(hourMetrics.currentServiceHours),
            "Hours Remaining": formatHours(hourMetrics.hoursRemainingToEndOfLife),
            "Next Maintenance Hours": formatHours(hourMetrics.nextMaintenanceHours),
            "Hours / Time Till Next Maintenance": formatHours(hourMetrics.hoursToNextMaintenance),
          };
        }),
      ];

      const addSheet = (name: string, rows: Array<Record<string, string | number>>) => {
        const normalizedRows = rows.length > 0 ? rows : [{ Info: "No records" }];
        const sheet = XLSX.utils.json_to_sheet(normalizedRows);
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      addSheet("Maintenance History", maintenanceHistoryRows);
      addSheet("Equipment Hours", equipmentHoursRows);

      const safeName = String(asset.name || "asset")
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "asset";
      const fileName = `${safeName}-${asset.id}-maintenance-history.xlsx`;
      XLSX.writeFile(workbook, fileName);

      dispatch(showToast({ message: "Maintenance history exported", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to export maintenance history", type: "error" }));
    } finally {
      setIsDownloadingMaintenanceHistoryExport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-400">
        Loading asset details...
      </div>
    );
  }

  if (!asset) {
    return <div className="p-8 text-center text-red-400">Asset not found</div>;
  }

  const assetImageUrl = asset.image_url || asset.image || "";
  const unitName = units.find((unit) => unit.id === asset.unit_id)?.name ?? "-";
  const assetTypeName =
    assetTypes.find((type) => type.id === asset.asset_type_id)?.name ?? "-";
  const enginePositionMap = new Map(
    enginePositions.map((position) => [position.id, position.name]),
  );
  const engineCategoryMap = new Map(
    engineCategories.map((category) => [category.id, category.name]),
  );
  const ataChapterMap = new Map(
    ataChapters.map((chapter) => [
      chapter.id,
      chapter.chapter_number || chapter.name || `ATA ${chapter.id}`,
    ]),
  );
  const componentTypeMap = new Map(
    componentTypes.map((type) => [type.id, type.name]),
  );
  const avionicCategoryMap = new Map(
    avionicCategories.map((category) => [category.id, category.name]),
  );
  const configuration = parseConfiguration(asset.configuration);
  const latestOperation = asset.operations[0] ?? null;
  const defects = asset.defects ?? [];
  const maintenanceEvents = asset.maintenance_events ?? [];
  const assetTaskIds = new Set(
    assetWorkOrders.flatMap((order) => (order.tasks || []).map((task) => task.id)),
  );
  const assetComplianceRecords = complianceRecords
    .filter(
      (record) =>
        record.work_order_task_id != null && assetTaskIds.has(record.work_order_task_id),
    )
    .sort((a, b) => {
      const dateA = a.completion_date ? new Date(a.completion_date).getTime() : 0;
      const dateB = b.completion_date ? new Date(b.completion_date).getTime() : 0;
      return dateB - dateA;
    });

  // Due status for every component/engine/avionic is now computed
  // server-side (MaintenanceDueCalculator) from each part's compliance
  // history (or its own baseline+interval when it has none yet) compared
  // against the asset's live current_total_hours/cycles — which already
  // folds in manually logged flights. See asset.maintenance_due.
  const dueTrackingRows = (asset.maintenance_due ?? []).filter(
    (item) => item.status === "overdue" || item.status === "due_soon",
  );

  const handleToggleProgramSelection = (id: number) => {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPrograms = () => {
    setSelectedProgramIds(new Set(maintenancePrograms.map((p) => p.id)));
  };

  const handleDeselectAllPrograms = () => {
    setSelectedProgramIds(new Set());
  };

  const handleCreateWorkOrder = async () => {
    if (!asset?.id || selectedProgramIds.size === 0) return;

    try {
      setIsCreatingWorkOrder(true);
      const programIds = Array.from(selectedProgramIds);
      const title = `${asset.name || "Asset"} - Work Order`;

      // Build program applicabilities based on maintenance program types
      const programApplicabilities = maintenancePrograms
        .filter((prog) => programIds.includes(prog.id))
        .map((prog) => {
          const applicability: {
            program_id: number;
            component_ids?: number[];
            engine_ids?: number[];
            avionics_ids?: number[];
          } = { program_id: prog.id };

          if (prog.applicability === "component") {
            applicability.component_ids =
              asset.components
                ?.map((c) => c.id)
                .filter((id): id is number => typeof id === "number") || [];
          } else if (prog.applicability === "engine") {
            applicability.engine_ids =
              asset.engines
                ?.map((e) => e.id)
                .filter((id): id is number => typeof id === "number") || [];
          } else if (prog.applicability === "avionics") {
            applicability.avionics_ids =
              asset.avionics
                ?.map((a) => a.id)
                .filter((id): id is number => typeof id === "number") || [];
          }

          return applicability;
        });

      await createWorkOrder({
        asset_id: asset.id,
        title,
        program_applicabilities: programApplicabilities,
      }).unwrap();

      dispatch(
        showToast({
          message: `Work order created with ${programIds.length} task${programIds.length > 1 ? "s" : ""} linked to asset items`,
          type: "success",
        }),
      );
      setSelectedProgramIds(new Set());
    } catch {
      dispatch(
        showToast({
          message: "Failed to create work order",
          type: "error",
        }),
      );
    } finally {
      setIsCreatingWorkOrder(false);
    }
  };

  const handleMarkTaskCompleted = async (taskId: number) => {
    try {
      await updateWorkOrderTask({ id: taskId, status: "completed" }).unwrap();
      // Refresh the asset (maintenance_due/airworthiness) and its
      // compliance history now that this task's completion has updated them.
      refetchAsset();
      refetchComplianceRecords();
      dispatch(
        showToast({
          message: "Work order task marked as completed. Compliance history record created.",
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({
          message: "Failed to mark task as completed",
          type: "error",
        }),
      );
    }
  };

  const handleDeleteFlightLog = async (flightLogId: number) => {
    if (!asset?.id) return;
    if (!window.confirm("Delete this flight log entry?")) return;

    try {
      await deleteFlightLog({ id: flightLogId, asset_id: asset.id }).unwrap();
      dispatch(showToast({ message: "Flight log deleted", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to delete flight log", type: "error" }));
    }
  };

  const handleOpenFlightLog = (initialValues?: {
    operation_id?: number | null;
    flight_date?: string;
    hours_flown?: number | string;
    remarks?: string;
  }) => {
    setFlightLogInitialValues(initialValues);
    setShowFlightLogModal(true);
  };

  const handleCreateDueItemWorkOrder = async (
    row: Pick<MaintenanceDueItem, "part_type" | "part_id" | "part_label">,
  ) => {
    if (!asset?.id || row.part_type === "asset") {
      dispatch(showToast({ message: "Item is missing an id", type: "error" }));
      return;
    }

    const applicability = row.part_type;
    const matchingProgram = maintenancePrograms.find(
      (program) => program.applicability === applicability,
    );

    if (!matchingProgram) {
      dispatch(
        showToast({
          message: `No ${applicability} maintenance program available to create work order`,
          type: "error",
        }),
      );
      return;
    }

    const rowKey = `${row.part_type}-${row.part_id}`;

    try {
      setCreatingDueWorkOrderKey(rowKey);

      await createWorkOrder({
        asset_id: asset.id,
        title: `${asset.name || "Asset"} - ${applicability} due: ${row.part_label}`,
        program_applicabilities: [
          {
            program_id: matchingProgram.id,
            component_ids: row.part_type === "component" ? [row.part_id] : [],
            engine_ids: row.part_type === "engine" ? [row.part_id] : [],
            avionics_ids: row.part_type === "avionics" ? [row.part_id] : [],
          },
        ],
      }).unwrap();

      dispatch(
        showToast({
          message: `Work order created for due ${applicability}`,
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({
          message: "Failed to create work order",
          type: "error",
        }),
      );
    } finally {
      setCreatingDueWorkOrderKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#001219] text-white p-6 pb-20">
      {/* Ad-hoc Task Modal removed */}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <BackButton fallbackUrl="/dashboard/assets" />

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDeleteAsset}
            disabled={isDeleting}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-red-400 transition-colors disabled:opacity-60"
          >
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors">
            <Icon icon="mdi:refresh" className="w-4 h-4" />
            <span>Update status</span>
          </button>
          <button
            onClick={() =>
              navigate("/dashboard/operations/add", {
                state: {
                  from: `/dashboard/assets/${asset.id}`,
                  fromLabel: asset.name || "Asset Details",
                },
              })
            }
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:clock-outline" className="w-4 h-4" />
            <span>Add Operations</span>
          </button>
          <button
            onClick={() =>
              navigate(`/dashboard/assets/${asset.id}/defects/add`, {
                state: {
                  from: `/dashboard/assets/${asset.id}`,
                  fromLabel: asset.name || "Asset Details",
                },
              })
            }
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:alert-circle-outline" className="w-4 h-4" />
            <span>Report Defect</span>
          </button>
          <button
            onClick={() =>
              navigate(`/dashboard/assets/${asset.id}/edit`, {
                state: {
                  from: `/dashboard/assets/${asset.id}`,
                  fromLabel: asset.name || "Asset Details",
                },
              })
            }
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleExportAssetDetails}
            disabled={isDownloadingAssetExport}
            aria-label="Download asset details"
            title="Download asset details"
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors disabled:opacity-60"
          >
            <Icon
              icon={isDownloadingAssetExport ? "mdi:loading" : "mdi:download"}
              className={cn("w-4 h-4", isDownloadingAssetExport ? "animate-spin" : "")}
            />
            <span>{isDownloadingAssetExport ? "Exporting..." : "Export Asset"}</span>
          </button>
          <button
            onClick={handleDownloadMaintenanceHistory}
            disabled={isDownloadingMaintenanceHistoryExport}
            aria-label="Export maintenance history"
            title="Export maintenance history"
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors disabled:opacity-60"
          >
            <Icon
              icon={isDownloadingMaintenanceHistoryExport ? "mdi:loading" : "mdi:history"}
              className={cn(
                "w-4 h-4",
                isDownloadingMaintenanceHistoryExport ? "animate-spin" : "",
              )}
            />
            <span>
              {isDownloadingMaintenanceHistoryExport
                ? "Exporting..."
                : "Export Maintenance History"}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-8 border-b border-[#0A4D66]/40 dark:border-[#0A4D66]/40 border-slate-300 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "pb-4 text-sm font-medium transition-colors relative whitespace-nowrap bg-transparent tab-link outline-none border-0 shadow-none",
              activeTab === tab.id
                ? "text-sky-700 dark:text-[#7FD5FF] font-bold"
                : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-700 dark:bg-[#0369A1] shadow-sm dark:shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === "info" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 flex items-center justify-center min-h-50 overflow-hidden">
                {assetImageUrl ? (
                  <img
                    src={assetImageUrl}
                    alt={asset.name}
                    className="w-full h-full max-h-60 object-contain"
                  />
                ) : (
                  <Icon
                    icon="mdi:helicopter"
                    className="w-32 h-32 text-gray-400"
                  />
                )}
              </div>

              <div className="col-span-3 grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="TOTAL ENGINES"
                  value={String(asset.engines.length)}
                  onClick={() => setActiveTab("engines")}
                />
                <StatCard
                  label="TOTAL AVIONICS"
                  value={String(asset.avionics.length)}
                  onClick={() => setActiveTab("avionics")}
                />
                <StatCard
                  label="TOTAL COMPONENTS"
                  value={String(asset.components.length)}
                  onClick={() => setActiveTab("components")}
                />
                <StatCard
                  label="TOTAL OPERATIONS"
                  value={String(asset.operations_count ?? asset.operations.length)}
                  onClick={() => setActiveTab("operations")}
                />
                <StatCard
                  label="TOTAL WORK ORDERS"
                  value={String(assetWorkOrders.length)}
                  onClick={() => setActiveTab("maintenance")}
                />
                <StatCard
                  label="TOTAL DISCREPANCIES"
                  value={String(defects.length)}
                  onClick={() => setActiveTab("discrepancies")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Aircraft Identification
                </h3>
                <div className="space-y-4">
                  <DetailRow label="Aircraft Type" value={assetTypeName} />
                  <DetailRow label="Aircraft Name" value={asset.name} />
                  <DetailRow label="Model" value={asset.model || "-"} />
                  <DetailRow label="Tail No" value={asset.tail_number} />
                  <DetailRow
                    label="Serial Number (Airframe SN)"
                    value={asset.serial_number}
                  />
                  <DetailRow label="Assigned Unit" value={
                    asset.unit_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/units/${asset.unit_id}`)}
                        className="text-[#7FD5FF] hover:underline font-medium"
                      >
                        {unitName}
                      </button>
                    ) : unitName
                  } />
                  <DetailRow label="Role" value={configuration.role} />
                  <DetailRow label="Seats" value={configuration.seats} />
                  <DetailRow
                    label="Serviceability Status"
                    value={
                      <StatusPill
                        label={formatStatus(asset.serviceability_status)}
                        tone={
                          asset.serviceability_status === "serviceable"
                            ? "success"
                            : asset.serviceability_status ===
                                "under_maintenance"
                              ? "warning"
                              : "danger"
                        }
                      />
                    }
                  />
                  <DetailRow
                    label="Operation Status"
                    value={formatStatus(asset.operation_status)}
                  />
                  <DetailRow
                    label="Manufacturer"
                    value={asset.manufacturer || "-"}
                  />
                  <DetailRow
                    label="Purchase Date"
                    value={formatDate(asset.purchase_date)}
                  />
                  <DetailRow
                    label="Created At"
                    value={formatDateTime(asset.created_at)}
                  />
                  <DetailRow
                    label="Updated At"
                    value={formatDateTime(asset.updated_at)}
                  />
                </div>
              </div>

              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Documents
                </h3>
                {asset.documents.length === 0 ? (
                  <EmptyState message="No documents found." />
                ) : (
                  <div className="space-y-4">
                    {asset.documents.map((document) => (
                      <div
                        key={document.id ?? document.file}
                        className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-white">
                              {document.document_type?.name ?? "Document"}
                            </div>
                            <div className="text-xs text-gray-400">
                              Issued: {formatDate(document.issue_date)}
                            </div>
                            <div className="text-xs text-gray-400">
                              Expires: {formatDate(document.expiry_date)}
                            </div>
                          </div>
                          <a
                            href={document.file}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                          >
                            <Icon icon="mdi:open-in-new" className="w-4 h-4" />
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "components" && (
          <div className="space-y-6">
            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Components
                </h3>
                <div className="flex items-center gap-2">
                  {isEditingComponents ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setComponentsDraft((prev) => [...prev, blankComponent()])
                        }
                        className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                      >
                        Add Component
                      </button>
                      <button
                        type="button"
                        onClick={cancelComponentsEdit}
                        className="rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveComponents}
                        disabled={isUpdating}
                        className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60"
                      >
                        {isUpdating ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startAddComponent}
                        className="inline-flex items-center gap-1 rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                      >
                        <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
                        Add Component
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsImportOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                      >
                        <Icon icon="mdi:upload" className="h-3.5 w-3.5 text-slate-600 dark:text-gray-300" />
                        Import CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingComponents(true)}
                        className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                      >
                        Edit Components
                    </button>
                    </>
                  )}
                </div>
              </div>
              {componentsDraft.length === 0 ? (
                <EmptyState message="No components found." />
              ) : isEditingComponents ? (
                <div className="space-y-4">
                  {componentsDraft.map((component, index) => {
                    const extras = extraAt(
                      componentExtras,
                      index,
                      defaultTrackingExtras,
                    );
                    const hoursRemaining = computeHoursRemainingLabel(
                      component.time_since_new,
                      component.service_life_limit_hours,
                      "hrs",
                    );
                    const hoursDue = computeNextDueComponentStyle(
                      extras.last_inspection_reading,
                      component.inspection_interval_hours,
                      component.time_since_new,
                      "hrs",
                    );
                    const cyclesRemaining = computeHoursRemainingLabel(
                      extras.cycles_since_new,
                      extras.cycle_limit,
                      "Cyc",
                    );
                    const cyclesDue = computeNextDueComponentStyle(
                      extras.cycles_last_inspection,
                      component.inspection_interval_cycles,
                      extras.cycles_since_new,
                      "Cyc",
                    );
                    const updateComponent = (patch: Partial<Component>) =>
                      setComponentsDraft((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, ...patch } : item,
                        ),
                      );
                    const updateExtra = (patch: Partial<TrackingExtras>) =>
                      setComponentExtras((prev) =>
                        withExtraAt(prev, index, patch, defaultTrackingExtras),
                      );

                    return (
                      <div
                        key={component.id ?? `${component.part_number}-${index}`}
                        className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#001825] border border-[#0A4D66]/40 flex items-center justify-center text-xs text-gray-200">
                              {index + 1}
                            </div>
                          </div>
                          <button
                            type="button"
                            title="Remove Component"
                            aria-label="Remove Component"
                            onClick={() => {
                              setComponentsDraft((prev) => removeAt(prev, index));
                              setComponentExtras((prev) => removeAt(prev, index));
                            }}
                            className="text-gray-500 hover:text-red-400"
                          >
                            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                          </button>
                        </div>

                        <TrackByToggleInline
                          trackBy={extras.track_by}
                          calendarOn={extras.track_by_calendar}
                          onHours={() => {
                            const nextTrackBy = toggleTrackBy(extras.track_by, "hours");
                            const hoursOn =
                              nextTrackBy === "hours" || nextTrackBy === "both";
                            updateExtra({ track_by: nextTrackBy });
                            updateComponent({
                              inspection_interval_hours: hoursOn
                                ? (component.inspection_interval_hours ?? "")
                                : null,
                            });
                          }}
                          onCycles={() => {
                            const nextTrackBy = toggleTrackBy(extras.track_by, "cycles");
                            const cyclesOn =
                              nextTrackBy === "cycles" || nextTrackBy === "both";
                            updateExtra({ track_by: nextTrackBy });
                            updateComponent({
                              inspection_interval_cycles: cyclesOn
                                ? (component.inspection_interval_cycles ?? "")
                                : null,
                            });
                          }}
                          onCalendar={() =>
                            updateExtra({ track_by_calendar: !extras.track_by_calendar })
                          }
                        />

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Component Description
                            </label>
                            <select
                              title="Component Type"
                              className={inputClass}
                              value={component.component_type_id || ""}
                              onChange={(e) =>
                                updateComponent({
                                  component_type_id:
                                    Number(e.target.value) || undefined,
                                })
                              }
                            >
                              <option value="">Select Description</option>
                              {componentTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">ATA Chapter</label>
                            <select
                              title="Airframe Component ATA Chapter"
                              className={inputClass}
                              value={component.ata_chapter_id || ""}
                              onChange={(e) =>
                                updateComponent({
                                  ata_chapter_id: Number(e.target.value) || undefined,
                                })
                              }
                            >
                              <option value="">Select ATA Chapter</option>
                              {componentAtaChapters.map((chapter) => (
                                <option key={chapter.id} value={chapter.id}>
                                  {chapter.chapter_number ||
                                    chapter.name ||
                                    `ATA ${chapter.id}`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">Serial Number</label>
                            <input
                              type="text"
                              className={inputClass}
                              placeholder="Enter Serial Number"
                              value={component.serial_number || ""}
                              onChange={(e) =>
                                updateComponent({ serial_number: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">Part Number</label>
                            <input
                              type="text"
                              className={inputClass}
                              placeholder="Enter Part number"
                              value={component.part_number || ""}
                              onChange={(e) =>
                                updateComponent({ part_number: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Installation Date(optional)
                            </label>
                            <input
                              type="date"
                              title="Component Installation Date"
                              className={inputClass}
                              value={toDateOnly(component.installed_at)}
                              onChange={(e) =>
                                updateComponent({ installed_at: e.target.value })
                              }
                            />
                          </div>

                          {(extras.track_by === "hours" ||
                            extras.track_by === "both") && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Total Service Hrs
                                </label>
                                <input
                                  type="number"
                                  className={inputClass}
                                  placeholder="Enter Hrs"
                                  value={String(component.time_since_new ?? "")}
                                  onChange={(e) =>
                                    updateComponent({ time_since_new: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Service Life Limit hrs
                                </label>
                                <input
                                  type="number"
                                  className={inputClass}
                                  placeholder="Enter Hrs"
                                  value={String(
                                    component.service_life_limit_hours ?? "",
                                  )}
                                  onChange={(e) =>
                                    updateComponent({
                                      service_life_limit_hours: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Life Remaining
                                </label>
                                <div className="text-2xl font-bold text-white">
                                  {hoursRemaining}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Last Inspection Reading hrs
                                </label>
                                <input
                                  type="number"
                                  className={inputClass}
                                  placeholder="Enter Hrs"
                                  value={extras.last_inspection_reading}
                                  onChange={(e) =>
                                    updateExtra({
                                      last_inspection_reading: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Inspection Interval
                                </label>
                                <input
                                  type="number"
                                  className={inputClass}
                                  placeholder="Enter Hrs"
                                  value={String(
                                    component.inspection_interval_hours ?? "",
                                  )}
                                  onChange={(e) =>
                                    updateComponent({
                                      inspection_interval_hours: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  {hoursDue.label}
                                </label>
                                <div className="text-2xl font-bold text-white">
                                  {hoursDue.value}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {(extras.track_by === "cycles" ||
                          extras.track_by === "both") && (
                          <div className="col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Total Cycles
                              </label>
                              <input
                                type="number"
                                className={inputClass}
                                placeholder="Enter Cyc"
                                value={extras.cycles_since_new}
                                onChange={(e) =>
                                  updateExtra({ cycles_since_new: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Cycle Limit
                              </label>
                              <input
                                type="number"
                                className={inputClass}
                                placeholder="Enter Cyc"
                                value={extras.cycle_limit}
                                onChange={(e) =>
                                  updateExtra({ cycle_limit: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Last Inspection Cycles Reference
                              </label>
                              <input
                                type="number"
                                className={inputClass}
                                placeholder="Enter Cyc"
                                value={extras.cycles_last_inspection}
                                onChange={(e) =>
                                  updateExtra({
                                    cycles_last_inspection: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Inspection Interval (cycles)
                              </label>
                              <input
                                type="number"
                                className={inputClass}
                                placeholder="Enter Cyc"
                                value={String(
                                  component.inspection_interval_cycles ?? "",
                                )}
                                onChange={(e) =>
                                  updateComponent({
                                    inspection_interval_cycles: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Life Remaining
                              </label>
                              <div className="text-2xl font-bold text-white">
                                {cyclesRemaining}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                {cyclesDue.label}
                              </label>
                              <div className="text-2xl font-bold text-white">
                                {cyclesDue.value}
                              </div>
                            </div>
                          </div>
                        )}

                        {extras.track_by_calendar && (
                          <CalendarTrackingBlock
                            installedAt={toDateOnly(component.installed_at)}
                            onInstalledAtChange={(value) =>
                              updateComponent({ installed_at: value })
                            }
                            manufactureDate={extras.calendar_manufacture_date}
                            onManufactureDateChange={(value) =>
                              updateExtra({ calendar_manufacture_date: value })
                            }
                            lastInspectionDate={extras.calendar_last_inspection_date}
                            onLastInspectionDateChange={(value) =>
                              updateExtra({ calendar_last_inspection_date: value })
                            }
                            expiryDate={extras.calendar_expiry_date}
                            onExpiryDateChange={(value) =>
                              updateExtra({ calendar_expiry_date: value })
                            }
                            intervalType={extras.calendar_interval_type}
                            onIntervalTypeChange={(value) =>
                              updateExtra({ calendar_interval_type: value })
                            }
                          />
                        )}

                        {/* Maintenance Strategy and Removed Date are real,
                            persisted fields already sent by
                            handleSaveComponents. AddAssetPage's Add form
                            doesn't expose per-component controls for these
                            (it applies one maintenance strategy default to
                            everything at submit time and always leaves
                            removed_at empty for new components), so keeping
                            them editable here is an intentional deviation to
                            avoid a functional regression. */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Maintenance Strategy
                            </label>
                            <select
                              title="Maintenance strategy"
                              className={inputClass}
                              value={component.maintenance_strategy || "hard-time"}
                              onChange={(e) =>
                                updateComponent({
                                  maintenance_strategy: toMaintenanceStrategy(
                                    e.target.value,
                                  ),
                                })
                              }
                            >
                              <option value="hard-time">Hard Time</option>
                              <option value="on-condition">On Condition</option>
                              <option value="condition">Condition</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">Removed Date</label>
                            <input
                              type="date"
                              title="Removed date"
                              className={inputClass}
                              value={toDateOnly(component.removed_at)}
                              onChange={(e) =>
                                updateComponent({ removed_at: e.target.value })
                              }
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                setComponentsDraft((prev) => removeAt(prev, index));
                                setComponentExtras((prev) => removeAt(prev, index));
                              }}
                              className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors"
                            >
                              Remove Component
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {componentsDraft.map((component, index) => (
                    <div
                      key={component.id ?? `${component.part_number}-${index}`}
                      className="rounded-xl border border-[#0A4D66]/30 bg-[#001825] p-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-sm font-bold text-[#7FD5FF] uppercase">
                          {componentTypeMap.get(
                            component.component_type_id ?? 0,
                          ) ?? `Component ${index + 1}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          Installed {formatDate(component.installed_at)}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <DetailRow
                          label="Part Number"
                          value={component.part_number || "-"}
                        />
                        <DetailRow
                          label="Serial Number"
                          value={component.serial_number || "-"}
                        />
                        <DetailRow
                          label="Baseline Hours"
                          value={formatHours(component.time_since_new)}
                        />
                        <DetailRow
                          label="Operation Flight Hours"
                          value={formatHours(getOperationFlightHours(component))}
                        />
                        <DetailRow
                          label="Current Service Hours"
                          value={formatHours(getCurrentServiceHours(component))}
                        />
                        <DetailRow
                          label="Service Life Limit"
                          value={formatHours(
                            component.service_life_limit_hours,
                          )}
                        />
                        <DetailRow
                          label="ATA Chapter"
                          value={
                            ataChapterMap.get(component.ata_chapter_id ?? 0) ??
                            "-"
                          }
                        />
                        <DetailRow
                          label="Inspection Interval"
                          value={formatInspectionInterval(
                            component.inspection_interval,
                            component.inspection_interval_unit,
                          )}
                        />
                        <DetailRow
                          label="Inspection Interval Unit"
                          value={formatStatus(component.inspection_interval_unit)}
                        />
                        <DetailRow
                          label="Maintenance Strategy"
                          value={formatStatus(component.maintenance_strategy)}
                        />
                        <DetailRow
                          label="Removed At"
                          value={formatDate(component.removed_at)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "engines" && (
          <div className="space-y-6">
            <div className="flex items-center justify-end gap-2">
              {isEditingEngines ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEnginesDraft((prev) => [...prev, blankEngine()]);
                      setEngineExtras((prev) => [...prev, defaultTrackingExtras()]);
                      setEngineComponentsDraft((prev) => [...prev, []]);
                      setEngineComponentExtras((prev) => [...prev, []]);
                      setActiveEngineIndex(enginesDraft.length);
                    }}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Add Engine
                  </button>
                  <button
                    type="button"
                    onClick={cancelEnginesEdit}
                    className="rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEngines}
                    disabled={isUpdating}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60"
                  >
                    {isUpdating ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startAddEngine}
                    className="inline-flex items-center gap-1 rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
                    Add Engine
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  >
                    <Icon icon="mdi:upload" className="h-3.5 w-3.5 text-slate-600 dark:text-gray-300" />
                    Import CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingEngines(true)}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Edit Engines
                  </button>
                </>
              )}
            </div>

            {isEditingEngines ? (
              <>
                {/* Engine tabs - mirrors AddAssetPage.tsx's activeEngineIndex tab bar. */}
                <div className="flex flex-wrap items-center gap-2">
                  {enginesDraft.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveEngineIndex(idx)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold border transition-colors",
                        activeEngineIndex === idx
                          ? "bg-[#001825] text-white border-[#7FD5FF]"
                          : "bg-transparent text-gray-400 border-[#0A4D66]/40 hover:text-white",
                      )}
                    >
                      <span>Engine {idx + 1}</span>
                      {enginesDraft.length > 1 ? (
                        <button
                          type="button"
                          title="Remove Engine"
                          aria-label="Remove Engine"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnginesDraft((prev) => removeAt(prev, idx));
                            setEngineExtras((prev) => removeAt(prev, idx));
                            setEngineComponentsDraft((prev) => removeAt(prev, idx));
                            setEngineComponentExtras((prev) => removeAt(prev, idx));
                            setActiveEngineIndex((prev) => {
                              if (prev === idx) return Math.max(0, idx - 1);
                              if (prev > idx) return prev - 1;
                              return prev;
                            });
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <Icon icon="mdi:close" className="w-3 h-3" />
                        </button>
                      ) : null}
                    </button>
                  ))}
                </div>

                {enginesDraft[activeEngineIndex] ? (
                  (() => {
                    const engine = enginesDraft[activeEngineIndex];
                    const extras = extraAt(
                      engineExtras,
                      activeEngineIndex,
                      defaultTrackingExtras,
                    );
                    const updateEngine = (patch: Partial<Engine>) =>
                      setEnginesDraft((prev) =>
                        prev.map((item, i) =>
                          i === activeEngineIndex ? { ...item, ...patch } : item,
                        ),
                      );
                    const updateExtra = (patch: Partial<TrackingExtras>) =>
                      setEngineExtras((prev) =>
                        withExtraAt(prev, activeEngineIndex, patch, defaultTrackingExtras),
                      );
                    const nestedComponents = engineComponentsDraft[activeEngineIndex] ?? [];

                    return (
                      <>
                        {/* Visually copied from AddAssetPage.tsx's shared
                            Engine Category/ATA Chapter/Maintenance Strategy
                            bar, but wired to the active engine (not a single
                            global default) since the Engine model already
                            persists these per engine. */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">Engine Category</label>
                            <select
                              title="Engine category"
                              className={inputClass}
                              value={engine.category_id || ""}
                              onChange={(e) =>
                                updateEngine({
                                  category_id: Number(e.target.value) || undefined,
                                })
                              }
                            >
                              <option value="">Select category</option>
                              {engineCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">ATA Chapter</label>
                            <select
                              title="Engine ATA chapter"
                              className={inputClass}
                              value={engine.ata_chapter_id || ""}
                              onChange={(e) =>
                                updateEngine({
                                  ata_chapter_id: Number(e.target.value) || undefined,
                                })
                              }
                            >
                              <option value="">Select ATA chapter</option>
                              {engineAtaChapters.map((chapter) => (
                                <option key={chapter.id} value={chapter.id}>
                                  {chapter.chapter_number ||
                                    chapter.name ||
                                    `ATA ${chapter.id}`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">Maintenance Strategy</label>
                            <select
                              title="Engine maintenance strategy"
                              className={inputClass}
                              value={engine.maintenance_strategy || "hard-time"}
                              onChange={(e) =>
                                updateEngine({
                                  maintenance_strategy: toMaintenanceStrategy(
                                    e.target.value,
                                  ),
                                })
                              }
                            >
                              <option value="hard-time">Hard Time</option>
                              <option value="on-condition">On Condition</option>
                              <option value="condition">Condition</option>
                            </select>
                          </div>
                        </div>

                        <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                          <TrackByToggleBlock
                            trackBy={extras.track_by}
                            calendarOn={extras.track_by_calendar}
                            onHours={() => {
                              const nextTrackBy = toggleTrackBy(extras.track_by, "hours");
                              const hoursOn =
                                nextTrackBy === "hours" || nextTrackBy === "both";
                              updateExtra({ track_by: nextTrackBy });
                              updateEngine({
                                inspection_interval_hours: hoursOn
                                  ? (engine.inspection_interval_hours ?? "")
                                  : null,
                              });
                            }}
                            onCycles={() => {
                              const nextTrackBy = toggleTrackBy(extras.track_by, "cycles");
                              const cyclesOn =
                                nextTrackBy === "cycles" || nextTrackBy === "both";
                              updateExtra({ track_by: nextTrackBy });
                              updateEngine({
                                inspection_interval_cycles: cyclesOn
                                  ? (engine.inspection_interval_cycles ?? "")
                                  : null,
                              });
                            }}
                            onCalendar={() =>
                              updateExtra({
                                track_by_calendar: !extras.track_by_calendar,
                              })
                            }
                          />

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">Position</label>
                              <select
                                title="Engine Position"
                                className={inputClass}
                                value={engine.position_id || ""}
                                onChange={(e) =>
                                  updateEngine({
                                    position_id: Number(e.target.value) || 1,
                                  })
                                }
                              >
                                {(enginePositions.length
                                  ? enginePositions.map((pos) => ({
                                      id: pos.id,
                                      name: pos.name,
                                    }))
                                  : FALLBACK_ENGINE_POSITIONS.map((name, idx) => ({
                                      id: idx + 1,
                                      name,
                                    }))
                                ).map((pos) => (
                                  <option key={pos.id} value={pos.id}>
                                    {pos.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">Serial Number</label>
                              <input
                                type="text"
                                className={inputClass}
                                placeholder="Enter Serial Number"
                                value={engine.serial_number || ""}
                                onChange={(e) =>
                                  updateEngine({ serial_number: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">Model</label>
                              <input
                                type="text"
                                className={inputClass}
                                placeholder="Enter Model"
                                value={engine.model || ""}
                                onChange={(e) => updateEngine({ model: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Installation Date(optional)
                              </label>
                              <input
                                type="date"
                                title="Engine Installation Date"
                                className={inputClass}
                                value={toDateOnly(engine.installation_date)}
                                onChange={(e) =>
                                  updateEngine({ installation_date: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          {(extras.track_by === "hours" || extras.track_by === "both") && (
                            <HoursTrackingGrid
                              totalHours={String(engine.time_since_new ?? "")}
                              onTotalHoursChange={(value) =>
                                updateEngine({ time_since_new: value })
                              }
                              lifeLimit={String(engine.service_life_limit ?? "")}
                              onLifeLimitChange={(value) =>
                                updateEngine({ service_life_limit: value })
                              }
                              lastInspectionReading={extras.last_inspection_reading}
                              onLastInspectionReadingChange={(value) =>
                                updateExtra({ last_inspection_reading: value })
                              }
                              interval={String(engine.inspection_interval_hours ?? "")}
                              onIntervalChange={(value) =>
                                updateEngine({ inspection_interval_hours: value })
                              }
                            />
                          )}

                          {(extras.track_by === "cycles" || extras.track_by === "both") && (
                            <CyclesTrackingGrid
                              totalCycles={extras.cycles_since_new}
                              onTotalCyclesChange={(value) =>
                                updateExtra({ cycles_since_new: value })
                              }
                              cycleLimit={extras.cycle_limit}
                              onCycleLimitChange={(value) =>
                                updateExtra({ cycle_limit: value })
                              }
                              lastInspectionCycles={extras.cycles_last_inspection}
                              onLastInspectionCyclesChange={(value) =>
                                updateExtra({ cycles_last_inspection: value })
                              }
                              interval={String(engine.inspection_interval_cycles ?? "")}
                              onIntervalChange={(value) =>
                                updateEngine({ inspection_interval_cycles: value })
                              }
                            />
                          )}

                          {extras.track_by_calendar && (
                            <CalendarTrackingBlock
                              installedAt={toDateOnly(engine.installation_date)}
                              onInstalledAtChange={(value) =>
                                updateEngine({ installation_date: value })
                              }
                              manufactureDate={extras.calendar_manufacture_date}
                              onManufactureDateChange={(value) =>
                                updateExtra({ calendar_manufacture_date: value })
                              }
                              lastInspectionDate={extras.calendar_last_inspection_date}
                              onLastInspectionDateChange={(value) =>
                                updateExtra({ calendar_last_inspection_date: value })
                              }
                              expiryDate={extras.calendar_expiry_date}
                              onExpiryDateChange={(value) =>
                                updateExtra({ calendar_expiry_date: value })
                              }
                              intervalType={extras.calendar_interval_type}
                              onIntervalTypeChange={(value) =>
                                updateExtra({ calendar_interval_type: value })
                              }
                            />
                          )}

                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (enginesDraft.length <= 1) return;
                                const idx = activeEngineIndex;
                                setEnginesDraft((prev) => removeAt(prev, idx));
                                setEngineExtras((prev) => removeAt(prev, idx));
                                setEngineComponentsDraft((prev) => removeAt(prev, idx));
                                setEngineComponentExtras((prev) => removeAt(prev, idx));
                                setActiveEngineIndex((prev) => Math.max(0, prev - (prev >= idx ? 1 : 0)));
                              }}
                              className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                              disabled={enginesDraft.length <= 1}
                            >
                              Remove Engine
                            </button>
                          </div>
                        </div>

                        {/* Nested "Engine Component" sub-form. There is no
                            engine_id linkage field on Component, so these are
                            merged into the flat components payload on save
                            (see handleSaveEngines / buildComponentPayload). */}
                        <div>
                          <div className="flex items-center gap-4 mb-4">
                            <h3 className="text-xs font-bold text-[#7FD5FF] uppercase">
                              Engine Component
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setEngineComponentsDraft((prev) =>
                                  prev.map((list, i) =>
                                    i === activeEngineIndex
                                      ? [
                                          ...list,
                                          blankEngineComponentDraft(
                                            undefined,
                                            componentAtaChapters[0]?.id,
                                          ),
                                        ]
                                      : list,
                                  ),
                                );
                              }}
                              className="flex items-center gap-1 bg-[#001825] text-[#001219] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
                            >
                              <Icon icon="mdi:plus" className="w-3 h-3" />
                              Add Component
                            </button>
                          </div>

                          <div className="space-y-4">
                            {nestedComponents.map((comp, idx) => {
                              const compExtras = extraAt(
                                engineComponentExtras[activeEngineIndex] ?? [],
                                idx,
                                defaultTrackingExtras,
                              );
                              const updateNestedComponent = (patch: Partial<Component>) =>
                                setEngineComponentsDraft((prev) =>
                                  prev.map((list, i) =>
                                    i === activeEngineIndex
                                      ? list.map((c, j) =>
                                          j === idx ? { ...c, ...patch } : c,
                                        )
                                      : list,
                                  ),
                                );
                              const updateNestedExtra = (patch: Partial<TrackingExtras>) =>
                                setEngineComponentExtras((prev) =>
                                  prev.map((list, i) =>
                                    i === activeEngineIndex
                                      ? withExtraAt(list, idx, patch, defaultTrackingExtras)
                                      : list,
                                  ),
                                );

                              return (
                                <div
                                  key={idx}
                                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
                                >
                                  <div className="absolute left-4 top-4 flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[#001825] border border-[#0A4D66]/40 flex items-center justify-center text-xs font-bold text-white">
                                      {idx + 1}
                                    </div>
                                    <button
                                      type="button"
                                      title="Remove Engine Component"
                                      aria-label="Remove Engine Component"
                                      onClick={() => {
                                        setEngineComponentsDraft((prev) =>
                                          prev.map((list, i) =>
                                            i === activeEngineIndex
                                              ? removeAt(list, idx)
                                              : list,
                                          ),
                                        );
                                        setEngineComponentExtras((prev) =>
                                          prev.map((list, i) =>
                                            i === activeEngineIndex
                                              ? removeAt(list, idx)
                                              : list,
                                          ),
                                        );
                                      }}
                                      className="text-gray-500 hover:text-red-500"
                                    >
                                      <Icon
                                        icon="mdi:trash-can-outline"
                                        className="w-4 h-4"
                                      />
                                    </button>
                                  </div>

                                  <div className="pt-10">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                      <div className="col-span-1 md:col-span-4">
                                        <TrackByToggleBlock
                                          trackBy={compExtras.track_by}
                                          calendarOn={compExtras.track_by_calendar}
                                          onHours={() => {
                                            const nextTrackBy = toggleTrackBy(
                                              compExtras.track_by,
                                              "hours",
                                            );
                                            const hoursOn =
                                              nextTrackBy === "hours" ||
                                              nextTrackBy === "both";
                                            updateNestedExtra({ track_by: nextTrackBy });
                                            updateNestedComponent({
                                              inspection_interval_hours: hoursOn
                                                ? (comp.inspection_interval_hours ?? "")
                                                : null,
                                            });
                                          }}
                                          onCycles={() => {
                                            const nextTrackBy = toggleTrackBy(
                                              compExtras.track_by,
                                              "cycles",
                                            );
                                            const cyclesOn =
                                              nextTrackBy === "cycles" ||
                                              nextTrackBy === "both";
                                            updateNestedExtra({ track_by: nextTrackBy });
                                            updateNestedComponent({
                                              inspection_interval_cycles: cyclesOn
                                                ? (comp.inspection_interval_cycles ?? "")
                                                : null,
                                            });
                                          }}
                                          onCalendar={() =>
                                            updateNestedExtra({
                                              track_by_calendar:
                                                !compExtras.track_by_calendar,
                                            })
                                          }
                                        />
                                      </div>

                                      {/* AddAssetPage.tsx's nested Engine
                                          Component "Component Type" select
                                          lists engineCategories (not
                                          componentTypes) - reproduced as-is
                                          for visual/behavioral parity. */}
                                      <div className="space-y-1">
                                        <label className="text-xs text-gray-400">
                                          Component Type
                                        </label>
                                        <select
                                          title="Engine Component Type"
                                          className={inputClass}
                                          value={comp.component_type_id || ""}
                                          onChange={(e) =>
                                            updateNestedComponent({
                                              component_type_id:
                                                Number(e.target.value) || undefined,
                                            })
                                          }
                                        >
                                          <option value="">Select Type</option>
                                          {engineCategories.map((t) => (
                                            <option key={t.id} value={t.id}>
                                              {t.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-gray-400">
                                          ATA Chapter
                                        </label>
                                        <select
                                          title="Engine Component ATA Chapter"
                                          className={inputClass}
                                          value={comp.ata_chapter_id || ""}
                                          onChange={(e) =>
                                            updateNestedComponent({
                                              ata_chapter_id:
                                                Number(e.target.value) || undefined,
                                            })
                                          }
                                        >
                                          <option value="">Select ATA Chapter</option>
                                          {componentAtaChapters.map((chapter) => (
                                            <option key={chapter.id} value={chapter.id}>
                                              {chapter.chapter_number ||
                                                chapter.name ||
                                                `ATA ${chapter.id}`}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-gray-400">
                                          Serial Number
                                        </label>
                                        <input
                                          type="text"
                                          className={inputClass}
                                          placeholder="Enter Serial Number"
                                          value={comp.serial_number || ""}
                                          onChange={(e) =>
                                            updateNestedComponent({
                                              serial_number: e.target.value,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-gray-400">
                                          Part Number
                                        </label>
                                        <input
                                          type="text"
                                          className={inputClass}
                                          placeholder="Enter Part number"
                                          value={comp.part_number || ""}
                                          onChange={(e) =>
                                            updateNestedComponent({
                                              part_number: e.target.value,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-gray-400">
                                          Installation Date(optional)
                                        </label>
                                        <input
                                          type="date"
                                          title="Engine Component Installation Date"
                                          className={inputClass}
                                          value={toDateOnly(comp.installed_at)}
                                          onChange={(e) =>
                                            updateNestedComponent({
                                              installed_at: e.target.value,
                                            })
                                          }
                                        />
                                      </div>
                                    </div>

                                    {(compExtras.track_by === "hours" ||
                                      compExtras.track_by === "both") && (
                                      <HoursTrackingGrid
                                        totalHours={String(comp.time_since_new ?? "")}
                                        onTotalHoursChange={(value) =>
                                          updateNestedComponent({ time_since_new: value })
                                        }
                                        lifeLimit={String(
                                          comp.service_life_limit_hours ?? "",
                                        )}
                                        onLifeLimitChange={(value) =>
                                          updateNestedComponent({
                                            service_life_limit_hours: value,
                                          })
                                        }
                                        lastInspectionReading={
                                          compExtras.last_inspection_reading
                                        }
                                        onLastInspectionReadingChange={(value) =>
                                          updateNestedExtra({
                                            last_inspection_reading: value,
                                          })
                                        }
                                        interval={String(
                                          comp.inspection_interval_hours ?? "",
                                        )}
                                        onIntervalChange={(value) =>
                                          updateNestedComponent({
                                            inspection_interval_hours: value,
                                          })
                                        }
                                      />
                                    )}

                                    {(compExtras.track_by === "cycles" ||
                                      compExtras.track_by === "both") && (
                                      <CyclesTrackingGrid
                                        totalCycles={compExtras.cycles_since_new}
                                        onTotalCyclesChange={(value) =>
                                          updateNestedExtra({ cycles_since_new: value })
                                        }
                                        cycleLimit={compExtras.cycle_limit}
                                        onCycleLimitChange={(value) =>
                                          updateNestedExtra({ cycle_limit: value })
                                        }
                                        lastInspectionCycles={
                                          compExtras.cycles_last_inspection
                                        }
                                        onLastInspectionCyclesChange={(value) =>
                                          updateNestedExtra({
                                            cycles_last_inspection: value,
                                          })
                                        }
                                        interval={String(
                                          comp.inspection_interval_cycles ?? "",
                                        )}
                                        onIntervalChange={(value) =>
                                          updateNestedComponent({
                                            inspection_interval_cycles: value,
                                          })
                                        }
                                      />
                                    )}

                                    {compExtras.track_by_calendar && (
                                      <CalendarTrackingBlock
                                        installedAt={toDateOnly(comp.installed_at)}
                                        onInstalledAtChange={(value) =>
                                          updateNestedComponent({ installed_at: value })
                                        }
                                        manufactureDate={
                                          compExtras.calendar_manufacture_date
                                        }
                                        onManufactureDateChange={(value) =>
                                          updateNestedExtra({
                                            calendar_manufacture_date: value,
                                          })
                                        }
                                        lastInspectionDate={
                                          compExtras.calendar_last_inspection_date
                                        }
                                        onLastInspectionDateChange={(value) =>
                                          updateNestedExtra({
                                            calendar_last_inspection_date: value,
                                          })
                                        }
                                        expiryDate={compExtras.calendar_expiry_date}
                                        onExpiryDateChange={(value) =>
                                          updateNestedExtra({
                                            calendar_expiry_date: value,
                                          })
                                        }
                                        intervalType={compExtras.calendar_interval_type}
                                        onIntervalTypeChange={(value) =>
                                          updateNestedExtra({
                                            calendar_interval_type: value,
                                          })
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : null}
              </>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {enginesDraft.map((engine, index) => (
                  <div
                    key={index}
                    className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                        ENGINE {index + 1}
                      </h3>
                      <span className="text-xs text-[#7FD5FF]">
                        {enginePositionMap.get(engine.position_id) ??
                          "Position Unassigned"}
                      </span>
                    </div>
                    <div className="space-y-4">
                      <DetailRow
                        label="Category"
                        value={engineCategoryMap.get(engine.category_id ?? 0) ?? "-"}
                      />
                      <DetailRow
                        label="ATA Chapter"
                        value={ataChapterMap.get(engine.ata_chapter_id ?? 0) ?? "-"}
                      />
                      <DetailRow
                        label="Serial Number"
                        value={engine.serial_number}
                      />
                      <DetailRow label="Model" value={engine.model} />
                      <DetailRow
                        label="Installation Date"
                        value={formatDate(engine.installation_date)}
                      />
                      <DetailRow
                        label="Position"
                        value={enginePositionMap.get(engine.position_id) ?? "-"}
                      />
                      <DetailRow
                        label="Baseline Hours"
                        value={formatHours(engine.time_since_new)}
                      />
                      <DetailRow
                        label="Operation Flight Hours"
                        value={formatHours(getOperationFlightHours(engine))}
                      />
                      <DetailRow
                        label="Current Service Hours"
                        value={formatHours(getCurrentServiceHours(engine))}
                      />
                      <DetailRow
                        label="Service Life Limit"
                        value={formatHours(engine.service_life_limit)}
                      />
                      <DetailRow
                        label="Inspection Interval Unit"
                        value={formatStatus(engine.inspection_interval_unit)}
                      />
                      <DetailRow
                        label="Inspection Interval"
                        value={formatInspectionInterval(
                          engine.inspection_interval,
                          engine.inspection_interval_unit,
                        )}
                      />
                      <DetailRow
                        label="Maintenance Strategy"
                        value={formatStatus(engine.maintenance_strategy)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "avionics" && (
          <div className="space-y-6">
            <div className="flex items-center justify-end gap-2">
              {isEditingAvionics ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAvionicsDraft((prev) => [...prev, blankAvionic()]);
                      setAvionicsExtras((prev) => [...prev, defaultTrackingExtras()]);
                    }}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Add Avionics
                  </button>
                  <button
                    type="button"
                    onClick={cancelAvionicsEdit}
                    className="rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAvionics}
                    disabled={isUpdating}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60"
                  >
                    {isUpdating ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startAddAvionic}
                    className="inline-flex items-center gap-1 rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
                    Add Avionics
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  >
                    <Icon icon="mdi:upload" className="h-3.5 w-3.5 text-slate-600 dark:text-gray-300" />
                    Import CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingAvionics(true)}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Edit Avionics
                  </button>
                </>
              )}
            </div>

            {isEditingAvionics ? (
              <div className="space-y-4">
                {avionicsDraft.map((avionic, index) => {
                  const extras = extraAt(
                    avionicsExtras,
                    index,
                    defaultTrackingExtras,
                  );
                  const updateAvionic = (patch: Partial<Avionics>) =>
                    setAvionicsDraft((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, ...patch } : item,
                      ),
                    );
                  const updateExtra = (patch: Partial<TrackingExtras>) =>
                    setAvionicsExtras((prev) =>
                      withExtraAt(prev, index, patch, defaultTrackingExtras),
                    );

                  return (
                    <div
                      key={index}
                      className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-6 h-6 rounded-full bg-[#001825] border border-[#0A4D66]/40 flex items-center justify-center text-xs font-bold text-white">
                          {index + 1}
                        </div>
                        <button
                          type="button"
                          title="Remove Avionics Component"
                          aria-label="Remove Avionics Component"
                          onClick={() => {
                            setAvionicsDraft((prev) => removeAt(prev, index));
                            setAvionicsExtras((prev) => removeAt(prev, index));
                          }}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                        </button>
                      </div>

                      <TrackByToggleBlock
                        trackBy={extras.track_by}
                        calendarOn={extras.track_by_calendar}
                        onHours={() => {
                          const nextTrackBy = toggleTrackBy(extras.track_by, "hours");
                          updateExtra({ track_by: nextTrackBy });
                          // Avionics only has a single persisted interval
                          // slot (unlike Component/Engine, which have split
                          // hours/cycles fields), so the Hours checkbox just
                          // switches that field's unit to "hours".
                          if (nextTrackBy === "hours" || nextTrackBy === "both") {
                            updateAvionic({ inspection_interval_unit: "hours" });
                          }
                        }}
                        onCycles={() => {
                          const nextTrackBy = toggleTrackBy(extras.track_by, "cycles");
                          updateExtra({ track_by: nextTrackBy });
                          if (nextTrackBy === "cycles") {
                            updateAvionic({ inspection_interval_unit: "cycle" });
                          }
                        }}
                        onCalendar={() =>
                          updateExtra({ track_by_calendar: !extras.track_by_calendar })
                        }
                      />

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Component Type
                          </label>
                          <select
                            title="Avionics Component Type"
                            className={inputClass}
                            value={avionic.avionic_category_id || ""}
                            onChange={(e) =>
                              updateAvionic({
                                avionic_category_id:
                                  Number(e.target.value) || undefined,
                              })
                            }
                          >
                            <option value="">Select Type</option>
                            {avionicCategories.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">ATA Chapter</label>
                          <select
                            title="Avionics ATA Chapter"
                            className={inputClass}
                            value={avionic.ata_chapter_id || ""}
                            onChange={(e) =>
                              updateAvionic({
                                ata_chapter_id: Number(e.target.value) || undefined,
                              })
                            }
                          >
                            <option value="">Select ATA Chapter</option>
                            {avionicsAtaChapters.map((chapter) => (
                              <option key={chapter.id} value={chapter.id}>
                                {chapter.chapter_number ||
                                  chapter.name ||
                                  `ATA ${chapter.id}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Serial Number
                          </label>
                          <input
                            type="text"
                            className={inputClass}
                            placeholder="Enter Serial Number"
                            value={avionic.serial_number || ""}
                            onChange={(e) =>
                              updateAvionic({ serial_number: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">Model</label>
                          <input
                            type="text"
                            className={inputClass}
                            placeholder="Enter Model"
                            value={avionic.model || ""}
                            onChange={(e) => updateAvionic({ model: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Installation Date(optional)
                          </label>
                          <input
                            type="date"
                            title="Avionics Installation Date"
                            className={inputClass}
                            value={toDateOnly(avionic.installed_at)}
                            onChange={(e) =>
                              updateAvionic({ installed_at: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Manufacturer
                          </label>
                          <input
                            type="text"
                            className={inputClass}
                            placeholder="Enter Manufacturer"
                            value={avionic.manufacturer || ""}
                            onChange={(e) =>
                              updateAvionic({ manufacturer: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Removed At(optional)
                          </label>
                          <input
                            type="date"
                            title="Avionics Removed Date"
                            className={inputClass}
                            value={toDateOnly(avionic.removed_at)}
                            onChange={(e) =>
                              updateAvionic({ removed_at: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Maintenance Strategy
                          </label>
                          <select
                            title="Avionics maintenance strategy"
                            className={inputClass}
                            value={avionic.maintenance_strategy || "hard-time"}
                            onChange={(e) =>
                              updateAvionic({
                                maintenance_strategy: toMaintenanceStrategy(
                                  e.target.value,
                                ),
                              })
                            }
                          >
                            <option value="hard-time">Hard Time</option>
                            <option value="on-condition">On Condition</option>
                            <option value="condition">Condition</option>
                          </select>
                        </div>
                      </div>

                      {(extras.track_by === "hours" || extras.track_by === "both") && (
                        <HoursTrackingGrid
                          totalHours={String(avionic.time_since_new ?? "")}
                          onTotalHoursChange={(value) =>
                            updateAvionic({ time_since_new: value })
                          }
                          lifeLimit={String(avionic.service_life_limit ?? "")}
                          onLifeLimitChange={(value) =>
                            updateAvionic({ service_life_limit: value })
                          }
                          lastInspectionReading={extras.last_inspection_reading}
                          onLastInspectionReadingChange={(value) =>
                            updateExtra({ last_inspection_reading: value })
                          }
                          interval={String(avionic.inspection_interval ?? "")}
                          onIntervalChange={(value) =>
                            updateAvionic({
                              inspection_interval: value,
                              inspection_interval_unit: "hours",
                            })
                          }
                        />
                      )}

                      {(extras.track_by === "cycles" || extras.track_by === "both") && (
                        <CyclesTrackingGrid
                          totalCycles={extras.cycles_since_new}
                          onTotalCyclesChange={(value) =>
                            updateExtra({ cycles_since_new: value })
                          }
                          cycleLimit={extras.cycle_limit}
                          onCycleLimitChange={(value) =>
                            updateExtra({ cycle_limit: value })
                          }
                          lastInspectionCycles={extras.cycles_last_inspection}
                          onLastInspectionCyclesChange={(value) =>
                            updateExtra({ cycles_last_inspection: value })
                          }
                          interval={String(avionic.inspection_interval ?? "")}
                          onIntervalChange={(value) =>
                            updateAvionic({
                              inspection_interval: value,
                              inspection_interval_unit: "cycle",
                            })
                          }
                        />
                      )}

                      {extras.track_by_calendar && (
                        <CalendarTrackingBlock
                          installedAt={toDateOnly(avionic.installed_at)}
                          onInstalledAtChange={(value) =>
                            updateAvionic({ installed_at: value })
                          }
                          manufactureDate={extras.calendar_manufacture_date}
                          onManufactureDateChange={(value) =>
                            updateExtra({ calendar_manufacture_date: value })
                          }
                          lastInspectionDate={extras.calendar_last_inspection_date}
                          onLastInspectionDateChange={(value) =>
                            updateExtra({ calendar_last_inspection_date: value })
                          }
                          expiryDate={extras.calendar_expiry_date}
                          onExpiryDateChange={(value) =>
                            updateExtra({ calendar_expiry_date: value })
                          }
                          intervalType={extras.calendar_interval_type}
                          onIntervalTypeChange={(value) =>
                            updateExtra({ calendar_interval_type: value })
                          }
                        />
                      )}

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setAvionicsDraft((prev) => removeAt(prev, index));
                            setAvionicsExtras((prev) => removeAt(prev, index));
                          }}
                          className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          Remove Avionics
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {avionicsDraft.map((avionic, index) => (
                  <div
                    key={index}
                    className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                        AVIONICS {index + 1}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <DetailRow
                        label="Avionic Category"
                        value={
                          avionicCategoryMap.get(
                            avionic.avionic_category_id ?? 0,
                          ) ?? "-"
                        }
                      />
                      <DetailRow
                        label="Serial Number"
                        value={avionic.serial_number}
                      />
                      <DetailRow label="Model" value={avionic.model || "-"} />
                      <DetailRow
                        label="Installation Date"
                        value={formatDate(avionic.installed_at)}
                      />
                      <DetailRow
                        label="ATA Chapter"
                        value={ataChapterMap.get(avionic.ata_chapter_id ?? 0) ?? "-"}
                      />
                      <DetailRow
                        label="Manufacturer"
                        value={avionic.manufacturer || "-"}
                      />
                      <DetailRow
                        label="Baseline Hours"
                        value={formatHours(avionic.time_since_new)}
                      />
                      <DetailRow
                        label="Operation Flight Hours"
                        value={formatHours(getOperationFlightHours(avionic))}
                      />
                      <DetailRow
                        label="Current Service Hours"
                        value={formatHours(getCurrentServiceHours(avionic))}
                      />
                      <DetailRow
                        label="Service Life Limit"
                        value={formatHours(avionic.service_life_limit)}
                      />
                      <DetailRow
                        label="Inspection Interval Unit"
                        value={formatStatus(avionic.inspection_interval_unit)}
                      />
                      <DetailRow
                        label="Inspection Interval"
                        value={formatInspectionInterval(
                          avionic.inspection_interval,
                          avionic.inspection_interval_unit,
                        )}
                      />
                      <DetailRow
                        label="Maintenance Strategy"
                        value={formatStatus(avionic.maintenance_strategy)}
                      />
                      <DetailRow
                        label="Removed At"
                        value={formatDate(avionic.removed_at)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "discrepancies" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {defects.length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState message="No discrepancies found." />
              </div>
            ) : (
              defects.map((defect, index) => (
                <div
                  key={defect.id ?? index}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                      Discrepancy {index + 1}
                    </h3>
                    <StatusPill
                      label={formatStatus(defect.status)}
                      tone={
                        defect.status === "resolved"
                          ? "success"
                          : defect.status === "in_progress"
                            ? "warning"
                            : "danger"
                      }
                    />
                  </div>
                  <div className="space-y-4">
                    <DetailRow label="Title" value={defect.title || "-"} />
                    <DetailRow
                      label="Description"
                      value={defect.description || "-"}
                    />
                    <DetailRow
                      label="Severity"
                      value={formatStatus(defect.severity)}
                    />
                    <DetailRow
                      label="Reported At"
                      value={formatDate(defect.reported_at)}
                    />
                    <DetailRow
                      label="Resolved At"
                      value={formatDate(defect.resolved_at)}
                    />
                    <DetailRow label="Remarks" value={defect.remarks || "-"} />
                    <DetailRow
                      label="Operation ID"
                      value={
                        defect.operation_id ? String(defect.operation_id) : "-"
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "operations" && (
          <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-200">
                <thead className="bg-[#001219] text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Purpose</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Start</th>
                    <th className="text-left px-4 py-3 font-medium">End</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {asset.operations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-6 text-center text-gray-400 border-t border-[#0A4D66]/40"
                      >
                        No operations found.
                      </td>
                    </tr>
                  ) : (
                    asset.operations.map((op, index) => (
                      <tr
                        key={index}
                        tabIndex={0}
                        role="button"
                        onClick={(e) =>
                          onInteractiveRowClick(e, () =>
                            navigate(`/dashboard/operations/${op.id}`),
                          )
                        }
                        onKeyDown={(e) =>
                          onInteractiveRowKeyDown(e, () =>
                            navigate(`/dashboard/operations/${op.id}`),
                          )
                        }
                        className={cn(
                          "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors focus:outline-none focus:bg-[#0A4D66]/30",
                          index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                        )}
                      >
                        <td className="px-6 py-3 font-medium text-white">
                          {op.description || op.name}
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {op.operation_type?.name ?? op.name}
                        </td>
                        <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                          {formatDateTime(op.start_date_time)}
                        </td>
                        <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                          {formatDateTime(op.end_date_time)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full",
                                statusDotColor[op.status] || "bg-gray-400",
                              )}
                            />
                            <span className="capitalize">{op.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {op.duration_label}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className="space-y-4">
            {asset.airworthiness && asset.airworthiness.status === "grounded" && (
              <div className="rounded-xl border border-red-500/50 bg-red-950/30 p-5">
                <div className="flex items-center gap-2 text-red-300 text-sm font-bold uppercase">
                  <Icon icon="mdi:alert-octagon-outline" className="h-5 w-5" />
                  Grounded — Not Airworthy
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-red-200 list-disc list-inside">
                  {asset.airworthiness.reasons.map((reason, index) => (
                    <li key={index}>{reason.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Flight Hours
                </h3>
                <button
                  type="button"
                  onClick={() => handleOpenFlightLog()}
                  className="inline-flex items-center gap-1.5 rounded bg-[#0369A1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0369A1]/90"
                >
                  <Icon icon="mdi:airplane-clock" className="h-4 w-4" />
                  Log Flight
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
                <StatCard
                  label="Current Hours"
                  value={`${asset.current_total_hours.toLocaleString()} hrs`}
                />
                <StatCard
                  label="Current Cycles"
                  value={asset.current_total_cycles.toLocaleString()}
                />
                <StatCard
                  label="Current Landings"
                  value={asset.current_total_landings.toLocaleString()}
                />
                <StatCard
                  label="Logged Hours (Manual)"
                  value={`${asset.flight_logs_total_hours.toLocaleString()} hrs`}
                />
              </div>

              {flightLogs.length === 0 ? (
                <EmptyState message="No flight hours logged yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-gray-200">
                    <thead className="bg-[#001219] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Date</th>
                        <th className="text-left px-4 py-3 font-medium">Hours</th>
                        <th className="text-left px-4 py-3 font-medium">Landings</th>
                        <th className="text-left px-4 py-3 font-medium">Cycles</th>
                        <th className="text-left px-4 py-3 font-medium">Logged By</th>
                        <th className="text-left px-4 py-3 font-medium">Remarks</th>
                        <th className="text-left px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flightLogs.slice(0, 10).map((log, index) => (
                        <tr
                          key={log.id}
                          className={cn(
                            "border-t border-[#0A4D66]/40",
                            index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-4 py-3 text-white">
                            {new Date(log.flight_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-white">{log.hours_flown} hrs</td>
                          <td className="px-4 py-3">{log.landings}</td>
                          <td className="px-4 py-3">{log.cycles}</td>
                          <td className="px-4 py-3">
                            {log.created_by_user
                              ? `${log.created_by_user.firstname ?? ""} ${log.created_by_user.lastname ?? ""}`.trim()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                            {log.remarks ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteFlightLog(log.id)}
                              disabled={isDeletingFlightLog}
                              title="Delete flight log"
                              className="text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Work Order Items Status
              </h3>

              {assetWorkOrders.length === 0 ? (
                <EmptyState message="No work order items found for this asset." />
              ) : (
                <div className="space-y-3">
                  {assetWorkOrders.flatMap((order) =>
                    (order.tasks || []).map((task) => {
                      const isCompleted = task.status === "completed";

                      return (
                        <div
                          key={`${order.id}-${task.id}`}
                          className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {task.program?.name || task.description || `Task #${task.id}`}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Work Order #{order.id} | Task #{task.id} | Type: {formatStatus(task.task_type)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusPill
                                label={isCompleted ? "Completed" : "Pending"}
                                tone={isCompleted ? "success" : "warning"}
                              />
                              {!isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkTaskCompleted(task.id)}
                                  disabled={isUpdatingTaskStatus}
                                  className="rounded border border-emerald-400 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/20 transition-colors disabled:opacity-60"
                                >
                                  {isUpdatingTaskStatus ? "Updating..." : "Mark Completed"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              )}
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Compliance History
              </h3>

              {assetComplianceRecords.length === 0 ? (
                <EmptyState message="No compliance history records yet for this asset's work order items." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-gray-200">
                    <thead className="bg-[#001219] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Task</th>
                        <th className="text-left px-4 py-3 font-medium">Completed On</th>
                        <th className="text-left px-4 py-3 font-medium">Next Due Date</th>
                        <th className="text-left px-4 py-3 font-medium">Next Due Hours</th>
                        <th className="text-left px-4 py-3 font-medium">Next Due Cycles</th>
                        <th className="text-left px-4 py-3 font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetComplianceRecords.map((record, index) => (
                        <tr
                          key={record.id}
                          className={cn(
                            "border-t border-[#0A4D66]/40",
                            index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-4 py-3">
                            {record.work_order_task_id ? `Task #${record.work_order_task_id}` : "-"}
                          </td>
                          <td className="px-4 py-3">{formatDateTime(record.completion_date)}</td>
                          <td className="px-4 py-3">{formatDate(record.next_due_date)}</td>
                          <td className="px-4 py-3">{formatHours(record.next_due_hours)}</td>
                          <td className="px-4 py-3">{record.next_due_cycles ?? "-"}</td>
                          <td className="px-4 py-3">{record.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Create Work Orders From Maintenance Programs
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {isLoadingPrograms ? (
                    <span className="text-xs text-gray-400">Loading...</span>
                  ) : null}
                  {/* Interval Hours filter */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Interval:</span>
                    {[null, 10, 50, 100, 150, 200].map((val) => (
                      <button
                        key={val ?? "all"}
                        type="button"
                        onClick={() => handleIntervalFilterChange(val)}
                        className={cn(
                          "rounded px-2 py-1 text-xs transition-colors border",
                          programIntervalFilter === val
                            ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                            : "border-[#0A4D66]/40 text-gray-400 hover:border-[#7FD5FF]/40 hover:text-gray-200",
                        )}
                      >
                        {val == null ? "All" : `${val} hrs`}
                      </button>
                    ))}
                  </div>
                  {/* Applicability filter */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Type:</span>
                    {[null, "component", "engine", "avionics"].map((val) => (
                      <button
                        key={val ?? "all"}
                        type="button"
                        onClick={() => handleApplicabilityFilterChange(val)}
                        className={cn(
                          "rounded px-2 py-1 text-xs transition-colors border capitalize",
                          programApplicabilityFilter === val
                            ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                            : "border-[#0A4D66]/40 text-gray-400 hover:border-[#7FD5FF]/40 hover:text-gray-200",
                        )}
                      >
                        {val == null ? "All" : val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Searchable Maintenance Programs List */}
              <AssetMaintenanceProgramsSearchable
                maintenancePrograms={maintenancePrograms}
                selectedProgramIds={selectedProgramIds}
                handleToggleProgramSelection={handleToggleProgramSelection}
                handleSelectAllPrograms={handleSelectAllPrograms}
                handleDeselectAllPrograms={handleDeselectAllPrograms}
                handleCreateWorkOrder={handleCreateWorkOrder}
                isCreatingWorkOrder={isCreatingWorkOrder}
                navigate={navigate}
              />
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Due Components / Engines / Avionics
              </h3>

              {dueTrackingRows.length === 0 ? (
                <EmptyState message="No components, engines, or avionics are currently due for maintenance." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-gray-200">
                    <thead className="bg-[#001219] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Category</th>
                        <th className="text-left px-4 py-3 font-medium">Item</th>
                        <th className="text-left px-4 py-3 font-medium">Hours Left</th>
                        <th className="text-left px-4 py-3 font-medium">Cycles Left</th>
                        <th className="text-left px-4 py-3 font-medium">Projected Due</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-left px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueTrackingRows.map((row, index) => {
                        const rowKey = `${row.part_type}-${row.part_id}`;
                        const isOverdue = row.status === "overdue";

                        return (
                          <tr
                            key={rowKey}
                            className={cn(
                              "border-t border-[#0A4D66]/40",
                              index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                            )}
                          >
                            <td className="px-4 py-3 capitalize">{row.part_type}</td>
                            <td className="px-4 py-3 text-white font-medium">
                              {row.part_label}
                            </td>
                            <td className="px-4 py-3">
                              {row.hours_remaining === null
                                ? "-"
                                : `${Math.abs(row.hours_remaining).toLocaleString()} hrs`}
                            </td>
                            <td className="px-4 py-3">
                              {row.cycles_remaining === null
                                ? "-"
                                : `${Math.abs(row.cycles_remaining).toLocaleString()} cyc`}
                            </td>
                            <td className="px-4 py-3">
                              {row.projected_due_date
                                ? new Date(row.projected_due_date).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "-"}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill
                                label={isOverdue ? "Overdue" : "Due Soon"}
                                tone={isOverdue ? "danger" : "warning"}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleCreateDueItemWorkOrder(row)}
                                disabled={creatingDueWorkOrderKey === rowKey}
                                className="rounded border border-emerald-400 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/20 transition-colors disabled:opacity-60"
                              >
                                {creatingDueWorkOrderKey === rowKey
                                  ? "Creating..."
                                  : "Create Work Order"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {maintenanceEvents.length === 0 ? (
              <EmptyState message="No maintenance tracking records found." />
            ) : (
              maintenanceEvents.map((event, index) => (
                <div
                  key={event.id ?? index}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[#7FD5FF] text-sm font-bold uppercase">
                        {event.event_type || `Maintenance Event ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {event.description || "No description"}
                      </div>
                    </div>
                    <StatusPill
                      label={formatStatus(event.status)}
                      tone={
                        event.status === "completed"
                          ? "success"
                          : event.status === "ongoing" ||
                              event.status === "active"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <DetailRow
                        label="Started At"
                        value={formatDateTime(event.started_at)}
                      />
                      <DetailRow
                        label="Completed At"
                        value={formatDateTime(event.completed_at)}
                      />
                      <DetailRow
                        label="Hours Logged"
                        value={formatHours(event.hours_logged)}
                      />
                      <DetailRow
                        label="Aircraft Airworthiness"
                        value={formatStatus(event.aircraft_airworthiness)}
                      />
                    </div>
                    <div className="space-y-4">
                      <DetailRow
                        label="Performed By"
                        value={
                          event.performed_by ? String(event.performed_by) : "-"
                        }
                      />
                      <DetailRow
                        label="Component ID"
                        value={
                          event.component_id ? String(event.component_id) : "-"
                        }
                      />
                      <DetailRow label="Remarks" value={event.remarks || "-"} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "after_action_report" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">After Action Report</h3>
              {latestOperation && !latestOperation.afterActionReport && (
                <button
                  onClick={() =>
                    navigate(
                      `/dashboard/assets/${asset.id}/operations/${latestOperation.id}/after-action-report`,
                    )
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#0A4D66] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A4D66]/80 transition-colors"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  Add Action Report
                </button>
              )}
            </div>

            {latestOperation?.afterActionReport ? (
              <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-white space-y-6">
                <div className="flex items-center justify-between border-b border-[#0A4D66]/40 pb-4">
                  <div>
                    <h4 className="text-[#7FD5FF] font-bold uppercase">After Action Report</h4>
                    <p className="text-gray-400 text-xs mt-1">Operation: {latestOperation.name}</p>
                  </div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/40 font-medium">
                    SUBMITTED
                  </span>
                </div>

                {(() => {
                  const report = latestOperation.afterActionReport!;
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Mission:</span>
                          <span className="text-white text-sm font-medium capitalize">{report.mission}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Task No:</span>
                          <span className="text-white text-sm font-medium">{report.task_no}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Date:</span>
                          <span className="text-white text-sm font-medium">{report.report_date || (report as unknown as { created_at?: string })?.created_at?.slice(0, 10) || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Aircraft:</span>
                          <span className="text-white text-sm font-medium">
                            {report.aircraft_formation === "formation"
                              ? "Formation"
                              : report.aircraft_formation === "single_ship"
                              ? "Single Ship"
                              : report.aircraft_formation === "none"
                              ? "None"
                              : report.aircraft_formation || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Unit / Formation:</span>
                          <span className="text-white text-sm font-medium">{report.unit_formation || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Infantry No:</span>
                          <span className="text-white text-sm font-medium">{report.infantry_no ?? "—"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Vehicles:</span>
                          <span className="text-white text-sm font-medium">{report.vehicles_no ?? "—"}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2">
                          <span className="text-[#7FD5FF] text-sm">Ammo Spent:</span>
                          <span className="text-white text-sm font-medium">{report.ammo_spent || "—"}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-[#7FD5FF] text-sm font-medium">Activities</h5>
                        <p className="text-gray-300 text-sm bg-[#001825] p-3 rounded border border-[#0A4D66]/30">
                          {report.activities}
                        </p>
                      </div>

                      {report.contacts && report.contacts.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-[#0A4D66]/40">
                          <h5 className="text-[#7FD5FF] text-sm font-bold uppercase">
                            Enemy Contacts ({report.contacts.length})
                          </h5>
                          <div className="grid grid-cols-1 gap-4">
                            {report.contacts.map((contact, idx) => (
                              <div
                                key={idx}
                                className="bg-[#001825] p-4 rounded border border-[#0A4D66]/30 text-sm space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white capitalize">
                                    {contact.engagement.replace(/_/g, " ")}
                                  </span>
                                  <div className="flex gap-4 text-gray-400 text-xs">
                                    <span>{contact.time_of_contact}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-gray-300 text-xs">
                                  <span><span className="text-gray-500">Location:</span> {contact.location}</span>
                                  <span><span className="text-gray-500">Enemy Infantry:</span> {contact.enemy_infantry_no}</span>
                                  <span><span className="text-gray-500">Enemy Vehicles:</span> {contact.enemy_vehicle_no}</span>
                                  <span><span className="text-gray-500">Targets Infantry:</span> {contact.targets_infantry_no}</span>
                                  <span><span className="text-gray-500">Targets Vehicles:</span> {contact.targets_vehicle_no}</span>
                                </div>
                                {contact.enemy_resources_description && (
                                  <div className="text-xs mt-1">
                                    <span className="text-gray-500">Enemy Resources: </span>
                                    <span className="text-gray-300">{contact.enemy_resources_description}</span>
                                  </div>
                                )}
                                {contact.targets_treated_description && (
                                  <div className="text-xs mt-1">
                                    <span className="text-gray-500">Targets Treated: </span>
                                    <span className="text-gray-300">{contact.targets_treated_description}</span>
                                  </div>
                                )}
                                {contact.damage_received && (
                                  <div className="text-xs mt-1">
                                    <span className="text-gray-500">Damage Received: </span>
                                    <span className="text-gray-300">{contact.damage_received}</span>
                                  </div>
                                )}
                                {contact.photos && contact.photos.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-gray-500 text-xs mb-1">Photos ({contact.photos.length})</p>
                                    <div className="flex flex-wrap gap-2">
                                      {contact.photos.map((photo, pIdx) => (
                                        <img
                                          key={pIdx}
                                          src={photo.file}
                                          alt={`Contact ${idx + 1} photo ${pIdx + 1}`}
                                          className="w-20 h-20 object-cover rounded border border-[#0A4D66]/40"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.resource_utilizations && report.resource_utilizations.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-[#0A4D66]/40">
                          <h5 className="text-[#7FD5FF] text-sm font-bold uppercase">
                            Resource Utilization ({report.resource_utilizations.length})
                          </h5>
                          <div className="overflow-x-auto rounded border border-[#0A4D66]/30">
                            <table className="w-full text-sm text-gray-300">
                              <thead>
                                <tr className="bg-[#0A4D66]/20 border-b border-[#0A4D66]/30">
                                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Item</th>
                                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Qty Used</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.resource_utilizations.map((res, idx) => (
                                  <tr key={idx} className="border-b border-[#0A4D66]/20 last:border-0">
                                    <td className="px-4 py-2">{res.item_description}</td>
                                    <td className="px-4 py-2 text-right">{res.quantity_used}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-center">
                <Icon icon="mdi:file-remove-outline" className="w-10 h-10 text-gray-400" />
                <p className="text-white text-sm font-medium">No report submitted</p>
                <p className="text-gray-400 text-xs">
                  {!latestOperation
                    ? "No operation is available yet to submit an after action report."
                    : "No after action report has been submitted for the latest operation."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ImportCsvModal
        open={isImportOpen}
        title={
          activeTab === "engines"
            ? "Import Engines from CSV"
            : activeTab === "avionics"
              ? "Import Avionics from CSV"
              : "Import Components from CSV"
        }
        fields={
          activeTab === "engines"
            ? ENGINE_IMPORT_FIELDS
            : activeTab === "avionics"
              ? AVIONICS_IMPORT_FIELDS
              : COMPONENT_IMPORT_FIELDS
        }
        sampleFileName={
          activeTab === "engines"
            ? "engines-import-sample.csv"
            : activeTab === "avionics"
              ? "avionics-import-sample.csv"
              : "components-import-sample.csv"
        }
        onImportRow={
          activeTab === "engines"
            ? handleImportEngineRow
            : activeTab === "avionics"
              ? handleImportAvionicRow
              : handleImportComponentRow
        }
        onClose={() => setIsImportOpen(false)}
      />

      {asset && (
        <FlightLogModal
          open={showFlightLogModal}
          onClose={() => {
            setShowFlightLogModal(false);
            setFlightLogInitialValues(undefined);
          }}
          assetId={asset.id}
          assetName={asset.name}
          initialValues={flightLogInitialValues}
        />
      )}
    </div>
  );
};

const StatCard = ({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) => {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 text-left w-full hover:border-[#7FD5FF]/50 transition-colors"
      >
        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center justify-between">
          {label}
          <Icon icon="mdi:arrow-top-right" className="w-3 h-3 text-[#7FD5FF]/40 group-hover:text-[#7FD5FF] transition-colors" />
        </div>
        <div className="text-xl font-bold text-white">{value}</div>
      </button>
    );
  }
  return (
    <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
      <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">
        {label}
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2 last:border-0 last:pb-0">
    <span className="text-[#7FD5FF] text-sm">{label}:</span>
    <span className="text-white text-sm font-medium">{value}</span>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 text-center text-gray-400">
    {message}
  </div>
);

const StatusPill = ({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
      tone === "success" && "bg-emerald-500/10 text-emerald-300",
      tone === "warning" && "bg-amber-500/10 text-amber-300",
      tone === "danger" && "bg-red-500/10 text-red-300",
      tone === "neutral" && "bg-gray-500/10 text-gray-300",
    )}
  >
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        tone === "success" && "bg-emerald-400",
        tone === "warning" && "bg-amber-400",
        tone === "danger" && "bg-red-400",
        tone === "neutral" && "bg-gray-400",
      )}
    />
    {label}
  </span>
);

// ---------------------------------------------------------------------------
// Track By / Hours / Cycles / Calendar editors - visual + behavioral copies of
// the equivalent blocks in AddAssetPage.tsx's Add form. See the comment above
// the TrackingExtras type for why these fields are cosmetic-only.
// ---------------------------------------------------------------------------

// Matches the flat "Airframe Component" tab's Track By row in AddAssetPage.tsx.
const TrackByToggleInline = ({
  trackBy,
  calendarOn,
  onHours,
  onCycles,
  onCalendar,
}: {
  trackBy: TrackByKey;
  calendarOn: boolean;
  onHours: () => void;
  onCycles: () => void;
  onCalendar: () => void;
}) => (
  <div className="flex items-center gap-4 text-xs text-gray-300 mb-4">
    <span className="text-xs font-semibold text-white">Track By</span>
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={trackBy === "hours" || trackBy === "both"}
        onChange={onHours}
        className="h-4 w-4 rounded border-gray-500 text-[#7FD5FF] focus:ring-[#7FD5FF]"
      />
      <span className="text-gray-300">Hours</span>
    </label>
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={trackBy === "cycles" || trackBy === "both"}
        onChange={onCycles}
        className="h-4 w-4 rounded border-gray-500 text-[#7FD5FF] focus:ring-[#7FD5FF]"
      />
      <span className="text-gray-300">Cycles</span>
    </label>
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={calendarOn}
        onChange={onCalendar}
        className="h-4 w-4 rounded border-gray-500 text-[#7FD5FF] focus:ring-[#7FD5FF]"
      />
      <span className="text-gray-300">Calendar</span>
    </label>
  </div>
);

// Matches the Engine / Engine Component / Avionics Track By block in AddAssetPage.tsx.
const TrackByToggleBlock = ({
  trackBy,
  calendarOn,
  onHours,
  onCycles,
  onCalendar,
}: {
  trackBy: TrackByKey;
  calendarOn: boolean;
  onHours: () => void;
  onCycles: () => void;
  onCalendar: () => void;
}) => (
  <div className="mb-4">
    <label className="text-xs text-gray-400 mb-2 block">Track By</label>
    <div className="flex gap-4">
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={trackBy === "hours" || trackBy === "both"}
          onChange={onHours}
          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
        />
        Hours
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={trackBy === "cycles" || trackBy === "both"}
          onChange={onCycles}
          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
        />
        Cycles
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={calendarOn}
          onChange={onCalendar}
          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
        />
        Calendar
      </label>
    </div>
  </div>
);

// Matches the "Total Service Hrs / Service Life Limit / Life Remaining / Last
// Inspection Reading / Inspection Interval / Next Due" hours grid used by the
// Engine, Engine Component, and Avionics blocks in AddAssetPage.tsx.
const HoursTrackingGrid = ({
  totalHours,
  onTotalHoursChange,
  lifeLimit,
  onLifeLimitChange,
  lastInspectionReading,
  onLastInspectionReadingChange,
  interval,
  onIntervalChange,
}: {
  totalHours: string;
  onTotalHoursChange: (value: string) => void;
  lifeLimit: string;
  onLifeLimitChange: (value: string) => void;
  lastInspectionReading: string;
  onLastInspectionReadingChange: (value: string) => void;
  interval: string;
  onIntervalChange: (value: string) => void;
}) => {
  const remaining = computeHoursRemainingLabel(totalHours, lifeLimit, "hrs");
  const due = computeNextDueDeltaStyle(lastInspectionReading, interval, "hrs");

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Total Service Hrs</label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Hrs"
          value={totalHours}
          onChange={(e) => onTotalHoursChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Service Life Limit hrs</label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Hrs"
          value={lifeLimit}
          onChange={(e) => onLifeLimitChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Life Remaining</label>
        <div className="text-2xl font-bold text-white">{remaining}</div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Last Inspection Reading hrs</label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Hrs"
          value={lastInspectionReading}
          onChange={(e) => onLastInspectionReadingChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Inspection Interval</label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Hrs"
          value={interval}
          onChange={(e) => onIntervalChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">{due.label}</label>
        <div className="text-2xl font-bold text-white">{due.value}</div>
      </div>
    </div>
  );
};

// Matches the "Total Cycles / Cycle Limit / Life Remaining / Last Inspection
// Cycles Reference / Inspection Interval / Next Due" cycles grid used by the
// Engine, Engine Component, and Avionics blocks in AddAssetPage.tsx.
const CyclesTrackingGrid = ({
  totalCycles,
  onTotalCyclesChange,
  cycleLimit,
  onCycleLimitChange,
  lastInspectionCycles,
  onLastInspectionCyclesChange,
  interval,
  onIntervalChange,
}: {
  totalCycles: string;
  onTotalCyclesChange: (value: string) => void;
  cycleLimit: string;
  onCycleLimitChange: (value: string) => void;
  lastInspectionCycles: string;
  onLastInspectionCyclesChange: (value: string) => void;
  interval: string;
  onIntervalChange: (value: string) => void;
}) => {
  const remaining = computeHoursRemainingLabel(totalCycles, cycleLimit, "Cyc");
  const due = computeNextDueDeltaStyle(lastInspectionCycles, interval, "Cyc");

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Total Cycles</label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Cyc"
          value={totalCycles}
          onChange={(e) => onTotalCyclesChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Cycle Limit</label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Cyc"
          value={cycleLimit}
          onChange={(e) => onCycleLimitChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Life Remaining</label>
        <div className="text-2xl font-bold text-white">{remaining}</div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">
          Last Inspection Cycles Reference
        </label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Cyc"
          value={lastInspectionCycles}
          onChange={(e) => onLastInspectionCyclesChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Inspection Interval</label>
        <input
          type="number"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          placeholder="Enter Cyc"
          value={interval}
          onChange={(e) => onIntervalChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">{due.label}</label>
        <div className="text-2xl font-bold text-white">{due.value}</div>
      </div>
    </div>
  );
};

// Matches the calendar-tracking block (installation/manufacture/last
// inspection/expiry dates + interval type + computed due readout) used by
// every trackable section in AddAssetPage.tsx.
const CalendarTrackingBlock = ({
  installedAt,
  onInstalledAtChange,
  manufactureDate,
  onManufactureDateChange,
  lastInspectionDate,
  onLastInspectionDateChange,
  expiryDate,
  onExpiryDateChange,
  intervalType,
  onIntervalTypeChange,
}: {
  installedAt: string;
  onInstalledAtChange: (value: string) => void;
  manufactureDate: string;
  onManufactureDateChange: (value: string) => void;
  lastInspectionDate: string;
  onLastInspectionDateChange: (value: string) => void;
  expiryDate: string;
  onExpiryDateChange: (value: string) => void;
  intervalType: CalendarIntervalType;
  onIntervalTypeChange: (value: CalendarIntervalType) => void;
}) => {
  const due = computeCalendarDue(lastInspectionDate, intervalType);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Installation Date</label>
        <input
          type="date"
          title="Calendar Installation Date"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
          value={installedAt}
          onChange={(e) => onInstalledAtChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Manufacture Date</label>
        <input
          type="date"
          title="Calendar Manufacture Date"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
          value={manufactureDate}
          onChange={(e) => onManufactureDateChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Last Inspection Date</label>
        <input
          type="date"
          title="Calendar Last Inspection Date"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
          value={lastInspectionDate}
          onChange={(e) => onLastInspectionDateChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Expiry Date</label>
        <input
          type="date"
          title="Calendar Expiry Date"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
          value={expiryDate}
          onChange={(e) => onExpiryDateChange(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Tracking Interval Type</label>
        <select
          title="Calendar Interval Type"
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          value={intervalType}
          onChange={(e) =>
            onIntervalTypeChange(e.target.value as CalendarIntervalType)
          }
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      {due && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Next Inspection Due Date</label>
            <div className="text-lg font-bold text-white">{due.nextLabel}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">{due.statusLabel}</label>
            <div className={`text-2xl font-bold ${due.statusClassName}`}>
              {due.statusValue}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
