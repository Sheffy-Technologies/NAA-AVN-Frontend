import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetAssetByIdQuery } from "../api";
import { cn } from "@/shared/utils/cn";

const TABS = [
  { id: "info", label: "Aircraft Information" },
  { id: "engines", label: "Engines" },
  { id: "components", label: "Components" },
  { id: "defects", label: "Defects" },
  { id: "operations", label: "Operations" },
  { id: "history", label: "Log History" },
];

export const AssetDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: asset, isLoading } = useGetAssetByIdQuery(id || "");
  const [activeTab, setActiveTab] = useState("info");

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

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const assetImageUrl = asset.image_url || asset.image || "";

  return (
    <div className="min-h-screen bg-[#00090D] text-white p-6 pb-20">
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
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-red-400 transition-colors">
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
            <span>Delete</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors">
            <Icon icon="mdi:refresh" className="w-4 h-4" />
            <span>Update status</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors">
            <Icon icon="mdi:clock-outline" className="w-4 h-4" />
            <span>Log Flight hrs</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors">
            <Icon icon="mdi:alert-circle-outline" className="w-4 h-4" />
            <span>Report Defect</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors">
            <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors">
            <Icon icon="mdi:download" className="w-4 h-4" />
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
            {/* Top Stats Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Image Card */}
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

              {/* Stats Cards */}
              <div className="col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="TOTAL AIRFRAME HRS"
                  value={`${asset.total_airframe_hours} hrs`}
                />
                <StatCard label="TOTAL ENGINE HRS" value="2,300 hrs" />{" "}
                {/* Mocked as not in Asset directly? */}
                <StatCard label="HRS TO LIMITING ITEM" value="70 hrs" />
                <StatCard label="LIMITING ITEM" value="Engine 1" />
                <StatCard
                  label="NEXT ANNUAL INSP"
                  value={`${asset.next_annual_inspection_date} hrs`}
                />
                <StatCard
                  label="DEFECTS"
                  value={asset.maintenance_events.length > 0 ? "Yes" : "No"}
                />
                <StatCard
                  label="NO. OF OPERATIONS"
                  value={asset.operations.length.toString()}
                />
                <StatCard label="LAST OPERATION" value="OP Eagle Watch" />
              </div>
            </div>

            {/* Details Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Identification */}
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Aircraft Identification
                </h3>
                <div className="space-y-4">
                  <DetailRow
                    label="Aircraft Type"
                    value={asset.type.toUpperCase()}
                  />
                  <DetailRow label="Aircraft Name" value={asset.name} />
                  <DetailRow label="Tail No" value={asset.tail_number} />
                  <DetailRow
                    label="Serial Number"
                    value={asset.serial_number}
                  />
                  <DetailRow label="Aircraft ID" value={`ID-${asset.id}`} />
                  <DetailRow label="Internal ID" value={`INT-${asset.id}`} />
                  <DetailRow label="Military Registration" value="ML9289e" />
                  <DetailRow label="Date Inducted" value="26 Jan 2026" />
                  <DetailRow label="Date Into Service" value="26 Jan 2026" />
                  <DetailRow
                    label="Assigned Unit"
                    value={asset.unit_id.toString()}
                  />
                  <DetailRow label="Airbase" value="AirBase 1" />
                  <DetailRow label="Hangar" value="Hangar 2" />
                </div>
              </div>

              {/* Airframe */}
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Airframe
                </h3>
                <div className="space-y-4">
                  <DetailRow
                    label="Total Airframe Hrs"
                    value={`${asset.total_airframe_hours} hrs`}
                  />
                  <DetailRow
                    label="Service Life Limit hrs"
                    value={`${asset.service_life_limit} hrs`}
                  />
                  <DetailRow label="Life Remaining" value="2,700 hrs" />
                  <DetailRow
                    label="Status"
                    value={
                      <span className="flex items-center gap-2">
                        {formatStatus(asset.serviceability_status)}
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            asset.serviceability_status === "serviceable"
                              ? "bg-emerald-500"
                              : asset.serviceability_status ===
                                  "under_maintenance"
                                ? "bg-amber-500"
                                : "bg-red-500",
                          )}
                        />
                      </span>
                    }
                  />
                  <DetailRow
                    label="Last Major Inspection"
                    value={asset.last_inspection_date}
                  />
                  <DetailRow
                    label="Last Major Inspection Hrs"
                    value={`${asset.last_inspection_hours} hrs`}
                  />
                  <DetailRow
                    label="Inspection Interval"
                    value={`${asset.inspection_interval} hrs`}
                  />
                  <DetailRow label="Next Inspection Due" value="100hrs" />
                  <DetailRow
                    label="Next Annual Inspection"
                    value={asset.next_annual_inspection_date}
                  />
                  <DetailRow label="Airframe Cycles" value="21" />
                  <DetailRow label="Service Life Limit Cycles" value="200" />
                  <DetailRow label="Landings" value={asset.landings} />
                </div>
              </div>
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
                    Next Inspection Due 100hrs
                  </span>
                </div>
                <div className="space-y-4">
                  <DetailRow
                    label="Serial Number"
                    value={engine.serial_number}
                  />
                  <DetailRow label="Model" value={engine.model} />
                  <DetailRow
                    label="Installation Date"
                    value={engine.installation_date}
                  />
                  <DetailRow label="Position" value="Primary Engine" />
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

        {activeTab === "components" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {asset.components.map((component, index) => (
              <div
                key={index}
                className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                    COMPONENT {index + 1}
                  </h3>
                  <span className="text-xs text-[#7FD5FF]">
                    Next Inspection Due 100hrs
                  </span>
                </div>
                <div className="space-y-4">
                  <DetailRow label="Component Type" value="Main Rotor Blade" />
                  <DetailRow
                    label="Serial Number"
                    value={component.serial_number}
                  />
                  <DetailRow
                    label="Part Number"
                    value={component.part_number}
                  />
                  <DetailRow
                    label="Installation Date"
                    value={component.installed_at}
                  />
                  <DetailRow
                    label="Time Since New"
                    value={`${component.time_since_new} hrs`}
                  />
                  <DetailRow
                    label="Time Since Overhaul"
                    value={`${component.time_since_overhaul} hrs`}
                  />
                  <DetailRow
                    label="Service Life Limit"
                    value={`${component.life_limit_hours} hrs`}
                  />
                  <DetailRow
                    label="Overhaul Limit"
                    value={`${component.overhaul_limit} hrs`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "defects" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {asset.maintenance_events
              .filter((e) => e.event_type === "Defect" || true)
              .map((defect, index) => (
                <div
                  key={index}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                      Last Defect
                    </h3>
                    <span className="text-xs text-white">
                      Rectified?{" "}
                      <span className="font-bold">
                        {defect.rectified ? "Yes" : "No"}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-4">
                    <DetailRow
                      label="Defect Reported"
                      value={defect.defect_reported || defect.description}
                    />
                    <DetailRow
                      label="Date of defect"
                      value={defect.date_of_defect || defect.started_at || "-"}
                    />
                    <DetailRow
                      label="Pilots Involved"
                      value={defect.pilots_involved?.toString() || "-"}
                    />
                    <DetailRow
                      label="Location"
                      value={defect.location || "-"}
                    />
                    {defect.rectification_details && (
                      <DetailRow
                        label="Rectification Details"
                        value={defect.rectification_details}
                      />
                    )}
                    {defect.work_done && (
                      <DetailRow label="Work Done" value={defect.work_done} />
                    )}
                    <DetailRow
                      label="Certifying Engineer"
                      value={defect.certifying_engineer?.toString() || "-"}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}

        {activeTab === "operations" && (
          <div className="grid grid-cols-1 gap-4">
            {asset.operations.length === 0 ? (
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 text-center text-gray-400">
                No operations found.
              </div>
            ) : (
              asset.operations.map((op, index) => (
                <div
                  key={index}
                  className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 flex justify-between items-center"
                >
                  <div>
                    <div className="text-[#7FD5FF] font-bold">{op.name}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(op.start_date_time).toLocaleDateString()} -{" "}
                      {new Date(op.end_date_time).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-white">
                      Duration: {op.duration_label}
                    </div>
                    <div
                      className={cn(
                        "px-2 py-1 rounded text-xs capitalize",
                        op.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : op.status === "active"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-blue-500/20 text-blue-400",
                      )}
                    >
                      {op.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 text-center text-gray-400">
            No log history found.
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

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2 last:border-0 last:pb-0">
    <span className="text-[#7FD5FF] text-sm">{label}:</span>
    <span className="text-white text-sm font-medium">{value}</span>
  </div>
);
