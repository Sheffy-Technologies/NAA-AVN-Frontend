import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import * as XLSX from "xlsx";
import {
  useGetAssetsQuery,
  useGetFacilitiesQuery,
  useGetVehicleTypesQuery,
  useGetVehiclesQuery,
  useUpdateAssetMutation,
  useDeleteAssetMutation,
  type Asset,
  type Facility,
  type Vehicle,
} from "@/features/assets/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetUnitsQuery } from "@/shared/api/units";
import { cn } from "@/shared/utils/cn";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { FacilitiesMapView } from "@/features/assets/components/FacilitiesMapView";

const TABS = [
  { id: "aircraft", label: "Aircrafts", icon: "mdi:airplane" },
  { id: "vehicle", label: "Vehicles", icon: "mdi:car" },
  // { id: "airbase", label: "Airbases", icon: "mdi:airport" },
  { id: "facility", label: "Facilities", icon: "mdi:office-building" },
  // { id: "equipment", label: "Equipments", icon: "mdi:tools" },
];

export const AssetsPage = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState("aircraft");
  const [viewMode, setViewMode] = useState<"table" | "grid" | "map">("table");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [selectedOperationStatus, setSelectedOperationStatus] =
    useState<string>("all");
  const { data: assets, isLoading: isAssetsLoading } = useGetAssetsQuery(
    { type: activeTab },
    { skip: activeTab === "vehicle" || activeTab === "facility" },
  );
  const { data: vehicles, isLoading: isVehiclesLoading } = useGetVehiclesQuery(
    undefined,
    { skip: activeTab !== "vehicle" },
  );
  const { data: vehicleTypes } = useGetVehicleTypesQuery(undefined, {
    skip: activeTab !== "vehicle",
  });
  const { data: facilities, isLoading: isFacilitiesLoading } =
    useGetFacilitiesQuery(undefined, {
      skip: activeTab !== "facility",
    });
  const { data: units } = useGetUnitsQuery();
  const [updateAsset] = useUpdateAssetMutation();
  const [deleteAsset] = useDeleteAssetMutation();

  const navigate = useNavigate();
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [statusMenuForId, setStatusMenuForId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLTableCellElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(actionMenuRef, () => {
    setOpenActionId(null);
    setStatusMenuForId(null);
  });

  useClickOutside(statusMenuRef, () => {
    setStatusMenuForId(null);
  });

  const handleDeleteAsset = async (id: number, name: string) => {
    if (!window.confirm(`Delete ${name}? This action cannot be undone.`)) return;
    try {
      await deleteAsset(id).unwrap();
      dispatch(showToast({ message: "Asset deleted successfully", type: "success" }));
      setOpenActionId(null);
    } catch {
      dispatch(showToast({ message: "Failed to delete asset", type: "error" }));
    }
  };

  const handleToggleActions = (id: number) => {
    setOpenActionId((current) => (current === id ? null : id));
    setStatusMenuForId(null);
  };

  const handleOpenDetail = (id: number) => {
    navigate(`/dashboard/assets/${id}`);
    setOpenActionId(null);
  };

  const handleChangeStatus = async (
    id: number,
    status: Asset["serviceability_status"],
  ) => {
    try {
      await updateAsset({
        id,
        data: {
          serviceability_status: status,
        },
      }).unwrap();
      setStatusMenuForId(null);
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const STATUS_OPTIONS: Array<Asset["serviceability_status"]> = [
    "serviceable",
    "under_maintenance",
    "grounded",
  ];

  const normalizeOperationStatus = (status?: string | null) => {
    if (!status) return "operational";

    const normalized = status.toLowerCase().trim().replace(/\s+/g, "_");

    if (normalized === "serviceable") return "operational";
    if (normalized === "under_maintenance") return "under_maintenance";
    if (normalized === "grounded") return "grounded";

    return normalized;
  };

  const isLoading =
    activeTab === "vehicle"
      ? isVehiclesLoading
      : activeTab === "facility"
        ? isFacilitiesLoading
        : isAssetsLoading;

  // Filter assets based on active tab. Vehicles/facilities use dedicated endpoints.
  const tabAssets: Asset[] =
    activeTab === "vehicle"
      ? (vehicles ?? []).map((vehicle: Vehicle) => ({
          id: vehicle.id,
          type: "vehicle",
          unit_id: vehicle.unit_id ?? 0,
          name: vehicle.name,
          image: vehicle.photo ?? null,
          image_url: vehicle.photo_url ?? vehicle.photo ?? null,
          serial_number: vehicle.serial_number || "-",
          model: vehicle.registration_number || "-",
          configuration: [],
          serviceability_status:
            vehicle.serviceability_status ||
            ((vehicle.status as Asset["serviceability_status"]) ?? "serviceable"),
          tail_number: vehicle.registration_number || "-",
          total_airframe_hours: "0",
          service_life_limit: "0",
          last_inspection_hours: "0",
          inspection_interval: "0",
          next_annual_inspection_date: "0",
          next_type_of_inspection: "-",
          last_inspection_date: "-",
          landings: "0",
          operation_status: normalizeOperationStatus(
            vehicle.operation_status ??
              vehicle.status ??
              vehicle.serviceability_status,
          ),
          manufacturer: "-",
          purchase_date: "-",
          created_at: vehicle.created_at || "",
          updated_at: vehicle.updated_at || "",
          operations_total_hours: 0,
          operations_total_hours_label: "0",
        }))
      : activeTab === "facility"
        ? (facilities ?? []).map((facility: Facility) => ({
            id: facility.id,
            type: "facility",
            unit_id: facility.unit_id ?? 0,
            name: facility.name,
            image: facility.image ?? null,
            image_url: facility.image_url ?? facility.image ?? null,
            serial_number: "-",
            model: "Facility",
            configuration: [],
            serviceability_status:
              facility.serviceability_status ||
              ((facility.status as Asset["serviceability_status"]) ??
                "serviceable"),
            tail_number: "-",
            total_airframe_hours: "0",
            service_life_limit: "0",
            last_inspection_hours: "0",
            inspection_interval: "0",
            next_annual_inspection_date: "0",
            next_type_of_inspection: "-",
            last_inspection_date: "-",
            landings: "0",
            operation_status: normalizeOperationStatus(
              facility.operation_status ??
                facility.status ??
                facility.serviceability_status,
            ),
            manufacturer: "-",
            purchase_date: "-",
            created_at: facility.created_at || "",
            updated_at: facility.updated_at || "",
            operations_total_hours: 0,
            operations_total_hours_label: "0",
          }))
      :
          assets
            ?.filter((asset) => asset.type === activeTab)
            .map((asset) => ({
              ...asset,
              operation_status: normalizeOperationStatus(
                asset.operation_status ?? asset.serviceability_status,
              ),
            })) || [];

  const filteredAssets = tabAssets.filter((asset) => {
    const matchesUnit =
      selectedUnitId === "all" || String(asset.unit_id) === selectedUnitId;
    const matchesOperationStatus =
      activeTab !== "aircraft" ||
      selectedOperationStatus === "all" ||
      asset.operation_status === selectedOperationStatus;

    return matchesUnit && matchesOperationStatus;
  });

  // Stats
  const total = filteredAssets.length;
  const serviceable = filteredAssets.filter(
    (a) => a.operation_status === "operational",
  ).length;
  const maintenance = filteredAssets.filter(
    (a) => a.operation_status === "under_maintenance",
  ).length;
  const grounded = filteredAssets.filter(
    (a) => a.operation_status === "grounded",
  ).length;

  const formatStatus = (status?: string | null) => {
    if (!status) return "-";

    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getUnitName = (unitId: number) => {
    return units?.find((u) => u.id === unitId)?.name || "-";
  };

  const getVehicleTypeName = (vehicleTypeId?: number | null) => {
    if (!vehicleTypeId) return "-";
    const match = vehicleTypes?.find((type) => type.id === vehicleTypeId);
    return match?.name ? `${match.name} (#${vehicleTypeId})` : `#${vehicleTypeId}`;
  };

  const filteredVehicles =
    activeTab === "vehicle"
      ? (vehicles ?? []).filter((vehicle) => {
          const matchesUnit =
            selectedUnitId === "all" ||
            String(vehicle.unit_id ?? "") === selectedUnitId;
          const vehicleOperationStatus = normalizeOperationStatus(
            vehicle.operation_status ?? vehicle.status ?? vehicle.serviceability_status,
          );
          const matchesOperationStatus =
            selectedOperationStatus === "all" ||
            vehicleOperationStatus === selectedOperationStatus;

          return matchesUnit && matchesOperationStatus;
        })
      : [];

  const getAssetImageUrl = (asset: Asset) =>
    asset.image_url || asset.image || "";

  const handleDownloadExcel = () => {
    if (filteredAssets.length === 0) {
      dispatch(
        showToast({
          message: "No assets available to export",
          type: "error",
        }),
      );
      return;
    }

    const rows = filteredAssets.map((asset) => ({
      Name: asset.name,
      Type: asset.model,
      Unit: getUnitName(asset.unit_id),
      "Serviceability Status": formatStatus(asset.serviceability_status),
      "Operation Status": formatStatus(asset.operation_status),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
    XLSX.writeFile(
      workbook,
      `assets-${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8 border-b border-[#0A4D66]/40 w-full">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setViewMode("table");
                if (tab.id !== "aircraft") {
                  setSelectedUnitId("all");
                  setSelectedOperationStatus("all");
                }
              }}
              className={cn(
                "flex items-center space-x-2 pb-4 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-[#7FD5FF]"
                  : "text-gray-400 hover:text-gray-300",
              )}
            >
              <Icon icon={tab.icon} className="w-5 h-5" />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0369A1] shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
          {/* Top Row: View Switcher, Stats, Filters, Add Button */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* View Icons */}
            <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
              <button
                onClick={() => setViewMode("table")}
                title="Table view"
                aria-label="Switch to table view"
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "table"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:table" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="Grid view"
                aria-label="Switch to grid view"
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:view-grid" className="w-4 h-4" />
              </button>
              {activeTab === "facility" && (
                <button
                  onClick={() => setViewMode("map")}
                  title="Map view"
                  aria-label="Switch to map view"
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "map"
                      ? "bg-[#0A4D66] text-white"
                      : "text-gray-400 hover:text-white",
                  )}
                >
                  <Icon icon="mdi:map" className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1" />

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto max-w-full">
              {activeTab === "aircraft" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUnitId("all");
                      setSelectedOperationStatus("all");
                    }}
                    className="text-xs text-[#7FD5FF] cursor-pointer hover:underline whitespace-nowrap bg-[#001825] px-2 py-1 rounded-full border border-[#0A4D66]/40"
                  >
                    Reset Filter
                  </button>
                  <select
                    title="Filter assets by unit"
                    aria-label="Filter assets by unit"
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                  >
                    <option value="all">All Units</option>
                    {(units ?? []).map((unit) => (
                      <option key={unit.id} value={String(unit.id)}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <select
                    title="Filter assets by operation status"
                    aria-label="Filter assets by operation status"
                    value={selectedOperationStatus}
                    onChange={(e) => setSelectedOperationStatus(e.target.value)}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                  >
                    <option value="all">All Operation Status</option>
                    <option value="operational">Operational</option>
                    <option value="under_maintenance">Under Maintenance</option>
                    <option value="grounded">Grounded</option>
                  </select>
                </>
              )}
              <button
                type="button"
                onClick={handleDownloadExcel}
                title="Download filtered assets Excel"
                aria-label="Download filtered assets Excel"
                className="p-1.5 text-gray-400 hover:text-white"
              >
                <Icon icon="mdi:download" className="w-4 h-4" />
              </button>
            </div>

            {/* Add Button */}
            <Link
              to={
                activeTab === "vehicle"
                  ? "/dashboard/assets/vehicles/add"
                  : activeTab === "facility"
                    ? "/dashboard/assets/facilities/add"
                  : "/dashboard/assets/add"
              }
              className="flex items-center space-x-2 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>
                Add {TABS.find((t) => t.id === activeTab)?.label.slice(0, -1)}
              </span>
            </Link>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-6 text-sm border-t border-[#0A4D66]/40 pt-4 overflow-x-auto">
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-[#0369A1]" />
              <span className="text-gray-400">Total:</span>
              <span className="text-white font-bold">{total}</span>
            </div>
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-400">Operational:</span>
              <span className="text-white font-bold">{serviceable}</span>
            </div>
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-400">Under Maintenance:</span>
              <span className="text-white font-bold">{maintenance}</span>
            </div>
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-400">Grounded:</span>
              <span className="text-white font-bold">{grounded}</span>
            </div>
          </div>
        </div>

        {/* Facilities Map View */}
        {viewMode === "map" && activeTab === "facility" && (
          <FacilitiesMapView
            facilities={facilities ?? []}
            onSelectFacility={(id) => navigate(`/dashboard/assets/${id}`)}
          />
        )}

        {/* Table / Grid View Content */}
        {viewMode !== "map" && (viewMode === "table" ? (
          <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-hidden overflow-x-auto">
            {activeTab === "vehicle" ? (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="px-6 py-4 font-medium">Photo</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Registration Number</th>
                    <th className="px-6 py-4 font-medium">Serial Number</th>
                    <th className="px-6 py-4 font-medium">Vehicle Type</th>
                    <th className="px-6 py-4 font-medium">Unit</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        No vehicles found
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((vehicle, idx) => {
                      const operationStatus = normalizeOperationStatus(
                        vehicle.operation_status ??
                          vehicle.status ??
                          vehicle.serviceability_status,
                      );

                      return (
                        <tr
                          key={vehicle.id}
                          className={cn(
                            "hover:bg-[#0A4D66]/20 transition-colors",
                            idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="w-8 h-8 rounded bg-[#0A4D66]/40 flex items-center justify-center overflow-hidden">
                              {vehicle.photo_url || vehicle.photo ? (
                                <img
                                  src={vehicle.photo_url || vehicle.photo || ""}
                                  alt={vehicle.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Icon icon="mdi:car" className="w-5 h-5 text-[#7FD5FF]" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-white">{vehicle.name}</td>
                          <td className="px-6 py-4 text-gray-300">
                            {vehicle.registration_number || "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {vehicle.serial_number || "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {getVehicleTypeName(vehicle.vehicle_type_id)}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {getUnitName(vehicle.unit_id ?? 0)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                "flex items-center gap-1.5",
                                operationStatus === "operational"
                                  ? "text-emerald-400"
                                  : operationStatus === "under_maintenance"
                                  ? "text-amber-400"
                                  : "text-red-400",
                              )}
                            >
                              <div
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  operationStatus === "operational"
                                    ? "bg-emerald-500"
                                    : operationStatus === "under_maintenance"
                                    ? "bg-amber-500"
                                    : "bg-red-500",
                                )}
                              />
                              {formatStatus(operationStatus)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/dashboard/assets/vehicles/${vehicle.id}/edit`)
                              }
                              className="text-[#7FD5FF] hover:text-white text-xs"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="px-6 py-4 font-medium"> Name</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Unit</th>
                    <th className="px-6 py-4 font-medium">Defects</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : filteredAssets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No assets found
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset, idx) => (
                      <tr
                        key={asset.id}
                        className={cn(
                          "hover:bg-[#0A4D66]/20 transition-colors",
                          idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                        )}
                      >
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-[#0A4D66]/40 flex items-center justify-center overflow-hidden">
                            {getAssetImageUrl(asset) ? (
                              <img
                                src={getAssetImageUrl(asset)}
                                alt={asset.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Icon
                                icon={
                                  asset.type === "aircraft"
                                    ? "mdi:helicopter"
                                    : "mdi:cube"
                                }
                                className="w-5 h-5 text-[#7FD5FF]"
                              />
                            )}
                          </div>
                          <span className="font-bold text-white">
                            {asset.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300">{asset.model}</td>
                        <td className="px-6 py-4 text-gray-300">
                          {getUnitName(asset.unit_id)}
                        </td>
                        <td className="px-6 py-4 text-gray-300">No</td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "flex items-center gap-1.5",
                              asset.operation_status === "operational"
                                ? "text-emerald-400"
                                : asset.operation_status ===
                                    "under_maintenance"
                                  ? "text-amber-400"
                                  : "text-red-400",
                            )}
                          >
                            <div
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                asset.operation_status === "operational"
                                  ? "bg-emerald-500"
                                  : asset.operation_status ===
                                      "under_maintenance"
                                    ? "bg-amber-500"
                                    : "bg-red-500",
                              )}
                            />
                            {formatStatus(asset.operation_status)}
                          </span>
                        </td>
                        <td
                          className="relative px-6 py-4 text-right"
                          ref={
                            openActionId === asset.id ? actionMenuRef : undefined
                          }
                        >
                          <button
                            type="button"
                            title="Open actions"
                            aria-label="Open actions"
                            onClick={() => handleToggleActions(asset.id)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Icon
                              icon="mdi:dots-horizontal"
                              className="w-5 h-5"
                            />
                          </button>

                          {openActionId === asset.id && (
                            <div className="absolute right-8 top-8 z-50 w-48 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl text-left">
                              <div className="py-1 text-xs text-gray-200">
                                <button
                                  onClick={() => handleOpenDetail(asset.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                                >
                                  <Icon
                                    icon="mdi:eye-outline"
                                    className="w-4 h-4 text-gray-300"
                                  />
                                  <span>View</span>
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/dashboard/assets/${asset.id}/edit`)
                                  }
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                                >
                                  <Icon
                                    icon="mdi:pencil-outline"
                                    className="w-4 h-4 text-gray-300"
                                  />
                                  <span>Edit</span>
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setStatusMenuForId((current) =>
                                        current === asset.id ? null : asset.id,
                                      );
                                    }}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Icon
                                        icon="mdi:swap-horizontal"
                                        className="w-4 h-4 text-gray-300"
                                      />
                                      <span>Update Status</span>
                                    </span>
                                    <Icon
                                      icon="mdi:chevron-right"
                                      className="w-4 h-4 text-gray-400"
                                    />
                                  </button>
                                  {statusMenuForId === asset.id && (
                                    <div
                                      ref={statusMenuRef}
                                      className="absolute top-0 right-full mr-1 w-40 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl"
                                    >
                                      {STATUS_OPTIONS.map((status) => (
                                        <button
                                          key={status}
                                          onClick={() =>
                                            handleChangeStatus(asset.id, status)
                                          }
                                          className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#0A4D66]/40"
                                        >
                                          <span>{formatStatus(status)}</span>
                                          {asset.serviceability_status ===
                                            status && (
                                            <Icon
                                              icon="mdi:check"
                                              className="w-4 h-4 text-emerald-400"
                                            />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left">
                                  <Icon
                                    icon="mdi:clock-outline"
                                    className="w-4 h-4 text-gray-300"
                                  />
                                  <span>Log Flight Hrs</span>
                                </button>
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400"
                                  onClick={() => handleDeleteAsset(asset.id, asset.name)}
                                >
                                  <Icon
                                    icon="mdi:trash-can-outline"
                                    className="w-4 h-4"
                                  />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                Loading...
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                No assets found
              </div>
            ) : (
              filteredAssets.map((asset) => {
                const imageUrl = getAssetImageUrl(asset);
                const assetTypeLabel =
                  activeTab === "vehicle"
                    ? getVehicleTypeName(
                        (vehicles ?? []).find((v) => v.id === asset.id)
                          ?.vehicle_type_id,
                      )
                    : asset.model || "-";
                const registrationLabel =
                  asset.tail_number && asset.tail_number !== "-"
                    ? asset.tail_number
                    : asset.type === "facility"
                      ? "N/A"
                      : "-";

                return (
                  <div
                    key={asset.id}
                    className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden group hover:border-[#7FD5FF]/50 transition-colors"
                  >
                    {/* Status Strip */}
                    <div
                      className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        asset.serviceability_status === "serviceable"
                          ? "bg-emerald-500"
                          : asset.serviceability_status === "under_maintenance"
                            ? "bg-amber-500"
                            : "bg-red-500",
                      )}
                    />

                    <div className="pl-2">
                      <div className="h-36 rounded-lg border border-[#0A4D66]/25 bg-[#001825] overflow-hidden flex items-center justify-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon
                            icon={
                              asset.type === "aircraft"
                                ? "mdi:helicopter"
                                : asset.type === "vehicle"
                                  ? "mdi:car"
                                  : "mdi:office-building"
                            }
                            className="w-12 h-12 text-[#7FD5FF]"
                          />
                        )}
                      </div>
                    </div>

                    {/* Header */}
                    <div className="flex items-start justify-between pl-2">
                      <div>
                        <h3 className="text-white font-bold text-base leading-tight">
                          {asset.name}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">{assetTypeLabel}</p>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium flex items-center gap-1.5",
                          asset.serviceability_status === "serviceable"
                            ? "text-emerald-400"
                            : asset.serviceability_status === "under_maintenance"
                              ? "text-amber-400"
                              : "text-red-400",
                        )}
                      >
                        {formatStatus(asset.serviceability_status)}
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            asset.serviceability_status === "serviceable"
                              ? "bg-emerald-500"
                              : asset.serviceability_status === "under_maintenance"
                                ? "bg-amber-500"
                                : "bg-red-500",
                          )}
                        />
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 pl-2 text-xs bg-[#001825] p-3 rounded-lg border border-[#0A4D66]/20">
                      <div>
                        <span className="text-gray-500 block mb-1">Unit</span>
                        <span className="text-white font-medium">
                          {getUnitName(asset.unit_id)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">Operation</span>
                        <span className="text-white font-medium">
                          {formatStatus(asset.operation_status)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">
                          {asset.type === "aircraft"
                            ? "Tail Number"
                            : asset.type === "vehicle"
                              ? "Registration"
                              : "Identifier"}
                        </span>
                        <span className="text-white font-medium">{registrationLabel}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">Serial Number</span>
                        <span className="text-white font-medium">
                          {asset.serial_number || "-"}
                        </span>
                      </div>
                    </div>

                    <div className="pl-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(asset.id)}
                        className="inline-flex items-center gap-1 text-xs text-[#7FD5FF] hover:text-white"
                      >
                        <Icon icon="mdi:open-in-new" className="w-4 h-4" />
                        View details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
