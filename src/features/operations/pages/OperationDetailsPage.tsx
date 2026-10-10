import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import {
  useDeleteOperationMutation,
  useGetOperationByIdQuery,
  useLogOperationFlightHoursMutation,
  useUpdateOperationMutation,
  useUpdateOperationStatusMutation,
  type Operation,
  type OperationAssignedAsset,
} from "../api";
import { OperationLocationPicker } from "../components/OperationLocationPicker";
import Modal from "@/shared/ui/modal/Modal";

const InfoRow = ({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex py-3 border-b border-[#0A4D66]/40 last:border-0",
      className,
    )}
  >
    <span className="w-1/3 text-[#7FD5FF] font-medium text-sm">{label}:</span>
    <span className="w-2/3 text-white font-bold text-sm">{value}</span>
  </div>
);

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
      className="text-left text-[#7FD5FF] hover:underline"
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
  navigate: (path: string) => void;
  operationId: number | string;
}) => {
  const dispatch = useAppDispatch();
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
    if (assetIdValue) navigate(`/dashboard/assets/${assetIdValue}`);
  };
  const goToPerson = (personId: number) =>
    navigate(`/dashboard/personnel/${personId}`);

  const cardKey =
    entry.id ??
    (typeof baseAsset.id === "number"
      ? baseAsset.id
      : `${entry.asset_id ?? "asset"}-${index}`);

  const cardContent = (
    <>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          {assetIdValue ? "Click to view asset details" : ""}
        </span>
        {assetIdValue ? (
          <Icon icon="mdi:chevron-right" className="w-4 h-4 text-[#7FD5FF]" />
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
        <div className="pt-3 mt-1 border-t border-[#0A4D66]/40">
          {entry.logged_to_asset_at ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
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
              className="inline-flex items-center gap-1.5 rounded border border-[#7FD5FF]/40 bg-[#0A4D66]/30 px-3 py-1.5 text-xs font-medium text-[#C9F1FF] transition-colors hover:bg-[#0A4D66]/60"
            >
              <Icon icon="mdi:clipboard-check-outline" className="w-3.5 h-3.5" />
              Log Flight Hours to Asset
            </button>
          ) : (
            <span className="text-xs text-gray-500">
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
          "rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4",
          assetIdValue && "cursor-pointer hover:border-[#7FD5FF]/70 transition-colors",
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
          <p className="text-sm text-gray-400">
            Confirm the values to log to this aircraft's permanent flight record. You
            can adjust them before submitting — this can only be done once per
            aircraft per operation.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Flight Hours
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={draft.flight_hours}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, flight_hours: e.target.value }))
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Landings
              <input
                type="number"
                min="0"
                value={draft.landing}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, landing: e.target.value }))
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Cycles
              <input
                type="number"
                min="0"
                value={draft.cycle}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, cycle: e.target.value }))
                }
                className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowLogModal(false)}
              className="rounded px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLog}
              disabled={isLogging}
              className="rounded bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0369A1]/90 disabled:opacity-50"
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
}: {
  operation: Operation;
  navigate: (path: string) => void;
  onUpdateDateTime: (payload: {
    start_date_time?: string;
    end_date_time?: string;
  }) => Promise<void>;
  isSavingDateTime: boolean;
}) => {
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <InfoRow
            label="Operation Name"
            value={operation.operation_category?.name || "N/A"}
          />
          <InfoRow
            label="Region"
            value={operation.name || "N/A"}
          />
          <InfoRow
            label="Type"
            value={operation.operation_type?.name || "N/A"}
          />
          <InfoRow
            label="Unit"
            value={
              operation.unit?.id ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/dashboard/units/${operation.unit.id}`)
                  }
                  className="text-left text-[#7FD5FF] hover:underline font-bold text-sm"
                >
                  {operation.unit.name}
                </button>
              ) : (
                operation.unit?.name || "N/A"
              )
            }
          />
          <div className="flex flex-col gap-2 py-3 border-b border-[#0A4D66]/40">
            <div className="flex items-center justify-between">
              <span className="text-[#7FD5FF] font-medium text-sm">
                Date{operation.end_date_time ? " / End Date" : ""}:
              </span>
              {!editDates ? (
                <button
                  type="button"
                  onClick={startEditingDates}
                  title="Edit operation dates"
                  className="text-gray-400 hover:text-[#7FD5FF] transition-colors"
                >
                  <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {editDates ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Start Date</label>
                    <input
                      type="date"
                      value={editDates.startDate}
                      onChange={(e) =>
                        setEditDates(
                          (prev) => prev && { ...prev, startDate: e.target.value },
                        )
                      }
                      className="bg-[#001219] border border-[#0A4D66]/40 rounded p-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Start Time</label>
                    <input
                      type="time"
                      value={editDates.startTime}
                      onChange={(e) =>
                        setEditDates(
                          (prev) => prev && { ...prev, startTime: e.target.value },
                        )
                      }
                      className="bg-[#001219] border border-[#0A4D66]/40 rounded p-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">End Date</label>
                    <input
                      type="date"
                      value={editDates.endDate}
                      onChange={(e) =>
                        setEditDates(
                          (prev) => prev && { ...prev, endDate: e.target.value },
                        )
                      }
                      className="bg-[#001219] border border-[#0A4D66]/40 rounded p-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">End Time</label>
                    <input
                      type="time"
                      value={editDates.endTime}
                      onChange={(e) =>
                        setEditDates(
                          (prev) => prev && { ...prev, endTime: e.target.value },
                        )
                      }
                      className="bg-[#001219] border border-[#0A4D66]/40 rounded p-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveDates}
                    disabled={isSavingDateTime}
                    className="px-3 py-1.5 rounded bg-[#0369A1] text-white text-xs font-semibold hover:bg-[#0369A1]/90 transition-colors disabled:opacity-50"
                  >
                    {isSavingDateTime ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingDates}
                    disabled={isSavingDateTime}
                    className="px-3 py-1.5 rounded border border-[#0A4D66]/40 text-xs text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-white font-bold text-sm">
                {formatDate(operation.start_date_time)}
                {operation.end_date_time
                  ? ` – ${formatDate(operation.end_date_time)}`
                  : ""}
              </span>
            )}
          </div>
          {operation.duration_label ? (
            <InfoRow label="Duration" value={operation.duration_label} />
          ) : null}
          <InfoRow
            label="Priority"
            value={
              <span
                className={cn(
                  "capitalize font-semibold",
                  operation.priority === "high"
                    ? "text-red-400"
                    : operation.priority === "medium"
                      ? "text-amber-300"
                      : "text-emerald-400",
                )}
              >
                {operation.priority || "N/A"}
              </span>
            }
          />
          <InfoRow
            label="Status"
            value={
              <div className="flex items-center gap-2">
                <span className="capitalize">{operation.status}</span>
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    operation.status === "completed"
                      ? "bg-emerald-400"
                      : operation.status === "ongoing"
                        ? "bg-amber-400"
                        : operation.status === "aborted"
                          ? "bg-red-500"
                          : "bg-blue-400",
                  )}
                />
              </div>
            }
          />
          {departureLabel !== "N/A" ? (
            <InfoRow label="Departure" value={departureLabel} />
          ) : null}
          {arrivalLabel !== "N/A" ? (
            <InfoRow label="Destination" value={arrivalLabel} />
          ) : null}
          {operation.waypoints && operation.waypoints.length > 0 ? (
            <InfoRow
              label="Waypoints"
              value={
                <div className="flex flex-col gap-1">
                  {operation.waypoints
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((waypoint) => (
                      <span key={waypoint.id} className="text-xs text-gray-300">
                        <span className="font-semibold text-[#F59E0B]">
                          CP-{waypoint.sequence}
                        </span>
                        {waypoint.name ? ` ${waypoint.name}` : ""} —{" "}
                        {Number(waypoint.latitude).toFixed(6)},{" "}
                        {Number(waypoint.longitude).toFixed(6)}
                      </span>
                    ))}
                </div>
              }
            />
          ) : null}
        </div>

        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <h3 className="text-[#7FD5FF] text-sm font-bold mb-4 uppercase">
            Aircraft
          </h3>
          {operation.assets && operation.assets.length > 0 ? (
            <div className="space-y-4">
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
            <div className="text-gray-400 text-sm">
              No aircraft assets assigned.
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
            Operation Map View
          </h3>
          <span className="text-xs text-gray-400 uppercase tracking-wide">
            QGIS route preview
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
          heightClassName="h-120"
        />
      </div>
    </div>
  );
};

const AARTab = ({
  operation,
  onAddReport,
}: {
  operation: Operation;
  onAddReport: () => void;
}) => {
  const report = operation.afterActionReport;

  if (!report) {
    return (
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-10 text-center text-white">
        <Icon
          icon="mdi:file-remove-outline"
          className="w-10 h-10 text-gray-400 mx-auto mb-3"
        />
        <p className="text-base font-semibold">No after action report</p>
        <button
          type="button"
          onClick={onAddReport}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0A4D66] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A4D66]/80 transition-colors"
        >
          <Icon icon="mdi:plus" className="w-4 h-4" />
          Add After Action Report
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
    <div className="space-y-4">
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-white">
        <div className="space-y-0">
          <InfoRow
            label="Mission"
            value={<span className="capitalize">{report.mission}</span>}
          />
          <InfoRow label="Task No." value={report.task_no || "-"} />
          <InfoRow label="Infantry No" value={report.infantry_no ?? "-"} />
          <InfoRow label="Vehicle No." value={totalContactVehicles} />
          <InfoRow label="Activities" value={report.activities || "-"} />
        </div>
      </div>

      {(report.contacts ?? []).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {report.contacts.map((contact, idx) => (
            <div
              key={idx}
              className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-5 text-white"
            >
              <div className="text-[#7FD5FF] text-sm mb-3">
                Enemy in Contact {idx + 1}
              </div>

              <div className="space-y-0">
                <InfoRow
                  label="Engagement"
                  value={
                    <span className="capitalize">
                      {contact.engagement?.replace(/_/g, " ") || "-"}
                    </span>
                  }
                />
                <InfoRow label="Location" value={contact.location || "-"} />
                <InfoRow label="Date" value={contact.date_of_contact || "-"} />
                <InfoRow
                  label="Time of Contact"
                  value={contact.time_of_contact || "-"}
                />
              </div>

              <div className="mt-4 text-sm text-gray-300 space-y-2">
                <div className="text-gray-400">Enemy Resources</div>
                <InfoRow
                  label="Description"
                  value={contact.enemy_resources_description || "-"}
                />
                <InfoRow
                  label="Infantry No."
                  value={contact.enemy_infantry_no ?? "-"}
                />
                <InfoRow
                  label="Vehicle No."
                  value={contact.enemy_vehicle_no ?? "-"}
                />
              </div>

              <div className="mt-4 text-sm text-gray-300 space-y-2">
                <div className="text-gray-400">Targets Treated</div>
                <InfoRow
                  label="Description"
                  value={contact.targets_treated_description || "-"}
                />
                <InfoRow
                  label="Infantry No."
                  value={contact.targets_infantry_no ?? "-"}
                />
                <InfoRow
                  label="Vehicle No."
                  value={contact.targets_vehicle_no ?? "-"}
                />
              </div>

              <div className="mt-4 text-sm text-gray-300 space-y-2">
                <div className="text-gray-400">Damage Received</div>
                <InfoRow
                  label="Description"
                  value={contact.damage_received || "-"}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#0A4D66]/40 pb-3">
          <h4 className="text-[#7FD5FF] text-sm font-bold uppercase">
            Vehicles
          </h4>
          <span className="text-xs text-gray-400">{reportVehicles.length}</span>
        </div>

        {reportVehicles.length === 0 ? (
          <p className="text-sm text-gray-400">
            No vehicles recorded in after action report.
          </p>
        ) : (
          <div className="space-y-2">
            {reportVehicles.map((vehicle, index) => (
              <div
                key={
                  vehicle &&
                  typeof vehicle === "object" &&
                  typeof (vehicle as Record<string, unknown>).id === "number"
                    ? String((vehicle as Record<string, unknown>).id)
                    : `${index}`
                }
                className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] px-4 py-3 text-sm text-gray-200"
              >
                {getVehicleDisplay(vehicle, index)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const OperationDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<"operation" | "aar">("operation");
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [deleteOperation, { isLoading: isDeleting }] =
    useDeleteOperationMutation();
  const [updateOperationStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOperationStatusMutation();
  const [updateOperation, { isLoading: isSavingDateTime }] =
    useUpdateOperationMutation();

  const statusOptions = ["planned", "completed", "ongoing", "aborted"] as const;

  const { data: operation, isLoading } = useGetOperationByIdQuery(id || "", {
    skip: !id,
  });

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#001219] text-[#7FD5FF]">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#001219] text-gray-400 gap-4">
        <p>Operation not found</p>
        <button
          onClick={() => navigate(-1)}
          className="text-[#7FD5FF] hover:underline"
        >
          Go Back
        </button>
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
        backgroundColor: "#001219",
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
    <div className="min-h-screen bg-[#001219] text-gray-200 flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard/operations")}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <Icon icon="mdi:arrow-left" className="w-5 h-5" />
              Back
            </button>

            <div className="text-sm text-gray-400">{operation.name}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteOperation}
              disabled={isDeleting}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#001825] disabled:opacity-60"
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <div className="relative">
              <button
                onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#001825] disabled:opacity-60"
                type="button"
              >
                <Icon icon="mdi:refresh" className="w-4 h-4" />
                {isUpdatingStatus ? "Updating..." : "Update status"}
                <Icon icon="mdi:chevron-down" className="w-4 h-4" />
              </button>

              {isStatusMenuOpen && !isUpdatingStatus ? (
                <div className="absolute right-0 mt-2 min-w-40 bg-[#001825] border border-[#0A4D66]/40 rounded shadow-lg z-30 overflow-hidden">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleUpdateStatus(status)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs capitalize hover:bg-[#001825] transition-colors",
                        operation.status === status
                          ? "text-[#7FD5FF]"
                          : "text-gray-300",
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              onClick={() =>
                navigate(`/dashboard/operations/${operation.id}/edit`)
              }
              className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#001825]"
            >
              <Icon icon="mdi:pencil" className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Download operation"
              className="p-1.5 text-gray-400 hover:text-white disabled:opacity-60"
            >
              <Icon
                icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
                className={cn(
                  "w-5 h-5",
                  isDownloadingPdf ? "animate-spin" : "",
                )}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("operation")}
            className={cn(
              "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
              activeTab === "operation"
                ? "border-white text-white"
                : "border-transparent text-gray-500 hover:text-gray-300",
            )}
          >
            <Icon icon="mdi:database" className="inline-block w-4 h-4 mr-2" />
            Operation
          </button>
          <button
            onClick={() => setActiveTab("aar")}
            className={cn(
              "px-4 py-2 font-medium text-sm border-b-2 transition-colors",
              activeTab === "aar"
                ? "border-white text-white"
                : "border-transparent text-gray-500 hover:text-gray-300",
            )}
          >
            <Icon
              icon="mdi:file-document-outline"
              className="inline-block w-4 h-4 mr-2"
            />
            After Action Report
          </button>
          {!operation.afterActionReport && (
            <button
              type="button"
              onClick={handleAddAfterActionReport}
              className="ml-2 inline-flex items-center gap-2 rounded-lg bg-[#0A4D66] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0A4D66]/80 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              Add AAR
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1">
        {activeTab === "operation" ? (
          <OperationTab
            operation={operation}
            navigate={navigate}
            onUpdateDateTime={handleUpdateDateTime}
            isSavingDateTime={isSavingDateTime}
          />
        ) : (
          <AARTab
            operation={operation}
            onAddReport={handleAddAfterActionReport}
          />
        )}
      </div>
    </div>
  );
};
