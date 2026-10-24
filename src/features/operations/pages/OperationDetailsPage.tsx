import { useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ApprovalPanel } from "@/features/approvals/components/ApprovalPanel";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import { useTheme } from "@/context/ThemeContext";
import {
  useDeleteOperationMutation,
  useGetOperationByIdQuery,
  useGetOperationTelemetryQuery,
  useLogOperationFlightHoursMutation,
  useUpdateOperationMutation,
  useUpdateOperationStatusMutation,
  type Operation,
  type OperationAssignedAsset,
} from "../api";
import { OperationLocationPicker } from "../components/OperationLocationPicker";
import { WeatherBriefingCard } from "../components/WeatherBriefingCard";
import { MissionPlanningCard } from "../components/MissionPlanningCard";
import { SatelliteCommsCard } from "../components/SatelliteCommsCard";
import { AARSignatureTable } from "../components/AARSignatureTable";
import Modal from "@/shared/ui/modal/Modal";
import { AppTabs } from "@/shared/ui/tabs/AppTabs";
import { BackButton } from "@/shared/ui/button";

const InfoRow = ({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) => {
  const { isDark } = useTheme();
  return (
    <div
      className={cn(
        "flex items-baseline py-2.5 border-b last:border-0 text-xs transition-colors",
        isDark ? "border-[#0A4D66]/25" : "border-slate-100",
        className,
      )}
    >
      <span className={cn("w-1/3 font-semibold uppercase tracking-wider text-[11px]", isDark ? "text-sky-400" : "text-sky-800")}>
        {label}:
      </span>
      <span className={cn("w-2/3 font-medium", isDark ? "text-slate-100" : "text-slate-900")}>
        {value}
      </span>
    </div>
  );
};

const getPersonName = (person: unknown) => {
  if (!person || typeof person !== "object") return "N/A";
  const record = person as Record<string, unknown>;
  const rank =
    record.rank && typeof record.rank === "object"
      ? ((record.rank as Record<string, unknown>).name as string | undefined)
      : undefined;
  const firstName =
    typeof record.firstname === "string" ? record.firstname : "";
  const lastName = typeof record.lastname === "string" ? record.lastname : "";
  const otherNames =
    typeof record.othernames === "string" ? record.othernames : "";
  const callSign =
    typeof record.call_sign === "string" && record.call_sign.trim()
      ? record.call_sign.trim()
      : null;
  const fullName = `${firstName} ${lastName} ${otherNames}`.trim();
  if (!fullName) return "N/A";
  const base = rank ? `${rank} ${fullName}` : fullName;
  return callSign ? `${base} (${callSign})` : base;
};

const getPersonId = (person: unknown): number | null => {
  if (!person || typeof person !== "object") return null;
  const id = (person as Record<string, unknown>).id;
  return typeof id === "number" ? id : null;
};

const PersonLink = ({
  person,
  onNavigate,
}: {
  person: unknown;
  onNavigate: (id: number) => void;
}) => {
  const { isDark } = useTheme();
  const name = getPersonName(person);
  const id = getPersonId(person);
  if (!id || name === "N/A") {
    return <>{name}</>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(id);
      }}
      className={cn(
        "text-left font-semibold hover:underline transition-colors",
        isDark ? "text-sky-400 hover:text-sky-300" : "text-sky-700 hover:text-sky-800"
      )}
    >
      {name}
    </button>
  );
};

const formatLoggedAt = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AssetCard = ({
  entry,
  index,
  navigate,
  operationId,
}: {
  entry: OperationAssignedAsset;
  index: number;
  navigate: (path: string, options?: { state?: unknown }) => void;
  operationId: number | string;
}) => {
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const [logFlightHours, { isLoading: isLogging }] =
    useLogOperationFlightHoursMutation();
  const [showLogModal, setShowLogModal] = useState(false);
  const [draft, setDraft] = useState({ flight_hours: "", landing: "", cycle: "" });

  const baseAsset = (
    entry.asset && typeof entry.asset === "object"
      ? entry.asset
      : (entry as unknown as Record<string, unknown>)
  ) as Record<string, unknown>;
  const lastDefect =
    baseAsset.last_defect && typeof baseAsset.last_defect === "object"
      ? (baseAsset.last_defect as Record<string, unknown>)
      : null;

  const assetName =
    (typeof baseAsset.name === "string" && baseAsset.name) ||
    (entry.asset_id ? `Asset #${entry.asset_id}` : `Asset ${index + 1}`);
  const tailNumber =
    (typeof baseAsset.tail_number === "string" && baseAsset.tail_number) ||
    "N/A";
  const flightHoursValue =
    entry.actual_flight_hours !== null && entry.actual_flight_hours !== undefined
      ? Number(entry.actual_flight_hours)
      : entry.flight_hours !== null && entry.flight_hours !== undefined
        ? Number(entry.flight_hours)
        : null;
  const totalHours =
    baseAsset.operations_total_hours_label ??
    baseAsset.total_airframe_hours ??
    baseAsset.total_flight_hours ??
    baseAsset.total_hours ??
    "N/A";
  const nextInspection =
    baseAsset.next_type_of_inspection && baseAsset.next_annual_inspection_date
      ? `${String(baseAsset.next_type_of_inspection)} (${String(baseAsset.next_annual_inspection_date).slice(0, 10)})`
      : (baseAsset.next_annual_inspection_date ??
        baseAsset.next_inspection_date ??
        baseAsset.next_inspection ??
        "N/A");
  const lastSnag =
    baseAsset.last_snag ??
    lastDefect?.title ??
    lastDefect?.description ??
    "N/A";
  const totalLandings = baseAsset.landings ?? baseAsset.total_landings ?? "N/A";
  const serviceability =
    baseAsset.serviceability_status ?? baseAsset.operation_status ?? "N/A";
  const pilotDetails =
    baseAsset.pilot_details && typeof baseAsset.pilot_details === "object"
      ? (baseAsset.pilot_details as Record<string, unknown>)
      : entry.pilot;
  const coPilotDetails =
    baseAsset.co_pilot_details && typeof baseAsset.co_pilot_details === "object"
      ? (baseAsset.co_pilot_details as Record<string, unknown>)
      : entry.co_pilot;

  const assetIdValue =
    (typeof baseAsset.id === "number" ? baseAsset.id : null) ??
    entry.asset_id ??
    null;
  const goToAsset = () => {
    if (assetIdValue) {
      navigate(`/dashboard/assets/${assetIdValue}`, {
        state: {
          from: `/dashboard/operations/${operationId}`,
          fromLabel: "Operation",
        },
      });
    }
  };
  const goToPerson = (personId: number) => {
    navigate(`/dashboard/personnel/${personId}`, {
      state: {
        from: `/dashboard/operations/${operationId}`,
        fromLabel: "Operation",
      },
    });
  };

  const cardKey =
    entry.id ??
    (typeof baseAsset.id === "number"
      ? baseAsset.id
      : `${entry.asset_id ?? "asset"}-${index}`);

  const cardContent = (
    <>
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", isDark ? "text-sky-400" : "text-sky-800")}>
          {assetIdValue ? "Click to view asset dossier" : "Assigned Airframe"}
        </span>
        {assetIdValue ? (
          <Icon icon="mdi:arrow-top-right" className="w-4 h-4 text-sky-500" />
        ) : null}
      </div>
      <InfoRow label="Name" value={assetName} />
      <InfoRow label="Tail Number" value={String(tailNumber)} />
      <InfoRow label="Serviceability" value={String(serviceability)} />
      <InfoRow label="Total Hours" value={String(totalHours)} />
      <InfoRow label="Next Inspection" value={String(nextInspection)} />
      <InfoRow label="Last Snag" value={String(lastSnag)} />
      <InfoRow label="Total Landings" value={String(totalLandings)} />
      {entry.departure_takeoff ? (
        <InfoRow
          label="Departure Takeoff"
          value={String(entry.departure_takeoff)}
        />
      ) : null}
      {entry.estimated_flight_hours !== null &&
      entry.estimated_flight_hours !== undefined ? (
        <>
          <InfoRow
            label="Estimated Flight Time"
            value={
              entry.estimated_flight_time_label ||
              `${entry.estimated_flight_hours} hrs`
            }
          />
          {entry.estimated_distance_nm !== null &&
          entry.estimated_distance_nm !== undefined ? (
            <InfoRow
              label="Distance"
              value={`${entry.estimated_distance_nm} nm`}
            />
          ) : null}
          {entry.estimated_end_time ? (
            <InfoRow
              label="Est. End Time"
              value={String(entry.estimated_end_time)}
            />
          ) : null}
        </>
      ) : null}
      {entry.actual_flight_hours !== null &&
      entry.actual_flight_hours !== undefined ? (
        <InfoRow
          label="Actual Flight Hours"
          value={
            entry.actual_flight_time_label || `${entry.actual_flight_hours} hrs`
          }
        />
      ) : null}
      {(entry.actual_landing !== null && entry.actual_landing !== undefined) ||
      (entry.landing !== null && entry.landing !== undefined) ? (
        <InfoRow
          label="Landing"
          value={String(entry.actual_landing ?? entry.landing ?? "N/A")}
        />
      ) : null}
      {(entry.actual_cycle !== null && entry.actual_cycle !== undefined) ||
      (entry.cycle !== null && entry.cycle !== undefined) ? (
        <InfoRow
          label="Cycle"
          value={String(entry.actual_cycle ?? entry.cycle ?? "N/A")}
        />
      ) : null}
      <InfoRow
        label="Pilot In Command"
        value={<PersonLink person={pilotDetails} onNavigate={goToPerson} />}
      />
      <InfoRow
        label="Co-Pilot"
        value={<PersonLink person={coPilotDetails} onNavigate={goToPerson} />}
      />
      {assetIdValue ? (
        <div className={cn("pt-3 mt-1 border-t", isDark ? "border-[#0A4D66]/30" : "border-slate-100")}>
          {entry.logged_to_asset_at ? (
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium">
              <Icon icon="mdi:check-decagram-outline" className="w-4 h-4" />
              Flight hours logged to asset on {formatLoggedAt(entry.logged_to_asset_at)}
            </div>
          ) : flightHoursValue !== null ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDraft({
                  flight_hours: String(flightHoursValue),
                  landing: String(entry.actual_landing ?? entry.landing ?? ""),
                  cycle: String(entry.actual_cycle ?? entry.cycle ?? ""),
                });
                setShowLogModal(true);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs",
                isDark
                  ? "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                  : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
              )}
            >
              <Icon icon="mdi:clipboard-check-outline" className="w-3.5 h-3.5 text-sky-500" />
              Log Flight Hours to Asset
            </button>
          ) : (
            <span className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
              No flight hours recorded for this aircraft yet.
            </span>
          )}
        </div>
      ) : null}
    </>
  );

  const handleConfirmLog = async () => {
    if (!assetIdValue) return;

    const hours = Number(draft.flight_hours);
    if (!draft.flight_hours || Number.isNaN(hours) || hours <= 0) {
      dispatch(
        showToast({ message: "Enter a valid flight hours value.", type: "error" }),
      );
      return;
    }

    try {
      await logFlightHours({
        operation_id: operationId,
        asset_id: assetIdValue,
        flight_hours: hours,
        landing: draft.landing ? Number(draft.landing) : null,
        cycle: draft.cycle ? Number(draft.cycle) : null,
      }).unwrap();

      dispatch(
        showToast({
          message: `${hours} flight hour(s) logged to ${assetName}.`,
          type: "success",
        }),
      );
      setShowLogModal(false);
    } catch (error) {
      const err = error as { data?: { message?: string } };
      dispatch(
        showToast({
          message: err?.data?.message || "Failed to log flight hours. Please try again.",
          type: "error",
        }),
      );
    }
  };

  return (
    <>
      <div
        key={cardKey}
        onClick={assetIdValue ? goToAsset : undefined}
        role={assetIdValue ? "button" : undefined}
        tabIndex={assetIdValue ? 0 : undefined}
        onKeyDown={
          assetIdValue
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") goToAsset();
              }
            : undefined
        }
        className={cn(
          "rounded-2xl border p-4 transition-all duration-200 shadow-xs",
          isDark
            ? "border-[#0A4D66]/40 bg-[#001825]/90 hover:border-[#0A4D66]/80"
            : "border-slate-200 bg-white hover:border-slate-300",
          assetIdValue && "cursor-pointer",
        )}
      >
        {cardContent}
      </div>

      <Modal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        title={`Log Flight Hours — ${assetName}`}
      >
        <div className="space-y-4">
          <p className={cn("text-xs leading-relaxed", isDark ? "text-slate-400" : "text-slate-600")}>
            Confirm the values to log to this aircraft's permanent flight record. You
            can adjust them before submitting — this can only be done once per
            aircraft per operation.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <label className={cn("flex flex-col gap-1 text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
              Flight Hours
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={draft.flight_hours}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, flight_hours: e.target.value }))
                }
                className={cn(
                  "rounded-xl border p-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                  isDark
                    ? "border-[#0A4D66]/50 bg-[#001825] text-white"
                    : "border-slate-300 bg-slate-50 text-slate-800"
                )}
              />
            </label>
            <label className={cn("flex flex-col gap-1 text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
              Landings
              <input
                type="number"
                min="0"
                value={draft.landing}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, landing: e.target.value }))
                }
                className={cn(
                  "rounded-xl border p-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                  isDark
                    ? "border-[#0A4D66]/50 bg-[#001825] text-white"
                    : "border-slate-300 bg-slate-50 text-slate-800"
                )}
              />
            </label>
            <label className={cn("flex flex-col gap-1 text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
              Cycles
              <input
                type="number"
                min="0"
                value={draft.cycle}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, cycle: e.target.value }))
                }
                className={cn(
                  "rounded-xl border p-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                  isDark
                    ? "border-[#0A4D66]/50 bg-[#001825] text-white"
                    : "border-slate-300 bg-slate-50 text-slate-800"
                )}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowLogModal(false)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-semibold border transition-all",
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLog}
              disabled={isLogging}
              className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all"
            >
              {isLogging ? "Logging..." : "Confirm & Log"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const extractDatePart = (value?: string | null) => {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value.slice(0, 10);
};

const extractTimePart = (value?: string | null) => {
  if (!value) return "00:00";
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "00:00";
};

type DateTimeDraft = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

const OperationTab = ({
  operation,
  navigate,
  onUpdateDateTime,
  isSavingDateTime,
  telemetryTracks = [],
  liveAircraftPositions = [],
}: {
  operation: Operation;
  navigate: (path: string) => void;
  onUpdateDateTime: (payload: {
    start_date_time?: string;
    end_date_time?: string;
  }) => Promise<void>;
  isSavingDateTime: boolean;
  telemetryTracks?: Array<{
    latitude: number;
    longitude: number;
    altitude?: number | null;
    recorded_at?: string;
  }>;
  liveAircraftPositions?: Array<{
    asset_id?: number;
    asset_name?: string;
    call_sign?: string;
    imei?: string;
    latitude: number;
    longitude: number;
    altitude?: number | null;
    speed?: number | null;
    course?: number | null;
    battery_level?: number | null;
    recorded_at?: string;
    is_sos?: boolean;
  }>;
}) => {
  const { isDark } = useTheme();
  const [editDates, setEditDates] = useState<DateTimeDraft | null>(null);

  if (!operation) return null;

  const startEditingDates = () => {
    setEditDates({
      startDate: extractDatePart(operation.start_date_time),
      startTime: extractTimePart(operation.start_date_time),
      endDate: extractDatePart(operation.end_date_time),
      endTime: extractTimePart(operation.end_date_time),
    });
  };

  const cancelEditingDates = () => setEditDates(null);

  const saveDates = async () => {
    if (!editDates) return;
    const startDateTime = editDates.startDate
      ? `${editDates.startDate}T${editDates.startTime}:00`
      : undefined;
    const endDateTime = editDates.endDate
      ? `${editDates.endDate}T${editDates.endTime}:00`
      : undefined;
    await onUpdateDateTime({
      start_date_time: startDateTime,
      end_date_time: endDateTime,
    });
    setEditDates(null);
  };

  const departureLabel =
    operation.departure_location ||
    (operation.departure_latitude !== undefined &&
    operation.departure_latitude !== null &&
    operation.departure_longitude !== undefined &&
    operation.departure_longitude !== null
      ? `${Number(operation.departure_latitude).toFixed(6)}, ${Number(operation.departure_longitude).toFixed(6)}`
      : "N/A");
  const arrivalLabel =
    operation.arrival_location ||
    (operation.arrival_latitude !== undefined &&
    operation.arrival_latitude !== null &&
    operation.arrival_longitude !== undefined &&
    operation.arrival_longitude !== null
      ? `${Number(operation.arrival_latitude).toFixed(6)}, ${Number(operation.arrival_longitude).toFixed(6)}`
      : "N/A");

  const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return value.slice(0, 10);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  };

  const isOngoing = operation.status === "ongoing";
  const isCompleted = operation.status === "completed";
  const isAborted = operation.status === "aborted";

  return (
    <div className="space-y-6">
      {/* 4-Column Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mission Type */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Mission Profile
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Icon icon="mdi:target" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={cn("text-base font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              {operation.operation_category?.name || "General Mission"}
            </div>
            <div className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
              {operation.operation_type?.name || "Tactical Air Sortie"}
            </div>
          </div>
        </div>

        {/* Operating Unit */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Tasked Unit
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Icon icon="mdi:shield-account" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={cn("text-base font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              {operation.unit?.name || "Unassigned"}
            </div>
            <div className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
              {operation.name || "Regional Theater"}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Schedule Window
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Icon icon="mdi:calendar-range" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={cn("text-base font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              {formatDate(operation.start_date_time)}
            </div>
            <div className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
              {operation.duration_label || "Scheduled sortie"}
            </div>
          </div>
        </div>

        {/* Operational Status */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Operation Status
            </span>
            <div className={cn(
              "p-2 rounded-xl",
              isCompleted
                ? "bg-emerald-500/10 text-emerald-400"
                : isOngoing
                ? "bg-amber-500/10 text-amber-400"
                : isAborted
                ? "bg-red-500/10 text-red-400"
                : "bg-sky-500/10 text-sky-400"
            )}>
              <Icon icon="mdi:radar" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border",
              isCompleted
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : isOngoing
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : isAborted
                ? "bg-red-500/10 text-red-400 border-red-500/30"
                : "bg-sky-500/10 text-sky-400 border-sky-500/30"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isCompleted ? "bg-emerald-400" : isOngoing ? "bg-amber-400 animate-pulse" : isAborted ? "bg-red-400" : "bg-sky-400"
              )} />
              <span className="capitalize">{operation.status || "Planned"}</span>
            </span>
            <span className={cn(
              "text-[11px] font-bold uppercase px-2 py-0.5 rounded border",
              operation.priority === "high"
                ? "bg-red-500/10 text-red-400 border-red-500/30"
                : operation.priority === "medium"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-slate-500/10 text-slate-400 border-slate-500/30"
            )}>
              {operation.priority || "Normal"} Priority
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mission Dossier Card */}
        <div className={cn(
          "rounded-2xl border p-6 transition-all shadow-sm",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="mdi:clipboard-text-outline" className="w-5 h-5 text-sky-500" />
            <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
              Operation Dossier
            </h3>
          </div>

          <InfoRow
            label="Operation Name"
            value={operation.operation_category?.name || "N/A"}
          />
          <InfoRow
            label="Region / Theater"
            value={operation.name || "N/A"}
          />
          <InfoRow
            label="Sortie Type"
            value={operation.operation_type?.name || "N/A"}
          />
          <InfoRow
            label="Assigned Unit"
            value={
              operation.unit?.id ? (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/units/${operation.unit.id}`)}
                  className={cn(
                    "text-left font-bold hover:underline transition-colors",
                    isDark ? "text-sky-400 hover:text-sky-300" : "text-sky-700 hover:text-sky-800"
                  )}
                >
                  {operation.unit.name}
                </button>
              ) : (
                operation.unit?.name || "N/A"
              )
            }
          />

          <div className={cn("flex flex-col gap-2 py-2.5 border-b text-xs transition-colors", isDark ? "border-[#0A4D66]/25" : "border-slate-100")}>
            <div className="flex items-center justify-between">
              <span className={cn("font-semibold uppercase tracking-wider text-[11px]", isDark ? "text-sky-400" : "text-sky-800")}>
                Mission Window{operation.end_date_time ? " / End Date" : ""}:
              </span>
              {!editDates ? (
                <button
                  type="button"
                  onClick={startEditingDates}
                  title="Edit operation dates"
                  className={cn(
                    "p-1 rounded-lg border transition-all text-xs font-medium inline-flex items-center gap-1",
                    isDark
                      ? "border-[#0A4D66]/40 bg-[#001825] text-slate-300 hover:text-sky-400 hover:border-sky-500/50"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:text-sky-600 hover:border-slate-300"
                  )}
                >
                  <Icon icon="mdi:pencil-outline" className="w-3.5 h-3.5" />
                  <span>Edit Schedule</span>
                </button>
              ) : null}
            </div>

            {editDates ? (
              <div className={cn("p-4 rounded-xl border mt-2 space-y-3", isDark ? "border-[#0A4D66]/40 bg-[#001825]/60" : "border-slate-200 bg-slate-50")}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className={cn("text-[11px] font-semibold", isDark ? "text-slate-400" : "text-slate-600")}>Start Date</label>
                    <input
                      type="date"
                      value={editDates.startDate}
                      onChange={(e) =>
                        setEditDates((prev) => prev && { ...prev, startDate: e.target.value })
                      }
                      className={cn(
                        "rounded-xl border p-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                        isDark ? "bg-[#001219] border-[#0A4D66]/50 text-white" : "bg-white border-slate-300 text-slate-800"
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={cn("text-[11px] font-semibold", isDark ? "text-slate-400" : "text-slate-600")}>Start Time</label>
                    <input
                      type="time"
                      value={editDates.startTime}
                      onChange={(e) =>
                        setEditDates((prev) => prev && { ...prev, startTime: e.target.value })
                      }
                      className={cn(
                        "rounded-xl border p-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                        isDark ? "bg-[#001219] border-[#0A4D66]/50 text-white" : "bg-white border-slate-300 text-slate-800"
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={cn("text-[11px] font-semibold", isDark ? "text-slate-400" : "text-slate-600")}>End Date</label>
                    <input
                      type="date"
                      value={editDates.endDate}
                      onChange={(e) =>
                        setEditDates((prev) => prev && { ...prev, endDate: e.target.value })
                      }
                      className={cn(
                        "rounded-xl border p-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                        isDark ? "bg-[#001219] border-[#0A4D66]/50 text-white" : "bg-white border-slate-300 text-slate-800"
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={cn("text-[11px] font-semibold", isDark ? "text-slate-400" : "text-slate-600")}>End Time</label>
                    <input
                      type="time"
                      value={editDates.endTime}
                      onChange={(e) =>
                        setEditDates((prev) => prev && { ...prev, endTime: e.target.value })
                      }
                      className={cn(
                        "rounded-xl border p-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                        isDark ? "bg-[#001219] border-[#0A4D66]/50 text-white" : "bg-white border-slate-300 text-slate-800"
                      )}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cancelEditingDates}
                    disabled={isSavingDateTime}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                      isDark ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveDates}
                    disabled={isSavingDateTime}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                  >
                    {isSavingDateTime ? "Saving..." : "Save Schedule"}
                  </button>
                </div>
              </div>
            ) : (
              <span className={cn("font-medium", isDark ? "text-slate-100" : "text-slate-900")}>
                {formatDate(operation.start_date_time)}
                {operation.end_date_time ? ` – ${formatDate(operation.end_date_time)}` : ""}
              </span>
            )}
          </div>

          {operation.duration_label ? (
            <InfoRow label="Estimated Duration" value={operation.duration_label} />
          ) : null}

          {departureLabel !== "N/A" ? (
            <InfoRow label="Departure Location" value={departureLabel} />
          ) : null}
          {arrivalLabel !== "N/A" ? (
            <InfoRow label="Destination" value={arrivalLabel} />
          ) : null}
          {operation.waypoints && operation.waypoints.length > 0 ? (
            <InfoRow
              label="Mission Waypoints"
              value={
                <div className="flex flex-col gap-1.5">
                  {operation.waypoints
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((waypoint) => (
                      <span key={waypoint.id} className={cn("text-xs font-mono flex items-center gap-1.5", isDark ? "text-slate-300" : "text-slate-700")}>
                        <span className="font-bold text-amber-500 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px]">
                          CP-{waypoint.sequence}
                        </span>
                        <span>{waypoint.name ? `${waypoint.name} • ` : ""}{Number(waypoint.latitude).toFixed(5)}, {Number(waypoint.longitude).toFixed(5)}</span>
                      </span>
                    ))}
                </div>
              }
            />
          ) : null}
        </div>

        {/* Aircraft Assets Fleet Card */}
        <div className={cn(
          "rounded-2xl border p-6 transition-all shadow-sm flex flex-col",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:airplane" className="w-5 h-5 text-sky-500" />
              <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
                Assigned Aircraft Fleet
              </h3>
            </div>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-bold border",
              isDark ? "bg-[#001825] border-[#0A4D66]/50 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
            )}>
              {operation.assets?.length ?? 0} Airframe(s)
            </span>
          </div>

          {operation.assets && operation.assets.length > 0 ? (
            <div className="space-y-4 flex-1">
              {operation.assets.map((entry, index) => (
                <AssetCard
                  key={entry.id ?? `${entry.asset_id ?? "asset"}-${index}`}
                  entry={entry}
                  index={index}
                  navigate={navigate}
                  operationId={operation.id}
                />
              ))}
            </div>
          ) : (
            <div className={cn(
              "rounded-xl border border-dashed p-8 text-center flex-1 flex flex-col items-center justify-center",
              isDark ? "border-[#0A4D66]/40 text-slate-400" : "border-slate-300 text-slate-500"
            )}>
              <Icon icon="mdi:airplane-off" className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">No aircraft assets assigned to this operation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Operation Map View */}
      <div className={cn(
        "rounded-2xl border p-6 transition-all shadow-sm",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:map-legend" className="w-5 h-5 text-sky-500" />
            <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
              Operation Tactical Map
            </h3>
          </div>
          <span className={cn(
            "text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border",
            isDark ? "bg-[#001825] border-[#0A4D66]/50 text-sky-400" : "bg-sky-50 border-sky-200 text-sky-700"
          )}>
            QGIS / Carto Tactical Engine
          </span>
        </div>

        <OperationLocationPicker
          departure={{
            latitude:
              operation.departure_latitude === null ||
              operation.departure_latitude === undefined
                ? ""
                : String(operation.departure_latitude),
            longitude:
              operation.departure_longitude === null ||
              operation.departure_longitude === undefined
                ? ""
                : String(operation.departure_longitude),
          }}
          arrival={{
            latitude:
              operation.arrival_latitude === null ||
              operation.arrival_latitude === undefined
                ? ""
                : String(operation.arrival_latitude),
            longitude:
              operation.arrival_longitude === null ||
              operation.arrival_longitude === undefined
                ? ""
                : String(operation.arrival_longitude),
          }}
          waypoints={(operation.waypoints ?? [])
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((waypoint) => ({
              name: waypoint.name,
              latitude: waypoint.latitude,
              longitude: waypoint.longitude,
            }))}
          readOnly
          telemetryTracks={telemetryTracks}
          liveAircraftPositions={liveAircraftPositions}
          heightClassName="h-120"
        />
      </div>

      {Boolean(
        (operation.departure_latitude && operation.departure_longitude) ||
        (operation.arrival_latitude && operation.arrival_longitude)
      ) && (
        <div className="space-y-6">
          <MissionPlanningCard
            departureLat={operation.departure_latitude}
            departureLng={operation.departure_longitude}
            arrivalLat={operation.arrival_latitude}
            arrivalLng={operation.arrival_longitude}
            waypoints={(operation.waypoints ?? []).map((w) => ({
              name: w.name,
              latitude: w.latitude,
              longitude: w.longitude,
            }))}
            unitId={operation.unit?.id}
            unitName={operation.unit?.name}
            operationName={operation.name}
            operationCode={operation.id ? `OP-${operation.id}` : undefined}
            operationDate={operation.start_date_time ? operation.start_date_time.slice(0, 10) : undefined}
            aircraftCount={operation.assets?.length || 1}
            isEditable={false}
          />
          <WeatherBriefingCard
            departureLat={operation.departure_latitude}
            departureLon={operation.departure_longitude}
            arrivalLat={operation.arrival_latitude}
            arrivalLon={operation.arrival_longitude}
            flightDate={operation.start_date_time ? operation.start_date_time.slice(0, 10) : undefined}
            flightTime={operation.start_date_time && operation.start_date_time.length > 10 ? operation.start_date_time.slice(11, 16) : undefined}
          />
        </div>
      )}
    </div>
  );
};

const AARTab = ({
  operation,
  onAddReport,
  onChanged,
}: {
  operation: Operation;
  onAddReport: () => void;
  /** Refetch the operation after an approval decision changes the AAR's status. */
  onChanged?: () => void;
}) => {
  const { isDark } = useTheme();
  const report = operation.afterActionReport;

  if (!report) {
    return (
      <div className={cn(
        "rounded-2xl border p-12 text-center transition-all shadow-sm flex flex-col items-center justify-center",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className={cn("p-4 rounded-2xl border mb-3", isDark ? "bg-[#001825] border-[#0A4D66]/40 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400")}>
          <Icon icon="mdi:file-document-remove-outline" className="w-10 h-10" />
        </div>
        <p className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-900")}>
          No After Action Report Recorded
        </p>
        <p className={cn("text-xs mt-1 max-w-md", isDark ? "text-slate-400" : "text-slate-500")}>
          Debriefing and operational engagement telemetry have not been logged for this mission.
        </p>
        <button
          type="button"
          onClick={onAddReport}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all"
        >
          <Icon icon="mdi:plus" className="w-4 h-4" />
          Create After Action Report
        </button>
      </div>
    );
  }

  const totalContactVehicles = (report.contacts ?? []).reduce(
    (sum, contact) => sum + (Number(contact.enemy_vehicle_no) || 0),
    0,
  );
  const reportVehicles = report.vehicles ?? [];

  const getVehicleDisplay = (vehicle: unknown, index: number) => {
    if (!vehicle || typeof vehicle !== "object") {
      return `Vehicle ${index + 1}`;
    }

    const row = vehicle as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name : null;
    const registrationNumber =
      typeof row.registration_number === "string"
        ? row.registration_number
        : typeof row.plate_number === "string"
          ? row.plate_number
          : null;

    if (name && registrationNumber) {
      return `${name} (${registrationNumber})`;
    }
    if (name) return name;
    if (registrationNumber) return registrationNumber;
    if (typeof row.id === "number") return `Vehicle #${row.id}`;
    return `Vehicle ${index + 1}`;
  };

  return (
    <div className="space-y-6">
      {/* Debrief Summary Dossier */}
      <div className={cn(
        "rounded-2xl border p-6 transition-all shadow-sm",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-2 mb-4">
          <Icon icon="mdi:clipboard-check-outline" className="w-5 h-5 text-sky-500" />
          <h3 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
            Mission Debrief Summary
          </h3>
        </div>

        <div className="space-y-0">
          <InfoRow
            label="Mission Objective"
            value={<span className="capitalize">{report.mission}</span>}
          />
          <InfoRow label="Task Order No." value={report.task_no || "-"} />
          <InfoRow label="Report Date" value={report.report_date || (report as unknown as { created_at?: string })?.created_at?.slice(0, 10) || "-"} />
          <InfoRow
            label="Aircraft Formation"
            value={
              report.aircraft_formation === "formation"
                ? "Formation Flight"
                : report.aircraft_formation === "single_ship"
                ? "Single Ship"
                : report.aircraft_formation === "none"
                ? "None"
                : report.aircraft_formation || "-"
            }
          />
          <InfoRow label="Tasked Formation" value={report.unit_formation || "-"} />
          <InfoRow label="Infantry Personnel" value={report.infantry_no ?? "-"} />
          <InfoRow label="Total Vehicles" value={report.vehicles_no ?? totalContactVehicles} />
          <InfoRow label="Munitions / Ammo Spent" value={report.ammo_spent || "-"} />
          <InfoRow label="Operational Activities" value={report.activities || "-"} />
        </div>
      </div>

      {/* Enemy Contacts Grid */}
      {(report.contacts ?? []).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {report.contacts.map((contact, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-2xl border p-6 transition-all shadow-sm",
                isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="mdi:crosshairs-gps" className="w-4 h-4 text-amber-500" />
                <h4 className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-amber-400" : "text-amber-700")}>
                  Enemy Contact Profile #{idx + 1}
                </h4>
              </div>

              <div className="space-y-0">
                <InfoRow
                  label="Engagement Level"
                  value={
                    <span className="capitalize">
                      {contact.engagement?.replace(/_/g, " ") || "-"}
                    </span>
                  }
                />
                <InfoRow label="Contact Location" value={contact.location || "-"} />
                <InfoRow
                  label="Time of Contact"
                  value={contact.time_of_contact || "-"}
                />
              </div>

              <div className={cn("mt-4 pt-3 border-t space-y-1 text-xs", isDark ? "border-[#0A4D66]/30 text-slate-300" : "border-slate-100 text-slate-700")}>
                <div className={cn("font-bold text-[11px] uppercase tracking-wider mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                  Enemy Resources & Forces
                </div>
                <InfoRow
                  label="Resources Note"
                  value={contact.enemy_resources_description || "-"}
                />
                <InfoRow
                  label="Enemy Infantry"
                  value={contact.enemy_infantry_no ?? "-"}
                />
                <InfoRow
                  label="Enemy Vehicles"
                  value={contact.enemy_vehicle_no ?? "-"}
                />
              </div>

              <div className={cn("mt-4 pt-3 border-t space-y-1 text-xs", isDark ? "border-[#0A4D66]/30 text-slate-300" : "border-slate-100 text-slate-700")}>
                <div className={cn("font-bold text-[11px] uppercase tracking-wider mb-1", isDark ? "text-emerald-400" : "text-emerald-700")}>
                  Targets Neutralized / Treated
                </div>
                <InfoRow
                  label="Outcome Summary"
                  value={contact.targets_treated_description || "-"}
                />
                <InfoRow
                  label="Infantry Neutralized"
                  value={contact.targets_infantry_no ?? "-"}
                />
                <InfoRow
                  label="Vehicles Destroyed"
                  value={contact.targets_vehicle_no ?? "-"}
                />
              </div>

              <div className={cn("mt-4 pt-3 border-t space-y-1 text-xs", isDark ? "border-[#0A4D66]/30 text-slate-300" : "border-slate-100 text-slate-700")}>
                <div className={cn("font-bold text-[11px] uppercase tracking-wider mb-1", isDark ? "text-red-400" : "text-red-700")}>
                  Damage Incurred
                </div>
                <InfoRow
                  label="Damage Assessment"
                  value={contact.damage_received || "No battle damage sustained"}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Operational Vehicles Section */}
      <div className={cn(
        "rounded-2xl border p-6 transition-all shadow-sm space-y-4",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className={cn("flex items-center justify-between border-b pb-3", isDark ? "border-[#0A4D66]/30" : "border-slate-100")}>
          <div className="flex items-center gap-2">
            <Icon icon="mdi:tank" className="w-5 h-5 text-sky-500" />
            <h4 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
              Participating Ground Vehicles
            </h4>
          </div>
          <span className={cn(
            "text-xs font-bold px-2.5 py-0.5 rounded-full border",
            isDark ? "bg-[#001825] border-[#0A4D66]/50 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
          )}>
            {reportVehicles.length} vehicle(s)
          </span>
        </div>

        {reportVehicles.length === 0 ? (
          <p className={cn("text-xs py-2", isDark ? "text-slate-400" : "text-slate-500")}>
            No ground vehicles recorded in this after action report.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {reportVehicles.map((vehicle, index) => (
              <div
                key={
                  vehicle &&
                  typeof vehicle === "object" &&
                  typeof (vehicle as Record<string, unknown>).id === "number"
                    ? String((vehicle as Record<string, unknown>).id)
                    : `${index}`
                }
                className={cn(
                  "rounded-xl border px-4 py-3 text-xs font-semibold shadow-xs transition-colors flex items-center gap-2",
                  isDark ? "border-[#0A4D66]/40 bg-[#001825] text-slate-200" : "border-slate-200 bg-slate-50 text-slate-800"
                )}
              >
                <Icon icon="mdi:car-side" className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="truncate">{getVehicleDisplay(vehicle, index)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AAR Signature & Endorsement Table */}
      <div className={cn(
        "rounded-2xl border p-6 transition-all shadow-sm space-y-4",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-900"
      )}>
        <AARSignatureTable
          report={report}
          operationId={operation.id}
          operationName={operation.name}
        />
      </div>

      {/* Approval Panel */}
      <ApprovalPanel module="after-action-reports" recordId={report.id} onChanged={onChanged} />
    </div>
  );
};

export const OperationDetailsPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get("tab");
  const initialTab =
    queryTab === "aar" ? "aar" : queryTab === "satcom" ? "satcom" : "operation";
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<"operation" | "satcom" | "aar">(initialTab);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [deleteOperation, { isLoading: isDeleting }] =
    useDeleteOperationMutation();
  const [updateOperationStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOperationStatusMutation();
  const [updateOperation, { isLoading: isSavingDateTime }] =
    useUpdateOperationMutation();

  const statusOptions = ["planned", "completed", "ongoing", "aborted"] as const;

  const { data: operation, isLoading, refetch } = useGetOperationByIdQuery(id || "", {
    skip: !id,
  });

  const { data: telemetryData } = useGetOperationTelemetryQuery(id || "", {
    skip: !id,
    pollingInterval: 8000,
  });

  if (isLoading) {
    return (
      <div className={cn("min-h-screen w-full flex items-center justify-center py-24", isDark ? "text-slate-400" : "text-slate-500")}>
        <div className="animate-spin h-8 w-8 border-2 border-sky-500 border-t-transparent rounded-full mr-3" />
        <span className="text-sm font-medium">Loading operational mission data...</span>
      </div>
    );
  }

  if (!operation) {
    return (
      <div className={cn("min-h-screen w-full flex flex-col items-center justify-center py-24 gap-4", isDark ? "text-slate-400" : "text-slate-500")}>
        <div className={cn("p-4 rounded-2xl border", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-slate-500" : "bg-white border-slate-200 text-slate-400")}>
          <Icon icon="mdi:target-off" className="w-12 h-12" />
        </div>
        <p className={cn("text-lg font-semibold", isDark ? "text-white" : "text-slate-900")}>Operation Record Not Found</p>
        <BackButton fallbackUrl="/dashboard/operations" />
      </div>
    );
  }

  const handleDeleteOperation = async () => {
    if (!operation.id || isDeleting) return;

    const confirmed = window.confirm(
      `Delete operation "${operation.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteOperation(operation.id).unwrap();
      dispatch(
        showToast({
          message: "Operation deleted successfully",
          type: "success",
        }),
      );
      navigate("/dashboard/operations");
    } catch {
      dispatch(
        showToast({ message: "Failed to delete operation", type: "error" }),
      );
    }
  };

  const handleUpdateDateTime = async (payload: {
    start_date_time?: string;
    end_date_time?: string;
  }) => {
    if (!operation.id) return;

    try {
      await updateOperation({ id: operation.id, data: payload }).unwrap();
      dispatch(
        showToast({ message: "Operation dates updated", type: "success" }),
      );
    } catch {
      dispatch(
        showToast({
          message: "Failed to update operation dates",
          type: "error",
        }),
      );
    }
  };

  const handleUpdateStatus = async (
    selected: (typeof statusOptions)[number],
  ) => {
    if (!operation.id || isUpdatingStatus) return;

    if (selected === operation.status) {
      setIsStatusMenuOpen(false);
      return;
    }

    try {
      await updateOperationStatus({
        id: operation.id,
        status: selected,
      }).unwrap();
      setIsStatusMenuOpen(false);
      dispatch(
        showToast({ message: "Operation status updated", type: "success" }),
      );
    } catch {
      dispatch(
        showToast({
          message: "Failed to update operation status",
          type: "error",
        }),
      );
    }
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `${operation.name || "operation"}-${operation.id}`,
        backgroundColor: isDark ? "#001219" : "#FFFFFF",
      });
      dispatch(showToast({ message: "PDF downloaded", type: "success" }));
    } catch (error) {
      console.error("Failed to download operation PDF", {
        operationId: operation.id,
        fileName: `${operation.name || "operation"}-${operation.id}`,
        error,
      });
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleAddAfterActionReport = () => {
    navigate(`/dashboard/operations/${operation.id}/after-action-report`);
  };

  return (
    <div className={cn("space-y-6", isDark ? "text-slate-100" : "text-slate-800")}>
      {/* Executive Command Header */}
      <div className={cn(
        "p-6 rounded-2xl border transition-all duration-200 shadow-sm",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <BackButton fallbackUrl="/dashboard/operations" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  Air Sortie Mission • OP-{operation.id}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                  operation.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : operation.status === "ongoing"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : operation.status === "aborted"
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    operation.status === "completed"
                      ? "bg-emerald-400"
                      : operation.status === "ongoing"
                      ? "bg-amber-400 animate-pulse"
                      : operation.status === "aborted"
                      ? "bg-red-400"
                      : "bg-sky-400"
                  )} />
                  <span className="capitalize">{operation.status || "Planned"}</span>
                </span>
              </div>
              <h1 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                {operation.name}
              </h1>
              <p className={cn("text-xs mt-1 flex flex-wrap items-center gap-3", isDark ? "text-slate-400" : "text-slate-500")}>
                <span>Theater: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{operation.operation_category?.name || "General"}</strong></span>
                <span>•</span>
                <span>Unit: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{operation.unit?.name || "Unassigned"}</strong></span>
                <span>•</span>
                <span>Fleet: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{operation.assets?.length || 0} airframe(s)</strong></span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                disabled={isUpdatingStatus}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm",
                  isDark
                    ? "bg-[#001825] hover:bg-slate-800 border-[#0A4D66]/50 text-slate-200"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700"
                )}
              >
                <Icon icon="mdi:refresh" className={cn("w-4 h-4 text-sky-500", isUpdatingStatus && "animate-spin")} />
                <span>{isUpdatingStatus ? "Updating..." : "Update Status"}</span>
                <Icon icon="mdi:chevron-down" className="w-3.5 h-3.5 opacity-60" />
              </button>

              {isStatusMenuOpen && !isUpdatingStatus ? (
                <div className={cn(
                  "absolute right-0 mt-2 min-w-44 rounded-2xl border shadow-xl z-30 overflow-hidden py-1 backdrop-blur-md",
                  isDark ? "bg-[#001825]/95 border-[#0A4D66]/60" : "bg-white/95 border-slate-200"
                )}>
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleUpdateStatus(status)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-xs capitalize transition-colors flex items-center justify-between",
                        operation.status === status
                          ? (isDark ? "bg-sky-500/20 text-sky-400 font-bold" : "bg-sky-50 text-sky-700 font-bold")
                          : (isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100")
                      )}
                    >
                      <span>{status}</span>
                      {operation.status === status && <Icon icon="mdi:check" className="w-4 h-4 text-sky-500" />}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate(`/dashboard/operations/${operation.id}/edit`)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm",
                isDark
                  ? "bg-[#001825] hover:bg-slate-800 border-[#0A4D66]/50 text-slate-200"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700"
              )}
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4 text-amber-500" />
              <span>Edit Mission</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Download operation dossier PDF"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm disabled:opacity-50",
                isDark
                  ? "bg-[#001825] hover:bg-slate-800 border-red-500/30 text-red-400"
                  : "bg-red-50 hover:bg-red-100 border-red-300 text-red-700"
              )}
            >
              <Icon
                icon={isDownloadingPdf ? "mdi:loading" : "mdi:file-pdf-box"}
                className={cn("w-4 h-4", isDownloadingPdf && "animate-spin")}
              />
              <span>{isDownloadingPdf ? "Generating..." : "PDF Dossier"}</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteOperation}
              disabled={isDeleting}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm disabled:opacity-50",
                isDark
                  ? "bg-red-950/20 hover:bg-red-950/40 border-red-500/30 text-red-400"
                  : "bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
              )}
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
              <span>{isDeleting ? "Deleting..." : "Delete"}</span>
            </button>
          </div>
        </div>

        {/* Tab Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4 mt-6 border-slate-200 dark:border-[#0A4D66]/30">
          <AppTabs<"operation" | "satcom" | "aar">
            tabs={[
              { id: "operation", label: "Mission Dossier", icon: "mdi:target" },
              { id: "satcom", label: "Garmin inReach & Satcom Tracking", icon: "mdi:satellite-variant" },
              { id: "aar", label: "After Action Report (AAR)", icon: "mdi:file-document-outline" },
            ]}
            activeTab={activeTab}
            onChange={(t) => setActiveTab(t)}
            size="sm"
            containerClassName="border-b-0"
          />
          {!operation.afterActionReport && (
            <button
              type="button"
              onClick={handleAddAfterActionReport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-bold text-white shadow-md transition-all"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Create AAR Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Approval: while active, a planned operation needs approval before it can go ongoing/completed. */}
      {id && <ApprovalPanel module="operations" recordId={Number(id)} onChanged={refetch} />}

      {/* Content */}
      <div ref={contentRef} className="flex-1">
        {activeTab === "operation" ? (
          <OperationTab
            operation={operation}
            navigate={navigate}
            onUpdateDateTime={handleUpdateDateTime}
            isSavingDateTime={isSavingDateTime}
            telemetryTracks={telemetryData?.tracks}
            liveAircraftPositions={telemetryData?.latest_positions}
          />
        ) : activeTab === "satcom" ? (
          <SatelliteCommsCard
            operationId={operation.id}
            operationName={operation.name}
            assets={operation.assets}
            latestPositions={telemetryData?.latest_positions}
            telemetryTracks={telemetryData?.tracks}
          />
        ) : (
          <AARTab
            operation={operation}
            onAddReport={handleAddAfterActionReport}
            onChanged={refetch}
          />
        )}
      </div>
    </div>
  );
};
