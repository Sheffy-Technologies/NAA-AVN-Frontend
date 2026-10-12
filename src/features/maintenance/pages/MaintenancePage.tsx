import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import {
  useGetComplianceRecordsQuery,
  useCreateWorkOrderMutation,
  useGetDefectRecordsQuery,
  useGetMaintenanceDueItemsQuery,
  useGetMaintenanceMetricsQuery,
  useGetWorkOrdersQuery,
  type MaintenanceDueItem,
} from "@/features/maintenance/api";
import PlanningPage from "./PlanningPage";
import { MaintenanceTrackingRecords } from "../components/MaintenanceTrackingRecords";
import { CreateDefectModal } from "../components/CreateDefectModal";

type MaintenanceSectionKey =
  | "overview"
  | "planning"
  | "compliance"
  | "work-orders"
  | "defects"
  | "tracking";

const SECTIONS: Array<{
  key: MaintenanceSectionKey;
  label: string;
  path: string;
  icon: string;
}> = [
  {
    key: "overview",
    label: "Maintenance Hub",
    path: "/dashboard/maintenance",
    icon: "mdi:wrench-cog-outline",
  },
  {
    key: "planning",
    label: "Maintenance Programs (Planning)",
    path: "/dashboard/maintenance/planning",
    icon: "mdi:calendar-check-outline",
  },
  {
    key: "compliance",
    label: "Compliance Records",
    path: "/dashboard/maintenance/compliance",
    icon: "mdi:clipboard-text-clock-outline",
  },
  {
    key: "work-orders",
    label: "Work Order Management",
    path: "/dashboard/maintenance/work-orders",
    icon: "mdi:file-document-edit-outline",
  },
  {
    key: "defects",
    label: "Defects Logging",
    path: "/dashboard/maintenance/defects",
    icon: "mdi:alert-octagon-outline",
  },
  {
    key: "tracking",
    label: "Due/Overdue Tracking",
    path: "/dashboard/maintenance/tracking",
    icon: "mdi:timeline-clock-outline",
  },
];

const getSectionFromPath = (pathname: string): MaintenanceSectionKey => {
  if (pathname.endsWith("/maintenance/planning")) return "planning";
  if (pathname.endsWith("/maintenance/compliance")) return "compliance";
  if (pathname.endsWith("/maintenance/work-orders")) return "work-orders";
  if (pathname.endsWith("/maintenance/defects")) return "defects";
  if (pathname.endsWith("/maintenance/tracking")) return "tracking";
  return "overview";
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const MaintenancePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const section = getSectionFromPath(location.pathname);

  const { data, isLoading, isError } = useGetMaintenanceMetricsQuery();
  const [dueTypeFilter, setDueTypeFilter] = useState<"aircraft" | "vehicle" | "equipment" | "">(
    "aircraft",
  );
  const {
    data: dueItemsResponse,
    isLoading: isDueItemsLoading,
    isError: isDueItemsError,
  } = useGetMaintenanceDueItemsQuery(
    { asset_type: dueTypeFilter || undefined },
    { skip: section !== "tracking" },
  );
  // The endpoint returns every tracked part (including "ok" / "not_tracked");
  // this section is only for items that actually need attention.
  const dueTrackingRows = useMemo(
    () =>
      (dueItemsResponse?.data ?? []).filter(
        (row) => row.status === "overdue" || row.status === "due_soon",
      ),
    [dueItemsResponse],
  );

  const {
    data: complianceRecords = [],
    isLoading: isComplianceLoading,
    isError: isComplianceError,
  } = useGetComplianceRecordsQuery(undefined, { skip: section !== "compliance" });

  const {
    data: workOrders = [],
    isLoading: isWorkOrdersLoading,
    isError: isWorkOrdersError,
  } = useGetWorkOrdersQuery(undefined, { skip: section !== "work-orders" });

  const {
    data: defectRecords = [],
    isLoading: isDefectRecordsLoading,
    isError: isDefectRecordsError,
  } = useGetDefectRecordsQuery(undefined, { skip: section !== "defects" });
  const [createWorkOrder, { isLoading: isCreatingWorkOrder }] =
    useCreateWorkOrderMutation();

  const summary = data?.summary;
  const [selectedDueKey, setSelectedDueKey] = useState<string | null>(null);
  const [selectedComplianceId, setSelectedComplianceId] = useState<number | null>(null);
  const [selectedDefectId, setSelectedDefectId] = useState<number | null>(null);
  const [isExportingWorkOrders, setIsExportingWorkOrders] = useState(false);
  const [isCreateDefectOpen, setIsCreateDefectOpen] = useState(false);
  const [selectedDefectIds, setSelectedDefectIds] = useState<Set<number>>(new Set());
  const [defectWorkOrderFeedback, setDefectWorkOrderFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const dueRowKey = (row: Pick<MaintenanceDueItem, "part_type" | "part_id">) =>
    `${row.part_type}-${row.part_id}`;

  const selectedDueItem = useMemo(
    () => dueTrackingRows.find((row) => dueRowKey(row) === selectedDueKey) ?? null,
    [dueTrackingRows, selectedDueKey],
  );
  const selectedComplianceItem = useMemo(
    () => complianceRecords.find((row) => row.id === selectedComplianceId) ?? null,
    [complianceRecords, selectedComplianceId],
  );
  const selectedDefectItem = useMemo(
    () => defectRecords.find((row) => row.id === selectedDefectId) ?? null,
    [defectRecords, selectedDefectId],
  );

  const allDefectsSelected =
    defectRecords.length > 0 && selectedDefectIds.size === defectRecords.length;

  const handleToggleDefect = (defectId: number) => {
    setDefectWorkOrderFeedback(null);
    setSelectedDefectIds((prev) => {
      const next = new Set(prev);
      if (next.has(defectId)) {
        next.delete(defectId);
      } else {
        next.add(defectId);
      }
      return next;
    });
  };

  const handleToggleAllDefects = () => {
    setDefectWorkOrderFeedback(null);
    setSelectedDefectIds((prev) => {
      if (defectRecords.length === 0) return new Set<number>();
      if (prev.size === defectRecords.length) return new Set<number>();
      return new Set(defectRecords.map((item) => item.id));
    });
  };

  const handleCreateWorkOrderFromDefects = async () => {
    if (selectedDefectIds.size === 0) {
      setDefectWorkOrderFeedback({
        type: "error",
        message: "Select at least one defect to create a work order.",
      });
      return;
    }

    const selected = defectRecords.filter((item) => selectedDefectIds.has(item.id));
    const primaryAssetId = selected[0]?.asset_id ?? null;
    const hasMixedAssets = selected.some((item) => (item.asset_id ?? null) !== primaryAssetId);

    if (hasMixedAssets) {
      setDefectWorkOrderFeedback({
        type: "error",
        message:
          "Selected defects belong to different assets. Please select defects for one asset at a time.",
      });
      return;
    }

    try {
      const selectedCount = selectedDefectIds.size;
      const title =
        selectedCount === 1
          ? `Defect Work Order #${selected[0].id}`
          : `Defect Work Order (${selectedCount} defects)`;

      await createWorkOrder({
        asset_id: primaryAssetId,
        title,
        defect_ids: Array.from(selectedDefectIds),
      }).unwrap();

      setSelectedDefectIds(new Set<number>());
      setDefectWorkOrderFeedback({
        type: "success",
        message: "Work order created successfully from selected defects.",
      });
    } catch {
      setDefectWorkOrderFeedback({
        type: "error",
        message: "Failed to create work order from selected defects.",
      });
    }
  };

  const statCards = useMemo(
    () => [
      {
        label: "Work Orders",
        value: String(summary?.total_work_orders ?? 0),
        icon: "mdi:file-document-edit-outline",
      },
      {
        label: "Open Defects",
        value: String(summary?.open_defects ?? 0),
        icon: "mdi:alert-circle-outline",
      },
      {
        label: "Compliance Due (30d)",
        value: String(summary?.compliance_due_next_30_days ?? 0),
        icon: "mdi:clock-alert-outline",
      },
      {
        label: "Resolution Rate",
        value: `${summary?.defect_resolution_rate ?? 0}%`,
        icon: "mdi:check-decagram-outline",
      },
    ],
    [summary],
  );

  const handleExportWorkOrdersExcel = async () => {
    if (isExportingWorkOrders) return;

    setIsExportingWorkOrders(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const summaryRows: Array<Record<string, string | number>> = (workOrders || []).map((order) => ({
        "Work Order ID": order.id,
        Title: order.title || `Work Order #${order.id}`,
        "Asset ID": order.asset_id ?? "-",
        "Created At": formatDate(order.created_at),
        "Updated At": formatDate(order.updated_at),
        "Task Count": order.tasks?.length ?? 0,
      }));

      const taskRows: Array<Record<string, string | number>> = [];
      const assignmentRows: Array<Record<string, string | number>> = [];

      (workOrders || []).forEach((order) => {
        const tasks = order.tasks || [];

        if (tasks.length === 0) {
          taskRows.push({
            "Work Order ID": order.id,
            "Task ID": "-",
            "Task Type": "-",
            Status: "-",
            Description: "No tasks",
            "Program Name": "-",
            "Defect Title": "-",
          });
          return;
        }

        tasks.forEach((task) => {
          taskRows.push({
            "Work Order ID": order.id,
            "Task ID": task.id,
            "Task Type": task.task_type || "routine",
            Status: String(task.status || "pending"),
            Description: task.description || "-",
            "Program Name": task.program?.name || "-",
            "Defect Title": task.defect?.title || "-",
          });

          const assigned = task.assignedPersonnel ?? task.assigned_personnel ?? [];
          if (assigned.length === 0) {
            assignmentRows.push({
              "Work Order ID": order.id,
              "Task ID": task.id,
              "Personnel ID": "-",
              Name: "Unassigned",
              "Service Number": "-",
            });
            return;
          }

          assigned.forEach((person) => {
            assignmentRows.push({
              "Work Order ID": order.id,
              "Task ID": task.id,
              "Personnel ID": person.id,
              Name:
                person.full_name ||
                [person.firstname, person.lastname].filter(Boolean).join(" ") ||
                `Personnel #${person.id}`,
              "Service Number": person.service_number || "-",
            });
          });
        });
      });

      const addSheet = (name: string, rows: Array<Record<string, string | number>>) => {
        const data = rows.length > 0 ? rows : [{ Info: "No records" }];
        const sheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      addSheet("Work Orders", summaryRows);
      addSheet("Tasks", taskRows);
      addSheet("Assignments", assignmentRows);

      XLSX.writeFile(workbook, "work-orders-export.xlsx");
    } finally {
      setIsExportingWorkOrders(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wide text-white">
            Maintenance
          </h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
            Planning, Compliance, Work Orders, Defects, and Tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path)}
            className={cn(
              "text-left bg-[#001219] border rounded-xl p-4 transition-colors",
              section === item.key
                ? "border-[#7FD5FF] shadow-[0_0_0_1px_rgba(127,213,255,0.3)]"
                : "border-[#0A4D66]/40 hover:border-[#7FD5FF]/50",
            )}
          >
            <div className="flex items-center gap-3">
              <Icon icon={item.icon} className="w-5 h-5 text-[#7FD5FF]" />
              <span className="text-sm font-semibold text-white">
                {item.label}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 uppercase">{stat.label}</p>
              <Icon icon={stat.icon} className="w-4 h-4 text-[#7FD5FF]" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-gray-400">
          Loading maintenance metrics...
        </div>
      ) : null}

      {isError ? (
        <div className="bg-[#001219] border border-red-500/40 rounded-xl p-6 text-red-300">
          Failed to load maintenance metrics.
        </div>
      ) : null}

      {section === "overview" && <MaintenanceTrackingRecords />}

      {section === "planning" && <PlanningPage />}

      {section === "tracking" && (
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-[#7FD5FF] uppercase">
              Due/Overdue: Components, Engines, Avionics
            </h2>
            <select
              value={dueTypeFilter}
              onChange={(e) =>
                setDueTypeFilter(e.target.value as "aircraft" | "vehicle" | "equipment" | "")
              }
              className="rounded border border-[#0A4D66]/40 bg-[#001825] px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
            >
              <option value="aircraft">Aircraft Only</option>
              <option value="vehicle">Vehicles Only</option>
              <option value="equipment">Equipment Only</option>
              <option value="">All Asset Types</option>
            </select>
          </div>

          {dueItemsResponse && (
            <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-red-300">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Overdue: {dueItemsResponse.counts_by_status.overdue}
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Due Soon: {dueItemsResponse.counts_by_status.due_soon}
              </span>
            </div>
          )}

          {isDueItemsLoading ? (
            <div className="text-gray-400">Loading due/overdue items...</div>
          ) : isDueItemsError ? (
            <div className="text-red-300">Failed to load due/overdue items.</div>
          ) : dueTrackingRows.length === 0 ? (
            <div className="text-gray-400">No due/overdue components, engines, or avionics found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Asset</th>
                    <th className="py-2 pr-3">Hours Left</th>
                    <th className="py-2 pr-3">Projected Due</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dueTrackingRows.map((row) => (
                    <tr key={dueRowKey(row)} className="border-b border-[#0A4D66]/20 text-gray-200">
                      <td className="py-2 pr-3 capitalize">{row.part_type}</td>
                      <td className="py-2 pr-3">{row.part_label}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/assets/${row.asset_id}`)}
                          className="text-[#7FD5FF] hover:underline"
                        >
                          {row.asset_name}
                          {row.asset_tail_number ? ` (${row.asset_tail_number})` : ""}
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        {row.hours_remaining === null
                          ? "-"
                          : `${Math.abs(row.hours_remaining).toLocaleString()} hrs`}
                      </td>
                      <td className="py-2 pr-3">
                        {row.projected_due_date
                          ? new Date(row.projected_due_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "text-xs font-medium capitalize",
                            row.status === "overdue" ? "text-red-300" : "text-amber-300",
                          )}
                        >
                          {row.status === "overdue" ? "Overdue" : "Due Soon"}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDueKey(dueRowKey(row))}
                          className="text-xs text-[#7FD5FF] hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedDueItem && (
            <div className="mt-4 rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4 text-sm text-gray-200">
              <div className="text-xs uppercase text-[#7FD5FF] mb-2 capitalize">
                {selectedDueItem.part_type} Details
              </div>
              <div>Item: {selectedDueItem.part_label}</div>
              <div>Serial: {selectedDueItem.part_serial_number ?? "-"}</div>
              <div>
                Asset: {selectedDueItem.asset_name}
                {selectedDueItem.asset_tail_number ? ` (${selectedDueItem.asset_tail_number})` : ""}
              </div>
              <div>Current Hours: {selectedDueItem.current_hours ?? "-"}</div>
              <div>Current Cycles: {selectedDueItem.current_cycles ?? "-"}</div>
              <div>Next Due Hours: {selectedDueItem.next_due_hours ?? "-"}</div>
              <div>Next Due Cycles: {selectedDueItem.next_due_cycles ?? "-"}</div>
              <div>Next Due Date: {selectedDueItem.next_due_date ?? "-"}</div>
              <div>Projected Due Date: {selectedDueItem.projected_due_date ?? "-"}</div>
            </div>
          )}
        </div>
      )}

      {section === "compliance" && (
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <h2 className="text-sm font-bold text-[#7FD5FF] uppercase mb-4">
            Compliance Records
          </h2>
          {isComplianceLoading ? (
            <div className="text-gray-400">Loading compliance records...</div>
          ) : isComplianceError ? (
            <div className="text-red-300">Failed to load compliance records.</div>
          ) : complianceRecords.length === 0 ? (
            <div className="text-gray-400">No compliance records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="py-2 pr-3">Record ID</th>
                    <th className="py-2 pr-3">Completion Date</th>
                    <th className="py-2 pr-3">Next Due Date</th>
                    <th className="py-2 pr-3">Next Due Hours</th>
                    <th className="py-2 pr-3">Remarks</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceRecords.map((row) => (
                    <tr key={row.id} className="border-b border-[#0A4D66]/20 text-gray-200">
                      <td className="py-2 pr-3">#{row.id}</td>
                      <td className="py-2 pr-3">{formatDate(row.completion_date)}</td>
                      <td className="py-2 pr-3">{formatDate(row.next_due_date)}</td>
                      <td className="py-2 pr-3">{row.next_due_hours ?? "-"}</td>
                      <td className="py-2 pr-3">{row.remarks || "-"}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setSelectedComplianceId(row.id)}
                          className="text-xs text-[#7FD5FF] hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedComplianceItem && (
            <div className="mt-4 rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4 text-sm text-gray-200">
              <div className="text-xs uppercase text-[#7FD5FF] mb-2">Compliance Record Details</div>
              <div>Record ID: #{selectedComplianceItem.id}</div>
              <div>Completion Date: {formatDate(selectedComplianceItem.completion_date)}</div>
              <div>Next Due Date: {formatDate(selectedComplianceItem.next_due_date)}</div>
              <div>Next Due Hours: {selectedComplianceItem.next_due_hours ?? "-"}</div>
              <div>Linked Work Order Task: {selectedComplianceItem.work_order_task_id ?? "-"}</div>
              <div>Component ID: {selectedComplianceItem.component_id ?? "-"}</div>
              <div>Engine ID: {selectedComplianceItem.engine_id ?? "-"}</div>
              <div>Avionics ID: {selectedComplianceItem.avionics_id ?? "-"}</div>
              <div>Remarks: {selectedComplianceItem.remarks || "-"}</div>
            </div>
          )}
        </div>
      )}

      {section === "work-orders" && (
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#7FD5FF] uppercase">
              Work Orders
            </h2>
            <button
              type="button"
              onClick={handleExportWorkOrdersExcel}
              disabled={isExportingWorkOrders || isWorkOrdersLoading}
              className="inline-flex items-center gap-2 rounded border border-emerald-400/50 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Icon icon={isExportingWorkOrders ? "mdi:loading" : "mdi:microsoft-excel"} className={cn("w-4 h-4", isExportingWorkOrders ? "animate-spin" : "")} />
              <span>{isExportingWorkOrders ? "Exporting..." : "Export Excel"}</span>
            </button>
          </div>
          {isWorkOrdersLoading ? (
            <div className="text-gray-400">Loading work orders...</div>
          ) : isWorkOrdersError ? (
            <div className="text-red-300">Failed to load work orders.</div>
          ) : workOrders.length === 0 ? (
            <div className="text-gray-400">No work orders found.</div>
          ) : (
            <div className="space-y-3">
              {workOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/maintenance/work-orders/${order.id}`)}
                  className="w-full text-left rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4 hover:border-[#7FD5FF]/50 hover:bg-[#001825]/80 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {order.title || `Work Order #${order.id}`}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Asset ID: {order.asset_id ?? "-"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-400">
                        {formatDate(order.created_at)}
                      </div>
                      <Icon icon="mdi:arrow-right" className="w-4 h-4 text-[#7FD5FF]" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {section === "defects" && (
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#7FD5FF] uppercase">
              Defects Logging
            </h2>
            <button
              type="button"
              onClick={() => setIsCreateDefectOpen(true)}
              className="inline-flex items-center gap-2 rounded bg-[#0369A1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0369A1]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Log Defect</span>
            </button>
          </div>
          {isDefectRecordsLoading ? (
            <div className="text-gray-400">Loading discrepancies/defects...</div>
          ) : isDefectRecordsError ? (
            <div className="text-red-300">Failed to load discrepancies/defects.</div>
          ) : defectRecords.length === 0 ? (
            <div className="text-gray-400">No discrepancies/defects found.</div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreateWorkOrderFromDefects}
                  disabled={isCreatingWorkOrder || selectedDefectIds.size === 0}
                  className="rounded border border-emerald-400 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreatingWorkOrder
                    ? "Creating Work Order..."
                    : `Create Work Order (${selectedDefectIds.size})`}
                </button>
                <button
                  type="button"
                  onClick={handleToggleAllDefects}
                  className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                >
                  {allDefectsSelected ? "Unselect All" : "Select All"}
                </button>
              </div>

              {defectWorkOrderFeedback && (
                <div
                  className={cn(
                    "mb-4 rounded border px-3 py-2 text-xs",
                    defectWorkOrderFeedback.type === "success"
                      ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-300"
                      : "border-red-500/40 bg-red-900/20 text-red-300",
                  )}
                >
                  {defectWorkOrderFeedback.message}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-[#0A4D66]/40">
                      <th className="py-2 pr-3">Select</th>
                      <th className="py-2 pr-3">ID</th>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Severity</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Reported At</th>
                      <th className="py-2 pr-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defectRecords.map((defect) => (
                      <tr key={defect.id} className="border-b border-[#0A4D66]/20 text-gray-200">
                        <td className="py-2 pr-3">
                          <input
                            type="checkbox"
                            checked={selectedDefectIds.has(defect.id)}
                            onChange={() => handleToggleDefect(defect.id)}
                            className="h-4 w-4 rounded border-[#0A4D66]/60 bg-[#001825] text-[#7FD5FF]"
                            title={`Select defect ${defect.id}`}
                          />
                        </td>
                        <td className="py-2 pr-3">#{defect.id}</td>
                        <td className="py-2 pr-3">{defect.title || "-"}</td>
                        <td className="py-2 pr-3">{defect.severity || "-"}</td>
                        <td className="py-2 pr-3">{defect.status || "-"}</td>
                        <td className="py-2 pr-3">{formatDate(defect.reported_at)}</td>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => setSelectedDefectId(defect.id)}
                            className="text-xs text-[#7FD5FF] hover:underline"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {selectedDefectItem && (
            <div className="mt-4 rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4 text-sm text-gray-200">
              <div className="text-xs uppercase text-[#7FD5FF] mb-2">Defect Details</div>
              <div>ID: #{selectedDefectItem.id}</div>
              <div>Title: {selectedDefectItem.title || "-"}</div>
              <div>Description: {selectedDefectItem.description || "-"}</div>
              <div>Severity: {selectedDefectItem.severity || "-"}</div>
              <div>Status: {selectedDefectItem.status || "-"}</div>
              <div>Reported At: {formatDate(selectedDefectItem.reported_at)}</div>
              <div>Resolved At: {formatDate(selectedDefectItem.resolved_at)}</div>
              <div>Asset ID: {selectedDefectItem.asset_id ?? "-"}</div>
              <div>Remarks: {selectedDefectItem.remarks || "-"}</div>
            </div>
          )}
          <CreateDefectModal
            open={isCreateDefectOpen}
            onClose={() => setIsCreateDefectOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
