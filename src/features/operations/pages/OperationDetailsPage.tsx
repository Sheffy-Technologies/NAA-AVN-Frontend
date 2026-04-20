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
  useUpdateOperationStatusMutation,
  type Operation,
  type OperationAssignedAsset,
} from "../api";
import { format } from "date-fns";
import { AfterActionReportForm } from "../components/AfterActionReportForm";
import { OperationLocationPicker } from "../components/OperationLocationPicker";

const formatOperationDate = (value: string | null | undefined) => {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return format(date, "dd/MM/yyyy");
};

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
  const firstName = typeof record.firstname === "string" ? record.firstname : "";
  const lastName = typeof record.lastname === "string" ? record.lastname : "";
  const otherNames = typeof record.othernames === "string" ? record.othernames : "";
  const fullName = `${firstName} ${lastName} ${otherNames}`.trim();
  if (!fullName) return "N/A";
  return rank ? `${rank} ${fullName}` : fullName;
};

const renderAssetCard = (entry: OperationAssignedAsset, index: number) => {
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
  const assetType =
    (typeof baseAsset.model === "string" && baseAsset.model) ||
    (typeof baseAsset.type === "string" && baseAsset.type) ||
    "N/A";
  const tailNumber =
    (typeof baseAsset.tail_number === "string" && baseAsset.tail_number) || "N/A";
  const totalHours =
    baseAsset.operations_total_hours_label ??
    baseAsset.total_airframe_hours ??
    baseAsset.total_flight_hours ??
    baseAsset.total_hours ??
    "N/A";
  const nextInspection =
    baseAsset.next_type_of_inspection && baseAsset.next_annual_inspection_date
      ? `${String(baseAsset.next_type_of_inspection)} (${String(baseAsset.next_annual_inspection_date).slice(0, 10)})`
      : baseAsset.next_annual_inspection_date ??
        baseAsset.next_inspection_date ??
        baseAsset.next_inspection ??
        "N/A";
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

  return (
    <div
      key={
        entry.id ??
        (typeof baseAsset.id === "number" ? baseAsset.id : `${entry.asset_id ?? "asset"}-${index}`)
      }
      className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4"
    >
      <InfoRow label="Name" value={assetName} />
      <InfoRow label="Type" value={String(assetType)} />
      <InfoRow label="Tail Number" value={String(tailNumber)} />
      <InfoRow label="Serviceability" value={String(serviceability)} />
      <InfoRow label="Total Hours" value={String(totalHours)} />
      <InfoRow label="Next Inspection" value={String(nextInspection)} />
      <InfoRow label="Last Snag" value={String(lastSnag)} />
      <InfoRow label="Total Landings" value={String(totalLandings)} />
      <InfoRow label="Pilot In Command" value={getPersonName(pilotDetails)} />
      <InfoRow label="Co-Pilot" value={getPersonName(coPilotDetails)} />
    </div>
  );
};

const OperationTab = ({ operation }: { operation: Operation }) => {
  if (!operation) return null;

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <InfoRow label="Purpose" value={operation.name} />
          <InfoRow label="Type" value={operation.operation_type?.name || "N/A"} />
          <InfoRow label="Departure" value={departureLabel} />
          <InfoRow label="Destination" value={arrivalLabel} />
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
          <InfoRow
            label="Total Hours"
            value={operation.duration_label || `${operation.duration_hours} hrs`}
          />
          <InfoRow
            label="Date"
            value={formatOperationDate(operation.start_date_time)}
          />
        </div>

        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <h3 className="text-[#7FD5FF] text-sm font-bold mb-4 uppercase">
            Aircraft
          </h3>
          {operation.assets && operation.assets.length > 0 ? (
            <div className="space-y-4">
              {operation.assets.map((entry, index) => renderAssetCard(entry, index))}
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
          readOnly
          heightClassName="h-120"
        />
      </div>
    </div>
  );
};

// Placeholder for AAR Tab
const AARTab = ({ operation }: { operation: Operation }) => {
  if (operation.afterActionReport) {
    const report = operation.afterActionReport;
    return (
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-white space-y-6">
        <div className="flex items-center justify-between border-b border-[#0A4D66]/40 pb-4">
          <h3 className="text-[#7FD5FF] font-bold uppercase">
            After Action Report
          </h3>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/40 font-medium">
            SUBMITTED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
          <InfoRow
            label="Mission"
            value={<span className="capitalize">{report.mission}</span>}
          />
          <InfoRow label="Task No" value={report.task_no} />
          <InfoRow label="Infantry No" value={report.infantry_no} />
        </div>

        <div className="space-y-2">
          <h4 className="text-[#7FD5FF] text-sm font-medium">Activities</h4>
          <p className="text-gray-300 text-sm bg-[#001825] p-3 rounded border border-[#0A4D66]/30">
            {report.activities}
          </p>
        </div>

        {operation.assets && operation.assets.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-[#0A4D66]/40">
            <h4 className="text-[#7FD5FF] text-sm font-bold uppercase">
              Aircraft Flight Times
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {operation.assets.map((assignedAsset, idx) => (
                <div
                  key={idx}
                  className="bg-[#001825] p-4 rounded border border-[#0A4D66]/30 text-sm"
                >
                  <p className="font-semibold text-white mb-3">
                    {assignedAsset.asset?.name ?? `Aircraft ${idx + 1}`}
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-gray-300">
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Departure</p>
                      <div className="flex gap-4">
                        <span><span className="text-gray-500">T/O:</span> {assignedAsset.departure_takeoff ?? "—"}</span>
                        <span><span className="text-gray-500">LDG:</span> {assignedAsset.departure_landing ?? "—"}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Return</p>
                      <div className="flex gap-4">
                        <span><span className="text-gray-500">T/O:</span> {assignedAsset.arrival_takeoff ?? "—"}</span>
                        <span><span className="text-gray-500">LDG:</span> {assignedAsset.arrival_landing ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.contacts && report.contacts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-[#0A4D66]/40">
            <h4 className="text-[#7FD5FF] text-sm font-bold uppercase">
              Enemy Contacts ({report.contacts.length})
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {report.contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="bg-[#001825] p-4 rounded border border-[#0A4D66]/30 text-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white capitalize text-base">
                      {contact.engagement.replace(/_/g, " ")}
                    </span>
                    <div className="flex gap-4 text-gray-400 text-xs">
                      <span>{contact.date_of_contact}</span>
                      <span>{contact.time_of_contact}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-gray-300">
                    <InfoRow label="Location" value={contact.location} />
                    <InfoRow label="Enemy Infantry" value={contact.enemy_infantry_no} />
                    <InfoRow label="Enemy Vehicles" value={contact.enemy_vehicle_no} />
                    <InfoRow label="Targets Infantry" value={contact.targets_infantry_no} />
                    <InfoRow label="Targets Vehicles" value={contact.targets_vehicle_no} />
                  </div>

                  {contact.enemy_resources_description && (
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Enemy Resources</p>
                      <p className="text-gray-300">{contact.enemy_resources_description}</p>
                    </div>
                  )}

                  {contact.targets_treated_description && (
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Targets Treated</p>
                      <p className="text-gray-300">{contact.targets_treated_description}</p>
                    </div>
                  )}

                  {contact.damage_received && (
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Damage Received</p>
                      <p className="text-gray-300">{contact.damage_received}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.resource_utilizations && report.resource_utilizations.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-[#0A4D66]/40">
            <h4 className="text-[#7FD5FF] text-sm font-bold uppercase">
              Resource Utilization ({report.resource_utilizations.length})
            </h4>
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
                    <tr
                      key={idx}
                      className="border-b border-[#0A4D66]/20 last:border-0"
                    >
                      <td className="px-4 py-2">{res.item_description}</td>
                      <td className="px-4 py-2 text-right">{res.quantity_used}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-white">
      <AfterActionReportForm
        operationId={operation.id}
        operation={operation}
        onSuccess={() => window.location.reload()}
      />
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
  const [deleteOperation, { isLoading: isDeleting }] = useDeleteOperationMutation();
  const [updateOperationStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOperationStatusMutation();

  const statusOptions = ["planned", "completed", "ongoing", "aborted"] as const;

  const { data: operation, isLoading } = useGetOperationByIdQuery(id || "", {
    skip: !id,
  });

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#021019] text-[#7FD5FF]">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#021019] text-gray-400 gap-4">
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
      dispatch(showToast({ message: "Operation deleted successfully", type: "success" }));
      navigate("/dashboard/operations");
    } catch {
      dispatch(showToast({ message: "Failed to delete operation", type: "error" }));
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
      dispatch(showToast({ message: "Operation status updated", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update operation status", type: "error" }));
    }
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `${operation.name || "operation"}-${operation.id}`,
        backgroundColor: "#021019",
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

  return (
    <div className="min-h-screen bg-[#021019] text-gray-200 flex flex-col p-6 space-y-6">
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

            <div className="text-sm text-gray-400">
              {operation.name}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteOperation}
              disabled={isDeleting}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#002030] disabled:opacity-60"
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <div className="relative">
              <button
                onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#002030] disabled:opacity-60"
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
                        "w-full text-left px-3 py-2 text-xs capitalize hover:bg-[#002030] transition-colors",
                        operation.status === status ? "text-[#7FD5FF]" : "text-gray-300",
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => navigate(`/dashboard/operations/${operation.id}/edit`)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#002030]"
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
                className={cn("w-5 h-5", isDownloadingPdf ? "animate-spin" : "")}
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
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1">
        {activeTab === "operation" ? (
          <OperationTab operation={operation} />
        ) : (
          <AARTab operation={operation} />
        )}
      </div>
    </div>
  );
};
