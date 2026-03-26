import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  useGetAssetsQuery,
  useUpdateAssetMutation,
  type Asset,
} from "@/features/assets/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { cn } from "@/shared/utils/cn";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

const TABS = [
  { id: "aircraft", label: "Aircrafts", icon: "mdi:airplane" },
  { id: "vehicle", label: "Vehicles", icon: "mdi:car" },
  { id: "airbase", label: "Airbases", icon: "mdi:airport" },
  { id: "facility", label: "Facilities", icon: "mdi:office-building" },
  { id: "equipment", label: "Equipments", icon: "mdi:tools" },
];

export const AssetsPage = () => {
  const [activeTab, setActiveTab] = useState("aircraft");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const { data: assets, isLoading } = useGetAssetsQuery({ type: activeTab });
  const { data: units } = useGetUnitsQuery();
  const [updateAsset] = useUpdateAssetMutation();

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

  // Filter assets based on active tab
  const filteredAssets =
    assets?.filter((asset) => asset.type === activeTab) || [];

  // Stats
  const total = filteredAssets.length;
  const serviceable = filteredAssets.filter(
    (a) => a.serviceability_status === "serviceable",
  ).length;
  const maintenance = filteredAssets.filter(
    (a) => a.serviceability_status === "under_maintenance",
  ).length;
  const grounded = filteredAssets.filter(
    (a) => a.serviceability_status === "grounded",
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

  const calculateHoursToLimit = (next: string, current: string) => {
    const nextVal = parseFloat(next);
    const currentVal = parseFloat(current);
    if (isNaN(nextVal) || isNaN(currentVal)) return "-";
    const diff = nextVal - currentVal;
    return diff > 0 ? `${diff.toFixed(0)} hrs` : "0 hrs";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8 border-b border-[#0A4D66]/40 w-full">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7FD5FF] shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
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
            <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
              <button className="px-3 py-1.5 bg-[#0A4D66] text-white rounded text-xs font-medium capitalize">
                {TABS.find((t) => t.id === activeTab)?.label}
              </button>
              <button className="px-3 py-1.5 text-gray-400 hover:text-white rounded text-xs font-medium">
                Operations
              </button>
            </div>

            {/* View Icons */}
            <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
              <button
                onClick={() => setViewMode("table")}
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
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:view-grid" className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1" />

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto max-w-full">
              <span className="text-xs text-[#7FD5FF] cursor-pointer hover:underline whitespace-nowrap bg-[#001825] px-2 py-1 rounded-full border border-[#0A4D66]/40">
                12 Reset Filter
              </span>
              <select className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]">
                <option>All Units</option>
              </select>
              <select className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]">
                <option>All Status</option>
              </select>
              <select className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]">
                <option>All Aircraft Type</option>
              </select>
              <select className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]">
                <option>Defect</option>
              </select>
              <button className="p-1.5 text-gray-400 hover:text-white">
                <Icon icon="mdi:download" className="w-4 h-4" />
              </button>
            </div>

            {/* Add Button */}
            <Link
              to="/dashboard/assets/add"
              className="flex items-center space-x-2 bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 text-[#00090D] px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
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
              <div className="w-2 h-2 rounded-full bg-[#7FD5FF]" />
              <span className="text-gray-400">Total:</span>
              <span className="text-white font-bold">{total}</span>
            </div>
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-400">Serviceable:</span>
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

        {/* View Content */}
        {viewMode === "table" ? (
          <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                  <th className="px-6 py-4 font-medium">Tail No.</th>
                  <th className="px-6 py-4 font-medium">Aircraft Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Unit</th>
                  <th className="px-6 py-4 font-medium">Airframe Hrs</th>
                  <th className="px-6 py-4 font-medium">Engine Hrs</th>
                  <th className="px-6 py-4 font-medium">
                    Hrs to Limiting Item
                  </th>
                  <th className="px-6 py-4 font-medium">Limiting Item</th>
                  <th className="px-6 py-4 font-medium">Defects</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
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
                      <td className="px-6 py-4 font-medium text-white">
                        {asset.tail_number}
                      </td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#0A4D66]/40 flex items-center justify-center">
                          <Icon
                            icon={
                              asset.type === "aircraft"
                                ? "mdi:helicopter"
                                : "mdi:cube"
                            }
                            className="w-5 h-5 text-[#7FD5FF]"
                          />
                        </div>
                        <span className="font-bold text-white">
                          {asset.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{asset.model}</td>
                      <td className="px-6 py-4 text-gray-300">
                        {getUnitName(asset.unit_id)}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {parseFloat(
                          asset.total_airframe_hours,
                        ).toLocaleString()}{" "}
                        hrs
                      </td>
                      <td className="px-6 py-4 text-gray-300">-</td>
                      <td className="px-6 py-4 text-gray-300">
                        {calculateHoursToLimit(
                          asset.next_annual_inspection_date,
                          asset.total_airframe_hours,
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {asset.next_type_of_inspection}
                      </td>
                      <td className="px-6 py-4 text-gray-300">No</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "flex items-center gap-1.5",
                            asset.serviceability_status === "serviceable"
                              ? "text-emerald-400"
                              : asset.serviceability_status ===
                                  "under_maintenance"
                                ? "text-amber-400"
                                : "text-red-400",
                          )}
                        >
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              asset.serviceability_status === "serviceable"
                                ? "bg-emerald-500"
                                : asset.serviceability_status ===
                                    "under_maintenance"
                                  ? "bg-amber-500"
                                  : "bg-red-500",
                            )}
                          />
                          {formatStatus(asset.serviceability_status)}
                        </span>
                      </td>
                      <td
                        className="relative px-6 py-4 text-right"
                        ref={
                          openActionId === asset.id ? actionMenuRef : undefined
                        }
                      >
                        <button
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
                              <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400">
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
              filteredAssets.map((asset) => (
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

                  {/* Header */}
                  <div className="flex items-start justify-between pl-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded bg-[#0A4D66]/40 flex items-center justify-center">
                        <Icon
                          icon={
                            asset.type === "aircraft"
                              ? "mdi:helicopter"
                              : "mdi:cube"
                          }
                          className="w-8 h-8 text-[#7FD5FF]"
                        />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">
                          {asset.name}
                        </h3>
                        <p className="text-xs text-gray-400">{asset.model}</p>
                      </div>
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
                            : asset.serviceability_status ===
                                "under_maintenance"
                              ? "bg-amber-500"
                              : "bg-red-500",
                        )}
                      />
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-3 gap-2 pl-2 text-xs bg-[#001825] p-3 rounded-lg border border-[#0A4D66]/20">
                    <div>
                      <span className="text-gray-500 block mb-1">Tail No.</span>
                      <span className="text-white font-medium">
                        {asset.tail_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">Type</span>
                      <span className="text-white font-medium">
                        {asset.model}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">Defect</span>
                      <span className="text-white font-medium">No</span>
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
