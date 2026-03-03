import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useGetOperationByIdQuery, type Operation } from "../api";
import { format } from "date-fns";
import { AfterActionReportForm } from "../components/AfterActionReportForm";

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

const OperationTab = ({ operation }: { operation: Operation }) => {
  if (!operation) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Operation Details */}
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        <InfoRow label="Purpose" value={operation.name} />
        <InfoRow label="Type" value={operation.operation_type?.name || "N/A"} />
        <InfoRow
          label="Departure"
          value={operation.departure_location || "N/A"}
        />
        <InfoRow
          label="Destination"
          value={operation.arrival_location || "N/A"}
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
                    : operation.status === "active"
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
          value={format(new Date(operation.start_date_time), "dd/MM/yyyy")}
        />
      </div>

      {/* Right Panel - Aircraft Details */}
      {/* Note: The UI shows a specific aircraft card. Assuming we show the first asset or a list. 
          For now, I'll mock the layout based on the screenshot for the first asset if available. */}
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        <h3 className="text-[#7FD5FF] text-sm font-bold mb-4 uppercase">
          Aircraft
        </h3>
        {operation.assets && operation.assets.length > 0 ? (
          // Placeholder for asset details since the API response for assets is currently generic/unknown in the type definition
          // In a real scenario, we'd map over assets.
          // Based on screenshot: Name, Total Hours, Next Inspection, Last Snag, Total Landing, Pilot In command
          <div className="space-y-4">
            <InfoRow label="Name" value="NA010" />
            <InfoRow label="Total Hours" value="10 hrs" />
            <InfoRow label="Next Inspection" value="26 Jan 2026" />
            <InfoRow
              label="Last Snag"
              value="920 HOURS | Hydraulic leak in main rotor system (Rectified)"
            />
            <InfoRow label="Total Landing" value="26 Jan 2026" />
            <InfoRow label="Pilot In command" value="Lt. Ijeoma Anya" />
          </div>
        ) : (
          <div className="text-gray-400 text-sm">
            No aircraft assets assigned.
          </div>
        )}
      </div>
    </div>
  );
};

// Placeholder for AAR Tab
const AARTab = ({ operation }: { operation: Operation }) => {
  if (operation.after_action_report) {
    const report = operation.after_action_report;
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
          <InfoRow label="Vehicles No" value={report.vehicles_no} />
        </div>

        <div className="space-y-2">
          <h4 className="text-[#7FD5FF] text-sm font-medium">Activities</h4>
          <p className="text-gray-300 text-sm bg-[#001825] p-3 rounded border border-[#0A4D66]/30">
            {report.activities}
          </p>
        </div>

        {report.contacts && report.contacts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-[#0A4D66]/40">
            <h4 className="text-[#7FD5FF] text-sm font-bold uppercase">
              Enemy Contacts ({report.contacts.length})
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {report.contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="bg-[#001825] p-4 rounded border border-[#0A4D66]/30 text-sm"
                >
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-white capitalize">
                      {contact.engagement.replace("_", " ")}
                    </span>
                    <span className="text-gray-400">
                      {contact.time_of_contact}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-300">
                    <div>
                      <span className="text-gray-500">Location:</span>{" "}
                      {contact.location}
                    </div>
                    <div>
                      <span className="text-gray-500">Enemy Infantry:</span>{" "}
                      {contact.enemy_infantry_no}
                    </div>
                  </div>
                </div>
              ))}
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
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
};

export const OperationDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"operation" | "aar">("operation");

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

  return (
    <div className="min-h-screen bg-[#021019] text-gray-200 flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard/operations")}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <Icon icon="mdi:arrow-left" className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center ml-4">
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

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#002030]">
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" /> Delete
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#002030]">
            <Icon icon="mdi:refresh" className="w-4 h-4" /> Update status
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded text-xs text-gray-300 hover:bg-[#002030]">
            <Icon icon="mdi:pencil" className="w-4 h-4" /> Edit
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white">
            <Icon icon="mdi:download" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {activeTab === "operation" ? (
          <OperationTab operation={operation} />
        ) : (
          <AARTab operation={operation} />
        )}
      </div>
    </div>
  );
};
