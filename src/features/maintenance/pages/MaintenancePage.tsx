import { useMemo, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useTheme } from "@/context/ThemeContext";
import {
  useCompleteWorkOrderMutation,
  useGetComplianceRecordsQuery,
  useGetDefectRecordsQuery,
  useGetWorkOrdersQuery,
} from "@/features/maintenance/api";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useGetUnitsQuery } from "@/shared/api/units";
import PlanningPage from "./PlanningPage";
import { MaintenanceOverviewTab } from "../components/MaintenanceOverviewTab";
import { MaintenanceInventorySection, type MaintenanceInventorySubTab } from "../components/MaintenanceInventorySection";
import { CreateWorkOrderModal } from "../components/CreateWorkOrderModal";
import { LogDefectModal } from "../components/LogDefectModal";
import { MaintenanceTracker } from "../tracker/MaintenanceTracker";
import { NumberedPagination } from "@/shared/ui/pagination/NumberedPagination";

type MainTabKey = "overview" | "maintenance" | "work-orders" | "inventory";
type MaintenanceSubTabKey = "tracking" | "programs" | "compliance" | "aircraft";
type WorkOrdersSubTabKey = "work-orders" | "defects";

const MAIN_TABS: Array<{ id: MainTabKey; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "mdi:view-dashboard-outline" },
  { id: "maintenance", label: "Maintenance", icon: "mdi:wrench-outline" },
  { id: "work-orders", label: "Work Orders", icon: "mdi:file-document-edit-outline" },
  { id: "inventory", label: "Inventory", icon: "mdi:package-variant-closed" },
];

const MAINTENANCE_SUB_TABS: Array<{ id: MaintenanceSubTabKey; label: string; icon: string }> = [
  { id: "tracking", label: "Maintenance Tracking", icon: "mdi:timeline-clock-outline" },
  { id: "programs", label: "Maintenance Program", icon: "mdi:calendar-check-outline" },
  { id: "compliance", label: "Compliance Record", icon: "mdi:clipboard-text-clock-outline" },
  { id: "aircraft", label: "Aircraft", icon: "mdi:airplane" },
];

const WORK_ORDERS_SUB_TABS: Array<{ id: WorkOrdersSubTabKey; label: string; icon: string }> = [
  { id: "work-orders", label: "Work Orders", icon: "mdi:file-document-edit-outline" },
  { id: "defects", label: "Defect Logging", icon: "mdi:alert-octagon-outline" },
];

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
  const { isDark } = useTheme();

  // Determine active main tab and subtab from current URL path
  const [activeMainTab, setActiveMainTab] = useState<MainTabKey>(() => {
    const p = location.pathname;
    if (
      p.includes("/maintenance/planning") ||
      p.includes("/maintenance/compliance") ||
      p.includes("/maintenance/tracking") ||
      p.includes("/maintenance/aircraft")
    ) {
      return "maintenance";
    }
    if (p.includes("/maintenance/work-orders") || p.includes("/maintenance/defects")) {
      return "work-orders";
    }
    if (p.includes("/maintenance/inventory")) {
      return "inventory";
    }
    return "overview";
  });

  const [activeMaintenanceSubTab, setActiveMaintenanceSubTab] = useState<MaintenanceSubTabKey>(() => {
    if (location.pathname.includes("/maintenance/aircraft")) return "aircraft";
    if (location.pathname.includes("/maintenance/compliance")) return "compliance";
    if (location.pathname.includes("/maintenance/planning")) return "programs";
    return "tracking";
  });

  const [activeWorkOrdersSubTab, setActiveWorkOrdersSubTab] = useState<WorkOrdersSubTabKey>(() => {
    if (location.pathname.includes("/maintenance/defects")) return "defects";
    return "work-orders";
  });

  const [activeInventorySubTab, setActiveInventorySubTab] = useState<MaintenanceInventorySubTab>("stocks");

  // Keep state in sync if user navigates via browser back/forward or direct link
  useEffect(() => {
    const cleanPath = location.pathname.replace(/\/+$/, "");
    if (cleanPath.includes("/maintenance/planning")) {
      setActiveMainTab("maintenance");
      setActiveMaintenanceSubTab("programs");
    } else if (cleanPath.includes("/maintenance/compliance")) {
      setActiveMainTab("maintenance");
      setActiveMaintenanceSubTab("compliance");
    } else if (cleanPath.includes("/maintenance/tracking")) {
      setActiveMainTab("maintenance");
      setActiveMaintenanceSubTab("tracking");
    } else if (cleanPath.includes("/maintenance/aircraft")) {
      setActiveMainTab("maintenance");
      setActiveMaintenanceSubTab("aircraft");
    } else if (cleanPath.includes("/maintenance/work-orders")) {
      setActiveMainTab("work-orders");
      setActiveWorkOrdersSubTab("work-orders");
    } else if (cleanPath.includes("/maintenance/defects")) {
      setActiveMainTab("work-orders");
      setActiveWorkOrdersSubTab("defects");
    } else if (cleanPath.includes("/maintenance/inventory")) {
      setActiveMainTab("inventory");
    } else if (cleanPath.endsWith("/maintenance") || cleanPath === "") {
      setActiveMainTab("overview");
    }
  }, [location.pathname]);

  // Units query
  const { data: units = [] } = useGetUnitsQuery();

  // Aircraft Assets Query
  const { data: aircraftAssets = [], isLoading: isAircraftLoading } = useGetAssetsQuery({ type: "aircraft" });

  // Aircraft filters & search
  const [aircraftSearch, setAircraftSearch] = useState("");
  const [aircraftUnitFilter, setAircraftUnitFilter] = useState<string>("");
  const [aircraftStatusFilter, setAircraftStatusFilter] = useState<string>("all");

  const filteredAircraftList = useMemo(() => {
    return aircraftAssets.filter((asset) => {
      if (aircraftUnitFilter && String(asset.unit_id) !== aircraftUnitFilter) return false;
      if (aircraftStatusFilter !== "all") {
        const status = asset.serviceability_status || "serviceable";
        if (status !== aircraftStatusFilter) return false;
      }
      if (aircraftSearch.trim()) {
        const q = aircraftSearch.toLowerCase();
        const tail = (asset.tail_number || "").toLowerCase();
        const name = (asset.name || "").toLowerCase();
        const model = (asset.model || "").toLowerCase();
        const serial = (asset.serial_number || "").toLowerCase();
        if (!tail.includes(q) && !name.includes(q) && !model.includes(q) && !serial.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [aircraftAssets, aircraftUnitFilter, aircraftStatusFilter, aircraftSearch]);

  // Compliance Records Query
  const {
    data: complianceRecords = [],
    isLoading: isComplianceLoading,
    isError: isComplianceError,
  } = useGetComplianceRecordsQuery(undefined, {
    skip: activeMainTab !== "maintenance" || activeMaintenanceSubTab !== "compliance",
  });

  // Work Orders Query
  const {
    data: workOrders = [],
    isLoading: isWorkOrdersLoading,
    isError: isWorkOrdersError,
  } = useGetWorkOrdersQuery(undefined, {
    skip: activeMainTab !== "work-orders" || activeWorkOrdersSubTab !== "work-orders",
  });

  // Defects Records Query
  const {
    data: defectRecords = [],
    isLoading: isDefectRecordsLoading,
    isError: isDefectRecordsError,
  } = useGetDefectRecordsQuery(undefined, {
    skip: activeMainTab !== "work-orders" || activeWorkOrdersSubTab !== "defects",
  });

  const dispatch = useAppDispatch();
  const [completeWorkOrder, { isLoading: isCompletingWorkOrder }] = useCompleteWorkOrderMutation();

  const handleQuickCompleteWorkOrder = async (e: React.MouseEvent, workOrderId: number) => {
    e.stopPropagation();
    try {
      await completeWorkOrder(workOrderId).unwrap();
      dispatch(
        showToast({
          message: "Work order marked as completed. Automatic compliance record generated.",
          type: "success",
        })
      );
    } catch (error: unknown) {
      const responseError = error as { data?: { message?: string } };
      dispatch(
        showToast({
          message: responseError?.data?.message || "Failed to complete work order.",
          type: "error",
        })
      );
    }
  };

  // Local selection & feedback states
  const [selectedComplianceId, setSelectedComplianceId] = useState<number | null>(null);
  const [selectedDefectId, setSelectedDefectId] = useState<number | null>(null);
  const [isExportingWorkOrders, setIsExportingWorkOrders] = useState(false);
  const [selectedDefectIds, setSelectedDefectIds] = useState<Set<number>>(new Set());
  const [defectWorkOrderFeedback, setDefectWorkOrderFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  // Modals & Filter States
  const [isCreateWorkOrderModalOpen, setIsCreateWorkOrderModalOpen] = useState(false);
  const [createWorkOrderInitialDefects, setCreateWorkOrderDefectIds] = useState<number[]>([]);
  const [isLogDefectModalOpen, setIsLogDefectModalOpen] = useState(false);

  // Compliance Filter
  const [complianceAssetFilter, setComplianceAssetFilter] = useState<string>("");

  const filteredComplianceRecords = useMemo(() => {
    if (!complianceAssetFilter) return complianceRecords;
    return complianceRecords.filter((rec: any) => {
      const recAssetId = rec.asset_id || rec.task?.work_order?.asset_id || rec.task?.workOrder?.asset_id;
      return recAssetId ? String(recAssetId) === complianceAssetFilter : true;
    });
  }, [complianceRecords, complianceAssetFilter]);

  // Internal tab pagination states
  const [compliancePage, setCompliancePage] = useState(1);
  const [aircraftPage, setAircraftPage] = useState(1);
  const [workOrdersPage, setWorkOrdersPage] = useState(1);
  const [defectsPage, setDefectsPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setCompliancePage(1);
  }, [complianceAssetFilter]);

  useEffect(() => {
    setAircraftPage(1);
  }, [aircraftSearch, aircraftUnitFilter, aircraftStatusFilter]);

  const complianceTotalPages = Math.ceil(filteredComplianceRecords.length / PAGE_SIZE) || 1;
  const pagedComplianceRecords = useMemo(() => {
    const start = (compliancePage - 1) * PAGE_SIZE;
    return filteredComplianceRecords.slice(start, start + PAGE_SIZE);
  }, [filteredComplianceRecords, compliancePage]);

  const aircraftTotalPages = Math.ceil(filteredAircraftList.length / PAGE_SIZE) || 1;
  const pagedAircraftList = useMemo(() => {
    const start = (aircraftPage - 1) * PAGE_SIZE;
    return filteredAircraftList.slice(start, start + PAGE_SIZE);
  }, [filteredAircraftList, aircraftPage]);

  const workOrdersTotalPages = Math.ceil(workOrders.length / PAGE_SIZE) || 1;
  const pagedWorkOrders = useMemo(() => {
    const start = (workOrdersPage - 1) * PAGE_SIZE;
    return workOrders.slice(start, start + PAGE_SIZE);
  }, [workOrders, workOrdersPage]);

  const defectsTotalPages = Math.ceil(defectRecords.length / PAGE_SIZE) || 1;
  const pagedDefects = useMemo(() => {
    const start = (defectsPage - 1) * PAGE_SIZE;
    return defectRecords.slice(start, start + PAGE_SIZE);
  }, [defectRecords, defectsPage]);

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

  const handleCreateWorkOrderFromDefects = () => {
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

    setCreateWorkOrderDefectIds(Array.from(selectedDefectIds));
    setIsCreateWorkOrderModalOpen(true);
  };

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

  // Switch tab helper
  const handleSelectMainTab = (tabId: MainTabKey) => {
    setActiveMainTab(tabId);
    if (tabId === "overview") {
      navigate("/dashboard/maintenance");
    } else if (tabId === "maintenance") {
      if (activeMaintenanceSubTab === "programs") navigate("/dashboard/maintenance/planning");
      else if (activeMaintenanceSubTab === "compliance") navigate("/dashboard/maintenance/compliance");
      else navigate("/dashboard/maintenance/tracking");
    } else if (tabId === "work-orders") {
      if (activeWorkOrdersSubTab === "defects") navigate("/dashboard/maintenance/defects");
      else navigate("/dashboard/maintenance/work-orders");
    } else if (tabId === "inventory") {
      navigate("/dashboard/maintenance/inventory");
    }
  };

  const handleDrilldownFromOverview = (
    tabId: "maintenance" | "work-orders" | "inventory",
    subTabId?: string,
  ) => {
    setActiveMainTab(tabId);
    if (tabId === "maintenance") {
      const sub = (subTabId as MaintenanceSubTabKey) || "tracking";
      setActiveMaintenanceSubTab(sub);
      if (sub === "programs") navigate("/dashboard/maintenance/planning");
      else if (sub === "compliance") navigate("/dashboard/maintenance/compliance");
      else navigate("/dashboard/maintenance/tracking");
    } else if (tabId === "work-orders") {
      const sub = (subTabId as WorkOrdersSubTabKey) || "work-orders";
      setActiveWorkOrdersSubTab(sub);
      if (sub === "defects") navigate("/dashboard/maintenance/defects");
      else navigate("/dashboard/maintenance/work-orders");
    } else if (tabId === "inventory") {
      setActiveInventorySubTab((subTabId as MaintenanceInventorySubTab) || "stocks");
      navigate("/dashboard/maintenance/inventory");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className={cn(
              "text-2xl font-bold uppercase tracking-wide",
              isDark ? "text-white" : "text-slate-900",
            )}
          >
            Maintenance Hub
          </h1>
        </div>
      </div>

      {/* Top-Level Navigation Tabs */}
      <div className={cn("border-b relative", isDark ? "border-[#0A4D66]/40" : "border-slate-300")}>
        <div className="flex space-x-2 sm:space-x-4">
          {MAIN_TABS.map((tab) => {
            const isActive = activeMainTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectMainTab(tab.id)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-3 text-sm transition-all relative outline-none rounded-t-lg",
                  isActive
                    ? isDark
                      ? "text-[#7FD5FF] font-bold bg-[#7FD5FF]/10"
                      : "text-sky-600 font-bold bg-sky-50"
                    : isDark
                      ? "text-gray-400 font-medium hover:text-white hover:bg-white/5"
                      : "text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                <Icon
                  icon={tab.icon}
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive
                      ? isDark
                        ? "text-[#7FD5FF]"
                        : "text-sky-600"
                      : isDark
                        ? "text-gray-400"
                        : "text-slate-500",
                  )}
                />
                <span>{tab.label}</span>
                {isActive && (
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full transition-all",
                      isDark
                        ? "bg-[#00A3E0] shadow-[0_0_12px_rgba(0,163,224,0.9)]"
                        : "bg-sky-600 shadow-sm",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeMainTab === "overview" && (
        <MaintenanceOverviewTab
          onNavigateTab={handleDrilldownFromOverview}
          onOpenCreateWorkOrder={() => {
            setCreateWorkOrderDefectIds([]);
            setIsCreateWorkOrderModalOpen(true);
          }}
          onOpenLogDefect={() => setIsLogDefectModalOpen(true)}
        />
      )}

      {/* TAB 2: MAINTENANCE */}
      {activeMainTab === "maintenance" && (
        <div className="space-y-6">
          {/* 3 Maintenance Subtabs with pill style */}
          <div className="flex items-center justify-between">
            <div
              className={cn(
                "flex items-center space-x-1 p-1 rounded-xl border",
                isDark ? "bg-[#0A4D66] border-[#0A4D66]" : "bg-slate-200 border-slate-300",
              )}
            >
              {MAINTENANCE_SUB_TABS.map((subTab) => {
                const isActive = activeMaintenanceSubTab === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => {
                      setActiveMaintenanceSubTab(subTab.id);
                      if (subTab.id === "programs") navigate("/dashboard/maintenance/planning");
                      else if (subTab.id === "compliance") navigate("/dashboard/maintenance/compliance");
                      else if (subTab.id === "aircraft") navigate("/dashboard/maintenance/aircraft");
                      else navigate("/dashboard/maintenance/tracking");
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      isActive
                        ? isDark
                          ? "bg-[#001825] text-[#7FD5FF] font-bold shadow-md border border-[#7FD5FF]/50"
                          : "bg-white text-sky-700 font-bold shadow-md border border-slate-300"
                        : isDark
                          ? "text-gray-200 hover:text-white"
                          : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <Icon
                      icon={subTab.icon}
                      className={cn(
                        "w-4 h-4",
                        isActive
                          ? isDark
                            ? "text-[#7FD5FF]"
                            : "text-sky-700"
                          : isDark
                            ? "text-gray-300"
                            : "text-slate-500",
                      )}
                    />
                    <span>{subTab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtab Content: Maintenance Programs (Planning) */}
          {activeMaintenanceSubTab === "programs" && <PlanningPage />}

          {/* Subtab Content: Maintenance Tracking (the maintenance tracker) */}
          {activeMaintenanceSubTab === "tracking" && <MaintenanceTracker />}

          {/* Subtab Content: Compliance Records */}
          {activeMaintenanceSubTab === "compliance" && (
            <div
              className={cn(
                "border rounded-xl p-6",
                isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#0A4D66] dark:text-[#7FD5FF] uppercase tracking-wide">
                    Compliance Records
                  </h2>
                  <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
                    Airworthiness Directives, Service Bulletins & Phase Inspection Completion History
                  </p>
                </div>
                <div className="w-56">
                  <select
                    value={complianceAssetFilter}
                    onChange={(e) => setComplianceAssetFilter(e.target.value)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-1.5 text-xs outline-none transition-colors",
                      isDark
                        ? "border-[#0A4D66]/50 bg-[#001825] text-gray-200 focus:border-[#7FD5FF]"
                        : "border-slate-300 bg-white text-slate-800 focus:border-[#0A4D66] shadow-sm",
                    )}
                  >
                    <option value="">All Aircraft</option>
                    {aircraftAssets.map((asset) => (
                      <option key={asset.id} value={String(asset.id)}>
                        {asset.name} {asset.tail_number ? `(${asset.tail_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isComplianceLoading ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  Loading compliance records...
                </div>
              ) : isComplianceError ? (
                <div className="text-red-500 dark:text-red-300 text-xs py-4">Failed to load compliance records.</div>
              ) : filteredComplianceRecords.length === 0 ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  No compliance records found.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        className={cn(
                          "text-left border-b font-semibold uppercase tracking-wider",
                          isDark ? "text-gray-400 border-[#0A4D66]/40" : "text-slate-500 border-slate-200",
                        )}
                      >
                        <th className="py-2.5 px-3">Record ID</th>
                        <th className="py-2.5 px-3">Linked Work Order</th>
                        <th className="py-2.5 px-3">Target Asset</th>
                        <th className="py-2.5 px-3">Completion Date</th>
                        <th className="py-2.5 px-3">Next Due</th>
                        <th className="py-2.5 px-3">Compliance Description</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A4D66]/20 dark:divide-[#0A4D66]/20 divide-slate-100">
                      {pagedComplianceRecords.map((row) => (
                        <tr
                          key={row.id}
                          tabIndex={0}
                          role="button"
                          title="Click to view compliance details"
                          onClick={(e) => onInteractiveRowClick(e, () => setSelectedComplianceId(row.id))}
                          onKeyDown={(e) => onInteractiveRowKeyDown(e, () => setSelectedComplianceId(row.id))}
                          className={cn(
                            "transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                            isDark ? "hover:bg-[#0A4D66]/30 text-gray-200" : "hover:bg-sky-50 text-slate-700",
                            selectedComplianceId === row.id && (isDark ? "bg-[#0A4D66]/20" : "bg-sky-50")
                          )}
                        >
                          <td className="py-2.5 px-3 font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">
                            #{row.id}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            {row.task?.work_order?.title ||
                              (row.task?.work_order_id
                                ? `WO #${row.task.work_order_id}`
                                : row.work_order_task_id
                                  ? `WO Task #${row.work_order_task_id}`
                                  : "-")}
                          </td>
                          <td className="py-2.5 px-3">
                            {row.task?.work_order?.asset?.name ||
                              row.task?.work_order?.asset?.tail_number ||
                              "-"}
                          </td>
                          <td className="py-2.5 px-3">{formatDate(row.completion_date)}</td>
                          <td className="py-2.5 px-3">
                            {formatDate(row.next_due_date)}
                            {row.next_due_hours ? ` (${row.next_due_hours} hrs)` : ""}
                          </td>
                          <td className="py-2.5 px-3 truncate max-w-xs text-slate-600 dark:text-gray-300">
                            {row.description || row.remarks || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedComplianceId(row.id)}
                              className="text-xs text-[#0A4D66] dark:text-[#7FD5FF] hover:underline font-semibold"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {complianceTotalPages > 1 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Showing {(compliancePage - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(compliancePage * PAGE_SIZE, filteredComplianceRecords.length)} of{" "}
                      {filteredComplianceRecords.length} records
                    </span>
                    <NumberedPagination
                      currentPage={compliancePage}
                      lastPage={complianceTotalPages}
                      onPageChange={setCompliancePage}
                    />
                  </div>
                )}
              </>
            )}

              {selectedComplianceItem && (
                <div
                  className={cn(
                    "mt-4 rounded-xl border p-4 text-xs space-y-1.5",
                    isDark
                      ? "border-[#0A4D66]/40 bg-[#001825] text-gray-200"
                      : "border-slate-200 bg-slate-50 text-slate-800 shadow-sm",
                  )}
                >
                  <div className="flex items-center justify-between border-b pb-2 mb-2 dark:border-slate-700">
                    <span className="text-xs uppercase font-bold text-[#0A4D66] dark:text-[#7FD5FF]">
                      Compliance Record #{selectedComplianceItem.id} Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedComplianceId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white"
                    >
                      Close ✕
                    </button>
                  </div>
                  <div>
                    <strong>Linked Work Order:</strong>{" "}
                    {selectedComplianceItem.task?.work_order?.title ||
                      (selectedComplianceItem.task?.work_order_id
                        ? `WO #${selectedComplianceItem.task.work_order_id}`
                        : selectedComplianceItem.work_order_task_id
                          ? `WO Task #${selectedComplianceItem.work_order_task_id}`
                          : "-")}
                  </div>
                  <div>
                    <strong>Target Asset:</strong>{" "}
                    {selectedComplianceItem.task?.work_order?.asset?.name
                      ? `${selectedComplianceItem.task.work_order.asset.name} (${selectedComplianceItem.task.work_order.asset.tail_number || "No Tail"})`
                      : "-"}
                  </div>
                  {selectedComplianceItem.task?.program && (
                    <div>
                      <strong>Maintenance Program:</strong> {selectedComplianceItem.task.program.name}
                    </div>
                  )}
                  {selectedComplianceItem.task?.defect && (
                    <div>
                      <strong>Resolved Defect Snag:</strong> {selectedComplianceItem.task.defect.title}
                    </div>
                  )}
                  <div>
                    <strong>Completion Date:</strong> {formatDate(selectedComplianceItem.completion_date)}
                  </div>
                  <div>
                    <strong>Next Due Date:</strong> {formatDate(selectedComplianceItem.next_due_date)}
                  </div>
                  <div>
                    <strong>Next Due Hours:</strong> {selectedComplianceItem.next_due_hours ?? "-"}
                  </div>
                  <div>
                    <strong>Compliance Description:</strong>{" "}
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {selectedComplianceItem.description || selectedComplianceItem.remarks || "-"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subtab Content: Aircraft Fleet Maintenance */}
          {activeMaintenanceSubTab === "aircraft" && (
            <div
              className={cn(
                "border rounded-xl p-6",
                isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
              )}
            >
              {/* Header & Subtitle */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#0A4D66] dark:text-[#7FD5FF] uppercase tracking-wide">
                    Aircraft Fleet Maintenance
                  </h2>
                  <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
                    Inspect aircraft fleet through a maintenance engineering lens. Monitor operating hours, airworthiness status, and component tracking.
                  </p>
                </div>
              </div>

              {/* Status Breakdown Pills */}
              <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-semibold">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30">
                  Total Aircraft: {aircraftAssets.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                  Airworthy / Serviceable: {aircraftAssets.filter((a) => (a.serviceability_status || "serviceable") === "serviceable").length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  In Maintenance: {aircraftAssets.filter((a) => a.serviceability_status === "under_maintenance").length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/30">
                  Grounded: {aircraftAssets.filter((a) => a.serviceability_status === "grounded").length}
                </span>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="relative">
                  <Icon
                    icon="mdi:magnify"
                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={aircraftSearch}
                    onChange={(e) => setAircraftSearch(e.target.value)}
                    placeholder="Search tail no, model, serial..."
                    className={cn(
                      "w-full rounded-lg border pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                      isDark ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500" : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                    )}
                  />
                </div>

                <SearchableSelect
                  size="sm"
                  placeholder="All Units"
                  searchPlaceholder="Search unit..."
                  value={aircraftUnitFilter}
                  onChange={(val) => setAircraftUnitFilter(val ? String(val) : "")}
                  options={[
                    { value: "", label: "All Units" },
                    ...units.map((u) => ({ value: String(u.id), label: u.name })),
                  ]}
                  clearable={false}
                />

                <SearchableSelect
                  size="sm"
                  placeholder="All Statuses"
                  searchPlaceholder="Search status..."
                  value={aircraftStatusFilter}
                  onChange={(val) => setAircraftStatusFilter(val ? String(val) : "all")}
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "serviceable", label: "Serviceable (Airworthy)" },
                    { value: "under_maintenance", label: "Under Maintenance" },
                    { value: "grounded", label: "Grounded" },
                  ]}
                  clearable={false}
                />
              </div>

              {/* Table */}
              {isAircraftLoading ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  Loading aircraft fleet...
                </div>
              ) : filteredAircraftList.length === 0 ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  No aircraft matching filters.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        className={cn(
                          "text-left border-b font-semibold uppercase tracking-wider",
                          isDark ? "text-gray-400 border-[#0A4D66]/40" : "text-slate-500 border-slate-200",
                        )}
                      >
                        <th className="py-2.5 px-3">Tail Number</th>
                        <th className="py-2.5 px-3">Aircraft Model</th>
                        <th className="py-2.5 px-3">Serial Number</th>
                        <th className="py-2.5 px-3">Assigned Unit</th>
                        <th className="py-2.5 px-3">Total Hours</th>
                        <th className="py-2.5 px-3">Total Cycles</th>
                        <th className="py-2.5 px-3">Airworthiness</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A4D66]/20 dark:divide-[#0A4D66]/20 divide-slate-100">
                      {pagedAircraftList.map((asset) => {
                        const status = asset.serviceability_status || "serviceable";
                        const isGrounded = status === "grounded";
                        const isMaint = status === "under_maintenance";
                        const assignedUnit = units.find((u) => u.id === asset.unit_id);

                        return (
                          <tr
                            key={asset.id}
                            tabIndex={0}
                            role="button"
                            title="Click to view aircraft details"
                            onClick={(e) =>
                              onInteractiveRowClick(e, () =>
                                navigate(`/dashboard/assets/${asset.id}`, {
                                  state: {
                                    from: "/dashboard/maintenance",
                                    fromLabel: "Maintenance Aircraft",
                                  },
                                }),
                              )
                            }
                            onKeyDown={(e) =>
                              onInteractiveRowKeyDown(e, () =>
                                navigate(`/dashboard/assets/${asset.id}`, {
                                  state: {
                                    from: "/dashboard/maintenance",
                                    fromLabel: "Maintenance Aircraft",
                                  },
                                }),
                              )
                            }
                            className={cn(
                              "transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                              isDark ? "hover:bg-[#0A4D66]/20 text-gray-200" : "hover:bg-slate-50 text-slate-700",
                            )}
                          >
                            <td className="py-2.5 px-3 font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">
                              <span className="inline-flex items-center gap-1.5">
                                <Icon icon="mdi:airplane" className="w-4 h-4 text-[#7FD5FF]" />
                                <span>{asset.tail_number || "No Tail"}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-white">
                              {asset.name} {asset.model ? `(${asset.model})` : ""}
                            </td>
                            <td className="py-2.5 px-3 text-gray-400">
                              {asset.serial_number || "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              {assignedUnit?.name || "—"}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-400">
                              {(asset.current_total_hours || 0).toLocaleString()} hrs
                            </td>
                            <td className="py-2.5 px-3">
                              {(asset.current_total_cycles || 0).toLocaleString()} cyc
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border capitalize",
                                  isGrounded
                                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                                    : isMaint
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                                )}
                              >
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    isGrounded ? "bg-red-400" : isMaint ? "bg-amber-400" : "bg-emerald-400",
                                  )}
                                />
                                {status === "serviceable" ? "Airworthy" : status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/dashboard/assets/${asset.id}`, {
                                    state: {
                                      from: "/dashboard/maintenance",
                                      fromLabel: "Maintenance Aircraft",
                                    },
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-medium shadow-sm transition-colors"
                              >
                                <Icon icon="mdi:wrench-outline" className="w-3.5 h-3.5" />
                                <span>View Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {aircraftTotalPages > 1 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Showing {(aircraftPage - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(aircraftPage * PAGE_SIZE, filteredAircraftList.length)} of{" "}
                      {filteredAircraftList.length} aircraft
                    </span>
                    <NumberedPagination
                      currentPage={aircraftPage}
                      lastPage={aircraftTotalPages}
                      onPageChange={setAircraftPage}
                    />
                  </div>
                )}
              </>
            )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WORK ORDERS */}
      {activeMainTab === "work-orders" && (
        <div className="space-y-6">
          {/* 2 Work Orders Subtabs */}
          <div className="flex items-center justify-between">
            <div
              className={cn(
                "flex items-center space-x-1 p-1 rounded-xl border",
                isDark ? "bg-[#0A4D66] border-[#0A4D66]" : "bg-slate-200 border-slate-300",
              )}
            >
              {WORK_ORDERS_SUB_TABS.map((subTab) => {
                const isActive = activeWorkOrdersSubTab === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => {
                      setActiveWorkOrdersSubTab(subTab.id);
                      if (subTab.id === "defects") navigate("/dashboard/maintenance/defects");
                      else navigate("/dashboard/maintenance/work-orders");
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      isActive
                        ? isDark
                          ? "bg-[#001825] text-[#7FD5FF] font-bold shadow-md border border-[#7FD5FF]/50"
                          : "bg-white text-sky-700 font-bold shadow-md border border-slate-300"
                        : isDark
                          ? "text-gray-200 hover:text-white"
                          : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <Icon
                      icon={subTab.icon}
                      className={cn(
                        "w-4 h-4",
                        isActive
                          ? isDark
                            ? "text-[#7FD5FF]"
                            : "text-sky-700"
                          : isDark
                            ? "text-gray-300"
                            : "text-slate-500",
                      )}
                    />
                    <span>{subTab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Actions for Work Orders */}
            {activeWorkOrdersSubTab === "work-orders" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateWorkOrderDefectIds([]);
                    setIsCreateWorkOrderModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>New Work Order</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportWorkOrdersExcel}
                  disabled={isExportingWorkOrders || isWorkOrdersLoading}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    isDark
                      ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/20"
                      : "border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100",
                  )}
                >
                  <Icon
                    icon={isExportingWorkOrders ? "mdi:loading" : "mdi:microsoft-excel"}
                    className={cn("w-4 h-4", isExportingWorkOrders ? "animate-spin" : "")}
                  />
                  <span>{isExportingWorkOrders ? "Exporting..." : "Export Excel"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Subtab Content: Work Orders List */}
          {activeWorkOrdersSubTab === "work-orders" && (
            <div
              className={cn(
                "border rounded-xl p-6",
                isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[#0A4D66] dark:text-[#7FD5FF] uppercase">
                  Active Work Orders
                </h2>
              </div>

              {isWorkOrdersLoading ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  Loading work orders...
                </div>
              ) : isWorkOrdersError ? (
                <div className="text-red-500 dark:text-red-300 text-xs py-4">Failed to load work orders.</div>
              ) : workOrders.length === 0 ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  No work orders found. Click "New Work Order" to create one.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                  {pagedWorkOrders.map((order) => {
                    const isCompleted = order.status === "completed";
                    const isInProgress = order.status === "in_progress";
                    return (
                      <div
                        key={order.id}
                        onClick={() =>
                          navigate(`/dashboard/maintenance/work-orders/${order.id}`, {
                            state: {
                              from: "/dashboard/maintenance/work-orders",
                              fromLabel: "Work Orders",
                            },
                          })
                        }
                        className={cn(
                          "w-full text-left rounded-xl border p-4 transition-all group cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                          isDark
                            ? "border-[#0A4D66]/30 bg-[#001825] hover:border-[#7FD5FF]/50 hover:bg-[#001825]/90"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
                              {order.title || `Work Order #${order.id}`}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                                isCompleted
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : isInProgress
                                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                                    : "bg-amber-500/20 text-amber-400 border-amber-500/30",
                              )}
                            >
                              {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Pending"}
                            </span>
                          </div>
                          <div className={cn("text-xs", isDark ? "text-gray-400" : "text-slate-500")}>
                            Asset ID: {order.asset_id ?? "-"} • Tasks: {order.tasks?.length ?? 0}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className={cn("text-xs", isDark ? "text-gray-400" : "text-slate-500")}>
                            {formatDate(order.created_at)}
                          </div>
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickCompleteWorkOrder(e, order.id)}
                              disabled={isCompletingWorkOrder}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors flex items-center gap-1"
                            >
                              <Icon icon="mdi:check-circle-outline" className="w-3.5 h-3.5" />
                              <span>Complete</span>
                            </button>
                          )}
                          <Icon icon="mdi:arrow-right" className="w-4 h-4 text-[#0A4D66] dark:text-[#7FD5FF] group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {workOrdersTotalPages > 1 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Showing {(workOrdersPage - 1) * PAGE_SIZE + 1} to{" "}
                      {Math.min(workOrdersPage * PAGE_SIZE, workOrders.length)} of{" "}
                      {workOrders.length} work orders
                    </span>
                    <NumberedPagination
                      currentPage={workOrdersPage}
                      lastPage={workOrdersTotalPages}
                      onPageChange={setWorkOrdersPage}
                    />
                  </div>
                )}
              </>
            )}
            </div>
          )}

          {/* Subtab Content: Defects Logging */}
          {activeWorkOrdersSubTab === "defects" && (
            <div
              className={cn(
                "border rounded-xl p-6",
                isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[#0A4D66] dark:text-[#7FD5FF] uppercase">
                  Discrepancies & Defect Snag List
                </h2>
                <button
                  type="button"
                  onClick={() => setIsLogDefectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow transition-colors"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Log Defect / Snag</span>
                </button>
              </div>

              {isDefectRecordsLoading ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  Loading discrepancies/defects...
                </div>
              ) : isDefectRecordsError ? (
                <div className="text-red-500 dark:text-red-300 text-xs py-4">Failed to load discrepancies/defects.</div>
              ) : defectRecords.length === 0 ? (
                <div className={cn("text-xs py-8 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
                  No discrepancies/defects found.
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCreateWorkOrderFromDefects}
                      disabled={selectedDefectIds.size === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon icon="mdi:file-document-plus" className="w-4 h-4" />
                      <span>
                        {selectedDefectIds.size === 0
                          ? "Create Work Order from Defects"
                          : `Create Work Order from Defects (${selectedDefectIds.size})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleAllDefects}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        isDark
                          ? "border-[#7FD5FF]/50 text-[#7FD5FF] hover:bg-[#0A4D66]/20"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {allDefectsSelected ? "Unselect All" : "Select All"}
                    </button>
                  </div>

                  {defectWorkOrderFeedback && (
                    <div
                      className={cn(
                        "mb-4 rounded-lg border px-3 py-2 text-xs",
                        defectWorkOrderFeedback.type === "success"
                          ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-300"
                          : "border-red-500/40 bg-red-900/20 text-red-300",
                      )}
                    >
                      {defectWorkOrderFeedback.message}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr
                          className={cn(
                            "text-left border-b font-semibold uppercase tracking-wider",
                            isDark ? "text-gray-400 border-[#0A4D66]/40" : "text-slate-500 border-slate-200",
                          )}
                        >
                          <th className="py-2.5 px-3 w-8">Select</th>
                          <th className="py-2.5 px-3">ID</th>
                          <th className="py-2.5 px-3">Title</th>
                          <th className="py-2.5 px-3">Severity</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Reported At</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0A4D66]/20 dark:divide-[#0A4D66]/20 divide-slate-100">
                        {pagedDefects.map((defect) => (
                          <tr
                            key={defect.id}
                            tabIndex={0}
                            role="button"
                            title="Click to view defect details"
                            onClick={(e) => onInteractiveRowClick(e, () => setSelectedDefectId(defect.id))}
                            onKeyDown={(e) => onInteractiveRowKeyDown(e, () => setSelectedDefectId(defect.id))}
                            className={cn(
                              "transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                              isDark ? "hover:bg-[#0A4D66]/30 text-gray-200" : "hover:bg-sky-50 text-slate-700",
                              selectedDefectItem?.id === defect.id && (isDark ? "bg-[#0A4D66]/20" : "bg-sky-50")
                            )}
                          >
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                checked={selectedDefectIds.has(defect.id)}
                                onChange={() => handleToggleDefect(defect.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                title={`Select defect ${defect.id}`}
                              />
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">
                              #{defect.id}
                            </td>
                            <td className="py-2.5 px-3 font-medium">{defect.title || "-"}</td>
                            <td className="py-2.5 px-3 capitalize">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                                  defect.severity === "critical"
                                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                                    : defect.severity === "major"
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                      : "bg-blue-500/10 text-blue-400 border-blue-500/30",
                                )}
                              >
                                {defect.severity || "routine"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 capitalize">{defect.status || "-"}</td>
                            <td className="py-2.5 px-3">{formatDate(defect.reported_at)}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedDefectId(defect.id)}
                                className="text-xs text-[#0A4D66] dark:text-[#7FD5FF] hover:underline font-semibold"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {defectsTotalPages > 1 && (
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Showing {(defectsPage - 1) * PAGE_SIZE + 1} to{" "}
                        {Math.min(defectsPage * PAGE_SIZE, defectRecords.length)} of{" "}
                        {defectRecords.length} defects
                      </span>
                      <NumberedPagination
                        currentPage={defectsPage}
                        lastPage={defectsTotalPages}
                        onPageChange={setDefectsPage}
                      />
                    </div>
                  )}
                </>
              )}

              {selectedDefectItem && (
                <div
                  className={cn(
                    "mt-4 rounded-xl border p-4 text-xs space-y-1.5",
                    isDark
                      ? "border-[#0A4D66]/40 bg-[#001825] text-gray-200"
                      : "border-slate-200 bg-slate-50 text-slate-800 shadow-sm",
                  )}
                >
                  <div className="flex items-center justify-between border-b pb-2 mb-2 dark:border-slate-700">
                    <span className="text-xs uppercase font-bold text-[#0A4D66] dark:text-[#7FD5FF]">
                      Defect #{selectedDefectItem.id} Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDefectId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white"
                    >
                      Close ✕
                    </button>
                  </div>
                  <div><strong>Title:</strong> {selectedDefectItem.title || "-"}</div>
                  <div><strong>Description:</strong> {selectedDefectItem.description || "-"}</div>
                  <div><strong>Severity:</strong> {selectedDefectItem.severity || "-"}</div>
                  <div><strong>Status:</strong> {selectedDefectItem.status || "-"}</div>
                  <div><strong>Reported At:</strong> {formatDate(selectedDefectItem.reported_at)}</div>
                  <div><strong>Resolved At:</strong> {formatDate(selectedDefectItem.resolved_at)}</div>
                  <div><strong>Asset ID:</strong> {selectedDefectItem.asset_id ?? "-"}</div>
                  <div><strong>Remarks:</strong> {selectedDefectItem.remarks || "-"}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INVENTORY */}
      {activeMainTab === "inventory" && (
        <MaintenanceInventorySection initialSubTab={activeInventorySubTab} />
      )}

      {/* CREATE WORK ORDER MODAL */}
      <CreateWorkOrderModal
        isOpen={isCreateWorkOrderModalOpen}
        onClose={() => setIsCreateWorkOrderModalOpen(false)}
        initialDefectIds={createWorkOrderInitialDefects}
        onSuccess={(woId) => {
          setIsCreateWorkOrderModalOpen(false);
          setSelectedDefectIds(new Set());
          navigate(`/dashboard/maintenance/work-orders/${woId}`);
        }}
      />

      {/* LOG DEFECT / SNAG MODAL */}
      <LogDefectModal
        isOpen={isLogDefectModalOpen}
        onClose={() => setIsLogDefectModalOpen(false)}
      />
    </div>
  );
};
