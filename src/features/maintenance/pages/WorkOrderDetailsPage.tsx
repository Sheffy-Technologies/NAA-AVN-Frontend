import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  useCreateMaintenanceInventoryMutation,
  useGetWorkOrderByIdQuery,
  useUpdateMaintenanceInventoryMutation,
  useUpdateWorkOrderTaskMutation,
} from "@/features/maintenance/api";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

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

const formatReporter = (
  reporter:
    | number
    | {
        id?: number;
        firstname?: string | null;
        lastname?: string | null;
        full_name?: string | null;
        service_number?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
) => {
  if (reporter == null) return "-";
  if (typeof reporter === "number") return String(reporter);

  const fullName = reporter.full_name?.trim();
  if (fullName) return fullName;

  const name = [reporter.firstname, reporter.lastname]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();
  if (name) return name;

  if (reporter.service_number?.trim()) return reporter.service_number;
  if (reporter.email?.trim()) return reporter.email;
  if (reporter.id) return `Personnel #${reporter.id}`;

  return "-";
};

export const WorkOrderDetailsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const workOrderId = id ? parseInt(id, 10) : null;
  const [selectedInventoryByTask, setSelectedInventoryByTask] = useState<Record<number, string>>(
    {}
  );
  const [quantityByTask, setQuantityByTask] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const { data: workOrder, isLoading, isError, refetch } = useGetWorkOrderByIdQuery(
    workOrderId as number,
    { skip: !workOrderId }
  );
  const { data: inventories = [], isLoading: isInventoriesLoading } = useGetInventoriesQuery();
  const [createMaintenanceInventory, { isLoading: isRequestingInventory }] =
    useCreateMaintenanceInventoryMutation();
  const [updateMaintenanceInventory, { isLoading: isInstallingInventory }] =
    useUpdateMaintenanceInventoryMutation();
  const [updateWorkOrderTask, { isLoading: isUpdatingTaskStatus }] =
    useUpdateWorkOrderTaskMutation();

  const getTaskMaintenanceInventories = (task: {
    maintenanceInventories?: Array<{
      id: number;
      quantity: number;
      disposition: string;
      inventory_id: number;
      inventory?: { part_number?: string | null; current_stock?: number } | null;
    }>;
    maintenance_inventories?: Array<{
      id: number;
      quantity: number;
      disposition: string;
      inventory_id: number;
      inventory?: { part_number?: string | null; current_stock?: number } | null;
    }>;
  }) => task.maintenanceInventories ?? task.maintenance_inventories ?? [];

  const handleRequestInventory = async (taskId: number) => {
    setFeedback(null);
    const selectedInventoryIdRaw = selectedInventoryByTask[taskId];
    const quantityRaw = quantityByTask[taskId] ?? "1";
    const selectedInventoryId = Number(selectedInventoryIdRaw);
    const quantity = Number(quantityRaw);

    if (!selectedInventoryId || Number.isNaN(selectedInventoryId)) {
      setFeedback({ type: "error", message: `Select an inventory item for task #${taskId}.` });
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setFeedback({ type: "error", message: `Enter a valid quantity for task #${taskId}.` });
      return;
    }

    try {
      await createMaintenanceInventory({
        work_order_task_id: taskId,
        inventory_id: selectedInventoryId,
        quantity,
        disposition: "installed",
      }).unwrap();

      setFeedback({ type: "success", message: `Inventory requested for task #${taskId}.` });
      await refetch();
    } catch {
      setFeedback({
        type: "error",
        message: `Failed to request inventory for task #${taskId}.`,
      });
    }
  };

  const handleInstallInventory = async (maintenanceInventoryId: number) => {
    setFeedback(null);

    try {
      await updateMaintenanceInventory({
        id: maintenanceInventoryId,
        disposition: "installed",
      }).unwrap();

      setFeedback({
        type: "success",
        message: "Inventory marked as installed and stock updated.",
      });
      await refetch();
    } catch (error: unknown) {
      const responseError = error as { data?: { message?: string } };
      setFeedback({
        type: "error",
        message:
          responseError?.data?.message ||
          "Failed to install inventory. Please verify available stock.",
      });
    }
  };

  const handleMarkTaskCompleted = async (taskId: number) => {
    setFeedback(null);

    try {
      await updateWorkOrderTask({ id: taskId, status: "completed" }).unwrap();
      dispatch(
        showToast({
          message: "Task marked as completed. Compliance history record created.",
          type: "success",
        }),
      );
      await refetch();
    } catch {
      dispatch(
        showToast({
          message: "Failed to mark task as completed",
          type: "error",
        }),
      );
    }
  };

  if (!workOrderId) {
    return (
      <div className="min-h-screen bg-[#00090D] p-6 flex items-center justify-center">
        <div className="text-red-300">Invalid work order ID</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#00090D] p-6">
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/dashboard/maintenance/work-orders")}
          className="flex items-center gap-2 text-[#7FD5FF] hover:text-white mb-6 transition-colors"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          Back to Work Orders
        </button>

        {isLoading ? (
          <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-gray-400">
            Loading work order details...
          </div>
        ) : isError || !workOrder ? (
          <div className="bg-[#001219] border border-red-500/40 rounded-xl p-6 text-red-300">
            Failed to load work order details.
          </div>
        ) : (
          <div className="space-y-6">
            {feedback && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-500/30 bg-emerald-900/20 text-emerald-200"
                    : "border-red-500/30 bg-red-900/20 text-red-200"
                }`}
              >
                {feedback.message}
              </div>
            )}

            {/* Work Order Header */}
            <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">
                    {workOrder.title || `Work Order #${workOrder.id}`}
                  </h1>
                  <p className="text-xs uppercase text-gray-400">
                    Work Order #{workOrder.id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase text-gray-400 mb-1">Asset ID</p>
                  <p className="text-white font-semibold">{workOrder.asset_id ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400 mb-1">Reported By</p>
                  <p className="text-white font-semibold">
                    {formatReporter(workOrder.reported_by)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400 mb-1">Created At</p>
                  <p className="text-white font-semibold">{formatDate(workOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400 mb-1">Updated At</p>
                  <p className="text-white font-semibold">{formatDate(workOrder.updated_at)}</p>
                </div>
              </div>
            </div>

            {/* Asset Information */}
            {workOrder.asset && (
              <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
                <h2 className="text-sm font-bold text-[#7FD5FF] uppercase mb-4">
                  Asset Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Asset Name</p>
                    <p className="text-white font-semibold">{workOrder.asset.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Type</p>
                    <p className="text-white font-semibold capitalize">
                      {workOrder.asset.type || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Model</p>
                    <p className="text-white font-semibold">{workOrder.asset.model || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Serial Number</p>
                    <p className="text-white font-semibold">
                      {workOrder.asset.serial_number || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Tail Number</p>
                    <p className="text-white font-semibold">
                      {workOrder.asset.tail_number || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">
                      Serviceability Status
                    </p>
                    <p className="text-white font-semibold capitalize">
                      {workOrder.asset.serviceability_status || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Total Airframe Hours</p>
                    <p className="text-white font-semibold">
                      {workOrder.asset.total_airframe_hours || "-"} hours
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Total Cycles</p>
                    <p className="text-white font-semibold">{workOrder.asset.total_cycles || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">Operation Status</p>
                    <p className="text-white font-semibold capitalize">
                      {workOrder.asset.operation_status || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 mb-1">
                      Last Inspection Date
                    </p>
                    <p className="text-white font-semibold">
                      {formatDate(workOrder.asset.last_inspection_date)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tasks List */}
            {workOrder.tasks && workOrder.tasks.length > 0 && (
              <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
                <h2 className="text-sm font-bold text-[#7FD5FF] uppercase mb-4">
                  Work Order Tasks ({workOrder.tasks.length})
                </h2>
                <div className="space-y-3">
                  {workOrder.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-white mb-1">
                            Task #{task.id}
                          </div>
                          <div className="text-xs text-gray-400">
                            Type:{" "}
                            <span className="text-[#7FD5FF] capitalize">
                              {task.task_type || "routine"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-400">
                            {formatDate(task.created_at)}
                          </div>
                          {task.status !== "completed" && (
                            <button
                              type="button"
                              onClick={() => handleMarkTaskCompleted(task.id)}
                              disabled={isUpdatingTaskStatus}
                              className="rounded border border-emerald-400/50 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isUpdatingTaskStatus ? "Marking..." : "Mark Completed"}
                            </button>
                          )}
                          {task.status === "completed" && (
                            <span className="rounded border border-emerald-400/50 px-3 py-1 text-xs text-emerald-300 bg-emerald-900/20">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Maintenance Program Information */}
                      {task.program && (
                        <div className="mb-3 pb-3 border-b border-[#0A4D66]/30">
                          <div className="text-xs font-semibold text-[#7FD5FF] mb-2">
                            {task.program.name}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-300">
                            {task.program.ata_chapter_id && (
                              <div>
                                <span className="text-gray-400">ATA Chapter:</span>{" "}
                                {task.program.ata_chapter_id}
                              </div>
                            )}
                            {task.program.applicability && (
                              <div>
                                <span className="text-gray-400">Applicability:</span>{" "}
                                <span className="capitalize">{task.program.applicability}</span>
                              </div>
                            )}
                            {task.program.interval_hours && (
                              <div>
                                <span className="text-gray-400">Interval (Hours):</span>{" "}
                                {task.program.interval_hours}
                              </div>
                            )}
                            {task.program.interval_months && (
                              <div>
                                <span className="text-gray-400">Interval (Months):</span>{" "}
                                {task.program.interval_months}
                              </div>
                            )}
                            {task.program.interval_type && (
                              <div>
                                <span className="text-gray-400">Interval Type:</span>{" "}
                                <span className="capitalize">{task.program.interval_type}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Defect Information */}
                      {task.defect && (
                        <div className="mb-3 pb-3 border-b border-[#0A4D66]/30">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="text-xs font-semibold text-[#7FD5FF]">
                              {task.defect.title || `Defect #${task.defect.id}`}
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded capitalize ${
                                task.defect.severity === "high"
                                  ? "bg-red-900/30 text-red-300"
                                  : task.defect.severity === "medium"
                                  ? "bg-yellow-900/30 text-yellow-300"
                                  : "bg-blue-900/30 text-blue-300"
                              }`}
                            >
                              {task.defect.severity || "unknown"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-300 mb-2">
                            <div>
                              <span className="text-gray-400">Status:</span>{" "}
                              <span className="capitalize">{task.defect.status || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Reported At:</span>{" "}
                              {formatDate(task.defect.reported_at)}
                            </div>
                          </div>
                          {task.defect.description && (
                            <div className="text-xs text-gray-300 mb-2">
                              <span className="text-gray-400">Description:</span>{" "}
                              {task.defect.description}
                            </div>
                          )}
                          {task.defect.remarks && (
                            <div className="text-xs text-gray-300">
                              <span className="text-gray-400">Remarks:</span> {task.defect.remarks}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Task Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-300">
                        {task.description && (
                          <div className="md:col-span-2">
                            <span className="text-gray-400">Description:</span> {task.description}
                          </div>
                        )}
                        {task.actual_labour_hours && (
                          <div>
                            <span className="text-gray-400">Labour Hours:</span>{" "}
                            {task.actual_labour_hours}
                          </div>
                        )}
                        {task.labour_rate && (
                          <div>
                            <span className="text-gray-400">Labour Rate:</span> {task.labour_rate}
                          </div>
                        )}
                        {task.component_id && (
                          <div>
                            <span className="text-gray-400">Component ID:</span>{" "}
                            {task.component_id}
                          </div>
                        )}
                        {task.engine_id && (
                          <div>
                            <span className="text-gray-400">Engine ID:</span> {task.engine_id}
                          </div>
                        )}
                        {task.avionics_id && (
                          <div>
                            <span className="text-gray-400">Avionics ID:</span>{" "}
                            {task.avionics_id}
                          </div>
                        )}
                      </div>

                      {/* Maintenance Inventory */}
                      {task.status !== "completed" && (
                        <div className="mt-4 border-t border-[#0A4D66]/30 pt-4">
                          <div className="text-xs font-semibold text-[#7FD5FF] mb-3 uppercase tracking-wide">
                            Request Inventory
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                            <select
                              title={`Inventory selection for task ${task.id}`}
                              value={selectedInventoryByTask[task.id] ?? ""}
                              onChange={(event) =>
                                setSelectedInventoryByTask((prev) => ({
                                  ...prev,
                                  [task.id]: event.target.value,
                                }))
                              }
                              className="md:col-span-2 rounded border border-[#0A4D66]/50 bg-[#001219] px-3 py-2 text-sm text-white"
                            >
                              <option value="">Select Inventory Item</option>
                              {inventories.map((item) => (
                                <option key={item.id} value={String(item.id)}>
                                  {item.part_number || `Inventory #${item.id}`} (Stock: {item.current_stock})
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              min={1}
                              value={quantityByTask[task.id] ?? "1"}
                              onChange={(event) =>
                                setQuantityByTask((prev) => ({
                                  ...prev,
                                  [task.id]: event.target.value,
                                }))
                              }
                              className="rounded border border-[#0A4D66]/50 bg-[#001219] px-3 py-2 text-sm text-white"
                              placeholder="Qty"
                            />

                            <button
                              type="button"
                              onClick={() => handleRequestInventory(task.id)}
                              disabled={isRequestingInventory || isInventoriesLoading}
                              className="rounded border border-[#7FD5FF]/50 px-3 py-2 text-sm text-[#7FD5FF] hover:bg-[#0A4D66]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRequestingInventory ? "Requesting..." : "Request Inventory"}
                            </button>
                          </div>

                          {getTaskMaintenanceInventories(task).length > 0 && (
                            <div className="space-y-2">
                              {getTaskMaintenanceInventories(task).map((item) => (
                                <div
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#0A4D66]/30 bg-[#001219] px-3 py-2 text-xs text-gray-200"
                                >
                                  <div>
                                    <span className="text-gray-400">Item:</span>{" "}
                                    {item.inventory?.part_number || `Inventory #${item.inventory_id}`}
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Qty:</span> {item.quantity}
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Status:</span>{" "}
                                    <span className="capitalize">{item.disposition}</span>
                                  </div>
                                  {item.disposition !== "installed" && (
                                    <button
                                      type="button"
                                      onClick={() => handleInstallInventory(item.id)}
                                      disabled={isInstallingInventory}
                                      className="rounded border border-emerald-400/50 px-2 py-1 text-emerald-300 hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isInstallingInventory ? "Installing..." : "Mark Installed"}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
              <h2 className="text-sm font-bold text-[#7FD5FF] uppercase mb-4">Actions</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/maintenance/work-orders")}
                  className="rounded border border-[#7FD5FF]/50 px-4 py-2 text-sm text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
