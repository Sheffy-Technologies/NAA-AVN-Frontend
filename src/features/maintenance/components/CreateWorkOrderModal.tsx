import React, { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import {
  useCreateWorkOrderMutation,
  useGetDefectRecordsQuery,
  useGetMaintenanceProgramsQuery,
  useCreateMaintenanceInventoryMutation,
  useUpdateWorkOrderTaskMutation,
} from "@/features/maintenance/api";
import { MultiSelect, type MultiSelectOption } from "@/shared/ui/multi-select/MultiSelect";
import { useDispatch } from "react-redux";
import { showToast } from "@/shared/store/toastSlice";

const PERSONNEL_FILTERS = {
  branches: [],
  units: [],
  ranks: [],
  corps: [],
  specialties: [],
  status: [],
};

type CreateWorkOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialAssetId?: number | null;
  initialDefectIds?: number[];
  onSuccess?: (workOrderId: number) => void;
};

type PartRequestRow = {
  inventory_id: string;
  quantity: number;
};

export const CreateWorkOrderModal: React.FC<CreateWorkOrderModalProps> = ({
  isOpen,
  onClose,
  initialAssetId,
  initialDefectIds,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Queries
  const { data: aircraftData = [], isLoading: isAssetsLoading } = useGetAssetsQuery({
    type: "aircraft",
  });
  const { data: personnelData = [], isLoading: isPersonnelLoading } =
    useGetPersonnelQuery(PERSONNEL_FILTERS);
  const { data: defectsData = [], isLoading: isDefectsLoading } = useGetDefectRecordsQuery();
  const { data: programsData = [], isLoading: isProgramsLoading } = useGetMaintenanceProgramsQuery();
  const { data: inventoriesData = [], isLoading: isInventoriesLoading } = useGetInventoriesQuery();

  // Mutations
  const [createWorkOrder, { isLoading: isCreatingWorkOrder }] = useCreateWorkOrderMutation();
  const [createMaintenanceInventory] = useCreateMaintenanceInventoryMutation();
  const [updateWorkOrderTask] = useUpdateWorkOrderTaskMutation();

  // Form State
  const [title, setTitle] = useState("");
  const [assetId, setAssetId] = useState<string>(initialAssetId ? String(initialAssetId) : "");
  const [reportedBy, setReportedBy] = useState("");
  const [category, setCategory] = useState<"defect" | "program">(
    initialDefectIds && initialDefectIds.length > 0 ? "defect" : "defect",
  );

  // Trigger selection
  const [selectedDefectIds, setSelectedDefectIds] = useState<number[]>(
    initialDefectIds ?? [],
  );
  const [selectedProgramIds, setSelectedProgramIds] = useState<number[]>([]);

  // Upfront Personnel Assignment
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);

  // Upfront Parts / Inventory Requests
  const [partRows, setPartRows] = useState<PartRequestRow[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter defects for selected asset or show open defects
  const availableDefects = useMemo(() => {
    return defectsData.filter((defect) => {
      const matchesAsset = !assetId || String(defect.asset_id) === assetId;
      const isNotClosed = defect.status !== "closed" && defect.status !== "resolved";
      return matchesAsset && isNotClosed;
    });
  }, [defectsData, assetId]);

  // Filter programs for selected asset or general programs
  const availablePrograms = useMemo(() => {
    return programsData.filter((program) => {
      if (!assetId) return true;
      return !program.asset_id || String(program.asset_id) === assetId;
    });
  }, [programsData, assetId]);

  // Personnel Options for MultiSelect
  const personnelOptions: MultiSelectOption[] = useMemo(() => {
    return personnelData.map((person) => {
      const fullName = [person.firstname, person.othernames, person.lastname]
        .filter(Boolean)
        .join(" ")
        .trim();
      const rank = person.rank?.name || "";
      const label = rank ? `${rank} ${fullName}` : fullName || `Personnel #${person.id}`;
      return {
        value: String(person.id),
        label: person.service_number ? `${label} (${person.service_number})` : label,
      };
    });
  }, [personnelData]);

  if (!isOpen) return null;

  const handleToggleDefect = (id: number) => {
    setSelectedDefectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleProgram = (id: number) => {
    setSelectedProgramIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleAddPartRow = () => {
    setPartRows((prev) => [...prev, { inventory_id: "", quantity: 1 }]);
  };

  const handleRemovePartRow = (index: number) => {
    setPartRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePartChange = (index: number, field: keyof PartRequestRow, val: any) => {
    setPartRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: val } : row)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Please provide a work order title.");
      return;
    }

    const parsedAssetId = assetId ? Number(assetId) : null;
    if (category === "defect" && selectedDefectIds.length === 0) {
      setErrorMsg("Please select at least one defect to resolve under this work order.");
      return;
    }

    if (category === "program" && selectedProgramIds.length === 0) {
      setErrorMsg("Please select at least one maintenance program / inspection.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        title: title.trim(),
        asset_id: parsedAssetId,
        reported_by: reportedBy ? Number(reportedBy) : null,
      };

      if (category === "defect") {
        payload.defect_ids = selectedDefectIds;
      } else {
        payload.maintenance_program_ids = selectedProgramIds;
      }

      // 1. Create Work Order
      const createdOrder = await createWorkOrder(payload).unwrap();

      // 2. Assign personnel to generated tasks if tasks and personnel exist
      const tasks = createdOrder.tasks || [];
      const personnelIdsToAssign = selectedPersonnelIds.map((val) => Number(val)).filter(Boolean);

      if (tasks.length > 0 && personnelIdsToAssign.length > 0) {
        for (const task of tasks) {
          try {
            await updateWorkOrderTask({
              id: task.id,
              personnel_ids: personnelIdsToAssign,
            }).unwrap();
          } catch (taskErr) {
            console.warn("Failed to assign personnel to task", task.id, taskErr);
          }
        }
      }

      // 3. Request initial inventory items for the first task or all tasks
      const validPartRows = partRows.filter(
        (r) => r.inventory_id && Number(r.quantity) > 0,
      );

      if (tasks.length > 0 && validPartRows.length > 0) {
        const primaryTask = tasks[0];
        for (const part of validPartRows) {
          try {
            await createMaintenanceInventory({
              work_order_task_id: primaryTask.id,
              inventory_id: Number(part.inventory_id),
              quantity: Number(part.quantity),
              disposition: "installed",
            }).unwrap();
          } catch (partErr) {
            console.warn("Failed to request part for task", primaryTask.id, partErr);
          }
        }
      }

      dispatch(
        showToast({
          type: "success",
          message: `Work Order #${createdOrder.id} created successfully.`,
        }),
      );

      onSuccess?.(createdOrder.id);
      onClose();
      navigate(`/dashboard/maintenance/work-orders/${createdOrder.id}`);
    } catch (err: any) {
      const serverMessage =
        err?.data?.message ||
        (err?.data?.errors
          ? Object.values(err.data.errors).flat().join(" ")
          : "Failed to create work order. Please try again.");
      setErrorMsg(serverMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        className={cn(
          "w-full max-w-3xl rounded-xl border p-6 shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col",
          isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:file-document-plus-outline" className="w-5 h-5 text-[#0A4D66] dark:text-[#7FD5FF]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">
              Create New Work Order
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-5 overflow-y-auto pr-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* SECTION 1: HEADER & ASSET */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#0A4D66] text-white inline-flex items-center justify-center text-[10px]">
                1
              </span>
              Basic Info & Aircraft Asset
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Work Order Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50-Hour Airframe & Engine Overhaul / Radio Comm Fix"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                    isDark
                      ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
                  )}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Target Aircraft Asset <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assetId}
                  onChange={(e) => {
                    setAssetId(e.target.value);
                    setSelectedDefectIds([]);
                    setSelectedProgramIds([]);
                  }}
                  disabled={isAssetsLoading}
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                    isDark
                      ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
                  )}
                >
                  <option value="">Select target aircraft</option>
                  {aircraftData.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} {asset.tail_number ? `(${asset.tail_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Reported / Authorized By</label>
                <select
                  value={reportedBy}
                  onChange={(e) => setReportedBy(e.target.value)}
                  disabled={isPersonnelLoading}
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
                    isDark
                      ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
                  )}
                >
                  <option value="">Select personnel (optional)</option>
                  {personnelData.map((person) => {
                    const name = [person.firstname, person.othernames, person.lastname]
                      .filter(Boolean)
                      .join(" ")
                      .trim();
                    const rank = person.rank?.name || "";
                    return (
                      <option key={person.id} value={person.id}>
                        {rank ? `${rank} ` : ""}{name} {person.service_number ? `(${person.service_number})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: CATEGORY & TASK ORIGIN */}
          <div className="space-y-3 pt-3 border-t dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#0A4D66] text-white inline-flex items-center justify-center text-[10px]">
                2
              </span>
              Work Order Origin & Linked Tasks
            </h4>

            {/* Category Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategory("defect")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all",
                  category === "defect"
                    ? isDark
                      ? "bg-[#0A4D66] border-[#7FD5FF] text-white shadow-md"
                      : "bg-sky-50 border-sky-600 text-sky-800 shadow-sm"
                    : isDark
                      ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400 hover:text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon icon="mdi:alert-octagon-outline" className="w-4 h-4 text-amber-500" />
                <span>Defect Resolution (Non-Routine)</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory("program")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all",
                  category === "program"
                    ? isDark
                      ? "bg-[#0A4D66] border-[#7FD5FF] text-white shadow-md"
                      : "bg-sky-50 border-sky-600 text-sky-800 shadow-sm"
                    : isDark
                      ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400 hover:text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon icon="mdi:calendar-clock" className="w-4 h-4 text-emerald-500" />
                <span>Scheduled Servicing / Overhaul (Routine)</span>
              </button>
            </div>

            {/* If Defect Category: List of Defects */}
            {category === "defect" && (
              <div
                className={cn(
                  "rounded-lg border p-3 max-h-48 overflow-y-auto space-y-2",
                  isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
                )}
              >
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Select open defects to include ({selectedDefectIds.length} selected):
                </div>
                {isDefectsLoading ? (
                  <div className="text-xs text-center py-4 text-gray-400">Loading defects...</div>
                ) : availableDefects.length === 0 ? (
                  <div className="text-xs text-center py-4 text-gray-400">
                    No open defects found {assetId ? "for this aircraft" : ""}.
                  </div>
                ) : (
                  availableDefects.map((defect) => {
                    const isSelected = selectedDefectIds.includes(defect.id);
                    return (
                      <label
                        key={defect.id}
                        className={cn(
                          "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border",
                          isSelected
                            ? isDark
                              ? "bg-[#0A4D66]/40 border-[#7FD5FF]/50 text-white"
                              : "bg-sky-50 border-sky-300 text-slate-900"
                            : isDark
                              ? "border-transparent hover:bg-white/5 text-gray-300"
                              : "border-transparent hover:bg-slate-200/50 text-slate-700",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleDefect(defect.id)}
                          className="mt-0.5 rounded border-slate-400 text-[#0A4D66]"
                        />
                        <div className="flex-1 text-xs">
                          <div className="font-semibold flex items-center gap-2">
                            <span>{defect.title || `Defect #${defect.id}`}</span>
                            <span
                              className={cn(
                                "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase",
                                defect.severity === "high" || defect.severity === "critical"
                                  ? "bg-red-500/20 text-red-400"
                                  : defect.severity === "medium"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-blue-500/20 text-blue-400",
                              )}
                            >
                              {defect.severity || "medium"}
                            </span>
                          </div>
                          {defect.description && (
                            <p className="text-[11px] text-gray-400 line-clamp-1">{defect.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}

            {/* If Program Category: List of Programs */}
            {category === "program" && (
              <div
                className={cn(
                  "rounded-lg border p-3 max-h-48 overflow-y-auto space-y-2",
                  isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
                )}
              >
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Select maintenance programs / inspections ({selectedProgramIds.length} selected):
                </div>
                {isProgramsLoading ? (
                  <div className="text-xs text-center py-4 text-gray-400">Loading programs...</div>
                ) : availablePrograms.length === 0 ? (
                  <div className="text-xs text-center py-4 text-gray-400">
                    No maintenance programs found.
                  </div>
                ) : (
                  availablePrograms.map((program) => {
                    const isSelected = selectedProgramIds.includes(program.id);
                    return (
                      <label
                        key={program.id}
                        className={cn(
                          "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border",
                          isSelected
                            ? isDark
                              ? "bg-[#0A4D66]/40 border-[#7FD5FF]/50 text-white"
                              : "bg-sky-50 border-sky-300 text-slate-900"
                            : isDark
                              ? "border-transparent hover:bg-white/5 text-gray-300"
                              : "border-transparent hover:bg-slate-200/50 text-slate-700",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleProgram(program.id)}
                          className="mt-0.5 rounded border-slate-400 text-[#0A4D66]"
                        />
                        <div className="flex-1 text-xs">
                          <div className="font-semibold flex items-center justify-between">
                            <span>{program.name}</span>
                            <span className="text-[10px] text-gray-400 capitalize">
                              {program.applicability || "General"}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-3 mt-0.5">
                            {program.interval_hours && <span>{program.interval_hours} hrs</span>}
                            {program.interval_cycles && <span>{program.interval_cycles} cyc</span>}
                            {program.interval_months && <span>{program.interval_months} mos</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: UPFRONT PERSONNEL ASSIGNMENT */}
          <div className="space-y-3 pt-3 border-t dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#0A4D66] text-white inline-flex items-center justify-center text-[10px]">
                3
              </span>
              Assign Maintenance Personnel / Crew
            </h4>

            <div>
              <MultiSelect
                label="Assign Technicians & Engineers Upfront"
                placeholder="Select crew members to assign to this work order..."
                options={personnelOptions}
                selectedValues={selectedPersonnelIds}
                onChange={(selected) => setSelectedPersonnelIds(selected.map((v) => String(v)))}
                disabled={isPersonnelLoading}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Selected crew members will be immediately assigned to the generated tasks.
              </p>
            </div>
          </div>

          {/* SECTION 4: UPFRONT SPARE PARTS / INVENTORY REQUEST */}
          <div className="space-y-3 pt-3 border-t dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#0A4D66] text-white inline-flex items-center justify-center text-[10px]">
                  4
                </span>
                Required Spares & Consumables (Inventory)
              </h4>
              <button
                type="button"
                onClick={handleAddPartRow}
                className="inline-flex items-center gap-1 text-xs text-[#0A4D66] dark:text-[#7FD5FF] hover:underline font-semibold"
              >
                <Icon icon="mdi:plus-circle" className="w-4 h-4" />
                <span>Add Spare Part</span>
              </button>
            </div>

            {partRows.length === 0 ? (
              <div
                className={cn(
                  "p-3 rounded-lg border border-dashed text-xs text-center text-gray-500 dark:text-gray-400",
                  isDark ? "border-[#0A4D66]/40" : "border-slate-300",
                )}
              >
                No spare parts added yet. Click &quot;Add Spare Part&quot; above if replacement seals, filters, or LRUs are required upfront.
              </div>
            ) : (
              <div className="space-y-2">
                {partRows.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={row.inventory_id}
                      onChange={(e) => handlePartChange(index, "inventory_id", e.target.value)}
                      disabled={isInventoriesLoading}
                      className={cn(
                        "flex-1 px-3 py-1.5 text-xs rounded-lg border outline-none transition-colors",
                        isDark
                          ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
                          : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
                      )}
                    >
                      <option value="">Select Inventory Spare Item</option>
                      {inventoriesData.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.part_number || `Item #${inv.id}`}{" "}
                          {inv.serial_number ? `(SN: ${inv.serial_number})` : ""} - Stock:{" "}
                          {inv.current_stock ?? 0} {inv.measurement_unit || ""}
                        </option>
                      ))}
                    </select>

                    <div className="w-24 flex items-center gap-1">
                      <span className="text-[11px] text-gray-400">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) =>
                          handlePartChange(index, "quantity", Math.max(1, Number(e.target.value)))
                        }
                        className={cn(
                          "w-full px-2 py-1.5 text-xs rounded-lg border outline-none text-center",
                          isDark
                            ? "bg-[#001219] border-[#0A4D66]/60 text-white"
                            : "bg-slate-50 border-slate-300 text-slate-900",
                        )}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePartRow(index)}
                      className="p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Remove part"
                    >
                      <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isCreatingWorkOrder}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCreatingWorkOrder}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors disabled:opacity-50"
            >
              <Icon icon="mdi:check-circle-outline" className="w-4 h-4" />
              <span>
                {isSubmitting || isCreatingWorkOrder
                  ? "Creating Work Order..."
                  : "Create Work Order"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
