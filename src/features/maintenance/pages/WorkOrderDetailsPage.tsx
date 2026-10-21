import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  useCompleteWorkOrderMutation,
  useCreateMaintenanceInventoryMutation,
  useGetWorkOrderByIdQuery,
  useUpdateMaintenanceInventoryMutation,
  useUpdateWorkOrderTaskMutation,
} from "@/features/maintenance/api";
import { cn } from "@/shared/utils/cn";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import {
  useCreateInventoryMutation,
  useCreateStockMovementMutation,
  useGetExpenseCategoriesQuery,
  useGetInventoriesQuery,
} from "@/features/inventory/api";
import { NewInventoryItemFields } from "@/features/inventory/components/NewInventoryItemFields";
import {
  emptyNewInventoryDraft,
  toCreateInventoryPayload,
  toNewInventoryPayload,
  type NewInventoryDraft,
} from "@/features/inventory/newInventoryItem";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { MultiSelect, type MultiSelectOption } from "@/shared/ui/multi-select/MultiSelect";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { BackButton } from "@/shared/ui/button";
import { exportNaavnExcel } from "@/shared/documents/naavnExcel";
import { exportNaavnPdf } from "@/shared/documents/naavnPdf";
import { sanitizeDocumentFileName } from "@/shared/documents/naavnDocument";
import {
  buildWorkOrderDocument,
  formatPersonnelName,
  formatReporter,
  getTaskAssignedPersonnel,
  getTaskMaintenanceInventories,
} from "@/features/maintenance/workOrderDocument";

const PERSONNEL_FILTERS = {
  branches: [],
  units: [],
  ranks: [],
  corps: [],
  specialties: [],
  status: [],
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

export const WorkOrderDetailsPage = () => {
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const workOrderId = id ? parseInt(id, 10) : null;
  const [selectedInventoryByTask, setSelectedInventoryByTask] = useState<Record<number, string>>(
    {}
  );
  const [selectedPersonnelByTask, setSelectedPersonnelByTask] = useState<Record<number, string[]>>(
    {}
  );
  const [quantityByTask, setQuantityByTask] = useState<Record<number, string>>({});
  // Tasks requisitioning a part that isn't in inventory yet.
  const [newItemByTask, setNewItemByTask] = useState<Record<number, NewInventoryDraft | null>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [exportingFormat, setExportingFormat] = useState<"excel" | "pdf" | null>(null);

  const { data: workOrder, isLoading, isError, refetch } = useGetWorkOrderByIdQuery(
    workOrderId as number,
    { skip: !workOrderId }
  );
  const { data: personnel = [], isLoading: isPersonnelLoading } = useGetPersonnelQuery(
    PERSONNEL_FILTERS
  );
  const {
    data: inventories = [],
    isLoading: isInventoriesLoading,
    refetch: refetchInventories,
  } = useGetInventoriesQuery();
  const { data: expenseCategories = [] } = useGetExpenseCategoriesQuery();
  const [createInventory, { isLoading: isCreatingInventory }] = useCreateInventoryMutation();
  const [completeWorkOrder, { isLoading: isCompletingWorkOrder }] =
    useCompleteWorkOrderMutation();
  const [createMaintenanceInventory, { isLoading: isRequestingInventory }] =
    useCreateMaintenanceInventoryMutation();
  const [updateMaintenanceInventory, { isLoading: isInstallingInventory }] =
    useUpdateMaintenanceInventoryMutation();
  const [updateWorkOrderTask, { isLoading: isUpdatingTaskStatus }] =
    useUpdateWorkOrderTaskMutation();
  const [createStockMovement, { isLoading: isRequestingProcurement }] =
    useCreateStockMovementMutation();

  const personnelOptions: MultiSelectOption[] = useMemo(
    () =>
      personnel.map((person) => {
        const name = formatPersonnelName({
          id: person.id,
          firstname: person.firstname,
          lastname: person.lastname,
          othernames: person.othernames,
          service_number: person.service_number,
          call_sign: person.call_sign,
          rank: person.rank,
        });
        // Include the service number so the dropdown search can match on it.
        const serviceNumber = person.service_number?.trim();
        return {
          value: String(person.id),
          label: serviceNumber && !name.includes(serviceNumber) ? `${name} (${serviceNumber})` : name,
        };
      }),
    [personnel],
  );

  const inventoryOptions = useMemo(
    () =>
      inventories.map((item) => ({
        value: String(item.id),
        label: `${item.description || item.part_number || `Inventory #${item.id}`} (Stock: ${item.current_stock})`,
        description: `Part No: ${item.part_number || "N/A"} • Store: ${item.store || "General"}`,
      })),
    [inventories],
  );

  const defaultSelectedPersonnelByTask = useMemo<Record<number, string[]>>(() => {
    if (!workOrder?.tasks) return {};

    return workOrder.tasks.reduce<Record<number, string[]>>((acc, task) => {
      acc[task.id] = getTaskAssignedPersonnel(task).map((person) => String(person.id));
      return acc;
    }, {});
  }, [workOrder]);

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

  const getSelectedInventoryForTask = (taskId: number) => {
    const selectedInventoryId = Number(selectedInventoryByTask[taskId]);
    if (!selectedInventoryId || Number.isNaN(selectedInventoryId)) return null;

    return inventories.find((item) => item.id === selectedInventoryId) ?? null;
  };

  const isInventoryInsufficientForTask = (taskId: number) => {
    const selectedInventory = getSelectedInventoryForTask(taskId);
    if (!selectedInventory) return false;

    const requestedQty = Number(quantityByTask[taskId] ?? "1");
    if (!Number.isFinite(requestedQty) || requestedQty < 1) return false;

    return selectedInventory.current_stock < requestedQty;
  };

  const handleRequestProcurement = async (taskId: number) => {
    setFeedback(null);
    const selectedInventoryIdRaw = selectedInventoryByTask[taskId];
    const quantityRaw = quantityByTask[taskId] ?? "1";
    let selectedInventoryId = Number(selectedInventoryIdRaw);
    const quantity = Number(quantityRaw);
    const newItemDraft = newItemByTask[taskId];

    if (!newItemDraft && (!selectedInventoryId || Number.isNaN(selectedInventoryId))) {
      setFeedback({
        type: "error",
        message: `Select an inventory item to create a parts requisition for task #${taskId}.`,
      });
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setFeedback({
        type: "error",
        message: `Enter a valid quantity to create a parts requisition for task #${taskId}.`,
      });
      return;
    }

    if (newItemDraft) {
      const result = toNewInventoryPayload(newItemDraft);
      if ("error" in result) {
        setFeedback({ type: "error", message: result.error });
        return;
      }
      try {
        selectedInventoryId = (await createInventory(toCreateInventoryPayload(result.payload)).unwrap())
          .id;
      } catch (error: unknown) {
        const responseError = error as { data?: { message?: string } };
        setFeedback({
          type: "error",
          message: responseError?.data?.message || "Failed to add the new inventory item.",
        });
        return;
      }
      // Point the task at the item just created, so a retry doesn't add it twice.
      setSelectedInventoryByTask((prev) => ({ ...prev, [taskId]: String(selectedInventoryId) }));
      setNewItemByTask((prev) => ({ ...prev, [taskId]: null }));
      refetchInventories();
    }

    try {
      await createStockMovement({
        quantity,
        movement_type: "issue",
        work_order_id: workOrderId,
        requesting_unit_id: workOrder?.asset?.unit_id ?? null,
        notes: `Parts requisition from work order task #${taskId}`,
        stocks: [
          {
            inventory_id: selectedInventoryId,
            quantity_requested: quantity,
            quantity_approved: 0,
          },
        ],
      }).unwrap();

      setFeedback({
        type: "success",
        message: `Parts requisition created for task #${taskId}.`,
      });
    } catch {
      setFeedback({
        type: "error",
        message: `Failed to create parts requisition for task #${taskId}.`,
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

  const handleAssignPersonnel = async (taskId: number) => {
    setFeedback(null);

    try {
      await updateWorkOrderTask({
        id: taskId,
        personnel_ids: (selectedPersonnelByTask[taskId] ?? defaultSelectedPersonnelByTask[taskId] ?? [])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      }).unwrap();

      setFeedback({
        type: "success",
        message: `Personnel assignment updated for task #${taskId}.`,
      });
      await refetch();
    } catch {
      setFeedback({
        type: "error",
        message: `Failed to update personnel assignment for task #${taskId}.`,
      });
    }
  };

  const handleCompleteWorkOrder = async () => {
    if (!workOrderId || isCompletingWorkOrder) return;
    try {
      await completeWorkOrder(workOrderId).unwrap();
      dispatch(
        showToast({
          message: "Work order marked as completed. Automatic compliance record generated.",
          type: "success",
        })
      );
      setFeedback({
        type: "success",
        message: "Work order marked as completed. Automatic compliance record generated.",
      });
      await refetch();
    } catch (error: unknown) {
      const responseError = error as { data?: { message?: string } };
      dispatch(
        showToast({
          message: responseError?.data?.message || "Failed to complete work order.",
          type: "error",
        })
      );
      setFeedback({
        type: "error",
        message: responseError?.data?.message || "Failed to complete work order.",
      });
    }
  };

  const handleExport = async (format: "excel" | "pdf") => {
    if (!workOrder || exportingFormat) return;

    const documents = [buildWorkOrderDocument(workOrder)];
    const fileName = sanitizeDocumentFileName(`NAAVN Work Order ${workOrder.id}`);

    setExportingFormat(format);
    try {
      if (format === "excel") {
        await exportNaavnExcel(documents, fileName);
      } else {
        await exportNaavnPdf(documents, fileName);
      }
      dispatch(
        showToast({
          message: format === "excel" ? "Work order Excel downloaded" : "Work order PDF downloaded",
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({
          message:
            format === "excel" ? "Failed to export work order Excel" : "Failed to export work order PDF",
          type: "error",
        }),
      );
    } finally {
      setExportingFormat(null);
    }
  };

  if (!workOrderId) {
    return (
      <div className="min-h-screen bg-[#001219] p-6 flex items-center justify-center">
        <div className="text-red-300">Invalid work order ID</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#001219] p-6">
      <div className="max-w-4xl mx-auto">
        <BackButton
          fallbackUrl="/dashboard/maintenance/work-orders"
          label="Back to Work Orders"
          className="mb-6"
        />

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">
                      {workOrder.title || `Work Order #${workOrder.id}`}
                    </h1>
                    <span
                      className={cn(
                        "text-xs font-bold uppercase px-2.5 py-1 rounded border",
                        workOrder.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : workOrder.status === "in_progress"
                            ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30",
                      )}
                    >
                      {workOrder.status === "completed"
                        ? "Completed"
                        : workOrder.status === "in_progress"
                          ? "In Progress"
                          : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs uppercase text-gray-400">
                    Work Order #{workOrder.id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {workOrder.status !== "completed" && (
                    <button
                      type="button"
                      onClick={handleCompleteWorkOrder}
                      disabled={isCompletingWorkOrder}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors disabled:opacity-50"
                    >
                      <Icon icon="mdi:check-decagram" className="w-4 h-4" />
                      <span>{isCompletingWorkOrder ? "Completing..." : "Complete Work Order"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleExport("excel")}
                    disabled={exportingFormat !== null}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#001825] border border-[#0A4D66]/60 text-gray-200 hover:text-white hover:border-[#7FD5FF] transition-colors"
                  >
                    <Icon icon="mdi:file-excel" className="w-4 h-4 text-emerald-400" />
                    <span>Export</span>
                  </button>
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
                          <div className="mt-2">
                            {getTaskAssignedPersonnel(task).length > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-[#7FD5FF]/30 bg-[#0A4D66]/20 px-2 py-1 text-[11px] text-[#B7E6FF]">
                                Assigned ({getTaskAssignedPersonnel(task).length})
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-gray-500/30 bg-gray-500/10 px-2 py-1 text-[11px] text-gray-300">
                                Unassigned (0)
                              </span>
                            )}
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
                        <div className="md:col-span-2">
                          <span className="text-gray-400">Assigned Personnel:</span>{" "}
                          {getTaskAssignedPersonnel(task).length > 0 ? (
                            <span className="inline-flex flex-wrap gap-2 align-middle">
                              {getTaskAssignedPersonnel(task).map((person) => (
                                <span
                                  key={person.id}
                                  className="inline-flex items-center rounded-full border border-[#7FD5FF]/30 bg-[#0A4D66]/20 px-2 py-1 text-[11px] text-[#B7E6FF]"
                                >
                                  {formatPersonnelName(person)}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-gray-500">None assigned</span>
                          )}
                        </div>
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

                      <div className="mt-4 border-t border-[#0A4D66]/30 pt-4">
                        <div className="text-xs font-semibold text-[#7FD5FF] mb-3 uppercase tracking-wide">
                          Assign Personnel
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <MultiSelect
                            className="md:col-span-3"
                            label={`Select Personnel for Task #${task.id}`}
                            placeholder="Select personnel"
                            searchable
                            searchPlaceholder="Search by name, rank or service number..."
                            options={personnelOptions}
                            selectedValues={
                              selectedPersonnelByTask[task.id] ??
                              defaultSelectedPersonnelByTask[task.id] ??
                              []
                            }
                            onChange={(selected) =>
                              setSelectedPersonnelByTask((prev) => ({
                                ...prev,
                                [task.id]: selected.map((value) => String(value)),
                              }))
                            }
                            disabled={isPersonnelLoading || isUpdatingTaskStatus}
                          />

                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handleAssignPersonnel(task.id)}
                              disabled={isUpdatingTaskStatus || isPersonnelLoading}
                              className="w-full rounded border border-[#7FD5FF]/50 px-3 py-2 text-sm text-[#7FD5FF] hover:bg-[#0A4D66]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdatingTaskStatus ? "Saving..." : "Save Assignment"}
                            </button>
                            <p className="text-[11px] text-gray-500">
                              You can select multiple personnel.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Maintenance Inventory */}
                      {task.status !== "completed" && (
                        <div className="mt-4 border-t border-[#0A4D66]/30 pt-4">
                          <div className="text-xs font-semibold text-[#7FD5FF] mb-3 uppercase tracking-wide">
                            Request Inventory
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                            <div className="md:col-span-2 flex gap-2">
                              <SearchableSelect
                                className="flex-1 min-w-0"
                                size="sm"
                                placeholder="Search & select spare part..."
                                searchPlaceholder="Type part description or part number..."
                                value={
                                  newItemByTask[task.id] ? "" : selectedInventoryByTask[task.id] ?? ""
                                }
                                onChange={(val) =>
                                  setSelectedInventoryByTask((prev) => ({
                                    ...prev,
                                    [task.id]: val ? String(val) : "",
                                  }))
                                }
                                options={inventoryOptions}
                                clearable={true}
                                disabled={isInventoriesLoading || !!newItemByTask[task.id]}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setNewItemByTask((prev) => ({
                                    ...prev,
                                    [task.id]: prev[task.id] ? null : emptyNewInventoryDraft(),
                                  }))
                                }
                                className="shrink-0 rounded border border-[#0A4D66]/50 px-3 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20"
                              >
                                {newItemByTask[task.id] ? "Pick from list" : "Not in list?"}
                              </button>
                            </div>

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

                            <div className="space-y-2">
                              {/* A new item has no stock yet, so it can only be requisitioned. */}
                              {!newItemByTask[task.id] && (
                                <button
                                  type="button"
                                  onClick={() => handleRequestInventory(task.id)}
                                  disabled={isRequestingInventory || isInventoriesLoading}
                                  className="w-full rounded border border-[#7FD5FF]/50 px-3 py-2 text-sm text-[#7FD5FF] hover:bg-[#0A4D66]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isRequestingInventory ? "Requesting..." : "Request Inventory"}
                                </button>
                              )}

                              {(newItemByTask[task.id] || isInventoryInsufficientForTask(task.id)) && (
                                <button
                                  type="button"
                                  onClick={() => handleRequestProcurement(task.id)}
                                  disabled={isRequestingProcurement || isCreatingInventory}
                                  className="w-full rounded border border-amber-400/50 px-3 py-2 text-sm text-amber-300 hover:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isCreatingInventory
                                    ? "Adding Item..."
                                    : isRequestingProcurement
                                      ? "Creating Parts Requisition..."
                                      : "Parts Requisition"}
                                </button>
                              )}
                            </div>
                          </div>

                          {newItemByTask[task.id] && (
                            <div className="mb-4">
                              <NewInventoryItemFields
                                draft={newItemByTask[task.id] as NewInventoryDraft}
                                onChange={(next) =>
                                  setNewItemByTask((prev) => ({ ...prev, [task.id]: next }))
                                }
                                expenseCategories={expenseCategories}
                              />
                            </div>
                          )}

                          {!newItemByTask[task.id] && isInventoryInsufficientForTask(task.id) && (
                            <p className="text-[11px] text-amber-300 mb-4">
                              Selected inventory stock is lower than requested quantity. You can create a parts requisition directly.
                            </p>
                          )}

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
                  onClick={() => handleExport("excel")}
                  disabled={exportingFormat !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Icon icon="mdi:file-excel-outline" className="w-4 h-4 text-emerald-400" />
                  <span>{exportingFormat === "excel" ? "Exporting..." : "Export Excel"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  disabled={exportingFormat !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Icon icon="mdi:file-pdf-box" className="w-4 h-4 text-emerald-400" />
                  <span>{exportingFormat === "pdf" ? "Exporting..." : "Export PDF"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
