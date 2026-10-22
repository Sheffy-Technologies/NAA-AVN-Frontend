import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { useGetUnitsQuery } from "@/shared/api/units";
import { showToast } from "@/shared/store/toastSlice";
import {
  useGetComplianceRecordsQuery,
  useGetWorkOrdersQuery,
} from "@/features/maintenance/api";
import {
  useGetAssetByIdQuery,
  useGetAvionicCategoriesQuery,
  useGetEnginePositionsQuery,
  useUpdateAssetMutation,
  useGetFlightLogsQuery,
  useDeleteFlightLogMutation,
  type Avionics,
  type Component,
  type Engine,
} from "@/features/assets/api";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { FlightLogModal } from "@/features/assets/components/FlightLogModal";
import { getEchoClient } from "@/shared/realtime/echo";

const TABS = [
  { id: "info", label: "Aircraft Information" },
  { id: "components", label: "Components" },
  { id: "engines", label: "Engines" },
  { id: "avionics", label: "Avionics" },
  { id: "flight_history", label: "Flight History" },
  { id: "operations", label: "Operation History" },
  { id: "discrepancies", label: "Discrepancies" },
  { id: "maintenance", label: "Maintenance Tracking" },
  { id: "after_action_report", label: "After Action Report" },
] as const;

type MaintenanceAircraftTabId = (typeof TABS)[number]["id"];

const formatStatus = (value?: string | null) => {
  if (!value) return "-";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? "-" : num.toLocaleString();
};

const formatHours = (value: number | string | null | undefined) => {
  const formatted = formatNumber(value);
  return formatted === "-" ? "-" : `${formatted} hrs`;
};

const getOperationPilotName = (op: any, assetId?: number | string): string => {
  if (!op) return "-";
  const numAssetId = assetId != null ? Number(assetId) : null;
  const assigned = Array.isArray(op.assets)
    ? (numAssetId ? op.assets.find((a: any) => Number(a.asset_id ?? a.id) === numAssetId) : op.assets[0]) || op.assets[0]
    : null;

  const pilot = assigned?.pilot_details || assigned?.pilot;
  if (!pilot) return "-";
  const rank = pilot.rank?.name ? `${pilot.rank.name} ` : "";
  const name = [pilot.firstname, pilot.lastname].filter(Boolean).join(" ");
  const callSign = pilot.call_sign ? ` ("${pilot.call_sign}")` : "";
  return `${rank}${name}${callSign}`.trim() || "-";
};

const getOperationDurationHours = (op: any, assetId?: number | string): number => {
  if (!op) return 0;
  const numAssetId = assetId != null ? Number(assetId) : null;
  const assigned = Array.isArray(op.assets)
    ? (numAssetId ? op.assets.find((a: any) => Number(a.asset_id ?? a.id) === numAssetId) : op.assets[0])
    : null;

  const hours = assigned?.actual_flight_hours ?? assigned?.flight_hours ?? op.duration_hours;
  const num = typeof hours === "string" ? parseFloat(hours) : Number(hours);
  return Number.isFinite(num) && num > 0 ? num : Number(op.duration_hours) || 0;
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

const statusDotColor: Record<string, string> = {
  ongoing: "bg-blue-400",
  completed: "bg-green-400",
  planned: "bg-yellow-400",
  aborted: "bg-red-400",
};

export const MaintenanceAircraftDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authToken = useAppSelector((state) => state.auth.token);
  const { data: asset, isLoading, refetch: refetchAsset } = useGetAssetByIdQuery(id || "");
  const { data: units = [] } = useGetUnitsQuery();
  const { data: enginePositions = [] } = useGetEnginePositionsQuery();
  const { data: avionicCategories = [] } = useGetAvionicCategoriesQuery();

  const [activeTab, setActiveTab] = useState<MaintenanceAircraftTabId>("info");
  const [showFlightLogModal, setShowFlightLogModal] = useState(false);
  const [flightLogInitialValues, setFlightLogInitialValues] = useState<{
    operation_id?: number | null;
    flight_date?: string;
    hours_flown?: number | string;
    remarks?: string;
  } | undefined>(undefined);

  const { data: assetWorkOrders = [] } = useGetWorkOrdersQuery(
    asset?.id ? { asset_id: asset.id } : undefined,
    { skip: !asset?.id },
  );
  const { data: complianceRecords = [] } = useGetComplianceRecordsQuery(
    asset?.id ? { asset_id: asset.id } : undefined,
    { skip: !asset?.id },
  );
  const { data: flightLogs = [] } = useGetFlightLogsQuery(
    asset?.id ? { asset_id: asset.id } : undefined,
    { skip: !asset?.id },
  );

  const [deleteFlightLog, { isLoading: isDeletingFlightLog }] = useDeleteFlightLogMutation();
  const [updateAsset, { isLoading: isUpdating }] = useUpdateAssetMutation();

  const [isEditingComponents, setIsEditingComponents] = useState(false);
  const [isEditingEngines, setIsEditingEngines] = useState(false);
  const [isEditingAvionics, setIsEditingAvionics] = useState(false);

  const [componentsDraft, setComponentsDraft] = useState<Component[]>([]);
  const [enginesDraft, setEnginesDraft] = useState<Engine[]>([]);
  const [avionicsDraft, setAvionicsDraft] = useState<Avionics[]>([]);

  // Sync draft states when asset changes
  useEffect(() => {
    if (asset) {
      setComponentsDraft(asset.components || []);
      setEnginesDraft(asset.engines || []);
      setAvionicsDraft(asset.avionics || []);
    }
  }, [asset]);

  // Realtime updates
  useEffect(() => {
    if (!asset?.id || !authToken) return;
    const echo = getEchoClient(authToken);
    if (!echo) return;

    const channel = echo.channel(`asset.${asset.id}`);
    channel.listen(".AssetUpdated", () => refetchAsset());

    return () => {
      echo.leaveChannel(`asset.${asset.id}`);
    };
  }, [asset?.id, authToken, refetchAsset]);

  const handleOpenFlightLog = (initialValues?: {
    operation_id?: number | null;
    flight_date?: string;
    hours_flown?: number | string;
    remarks?: string;
  }) => {
    setFlightLogInitialValues(initialValues);
    setShowFlightLogModal(true);
  };

  const handleLogOperationDuration = (op: any) => {
    const flightHours = getOperationDurationHours(op, asset?.id);
    const flightDate = op.start_date_time
      ? op.start_date_time.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const pilotName = getOperationPilotName(op, asset?.id);
    const remarks = `Operation: ${op.name || op.description || `#${op.id}`}${
      pilotName && pilotName !== "-" ? ` | Pilot: ${pilotName}` : ""
    }`;

    handleOpenFlightLog({
      operation_id: op.id,
      flight_date: flightDate,
      hours_flown: flightHours > 0 ? flightHours : "",
      remarks,
    });
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

  const handleSaveComponents = async () => {
    if (!asset?.id) return;
    try {
      await updateAsset({
        id: asset.id,
        data: { components: componentsDraft as any },
      }).unwrap();
      setIsEditingComponents(false);
      refetchAsset();
      dispatch(showToast({ message: "Components updated successfully", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update components", type: "error" }));
    }
  };

  const handleSaveEngines = async () => {
    if (!asset?.id) return;
    try {
      await updateAsset({
        id: asset.id,
        data: { engines: enginesDraft as any },
      }).unwrap();
      setIsEditingEngines(false);
      refetchAsset();
      dispatch(showToast({ message: "Engines updated successfully", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update engines", type: "error" }));
    }
  };

  const handleSaveAvionics = async () => {
    if (!asset?.id) return;
    try {
      await updateAsset({
        id: asset.id,
        data: { avionics: avionicsDraft as any },
      }).unwrap();
      setIsEditingAvionics(false);
      refetchAsset();
      dispatch(showToast({ message: "Avionics updated successfully", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update avionics", type: "error" }));
    }
  };

  if (isLoading || !asset) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Icon icon="mdi:loading" className="h-6 w-6 animate-spin text-[#7FD5FF]" />
          <span>Loading aircraft maintenance profile...</span>
        </div>
      </div>
    );
  }

  const unitName = units.find((u) => u.id === asset.unit_id)?.name || "-";
  const configuration = parseConfiguration(asset.configuration);
  const defects = asset.defects || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/maintenance/aircraft")}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#7FD5FF] transition-colors"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          <span>Back to Aircraft Fleet</span>
        </button>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
          Maintenance Engineering Hub
        </div>
      </div>

      {/* Hero Header */}
      <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-xl bg-[#001825] border border-[#0A4D66]/60 flex items-center justify-center text-[#7FD5FF] shadow-inner">
            <Icon icon="mdi:helicopter" className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-wide">
                {asset.tail_number || "NO TAIL"}
              </h1>
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                  asset.serviceability_status === "serviceable"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                    : asset.serviceability_status === "under_maintenance"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                    : "bg-red-500/15 text-red-400 border-red-500/40",
                )}
              >
                {asset.serviceability_status === "serviceable"
                  ? "Airworthy"
                  : formatStatus(asset.serviceability_status)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {asset.name} {asset.model ? `• ${asset.model}` : ""} • SN: {asset.serial_number || "—"} • Unit: {unitName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenFlightLog()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0369A1] hover:bg-[#0284C7] rounded-lg text-xs font-semibold text-white shadow-sm transition-colors"
          >
            <Icon icon="mdi:airplane-clock" className="w-4 h-4" />
            <span>Log Flight Hours</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-8 border-b border-[#0A4D66]/40 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "pb-4 text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === tab.id
                ? "text-[#7FD5FF]"
                : "text-gray-400 hover:text-gray-300",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0369A1] shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="space-y-6">
        {/* 1. Aircraft Information */}
        {activeTab === "info" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard
                label="TOTAL ENGINES"
                value={String(asset.engines?.length || 0)}
                onClick={() => setActiveTab("engines")}
              />
              <StatCard
                label="TOTAL AVIONICS"
                value={String(asset.avionics?.length || 0)}
                onClick={() => setActiveTab("avionics")}
              />
              <StatCard
                label="TOTAL COMPONENTS"
                value={String(asset.components?.length || 0)}
                onClick={() => setActiveTab("components")}
              />
              <StatCard
                label="FLIGHT HOURS"
                value={`${(asset.current_total_hours ?? 0).toLocaleString()} hrs`}
                onClick={() => setActiveTab("flight_history")}
              />
              <StatCard
                label="TOTAL OPERATIONS"
                value={String(asset.operations_count ?? asset.operations?.length ?? 0)}
                onClick={() => setActiveTab("operations")}
              />
              <StatCard
                label="WORK ORDERS"
                value={String(assetWorkOrders.length)}
                onClick={() => setActiveTab("maintenance")}
              />
              <StatCard
                label="DISCREPANCIES"
                value={String(defects.length)}
                onClick={() => setActiveTab("discrepancies")}
              />
              <StatCard
                label="TOTAL CYCLES"
                value={`${(asset.current_total_cycles ?? 0).toLocaleString()} cyc`}
                onClick={() => setActiveTab("flight_history")}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 space-y-4">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                  Aircraft Identification
                </h3>
                <DetailRow label="Tail Number" value={asset.tail_number || "-"} />
                <DetailRow label="Airframe Serial Number" value={asset.serial_number || "-"} />
                <DetailRow label="Manufacturer" value={asset.manufacturer || "-"} />
                <DetailRow label="Model" value={asset.model || "-"} />
                <DetailRow label="Assigned Unit" value={unitName} />
                <DetailRow label="Role" value={configuration.role} />
                <DetailRow label="Seats" value={configuration.seats} />
              </div>

              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 space-y-4">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                  Airworthiness & Counters
                </h3>
                <DetailRow
                  label="Current Total Hours"
                  value={`${(asset.current_total_hours ?? 0).toLocaleString()} hrs`}
                />
                <DetailRow
                  label="Total Cycles"
                  value={`${(asset.current_total_cycles ?? 0).toLocaleString()} cyc`}
                />
                <DetailRow
                  label="Total Landings"
                  value={`${(asset.current_total_landings ?? 0).toLocaleString()} ldg`}
                />
                <DetailRow
                  label="Last Inspection Date"
                  value={formatDate(asset.last_inspection_date)}
                />
                <DetailRow
                  label="Next Annual Inspection"
                  value={formatDate(asset.next_annual_inspection_date)}
                />
                <DetailRow
                  label="Next Type of Inspection"
                  value={asset.next_type_of_inspection || "-"}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Components Tab */}
        {activeTab === "components" && (
          <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Aircraft Components ({asset.components?.length || 0})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Manage components, ATA chapters, and service life limits.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingComponents(!isEditingComponents)}
                  className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                >
                  {isEditingComponents ? "Cancel Edit" : "Edit Components"}
                </button>
                {isEditingComponents && (
                  <button
                    type="button"
                    onClick={handleSaveComponents}
                    disabled={isUpdating}
                    className="rounded bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0284C7] transition-colors"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-gray-200">
                <thead className="bg-[#001825] text-gray-400 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Part Number</th>
                    <th className="text-left px-4 py-3">Serial Number</th>
                    <th className="text-left px-4 py-3">ATA Chapter</th>
                    <th className="text-left px-4 py-3">TSN (Hours)</th>
                    <th className="text-left px-4 py-3">Life Limit</th>
                    <th className="text-left px-4 py-3">Inspection Interval</th>
                    <th className="text-left px-4 py-3">Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/30">
                  {(asset.components || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                        No components logged for this aircraft.
                      </td>
                    </tr>
                  ) : (
                    (asset.components || []).map((comp, idx) => (
                      <tr key={comp.id || idx} className="hover:bg-[#0A4D66]/10">
                        <td className="px-4 py-2.5 font-semibold text-white">{comp.part_number}</td>
                        <td className="px-4 py-2.5">{comp.serial_number}</td>
                        <td className="px-4 py-2.5">{comp.ata_chapter_id || "—"}</td>
                        <td className="px-4 py-2.5">{formatHours(comp.time_since_new)}</td>
                        <td className="px-4 py-2.5">{formatHours(comp.service_life_limit_hours)}</td>
                        <td className="px-4 py-2.5">
                          {formatInspectionInterval(comp.inspection_interval, comp.inspection_interval_unit)}
                        </td>
                        <td className="px-4 py-2.5 capitalize">{comp.maintenance_strategy || "hard-time"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Engines Tab */}
        {activeTab === "engines" && (
          <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Installed Engines & Rotors ({asset.engines?.length || 0})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Turbine engines, APU, and propulsion monitoring.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingEngines(!isEditingEngines)}
                  className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                >
                  {isEditingEngines ? "Cancel Edit" : "Edit Engines"}
                </button>
                {isEditingEngines && (
                  <button
                    type="button"
                    onClick={handleSaveEngines}
                    disabled={isUpdating}
                    className="rounded bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0284C7] transition-colors"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-gray-200">
                <thead className="bg-[#001825] text-gray-400 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Position</th>
                    <th className="text-left px-4 py-3">Model</th>
                    <th className="text-left px-4 py-3">Serial Number</th>
                    <th className="text-left px-4 py-3">TSN (Hours)</th>
                    <th className="text-left px-4 py-3">Life Limit</th>
                    <th className="text-left px-4 py-3">Installed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/30">
                  {(asset.engines || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                        No engines registered.
                      </td>
                    </tr>
                  ) : (
                    (asset.engines || []).map((eng, idx) => {
                      const posName =
                        enginePositions.find((p) => p.id === eng.position_id)?.name ||
                        `Position #${eng.position_id}`;
                      return (
                        <tr key={eng.id || idx} className="hover:bg-[#0A4D66]/10">
                          <td className="px-4 py-2.5 font-semibold text-[#7FD5FF]">{posName}</td>
                          <td className="px-4 py-2.5 text-white font-medium">{eng.model}</td>
                          <td className="px-4 py-2.5">{eng.serial_number}</td>
                          <td className="px-4 py-2.5">{formatHours(eng.time_since_new)}</td>
                          <td className="px-4 py-2.5">{formatHours(eng.service_life_limit)}</td>
                          <td className="px-4 py-2.5">{formatDate(eng.installation_date)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Avionics Tab */}
        {activeTab === "avionics" && (
          <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Avionics Systems ({asset.avionics?.length || 0})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Navigation, communications, radar, and flight instruments.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingAvionics(!isEditingAvionics)}
                  className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                >
                  {isEditingAvionics ? "Cancel Edit" : "Edit Avionics"}
                </button>
                {isEditingAvionics && (
                  <button
                    type="button"
                    onClick={handleSaveAvionics}
                    disabled={isUpdating}
                    className="rounded bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0284C7] transition-colors"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-gray-200">
                <thead className="bg-[#001825] text-gray-400 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Model</th>
                    <th className="text-left px-4 py-3">Serial Number</th>
                    <th className="text-left px-4 py-3">Manufacturer</th>
                    <th className="text-left px-4 py-3">TSN (Hours)</th>
                    <th className="text-left px-4 py-3">Installed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/30">
                  {(asset.avionics || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                        No avionics components listed.
                      </td>
                    </tr>
                  ) : (
                    (asset.avionics || []).map((av, idx) => {
                      const catName =
                        avionicCategories.find((c) => c.id === av.avionic_category_id)?.name ||
                        "General Avionics";
                      return (
                        <tr key={av.id || idx} className="hover:bg-[#0A4D66]/10">
                          <td className="px-4 py-2.5 font-semibold text-[#7FD5FF]">{catName}</td>
                          <td className="px-4 py-2.5 text-white font-medium">{av.model}</td>
                          <td className="px-4 py-2.5">{av.serial_number}</td>
                          <td className="px-4 py-2.5">{av.manufacturer || "—"}</td>
                          <td className="px-4 py-2.5">{formatHours(av.time_since_new)}</td>
                          <td className="px-4 py-2.5">{formatDate(av.installed_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Flight History Tab */}
        {activeTab === "flight_history" && (
          <div className="space-y-6">
            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:airplane-clock" className="w-5 h-5 text-[#7FD5FF]" />
                    <h3 className="text-white text-base font-bold tracking-wide">
                      AIRCRAFT FLIGHT HISTORY & SERVICE METRICS
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Maintenance engineering flight log ledger. Used to calculate airworthiness, remaining service life, and maintenance due intervals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenFlightLog()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
                >
                  <Icon icon="mdi:plus-circle" className="h-4 w-4" />
                  Log Flight Hours
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                <div className="bg-[#001825] p-4 rounded-lg border border-[#0A4D66]/40">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Current Total Hours
                  </div>
                  <div className="text-xl font-bold text-white">
                    {(asset.current_total_hours ?? 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">hrs</span>
                  </div>
                  <div className="text-[11px] text-[#7FD5FF]/70 mt-1">
                    Baseline + Ops + Manual
                  </div>
                </div>

                <div className="bg-[#001825] p-4 rounded-lg border border-[#0A4D66]/40">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Total Cycles
                  </div>
                  <div className="text-xl font-bold text-white">
                    {(asset.current_total_cycles ?? 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">cyc</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Engine & airframe cycles
                  </div>
                </div>

                <div className="bg-[#001825] p-4 rounded-lg border border-[#0A4D66]/40">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Total Landings
                  </div>
                  <div className="text-xl font-bold text-white">
                    {(asset.current_total_landings ?? 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">ldg</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Recorded touch-downs
                  </div>
                </div>

                <div className="bg-[#001825] p-4 rounded-lg border border-[#0A4D66]/40">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Manual Flight Logs
                  </div>
                  <div className="text-xl font-bold text-[#7FD5FF]">
                    {(asset.flight_logs_total_hours ?? 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">hrs</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {flightLogs.length} logged entries
                  </div>
                </div>

                <div className="bg-[#001825] p-4 rounded-lg border border-[#0A4D66]/40">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Flight Ops Recorded
                  </div>
                  <div className="text-xl font-bold text-emerald-400">
                    {asset.operations_total_hours_label || `${asset.operations_total_hours ?? 0} hrs`}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {asset.operations_count ?? asset.operations?.length ?? 0} operations
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase text-[#7FD5FF] tracking-wider">
                  Logged Flight Records ({flightLogs.length})
                </h4>
                {(asset.operations?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("operations")}
                    className="text-xs text-[#7FD5FF] hover:underline inline-flex items-center gap-1"
                  >
                    View Operation History to convert mission durations
                    <Icon icon="mdi:arrow-right" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {flightLogs.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#0A4D66]/60 rounded-xl bg-[#001825]/50">
                  <Icon icon="mdi:airplane-clock" className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-300 font-medium">No flight hours logged yet for this aircraft.</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    Log hours manually or import duration from Operation History to update maintenance counters.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenFlightLog()}
                      className="inline-flex items-center gap-1.5 rounded bg-[#0369A1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0284C7]"
                    >
                      <Icon icon="mdi:plus" className="w-4 h-4" />
                      Log First Flight
                    </button>
                    {(asset.operations?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("operations")}
                        className="inline-flex items-center gap-1.5 rounded border border-[#0A4D66]/60 bg-[#001219] px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white"
                      >
                        Convert from Operations
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#0A4D66]/40">
                  <table className="min-w-full text-sm text-gray-200">
                    <thead className="bg-[#001825] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Flight Date</th>
                        <th className="text-left px-4 py-3 font-medium">Hours</th>
                        <th className="text-left px-4 py-3 font-medium">Landings</th>
                        <th className="text-left px-4 py-3 font-medium">Cycles</th>
                        <th className="text-left px-4 py-3 font-medium">Source / Operation</th>
                        <th className="text-left px-4 py-3 font-medium">Logged By</th>
                        <th className="text-left px-4 py-3 font-medium">Remarks</th>
                        <th className="text-center px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flightLogs.map((log, index) => (
                        <tr
                          key={log.id}
                          tabIndex={log.operation_id ? 0 : undefined}
                          role={log.operation_id ? "button" : undefined}
                          title={log.operation_id ? "Click to view flight operation details" : undefined}
                          onClick={(e) => {
                            if (log.operation_id) {
                              onInteractiveRowClick(e, () => navigate(`/dashboard/operations/${log.operation_id}`));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (log.operation_id) {
                              onInteractiveRowKeyDown(e, () => navigate(`/dashboard/operations/${log.operation_id}`));
                            }
                          }}
                          className={cn(
                            "border-t border-[#0A4D66]/40 transition-colors",
                            index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                            log.operation_id && "cursor-pointer hover:bg-[#0A4D66]/20 focus:outline-none focus:bg-[#0A4D66]/30",
                          )}
                        >
                          <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                            {formatDate(log.flight_date)}
                          </td>
                          <td className="px-4 py-3 text-[#7FD5FF] font-semibold whitespace-nowrap">
                            {log.hours_flown} hrs
                          </td>
                          <td className="px-4 py-3 text-gray-200">{log.landings ?? 0}</td>
                          <td className="px-4 py-3 text-gray-200">{log.cycles ?? 0}</td>
                          <td className="px-4 py-3">
                            {log.operation_id ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/operations/${log.operation_id}`)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#0A4D66]/40 text-[#7FD5FF] hover:bg-[#0A4D66]/70 border border-[#0A4D66]/60 transition-colors"
                                title="View linked Flight Operation"
                              >
                                <Icon icon="mdi:target" className="w-3.5 h-3.5" />
                                Op #{log.operation_id}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-800 text-gray-300 border border-gray-700">
                                Manual Entry
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                            {log.created_by_user
                              ? `${log.created_by_user.firstname ?? ""} ${log.created_by_user.lastname ?? ""}`.trim()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate" title={log.remarks ?? ""}>
                            {log.remarks ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteFlightLog(log.id)}
                              disabled={isDeletingFlightLog}
                              title="Delete flight log"
                              className="text-red-400 hover:text-red-300 disabled:opacity-50 p-1 rounded hover:bg-red-500/10 transition-colors"
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
          </div>
        )}

        {/* 6. Operation History Tab */}
        {activeTab === "operations" && (
          <div className="space-y-4">
            <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#0A4D66]/30 text-[#7FD5FF] mt-0.5">
                  <Icon icon="mdi:shield-airplane" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white text-sm font-bold tracking-wide">
                    FLIGHT OPERATIONS HISTORY (MAINTENANCE LENS)
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Operations belong strictly to Flight Operations and cannot be modified here. Engineers can inspect mission profiles and log operation durations into flight hours.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs text-gray-400">
                  Total Operations: <strong className="text-white">{asset.operations?.length || 0}</strong>
                </span>
              </div>
            </div>

            <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-gray-200">
                  <thead className="bg-[#001825] text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium">Mission / Operation</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">Pilot / Crew</th>
                      <th className="text-left px-4 py-3 font-medium">Timeline</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Duration</th>
                      <th className="text-right px-5 py-3 font-medium">Flight Log Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(asset.operations || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-8 text-center text-gray-400 border-t border-[#0A4D66]/40"
                        >
                          <Icon icon="mdi:airplane-off" className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          No operations recorded for this aircraft.
                        </td>
                      </tr>
                    ) : (
                      asset.operations.map((op, index) => {
                        const loggedLog = flightLogs.find((l) => l.operation_id === op.id);
                        const pilotName = getOperationPilotName(op, asset.id);
                        const durationHrs = getOperationDurationHours(op, asset.id);

                        return (
                          <tr
                            key={op.id ?? index}
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
                            <td className="px-5 py-3 font-medium text-white">
                              <div className="font-semibold text-white group-hover:text-[#7FD5FF]">
                                {op.name || op.description || `Op #${op.id}`}
                              </div>
                              {op.description && op.description !== op.name && (
                                <div className="text-xs text-gray-400 truncate max-w-xs">
                                  {op.description}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-200">
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#001219] border border-[#0A4D66]/50">
                                {op.operation_type?.name ?? "Mission"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Icon icon="mdi:account" className="w-3.5 h-3.5 text-gray-400" />
                                <span>{pilotName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-200 whitespace-nowrap text-xs">
                              <div>{formatDateTime(op.start_date_time)}</div>
                              <div className="text-gray-400">to {formatDateTime(op.end_date_time)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                <span
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    statusDotColor[op.status] || "bg-gray-400",
                                  )}
                                />
                                <span className="capitalize">{op.status}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-200 font-medium whitespace-nowrap">
                              {op.duration_label || (durationHrs > 0 ? `${durationHrs} hrs` : "—")}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              {loggedLog ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab("flight_history");
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                                  title="Logged in Flight History. Click to view."
                                >
                                  <Icon icon="mdi:check-circle" className="w-3.5 h-3.5 text-emerald-400" />
                                  Logged ({loggedLog.hours_flown} hrs)
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLogOperationDuration(op);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                                  title="Convert this operation's flight duration into official airworthiness flight log"
                                >
                                  <Icon icon="mdi:airplane-clock" className="w-4 h-4" />
                                  Log Duration in Flight
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 7. Discrepancies Tab */}
        {activeTab === "discrepancies" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                Reported Discrepancies & Defects ({defects.length})
              </h3>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/assets/${asset.id}/defects/add`)}
                className="inline-flex items-center gap-1.5 rounded bg-[#0369A1] hover:bg-[#0284C7] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                <Icon icon="mdi:alert-circle-outline" className="w-4 h-4" />
                Report Defect
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {defects.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-gray-400 bg-[#001219] rounded-xl border border-[#0A4D66]/40">
                  No discrepancies reported.
                </div>
              ) : (
                defects.map((defect) => (
                  <div
                    key={defect.id}
                    className="bg-[#001219] p-5 rounded-xl border border-[#0A4D66]/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{defect.title}</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          defect.status === "resolved"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400",
                        )}
                      >
                        {defect.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">{defect.description}</p>
                    <div className="text-[11px] text-gray-400 flex items-center justify-between pt-2 border-t border-[#0A4D66]/30">
                      <span>Severity: <strong className="text-white capitalize">{defect.severity}</strong></span>
                      <span>{formatDate(defect.reported_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 8. Maintenance Tracking Tab */}
        {activeTab === "maintenance" && (
          <div className="space-y-6">
            {asset.airworthiness?.status === "grounded" && (
              <div className="rounded-xl border border-red-500/50 bg-red-950/30 p-5">
                <div className="flex items-center gap-2 text-red-300 text-sm font-bold uppercase">
                  <Icon icon="mdi:alert-octagon-outline" className="h-5 w-5" />
                  Grounded — Not Airworthy
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-red-200 list-disc list-inside">
                  {(asset.airworthiness?.reasons || []).map((reason, index) => (
                    <li key={index}>{reason.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Flight hours summary link */}
            <div className="bg-[#001219] p-5 rounded-xl border border-[#0A4D66]/40 flex items-center justify-between">
              <div>
                <h4 className="text-white text-sm font-bold">Flight Hours & Life Cycles</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(asset.current_total_hours ?? 0).toLocaleString()} hrs airframe total • {(asset.current_total_cycles ?? 0).toLocaleString()} cycles logged
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("flight_history")}
                className="inline-flex items-center gap-1.5 text-xs text-[#7FD5FF] hover:underline"
              >
                <span>View Full Flight Ledger</span>
                <Icon icon="mdi:arrow-right" className="w-4 h-4" />
              </button>
            </div>

            {/* Work Orders on this asset */}
            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Assigned Work Orders ({assetWorkOrders.length})
              </h3>
              {assetWorkOrders.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  No work orders found for this aircraft.
                </p>
              ) : (
                <div className="space-y-3">
                  {assetWorkOrders.map((wo) => (
                    <div
                      key={wo.id}
                      onClick={() => navigate(`/maintenance/work-orders/${wo.id}`)}
                      className="p-4 rounded-lg bg-[#001825] border border-[#0A4D66]/40 hover:border-[#7FD5FF]/50 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">
                          #{wo.id} - {wo.title || "Routine Maintenance"}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Tasks: {wo.tasks?.length || 0} • Created: {formatDate(wo.created_at)}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded text-[10px] font-bold uppercase",
                          wo.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-400",
                        )}
                      >
                        {wo.status || "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compliance Records */}
            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Completed Compliance Records ({complianceRecords.length})
              </h3>
              {complianceRecords.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  No compliance history recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-gray-200">
                    <thead className="bg-[#001825] text-gray-400 uppercase">
                      <tr>
                        <th className="text-left px-4 py-3">Task / Program</th>
                        <th className="text-left px-4 py-3">Completed Date</th>
                        <th className="text-left px-4 py-3">Hours at Done</th>
                        <th className="text-left px-4 py-3">Next Due</th>
                        <th className="text-left px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A4D66]/30">
                      {complianceRecords.map((cr, idx) => (
                        <tr key={cr.id || idx} className="hover:bg-[#0A4D66]/10">
                          <td className="px-4 py-2.5 font-medium text-white">
                            {cr.task?.description || cr.remarks || `Record #${cr.id}`}
                          </td>
                          <td className="px-4 py-2.5">{formatDate(cr.completion_date)}</td>
                          <td className="px-4 py-2.5">{formatHours(cr.hours_at_completion)}</td>
                          <td className="px-4 py-2.5">{formatDate(cr.next_due_date)}</td>
                          <td className="px-4 py-2.5 max-w-xs truncate">{cr.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 9. After Action Report Tab */}
        {activeTab === "after_action_report" && (
          <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 space-y-6">
            <div className="flex items-center justify-between border-b border-[#0A4D66]/40 pb-4">
              <div>
                <h3 className="text-[#7FD5FF] text-base font-bold uppercase">
                  Mission Debrief & After Action Reports
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Read-only operational debrief reports filed by crews for this airframe.
                </p>
              </div>
            </div>

            {(() => {
              const opsWithReports = (asset.operations || []).filter(
                (op) => Boolean(op.afterActionReport),
              );

              if (opsWithReports.length === 0) {
                return (
                  <div className="p-8 text-center text-gray-400 border border-dashed border-[#0A4D66]/40 rounded-xl">
                    No after action reports on file for this aircraft.
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {opsWithReports.map((op) => {
                    const report = op.afterActionReport!;
                    return (
                      <div
                        key={op.id}
                        className="p-6 rounded-xl bg-[#001825] border border-[#0A4D66]/40 space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-[#0A4D66]/30 pb-3">
                          <div>
                            <span className="font-bold text-white text-base">
                              Operation: {op.name || `#${op.id}`}
                            </span>
                            <span className="text-xs text-gray-400 ml-3">
                              {formatDate(op.start_date_time)}
                            </span>
                          </div>
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/40 font-medium">
                            SUBMITTED
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 bg-[#001219] rounded border border-[#0A4D66]/20">
                            <span className="text-gray-400 block mb-1">Mission</span>
                            <span className="text-white font-medium capitalize">
                              {report.mission || "-"}
                            </span>
                          </div>
                          <div className="p-3 bg-[#001219] rounded border border-[#0A4D66]/20">
                            <span className="text-gray-400 block mb-1">Task No</span>
                            <span className="text-white font-medium">{report.task_no || "-"}</span>
                          </div>
                          <div className="p-3 bg-[#001219] rounded border border-[#0A4D66]/20">
                            <span className="text-gray-400 block mb-1">Date</span>
                            <span className="text-white font-medium">
                              {report.report_date || op.start_date_time?.slice(0, 10) || "-"}
                            </span>
                          </div>
                          <div className="p-3 bg-[#001219] rounded border border-[#0A4D66]/20">
                            <span className="text-gray-400 block mb-1">Unit / Formation</span>
                            <span className="text-white font-medium truncate block">
                              {report.unit_formation || "-"}
                            </span>
                          </div>
                          <div className="p-3 bg-[#001219] rounded border border-[#0A4D66]/20">
                            <span className="text-gray-400 block mb-1">Infantry No</span>
                            <span className="text-white font-medium">
                              {report.infantry_no || "-"}
                            </span>
                          </div>
                          <div className="p-3 bg-[#001219] rounded border border-[#0A4D66]/20">
                            <span className="text-gray-400 block mb-1">Vehicles No</span>
                            <span className="text-white font-medium">
                              {report.vehicles_no || "-"}
                            </span>
                          </div>
                          <div className="p-3 bg-[#001219] rounded border border-[#0A4D66]/20 col-span-2">
                            <span className="text-gray-400 block mb-1">Ammo Spent</span>
                            <span className="text-white font-medium truncate block">
                              {report.ammo_spent || "-"}
                            </span>
                          </div>
                        </div>

                        {report.activities && (
                          <div className="space-y-1">
                            <h5 className="text-[#7FD5FF] text-xs font-bold uppercase">
                              Activities
                            </h5>
                            <p className="text-gray-300 text-xs bg-[#001219] p-3 rounded border border-[#0A4D66]/20 leading-relaxed">
                              {report.activities}
                            </p>
                          </div>
                        )}

                        {report.contacts && report.contacts.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-[#0A4D66]/30">
                            <h5 className="text-[#7FD5FF] text-xs font-bold uppercase">
                              Enemy Contacts ({report.contacts.length})
                            </h5>
                            <div className="grid grid-cols-1 gap-2">
                              {report.contacts.map((contact, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="bg-[#001219] p-3 rounded border border-[#0A4D66]/20 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-white capitalize">
                                      {contact.engagement.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-gray-400">
                                      {contact.time_of_contact || "-"}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-gray-300">
                                    <span>
                                      <span className="text-gray-500">Location:</span>{" "}
                                      {contact.location}
                                    </span>
                                    <span>
                                      <span className="text-gray-500">Enemy Inf:</span>{" "}
                                      {contact.enemy_infantry_no}
                                    </span>
                                    <span>
                                      <span className="text-gray-500">Enemy Veh:</span>{" "}
                                      {contact.enemy_vehicle_no}
                                    </span>
                                    <span>
                                      <span className="text-gray-500">Targets:</span>{" "}
                                      {contact.targets_infantry_no}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Flight Log Modal */}
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

const StatCard = ({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) => {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 text-left w-full hover:border-[#7FD5FF]/50 transition-colors"
      >
        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center justify-between">
          {label}
          <Icon
            icon="mdi:arrow-top-right"
            className="w-3 h-3 text-[#7FD5FF]/40 group-hover:text-[#7FD5FF] transition-colors"
          />
        </div>
        <div className="text-xl font-bold text-white">{value}</div>
      </button>
    );
  }
  return (
    <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
      <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-[#0A4D66]/20 last:border-0 text-xs">
    <span className="text-gray-400">{label}</span>
    <span className="text-white font-medium">{value}</span>
  </div>
);

export default MaintenanceAircraftDetailsPage;
