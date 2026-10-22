import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/shared/utils/cn";
import { BackButton } from "@/shared/ui/button/BackButton";
import {
  useGetStrategicDashboardQuery,
  type StrategicGroundedAircraft,
  type StrategicOperation,
  type StrategicOperationStatus,
} from "../api";

const NIGERIA_CENTER: [number, number] = [9.0, 8.0];
const DEFAULT_ZOOM = 6;

type MapView = "ongoing" | "planned" | "completed";

const MAP_VIEWS: { id: MapView; label: string; icon: string }[] = [
  { id: "ongoing", label: "Ongoing", icon: "mdi:airplane" },
  { id: "planned", label: "Planned", icon: "mdi:calendar-clock-outline" },
  { id: "completed", label: "Completed", icon: "mdi:check-circle-outline" },
];

const STATUS_ROUTE_COLOR: Record<StrategicOperationStatus, string> = {
  ongoing: "#22C55E",
  planned: "#7FD5FF",
  completed: "#8B98A9",
  aborted: "#EF4444",
};

const matchesView = (status: StrategicOperationStatus, view: MapView) => {
  if (view === "ongoing") return status === "ongoing";
  if (view === "planned") return status === "planned";
  return status === "completed" || status === "aborted";
};

/** A readiness count that opens the filtered list of the people behind it. */
const ReadinessChip = ({
  to,
  className,
  children,
}: {
  to: string;
  className: string;
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() =>
        navigate(to, {
          state: { from: "/dashboard/strategic", fromLabel: "Strategic Dashboard" },
        })
      }
      className={cn(
        "rounded-full px-2 py-0.5 underline-offset-2 transition hover:underline hover:brightness-125",
        className,
      )}
    >
      {children}
    </button>
  );
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);

const Panel = ({
  title,
  icon,
  children,
  className,
  linkTo,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
  /** When set, the header becomes a button that navigates to the full module page. */
  linkTo?: string;
}) => {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-5",
        className,
      )}
    >
      {linkTo ? (
        <button
          type="button"
          onClick={() =>
            navigate(linkTo, {
              state: {
                from: "/dashboard/strategic",
                fromLabel: "Strategic Dashboard",
              },
            })
          }
          className="mb-4 flex w-full items-center justify-between gap-2 text-sm font-bold uppercase tracking-wide text-[#7FD5FF] transition-colors hover:text-[#C9F1FF]"
        >
          <span className="flex items-center gap-2">
            <Icon icon={icon} className="h-4 w-4" />
            {title}
          </span>
          <Icon icon="mdi:chevron-right" className="h-4 w-4 shrink-0" />
        </button>
      ) : (
        <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#7FD5FF]">
          <Icon icon={icon} className="h-4 w-4" />
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "warning" | "success";
}) => {
  const toneClass = {
    default: "text-white",
    danger: "text-red-400",
    warning: "text-amber-300",
    success: "text-emerald-400",
  }[tone];

  return (
    <div className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", toneClass)}>{value}</div>
    </div>
  );
};

const OperationRoute = ({ operation }: { operation: StrategicOperation }) => {
  const points: [number, number][] = [
    operation.departure ? ([operation.departure.lat, operation.departure.lng] as [number, number]) : null,
    ...operation.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
    operation.arrival ? ([operation.arrival.lat, operation.arrival.lng] as [number, number]) : null,
  ].filter((point): point is [number, number] => point !== null);

  const color = STATUS_ROUTE_COLOR[operation.status];

  const detail = (
    <div className="space-y-0.5 text-xs">
      <div className="font-semibold text-white">{operation.name}</div>
      <div className="capitalize text-gray-300">
        {operation.status}
        {operation.unit ? ` · ${operation.unit}` : ""}
      </div>
      <div className="text-gray-400">
        {formatDateTime(operation.start_date_time)} → {formatDateTime(operation.end_date_time)}
      </div>
      {operation.assets.length > 0 && (
        <div className="text-gray-400">Assets: {operation.assets.join(", ")}</div>
      )}
    </div>
  );

  return (
    <>
      {points.length >= 2 && <Polyline positions={points} pathOptions={{ color, weight: 2.5, opacity: 0.85 }} />}
      {operation.departure && (
        <CircleMarker
          center={[operation.departure.lat, operation.departure.lng]}
          radius={6}
          pathOptions={{ color: "#22C55E", fillColor: "#22C55E", fillOpacity: 0.9, weight: 1 }}
        >
          <Tooltip direction="top">{detail}</Tooltip>
        </CircleMarker>
      )}
      {operation.arrival && (
        <CircleMarker
          center={[operation.arrival.lat, operation.arrival.lng]}
          radius={6}
          pathOptions={{ color: "#EF4444", fillColor: "#EF4444", fillOpacity: 0.9, weight: 1 }}
        >
          <Tooltip direction="top">{detail}</Tooltip>
        </CircleMarker>
      )}
      {operation.waypoints.map((waypoint, index) => (
        <CircleMarker
          key={`${operation.id}-wp-${index}`}
          center={[waypoint.lat, waypoint.lng]}
          radius={3.5}
          pathOptions={{ color: "#F59E0B", fillColor: "#F59E0B", fillOpacity: 0.9, weight: 1 }}
        >
          <Tooltip direction="top">{waypoint.name || `Waypoint ${index + 1}`}</Tooltip>
        </CircleMarker>
      ))}
    </>
  );
};

export const StrategicDashboardPage = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useGetStrategicDashboardQuery();
  const [mapView, setMapView] = useState<MapView>("ongoing");
  const [showUnits, setShowUnits] = useState(true);
  const [expandedGrounded, setExpandedGrounded] = useState(false);

  const visibleOperations = useMemo(
    () => (data?.operations ?? []).filter((operation) => matchesView(operation.status, mapView)),
    [data, mapView],
  );

  const viewCounts = useMemo(() => {
    const counts: Record<MapView, number> = { ongoing: 0, planned: 0, completed: 0 };
    (data?.operations ?? []).forEach((operation) => {
      (["ongoing", "planned", "completed"] as MapView[]).forEach((view) => {
        if (matchesView(operation.status, view)) counts[view] += 1;
      });
    });
    return counts;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-gray-400">
        <Icon icon="mdi:loading" className="mr-2 h-5 w-5 animate-spin" />
        Loading strategic dashboard...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-gray-400">
        <Icon icon="mdi:alert-circle-outline" className="h-8 w-8" />
        Failed to load the strategic dashboard.
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/30"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxDayCount = Math.max(1, ...data.tempo.flights_by_day.map((d) => d.count));

  return (
    <div className="space-y-5 px-2 pb-10 sm:px-0">
      <div className="flex items-center">
        <BackButton fallbackUrl="/dashboard" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#0A4D66]/40 bg-[#001219] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#001825] border border-[#7FD5FF]/40 flex items-center justify-center text-white shadow-[0_0_15px_rgba(127,213,255,0.2)]">
            <Icon icon="mdi:radar" className="w-6 h-6 animate-pulse text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Strategic Command Dashboard
            </h1>
            <p className="text-xs text-gray-400">
              Consolidated, read-only command oversight · As of{" "}
              {new Date(data.generated_at).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#0A4D66]/30 disabled:opacity-50"
        >
          <Icon icon={isFetching ? "mdi:loading" : "mdi:refresh"} className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Tempo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Flights Today" value={data.tempo.flights_today} />
        <StatCard label="Flights This Week" value={data.tempo.flights_this_week} />
        <StatCard label="Operations This Week" value={data.tempo.operations_this_week} />
        <div className="col-span-2 rounded-lg border border-[#0A4D66]/30 bg-[#001825] px-4 py-3 sm:col-span-3 lg:col-span-1">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-400">This Week</div>
          <div className="flex h-10 items-end gap-1.5">
            {data.tempo.flights_by_day.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1" title={`${day.label}: ${day.count} flight(s)`}>
                <div
                  className="w-full rounded-t bg-[#7FD5FF]"
                  style={{ height: `${Math.max(4, (day.count / maxDayCount) * 32)}px` }}
                />
                <span className="text-[9px] text-gray-500">{day.label[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Map */}
        <div className="xl:col-span-2">
          <Panel
            title="Nationwide Operations Map"
            icon="mdi:map-outline"
            className="flex flex-col"
            linkTo="/dashboard/operations"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {MAP_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setMapView(view.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors",
                      mapView === view.id
                        ? "border-[#7FD5FF] bg-[#0369A1]/20 text-white"
                        : "border-[#0A4D66]/40 text-gray-300 hover:text-white",
                    )}
                  >
                    <Icon icon={view.icon} className="h-3.5 w-3.5" />
                    {view.label}
                    <span className="text-gray-500">({viewCounts[view.id]})</span>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={showUnits}
                  onChange={(e) => setShowUnits(e.target.checked)}
                  className="accent-[#0369A1]"
                />
                Show units
              </label>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#0A4D66]/40">
              <MapContainer center={NIGERIA_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="h-110 w-full">
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {visibleOperations.map((operation) => (
                  <OperationRoute key={operation.id} operation={operation} />
                ))}

                {showUnits &&
                  data.units.map((unit) => (
                    <CircleMarker
                      key={`unit-${unit.id}`}
                      center={[unit.lat, unit.lng]}
                      radius={8}
                      pathOptions={{ color: "#0369A1", fillColor: "#0369A1", fillOpacity: 0.35, weight: 2 }}
                    >
                      <Tooltip direction="top">
                        <div className="text-xs">
                          <div className="font-semibold text-white">{unit.name}</div>
                          <div className="text-gray-300">
                            {unit.personnel_count} personnel · {unit.asset_count} assets · {unit.operation_count} operations
                          </div>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  ))}
              </MapContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" /> Departure
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#EF4444]" /> Arrival
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Waypoint
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#0369A1]" /> Unit
              </span>
              {visibleOperations.length === 0 && (
                <span className="text-gray-500">No {mapView} operations to show on the map.</span>
              )}
            </div>
          </Panel>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Panel title="Fleet Readiness" icon="mdi:airplane-cog" linkTo="/dashboard/assets">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Airworthy" value={data.fleet.airworthy} tone="success" />
              <StatCard label="Grounded" value={data.fleet.grounded} tone={data.fleet.grounded > 0 ? "danger" : "default"} />
              <StatCard label="Maint. Overdue" value={data.fleet.maintenance_due.overdue} tone="danger" />
              <StatCard label="Maint. Due Soon" value={data.fleet.maintenance_due.due_soon} tone="warning" />
            </div>
            {data.fleet.grounded_aircraft.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setExpandedGrounded((v) => !v)}
                  className="flex w-full items-center justify-between text-xs text-[#7FD5FF]"
                >
                  <span>{data.fleet.grounded_aircraft.length} grounded aircraft</span>
                  <Icon icon={expandedGrounded ? "mdi:chevron-up" : "mdi:chevron-down"} className="h-4 w-4" />
                </button>
                {expandedGrounded && (
                  <ul className="mt-2 space-y-2">
                    {data.fleet.grounded_aircraft.map((aircraft: StrategicGroundedAircraft) => (
                      <li
                        key={aircraft.id}
                        tabIndex={0}
                        role="button"
                        className="cursor-pointer rounded border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs hover:bg-red-950/40 focus:outline-none focus:ring-1 focus:ring-red-400"
                        onClick={() =>
                          navigate(`/dashboard/assets/${aircraft.id}`, {
                            state: {
                              from: "/dashboard/strategic",
                              fromLabel: "Strategic Dashboard",
                            },
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/dashboard/assets/${aircraft.id}`, {
                              state: {
                                from: "/dashboard/strategic",
                                fromLabel: "Strategic Dashboard",
                              },
                            });
                          }
                        }}
                      >
                        <div className="font-semibold text-red-300">
                          {aircraft.name} {aircraft.tail_number ? `(${aircraft.tail_number})` : ""}
                        </div>
                        <div className="text-gray-400">{aircraft.unit}</div>
                        <ul className="mt-1 list-inside list-disc text-gray-400">
                          {aircraft.reasons.map((reason, index) => (
                            <li key={index}>{reason}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Personnel Readiness" icon="mdi:account-group-outline" linkTo="/dashboard/personnel">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Personnel" value={data.personnel_readiness.total_personnel} />
              <StatCard label="Pilots" value={data.personnel_readiness.total_pilots} />
              <StatCard label="Medical" value={data.personnel_readiness.medical} tone="warning" />
              <StatCard label="Grounded" value={data.personnel_readiness.grounded} tone="danger" />
            </div>
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Pilot Flight Currency</div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <ReadinessChip className="bg-emerald-500/10 text-emerald-400" to="/dashboard/personnel?flight_status=current">
                  Current: {data.personnel_readiness.flight_currency.current}
                </ReadinessChip>
                <ReadinessChip className="bg-amber-500/10 text-amber-300" to="/dashboard/personnel?flight_status=due_for_flight">
                  Due: {data.personnel_readiness.flight_currency.due_for_flight}
                </ReadinessChip>
                <ReadinessChip className="bg-red-500/10 text-red-400" to="/dashboard/personnel?flight_status=overdue">
                  Overdue: {data.personnel_readiness.flight_currency.overdue}
                </ReadinessChip>
                <ReadinessChip className="bg-gray-500/10 text-gray-400" to="/dashboard/personnel?flight_status=no_flights">
                  No flights: {data.personnel_readiness.flight_currency.no_flights}
                </ReadinessChip>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Pass &amp; Leave</div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <ReadinessChip className="bg-emerald-500/10 text-emerald-400" to="/dashboard/personnel/pass?pass_status=on_pass">
                  On pass: {data.personnel_readiness.pass_status.on_pass}
                </ReadinessChip>
                <ReadinessChip className="bg-amber-500/10 text-amber-300" to="/dashboard/personnel/pass?pass_status=due_for_pass">
                  Due: {data.personnel_readiness.pass_status.due_for_pass}
                </ReadinessChip>
                <ReadinessChip className="bg-purple-500/10 text-purple-300" to="/dashboard/personnel/pass?pass_status=pending_approval">
                  Pending: {data.personnel_readiness.pass_status.pending_approval}
                </ReadinessChip>
                <ReadinessChip className="bg-red-500/10 text-red-400" to="/dashboard/personnel/pass?pass_status=overdue">
                  Overdue: {data.personnel_readiness.pass_status.overdue}
                </ReadinessChip>
              </div>
            </div>
          </Panel>

          <Panel title="Open Defects" icon="mdi:alert-decagram-outline" linkTo="/dashboard/maintenance/defects">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Critical" value={data.defects.open_critical} tone="danger" />
              <StatCard label="High" value={data.defects.open_high} tone="warning" />
              <StatCard label="Total Open" value={data.defects.open_total} />
            </div>
          </Panel>

          {data.finance && (
            <Panel title="Finance Overview" icon="mdi:cash-multiple" linkTo="/dashboard/finance">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Expenditure</span>
                  <span className="font-semibold text-white">{formatCurrency(data.finance.total_expense)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">This Month</span>
                  <span className="font-semibold text-white">{formatCurrency(data.finance.current_month_expense)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Budget</span>
                  <span className="font-semibold text-white">{formatCurrency(data.finance.total_budget)}</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-gray-500">
                Shown because your account also holds finance clearance. Not visible to other strategic dashboard viewers.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
};
