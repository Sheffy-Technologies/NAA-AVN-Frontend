import { useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAppDispatch } from "@/app/store";
import { useGetUnitsQuery } from "@/shared/api/units";
import { showToast } from "@/shared/store/toastSlice";
import {
  useDeleteAssetMutation,
  useGetAssetByIdQuery,
  useGetAssetTypesQuery,
  useGetAvionicCategoriesQuery,
  useGetComponentTypesQuery,
  useGetEnginePositionsQuery,
} from "../api";
import { cn } from "@/shared/utils/cn";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";

const TABS = [
  { id: "info", label: "Aircraft Information" },
  { id: "airframe", label: "Airframe" },
  { id: "engines", label: "Engines" },
  { id: "avionics", label: "Avionics" },
  { id: "discrepancies", label: "Discrepancies" },
  { id: "operations", label: "Operations" },
  { id: "maintenance", label: "Maintenance Tracking" },
] as const;

type AssetTabId = (typeof TABS)[number]["id"];

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

const formatDifference = (
  limit: number | string | null | undefined,
  current: number | string | null | undefined,
  suffix: string,
) => {
  const limitValue = Number(limit);
  const currentValue = Number(current);

  if (Number.isNaN(limitValue) || Number.isNaN(currentValue)) return "-";

  return `${Math.max(limitValue - currentValue, 0).toLocaleString()} ${suffix}`;
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

export const AssetDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: asset, isLoading } = useGetAssetByIdQuery(id || "");
  const { data: units = [] } = useGetUnitsQuery();
  const { data: assetTypes = [] } = useGetAssetTypesQuery();
  const { data: enginePositions = [] } = useGetEnginePositionsQuery();
  const { data: componentTypes = [] } = useGetComponentTypesQuery();
  const { data: avionicCategories = [] } = useGetAvionicCategoriesQuery();
  const [deleteAsset, { isLoading: isDeleting }] = useDeleteAssetMutation();
  const [activeTab, setActiveTab] = useState<AssetTabId>("info");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

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

  const handleDownloadPdf = async () => {
    if (!contentRef.current || !asset || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `${asset.name || "asset"}-${asset.id}`,
        backgroundColor: "#00090D",
      });
      dispatch(showToast({ message: "PDF downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
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
  const componentTypeMap = new Map(
    componentTypes.map((type) => [type.id, type.name]),
  );
  const avionicCategoryMap = new Map(
    avionicCategories.map((category) => [category.id, category.name]),
  );
  const configuration = parseConfiguration(asset.configuration);
  const latestOperation = asset.operations[0] ?? null;
  const nextHoursInspection = formatDifference(
    asset.inspection_interval,
    asset.last_inspection_hours,
    "hrs",
  );
  const nextCycleInspection = formatDifference(
    asset.inspection_interval_cycle,
    asset.last_inspection_cycles,
    "cyc",
  );
  const defects = asset.defects ?? [];
  const maintenanceEvents = asset.maintenance_events ?? [];

  return (
    <div ref={contentRef} className="min-h-screen bg-[#00090D] text-white p-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <Icon icon="mdi:arrow-left" className="w-5 h-5" />
          <span>Back</span>
        </button>

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
            onClick={() => navigate("/dashboard/operations/add")}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:clock-outline" className="w-4 h-4" />
            <span>Add Operations</span>
          </button>
          <button
            onClick={() =>
              navigate(`/dashboard/assets/${asset.id}/defects/add`)
            }
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:alert-circle-outline" className="w-4 h-4" />
            <span>Report Defect</span>
          </button>
          <button
            onClick={() => navigate(`/dashboard/assets/${asset.id}/edit`)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            aria-label="Download asset details"
            title="Download asset details"
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors disabled:opacity-60"
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
              className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-8 border-b border-[#0A4D66]/40 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "pb-4 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-[#7FD5FF]"
                : "text-gray-400 hover:text-gray-300",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7FD5FF] shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === "info" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 flex items-center justify-center min-h-[200px] overflow-hidden">
                {assetImageUrl ? (
                  <img
                    src={assetImageUrl}
                    alt={asset.name}
                    className="w-full h-full max-h-[240px] object-contain"
                  />
                ) : (
                  <Icon
                    icon="mdi:helicopter"
                    className="w-32 h-32 text-gray-600"
                  />
                )}
              </div>

              <div className="col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="TOTAL AIRFRAME HRS"
                  value={`${asset.total_airframe_hours} hrs`}
                />
                <StatCard
                  label="TOTAL CYCLES"
                  value={formatCycles(asset.total_cycles)}
                />
                <StatCard
                  label="HRS TO NEXT INSP"
                  value={nextHoursInspection}
                />
                <StatCard
                  label="CYC TO NEXT INSP"
                  value={nextCycleInspection}
                />
                <StatCard
                  label="NEXT ANNUAL INSP"
                  value={formatDate(asset.next_annual_inspection_date)}
                />
                <StatCard
                  label="DISCREPANCIES"
                  value={String(defects.length)}
                />
                <StatCard
                  label="NO. OF OPERATIONS"
                  value={String(
                    asset.operations_count ?? asset.operations.length,
                  )}
                />
                <StatCard
                  label="LAST OPERATION"
                  value={latestOperation?.name ?? "-"}
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
                  <DetailRow label="Assigned Unit" value={unitName} />
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

        {activeTab === "airframe" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Hours Tracking
                </h3>
                <div className="space-y-4">
                  <DetailRow
                    label="Total Flight Hrs"
                    value={formatHours(asset.total_airframe_hours)}
                  />
                  <DetailRow
                    label="Service Life Limit hrs"
                    value={formatHours(asset.service_life_limit)}
                  />
                  <DetailRow
                    label="Life Remaining"
                    value={formatDifference(
                      asset.service_life_limit,
                      asset.total_airframe_hours,
                      "hrs",
                    )}
                  />
                  <DetailRow
                    label="Last Inspection hrs"
                    value={formatHours(asset.last_inspection_hours)}
                  />
                  <DetailRow
                    label="Inspection Interval"
                    value={formatHours(asset.inspection_interval)}
                  />
                  <DetailRow
                    label="Next Inspection Due"
                    value={nextHoursInspection}
                  />
                </div>
              </div>

              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Cycles & Inspections
                </h3>
                <div className="space-y-4">
                  <DetailRow
                    label="Total Cycles"
                    value={formatCycles(asset.total_cycles)}
                  />
                  <DetailRow
                    label="Cycle Limit"
                    value={formatCycles(asset.cycle_limit)}
                  />
                  <DetailRow
                    label="Cycles Remaining"
                    value={formatDifference(
                      asset.cycle_limit,
                      asset.total_cycles,
                      "cyc",
                    )}
                  />
                  <DetailRow
                    label="Last Inspection Cycles"
                    value={formatCycles(asset.last_inspection_cycles)}
                  />
                  <DetailRow
                    label="Inspection Interval (Cycles)"
                    value={formatCycles(asset.inspection_interval_cycle)}
                  />
                  <DetailRow
                    label="Next Cycle Inspection Due"
                    value={nextCycleInspection}
                  />
                  <DetailRow
                    label="Last Major Inspection Date"
                    value={formatDate(asset.last_inspection_date)}
                  />
                  <DetailRow
                    label="Next Type of Inspection"
                    value={asset.next_type_of_inspection || "-"}
                  />
                  <DetailRow
                    label="Next Annual Inspection"
                    value={formatDate(asset.next_annual_inspection_date)}
                  />
                  <DetailRow
                    label="Landings"
                    value={formatNumber(asset.landings)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                Airframe Components
              </h3>
              {asset.components.length === 0 ? (
                <EmptyState message="No airframe components found." />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {asset.components.map((component, index) => (
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
                          label="Total Service Hours"
                          value={formatHours(component.total_service_hours)}
                        />
                        <DetailRow
                          label="Service Life Limit"
                          value={formatHours(
                            component.service_life_limit_hours,
                          )}
                        />
                        <DetailRow
                          label="Last Overhaul Hours"
                          value={formatHours(component.last_overhaul_hours)}
                        />
                        <DetailRow
                          label="Overhaul Limit"
                          value={formatHours(component.overhaul_limit)}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {asset.engines.map((engine, index) => (
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
                    value={
                      engine.category_id ? String(engine.category_id) : "-"
                    }
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
                    label="Time Since New"
                    value={`${engine.time_since_new} hrs`}
                  />
                  <DetailRow
                    label="Time Since Overhaul"
                    value={`${engine.time_since_overhaul} hrs`}
                  />
                  <DetailRow
                    label="Service Life Limit"
                    value={`${engine.service_life_limit} hrs`}
                  />
                  <DetailRow
                    label="Overhaul Limit"
                    value={`${engine.overhaul_limit} hrs`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "avionics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {asset.avionics.map((avionic, index) => (
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
                    label="Manufacturer"
                    value={avionic.manufacturer || "-"}
                  />
                  <DetailRow
                    label="Total Service Hours"
                    value={formatHours(avionic.total_service_hours)}
                  />
                  <DetailRow
                    label="Service Life Limit"
                    value={formatHours(avionic.service_life_limit)}
                  />
                  <DetailRow
                    label="Last Overhaul Hours"
                    value={formatHours(avionic.last_overhaul_hours)}
                  />
                  <DetailRow
                    label="Overhaul Limit"
                    value={formatHours(avionic.overhaul_limit)}
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
                <thead className="bg-[#021a27] text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Purpose</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Start</th>
                    <th className="text-left px-4 py-3 font-medium">End</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">
                      Duration
                    </th>
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
                        onClick={() =>
                          navigate(`/dashboard/operations/${op.id}`)
                        }
                        className={cn(
                          "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors",
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
      </div>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">
      {label}
    </div>
    <div className="text-xl font-bold text-white">{value}</div>
  </div>
);

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
