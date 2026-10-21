import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import * as XLSX from "xlsx";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { BackButton } from "@/shared/ui/button/BackButton";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import {
  useGetOperationsQuery,
  useGetOperationCategoriesQuery,
  useUpdateOperationStatusMutation,
  type OperationCategory,
} from "../api";
import { OperationCategoryModal } from "../components/OperationCategoryModal";
import { OperationCategoryDetailsModal } from "../components/OperationCategoryDetailsModal";
import { DeleteOperationCategoryModal } from "../components/DeleteOperationCategoryModal";
import { OperationsOverviewTab } from "../components/OperationsOverviewTab";

type MainTab = "overview" | "missions" | "operations";
type ViewMode = "table" | "grid";

const parseApiDateTime = (value: string): Date | null => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(" ")
    ? trimmed.replace(" ", "T")
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  completed: "bg-emerald-400",
  ongoing: "bg-amber-400",
  aborted: "bg-red-500",
};

const priorityTextColor: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-300",
  high: "text-red-400",
};

export const OperationsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Top Tab
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "operations") return "operations";
    if (tabParam === "missions") return "missions";
    return "overview";
  });

  // Queries
  const { data: operations = [], isLoading: isLoadingOperations } = useGetOperationsQuery();
  const { data: categories = [], isLoading: isLoadingCategories } = useGetOperationCategoriesQuery();
  const [updateOperationStatus] = useUpdateOperationStatusMutation();

  // Common UI State
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchTerm, setSearchTerm] = useState("");

  // Missions Tab Filters
  const [selectedUnitId, setSelectedUnitId] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    return searchParams.get("category_id") || "all";
  });
  const [updatingOperationId, setUpdatingOperationId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    const status = searchParams.get("status");
    const validStatuses = ["planned", "completed", "ongoing", "aborted"];
    return status && validStatuses.includes(status) ? status : "all";
  });

  // Operations Tab Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<OperationCategory | null>(null);
  const [viewingCategoryId, setViewingCategoryId] = useState<number | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<OperationCategory | null>(null);

  // Stats for Missions
  const missionStats = useMemo(() => {
    return {
      planned: operations.filter((op) => op.status === "planned").length,
      completed: operations.filter((op) => op.status === "completed").length,
      ongoing: operations.filter((op) => op.status === "ongoing").length,
      aborted: operations.filter((op) => op.status === "aborted").length,
    };
  }, [operations]);

  // Stats for Operations
  const operationStats = useMemo(() => {
    const totalMissions = categories.reduce((sum, cat) => sum + (cat.operations_count || 0), 0);
    const activeCampaigns = categories.filter((cat) => (cat.ongoing_count || 0) > 0).length;
    return {
      total: categories.length,
      activeCampaigns,
      totalMissions,
    };
  }, [categories]);

  // Unit Options for Filter
  const unitOptions = useMemo(() => {
    const map = new Map<number, string>();
    operations.forEach((op) => {
      if (op.unit?.id && op.unit?.name && !map.has(op.unit.id)) {
        map.set(op.unit.id, op.unit.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [operations]);

  // Filtered Missions
  const filteredOperations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return operations.filter((op) => {
      if (
        selectedUnitId !== "all" &&
        String(op.unit?.id ?? "") !== selectedUnitId
      ) {
        return false;
      }

      if (
        selectedCategoryId !== "all" &&
        String(op.operation_category_id ?? "") !== selectedCategoryId
      ) {
        return false;
      }

      if (selectedPriority !== "all" && op.priority !== selectedPriority) {
        return false;
      }

      if (selectedStatus !== "all" && op.status !== selectedStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchFields = [
        op.name,
        op.description,
        op.priority,
        op.status,
        op.unit?.name,
        op.operation_category?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchFields.includes(query);
    });
  }, [operations, searchTerm, selectedPriority, selectedUnitId, selectedCategoryId, selectedStatus]);

  // Filtered Categories (Operations)
  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return categories;

    return categories.filter((cat) => {
      const searchFields = [cat.name, cat.description].filter(Boolean).join(" ").toLowerCase();
      return searchFields.includes(query);
    });
  }, [categories, searchTerm]);

  const statusOptions = ["planned", "ongoing", "completed", "aborted"] as const;

  const handleStatusChange = async (
    operationId: number,
    currentStatus: string,
    nextStatus: (typeof statusOptions)[number],
  ) => {
    if (!operationId || updatingOperationId === operationId) return;
    if (currentStatus === nextStatus) return;

    setUpdatingOperationId(operationId);
    try {
      await updateOperationStatus({ id: operationId, status: nextStatus }).unwrap();
      dispatch(showToast({ message: "Operation status updated", type: "success" }));
    } catch {
      dispatch(
        showToast({ message: "Failed to update operation status", type: "error" }),
      );
    } finally {
      setUpdatingOperationId(null);
    }
  };

  const handleDownloadExcel = () => {
    if (activeMainTab === "missions") {
      if (filteredOperations.length === 0) return;

      const rows = filteredOperations.map((op) => ({
        Name: op.name || "-",
        Date: parseApiDateTime(op.start_date_time)?.toLocaleDateString() ?? "-",
        Type: op.operation_type?.name || "-",
        Operation: op.operation_category?.name || "-",
        Unit: op.unit?.name || "-",
        Priority: op.priority || "-",
        Status: op.status || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Missions");
      XLSX.writeFile(
        workbook,
        `missions-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } else {
      if (filteredCategories.length === 0) return;

      const rows = filteredCategories.map((cat) => ({
        "Operation Name": cat.name,
        "Mandate / Description": cat.description || "-",
        "Total Missions": cat.operations_count ?? 0,
        Completed: cat.completed_count ?? 0,
        Ongoing: cat.ongoing_count ?? 0,
        Planned: cat.planned_count ?? 0,
        "Created At": parseApiDateTime(cat.created_at)?.toLocaleDateString() ?? "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Operations");
      XLSX.writeFile(
        workbook,
        `operations-campaigns-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    }
  };

  const handleTabChange = (tab: MainTab) => {
    setActiveMainTab(tab);
    setSearchTerm("");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  const handleDrilldownFromOverview = (
    tab: "overview" | "missions" | "operations",
    filterStatus?: string,
  ) => {
    setActiveMainTab(tab);
    setSearchTerm("");
    if (tab === "missions" && filterStatus) {
      setSelectedStatus(filterStatus);
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      if (filterStatus) {
        next.set("status", filterStatus);
      } else {
        next.delete("status");
      }
      return next;
    });
  };

  const handleFilterCategoryInMissionsTab = (categoryId: number) => {
    setActiveMainTab("missions");
    setSelectedCategoryId(String(categoryId));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "missions");
      next.set("category_id", String(categoryId));
      return next;
    });
  };

  // Render Missions Table
  const renderMissionsTableView = () => (
    <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-200">
          <thead className="bg-[#001219] text-gray-400 uppercase text-xs">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Region</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Operation</th>
              <th className="text-left px-4 py-3 font-medium">Unit</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperations.map((op, idx) => (
              <tr
                key={op.id}
                tabIndex={0}
                role="button"
                title="Click to view mission details"
                onClick={(e) =>
                  onInteractiveRowClick(e, () =>
                    navigate(String(op.id), {
                      state: { from: "/dashboard/operations", fromLabel: "Operations" },
                    }),
                  )
                }
                onKeyDown={(e) =>
                  onInteractiveRowKeyDown(e, () =>
                    navigate(String(op.id), {
                      state: { from: "/dashboard/operations", fromLabel: "Operations" },
                    }),
                  )
                }
                className={cn(
                  "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                  idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                )}
              >
                <td className="px-6 py-3 font-medium text-white">{op.name || "—"}</td>
                <td className="px-4 py-3 text-gray-200">
                  {parseApiDateTime(op.start_date_time)?.toLocaleDateString() ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-200">{op.operation_type?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-200">
                  {op.operation_category?.name ? (
                    <span className="font-semibold text-[#7FD5FF]">
                      {op.operation_category.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-gray-200">{op.unit?.name || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        statusDotColor[op.status] || "bg-gray-400",
                      )}
                    />
                    <select
                      value={op.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(
                          op.id,
                          op.status,
                          e.target.value as (typeof statusOptions)[number],
                        );
                      }}
                      disabled={updatingOperationId === op.id}
                      className="appearance-none bg-transparent border border-[#0A4D66]/40 rounded px-2 py-0.5 text-xs capitalize text-gray-200 focus:outline-none disabled:opacity-60"
                      aria-label="Update operation status"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status} className="bg-[#001825]">
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${op.id}/edit`, {
                          state: { from: "/dashboard/operations", fromLabel: "Operations" },
                        });
                      }}
                      className="text-gray-400 hover:text-[#7FD5FF] transition-colors p-1"
                      aria-label="Edit mission"
                      title="Edit Mission"
                    >
                      <Icon icon="mdi:pencil-outline" className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(String(op.id), {
                          state: { from: "/dashboard/operations", fromLabel: "Operations" },
                        });
                      }}
                      className="text-gray-400 hover:text-[#7FD5FF] transition-colors p-1"
                      aria-label="View mission details"
                      title="View Mission Details"
                    >
                      <Icon icon="mdi:eye-outline" className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredOperations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  No missions match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render Missions Grid
  const renderMissionsGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredOperations.map((op) => (
        <div
          key={op.id}
          tabIndex={0}
          role="button"
          title="Click to view mission details"
          onClick={(e) =>
            onInteractiveRowClick(e, () =>
              navigate(String(op.id), {
                state: { from: "/dashboard/operations", fromLabel: "Operations" },
              }),
            )
          }
          onKeyDown={(e) =>
            onInteractiveRowKeyDown(e, () =>
              navigate(String(op.id), {
                state: { from: "/dashboard/operations", fromLabel: "Operations" },
              }),
            )
          }
          className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col justify-between gap-4 cursor-pointer hover:border-[#7FD5FF]/50 transition-colors focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50"
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-white text-base">{op.name || "—"}</span>
              <span
                className={cn(
                  "text-xs capitalize font-semibold",
                  priorityTextColor[op.priority] || "text-gray-400",
                )}
              >
                {op.priority || "Normal"}
              </span>
            </div>

            {op.operation_category?.name && (
              <div className="flex items-center gap-1.5 text-xs text-[#7FD5FF] font-semibold">
                <Icon icon="mdi:shield-outline" className="w-3.5 h-3.5" />
                <span>{op.operation_category.name}</span>
              </div>
            )}

            <div className="text-xs text-gray-400 space-y-1">
              <div>Type: {op.operation_type?.name || "—"}</div>
              <div>Unit: {op.unit?.name || "—"}</div>
              {op.description && (
                <div className="line-clamp-2 text-gray-400 text-[11px] pt-1">
                  {op.description}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-3 border-t border-[#0A4D66]/40 text-gray-400">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  statusDotColor[op.status] || "bg-gray-400",
                )}
              />
              <select
                value={op.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  handleStatusChange(
                    op.id,
                    op.status,
                    e.target.value as (typeof statusOptions)[number],
                  );
                }}
                disabled={updatingOperationId === op.id}
                className="appearance-none bg-transparent border border-[#0A4D66]/40 rounded px-2 py-0.5 text-xs capitalize text-gray-200 focus:outline-none disabled:opacity-60"
                aria-label="Update operation status"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status} className="bg-[#001825]">
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span>{parseApiDateTime(op.start_date_time)?.toLocaleDateString() ?? "—"}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${op.id}/edit`);
                }}
                className="text-gray-400 hover:text-[#7FD5FF] transition-colors p-1"
                aria-label="Edit operation"
              >
                <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
      {filteredOperations.length === 0 && (
        <div className="col-span-full rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-6 text-center text-sm text-gray-400">
          No missions match the selected filters.
        </div>
      )}
    </div>
  );

  // Render Operations (Campaigns) Table
  const renderOperationsTableView = () => (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
              Total Operations / Campaigns
            </span>
            <div className="text-2xl font-bold text-white mt-0.5">
              {operationStats.total}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0A4D66]/20 border border-[#0A4D66]/40 text-[#7FD5FF]">
            <Icon icon="mdi:shield-star-outline" className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
              Active Theaters
            </span>
            <div className="text-2xl font-bold text-amber-400 mt-0.5">
              {operationStats.activeCampaigns}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Icon icon="mdi:radar" className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
              Assigned Flight Sorties
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-0.5">
              {operationStats.totalMissions}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Icon icon="mdi:airplane-takeoff" className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Operations Table */}
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-200">
            <thead className="bg-[#001825] text-gray-400 uppercase text-xs border-b border-[#0A4D66]/40">
              <tr>
                <th className="text-left px-6 py-3.5 font-semibold">Operation / Campaign</th>
                <th className="text-left px-4 py-3.5 font-semibold">Operational Mandate / Scope</th>
                <th className="text-center px-4 py-3.5 font-semibold">Missions</th>
                <th className="text-left px-4 py-3.5 font-semibold">Status Breakdown</th>
                <th className="text-left px-4 py-3.5 font-semibold">Date Registered</th>
                <th className="text-right px-6 py-3.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/30">
              {filteredCategories.map((cat, idx) => {
                const missionCount = cat.operations_count ?? 0;
                const completedCount = cat.completed_count ?? 0;
                const ongoingCount = cat.ongoing_count ?? 0;
                const plannedCount = cat.planned_count ?? 0;

                return (
                  <tr
                    key={cat.id}
                    tabIndex={0}
                    role="button"
                    title="Click to view operation details and sorties"
                    onClick={(e) => onInteractiveRowClick(e, () => setViewingCategoryId(cat.id))}
                    onKeyDown={(e) => onInteractiveRowKeyDown(e, () => setViewingCategoryId(cat.id))}
                    className={cn(
                      "hover:bg-[#0A4D66]/20 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                      idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                    )}
                  >
                    <td className="px-6 py-3.5 whitespace-nowrap font-bold text-white">
                      <div className="flex items-center gap-2">
                        <Icon icon="mdi:shield-check" className="w-4 h-4 text-[#7FD5FF]" />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-300 max-w-md">
                      <span className="line-clamp-2">
                        {cat.description || (
                          <span className="italic text-gray-500">No mandate description</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
                          missionCount > 0
                            ? "bg-[#0A4D66]/40 border-[#0A4D66] text-[#7FD5FF]"
                            : "bg-gray-800 border-gray-700 text-gray-400",
                        )}
                      >
                        {missionCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {completedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {completedCount} Completed
                          </span>
                        )}
                        {ongoingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {ongoingCount} Ongoing
                          </span>
                        )}
                        {plannedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            {plannedCount} Planned
                          </span>
                        )}
                        {missionCount === 0 && (
                          <span className="text-gray-500 italic text-[11px]">No missions</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-300">
                      {parseApiDateTime(cat.created_at)?.toLocaleDateString() ?? "—"}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* VIEW */}
                        <button
                          type="button"
                          onClick={() => setViewingCategoryId(cat.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-[#7FD5FF] hover:bg-[#0A4D66]/30 transition-colors"
                          title="View Operation and Missions"
                          aria-label={`View ${cat.name}`}
                        >
                          <Icon icon="mdi:eye-outline" className="w-4 h-4" />
                        </button>

                        {/* EDIT */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setIsAddEditModalOpen(true);
                          }}
                          className="p-1.5 rounded text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                          title="Edit Operation"
                          aria-label={`Edit ${cat.name}`}
                        >
                          <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                        </button>

                        {/* DELETE */}
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(cat)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete Operation"
                          aria-label={`Delete ${cat.name}`}
                        >
                          <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                    <Icon icon="mdi:shield-off-outline" className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                    <span>No operations match the search criteria.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#001219] text-gray-200">
      {location.state?.from && (
        <div className="flex items-center">
          <BackButton fallbackUrl="/dashboard" />
        </div>
      )}
      <div className="flex flex-col gap-4">
        {/* Top Navigation Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#0A4D66]/40 pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleTabChange("overview")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeMainTab === "overview"
                  ? "bg-[#0A4D66] text-white shadow-sm ring-1 ring-[#7FD5FF]/50"
                  : "bg-[#001825] text-gray-400 hover:text-white hover:bg-[#0A4D66]/30",
              )}
            >
              <Icon icon="mdi:view-dashboard-outline" className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("missions")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeMainTab === "missions"
                  ? "bg-[#0A4D66] text-white shadow-sm ring-1 ring-[#7FD5FF]/50"
                  : "bg-[#001825] text-gray-400 hover:text-white hover:bg-[#0A4D66]/30",
              )}
            >
              <Icon icon="mdi:airplane-takeoff" className="w-4 h-4" />
              <span>Missions</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  activeMainTab === "missions"
                    ? "bg-[#7FD5FF] text-[#001219]"
                    : "bg-gray-800 text-gray-300",
                )}
              >
                {operations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("operations")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeMainTab === "operations"
                  ? "bg-[#0A4D66] text-white shadow-sm ring-1 ring-[#7FD5FF]/50"
                  : "bg-[#001825] text-gray-400 hover:text-white hover:bg-[#0A4D66]/30",
              )}
            >
              <Icon icon="mdi:shield-cross-outline" className="w-4 h-4" />
              <span>Operations</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  activeMainTab === "operations"
                    ? "bg-[#7FD5FF] text-[#001219]"
                    : "bg-gray-800 text-gray-300",
                )}
              >
                {categories.length}
              </span>
            </button>
          </div>

          {activeMainTab !== "overview" && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <Icon
                  icon="mdi:magnify"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                />
                <input
                  type="text"
                  placeholder={
                    activeMainTab === "missions"
                      ? "Search missions..."
                      : "Search operations..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:border-cyan-500/50 w-64 text-white placeholder-gray-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Filters and Controls Toolbar */}
        {activeMainTab !== "overview" && (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#001219] p-3 rounded-lg border border-[#0A4D66]/40">
          {activeMainTab === "missions" ? (
            /* Missions Tab Controls */
            <>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {(
                  [
                    { status: "planned", dot: "bg-blue-400", label: "Planned", count: missionStats.planned },
                    { status: "completed", dot: "bg-emerald-400", label: "Completed", count: missionStats.completed },
                    { status: "ongoing", dot: "bg-amber-400", label: "Ongoing", count: missionStats.ongoing },
                    { status: "aborted", dot: "bg-red-500", label: "Aborted", count: missionStats.aborted },
                  ] as const
                ).map(({ status, dot, label, count }) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      setSelectedStatus((prev) => (prev === status ? "all" : status))
                    }
                    className={cn(
                      "flex items-center gap-2 rounded px-2 py-1 transition-colors text-xs font-medium",
                      selectedStatus === status
                        ? "bg-[#0A4D66]/50 ring-1 ring-[#7FD5FF] text-white"
                        : "hover:bg-[#0A4D66]/20 text-gray-300",
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", dot)} />
                    {label}:{" "}
                    <span className="font-bold text-white">{count}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* View Mode Toggle */}
                <div className="bg-[#001219] rounded-md p-1 flex border border-[#0A4D66]/40">
                  <button
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      viewMode === "table"
                        ? "bg-[#0A4D66] text-white"
                        : "text-gray-400 hover:text-white",
                    )}
                    title="Table View"
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
                    title="Grid View"
                  >
                    <Icon icon="mdi:view-grid" className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-6 w-px bg-[#0A4D66]/40 mx-1 hidden sm:block" />

                {/* Filter by Unit */}
                <div className="relative">
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="appearance-none px-3 py-1.5 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 focus:outline-none"
                    aria-label="Filter missions by unit"
                  >
                    <option value="all">All Units</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={String(unit.id)}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  />
                </div>

                {/* Filter by Parent Operation */}
                <div className="relative">
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="appearance-none px-3 py-1.5 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 focus:outline-none max-w-44 truncate"
                    aria-label="Filter missions by operation"
                  >
                    <option value="all">All Operations</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  />
                </div>

                {/* Filter by Priority */}
                <div className="relative">
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="appearance-none px-3 py-1.5 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 focus:outline-none"
                    aria-label="Filter missions by priority"
                  >
                    <option value="all">All Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  />
                </div>

                {/* Download Excel */}
                <button
                  onClick={handleDownloadExcel}
                  disabled={filteredOperations.length === 0}
                  className={cn(
                    "p-1.5 transition-colors",
                    filteredOperations.length === 0
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-gray-400 hover:text-white",
                  )}
                  title="Download missions as Excel"
                  aria-label="Download missions as Excel"
                >
                  <Icon icon="mdi:download" className="w-5 h-5" />
                </button>

                {/* CTA: ADD MISSION */}
                <button
                  onClick={() => navigate("/dashboard/operations/add")}
                  className="bg-[#0369A1] text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-[#0369A1]/90 transition-colors shadow-sm"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>ADD MISSION</span>
                </button>
              </div>
            </>
          ) : (
            /* Operations Tab Controls */
            <>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <Icon icon="mdi:information-outline" className="w-4 h-4 text-[#7FD5FF]" />
                <span>
                  Showing {filteredCategories.length} registered military operation campaigns.
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Download Excel */}
                <button
                  onClick={handleDownloadExcel}
                  disabled={filteredCategories.length === 0}
                  className={cn(
                    "p-1.5 transition-colors",
                    filteredCategories.length === 0
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-gray-400 hover:text-white",
                  )}
                  title="Download operations as Excel"
                  aria-label="Download operations as Excel"
                >
                  <Icon icon="mdi:download" className="w-5 h-5" />
                </button>

                {/* CTA: ADD OPERATION */}
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setIsAddEditModalOpen(true);
                  }}
                  className="bg-[#0369A1] text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-[#0369A1]/90 transition-colors shadow-sm"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>ADD OPERATION</span>
                </button>
              </div>
            </>
          )}
        </div>
        )}

        {/* Content Area */}
        {activeMainTab === "overview" ? (
          <OperationsOverviewTab
            onNavigateTab={handleDrilldownFromOverview}
            onOpenCreateCampaign={() => {
              setEditingCategory(null);
              setIsAddEditModalOpen(true);
            }}
          />
        ) : activeMainTab === "missions" ? (
          isLoadingOperations ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mr-2 text-[#7FD5FF]" />
              <span>Loading missions...</span>
            </div>
          ) : viewMode === "table" ? (
            renderMissionsTableView()
          ) : (
            renderMissionsGridView()
          )
        ) : isLoadingCategories ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mr-2 text-[#7FD5FF]" />
            <span>Loading operations...</span>
          </div>
        ) : (
          renderOperationsTableView()
        )}
      </div>

      {/* Operation Add / Edit Modal */}
      <OperationCategoryModal
        open={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingCategory(null);
        }}
        initialData={editingCategory}
      />

      {/* Operation Details & Child Missions Modal */}
      <OperationCategoryDetailsModal
        open={viewingCategoryId !== null}
        onClose={() => setViewingCategoryId(null)}
        categoryId={viewingCategoryId}
        onFilterInMissionsTab={handleFilterCategoryInMissionsTab}
      />

      {/* Delete Operation Confirmation Modal */}
      <DeleteOperationCategoryModal
        open={deletingCategory !== null}
        onClose={() => setDeletingCategory(null)}
        category={deletingCategory}
      />
    </div>
  );
};
