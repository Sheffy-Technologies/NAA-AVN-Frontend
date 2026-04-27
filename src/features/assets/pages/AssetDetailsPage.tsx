
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAppDispatch } from "@/app/store";
import { useGetUnitsQuery } from "@/shared/api/units";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateWorkOrderMutation,
  useGetComplianceRecordsQuery,
  useGetMaintenanceProgramsQuery,
  useGetWorkOrdersQuery,
  useUpdateWorkOrderTaskMutation,
} from "@/features/maintenance/api";
import {
  useDeleteAssetMutation,
  useGetAssetByIdQuery,
  useGetAtaChaptersQuery,
  useGetAssetTypesQuery,
  useGetAvionicCategoriesQuery,
  useGetComponentTypesQuery,
  useGetEngineCategoriesQuery,
  useGetEnginePositionsQuery,
  useUpdateAssetMutation,
  type Avionics,
  type Component,
  type Engine,
} from "../api";
import { cn } from "@/shared/utils/cn";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import AssetMaintenanceProgramsSearchable from "./AssetMaintenanceProgramsSearchable";


const TABS = [
  { id: "info", label: "Aircraft Information" },
  { id: "airframe", label: "Airframe" },
  { id: "engines", label: "Engines" },
  { id: "avionics", label: "Avionics" },
  { id: "discrepancies", label: "Discrepancies" },
  { id: "operations", label: "Operations" },
  { id: "maintenance", label: "Maintenance Tracking" },
] as const;

type AssetTabId = (typeof TABS)[number]["id"];

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  completed: "bg-emerald-400",
  ongoing: "bg-amber-400",
  active: "bg-amber-400",
  aborted: "bg-red-500",
};

const formatStatus = (status: string | null | undefined) => {
  if (!status) return "-";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return parsed.toLocaleString();
};

const formatHours = (value: number | string | null | undefined) => {
  const formatted = formatNumber(value);
  return formatted === "-" ? "-" : `${formatted} hrs`;
};

const formatCycles = (value: number | string | null | undefined) => {
  const formatted = formatNumber(value);
  return formatted === "-" ? "-" : `${formatted} cyc`;
};

const formatInspectionInterval = (
  value: number | string | null | undefined,
  unit: string | null | undefined,
) => {
  const formatted = formatNumber(value);
  if (formatted === "-") return "-";

  const suffixMap: Record<string, string> = {
    hours: "hrs",
    months: "months",
    cycle: "cyc",
  };

  const suffix = suffixMap[String(unit || "").toLowerCase()] || "";
  return suffix ? `${formatted} ${suffix}` : formatted;
};

const formatDifference = (
  limit: number | string | null | undefined,
  current: number | string | null | undefined,
  suffix: string,
) => {
  const limitValue = Number(limit);
  const currentValue = Number(current);

  if (Number.isNaN(limitValue) || Number.isNaN(currentValue)) return "-";

  return `${Math.max(limitValue - currentValue, 0).toLocaleString()} ${suffix}`;
};

const parseConfiguration = (configuration: unknown) => {
  // coerce to string[]
  const list = Array.isArray(configuration)
    ? configuration
    : typeof configuration === "string"
    ? [configuration]
    : [];
  const entries = list.reduce<Record<string, string>>(
    (acc, item) => {
      const [key, ...rest] = String(item).split(":");
      if (!key || rest.length === 0) return acc;
      acc[key] = rest.join(":");
      return acc;
    },
    {},
  );

  return {
    role: entries.role ? formatStatus(entries.role) : "-",
    seats: entries.seats ?? "-",
  };
};

const toNumeric = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toDateOnly = (value: string | null | undefined) => {
  if (!value) return "";
  return value.split("T")[0];
};

const toIntervalUnit = (
  value: string | null | undefined,
): "hours" | "months" | "cycle" => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "months") return "months";
  if (normalized === "cycle") return "cycle";
  return "hours";
};

const toMaintenanceStrategy = (
  value: string | null | undefined,
): "hard-time" | "on-condition" | "condition" => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "on-condition") return "on-condition";
  if (normalized === "condition") return "condition";
  return "hard-time";
};

const toNullableNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const cloneEngine = (engine: Engine): Engine => ({
  ...engine,
  position_id: Number(engine.position_id) || 1,
  serial_number: engine.serial_number || "",
  model: engine.model || "",
  installation_date: toDateOnly(engine.installation_date),
  time_since_new: engine.time_since_new ?? "",
  service_life_limit: engine.service_life_limit ?? "",
  inspection_interval_unit: toIntervalUnit(engine.inspection_interval_unit),
  inspection_interval: engine.inspection_interval ?? "",
  maintenance_strategy: toMaintenanceStrategy(engine.maintenance_strategy),
});

const cloneComponent = (component: Component): Component => ({
  ...component,
  component_type_id: Number(component.component_type_id) || undefined,
  ata_chapter_id: Number(component.ata_chapter_id) || undefined,
  part_number: component.part_number || "",
  serial_number: component.serial_number || "",
  time_since_new: component.time_since_new ?? "",
  service_life_limit_hours: component.service_life_limit_hours ?? "",
  inspection_interval_unit: toIntervalUnit(component.inspection_interval_unit),
  inspection_interval: component.inspection_interval ?? "",
  maintenance_strategy: toMaintenanceStrategy(component.maintenance_strategy),
  installed_at: toDateOnly(component.installed_at),
  removed_at: toDateOnly(component.removed_at),
});

const cloneAvionic = (avionic: Avionics): Avionics => ({
  ...avionic,
  avionic_category_id: Number(avionic.avionic_category_id) || undefined,
  ata_chapter_id: Number(avionic.ata_chapter_id) || undefined,
  serial_number: avionic.serial_number || "",
  model: avionic.model || "",
  manufacturer: avionic.manufacturer || "",
  installed_at: toDateOnly(avionic.installed_at),
  time_since_new: avionic.time_since_new ?? "",
  service_life_limit: avionic.service_life_limit ?? "",
  inspection_interval_unit: toIntervalUnit(avionic.inspection_interval_unit),
  inspection_interval: avionic.inspection_interval ?? "",
  maintenance_strategy: toMaintenanceStrategy(avionic.maintenance_strategy),
  removed_at: toDateOnly(avionic.removed_at),
});

export const AssetDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: asset, isLoading } = useGetAssetByIdQuery(id || "");
  const { data: units = [] } = useGetUnitsQuery();
  const { data: assetTypes = [] } = useGetAssetTypesQuery();
  const { data: enginePositions = [] } = useGetEnginePositionsQuery();
  const { data: engineCategories = [] } = useGetEngineCategoriesQuery();
  const { data: ataChapters = [] } = useGetAtaChaptersQuery();
  const { data: componentTypes = [] } = useGetComponentTypesQuery();
  const { data: avionicCategories = [] } = useGetAvionicCategoriesQuery();
  const [activeTab, setActiveTab] = useState<AssetTabId>("info");
  const [programIntervalFilter, setProgramIntervalFilter] = useState<number | null>(null);
  const [programApplicabilityFilter, setProgramApplicabilityFilter] = useState<string | null>(null);

  // Clear selection when filters change so stale IDs don't carry over
  const handleIntervalFilterChange = (val: number | null) => {
    setProgramIntervalFilter(val);
    setSelectedProgramIds(new Set());
  };
  const handleApplicabilityFilterChange = (val: string | null) => {
    setProgramApplicabilityFilter(val);
    setSelectedProgramIds(new Set());
  };

  const programFilterParams = {
    ...(programIntervalFilter != null ? { interval_hours: programIntervalFilter } : {}),
    ...(programApplicabilityFilter ? { applicability: programApplicabilityFilter } : {}),
  };
  const { data: maintenancePrograms = [], isFetching: isLoadingPrograms } =
    useGetMaintenanceProgramsQuery(
      Object.keys(programFilterParams).length > 0 ? programFilterParams : undefined,
    );
  const [createWorkOrder] = useCreateWorkOrderMutation();
  const [updateWorkOrderTask, { isLoading: isUpdatingTaskStatus }] =
    useUpdateWorkOrderTaskMutation();
  const { data: assetWorkOrders = [] } = useGetWorkOrdersQuery(
    asset?.id ? { asset_id: asset.id } : undefined,
    { skip: !asset?.id || activeTab !== "maintenance" },
  );
  const { data: complianceRecords = [] } = useGetComplianceRecordsQuery(undefined, {
    skip: activeTab !== "maintenance",
  });
  const [deleteAsset, { isLoading: isDeleting }] = useDeleteAssetMutation();
  const [updateAsset, { isLoading: isUpdating }] = useUpdateAssetMutation();
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<number>>(new Set());
  // Ad-hoc task modal and handlers removed
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  // (removed duplicate ad-hoc modal state)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isEditingComponents, setIsEditingComponents] = useState(false);
  const [isEditingEngines, setIsEditingEngines] = useState(false);
  const [isEditingAvionics, setIsEditingAvionics] = useState(false);
  const [componentsDraft, setComponentsDraft] = useState<Component[]>([]);
  const [enginesDraft, setEnginesDraft] = useState<Engine[]>([]);
  const [avionicsDraft, setAvionicsDraft] = useState<Avionics[]>([]);

  useEffect(() => {
    if (!asset) return;
    setComponentsDraft((asset.components || []).map(cloneComponent));
    setEnginesDraft((asset.engines || []).map(cloneEngine));
    setAvionicsDraft((asset.avionics || []).map(cloneAvionic));
  }, [asset]);

  const inputClass =
    "w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]";

  const cancelComponentsEdit = () => {
    setComponentsDraft((asset?.components || []).map(cloneComponent));
    setIsEditingComponents(false);
  };

  const cancelEnginesEdit = () => {
    setEnginesDraft((asset?.engines || []).map(cloneEngine));
    setIsEditingEngines(false);
  };

  const cancelAvionicsEdit = () => {
    setAvionicsDraft((asset?.avionics || []).map(cloneAvionic));
    setIsEditingAvionics(false);
  };

  const handleSaveComponents = async () => {
    if (!asset?.id) return;

    const payload = componentsDraft
      .filter(
        (component) =>
          component.component_type_id ||
          component.part_number ||
          component.serial_number,
      )
      .map((component) => ({
        component_type_id: Number(component.component_type_id) || 0,
        ata_chapter_id: Number(component.ata_chapter_id) || 0,
        part_number: component.part_number || "",
        serial_number: component.serial_number || "",
        time_since_new: toNumber(component.time_since_new),
        service_life_limit_hours: toNumber(component.service_life_limit_hours),
        inspection_interval_unit: toIntervalUnit(component.inspection_interval_unit),
        inspection_interval: toNullableNumber(component.inspection_interval),
        maintenance_strategy: toMaintenanceStrategy(component.maintenance_strategy),
        installed_at: toDateOnly(component.installed_at),
        removed_at: toDateOnly(component.removed_at) || null,
      }))
      .filter((component) => component.component_type_id > 0);

    try {
      await updateAsset({ id: asset.id, data: { components: payload } }).unwrap();
      setIsEditingComponents(false);
      dispatch(showToast({ message: "Components updated", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update components", type: "error" }));
    }
  };

  const handleSaveEngines = async () => {
    if (!asset?.id) return;

    const defaultPositionId = enginePositions[0]?.id ?? 1;
    const defaultCategoryId = engineCategories[0]?.id ?? 1;
    const defaultAtaChapterId = ataChapters[0]?.id ?? 1;

    const payload = enginesDraft
      .filter((engine) => engine.serial_number || engine.model)
      .map((engine) => ({
        position_id: Number(engine.position_id) || defaultPositionId,
        category_id: Number(engine.category_id) || defaultCategoryId,
        ata_chapter_id: Number(engine.ata_chapter_id) || defaultAtaChapterId,
        serial_number: engine.serial_number || "",
        model: engine.model || "",
        installation_date: toDateOnly(engine.installation_date),
        time_since_new: toNumber(engine.time_since_new),
        service_life_limit: toNumber(engine.service_life_limit),
        inspection_interval_unit: toIntervalUnit(engine.inspection_interval_unit),
        inspection_interval: toNullableNumber(engine.inspection_interval),
        maintenance_strategy: toMaintenanceStrategy(engine.maintenance_strategy),
      }));

    try {
      await updateAsset({ id: asset.id, data: { engines: payload } }).unwrap();
      setIsEditingEngines(false);
      dispatch(showToast({ message: "Engines updated", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update engines", type: "error" }));
    }
  };

  const handleSaveAvionics = async () => {
    if (!asset?.id) return;

    const defaultAtaChapterId = ataChapters[0]?.id ?? 1;

    const payload = avionicsDraft
      .filter((avionic) => avionic.avionic_category_id || avionic.serial_number)
      .map((avionic) => ({
        avionic_category_id: Number(avionic.avionic_category_id) || 0,
        ata_chapter_id: Number(avionic.ata_chapter_id) || defaultAtaChapterId,
        serial_number: avionic.serial_number || "",
        model: avionic.model || "",
        manufacturer: avionic.manufacturer || null,
        time_since_new: toNumber(avionic.time_since_new),
        service_life_limit: toNumber(avionic.service_life_limit),
        inspection_interval_unit: toIntervalUnit(avionic.inspection_interval_unit),
        inspection_interval: toNullableNumber(avionic.inspection_interval),
        maintenance_strategy: toMaintenanceStrategy(avionic.maintenance_strategy),
        installed_at: toDateOnly(avionic.installed_at),
        removed_at: toDateOnly(avionic.removed_at) || null,
      }))
      .filter((avionic) => avionic.avionic_category_id > 0);

    try {
      await updateAsset({ id: asset.id, data: { avionics: payload } }).unwrap();
      setIsEditingAvionics(false);
      dispatch(showToast({ message: "Avionics updated", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update avionics", type: "error" }));
    }
  };

  const handleDeleteAsset = async () => {
    if (!asset?.id || isDeleting) return;

    const confirmed = window.confirm(
      `Delete ${asset.name}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteAsset(asset.id).unwrap();
      dispatch(
        showToast({
          message: "Asset deleted successfully",
          type: "success",
        }),
      );
      navigate("/dashboard/assets");
    } catch {
      dispatch(
        showToast({
          message: "Failed to delete asset",
          type: "error",
        }),
      );
    }
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current || !asset || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `${asset.name || "asset"}-${asset.id}`,
        backgroundColor: "#00090D",
      });
      dispatch(showToast({ message: "PDF downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

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

  const assetImageUrl = asset.image_url || asset.image || "";
  const unitName = units.find((unit) => unit.id === asset.unit_id)?.name ?? "-";
  const assetTypeName =
    assetTypes.find((type) => type.id === asset.asset_type_id)?.name ?? "-";
  const enginePositionMap = new Map(
    enginePositions.map((position) => [position.id, position.name]),
  );
  const engineCategoryMap = new Map(
    engineCategories.map((category) => [category.id, category.name]),
  );
  const ataChapterMap = new Map(
    ataChapters.map((chapter) => [
      chapter.id,
      chapter.chapter_number || chapter.name || `ATA ${chapter.id}`,
    ]),
  );
  const componentTypeMap = new Map(
    componentTypes.map((type) => [type.id, type.name]),
  );
  const avionicCategoryMap = new Map(
    avionicCategories.map((category) => [category.id, category.name]),
  );
  const configuration = parseConfiguration(asset.configuration);
  const latestOperation = asset.operations[0] ?? null;
  const nextHoursInspection = formatDifference(
    asset.inspection_interval,
    asset.last_inspection_hours,
    "hrs",
  );
  const nextCycleInspection = formatDifference(
    asset.inspection_interval_cycle,
    asset.last_inspection_cycles,
    "cyc",
  );
  const defects = asset.defects ?? [];
  const maintenanceEvents = asset.maintenance_events ?? [];
  const assetTaskIds = new Set(
    assetWorkOrders.flatMap((order) => (order.tasks || []).map((task) => task.id)),
  );
  const assetComplianceRecords = complianceRecords
    .filter(
      (record) =>
        record.work_order_task_id != null && assetTaskIds.has(record.work_order_task_id),
    )
    .sort((a, b) => {
      const dateA = a.completion_date ? new Date(a.completion_date).getTime() : 0;
      const dateB = b.completion_date ? new Date(b.completion_date).getTime() : 0;
      return dateB - dateA;
    });

  const dueTrackingRows = [
    ...asset.engines.map((engine, index) => {
      const current = toNumeric(engine.time_since_new);
      const lastInspection = toNumeric(engine.last_inspection) ?? 0;
      const interval = toNumeric(engine.inspection_interval);
      const unit = String(engine.inspection_interval_unit || "hours").toLowerCase();
      const elapsedSinceInspection =
        current === null ? null : Math.max(current - lastInspection, 0);
      const dueHours =
        unit === "hours" && interval !== null && elapsedSinceInspection !== null
          ? interval - elapsedSinceInspection
          : null;

      return {
        key: `engine-${engine.id ?? index}`,
        category: "Engine",
        name: engine.serial_number || engine.model || `Engine ${index + 1}`,
        current,
        lastInspection: toNumeric(engine.last_inspection),
        interval,
        intervalUnit: unit,
        dueHours,
      };
    }),
    ...asset.components.map((component, index) => {
      const current = toNumeric(component.time_since_new);
      const lastInspection = toNumeric(component.last_inspection) ?? 0;
      const interval = toNumeric(component.inspection_interval);
      const unit = String(component.inspection_interval_unit || "hours").toLowerCase();
      const elapsedSinceInspection =
        current === null ? null : Math.max(current - lastInspection, 0);
      const dueHours =
        unit === "hours" && interval !== null && elapsedSinceInspection !== null
          ? interval - elapsedSinceInspection
          : null;

      return {
        key: `component-${component.id ?? index}`,
        category: "Component",
        name:
          component.part_number ||
          component.serial_number ||
          `Component ${index + 1}`,
        current,
        lastInspection: toNumeric(component.last_inspection),
        interval,
        intervalUnit: unit,
        dueHours,
      };
    }),
    ...asset.avionics.map((avionic, index) => {
      const current = toNumeric(avionic.time_since_new);
      const lastInspection = toNumeric(avionic.last_inspection) ?? 0;
      const interval = toNumeric(avionic.inspection_interval);
      const unit = String(avionic.inspection_interval_unit || "hours").toLowerCase();
      const elapsedSinceInspection =
        current === null ? null : Math.max(current - lastInspection, 0);
      const dueHours =
        unit === "hours" && interval !== null && elapsedSinceInspection !== null
          ? interval - elapsedSinceInspection
          : null;

      return {
        key: `avionic-${avionic.id ?? index}`,
        category: "Avionics",
        name: avionic.serial_number || avionic.model || `Avionics ${index + 1}`,
        current,
        lastInspection: toNumeric(avionic.last_inspection),
        interval,
        intervalUnit: unit,
        dueHours,
      };
    }),
  ];

  const handleToggleProgramSelection = (id: number) => {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPrograms = () => {
    setSelectedProgramIds(new Set(maintenancePrograms.map((p) => p.id)));
  };

  const handleDeselectAllPrograms = () => {
    setSelectedProgramIds(new Set());
  };

  const handleCreateWorkOrder = async () => {
    if (!asset?.id || selectedProgramIds.size === 0) return;

    try {
      setIsCreatingWorkOrder(true);
      const programIds = Array.from(selectedProgramIds);
      const title = `${asset.name || "Asset"} - Work Order`;

      // Build program applicabilities based on maintenance program types
      const programApplicabilities = maintenancePrograms
        .filter((prog) => programIds.includes(prog.id))
        .map((prog) => {
          const applicability: any = { program_id: prog.id };

          if (prog.applicability === "component") {
            applicability.component_ids = asset.components?.map((c) => c.id) || [];
          } else if (prog.applicability === "engine") {
            applicability.engine_ids = asset.engines?.map((e) => e.id) || [];
          } else if (prog.applicability === "avionics") {
            applicability.avionics_ids = asset.avionics?.map((a) => a.id) || [];
          }

          return applicability;
        });

      await createWorkOrder({
        asset_id: asset.id,
        title,
        program_applicabilities: programApplicabilities,
      }).unwrap();

      dispatch(
        showToast({
          message: `Work order created with ${programIds.length} task${programIds.length > 1 ? "s" : ""} linked to asset items`,
          type: "success",
        }),
      );
      setSelectedProgramIds(new Set());
    } catch {
      dispatch(
        showToast({
          message: "Failed to create work order",
          type: "error",
        }),
      );
    } finally {
      setIsCreatingWorkOrder(false);
    }
  };

  const handleMarkTaskCompleted = async (taskId: number) => {
    try {
      await updateWorkOrderTask({ id: taskId, status: "completed" }).unwrap();
      dispatch(
        showToast({
          message: "Work order task marked as completed. Compliance history record created.",
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({
          message: "Failed to mark task as completed",
          type: "error",
        }),
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#00090D] text-white p-6 pb-20">
      {/* Ad-hoc Task Modal removed */}
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
          <button
            onClick={handleDeleteAsset}
            disabled={isDeleting}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-red-400 transition-colors disabled:opacity-60"
          >
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors">
            <Icon icon="mdi:refresh" className="w-4 h-4" />
            <span>Update status</span>
          </button>
          <button
            onClick={() => navigate("/dashboard/operations/add")}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:clock-outline" className="w-4 h-4" />
            <span>Add Operations</span>
          </button>
          <button
            onClick={() =>
              navigate(`/dashboard/assets/${asset.id}/defects/add`)
            }
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:alert-circle-outline" className="w-4 h-4" />
            <span>Report Defect</span>
          </button>
          <button
            onClick={() => navigate(`/dashboard/assets/${asset.id}/edit`)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors"
          >
            <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            aria-label="Download asset details"
            title="Download asset details"
            className="flex items-center space-x-2 px-3 py-1.5 bg-[#001825] border border-[#0A4D66]/40 rounded hover:bg-[#0A4D66]/20 text-xs text-[#7FD5FF] transition-colors disabled:opacity-60"
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
              className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
            />
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
      <div ref={contentRef} className="space-y-6">
        {activeTab === "info" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 flex items-center justify-center min-h-50 overflow-hidden">
                {assetImageUrl ? (
                  <img
                    src={assetImageUrl}
                    alt={asset.name}
                    className="w-full h-full max-h-60 object-contain"
                  />
                ) : (
                  <Icon
                    icon="mdi:helicopter"
                    className="w-32 h-32 text-gray-600"
                  />
                )}
              </div>

              <div className="col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="TOTAL AIRFRAME HRS"
                  value={`${asset.total_airframe_hours} hrs`}
                />
                <StatCard
                  label="TOTAL CYCLES"
                  value={formatCycles(asset.total_cycles)}
                />
                <StatCard
                  label="HRS TO NEXT INSP"
                  value={nextHoursInspection}
                />
                <StatCard
                  label="CYC TO NEXT INSP"
                  value={nextCycleInspection}
                />
                <StatCard
                  label="NEXT ANNUAL INSP"
                  value={formatDate(asset.next_annual_inspection_date)}
                />
                <StatCard
                  label="DISCREPANCIES"
                  value={String(defects.length)}
                />
                <StatCard
                  label="NO. OF OPERATIONS"
                  value={String(
                    asset.operations_count ?? asset.operations.length,
                  )}
                />
                <StatCard
                  label="LAST OPERATION"
                  value={latestOperation?.name ?? "-"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Aircraft Identification
                </h3>
                <div className="space-y-4">
                  <DetailRow label="Aircraft Type" value={assetTypeName} />
                  <DetailRow label="Aircraft Name" value={asset.name} />
                  <DetailRow label="Model" value={asset.model || "-"} />
                  <DetailRow label="Tail No" value={asset.tail_number} />
                  <DetailRow
                    label="Serial Number (Airframe SN)"
                    value={asset.serial_number}
                  />
                  <DetailRow label="Assigned Unit" value={unitName} />
                  <DetailRow label="Role" value={configuration.role} />
                  <DetailRow label="Seats" value={configuration.seats} />
                  <DetailRow
                    label="Serviceability Status"
                    value={
                      <StatusPill
                        label={formatStatus(asset.serviceability_status)}
                        tone={
                          asset.serviceability_status === "serviceable"
                            ? "success"
                            : asset.serviceability_status ===
                                "under_maintenance"
                              ? "warning"
                              : "danger"
                        }
                      />
                    }
                  />
                  <DetailRow
                    label="Operation Status"
                    value={formatStatus(asset.operation_status)}
                  />
                  <DetailRow
                    label="Manufacturer"
                    value={asset.manufacturer || "-"}
                  />
                  <DetailRow
                    label="Purchase Date"
                    value={formatDate(asset.purchase_date)}
                  />
                  <DetailRow
                    label="Created At"
                    value={formatDateTime(asset.created_at)}
                  />
                  <DetailRow
                    label="Updated At"
                    value={formatDateTime(asset.updated_at)}
                  />
                </div>
              </div>

              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Documents
                </h3>
                {asset.documents.length === 0 ? (
                  <EmptyState message="No documents found." />
                ) : (
                  <div className="space-y-4">
                    {asset.documents.map((document) => (
                      <div
                        key={document.id ?? document.file}
                        className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-white">
                              {document.document_type?.name ?? "Document"}
                            </div>
                            <div className="text-xs text-gray-400">
                              Issued: {formatDate(document.issue_date)}
                            </div>
                            <div className="text-xs text-gray-400">
                              Expires: {formatDate(document.expiry_date)}
                            </div>
                          </div>
                          <a
                            href={document.file}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                          >
                            <Icon icon="mdi:open-in-new" className="w-4 h-4" />
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "airframe" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Hours Tracking
                </h3>
                <div className="space-y-4">
                  <DetailRow
                    label="Total Flight Hrs"
                    value={formatHours(asset.total_airframe_hours)}
                  />
                  <DetailRow
                    label="Service Life Limit hrs"
                    value={formatHours(asset.service_life_limit)}
                  />
                  <DetailRow
                    label="Life Remaining"
                    value={formatDifference(
                      asset.service_life_limit,
                      asset.total_airframe_hours,
                      "hrs",
                    )}
                  />
                  <DetailRow
                    label="Last Inspection hrs"
                    value={formatHours(asset.last_inspection_hours)}
                  />
                  <DetailRow
                    label="Inspection Interval"
                    value={formatHours(asset.inspection_interval)}
                  />
                  <DetailRow
                    label="Next Inspection Due"
                    value={nextHoursInspection}
                  />
                </div>
              </div>

              <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-6">
                  Cycles & Inspections
                </h3>
                <div className="space-y-4">
                  <DetailRow
                    label="Total Cycles"
                    value={formatCycles(asset.total_cycles)}
                  />
                  <DetailRow
                    label="Cycle Limit"
                    value={formatCycles(asset.cycle_limit)}
                  />
                  <DetailRow
                    label="Cycles Remaining"
                    value={formatDifference(
                      asset.cycle_limit,
                      asset.total_cycles,
                      "cyc",
                    )}
                  />
                  <DetailRow
                    label="Last Inspection Cycles"
                    value={formatCycles(asset.last_inspection_cycles)}
                  />
                  <DetailRow
                    label="Inspection Interval (Cycles)"
                    value={formatCycles(asset.inspection_interval_cycle)}
                  />
                  <DetailRow
                    label="Next Cycle Inspection Due"
                    value={nextCycleInspection}
                  />
                  <DetailRow
                    label="Last Major Inspection Date"
                    value={formatDate(asset.last_inspection_date)}
                  />
                  <DetailRow
                    label="Next Type of Inspection"
                    value={asset.next_type_of_inspection || "-"}
                  />
                  <DetailRow
                    label="Next Annual Inspection"
                    value={formatDate(asset.next_annual_inspection_date)}
                  />
                  <DetailRow
                    label="Landings"
                    value={formatNumber(asset.landings)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Airframe Components
                </h3>
                <div className="flex items-center gap-2">
                  {isEditingComponents ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setComponentsDraft((prev) => [
                            ...prev,
                            {
                              component_type_id: componentTypes[0]?.id,
                              ata_chapter_id: ataChapters[0]?.id,
                              part_number: "",
                              serial_number: "",
                              time_since_new: "",
                              service_life_limit_hours: "",
                              inspection_interval_unit: "hours",
                              inspection_interval: "",
                              maintenance_strategy: "hard-time",
                              installed_at: "",
                              removed_at: "",
                            },
                          ])
                        }
                        className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                      >
                        Add Component
                      </button>
                      <button
                        type="button"
                        onClick={cancelComponentsEdit}
                        className="rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#0A4D66]/20 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveComponents}
                        disabled={isUpdating}
                        className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60"
                      >
                        {isUpdating ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingComponents(true)}
                      className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                    >
                      Edit Components
                    </button>
                  )}
                </div>
              </div>
              {componentsDraft.length === 0 ? (
                <EmptyState message="No airframe components found." />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {componentsDraft.map((component, index) => (
                    <div
                      key={component.id ?? `${component.part_number}-${index}`}
                      className="rounded-xl border border-[#0A4D66]/30 bg-[#001825] p-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div className="text-sm font-bold text-[#7FD5FF] uppercase">
                          {componentTypeMap.get(
                            component.component_type_id ?? 0,
                          ) ?? `Component ${index + 1}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          Installed {formatDate(component.installed_at)}
                        </div>
                      </div>
                      {isEditingComponents ? (
                        <div className="space-y-3">
                          <select
                            title="Component type"
                            value={component.component_type_id || ""}
                            onChange={(e) =>
                              setComponentsDraft((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        component_type_id:
                                          Number(e.target.value) || undefined,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className={inputClass}
                          >
                            <option value="">Select component type</option>
                            {componentTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                          <input
                            className={inputClass}
                            placeholder="Part number"
                            value={component.part_number || ""}
                            onChange={(e) =>
                              setComponentsDraft((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, part_number: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <input
                            className={inputClass}
                            placeholder="Serial number"
                            value={component.serial_number || ""}
                            onChange={(e) =>
                              setComponentsDraft((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, serial_number: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              className={inputClass}
                              placeholder="Time since new"
                              value={String(component.time_since_new || "")}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? { ...item, time_since_new: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <input
                              type="number"
                              className={inputClass}
                              placeholder="Life limit"
                              value={String(
                                component.service_life_limit_hours || "",
                              )}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          service_life_limit_hours:
                                            e.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              title="ATA chapter"
                              className={inputClass}
                              value={component.ata_chapter_id || ""}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          ata_chapter_id:
                                            Number(e.target.value) || undefined,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="">Select ATA chapter</option>
                              {ataChapters
                                .filter((chapter) =>
                                  (chapter.description || "").toLowerCase().includes("component")
                                )
                                .map((chapter) => (
                                  <option key={chapter.id} value={chapter.id}>
                                    {chapter.chapter_number ||
                                      chapter.name ||
                                      `ATA ${chapter.id}`}
                                  </option>
                                ))}
                            </select>
                            <select
                              title="Inspection interval unit"
                              className={inputClass}
                              value={component.inspection_interval_unit || "hours"}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          inspection_interval_unit:
                                            toIntervalUnit(e.target.value),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="hours">Hours</option>
                              <option value="months">Months</option>
                              <option value="cycle">Cycle</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              className={inputClass}
                              placeholder="Inspection interval"
                              value={String(component.inspection_interval || "")}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          inspection_interval: e.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <select
                              title="Maintenance strategy"
                              className={inputClass}
                              value={component.maintenance_strategy || "hard-time"}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          maintenance_strategy:
                                            toMaintenanceStrategy(
                                              e.target.value,
                                            ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="hard-time">Hard Time</option>
                              <option value="on-condition">On Condition</option>
                              <option value="condition">Condition</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="date"
                              title="Installed date"
                              className={inputClass}
                              value={toDateOnly(component.installed_at)}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? { ...item, installed_at: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <input
                              type="date"
                              title="Removed date"
                              className={inputClass}
                              value={toDateOnly(component.removed_at)}
                              onChange={(e) =>
                                setComponentsDraft((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? { ...item, removed_at: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setComponentsDraft((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors"
                          >
                            Remove Component
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <DetailRow
                            label="Part Number"
                            value={component.part_number || "-"}
                          />
                          <DetailRow
                            label="Serial Number"
                            value={component.serial_number || "-"}
                          />
                          <DetailRow
                            label="Total Service Hours"
                            value={formatHours(component.time_since_new)}
                          />
                          <DetailRow
                            label="Service Life Limit"
                            value={formatHours(
                              component.service_life_limit_hours,
                            )}
                          />
                          <DetailRow
                            label="ATA Chapter"
                            value={
                              ataChapterMap.get(component.ata_chapter_id ?? 0) ??
                              "-"
                            }
                          />
                          <DetailRow
                            label="Inspection Interval"
                            value={formatInspectionInterval(
                              component.inspection_interval,
                              component.inspection_interval_unit,
                            )}
                          />
                          <DetailRow
                            label="Inspection Interval Unit"
                            value={formatStatus(component.inspection_interval_unit)}
                          />
                          <DetailRow
                            label="Maintenance Strategy"
                            value={formatStatus(component.maintenance_strategy)}
                          />
                          <DetailRow
                            label="Removed At"
                            value={formatDate(component.removed_at)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "engines" && (
          <div className="space-y-6">
            <div className="flex items-center justify-end gap-2">
              {isEditingEngines ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setEnginesDraft((prev) => [
                        ...prev,
                        {
                          position_id: enginePositions[0]?.id ?? 1,
                          category_id: engineCategories[0]?.id,
                          ata_chapter_id: ataChapters[0]?.id,
                          serial_number: "",
                          model: "",
                          installation_date: "",
                          time_since_new: "",
                          service_life_limit: "",
                          inspection_interval_unit: "hours",
                          inspection_interval: "",
                          maintenance_strategy: "hard-time",
                        },
                      ])
                    }
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Add Engine
                  </button>
                  <button
                    type="button"
                    onClick={cancelEnginesEdit}
                    className="rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEngines}
                    disabled={isUpdating}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60"
                  >
                    {isUpdating ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingEngines(true)}
                  className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                >
                  Edit Engines
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {enginesDraft.map((engine, index) => (
              <div
                key={index}
                className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                    ENGINE {index + 1}
                  </h3>
                  <span className="text-xs text-[#7FD5FF]">
                    {enginePositionMap.get(engine.position_id) ??
                      "Position Unassigned"}
                  </span>
                </div>
                {isEditingEngines ? (
                  <div className="space-y-3">
                    <select
                      title="Engine position"
                      className={inputClass}
                      value={engine.position_id || ""}
                      onChange={(e) =>
                        setEnginesDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, position_id: Number(e.target.value) || 1 }
                              : item,
                          ),
                        )
                      }
                    >
                      {enginePositions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                    </select>
                    <select
                      title="Engine category"
                      className={inputClass}
                      value={engine.category_id || ""}
                      onChange={(e) =>
                        setEnginesDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  category_id: Number(e.target.value) || undefined,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">Select category</option>
                      {engineCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <select
                      title="Engine ATA chapter"
                      className={inputClass}
                      value={engine.ata_chapter_id || ""}
                      onChange={(e) =>
                        setEnginesDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  ata_chapter_id:
                                    Number(e.target.value) || undefined,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">Select ATA chapter</option>
                      {ataChapters
                        .filter((chapter) =>
                          (chapter.description || "").toLowerCase().includes("engine")
                        )
                        .map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.chapter_number ||
                              chapter.name ||
                              `ATA ${chapter.id}`}
                          </option>
                        ))}
                    </select>
                    <input
                      className={inputClass}
                      placeholder="Serial number"
                      value={engine.serial_number || ""}
                      onChange={(e) =>
                        setEnginesDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, serial_number: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Model"
                      value={engine.model || ""}
                      onChange={(e) =>
                        setEnginesDraft((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, model: e.target.value } : item,
                          ),
                        )
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        title="Engine installation date"
                        className={inputClass}
                        value={toDateOnly(engine.installation_date)}
                        onChange={(e) =>
                          setEnginesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, installation_date: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        className={inputClass}
                        placeholder="Time since new"
                        value={String(engine.time_since_new || "")}
                        onChange={(e) =>
                          setEnginesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, time_since_new: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        className={inputClass}
                        placeholder="Service life limit"
                        value={String(engine.service_life_limit || "")}
                        onChange={(e) =>
                          setEnginesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, service_life_limit: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        className={inputClass}
                        placeholder="Inspection interval"
                        value={String(engine.inspection_interval || "")}
                        onChange={(e) =>
                          setEnginesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, inspection_interval: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        title="Engine inspection interval unit"
                        className={inputClass}
                        value={engine.inspection_interval_unit || "hours"}
                        onChange={(e) =>
                          setEnginesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    inspection_interval_unit: toIntervalUnit(
                                      e.target.value,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="hours">Hours</option>
                        <option value="months">Months</option>
                        <option value="cycle">Cycle</option>
                      </select>
                      <select
                        title="Engine maintenance strategy"
                        className={inputClass}
                        value={engine.maintenance_strategy || "hard-time"}
                        onChange={(e) =>
                          setEnginesDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    maintenance_strategy: toMaintenanceStrategy(
                                      e.target.value,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="hard-time">Hard Time</option>
                        <option value="on-condition">On Condition</option>
                        <option value="condition">Condition</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEnginesDraft((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      Remove Engine
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <DetailRow
                      label="Category"
                      value={engineCategoryMap.get(engine.category_id ?? 0) ?? "-"}
                    />
                    <DetailRow
                      label="ATA Chapter"
                      value={ataChapterMap.get(engine.ata_chapter_id ?? 0) ?? "-"}
                    />
                    <DetailRow
                      label="Serial Number"
                      value={engine.serial_number}
                    />
                    <DetailRow label="Model" value={engine.model} />
                    <DetailRow
                      label="Installation Date"
                      value={formatDate(engine.installation_date)}
                    />
                    <DetailRow
                      label="Position"
                      value={enginePositionMap.get(engine.position_id) ?? "-"}
                    />
                    <DetailRow
                      label="Total Service Hours"
                      value={formatHours(engine.time_since_new)}
                    />
                    <DetailRow
                      label="Service Life Limit"
                      value={formatHours(engine.service_life_limit)}
                    />
                    <DetailRow
                      label="Inspection Interval Unit"
                      value={formatStatus(engine.inspection_interval_unit)}
                    />
                    <DetailRow
                      label="Inspection Interval"
                      value={formatInspectionInterval(
                        engine.inspection_interval,
                        engine.inspection_interval_unit,
                      )}
                    />
                    <DetailRow
                      label="Maintenance Strategy"
                      value={formatStatus(engine.maintenance_strategy)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          </div>
        )}

        {activeTab === "avionics" && (
          <div className="space-y-6">
            <div className="flex items-center justify-end gap-2">
              {isEditingAvionics ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setAvionicsDraft((prev) => [
                        ...prev,
                        {
                          avionic_category_id: avionicCategories[0]?.id,
                          ata_chapter_id: ataChapters[0]?.id,
                          serial_number: "",
                          model: "",
                          manufacturer: "",
                          installed_at: "",
                          time_since_new: "",
                          service_life_limit: "",
                          inspection_interval_unit: "hours",
                          inspection_interval: "",
                          maintenance_strategy: "hard-time",
                          removed_at: "",
                        },
                      ])
                    }
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Add Avionics
                  </button>
                  <button
                    type="button"
                    onClick={cancelAvionicsEdit}
                    className="rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#0A4D66]/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAvionics}
                    disabled={isUpdating}
                    className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60"
                  >
                    {isUpdating ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingAvionics(true)}
                  className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors"
                >
                  Edit Avionics
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {avionicsDraft.map((avionic, index) => (
              <div
                key={index}
                className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                    AVIONICS {index + 1}
                  </h3>
                </div>
                {isEditingAvionics ? (
                  <div className="space-y-3">
                    <select
                      title="Avionics category"
                      className={inputClass}
                      value={avionic.avionic_category_id || ""}
                      onChange={(e) =>
                        setAvionicsDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  avionic_category_id:
                                    Number(e.target.value) || undefined,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">Select avionic category</option>
                      {avionicCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <select
                      title="Avionics ATA chapter"
                      className={inputClass}
                      value={avionic.ata_chapter_id || ""}
                      onChange={(e) =>
                        setAvionicsDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  ata_chapter_id:
                                    Number(e.target.value) || undefined,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">Select ATA chapter</option>
                      {ataChapters
                        .filter((chapter) =>
                          (chapter.description || "").toLowerCase().includes("avionics")
                        )
                        .map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.chapter_number ||
                              chapter.name ||
                              `ATA ${chapter.id}`}
                          </option>
                        ))}
                    </select>
                    <input
                      className={inputClass}
                      placeholder="Serial number"
                      value={avionic.serial_number || ""}
                      onChange={(e) =>
                        setAvionicsDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, serial_number: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Model"
                      value={avionic.model || ""}
                      onChange={(e) =>
                        setAvionicsDraft((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, model: e.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Manufacturer"
                      value={avionic.manufacturer || ""}
                      onChange={(e) =>
                        setAvionicsDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, manufacturer: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        title="Avionics installed date"
                        className={inputClass}
                        value={toDateOnly(avionic.installed_at)}
                        onChange={(e) =>
                          setAvionicsDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, installed_at: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="date"
                        title="Avionics removed date"
                        className={inputClass}
                        value={toDateOnly(avionic.removed_at)}
                        onChange={(e) =>
                          setAvionicsDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, removed_at: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        className={inputClass}
                        placeholder="Time since new"
                        value={String(avionic.time_since_new || "")}
                        onChange={(e) =>
                          setAvionicsDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, time_since_new: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        className={inputClass}
                        placeholder="Life limit"
                        value={String(avionic.service_life_limit || "")}
                        onChange={(e) =>
                          setAvionicsDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, service_life_limit: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        title="Avionics inspection interval unit"
                        className={inputClass}
                        value={avionic.inspection_interval_unit || "hours"}
                        onChange={(e) =>
                          setAvionicsDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    inspection_interval_unit: toIntervalUnit(
                                      e.target.value,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="hours">Hours</option>
                        <option value="months">Months</option>
                        <option value="cycle">Cycle</option>
                      </select>
                      <input
                        type="number"
                        className={inputClass}
                        placeholder="Inspection interval"
                        value={String(avionic.inspection_interval || "")}
                        onChange={(e) =>
                          setAvionicsDraft((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, inspection_interval: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <select
                      title="Avionics maintenance strategy"
                      className={inputClass}
                      value={avionic.maintenance_strategy || "hard-time"}
                      onChange={(e) =>
                        setAvionicsDraft((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  maintenance_strategy: toMaintenanceStrategy(
                                    e.target.value,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="hard-time">Hard Time</option>
                      <option value="on-condition">On Condition</option>
                      <option value="condition">Condition</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setAvionicsDraft((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                      className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      Remove Avionics
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <DetailRow
                      label="Avionic Category"
                      value={
                        avionicCategoryMap.get(
                          avionic.avionic_category_id ?? 0,
                        ) ?? "-"
                      }
                    />
                    <DetailRow
                      label="Serial Number"
                      value={avionic.serial_number}
                    />
                    <DetailRow label="Model" value={avionic.model || "-"} />
                    <DetailRow
                      label="Installation Date"
                      value={formatDate(avionic.installed_at)}
                    />
                    <DetailRow
                      label="ATA Chapter"
                      value={ataChapterMap.get(avionic.ata_chapter_id ?? 0) ?? "-"}
                    />
                    <DetailRow
                      label="Manufacturer"
                      value={avionic.manufacturer || "-"}
                    />
                    <DetailRow
                      label="Total Service Hours"
                      value={formatHours(avionic.time_since_new)}
                    />
                    <DetailRow
                      label="Service Life Limit"
                      value={formatHours(avionic.service_life_limit)}
                    />
                    <DetailRow
                      label="Inspection Interval Unit"
                      value={formatStatus(avionic.inspection_interval_unit)}
                    />
                    <DetailRow
                      label="Inspection Interval"
                      value={formatInspectionInterval(
                        avionic.inspection_interval,
                        avionic.inspection_interval_unit,
                      )}
                    />
                    <DetailRow
                      label="Maintenance Strategy"
                      value={formatStatus(avionic.maintenance_strategy)}
                    />
                    <DetailRow
                      label="Removed At"
                      value={formatDate(avionic.removed_at)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          </div>
        )}

        {activeTab === "discrepancies" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {defects.length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState message="No discrepancies found." />
              </div>
            ) : (
              defects.map((defect, index) => (
                <div
                  key={defect.id ?? index}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                      Discrepancy {index + 1}
                    </h3>
                    <StatusPill
                      label={formatStatus(defect.status)}
                      tone={
                        defect.status === "resolved"
                          ? "success"
                          : defect.status === "in_progress"
                            ? "warning"
                            : "danger"
                      }
                    />
                  </div>
                  <div className="space-y-4">
                    <DetailRow label="Title" value={defect.title || "-"} />
                    <DetailRow
                      label="Description"
                      value={defect.description || "-"}
                    />
                    <DetailRow
                      label="Severity"
                      value={formatStatus(defect.severity)}
                    />
                    <DetailRow
                      label="Reported At"
                      value={formatDate(defect.reported_at)}
                    />
                    <DetailRow
                      label="Resolved At"
                      value={formatDate(defect.resolved_at)}
                    />
                    <DetailRow label="Remarks" value={defect.remarks || "-"} />
                    <DetailRow
                      label="Operation ID"
                      value={
                        defect.operation_id ? String(defect.operation_id) : "-"
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "operations" && (
          <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-200">
                <thead className="bg-[#021a27] text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Purpose</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Start</th>
                    <th className="text-left px-4 py-3 font-medium">End</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {asset.operations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-6 text-center text-gray-400 border-t border-[#0A4D66]/40"
                      >
                        No operations found.
                      </td>
                    </tr>
                  ) : (
                    asset.operations.map((op, index) => (
                      <tr
                        key={index}
                        onClick={() =>
                          navigate(`/dashboard/operations/${op.id}`)
                        }
                        className={cn(
                          "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors",
                          index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                        )}
                      >
                        <td className="px-6 py-3 font-medium text-white">
                          {op.description || op.name}
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {op.operation_type?.name ?? op.name}
                        </td>
                        <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                          {formatDateTime(op.start_date_time)}
                        </td>
                        <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                          {formatDateTime(op.end_date_time)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full",
                                statusDotColor[op.status] || "bg-gray-400",
                              )}
                            />
                            <span className="capitalize">{op.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {op.duration_label}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className="space-y-4">
            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Work Order Items Status
              </h3>

              {assetWorkOrders.length === 0 ? (
                <EmptyState message="No work order items found for this asset." />
              ) : (
                <div className="space-y-3">
                  {assetWorkOrders.flatMap((order) =>
                    (order.tasks || []).map((task) => {
                      const isCompleted = task.status === "completed";

                      return (
                        <div
                          key={`${order.id}-${task.id}`}
                          className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {task.program?.name || task.description || `Task #${task.id}`}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Work Order #{order.id} | Task #{task.id} | Type: {formatStatus(task.task_type)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusPill
                                label={isCompleted ? "Completed" : "Pending"}
                                tone={isCompleted ? "success" : "warning"}
                              />
                              {!isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkTaskCompleted(task.id)}
                                  disabled={isUpdatingTaskStatus}
                                  className="rounded border border-emerald-400 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/20 transition-colors disabled:opacity-60"
                                >
                                  {isUpdatingTaskStatus ? "Updating..." : "Mark Completed"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              )}
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Compliance History
              </h3>

              {assetComplianceRecords.length === 0 ? (
                <EmptyState message="No compliance history records yet for this asset's work order items." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-gray-200">
                    <thead className="bg-[#021a27] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Task</th>
                        <th className="text-left px-4 py-3 font-medium">Completed On</th>
                        <th className="text-left px-4 py-3 font-medium">Next Due Date</th>
                        <th className="text-left px-4 py-3 font-medium">Next Due Hours</th>
                        <th className="text-left px-4 py-3 font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetComplianceRecords.map((record, index) => (
                        <tr
                          key={record.id}
                          className={cn(
                            "border-t border-[#0A4D66]/40",
                            index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-4 py-3">
                            {record.work_order_task_id ? `Task #${record.work_order_task_id}` : "-"}
                          </td>
                          <td className="px-4 py-3">{formatDateTime(record.completion_date)}</td>
                          <td className="px-4 py-3">{formatDate(record.next_due_date)}</td>
                          <td className="px-4 py-3">{formatHours(record.next_due_hours)}</td>
                          <td className="px-4 py-3">{record.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
                  Create Work Orders From Maintenance Programs
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {isLoadingPrograms ? (
                    <span className="text-xs text-gray-400">Loading...</span>
                  ) : null}
                  {/* Interval Hours filter */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Interval:</span>
                    {[null, 10, 50, 100, 150, 200].map((val) => (
                      <button
                        key={val ?? "all"}
                        type="button"
                        onClick={() => handleIntervalFilterChange(val)}
                        className={cn(
                          "rounded px-2 py-1 text-xs transition-colors border",
                          programIntervalFilter === val
                            ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                            : "border-[#0A4D66]/40 text-gray-400 hover:border-[#7FD5FF]/40 hover:text-gray-200",
                        )}
                      >
                        {val == null ? "All" : `${val} hrs`}
                      </button>
                    ))}
                  </div>
                  {/* Applicability filter */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Type:</span>
                    {[null, "component", "engine", "avionics"].map((val) => (
                      <button
                        key={val ?? "all"}
                        type="button"
                        onClick={() => handleApplicabilityFilterChange(val)}
                        className={cn(
                          "rounded px-2 py-1 text-xs transition-colors border capitalize",
                          programApplicabilityFilter === val
                            ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                            : "border-[#0A4D66]/40 text-gray-400 hover:border-[#7FD5FF]/40 hover:text-gray-200",
                        )}
                      >
                        {val == null ? "All" : val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Searchable Maintenance Programs List */}
              <AssetMaintenanceProgramsSearchable
                maintenancePrograms={maintenancePrograms}
                selectedProgramIds={selectedProgramIds}
                handleToggleProgramSelection={handleToggleProgramSelection}
                handleSelectAllPrograms={handleSelectAllPrograms}
                handleDeselectAllPrograms={handleDeselectAllPrograms}
                handleCreateWorkOrder={handleCreateWorkOrder}
                isCreatingWorkOrder={isCreatingWorkOrder}
                navigate={navigate}
              />
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
              <h3 className="text-[#7FD5FF] text-sm font-bold uppercase mb-4">
                Asset Equipment Due Hours
              </h3>

              {dueTrackingRows.length === 0 ? (
                <EmptyState message="No engines, components, or avionics found for this asset." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-gray-200">
                    <thead className="bg-[#021a27] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Category</th>
                        <th className="text-left px-4 py-3 font-medium">Item</th>
                        <th className="text-left px-4 py-3 font-medium">Current Hrs</th>
                        <th className="text-left px-4 py-3 font-medium">Last Inspection</th>
                        <th className="text-left px-4 py-3 font-medium">Interval</th>
                        <th className="text-left px-4 py-3 font-medium">Due Hours</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueTrackingRows.map((row, index) => {
                        const status =
                          row.dueHours === null
                            ? "Not hours-based"
                            : row.dueHours <= 0
                              ? "Overdue"
                              : "Due";

                        return (
                          <tr
                            key={row.key}
                            className={cn(
                              "border-t border-[#0A4D66]/40",
                              index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                            )}
                          >
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3 text-white font-medium">{row.name}</td>
                            <td className="px-4 py-3">
                              {row.current === null ? "-" : `${row.current.toLocaleString()} hrs`}
                            </td>
                            <td className="px-4 py-3">
                              {row.lastInspection === null
                                ? "-"
                                : `${row.lastInspection.toLocaleString()} hrs`}
                            </td>
                            <td className="px-4 py-3">
                              {row.interval === null
                                ? "-"
                                : `${row.interval.toLocaleString()} ${
                                    row.intervalUnit === "hours"
                                      ? "hrs"
                                      : row.intervalUnit
                                  }`}
                            </td>
                            <td className="px-4 py-3">
                              {row.dueHours === null
                                ? "-"
                                : `${Math.abs(row.dueHours).toLocaleString()} hrs`}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill
                                label={status}
                                tone={
                                  status === "Overdue"
                                    ? "danger"
                                    : status === "Due"
                                      ? "success"
                                      : "neutral"
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {maintenanceEvents.length === 0 ? (
              <EmptyState message="No maintenance tracking records found." />
            ) : (
              maintenanceEvents.map((event, index) => (
                <div
                  key={event.id ?? index}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[#7FD5FF] text-sm font-bold uppercase">
                        {event.event_type || `Maintenance Event ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {event.description || "No description"}
                      </div>
                    </div>
                    <StatusPill
                      label={formatStatus(event.status)}
                      tone={
                        event.status === "completed"
                          ? "success"
                          : event.status === "ongoing" ||
                              event.status === "active"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <DetailRow
                        label="Started At"
                        value={formatDateTime(event.started_at)}
                      />
                      <DetailRow
                        label="Completed At"
                        value={formatDateTime(event.completed_at)}
                      />
                      <DetailRow
                        label="Hours Logged"
                        value={formatHours(event.hours_logged)}
                      />
                      <DetailRow
                        label="Aircraft Airworthiness"
                        value={formatStatus(event.aircraft_airworthiness)}
                      />
                    </div>
                    <div className="space-y-4">
                      <DetailRow
                        label="Performed By"
                        value={
                          event.performed_by ? String(event.performed_by) : "-"
                        }
                      />
                      <DetailRow
                        label="Component ID"
                        value={
                          event.component_id ? String(event.component_id) : "-"
                        }
                      />
                      <DetailRow label="Remarks" value={event.remarks || "-"} />
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

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">
      {label}
    </div>
    <div className="text-xl font-bold text-white">{value}</div>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between items-center border-b border-[#0A4D66]/20 pb-2 last:border-0 last:pb-0">
    <span className="text-[#7FD5FF] text-sm">{label}:</span>
    <span className="text-white text-sm font-medium">{value}</span>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 text-center text-gray-400">
    {message}
  </div>
);

const StatusPill = ({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
      tone === "success" && "bg-emerald-500/10 text-emerald-300",
      tone === "warning" && "bg-amber-500/10 text-amber-300",
      tone === "danger" && "bg-red-500/10 text-red-300",
      tone === "neutral" && "bg-gray-500/10 text-gray-300",
    )}
  >
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        tone === "success" && "bg-emerald-400",
        tone === "warning" && "bg-amber-400",
        tone === "danger" && "bg-red-400",
        tone === "neutral" && "bg-gray-400",
      )}
    />
    {label}
  </span>
);
