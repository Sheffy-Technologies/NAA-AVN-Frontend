import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAppDispatch } from "@/app/store";
import { useGetUnitsQuery } from "@/shared/api/units";
import { cn } from "@/shared/utils/cn";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useGetOperationsQuery } from "@/features/operations/api";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateAssetMutation,
  useCreateDocumentMutation,
  useGetAssetByIdQuery,
  useGetAssetTypesQuery,
  useGetAvionicCategoriesQuery,
  useGetComponentTypesQuery,
  useGetDocumentTypesQuery,
  useGetEngineCategoriesQuery,
  useGetEnginePositionsQuery,
  useUpdateAssetMutation,
  useUploadAssetImageMutation,
  type AssetDetail,
  type CreateAssetPayload,
} from "../api";

const FALLBACK_ENGINE_POSITIONS = [
  "Engine 1",
  "Engine 2",
  "Main Rotor",
  "Tail Rotor",
];

type AircraftTabKey =
  | "airframe"
  | "engine"
  | "avionics"
  | "discrepancy"
  | "documentations";

type TrackByKey = "hours" | "cycles" | "both";

type ApiErrorPayload = {
  message?: unknown;
  errors?: unknown;
};

type ApiError = {
  data?: unknown;
  status?: number;
};

const toDateOnly = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.split("T")[0];
};

const extractApiErrorMessage = (error: unknown): string => {
  const e = error as ApiError;
  const data = e && typeof e === "object" ? e.data : undefined;

  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const payload = data as ApiErrorPayload;
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";

    const errors =
      payload.errors && typeof payload.errors === "object"
        ? (payload.errors as Record<string, unknown>)
        : null;

    const flattened =
      errors == null
        ? []
        : Object.values(errors)
            .flatMap((value) =>
              Array.isArray(value)
                ? value.filter((x): x is string => typeof x === "string")
                : typeof value === "string"
                  ? [value]
                  : [],
            )
            .map((x) => x.trim())
            .filter(Boolean);

    if (flattened.length) {
      const head = flattened.slice(0, 3);
      const suffix =
        flattened.length > 3 ? ` (+${flattened.length - 3} more)` : "";
      return `${head.join("; ")}${suffix}`;
    }

    if (message) return message;
  }

  if (error instanceof Error && error.message) return error.message;
  return "Failed to save aircraft";
};

export const AddAssetPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const isEditRoute = location.pathname.endsWith("/edit");
  const editAssetId = routeId ? Number(routeId) : NaN;
  const canEdit =
    isEditRoute && Number.isFinite(editAssetId) && Number(editAssetId) > 0;
  const dispatch = useAppDispatch();
  const [createAsset, { isLoading: isCreating }] = useCreateAssetMutation();
  const [updateAsset, { isLoading: isUpdating }] = useUpdateAssetMutation();
  const {
    data: editAsset,
    isFetching: isLoadingEditAsset,
    isSuccess: isEditAssetLoaded,
  } = useGetAssetByIdQuery(editAssetId, {
    skip: !canEdit,
  });
  const [createDocument, { isLoading: isUploadingDocument }] =
    useCreateDocumentMutation();
  const [uploadAssetImage, { isLoading: isUploadingPhoto }] =
    useUploadAssetImageMutation();
  const { data: units = [] } = useGetUnitsQuery();
  const { data: assetTypes = [] } = useGetAssetTypesQuery();
  const { data: enginePositions = [] } = useGetEnginePositionsQuery();
  const { data: componentTypes = [] } = useGetComponentTypesQuery();
  const { data: engineCategories = [] } = useGetEngineCategoriesQuery();
  const { data: avionicCategories = [] } = useGetAvionicCategoriesQuery();
  const { data: documentTypes = [] } = useGetDocumentTypesQuery();
  const { data: operations = [] } = useGetOperationsQuery();
  const { data: engineers = [] } = useGetPersonnelQuery({
    branches: [3],
    units: [],
    ranks: [],
    corps: [],
    specialties: [],
    status: [],
  });

  const [activeTab, setActiveTab] = useState<AircraftTabKey>("airframe");
  const [airframeTrackBy, setAirframeTrackBy] = useState<TrackByKey>("both");
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const hasHydratedEditForm = useRef(false);
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  // Form State
  const [formData, setFormData] = useState({
    // Identification
    type: "aircraft",
    name: "",
    tail_number: "",
    serial_number: "",
    asset_type_id: "",
    model: "",
    aircraft_id: "",
    internal_id: "",
    military_registration: "",
    date_inducted: "",
    date_into_service: "",
    unit_id: "",
    operation_status: "serviceable",

    // Airframe
    total_airframe_hours: "",
    service_life_limit: "",
    last_major_inspection_date: "",
    last_major_inspection_hours: "",
    inspection_interval: "",
    next_annual_inspection: "",
    next_type_of_inspection: "",
    airframe_cycles: "",
    service_life_limit_cycles: "",
    last_inspection_cycles: "",
    inspection_interval_cycles: "",
    landings: "",

    // Configuration
    role: "air-defense",
    seats: 1,
    manufacturer: "",
    purchase_date: "",
  });

  // Dynamic Lists
  const [engines, setEngines] = useState([
    {
      position_id: 1, // Mock
      track_by: "hours" as TrackByKey,
      serial_number: "",
      model: "",
      installation_date: "",
      time_since_new: "",
      time_since_overhaul: "",
      service_life_limit: "",
      overhaul_limit: "",
      cycles_since_new: "",
      service_life_limit_cycles: "",
      cycles_since_overhaul: "",
      overhaul_limit_cycles: "",
    },
  ]);

  const [activeEngineIndex, setActiveEngineIndex] = useState(0);

  const [engineComponentsByEngine, setEngineComponentsByEngine] = useState([
    [
      {
        component_type: "",
        track_by: "hours" as TrackByKey,
        part_number: "",
        serial_number: "",
        life_limit_hours: "",
        time_since_overhaul: "",
        time_since_new: "",
        overhaul_limit: "",
        hours_used: "",
        installed_at: "",
        cycles_since_new: "",
        service_life_limit_cycles: "",
        cycles_since_overhaul: "",
        overhaul_limit_cycles: "",
      },
    ],
  ]);

  const [components, setComponents] = useState([
    {
      component_type: "",
      track_by: "hours" as TrackByKey,
      part_number: "",
      serial_number: "",
      life_limit_hours: "",
      time_since_overhaul: "",
      time_since_new: "",
      overhaul_limit: "",
      hours_used: "",
      installed_at: "",
      cycles_since_new: "",
      service_life_limit_cycles: "",
      cycles_since_overhaul: "",
      overhaul_limit_cycles: "",
    },
  ]);

  const [avionicsComponents, setAvionicsComponents] = useState([
    {
      component_type: "",
      track_by: "hours" as TrackByKey,
      part_number: "",
      serial_number: "",
      model: "",
      life_limit_hours: "",
      time_since_overhaul: "",
      time_since_new: "",
      overhaul_limit: "",
      hours_used: "",
      installed_at: "",
      removed_at: "",
      cycles_since_new: "",
      service_life_limit_cycles: "",
      cycles_since_overhaul: "",
      overhaul_limit_cycles: "",
    },
  ]);

  const [defects, setDefects] = useState([
    {
      defect_reported: "",
      date_of_defect: "",
      operation_id: "",
      location: "",
      defect_description: "",
      remark: "",
      rectified: true,
      rectification_details: "",
      work_done: "",
      certifying_engineer: "",
    },
  ]);

  const [documents, setDocuments] = useState([
    {
      document_type: "",
      file: "",
      file_url: "",
      issue_date: "",
      expiry_date: "",
    },
  ]);

  useEffect(() => {
    if (!canEdit || !isEditAssetLoaded || !editAsset || hasHydratedEditForm.current)
      return;

    const loadedAsset = editAsset as AssetDetail &
      Partial<CreateAssetPayload> & {
        asset_type_id?: number | string;
        total_cycles?: number | string;
        cycle_limit?: number | string;
        last_inspection_cycles?: number | string;
        inspection_interval_cycle?: number | string;
      };

    const rawConfiguration: unknown = loadedAsset.configuration;
    const configurationEntries: string[] = Array.isArray(rawConfiguration)
      ? rawConfiguration.map((entry) => String(entry))
      : rawConfiguration && typeof rawConfiguration === "object"
        ? Object.entries(rawConfiguration).map(
            ([key, value]) => `${key}:${String(value ?? "")}`,
          )
        : typeof rawConfiguration === "string"
          ? rawConfiguration
              .split(",")
              .map((entry: string) => entry.trim())
              .filter(Boolean)
          : [];

    const configMap = new Map<string, string>(
      configurationEntries.map((entry: string): [string, string] => {
        const [key, ...rest] = entry.split(":");
        return [key, rest.join(":")];
      }),
    );

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData((prev) => ({
      ...prev,
      type: loadedAsset.type || "aircraft",
      name: loadedAsset.name || "",
      tail_number: loadedAsset.tail_number || "",
      serial_number: loadedAsset.serial_number || "",
      asset_type_id:
        loadedAsset.asset_type_id != null ? String(loadedAsset.asset_type_id) : "",
      model: loadedAsset.model || "",
      unit_id: String(loadedAsset.unit_id || ""),
      operation_status: loadedAsset.serviceability_status || "serviceable",
      total_airframe_hours: String(loadedAsset.total_airframe_hours || ""),
      service_life_limit: String(loadedAsset.service_life_limit || ""),
      last_major_inspection_date: toDateOnly(loadedAsset.last_inspection_date || ""),
      last_major_inspection_hours: String(loadedAsset.last_inspection_hours || ""),
      inspection_interval: String(loadedAsset.inspection_interval || ""),
      next_annual_inspection: toDateOnly(
        loadedAsset.next_annual_inspection_date || "",
      ),
      next_type_of_inspection: loadedAsset.next_type_of_inspection || "",
      airframe_cycles: String(loadedAsset.total_cycles || ""),
      service_life_limit_cycles: String(loadedAsset.cycle_limit || ""),
      last_inspection_cycles: String(loadedAsset.last_inspection_cycles || ""),
      inspection_interval_cycles: String(loadedAsset.inspection_interval_cycle || ""),
      landings: String(loadedAsset.landings || ""),
      role: configMap.get("role") ?? prev.role,
      seats: Number(configMap.get("seats")) || prev.seats,
      manufacturer: loadedAsset.manufacturer || "",
      purchase_date: toDateOnly(loadedAsset.purchase_date || ""),
    }));

    setUploadedPhotoUrl(loadedAsset.image_url || loadedAsset.image || "");

    const mappedEngines = (loadedAsset.engines || []).map((engine) => ({
      position_id: Number(engine.position_id) || 1,
      track_by: "hours" as TrackByKey,
      serial_number: engine.serial_number || "",
      model: engine.model || "",
      installation_date: toDateOnly(engine.installation_date || ""),
      time_since_new: String(engine.time_since_new || ""),
      time_since_overhaul: String(engine.time_since_overhaul || ""),
      service_life_limit: String(engine.service_life_limit || ""),
      overhaul_limit: String(engine.overhaul_limit || ""),
      cycles_since_new: "",
      service_life_limit_cycles: "",
      cycles_since_overhaul: "",
      overhaul_limit_cycles: "",
    }));

    setEngines(
      mappedEngines.length > 0
        ? mappedEngines
        : [
            {
              position_id: 1,
              track_by: "hours",
              serial_number: "",
              model: "",
              installation_date: "",
              time_since_new: "",
              time_since_overhaul: "",
              service_life_limit: "",
              overhaul_limit: "",
              cycles_since_new: "",
              service_life_limit_cycles: "",
              cycles_since_overhaul: "",
              overhaul_limit_cycles: "",
            },
          ],
    );

    setEngineComponentsByEngine(
      (mappedEngines.length > 0 ? mappedEngines : [null]).map(() => [
        {
          component_type: "",
          track_by: "hours",
          part_number: "",
          serial_number: "",
          life_limit_hours: "",
          time_since_overhaul: "",
          time_since_new: "",
          overhaul_limit: "",
          hours_used: "",
          installed_at: "",
          cycles_since_new: "",
          service_life_limit_cycles: "",
          cycles_since_overhaul: "",
          overhaul_limit_cycles: "",
        },
      ]),
    );
    setActiveEngineIndex(0);

    const mappedComponents = (loadedAsset.components || []).map((component) => ({
      component_type: String(
        (component as { component_type_id?: number | string }).component_type_id || "",
      ),
      track_by: "hours" as TrackByKey,
      part_number: component.part_number || "",
      serial_number: component.serial_number || "",
      life_limit_hours: String(component.life_limit_hours || ""),
      time_since_overhaul: String(component.time_since_overhaul || ""),
      time_since_new: String(component.time_since_new || ""),
      overhaul_limit: String(component.overhaul_limit || ""),
      hours_used: String(component.hours_used || ""),
      installed_at: toDateOnly(component.installed_at || ""),
      cycles_since_new: "",
      service_life_limit_cycles: "",
      cycles_since_overhaul: "",
      overhaul_limit_cycles: "",
    }));

    setComponents(
      mappedComponents.length > 0
        ? mappedComponents
        : [
            {
              component_type: "",
              track_by: "hours",
              part_number: "",
              serial_number: "",
              life_limit_hours: "",
              time_since_overhaul: "",
              time_since_new: "",
              overhaul_limit: "",
              hours_used: "",
              installed_at: "",
              cycles_since_new: "",
              service_life_limit_cycles: "",
              cycles_since_overhaul: "",
              overhaul_limit_cycles: "",
            },
          ],
    );

    setDocuments(
      (loadedAsset.documents || []).length > 0
        ? (loadedAsset.documents || []).map((doc) => ({
            document_type: String(doc.document_type || ""),
            file: doc.file || "",
            file_url: doc.file || "",
            issue_date: toDateOnly(doc.issue_date || ""),
            expiry_date: toDateOnly(doc.expiry_date || ""),
          }))
        : [
            {
              document_type: "",
              file: "",
              file_url: "",
              issue_date: "",
              expiry_date: "",
            },
          ],
    );

    const mappedDefects = (loadedAsset.maintenance_events || [])
      .filter((event) =>
        ["defect", "maintenance", "unscheduled"]
          .map((x) => x.toLowerCase())
          .includes(String(event.event_type || "").toLowerCase()),
      )
      .map((event) => ({
        defect_reported: event.defect_reported || event.description || "",
        date_of_defect: toDateOnly(event.date_of_defect || event.started_at || ""),
        operation_id: "",
        location: event.location || "",
        defect_description: event.description || event.defect_reported || "",
        remark: event.remarks || "",
        rectified: Boolean(event.rectified),
        rectification_details: event.rectification_details || "",
        work_done: event.work_done || "",
        certifying_engineer: String(event.certifying_engineer || ""),
      }));

    setDefects(
      mappedDefects.length > 0
        ? mappedDefects
        : [
            {
              defect_reported: "",
              date_of_defect: "",
              operation_id: "",
              location: "",
              defect_description: "",
              remark: "",
              rectified: true,
              rectification_details: "",
              work_done: "",
              certifying_engineer: "",
            },
          ],
    );

    hasHydratedEditForm.current = true;
  }, [canEdit, editAsset, isEditAssetLoaded]);

  const handleFillTestValues = () => {
    const isoDate = new Date().toISOString().slice(0, 10);
    const unitId = units[0]?.id ?? 1;
    const assetType = assetTypes[0];
    const enginePositionId = enginePositions[0]?.id ?? 1;
    const componentTypeId = componentTypes[0]?.id;
    const avionicTypeId = avionicCategories[0]?.id;
    const documentTypeId = documentTypes[0]?.id;
    const operationId = operations[0]?.id;
    const engineerId = engineers[0]?.id;

    setFormData((prev) => ({
      ...prev,
      type: "aircraft",
      name: "Test Aircraft",
      tail_number: "NA 011",
      serial_number: "SN-TEST-001",
      asset_type_id: assetType ? String(assetType.id) : prev.asset_type_id,
      model: assetType?.name || prev.model || "Test Model",
      aircraft_id: "AC-TEST-001",
      internal_id: "INT-001",
      military_registration: "MR-001",
      date_inducted: "2020-01-15",
      date_into_service: "2020-02-01",
      unit_id: String(unitId),
      operation_status: "under_maintenance",
      total_airframe_hours: "400",
      service_life_limit: "900",
      last_major_inspection_date: isoDate,
      last_major_inspection_hours: "400",
      inspection_interval: "50",
      next_annual_inspection: isoDate,
      next_type_of_inspection: "A-check",
      airframe_cycles: "400",
      service_life_limit_cycles: "900",
      last_inspection_cycles: "400",
      inspection_interval_cycles: "90",
      landings: "420",
      role: "air-defense",
      seats: 1,
      manufacturer: "Lockheed Martin",
      purchase_date: "2018-06-14",
    }));

    setAirframeTrackBy("both");
    setActiveTab("airframe");

    setEngines([
      {
        position_id: enginePositionId,
        track_by: "hours",
        serial_number: "ENG-TEST-001",
        model: "Test Engine Model",
        installation_date: isoDate,
        time_since_new: "120",
        time_since_overhaul: "20",
        service_life_limit: "2000",
        overhaul_limit: "500",
        cycles_since_new: "100",
        service_life_limit_cycles: "5000",
        cycles_since_overhaul: "10",
        overhaul_limit_cycles: "1000",
      },
    ]);
    setActiveEngineIndex(0);

    setEngineComponentsByEngine([
      [
        {
          component_type: componentTypeId ? String(componentTypeId) : "",
          track_by: "hours",
          part_number: "ECP-001",
          serial_number: "ECSN-001",
          life_limit_hours: "1000",
          time_since_overhaul: "10",
          time_since_new: "100",
          overhaul_limit: "250",
          hours_used: "50",
          installed_at: isoDate,
          cycles_since_new: "20",
          service_life_limit_cycles: "3000",
          cycles_since_overhaul: "2",
          overhaul_limit_cycles: "600",
        },
      ],
    ]);

    setComponents([
      {
        component_type: componentTypeId ? String(componentTypeId) : "",
        track_by: "hours",
        part_number: "CP-1001",
        serial_number: "CSN-1001",
        life_limit_hours: "1500",
        time_since_overhaul: "30",
        time_since_new: "200",
        overhaul_limit: "400",
        hours_used: "80",
        installed_at: isoDate,
        cycles_since_new: "50",
        service_life_limit_cycles: "6000",
        cycles_since_overhaul: "5",
        overhaul_limit_cycles: "1200",
      },
    ]);

    setAvionicsComponents([
      {
        component_type: avionicTypeId ? String(avionicTypeId) : "",
        track_by: "hours",
        part_number: "AVP-2001",
        serial_number: "AVSN-2001",
        model: "Avionic Model X",
        life_limit_hours: "3000",
        time_since_overhaul: "40",
        time_since_new: "500",
        overhaul_limit: "600",
        hours_used: "120",
        installed_at: isoDate,
        removed_at: "",
        cycles_since_new: "0",
        service_life_limit_cycles: "0",
        cycles_since_overhaul: "0",
        overhaul_limit_cycles: "0",
      },
    ]);

    setDefects([
      {
        defect_reported: "Hydraulic leak",
        date_of_defect: isoDate,
        operation_id: operationId ? String(operationId) : "",
        location: "Hangar A",
        defect_description: "Hydraulic leak observed during checks.",
        remark: "Test record",
        rectified: false,
        rectification_details: "",
        work_done: "",
        certifying_engineer: engineerId ? String(engineerId) : "",
      },
    ]);

    setDocuments([
      {
        document_type: documentTypeId ? String(documentTypeId) : "",
        file: "",
        file_url: "",
        issue_date: isoDate,
        expiry_date: "2027-01-01",
      },
    ]);
  };

  const airframeLifeRemainingHours = useMemo(() => {
    const total = Number(formData.total_airframe_hours);
    const limit = Number(formData.service_life_limit);
    if (!limit || Number.isNaN(limit)) return "00 hrs";
    const remaining = limit - (Number.isNaN(total) ? 0 : total);
    const value = Math.max(0, remaining);
    return `${value} hrs`;
  }, [formData.service_life_limit, formData.total_airframe_hours]);

  const airframeLifeRemainingCycles = useMemo(() => {
    const total = Number(formData.airframe_cycles);
    const limit = Number(formData.service_life_limit_cycles);
    if (!limit || Number.isNaN(limit)) return "00 Cyc";
    const remaining = limit - (Number.isNaN(total) ? 0 : total);
    const value = Math.max(0, remaining);
    return `${value} Cyc`;
  }, [formData.service_life_limit_cycles, formData.airframe_cycles]);

  const nextInspectionDueHours = useMemo(() => {
    const total = Number(formData.total_airframe_hours);
    const last = Number(formData.last_major_inspection_hours);
    const interval = Number(formData.inspection_interval);
    if (!interval || Number.isNaN(interval)) {
      return { label: "next inspection due", value: "00 hrs" };
    }

    const remaining =
      (Number.isNaN(last) ? 0 : last) +
      interval -
      (Number.isNaN(total) ? 0 : total);

    if (remaining < 0) {
      return {
        label: "inspection overdue by",
        value: `${Math.abs(remaining)} hrs`,
      };
    }

    return { label: "next inspection due", value: `${remaining} hrs` };
  }, [
    formData.inspection_interval,
    formData.last_major_inspection_hours,
    formData.total_airframe_hours,
  ]);

  const nextInspectionDueCycles = useMemo(() => {
    const total = Number(formData.airframe_cycles);
    const last = Number(formData.last_inspection_cycles);
    const interval = Number(formData.inspection_interval_cycles);
    if (!interval || Number.isNaN(interval)) {
      return { label: "next inspection due", value: "00 Cyc" };
    }

    const remaining =
      (Number.isNaN(last) ? 0 : last) +
      interval -
      (Number.isNaN(total) ? 0 : total);

    if (remaining < 0) {
      return {
        label: "inspection overdue by",
        value: `${Math.abs(remaining)} Cyc`,
      };
    }

    return { label: "next inspection due", value: `${remaining} Cyc` };
  }, [
    formData.airframe_cycles,
    formData.inspection_interval_cycles,
    formData.last_inspection_cycles,
  ]);

  const handleInputChange = (
    field: string,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to handle array state updates
  const updateItem = <T,>(
    setter: (val: T[]) => void,
    list: T[],
    index: number,
    field: keyof T,
    value: string | number | boolean,
  ) => {
    const newList = [...list];
    newList[index] = { ...newList[index], [field]: value };
    setter(newList);
  };

  const addItem = <T,>(setter: (val: T[]) => void, list: T[], item: T) => {
    setter([...list, item]);
  };

  const handleRectifiedChange = (index: number, rectified: boolean) => {
    const newDefects = [...defects];
    const currentDefect = newDefects[index];

    newDefects[index] = {
      ...currentDefect,
      rectified,
      rectification_details: rectified ? "" : currentDefect.rectification_details,
      work_done: rectified ? "" : currentDefect.work_done,
      certifying_engineer: rectified ? "" : currentDefect.certifying_engineer,
    };

    setDefects(newDefects);
  };

  const removeItem = <T,>(
    setter: (val: T[]) => void,
    list: T[],
    index: number,
  ) => {
    setter(list.filter((_, i) => i !== index));
  };

  const addEngine = () => {
    const newIndex = engines.length;
    setEngines([
      ...engines,
      {
        position_id: 1,
        track_by: "hours",
        serial_number: "",
        model: "",
        installation_date: "",
        time_since_new: "",
        time_since_overhaul: "",
        service_life_limit: "",
        overhaul_limit: "",
        cycles_since_new: "",
        service_life_limit_cycles: "",
        cycles_since_overhaul: "",
        overhaul_limit_cycles: "",
      },
    ]);
    setEngineComponentsByEngine([
      ...engineComponentsByEngine,
      [
        {
          component_type: "",
          track_by: "hours",
          part_number: "",
          serial_number: "",
          life_limit_hours: "",
          time_since_overhaul: "",
          time_since_new: "",
          overhaul_limit: "",
          hours_used: "",
          installed_at: "",
          cycles_since_new: "",
          service_life_limit_cycles: "",
          cycles_since_overhaul: "",
          overhaul_limit_cycles: "",
        },
      ],
    ]);
    setActiveEngineIndex(newIndex);
  };

  const removeEngine = (index: number) => {
    if (engines.length <= 1) return;
    const nextEngines = engines.filter((_, i) => i !== index);
    const nextEngineComponents = engineComponentsByEngine.filter(
      (_, i) => i !== index,
    );
    setEngines(nextEngines);
    setEngineComponentsByEngine(nextEngineComponents);
    setActiveEngineIndex((prev) => {
      if (prev === index) return Math.max(0, index - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const addEngineComponent = () => {
    setEngineComponentsByEngine((prev) =>
      prev.map((list, i) =>
        i === activeEngineIndex
          ? [
              ...list,
              {
                component_type: "",
                track_by: "hours",
                part_number: "",
                serial_number: "",
                life_limit_hours: "",
                time_since_overhaul: "",
                time_since_new: "",
                overhaul_limit: "",
                hours_used: "",
                installed_at: "",
                cycles_since_new: "",
                service_life_limit_cycles: "",
                cycles_since_overhaul: "",
                overhaul_limit_cycles: "",
              },
            ]
          : list,
      ),
    );
  };

  const removeEngineComponent = (index: number) => {
    setEngineComponentsByEngine((prev) =>
      prev.map((list, i) =>
        i === activeEngineIndex ? list.filter((_, j) => j !== index) : list,
      ),
    );
  };

  const handleSubmit = async () => {
    try {
      const allComponents = [
        ...components,
        ...engineComponentsByEngine.flatMap((list) => list),
      ];

      const payload: CreateAssetPayload = {
        type: "aircraft",
        unit_id: Number(formData.unit_id) || 1, // Default to 1 if not selected
        asset_type_id: Number(formData.asset_type_id) || 0,
        name: formData.name,
        image: uploadedPhotoUrl || undefined,
        image_url: uploadedPhotoUrl || undefined,
        serial_number: formData.serial_number,
        model: formData.model,
        configuration: [
          `role:${formData.role}`,
          `seats:${Number(formData.seats) || 0}`,
        ],
        serviceability_status: formData.operation_status as
          | "serviceable"
          | "under_maintenance"
          | "grounded"
          | "medical",
        tail_number: formData.tail_number,
        total_airframe_hours: Number(formData.total_airframe_hours) || 0,
        service_life_limit: Number(formData.service_life_limit) || 0,
        total_cycles: Number(formData.airframe_cycles) || 0,
        cycle_limit: Number(formData.service_life_limit_cycles) || 0,
        last_inspection_cycles: Number(formData.last_inspection_cycles) || 0,
        inspection_interval_cycle:
          Number(formData.inspection_interval_cycles) || 0,
        last_inspection_hours:
          Number(formData.last_major_inspection_hours) || 0,
        inspection_interval: Number(formData.inspection_interval) || 0,
        next_annual_inspection_date: toDateOnly(
          formData.next_annual_inspection,
        ),
        next_type_of_inspection: formData.next_type_of_inspection,
        last_inspection_date: toDateOnly(formData.last_major_inspection_date),
        landings: formData.landings,
        operation_status: "operational",
        manufacturer: formData.manufacturer,
        purchase_date: toDateOnly(formData.purchase_date),

        engines: engines
          .filter(
            (engine) =>
              engine.serial_number || engine.model || engine.installation_date,
          )
          .map(
            ({
              position_id,
              serial_number,
              model,
              installation_date,
              time_since_new,
              time_since_overhaul,
              service_life_limit,
              overhaul_limit,
            }) => ({
              position_id: Number(position_id) || 1,
              serial_number,
              model,
              installation_date: toDateOnly(installation_date),
              time_since_new: Number(time_since_new) || 0,
              time_since_overhaul: Number(time_since_overhaul) || 0,
              service_life_limit: Number(service_life_limit) || 0,
              overhaul_limit: Number(overhaul_limit) || 0,
              category_id: 1, // to be reviewed
            }),
          ),

        components: allComponents
          .filter(
            (component) => component.part_number || component.serial_number,
          )
          .map(
            ({
              component_type,
              part_number,
              serial_number,
              life_limit_hours,
              time_since_overhaul,
              time_since_new,
              overhaul_limit,
              hours_used,
              installed_at,
            }) => ({
              component_type_id: Number(component_type) || 0,
              part_number,
              serial_number,
              total_service_hours:
                Number(hours_used) || Number(time_since_new) || 0,
              service_life_limit_hours: Number(life_limit_hours) || 0,
              last_overhaul_hours: Number(time_since_overhaul) || 0,
              overhaul_limit: Number(overhaul_limit) || 0,
              installed_at: toDateOnly(installed_at),
              removed_at: null,
            }),
          )
          .filter((c) => c.component_type_id > 0),

        documents: documents
          .map((d) => {
            const rawType = String(d.document_type || "").trim();
            const numericTypeId = Number(rawType);
            const documentTypeId =
              Number.isFinite(numericTypeId) && numericTypeId > 0
                ? numericTypeId
                : (documentTypes.find((t) => t.name === rawType)?.id ?? 0);

            return {
              document_type_id: documentTypeId,
              file: d.file || d.file_url,
              issue_date: d.issue_date ? toDateOnly(d.issue_date) : null,
              expiry_date: d.expiry_date ? toDateOnly(d.expiry_date) : null,
            };
          })
          .filter((d) => d.document_type_id > 0 && Boolean(d.file)),

        avionics: avionicsComponents
          .filter(
            (item) =>
              item.serial_number ||
              item.part_number ||
              item.model ||
              item.installed_at ||
              item.removed_at,
          )
          .map((item) => ({
            // avionic_category_id: 1, // to be reviewed
            avionic_category_id: Number(item.component_type) || 0,
            component_type_id: Number(item.component_type) || 0,
            serial_number: item.serial_number,
            model: item.model || item.part_number,
            total_service_hours:
              Number(item.hours_used) || Number(item.time_since_new) || 0,
            service_life_limit: Number(item.life_limit_hours) || 0,
            last_overhaul_hours: Number(item.time_since_overhaul) || 0,
            overhaul_limit: Number(item.overhaul_limit) || 0,
            installed_at: toDateOnly(item.installed_at),
            removed_at: item.removed_at ? toDateOnly(item.removed_at) : null,
          }))
          .filter((a) => a.component_type_id > 0),

        defects: defects
          .filter(
            (d) =>
              (d.defect_description || d.defect_reported) &&
              Boolean(d.operation_id),
          )
          .map((d) => {
            const engineerId = Number(d.certifying_engineer);
            const personnel =
              Number.isFinite(engineerId) && engineerId > 0 ? [engineerId] : [];

            return {
              operation_id: Number(d.operation_id),
              title: d.defect_reported || d.defect_description,
              description: d.defect_description || d.defect_reported,
              reported_at: toDateOnly(d.date_of_defect),
              status: d.rectified ? "resolved" : "open",
              severity: "low",
              personnel,
            };
          }),

        maintenance_events: [],
      };

      if (canEdit) {
        await updateAsset({ id: editAssetId, data: payload }).unwrap();
      } else {
        await createAsset(payload).unwrap();
      }
      navigate("/dashboard/assets");
    } catch (error) {
      console.error(`Failed to ${canEdit ? "update" : "create"} asset:`, error);
      dispatch(
        showToast({
          message: extractApiErrorMessage(error),
          type: "error",
        }),
      );
    }
  };

  const uploadDocumentForIndex = async (index: number, file: File) => {
    const doc = documents[index];
    if (!doc) return;

    const rawType = String(doc.document_type || "").trim();
    const numericTypeId = Number(rawType);
    const documentTypeId =
      Number.isFinite(numericTypeId) && numericTypeId > 0
        ? numericTypeId
        : (documentTypes.find((t) => t.name === rawType)?.id ?? null);

    try {
      const uploaded = await createDocument({
        asset_id: null,
        maintenance_event_id: null,
        document_type_id: documentTypeId,
        file,
        issue_date: doc.issue_date ? `${doc.issue_date}T00:00:00Z` : null,
        expiry_date: doc.expiry_date ? `${doc.expiry_date}T00:00:00Z` : null,
      }).unwrap();

      const fileValue = uploaded.file || uploaded.file_url;
      updateItem(setDocuments, documents, index, "file", fileValue);
      updateItem(setDocuments, documents, index, "file_url", uploaded.file_url);
    } catch (error) {
      console.error("Failed to upload document:", error);
    }
  };

  if (canEdit && isLoadingEditAsset && !editAsset) {
    return (
      <div className="min-h-screen bg-[#00090D] text-white p-6 pb-20">
        <div className="p-8 text-center text-gray-400">Loading asset details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#00090D] text-white p-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-[#0A4D66]/40 pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wider text-white">
          {isEditRoute ? "Edit Asset" : "Add Aircraft"}
        </h1>
        <div className="flex items-center gap-3">
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleFillTestValues}
              className="flex items-center space-x-2 border border-[#0A4D66]/50 bg-[#021a27] hover:bg-[#0A4D66]/30 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
            >
              <Icon icon="mdi:flask-outline" className="w-5 h-5" />
              <span>Fill Test Data</span>
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSaving || isUploadingPhoto}
            className="flex items-center space-x-2 bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 text-[#00090D] px-6 py-2 rounded text-sm font-bold transition-colors"
          >
            <Icon icon="mdi:check" className="w-5 h-5" />
            <span>
              {isSaving
                ? "Saving..."
                : isUploadingPhoto
                  ? "Uploading..."
                  : "Save & Exit"}
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Aircraft Identification */}
        <section>
          <h2 className="text-xs font-bold text-[#7FD5FF] uppercase mb-4">
            Aircraft Identification
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Aircraft Type</label>
              <select
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={formData.asset_type_id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const selected = assetTypes.find(
                    (t) => String(t.id) === nextId,
                  );
                  setFormData((prev) => ({
                    ...prev,
                    asset_type_id: nextId,
                    model: selected?.name || prev.model,
                  }));
                }}
              >
                <option value="">Select Type</option>
                {assetTypes.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Aircraft Name</label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Aircraft Name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Tail Number</label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Tail Number"
                value={formData.tail_number}
                onChange={(e) =>
                  handleInputChange("tail_number", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Serial Number (Airframe SN)
              </label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Serial Number"
                value={formData.serial_number}
                onChange={(e) =>
                  handleInputChange("serial_number", e.target.value)
                }
              />
            </div>

            {/* Second Row */}
            <div className="col-span-1 md:col-span-1 row-span-2 flex items-center justify-center border-2 border-dashed border-[#0A4D66] rounded-lg bg-[#001825]/50 hover:bg-[#001825] transition-colors cursor-pointer group overflow-hidden">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!file) return;

                  setPhotoError("");
                  setUploadedPhotoUrl("");
                  setPhotoPreviewUrl(URL.createObjectURL(file));

                  try {
                    const result = await uploadAssetImage(file).unwrap();
                    const url =
                      result.image_url ||
                      result.file_url ||
                      result.image ||
                      result.file ||
                      result.data ||
                      "";
                    setUploadedPhotoUrl(url);
                  } catch {
                    setPhotoError("Failed to upload photo");
                  }
                }}
              />

              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full h-full"
              >
                {photoPreviewUrl ? (
                  <div className="relative w-full h-full">
                    <img
                      src={photoPreviewUrl}
                      alt="Aircraft"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 px-2 py-1 text-[11px] text-white bg-black/50 flex items-center justify-between">
                      <span>
                        {isUploadingPhoto ? "Uploading..." : "Change Photo"}
                      </span>
                      <span className="text-gray-200">
                        {uploadedPhotoUrl ? "Uploaded" : ""}
                      </span>
                    </div>
                    {photoError ? (
                      <div className="absolute inset-x-0 top-0 px-2 py-1 text-[11px] bg-red-600/80 text-white">
                        {photoError}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <Icon
                      icon="mdi:helicopter"
                      className="w-12 h-12 text-[#0A4D66] group-hover:text-[#7FD5FF] mx-auto mb-2 transition-colors"
                    />
                    <span className="text-xs text-gray-400 group-hover:text-white">
                      {isUploadingPhoto ? "Uploading..." : "Upload Photo"}
                    </span>
                    {photoError ? (
                      <div className="mt-2 text-xs text-red-400">
                        {photoError}
                      </div>
                    ) : null}
                  </div>
                )}
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Aircraft ID</label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Aircraft ID"
                value={formData.aircraft_id}
                onChange={(e) =>
                  handleInputChange("aircraft_id", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Internal ID</label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Internal ID"
                value={formData.internal_id}
                onChange={(e) =>
                  handleInputChange("internal_id", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Military Registration
              </label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Registration No"
                value={formData.military_registration}
                onChange={(e) =>
                  handleInputChange("military_registration", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Date Inducted</label>
              <input
                type="date"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={formData.date_inducted}
                onChange={(e) =>
                  handleInputChange("date_inducted", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Date Into Service</label>
              <input
                type="date"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={formData.date_into_service}
                onChange={(e) =>
                  handleInputChange("date_into_service", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Assigned Unit</label>
              <select
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={formData.unit_id}
                onChange={(e) => handleInputChange("unit_id", e.target.value)}
              >
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Operation Status</label>
              <select
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={formData.operation_status}
                onChange={(e) =>
                  handleInputChange("operation_status", e.target.value)
                }
              >
                <option value="serviceable">Serviceable</option>
                <option value="under_maintenance">Under Maintenance</option>
                <option value="grounded">Grounded</option>
                <option value="unserviceable">Unserviceable</option>
              </select>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-[#0A4D66]/40">
          {[
            { key: "airframe" as const, label: "Airframe" },
            { key: "engine" as const, label: "Engines" },
            { key: "avionics" as const, label: "Avionics" },
            { key: "discrepancy" as const, label: "Discrepancy" },
            { key: "documentations" as const, label: "Documentations" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                "pb-3 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "text-white border-b-2 border-[#7FD5FF]"
                  : "text-gray-400 hover:text-gray-200",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "airframe" && (
          <section className="space-y-6">
            <div className="flex items-center gap-4 text-xs text-gray-300">
              <span className="text-xs font-semibold text-white">Track By</span>
              {[
                { key: "hours" as const, label: "Hours" },
                { key: "cycles" as const, label: "Cycles" },
                { key: "both" as const, label: "Hours & Cycles" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAirframeTrackBy(option.key)}
                  className="inline-flex items-center gap-2"
                >
                  <span
                    className={[
                      "w-3.5 h-3.5 rounded-full border",
                      airframeTrackBy === option.key
                        ? "border-[#7FD5FF] bg-[#7FD5FF]"
                        : "border-gray-500 bg-transparent",
                    ].join(" ")}
                  />
                  <span
                    className={
                      airframeTrackBy === option.key
                        ? "text-white"
                        : "text-gray-400"
                    }
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 space-y-4">
              {(airframeTrackBy === "hours" || airframeTrackBy === "both") && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Total Flight Hrs
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter Hrs"
                      value={formData.total_airframe_hours}
                      onChange={(e) =>
                        handleInputChange(
                          "total_airframe_hours",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Service Life Limit hrs
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter Hrs"
                      value={formData.service_life_limit}
                      onChange={(e) =>
                        handleInputChange("service_life_limit", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Life Remaining
                    </label>
                    <div className="text-2xl font-bold text-white">
                      {airframeLifeRemainingHours}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Last Inspection hrs
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter Hrs"
                      value={formData.last_major_inspection_hours}
                      onChange={(e) =>
                        handleInputChange(
                          "last_major_inspection_hours",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Inspection Interval
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter Hrs"
                      value={formData.inspection_interval}
                      onChange={(e) =>
                        handleInputChange("inspection_interval", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      {nextInspectionDueHours.label}
                    </label>
                    <div className="text-2xl font-bold text-white">
                      {nextInspectionDueHours.value}
                    </div>
                  </div>
                </div>
              )}

              {(airframeTrackBy === "cycles" || airframeTrackBy === "both") && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Total Cycles
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter cyc"
                      value={formData.airframe_cycles}
                      onChange={(e) =>
                        handleInputChange("airframe_cycles", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Cycle Limit</label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter cyc"
                      value={formData.service_life_limit_cycles}
                      onChange={(e) =>
                        handleInputChange(
                          "service_life_limit_cycles",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Life Remaining
                    </label>
                    <div className="text-2xl font-bold text-white">
                      {airframeLifeRemainingCycles}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Last Inspection Cycles
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter cyc"
                      value={formData.last_inspection_cycles}
                      onChange={(e) =>
                        handleInputChange(
                          "last_inspection_cycles",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Inspection Interval(Cycles)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter cyc"
                      value={formData.inspection_interval_cycles}
                      onChange={(e) =>
                        handleInputChange(
                          "inspection_interval_cycles",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      {nextInspectionDueCycles.label}
                    </label>
                    <div className="text-2xl font-bold text-white">
                      {nextInspectionDueCycles.value}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Last Major Inspection Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    value={formData.last_major_inspection_date}
                    onChange={(e) =>
                      handleInputChange(
                        "last_major_inspection_date",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Next Type of inspection
                  </label>
                  <input
                    type="text"
                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    placeholder="Enter Type of inspection"
                    value={formData.next_type_of_inspection}
                    onChange={(e) =>
                      handleInputChange(
                        "next_type_of_inspection",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Next Annual Inspection
                  </label>
                  <input
                    type="date"
                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    value={formData.next_annual_inspection}
                    onChange={(e) =>
                      handleInputChange(
                        "next_annual_inspection",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Landings</label>
                  <input
                    type="number"
                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    placeholder="Enter"
                    value={formData.landings}
                    onChange={(e) =>
                      handleInputChange("landings", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold text-[#7FD5FF] uppercase">
                  Airframe Component
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    addItem(setComponents, components, {
                      component_type: "",
                      track_by: "hours",
                      part_number: "",
                      serial_number: "",
                      life_limit_hours: "",
                      time_since_overhaul: "",
                      time_since_new: "",
                      overhaul_limit: "",
                      cycles_since_new: "",
                      service_life_limit_cycles: "",
                      cycles_since_overhaul: "",
                      overhaul_limit_cycles: "",
                      hours_used: "",
                      installed_at: "",
                    })
                  }
                  className="flex items-center gap-1 bg-white text-[#00090D] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
                >
                  <Icon icon="mdi:plus" className="w-3 h-3" />
                  Add Component
                </button>
              </div>

              <div className="space-y-4">
                {components.map((comp, idx) => {
                  const remainingLife = (() => {
                    const used = Number(comp.time_since_new);
                    const limit = Number(comp.life_limit_hours);
                    if (!limit || Number.isNaN(limit)) return "00 hrs";
                    const remaining = limit - (Number.isNaN(used) ? 0 : used);
                    return `${Math.max(0, remaining)} hrs`;
                  })();

                  const nextOverhaulDue = (() => {
                    const total = Number(comp.time_since_new);
                    const last = Number(comp.time_since_overhaul);
                    const limit = Number(comp.overhaul_limit);
                    if (!limit || Number.isNaN(limit))
                      return { label: "next Overhaul due", value: "00 hrs" };
                    const delta =
                      (Number.isNaN(total) ? 0 : total) -
                      (Number.isNaN(last) ? 0 : last) -
                      limit;
                    if (delta > 0) {
                      return {
                        label: "overhaul overdue by",
                        value: `${delta} hrs`,
                      };
                    }
                    return {
                      label: "next Overhaul due",
                      value: `${Math.abs(delta)} hrs`,
                    };
                  })();

                  return (
                    <div
                      key={idx}
                      className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#001825] border border-[#0A4D66]/40 flex items-center justify-center text-xs text-gray-200">
                            {idx + 1}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(setComponents, components, idx)
                          }
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Icon
                            icon="mdi:trash-can-outline"
                            className="w-4 h-4"
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-300 mb-4">
                        <span className="text-xs font-semibold text-white">
                          Track By
                        </span>
                        {[
                          { key: "hours" as const, label: "Hours" },
                          { key: "cycles" as const, label: "Cycles" },
                          { key: "both" as const, label: "Hours & Cycles" },
                        ].map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() =>
                              updateItem(
                                setComponents,
                                components,
                                idx,
                                "track_by",
                                option.key,
                              )
                            }
                            className="inline-flex items-center gap-2"
                          >
                            <span
                              className={[
                                "w-3.5 h-3.5 rounded-full border",
                                comp.track_by === option.key
                                  ? "border-[#7FD5FF] bg-[#7FD5FF]"
                                  : "border-gray-500 bg-transparent",
                              ].join(" ")}
                            />
                            <span
                              className={
                                comp.track_by === option.key
                                  ? "text-white"
                                  : "text-gray-400"
                              }
                            >
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Component Type
                          </label>
                          <select
                            className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                            value={comp.component_type}
                            onChange={(e) =>
                              updateItem(
                                setComponents,
                                components,
                                idx,
                                "component_type",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">Select Type</option>
                            {componentTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Serial Number
                          </label>
                          <input
                            type="text"
                            className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                            placeholder="Enter Serial Number"
                            value={comp.serial_number}
                            onChange={(e) =>
                              updateItem(
                                setComponents,
                                components,
                                idx,
                                "serial_number",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Part Number
                          </label>
                          <input
                            type="text"
                            className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                            placeholder="Enter Part number"
                            value={comp.part_number}
                            onChange={(e) =>
                              updateItem(
                                setComponents,
                                components,
                                idx,
                                "part_number",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Installation Date(optional)
                          </label>
                          <input
                            type="date"
                            className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                            value={comp.installed_at}
                            onChange={(e) =>
                              updateItem(
                                setComponents,
                                components,
                                idx,
                                "installed_at",
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        {(comp.track_by === "hours" ||
                          comp.track_by === "both") && (
                          <>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Total Service Hrs
                              </label>
                              <input
                                type="number"
                                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                placeholder="Enter Hrs"
                                value={comp.time_since_new}
                                onChange={(e) =>
                                  updateItem(
                                    setComponents,
                                    components,
                                    idx,
                                    "time_since_new",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Service Life Limit hrs
                              </label>
                              <input
                                type="number"
                                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                placeholder="Enter Hrs"
                                value={comp.life_limit_hours}
                                onChange={(e) =>
                                  updateItem(
                                    setComponents,
                                    components,
                                    idx,
                                    "life_limit_hours",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Life Remaining
                              </label>
                              <div className="text-2xl font-bold text-white">
                                {remainingLife}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Last Overhaul hrs
                              </label>
                              <input
                                type="number"
                                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                placeholder="Enter Hrs"
                                value={comp.time_since_overhaul}
                                onChange={(e) =>
                                  updateItem(
                                    setComponents,
                                    components,
                                    idx,
                                    "time_since_overhaul",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                Overhaul Limit
                              </label>
                              <input
                                type="number"
                                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                placeholder="Enter Hrs"
                                value={comp.overhaul_limit}
                                onChange={(e) =>
                                  updateItem(
                                    setComponents,
                                    components,
                                    idx,
                                    "overhaul_limit",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-400">
                                {nextOverhaulDue.label}
                              </label>
                              <div className="text-2xl font-bold text-white">
                                {nextOverhaulDue.value}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {(comp.track_by === "cycles" ||
                        comp.track_by === "both") && (
                        <div className="col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Total Cycles
                            </label>
                            <input
                              type="number"
                              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                              placeholder="Enter Cyc"
                              value={comp.cycles_since_new}
                              onChange={(e) =>
                                updateItem(
                                  setComponents,
                                  components,
                                  idx,
                                  "cycles_since_new",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Cycle Limit
                            </label>
                            <input
                              type="number"
                              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                              placeholder="Enter Cyc"
                              value={comp.service_life_limit_cycles}
                              onChange={(e) =>
                                updateItem(
                                  setComponents,
                                  components,
                                  idx,
                                  "service_life_limit_cycles",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Last Overhaul Cycles
                            </label>
                            <input
                              type="number"
                              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                              placeholder="Enter Cyc"
                              value={comp.cycles_since_overhaul}
                              onChange={(e) =>
                                updateItem(
                                  setComponents,
                                  components,
                                  idx,
                                  "cycles_since_overhaul",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Overhaul Interval (cycles)
                            </label>
                            <input
                              type="number"
                              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                              placeholder="Enter Cyc"
                              value={comp.overhaul_limit_cycles}
                              onChange={(e) =>
                                updateItem(
                                  setComponents,
                                  components,
                                  idx,
                                  "overhaul_limit_cycles",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              Life Remaining
                            </label>
                            <div className="text-2xl font-bold text-white">
                              {(() => {
                                const total = Number(comp.cycles_since_new);
                                const limit = Number(
                                  comp.service_life_limit_cycles,
                                );
                                if (!limit || Number.isNaN(limit))
                                  return "00 Cyc";
                                const remaining =
                                  limit - (Number.isNaN(total) ? 0 : total);
                                return `${Math.max(0, remaining)} Cyc`;
                              })()}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-400">
                              {(() => {
                                const total = Number(comp.cycles_since_new);
                                const last = Number(comp.cycles_since_overhaul);
                                const limit = Number(
                                  comp.overhaul_limit_cycles,
                                );
                                if (!limit || Number.isNaN(limit))
                                  return "next Overhaul due";
                                const delta =
                                  (Number.isNaN(total) ? 0 : total) -
                                  (Number.isNaN(last) ? 0 : last) -
                                  limit;
                                return delta > 0
                                  ? "overhaul overdue by"
                                  : "next Overhaul due";
                              })()}
                            </label>
                            <div className="text-2xl font-bold text-white">
                              {(() => {
                                const total = Number(comp.cycles_since_new);
                                const last = Number(comp.cycles_since_overhaul);
                                const limit = Number(
                                  comp.overhaul_limit_cycles,
                                );
                                if (!limit || Number.isNaN(limit))
                                  return "00 Cyc";
                                const delta =
                                  (Number.isNaN(total) ? 0 : total) -
                                  (Number.isNaN(last) ? 0 : last) -
                                  limit;
                                return delta > 0
                                  ? `${delta} Cyc`
                                  : `${Math.abs(delta)} Cyc`;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === "engine" && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              {engines.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveEngineIndex(idx)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold border transition-colors",
                    activeEngineIndex === idx
                      ? "bg-[#001825] text-white border-[#7FD5FF]"
                      : "bg-transparent text-gray-400 border-[#0A4D66]/40 hover:text-white",
                  )}
                >
                  <span>Engine {idx + 1}</span>
                  {engines.length > 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEngine(idx);
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <Icon icon="mdi:close" className="w-3 h-3" />
                    </button>
                  ) : null}
                </button>
              ))}

              <button
                type="button"
                onClick={addEngine}
                className="flex items-center gap-1 text-xs font-bold text-[#7FD5FF] hover:text-white"
              >
                <Icon icon="mdi:plus-circle-outline" className="w-4 h-4" />
                Add Engine
              </button>
            </div>

            {engines[activeEngineIndex] ? (
              <>
                <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-2 block">
                      Track By
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="radio"
                          name="engineTrackBy"
                          value="hours"
                          checked={
                            engines[activeEngineIndex].track_by === "hours"
                          }
                          onChange={() =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "track_by",
                              "hours",
                            )
                          }
                          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                        />
                        Hours
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="radio"
                          name="engineTrackBy"
                          value="cycles"
                          checked={
                            engines[activeEngineIndex].track_by === "cycles"
                          }
                          onChange={() =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "track_by",
                              "cycles",
                            )
                          }
                          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                        />
                        Cycles
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="radio"
                          name="engineTrackBy"
                          value="both"
                          checked={
                            engines[activeEngineIndex].track_by === "both"
                          }
                          onChange={() =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "track_by",
                              "both",
                            )
                          }
                          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                        />
                        Hours &amp; Cycles
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Position</label>
                      <select
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={engines[activeEngineIndex].position_id}
                        onChange={(e) =>
                          updateItem(
                            setEngines,
                            engines,
                            activeEngineIndex,
                            "position_id",
                            e.target.value,
                          )
                        }
                      >
                        {(enginePositions.length
                          ? enginePositions.map((pos) => ({
                              id: pos.id,
                              name: pos.name,
                            }))
                          : FALLBACK_ENGINE_POSITIONS.map((name, index) => ({
                              id: index + 1,
                              name,
                            }))
                        ).map((pos) => (
                          <option key={pos.id} value={pos.id}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Serial Number"
                        value={engines[activeEngineIndex].serial_number}
                        onChange={(e) =>
                          updateItem(
                            setEngines,
                            engines,
                            activeEngineIndex,
                            "serial_number",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Model</label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Model"
                        value={engines[activeEngineIndex].model}
                        onChange={(e) =>
                          updateItem(
                            setEngines,
                            engines,
                            activeEngineIndex,
                            "model",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Installation Date(optional)
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={engines[activeEngineIndex].installation_date}
                        onChange={(e) =>
                          updateItem(
                            setEngines,
                            engines,
                            activeEngineIndex,
                            "installation_date",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  {(engines[activeEngineIndex].track_by === "hours" ||
                    engines[activeEngineIndex].track_by === "both") && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Total Service Hrs
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={engines[activeEngineIndex].time_since_new}
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "time_since_new",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Service Life Limit hrs
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={engines[activeEngineIndex].service_life_limit}
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "service_life_limit",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Life Remaining
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(
                              engines[activeEngineIndex].time_since_new,
                            );
                            const limit = Number(
                              engines[activeEngineIndex].service_life_limit,
                            );
                            if (!limit || Number.isNaN(limit)) return "00 hrs";
                            const remaining =
                              limit - (Number.isNaN(total) ? 0 : total);
                            return `${Math.max(0, remaining)} hrs`;
                          })()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Last Overhaul hrs
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={engines[activeEngineIndex].time_since_overhaul}
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "time_since_overhaul",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Overhaul Limit
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={engines[activeEngineIndex].overhaul_limit}
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "overhaul_limit",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          {(() => {
                            const total = Number(
                              engines[activeEngineIndex].time_since_new,
                            );
                            const last = Number(
                              engines[activeEngineIndex].time_since_overhaul,
                            );
                            const interval = Number(
                              engines[activeEngineIndex].overhaul_limit,
                            );
                            if (!interval || Number.isNaN(interval))
                              return "next Overhaul due";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              interval;
                            return delta > 0
                              ? "overhaul overdue by"
                              : "next Overhaul due";
                          })()}
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(
                              engines[activeEngineIndex].time_since_new,
                            );
                            const last = Number(
                              engines[activeEngineIndex].time_since_overhaul,
                            );
                            const interval = Number(
                              engines[activeEngineIndex].overhaul_limit,
                            );
                            if (!interval || Number.isNaN(interval))
                              return "00 hrs";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              interval;
                            return delta > 0
                              ? `${delta} hrs`
                              : `${Math.abs(delta)} hrs`;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {(engines[activeEngineIndex].track_by === "cycles" ||
                    engines[activeEngineIndex].track_by === "both") && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Total Cycles
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={engines[activeEngineIndex].cycles_since_new}
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "cycles_since_new",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Cycle Limit
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={
                            engines[activeEngineIndex].service_life_limit_cycles
                          }
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "service_life_limit_cycles",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Life Remaining
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(
                              engines[activeEngineIndex].cycles_since_new,
                            );
                            const limit = Number(
                              engines[activeEngineIndex]
                                .service_life_limit_cycles,
                            );
                            if (!limit || Number.isNaN(limit)) return "00 Cyc";
                            const remaining =
                              limit - (Number.isNaN(total) ? 0 : total);
                            return `${Math.max(0, remaining)} Cyc`;
                          })()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Last Overhaul Cycles
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={
                            engines[activeEngineIndex].cycles_since_overhaul
                          }
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "cycles_since_overhaul",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Overhaul Limit
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={
                            engines[activeEngineIndex].overhaul_limit_cycles
                          }
                          onChange={(e) =>
                            updateItem(
                              setEngines,
                              engines,
                              activeEngineIndex,
                              "overhaul_limit_cycles",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          {(() => {
                            const total = Number(
                              engines[activeEngineIndex].cycles_since_new,
                            );
                            const last = Number(
                              engines[activeEngineIndex].cycles_since_overhaul,
                            );
                            const interval = Number(
                              engines[activeEngineIndex].overhaul_limit_cycles,
                            );
                            if (!interval || Number.isNaN(interval))
                              return "next Overhaul due";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              interval;
                            return delta > 0
                              ? "overhaul overdue by"
                              : "next Overhaul due";
                          })()}
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(
                              engines[activeEngineIndex].cycles_since_new,
                            );
                            const last = Number(
                              engines[activeEngineIndex].cycles_since_overhaul,
                            );
                            const interval = Number(
                              engines[activeEngineIndex].overhaul_limit_cycles,
                            );
                            if (!interval || Number.isNaN(interval))
                              return "00 Cyc";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              interval;
                            return delta > 0
                              ? `${delta} Cyc`
                              : `${Math.abs(delta)} Cyc`;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="text-xs font-bold text-[#7FD5FF] uppercase">
                      Engine Component
                    </h3>
                    <button
                      type="button"
                      onClick={addEngineComponent}
                      className="flex items-center gap-1 bg-white text-[#00090D] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
                    >
                      <Icon icon="mdi:plus" className="w-3 h-3" />
                      Add Component
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(engineComponentsByEngine[activeEngineIndex] ?? []).map(
                      (comp, idx) => (
                        <div
                          key={idx}
                          className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
                        >
                          <div className="absolute left-4 top-4 flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#001825] border border-[#0A4D66]/40 flex items-center justify-center text-xs font-bold text-white">
                              {idx + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEngineComponent(idx)}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <Icon
                                icon="mdi:trash-can-outline"
                                className="w-4 h-4"
                              />
                            </button>
                          </div>

                          <div className="pt-10">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="col-span-1 md:col-span-4">
                                <label className="text-xs text-gray-400 mb-2 block">
                                  Track By
                                </label>
                                <div className="flex gap-4">
                                  <label className="flex items-center gap-2 text-sm text-gray-400">
                                    <input
                                      type="radio"
                                      name={`engineComponentTrackBy-${idx}`}
                                      value="hours"
                                      checked={comp.track_by === "hours"}
                                      onChange={() =>
                                        setEngineComponentsByEngine((prev) =>
                                          prev.map((list, i) =>
                                            i === activeEngineIndex
                                              ? list.map((c, j) =>
                                                  j === idx
                                                    ? {
                                                        ...c,
                                                        track_by: "hours",
                                                      }
                                                    : c,
                                                )
                                              : list,
                                          ),
                                        )
                                      }
                                      className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                                    />
                                    Hours
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-gray-400">
                                    <input
                                      type="radio"
                                      name={`engineComponentTrackBy-${idx}`}
                                      value="cycles"
                                      checked={comp.track_by === "cycles"}
                                      onChange={() =>
                                        setEngineComponentsByEngine((prev) =>
                                          prev.map((list, i) =>
                                            i === activeEngineIndex
                                              ? list.map((c, j) =>
                                                  j === idx
                                                    ? {
                                                        ...c,
                                                        track_by: "cycles",
                                                      }
                                                    : c,
                                                )
                                              : list,
                                          ),
                                        )
                                      }
                                      className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                                    />
                                    Cycles
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-gray-400">
                                    <input
                                      type="radio"
                                      name={`engineComponentTrackBy-${idx}`}
                                      value="both"
                                      checked={comp.track_by === "both"}
                                      onChange={() =>
                                        setEngineComponentsByEngine((prev) =>
                                          prev.map((list, i) =>
                                            i === activeEngineIndex
                                              ? list.map((c, j) =>
                                                  j === idx
                                                    ? { ...c, track_by: "both" }
                                                    : c,
                                                )
                                              : list,
                                          ),
                                        )
                                      }
                                      className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                                    />
                                    Hours &amp; Cycles
                                  </label>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Component Type
                                </label>
                                <select
                                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                  value={comp.component_type}
                                  onChange={(e) =>
                                    setEngineComponentsByEngine((prev) =>
                                      prev.map((list, i) =>
                                        i === activeEngineIndex
                                          ? list.map((c, j) =>
                                              j === idx
                                                ? {
                                                    ...c,
                                                    component_type:
                                                      e.target.value,
                                                  }
                                                : c,
                                            )
                                          : list,
                                      ),
                                    )
                                  }
                                >
                                  <option value="">Select Type</option>
                                  {engineCategories.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Serial Number
                                </label>
                                <input
                                  type="text"
                                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                  placeholder="Enter Serial Number"
                                  value={comp.serial_number}
                                  onChange={(e) =>
                                    setEngineComponentsByEngine((prev) =>
                                      prev.map((list, i) =>
                                        i === activeEngineIndex
                                          ? list.map((c, j) =>
                                              j === idx
                                                ? {
                                                    ...c,
                                                    serial_number:
                                                      e.target.value,
                                                  }
                                                : c,
                                            )
                                          : list,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Part Number
                                </label>
                                <input
                                  type="text"
                                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                  placeholder="Enter Part number"
                                  value={comp.part_number}
                                  onChange={(e) =>
                                    setEngineComponentsByEngine((prev) =>
                                      prev.map((list, i) =>
                                        i === activeEngineIndex
                                          ? list.map((c, j) =>
                                              j === idx
                                                ? {
                                                    ...c,
                                                    part_number: e.target.value,
                                                  }
                                                : c,
                                            )
                                          : list,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-400">
                                  Installation Date(optional)
                                </label>
                                <input
                                  type="date"
                                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                  value={comp.installed_at}
                                  onChange={(e) =>
                                    setEngineComponentsByEngine((prev) =>
                                      prev.map((list, i) =>
                                        i === activeEngineIndex
                                          ? list.map((c, j) =>
                                              j === idx
                                                ? {
                                                    ...c,
                                                    installed_at:
                                                      e.target.value,
                                                  }
                                                : c,
                                            )
                                          : list,
                                      ),
                                    )
                                  }
                                />
                              </div>
                            </div>

                            {(comp.track_by === "hours" ||
                              comp.track_by === "both") && (
                              <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Total Service Hrs
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Hrs"
                                    value={comp.time_since_new}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      time_since_new:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Service Life Limit hrs
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Hrs"
                                    value={comp.life_limit_hours}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      life_limit_hours:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Life Remaining
                                  </label>
                                  <div className="text-2xl font-bold text-white">
                                    {(() => {
                                      const total = Number(comp.time_since_new);
                                      const limit = Number(
                                        comp.life_limit_hours,
                                      );
                                      if (!limit || Number.isNaN(limit))
                                        return "00 hrs";
                                      const remaining =
                                        limit -
                                        (Number.isNaN(total) ? 0 : total);
                                      return `${Math.max(0, remaining)} hrs`;
                                    })()}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Last Overhaul hrs
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Hrs"
                                    value={comp.time_since_overhaul}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      time_since_overhaul:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Overhaul Limit
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Hrs"
                                    value={comp.overhaul_limit}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      overhaul_limit:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    {(() => {
                                      const total = Number(comp.time_since_new);
                                      const last = Number(
                                        comp.time_since_overhaul,
                                      );
                                      const interval = Number(
                                        comp.overhaul_limit,
                                      );
                                      if (!interval || Number.isNaN(interval))
                                        return "next Overhaul due";
                                      const delta =
                                        (Number.isNaN(total) ? 0 : total) -
                                        (Number.isNaN(last) ? 0 : last) -
                                        interval;
                                      return delta > 0
                                        ? "overhaul overdue by"
                                        : "next Overhaul due";
                                    })()}
                                  </label>
                                  <div className="text-2xl font-bold text-white">
                                    {(() => {
                                      const total = Number(comp.time_since_new);
                                      const last = Number(
                                        comp.time_since_overhaul,
                                      );
                                      const interval = Number(
                                        comp.overhaul_limit,
                                      );
                                      if (!interval || Number.isNaN(interval))
                                        return "00 hrs";
                                      const delta =
                                        (Number.isNaN(total) ? 0 : total) -
                                        (Number.isNaN(last) ? 0 : last) -
                                        interval;
                                      return delta > 0
                                        ? `${delta} hrs`
                                        : `${Math.abs(delta)} hrs`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}

                            {(comp.track_by === "cycles" ||
                              comp.track_by === "both") && (
                              <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Total Cycles
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Cyc"
                                    value={comp.cycles_since_new}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      cycles_since_new:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Cycle Limit
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Cyc"
                                    value={comp.service_life_limit_cycles}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      service_life_limit_cycles:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Life Remaining
                                  </label>
                                  <div className="text-2xl font-bold text-white">
                                    {(() => {
                                      const total = Number(
                                        comp.cycles_since_new,
                                      );
                                      const limit = Number(
                                        comp.service_life_limit_cycles,
                                      );
                                      if (!limit || Number.isNaN(limit))
                                        return "00 Cyc";
                                      const remaining =
                                        limit -
                                        (Number.isNaN(total) ? 0 : total);
                                      return `${Math.max(0, remaining)} Cyc`;
                                    })()}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Last Overhaul Cycles
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Cyc"
                                    value={comp.cycles_since_overhaul}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      cycles_since_overhaul:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    Overhaul Limit
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                                    placeholder="Enter Cyc"
                                    value={comp.overhaul_limit_cycles}
                                    onChange={(e) =>
                                      setEngineComponentsByEngine((prev) =>
                                        prev.map((list, i) =>
                                          i === activeEngineIndex
                                            ? list.map((c, j) =>
                                                j === idx
                                                  ? {
                                                      ...c,
                                                      overhaul_limit_cycles:
                                                        e.target.value,
                                                    }
                                                  : c,
                                              )
                                            : list,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-400">
                                    {(() => {
                                      const total = Number(
                                        comp.cycles_since_new,
                                      );
                                      const last = Number(
                                        comp.cycles_since_overhaul,
                                      );
                                      const interval = Number(
                                        comp.overhaul_limit_cycles,
                                      );
                                      if (!interval || Number.isNaN(interval))
                                        return "next Overhaul due";
                                      const delta =
                                        (Number.isNaN(total) ? 0 : total) -
                                        (Number.isNaN(last) ? 0 : last) -
                                        interval;
                                      return delta > 0
                                        ? "overhaul overdue by"
                                        : "next Overhaul due";
                                    })()}
                                  </label>
                                  <div className="text-2xl font-bold text-white">
                                    {(() => {
                                      const total = Number(
                                        comp.cycles_since_new,
                                      );
                                      const last = Number(
                                        comp.cycles_since_overhaul,
                                      );
                                      const interval = Number(
                                        comp.overhaul_limit_cycles,
                                      );
                                      if (!interval || Number.isNaN(interval))
                                        return "00 Cyc";
                                      const delta =
                                        (Number.isNaN(total) ? 0 : total) -
                                        (Number.isNaN(last) ? 0 : last) -
                                        interval;
                                      return delta > 0
                                        ? `${delta} Cyc`
                                        : `${Math.abs(delta)} Cyc`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        )}

        {activeTab === "avionics" && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold text-[#7FD5FF] uppercase">
                Avionics Component
              </h3>
              <button
                type="button"
                onClick={() =>
                  addItem(setAvionicsComponents, avionicsComponents, {
                    component_type: "",
                    track_by: "hours",
                    part_number: "",
                    serial_number: "",
                    model: "",
                    life_limit_hours: "",
                    time_since_overhaul: "",
                    time_since_new: "",
                    overhaul_limit: "",
                    hours_used: "",
                    installed_at: "",
                    removed_at: "",
                    cycles_since_new: "",
                    service_life_limit_cycles: "",
                    cycles_since_overhaul: "",
                    overhaul_limit_cycles: "",
                  })
                }
                className="flex items-center gap-1 bg-white text-[#00090D] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
              >
                <Icon icon="mdi:plus" className="w-3 h-3" />
                Add
              </button>
            </div>

            <div className="space-y-4">
              {avionicsComponents.map((comp, idx) => (
                <div
                  key={idx}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#001825] border border-[#0A4D66]/40 flex items-center justify-center text-xs font-bold text-white">
                      {idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        removeItem(
                          setAvionicsComponents,
                          avionicsComponents,
                          idx,
                        )
                      }
                      className="text-gray-500 hover:text-red-500"
                    >
                      <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-2 block">
                      Track By
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="radio"
                          name={`avionicsTrackBy-${idx}`}
                          value="hours"
                          checked={comp.track_by === "hours"}
                          onChange={() =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "track_by",
                              "hours",
                            )
                          }
                          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                        />
                        Hours
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="radio"
                          name={`avionicsTrackBy-${idx}`}
                          value="cycles"
                          checked={comp.track_by === "cycles"}
                          onChange={() =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "track_by",
                              "cycles",
                            )
                          }
                          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                        />
                        Cycles
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="radio"
                          name={`avionicsTrackBy-${idx}`}
                          value="both"
                          checked={comp.track_by === "both"}
                          onChange={() =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "track_by",
                              "both",
                            )
                          }
                          className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                        />
                        Hours &amp; Cycles
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Component Type
                      </label>
                      <select
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={comp.component_type}
                        onChange={(e) =>
                          updateItem(
                            setAvionicsComponents,
                            avionicsComponents,
                            idx,
                            "component_type",
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Select Type</option>
                        {avionicCategories.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Serial Number"
                        value={comp.serial_number}
                        onChange={(e) =>
                          updateItem(
                            setAvionicsComponents,
                            avionicsComponents,
                            idx,
                            "serial_number",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Part Number
                      </label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Part number"
                        value={comp.part_number}
                        onChange={(e) =>
                          updateItem(
                            setAvionicsComponents,
                            avionicsComponents,
                            idx,
                            "part_number",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Installation Date(optional)
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={comp.installed_at}
                        onChange={(e) =>
                          updateItem(
                            setAvionicsComponents,
                            avionicsComponents,
                            idx,
                            "installed_at",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Model</label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Model"
                        value={comp.model}
                        onChange={(e) =>
                          updateItem(
                            setAvionicsComponents,
                            avionicsComponents,
                            idx,
                            "model",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Removed At(optional)
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={comp.removed_at}
                        onChange={(e) =>
                          updateItem(
                            setAvionicsComponents,
                            avionicsComponents,
                            idx,
                            "removed_at",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  {(comp.track_by === "hours" || comp.track_by === "both") && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Total Service Hrs
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={comp.time_since_new}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "time_since_new",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Service Life Limit hrs
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={comp.life_limit_hours}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "life_limit_hours",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Life Remaining
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(comp.time_since_new);
                            const limit = Number(comp.life_limit_hours);
                            if (!limit || Number.isNaN(limit)) return "00 hrs";
                            const remaining =
                              limit - (Number.isNaN(total) ? 0 : total);
                            return `${Math.max(0, remaining)} hrs`;
                          })()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Last Overhaul hrs
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={comp.time_since_overhaul}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "time_since_overhaul",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Overhaul Limit
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Hrs"
                          value={comp.overhaul_limit}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "overhaul_limit",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          {(() => {
                            const total = Number(comp.time_since_new);
                            const last = Number(comp.time_since_overhaul);
                            const interval = Number(comp.overhaul_limit);
                            if (!interval || Number.isNaN(interval))
                              return "next Overhaul due";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              interval;
                            return delta > 0
                              ? "overhaul overdue by"
                              : "next Overhaul due";
                          })()}
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(comp.time_since_new);
                            const last = Number(comp.time_since_overhaul);
                            const interval = Number(comp.overhaul_limit);
                            if (!interval || Number.isNaN(interval))
                              return "00 hrs";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              interval;
                            return delta > 0
                              ? `${delta} hrs`
                              : `${Math.abs(delta)} hrs`;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {(comp.track_by === "cycles" || comp.track_by === "both") && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Total Cycles
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={comp.cycles_since_new}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "cycles_since_new",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Cycle Limit
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={comp.service_life_limit_cycles}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "service_life_limit_cycles",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Life Remaining
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(comp.cycles_since_new);
                            const limit = Number(
                              comp.service_life_limit_cycles,
                            );
                            if (!limit || Number.isNaN(limit)) return "00 Cyc";
                            const remaining =
                              limit - (Number.isNaN(total) ? 0 : total);
                            return `${Math.max(0, remaining)} Cyc`;
                          })()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Last Overhaul Cycles
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={comp.cycles_since_overhaul}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "cycles_since_overhaul",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Overhaul Limit
                        </label>
                        <input
                          type="number"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Cyc"
                          value={comp.overhaul_limit_cycles}
                          onChange={(e) =>
                            updateItem(
                              setAvionicsComponents,
                              avionicsComponents,
                              idx,
                              "overhaul_limit_cycles",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          {(() => {
                            const total = Number(comp.cycles_since_new);
                            const last = Number(comp.cycles_since_overhaul);
                            const limit = Number(comp.overhaul_limit_cycles);
                            if (!limit || Number.isNaN(limit))
                              return "next Overhaul due";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              limit;
                            return delta > 0
                              ? "overhaul overdue by"
                              : "next Overhaul due";
                          })()}
                        </label>
                        <div className="text-2xl font-bold text-white">
                          {(() => {
                            const total = Number(comp.cycles_since_new);
                            const last = Number(comp.cycles_since_overhaul);
                            const limit = Number(comp.overhaul_limit_cycles);
                            if (!limit || Number.isNaN(limit)) return "00 Cyc";
                            const delta =
                              (Number.isNaN(total) ? 0 : total) -
                              (Number.isNaN(last) ? 0 : last) -
                              limit;
                            return delta > 0
                              ? `${delta} Cyc`
                              : `${Math.abs(delta)} Cyc`;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "discrepancy" && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xs font-bold text-[#7FD5FF] uppercase">
                Defects/Snags
              </h2>
              <button
                type="button"
                onClick={() =>
                  addItem(setDefects, defects, {
                    defect_reported: "",
                    date_of_defect: "",
                    operation_id: "",
                    location: "",
                    defect_description: "",
                    remark: "",
                    rectified: true,
                    rectification_details: "",
                    work_done: "",
                    certifying_engineer: "",
                  })
                }
                className="flex items-center gap-1 bg-white text-[#00090D] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
              >
                <Icon icon="mdi:plus" className="w-3 h-3" />
                Add Snag
              </button>
            </div>

            <div className="space-y-4">
              {defects.map((defect, idx) => (
                <div
                  key={idx}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#001825] border border-[#0A4D66]/40 flex items-center justify-center text-xs font-bold text-white">
                      {idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(setDefects, defects, idx)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Defect Reported
                      </label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Defect"
                        value={defect.defect_reported}
                        onChange={(e) =>
                          updateItem(
                            setDefects,
                            defects,
                            idx,
                            "defect_reported",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Date of defect
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={defect.date_of_defect}
                        onChange={(e) =>
                          updateItem(
                            setDefects,
                            defects,
                            idx,
                            "date_of_defect",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Operation</label>
                      <select
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={defect.operation_id}
                        onChange={(e) =>
                          updateItem(
                            setDefects,
                            defects,
                            idx,
                            "operation_id",
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Select Operation</option>
                        {operations.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Location</label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Location"
                        value={defect.location}
                        onChange={(e) =>
                          updateItem(
                            setDefects,
                            defects,
                            idx,
                            "location",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Defect Description
                      </label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Remark"
                        value={defect.defect_description}
                        onChange={(e) =>
                          updateItem(
                            setDefects,
                            defects,
                            idx,
                            "defect_description",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Remark</label>
                      <input
                        type="text"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        placeholder="Enter Remark"
                        value={defect.remark}
                        onChange={(e) =>
                          updateItem(
                            setDefects,
                            defects,
                            idx,
                            "remark",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-xs font-bold text-white">
                      Rectified?
                    </span>
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input
                        type="radio"
                        name={`rectified-${idx}`}
                        checked={defect.rectified}
                        onChange={() => handleRectifiedChange(idx, true)}
                        className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                      />
                      Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input
                        type="radio"
                        name={`rectified-${idx}`}
                        checked={!defect.rectified}
                        onChange={() => handleRectifiedChange(idx, false)}
                        className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                      />
                      No
                    </label>
                  </div>

                  {!defect.rectified && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">
                          Rectification Details
                        </label>
                        <input
                          type="text"
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          placeholder="Enter Details"
                          value={defect.rectification_details}
                          onChange={(e) =>
                            updateItem(
                              setDefects,
                              defects,
                              idx,
                              "rectification_details",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="col-span-3 space-y-1">
                          <label className="text-xs text-gray-400">
                            Work Done
                          </label>
                          <input
                            type="text"
                            className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                            placeholder="Enter Descriptions"
                            value={defect.work_done}
                            onChange={(e) =>
                              updateItem(
                                setDefects,
                                defects,
                                idx,
                                "work_done",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-400">
                            Certifying Engineer
                          </label>
                          <select
                            className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                            value={defect.certifying_engineer}
                            onChange={(e) =>
                              updateItem(
                                setDefects,
                                defects,
                                idx,
                                "certifying_engineer",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">Select Engineers</option>
                            {engineers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.rank?.name ? `${p.rank.name} ` : ""}
                                {p.firstname} {p.lastname}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "documentations" && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xs font-bold text-[#7FD5FF] uppercase">
                Documentation
              </h2>
              <button
                type="button"
                onClick={() =>
                  addItem(setDocuments, documents, {
                    document_type: "",
                    file: "",
                    file_url: "",
                    issue_date: "",
                    expiry_date: "",
                  })
                }
                className="flex items-center gap-1 bg-white text-[#00090D] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
              >
                <Icon icon="mdi:plus" className="w-3 h-3" />
                Add Document
              </button>
            </div>

            <div className="space-y-4">
              {documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeItem(setDocuments, documents, idx)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
                  >
                    <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                  </button>
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">
                    Document {idx + 1}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Document Type
                      </label>
                      <select
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={doc.document_type}
                        onChange={(e) =>
                          updateItem(
                            setDocuments,
                            documents,
                            idx,
                            "document_type",
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Select Type</option>
                        {documentTypes.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Document</label>
                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[idx] = el;
                          }}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const selectedFile = e.target.files?.[0];
                            e.target.value = "";
                            if (!selectedFile) return;
                            void uploadDocumentForIndex(idx, selectedFile);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[idx]?.click()}
                          disabled={isUploadingDocument}
                          className="flex items-center gap-2 bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white w-full hover:bg-[#0A4D66]/20"
                        >
                          <Icon
                            icon="mdi:upload"
                            className="w-4 h-4 text-[#7FD5FF]"
                          />
                          <span>
                            {doc.file_url || doc.file
                              ? "Uploaded"
                              : "Upload Document"}
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Issue date
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={doc.issue_date}
                        onChange={(e) =>
                          updateItem(
                            setDocuments,
                            documents,
                            idx,
                            "issue_date",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        value={doc.expiry_date}
                        onChange={(e) =>
                          updateItem(
                            setDocuments,
                            documents,
                            idx,
                            "expiry_date",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end pt-8">
          <button
            onClick={handleSubmit}
            disabled={isSaving || isUploadingPhoto}
            className="w-full md:w-auto bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 text-[#00090D] px-8 py-3 rounded text-sm font-bold transition-colors uppercase tracking-widest"
          >
            {isSaving ? "Saving..." : isUploadingPhoto ? "Uploading..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
