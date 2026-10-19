import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { forward as toMgrs, toPoint as mgrsToPoint } from "mgrs";
import { useGetAssetsQuery } from "@/features/assets/api";
import {
  useGetPersonnelQuery,
  useCreatePersonnelMutation,
} from "@/features/personnel/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import {
  useGetOperationTypesQuery,
  useGetOperationCategoriesQuery,
  useCreateOperationCategoryMutation,
  useCreateOperationTypeMutation,
  type CreateOperationRequest,
  type Operation,
  type OperationAsset,
  type OperationWaypointInput,
} from "../api";
import { OperationLocationPicker } from "./OperationLocationPicker";
import Modal from "@/shared/ui/modal/Modal";
import { BackButton, CancelButton } from "@/shared/ui/button";

type OperationFormMode = "create" | "edit";

type OperationFormData = {
  name: string;
  operation_category_id: string;
  operation_type_id: string;
  unit_id: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  departure_longitude: string;
  departure_latitude: string;
  departure_mgrs: string;
  arrival_longitude: string;
  arrival_latitude: string;
  arrival_mgrs: string;
  priority: "low" | "medium" | "high";
  is_flight: boolean;
  status: "planned" | "completed" | "ongoing" | "aborted";
  description: string;
};

type CoordinateTarget = "departure" | "arrival";
type CoordinateAxis = "latitude" | "longitude";
type CoordinateInputMode = "latlon" | "mgrs";
type CoordinateErrorState = Record<CoordinateTarget, string>;
type MapTarget = "departure" | "arrival" | "waypoint";

type WaypointFormItem = {
  name: string;
  latitude: string;
  longitude: string;
};

type OperationFormProps = {
  mode: OperationFormMode;
  initialOperation?: Operation | null;
  onSubmit: (payload: CreateOperationRequest) => Promise<void>;
  isSubmitting: boolean;
};

const emptyFormData: OperationFormData = {
  name: "",
  operation_category_id: "",
  operation_type_id: "",
  unit_id: "",
  start_date: "",
  start_time: "00:00",
  end_date: "",
  end_time: "00:00",
  departure_longitude: "",
  departure_latitude: "",
  departure_mgrs: "",
  arrival_longitude: "",
  arrival_latitude: "",
  arrival_mgrs: "",
  priority: "medium",
  is_flight: true,
  status: "planned",
  description: "",
};

const getPersonnelDisplayName = (person: {
  firstname?: string | null;
  lastname?: string | null;
  rank?: { name?: string | null } | null;
  call_sign?: string | null;
}) => {
  const rankName = person.rank?.name?.trim();
  const firstName = person.firstname?.trim() ?? "";
  const lastName = person.lastname?.trim() ?? "";
  const callSign = person.call_sign?.trim();
  const base = `${rankName ? `${rankName} ` : ""}${firstName} ${lastName}`.trim();
  return callSign ? `${base} (${callSign})` : base;
};

const formatCoordinate = (value?: number | null) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? ""
    : Number(value).toFixed(6);

const formatMgrsDisplayValue = (value?: string | null) =>
  value ? value.trim().toUpperCase().replace(/\s+/g, " ") : "";

const normalizeMgrsForParsing = (value: string) =>
  value.replace(/\s+/g, "").toUpperCase();

const parseCoordinateNumber = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isLatitudeInRange = (value: number) => value >= -90 && value <= 90;
const isLongitudeInRange = (value: number) => value >= -180 && value <= 180;

const convertLatLonToMgrs = (latitude: string, longitude: string) => {
  const parsedLatitude = parseCoordinateNumber(latitude);
  const parsedLongitude = parseCoordinateNumber(longitude);

  if (
    parsedLatitude === null ||
    parsedLongitude === null ||
    !isLatitudeInRange(parsedLatitude) ||
    !isLongitudeInRange(parsedLongitude)
  ) {
    return "";
  }

  try {
    return toMgrs([parsedLongitude, parsedLatitude], 5);
  } catch {
    return "";
  }
};

const convertMgrsToLatLon = (value: string) => {
  const normalized = normalizeMgrsForParsing(value);

  if (!normalized) {
    return null;
  }

  try {
    const [longitude, latitude] = mgrsToPoint(normalized);

    if (!isLatitudeInRange(latitude) || !isLongitudeInRange(longitude)) {
      return null;
    }

    return {
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    };
  } catch {
    return null;
  }
};

const extractDate = (value?: string | null) => {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value.slice(0, 10);
};

const extractTime = (value?: string | null) => {
  if (!value) return "00:00";
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "00:00";
};

const mapOperationToFormData = (operation: Operation): OperationFormData => ({
  name: operation.name ?? "",
  operation_category_id: operation.operation_category_id
    ? String(operation.operation_category_id)
    : "",
  operation_type_id: operation.operation_type_id
    ? String(operation.operation_type_id)
    : "",
  unit_id: operation.unit_id ? String(operation.unit_id) : "",
  start_date: extractDate(operation.start_date_time),
  start_time: extractTime(operation.start_date_time),
  end_date: extractDate(operation.end_date_time),
  end_time: extractTime(operation.end_date_time),
  departure_longitude: formatCoordinate(operation.departure_longitude),
  departure_latitude: formatCoordinate(operation.departure_latitude),
  departure_mgrs: convertLatLonToMgrs(
    formatCoordinate(operation.departure_latitude),
    formatCoordinate(operation.departure_longitude),
  ),
  arrival_longitude: formatCoordinate(operation.arrival_longitude),
  arrival_latitude: formatCoordinate(operation.arrival_latitude),
  arrival_mgrs: convertLatLonToMgrs(
    formatCoordinate(operation.arrival_latitude),
    formatCoordinate(operation.arrival_longitude),
  ),
  priority: operation.priority,
  is_flight: Boolean(operation.is_flight),
  status: operation.status,
  description: operation.description ?? "",
});

const mapAssignedAssetsToForm = (operation?: Operation | null): OperationAsset[] => {
  const mappedAssets =
    operation?.assets
      ?.map((asset) => {
        const relationAsset = asset as OperationAsset & {
          id?: number;
          actual_flight_hours?: number | string | null;
          pivot?: {
            asset_id?: number;
            pilot_id?: number | null;
            co_pilot_id?: number | null;
            flight_hours?: number | string | null;
          } | null;
        };

        const assetId =
          relationAsset.asset_id ?? relationAsset.id ?? relationAsset.pivot?.asset_id ?? 0;
        const pilotId = relationAsset.pilot_id ?? relationAsset.pivot?.pilot_id ?? null;
        const coPilotId =
          relationAsset.co_pilot_id ?? relationAsset.pivot?.co_pilot_id ?? null;
        const flightHoursRaw =
          relationAsset.flight_hours ?? relationAsset.pivot?.flight_hours ?? null;
        const flightHours =
          flightHoursRaw === null || flightHoursRaw === undefined
            ? null
            : Number(flightHoursRaw);

        return {
          asset_id: assetId,
          pilot_id: pilotId,
          co_pilot_id: coPilotId,
          flight_hours: flightHours !== null && !Number.isNaN(flightHours) ? flightHours : null,
        };
      })
      .filter((asset) => Boolean(asset.asset_id)) ?? [];

  if (mappedAssets.length > 0) {
    return mappedAssets;
  }

  return [{ asset_id: 0, pilot_id: null, co_pilot_id: null, flight_hours: null }];
};

export const OperationForm = ({
  mode,
  initialOperation,
  onSubmit,
  isSubmitting,
}: OperationFormProps) => {
  const dispatch = useAppDispatch();
  const [coordinateInputMode, setCoordinateInputMode] =
    useState<CoordinateInputMode>("latlon");
  const [activeMapTarget, setActiveMapTarget] = useState<MapTarget>(
    "departure",
  );
  const [coordinateErrors, setCoordinateErrors] = useState<CoordinateErrorState>({
    departure: "",
    arrival: "",
  });
  const [formData, setFormData] = useState<OperationFormData>(
    initialOperation ? mapOperationToFormData(initialOperation) : emptyFormData,
  );
  const [waypoints, setWaypoints] = useState<WaypointFormItem[]>(
    initialOperation?.waypoints?.length
      ? initialOperation.waypoints
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((w) => ({
            name: w.name ?? "",
            latitude: formatCoordinate(w.latitude),
            longitude: formatCoordinate(w.longitude),
          }))
      : [],
  );
  const [assets, setAssets] = useState<OperationAsset[]>([
    ...mapAssignedAssetsToForm(initialOperation),
  ]);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [createOperationCategory, { isLoading: isCreatingCategory }] =
    useCreateOperationCategoryMutation();

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");
  const [createOperationType, { isLoading: isCreatingType }] =
    useCreateOperationTypeMutation();

  type QuickAddPersonnelTarget = { assetIndex: number; role: "pilot_id" | "co_pilot_id" };
  const [showAddPersonnelModal, setShowAddPersonnelModal] = useState(false);
  const [addPersonnelTarget, setAddPersonnelTarget] = useState<QuickAddPersonnelTarget | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({ call_sign: "" });
  const [quickAddedPersonnel, setQuickAddedPersonnel] = useState<Array<{ id: number; firstname: string; lastname: string; rank?: { name?: string | null } | null; call_sign?: string | null }>>([]);
  const [createPersonnel, { isLoading: isCreatingPersonnel }] = useCreatePersonnelMutation();

  const { data: units = [] } = useGetUnitsQuery();
  const { data: operationCategories = [] } = useGetOperationCategoriesQuery();
  const { data: operationTypes = [] } = useGetOperationTypesQuery();
  const { data: aircraftOptions = [] } = useGetAssetsQuery({ type: "aircraft" });
  const { data: personnel = [] } = useGetPersonnelQuery({
    branches: [],
    units: [],
    ranks: [],
    corps: [],
    specialties: [],
    status: [],
  });

  const isCreateMode = mode === "create";
  const pageTitle = isCreateMode ? "ADD OPERATION" : "EDIT OPERATION";
  const submitLabel = isCreateMode ? "Save" : "Save Changes";

  const pilots = useMemo(() => {
    const existingIds = new Set(personnel.map((p) => p.id));
    const extras = quickAddedPersonnel.filter((p) => !existingIds.has(p.id));
    return [...personnel, ...extras] as typeof personnel;
  }, [personnel, quickAddedPersonnel]);

  const updateTargetCoordinates = (
    previous: OperationFormData,
    nextValues: Partial<
      Pick<
        OperationFormData,
        | "departure_latitude"
        | "departure_longitude"
        | "departure_mgrs"
        | "arrival_latitude"
        | "arrival_longitude"
        | "arrival_mgrs"
      >
    >,
  ) => ({
    ...previous,
    ...nextValues,
  });

  const setTargetFromLatLon = (
    target: CoordinateTarget,
    latitude: string,
    longitude: string,
  ) => {
    setFormData((prev) =>
      updateTargetCoordinates(prev, {
        [`${target}_latitude`]: latitude,
        [`${target}_longitude`]: longitude,
        [`${target}_mgrs`]: convertLatLonToMgrs(latitude, longitude),
      } as Partial<OperationFormData>),
    );
    setCoordinateErrors((prev) => ({ ...prev, [target]: "" }));
  };

  const handleLatLonChange = (
    target: CoordinateTarget,
    axis: CoordinateAxis,
    value: string,
  ) => {
    setFormData((prev) => {
      const nextLatitude =
        axis === "latitude" ? value : prev[`${target}_latitude` as const];
      const nextLongitude =
        axis === "longitude" ? value : prev[`${target}_longitude` as const];

      return updateTargetCoordinates(prev, {
        [`${target}_${axis}`]: value,
        [`${target}_mgrs`]: convertLatLonToMgrs(nextLatitude, nextLongitude),
      } as Partial<OperationFormData>);
    });
    setCoordinateErrors((prev) => ({ ...prev, [target]: "" }));
  };

  const handleMgrsChange = (target: CoordinateTarget, value: string) => {
    const displayValue = formatMgrsDisplayValue(value);
    const convertedCoordinates = convertMgrsToLatLon(displayValue);

    setFormData((prev) => {
      if (!displayValue) {
        return updateTargetCoordinates(prev, {
          [`${target}_mgrs`]: "",
          [`${target}_latitude`]: "",
          [`${target}_longitude`]: "",
        } as Partial<OperationFormData>);
      }

      if (!convertedCoordinates) {
        return updateTargetCoordinates(prev, {
          [`${target}_mgrs`]: displayValue,
          [`${target}_latitude`]: "",
          [`${target}_longitude`]: "",
        } as Partial<OperationFormData>);
      }

      return updateTargetCoordinates(prev, {
        [`${target}_mgrs`]: displayValue,
        [`${target}_latitude`]: convertedCoordinates.latitude,
        [`${target}_longitude`]: convertedCoordinates.longitude,
      } as Partial<OperationFormData>);
    });

    setCoordinateErrors((prev) => ({
      ...prev,
      [target]: displayValue && !convertedCoordinates ? "Enter a valid MGRS reference." : "",
    }));
  };

  const handleAssetChange = (
    index: number,
    field: keyof OperationAsset,
    value: string,
  ) => {
    setAssets((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value ? Number(value) : null,
      };
      return next;
    });
  };

  const addAsset = () => {
    setAssets((prev) => [
      ...prev,
      { asset_id: 0, pilot_id: null, co_pilot_id: null, flight_hours: null },
    ]);
  };

  const removeAsset = (index: number) => {
    setAssets((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCoordinateSelect = (
    target: MapTarget,
    latitude: number,
    longitude: number,
  ) => {
    if (target === "waypoint") {
      setWaypoints((prev) => [
        ...prev,
        {
          name: "",
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        },
      ]);
      return;
    }

    setTargetFromLatLon(target, latitude.toFixed(6), longitude.toFixed(6));

    if (
      target === "departure" &&
      !formData.arrival_latitude &&
      !formData.arrival_longitude
    ) {
      setActiveMapTarget("arrival");
    }
  };

  const updateWaypoint = (
    index: number,
    patch: Partial<WaypointFormItem>,
  ) => {
    setWaypoints((prev) =>
      prev.map((waypoint, i) => (i === index ? { ...waypoint, ...patch } : waypoint)),
    );
  };

  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    setWaypoints((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addManualWaypoint = () => {
    setWaypoints((prev) => [
      ...prev,
      { name: "", latitude: "", longitude: "" },
    ]);
  };

  const openAddPersonnelModal = (assetIndex: number, role: "pilot_id" | "co_pilot_id") => {
    setAddPersonnelTarget({ assetIndex, role });
    setQuickAddForm({ call_sign: "" });
    setShowAddPersonnelModal(true);
  };

  const handleQuickAddPersonnel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!addPersonnelTarget) return;
    try {
      const created = await createPersonnel({
        firstname: "Nil",
        lastname: "Nil",
        call_sign: quickAddForm.call_sign.trim(),
        is_expatriate: true,
      }).unwrap();
      setQuickAddedPersonnel((prev) => [
        ...prev,
        { id: created.id, firstname: created.firstname, lastname: created.lastname, rank: created.rank, call_sign: created.call_sign },
      ]);
      setAssets((prev) => {
        const next = [...prev];
        next[addPersonnelTarget.assetIndex] = {
          ...next[addPersonnelTarget.assetIndex],
          [addPersonnelTarget.role]: created.id,
        };
        return next;
      });
      setShowAddPersonnelModal(false);
    } catch {
      // error surfaces via RTK default error handling
    }
  };

  const handleAddType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      const created = await createOperationType({
        name: newTypeName.trim(),
        description: newTypeDescription.trim() || null,
      }).unwrap();
      setFormData((prev) => ({
        ...prev,
        operation_type_id: String(created.id),
      }));
      setNewTypeName("");
      setNewTypeDescription("");
      setShowTypeModal(false);
    } catch {
      // error handled silently
    }
  };

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const created = await createOperationCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || null,
      }).unwrap();
      setFormData((prev) => ({
        ...prev,
        operation_category_id: String(created.id),
      }));
      setNewCategoryName("");
      setNewCategoryDescription("");
      setShowCategoryModal(false);
    } catch {
      // error handled silently; backend validation will surface via toast elsewhere
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const startDateTime = formData.start_date
      ? `${formData.start_date}T${formData.start_time}:00`
      : undefined;
    const endDateTime = formData.end_date
      ? `${formData.end_date}T${formData.end_time}:00`
      : formData.start_date
        ? `${formData.start_date}T${formData.end_time}:00`
        : undefined;

    const payload: CreateOperationRequest = {
      name: formData.name,
      unit_id: Number(formData.unit_id),
      operation_category_id: formData.operation_category_id
        ? Number(formData.operation_category_id)
        : undefined,
      operation_type_id: formData.operation_type_id
        ? Number(formData.operation_type_id)
        : undefined,
      start_date_time: startDateTime,
      end_date_time: endDateTime,
      departure_longitude: formData.departure_longitude
        ? Number(formData.departure_longitude)
        : undefined,
      departure_latitude: formData.departure_latitude
        ? Number(formData.departure_latitude)
        : undefined,
      arrival_longitude: formData.arrival_longitude
        ? Number(formData.arrival_longitude)
        : undefined,
      arrival_latitude: formData.arrival_latitude
        ? Number(formData.arrival_latitude)
        : undefined,
      priority: formData.priority,
      is_flight: formData.is_flight,
      status: formData.status,
      description: formData.description || undefined,
    };

    const validWaypoints: OperationWaypointInput[] = waypoints
      .map<OperationWaypointInput | null>((waypoint, index) => {
        const lat = Number(waypoint.latitude);
        const lng = Number(waypoint.longitude);
        if (!waypoint.latitude || !waypoint.longitude || Number.isNaN(lat) || Number.isNaN(lng)) {
          return null;
        }
        return {
          sequence: index + 1,
          name: waypoint.name.trim() || null,
          latitude: lat,
          longitude: lng,
        };
      })
      .filter((waypoint): waypoint is OperationWaypointInput => waypoint !== null);

    payload.waypoints = validWaypoints;

    const attachedAssets = assets.filter((asset) => asset.asset_id);

    if (attachedAssets.length === 0) {
      dispatch(
        showToast({
          message: "Attach at least one aircraft before submitting.",
          type: "error",
        }),
      );
      return;
    }

    const hasCrew = attachedAssets.some(
      (asset) => asset.pilot_id || asset.co_pilot_id,
    );

    if (!hasCrew) {
      dispatch(
        showToast({
          message: "Attach at least one personnel (pilot or co-pilot) before submitting.",
          type: "error",
        }),
      );
      return;
    }

    payload.operation_assets = attachedAssets.map((asset) => ({
      asset_id: asset.asset_id,
      pilot_id: asset.pilot_id ?? null,
      co_pilot_id: asset.co_pilot_id ?? null,
      flight_hours: asset.flight_hours ?? null,
    }));

    await onSubmit(payload);
  };

  const isFormDirty = Boolean(
    formData.name?.trim() ||
    formData.description?.trim() ||
    formData.departure_longitude?.trim() ||
    formData.arrival_longitude?.trim() ||
    assets.some((a) => a.asset_id > 0),
  );

  return (
    <div className="min-h-screen bg-[#001219] text-gray-200 flex flex-col">
      <div className="bg-[#0A4D66] px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/operations" isDirty={isFormDirty} />
          <h1 className="text-white font-bold text-lg uppercase tracking-wider">
            {pageTitle}
          </h1>
        </div>
        <CancelButton
          fallbackUrl="/dashboard/operations"
          isDirty={isFormDirty}
          label="Cancel & Exit"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        />
      </div>

      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
          <section>
            <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider mb-4 border-b border-[#0A4D66]/40 pb-2">
              Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400 font-medium">Operation Name</label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="flex items-center gap-1 text-xs text-[#7FD5FF] hover:text-white transition-colors"
                  >
                    <Icon icon="mdi:plus-circle-outline" className="w-3.5 h-3.5" />
                    Add New
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={formData.operation_category_id}
                    onChange={(e) =>
                      setFormData({ ...formData, operation_category_id: e.target.value })
                    }
                    title="Operation name"
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                  >
                    <option value="">Select Operation Name</option>
                    {operationCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Region</label>
                <div className="relative">
                  <select
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    title="Region"
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                    required
                  >
                    <option value="">Select Region</option>
                    <option value="North Central">North Central</option>
                    <option value="North East">North East</option>
                    <option value="North West">North West</option>
                    <option value="South East">South East</option>
                    <option value="South South">South South</option>
                    <option value="South West">South West</option>
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400 font-medium">Operation Type</label>
                  <button
                    type="button"
                    onClick={() => setShowTypeModal(true)}
                    className="flex items-center gap-1 text-xs text-[#7FD5FF] hover:text-white transition-colors"
                  >
                    <Icon icon="mdi:plus-circle-outline" className="w-3.5 h-3.5" />
                    Add New
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={formData.operation_type_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        operation_type_id: e.target.value,
                      })
                    }
                    title="Operation type"
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                    required
                  >
                    <option value="">Select Type</option>
                    {operationTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Unit</label>
                <div className="relative">
                  <select
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_id: e.target.value })
                    }
                    title="Unit"
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                    required
                  >
                    <option value="">Select Unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Operation Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  title="Operation date"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as OperationFormData["priority"],
                    })
                  }
                  title="Priority"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as OperationFormData["status"],
                    })
                  }
                  title="Status"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                >
                  <option value="planned">Planned</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="aborted">Aborted</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 justify-center">
                <label className="text-xs text-gray-400 font-medium">Is Flight</label>
                <label className="flex items-center gap-3 cursor-pointer h-11.5">
                  <input
                    type="checkbox"
                    checked={formData.is_flight}
                    onChange={(e) =>
                      setFormData({ ...formData, is_flight: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#7FD5FF]"
                  />
                  <span className="text-sm text-white">Flight Operation</span>
                </label>
              </div>

            </div>
          </section>

          <section>
            <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider mb-4 border-b border-[#0A4D66]/40 pb-2">
              Coordinates (Optional)
            </h2>
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#0A4D66]/30 bg-[#001219] p-2">
                <button
                  type="button"
                  onClick={() => setCoordinateInputMode("latlon")}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                    coordinateInputMode === "latlon"
                      ? "bg-[#0369A1] text-white"
                      : "bg-transparent text-gray-300 hover:bg-[#0A4D66]/40"
                  }`}
                >
                  Latitude / Longitude
                </button>
                <button
                  type="button"
                  onClick={() => setCoordinateInputMode("mgrs")}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                    coordinateInputMode === "mgrs"
                      ? "bg-[#0369A1] text-white"
                      : "bg-transparent text-gray-300 hover:bg-[#0A4D66]/40"
                  }`}
                >
                  MGRS
                </button>
                <span className="text-xs text-gray-400">
                  Choose how coordinates are entered. The map always uses the resolved latitude and longitude.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("departure")}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                    activeMapTarget === "departure"
                      ? "bg-[#0369A1] text-white"
                      : "bg-[#001219] text-gray-200 hover:bg-[#0A4D66]"
                  }`}
                >
                  Pick Departure
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("waypoint")}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                    activeMapTarget === "waypoint"
                      ? "bg-[#F59E0B] text-white"
                      : "bg-[#001219] text-gray-200 hover:bg-[#0A4D66]"
                  }`}
                >
                  Add Waypoint
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("arrival")}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                    activeMapTarget === "arrival"
                      ? "bg-[#0369A1] text-white"
                      : "bg-[#001219] text-gray-200 hover:bg-[#0A4D66]"
                  }`}
                >
                  Pick Arrival
                </button>
                <span className="text-xs text-gray-400">
                  Active target:{" "}
                  <span className="font-semibold uppercase text-[#7FD5FF]">
                    {activeMapTarget}
                  </span>
                </span>
              </div>

              <OperationLocationPicker
                activeTarget={activeMapTarget}
                departure={{
                  latitude: formData.departure_latitude,
                  longitude: formData.departure_longitude,
                }}
                arrival={{
                  latitude: formData.arrival_latitude,
                  longitude: formData.arrival_longitude,
                }}
                waypoints={waypoints.map((waypoint) => ({
                  name: waypoint.name,
                  latitude: waypoint.latitude,
                  longitude: waypoint.longitude,
                }))}
                onCoordinateSelect={handleCoordinateSelect}
              />

              <div className="rounded-lg border border-[#0A4D66]/30 bg-[#001219] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#7FD5FF]">
                      Waypoints / Checkpoints
                    </h3>
                    <p className="text-xs text-gray-400">
                      Stops the operation passes through, in order, between departure and arrival.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addManualWaypoint}
                    className="inline-flex items-center gap-2 rounded-sm bg-[#0A4D66] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#083c50] transition-colors"
                  >
                    <Icon icon="mdi:plus" className="h-4 w-4" />
                    Add manually
                  </button>
                </div>

                {waypoints.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No waypoints yet. Switch the active target to{" "}
                    <span className="font-semibold text-[#F59E0B]">Add Waypoint</span> and click on
                    the map, or add one manually.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {waypoints.map((waypoint, index) => (
                      <li
                        key={index}
                        className="grid grid-cols-1 gap-2 rounded border border-[#0A4D66]/30 bg-[#001219] p-3 md:grid-cols-[40px_1fr_1fr_1fr_auto] md:items-center"
                      >
                        <span className="text-xs font-semibold text-[#F59E0B]">
                          CP-{index + 1}
                        </span>
                        <input
                          type="text"
                          value={waypoint.name}
                          onChange={(e) => updateWaypoint(index, { name: e.target.value })}
                          placeholder="Name (optional)"
                          className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF]"
                        />
                        <input
                          type="number"
                          step="any"
                          min={-90}
                          max={90}
                          value={waypoint.latitude}
                          onChange={(e) => updateWaypoint(index, { latitude: e.target.value })}
                          placeholder="Latitude"
                          className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF]"
                        />
                        <input
                          type="number"
                          step="any"
                          min={-180}
                          max={180}
                          value={waypoint.longitude}
                          onChange={(e) => updateWaypoint(index, { longitude: e.target.value })}
                          placeholder="Longitude"
                          className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF]"
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => moveWaypoint(index, -1)}
                            disabled={index === 0}
                            title="Move up"
                            className="rounded p-1 text-gray-400 hover:bg-[#0A4D66]/40 hover:text-white disabled:opacity-30"
                          >
                            <Icon icon="mdi:arrow-up" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveWaypoint(index, 1)}
                            disabled={index === waypoints.length - 1}
                            title="Move down"
                            className="rounded p-1 text-gray-400 hover:bg-[#0A4D66]/40 hover:text-white disabled:opacity-30"
                          >
                            <Icon icon="mdi:arrow-down" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeWaypoint(index)}
                            title="Remove"
                            className="rounded p-1 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {coordinateInputMode === "latlon" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <input
                  type="number"
                  step="any"
                  placeholder="Departure Latitude (-90 to 90)"
                  value={formData.departure_latitude}
                  onChange={(e) =>
                    handleLatLonChange("departure", "latitude", e.target.value)
                  }
                  min={-90}
                  max={90}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Departure Longitude (-180 to 180)"
                  value={formData.departure_longitude}
                  onChange={(e) =>
                    handleLatLonChange("departure", "longitude", e.target.value)
                  }
                  min={-180}
                  max={180}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Arrival Latitude (-90 to 90)"
                  value={formData.arrival_latitude}
                  onChange={(e) =>
                    handleLatLonChange("arrival", "latitude", e.target.value)
                  }
                  min={-90}
                  max={90}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Arrival Longitude (-180 to 180)"
                  value={formData.arrival_longitude}
                  onChange={(e) =>
                    handleLatLonChange("arrival", "longitude", e.target.value)
                  }
                  min={-180}
                  max={180}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium">
                    Departure MGRS
                  </label>
                  <input
                    type="text"
                    placeholder="Example: 32NPH1234512345"
                    value={formData.departure_mgrs}
                    onChange={(e) => handleMgrsChange("departure", e.target.value)}
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm uppercase tracking-wide text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {coordinateErrors.departure ? (
                    <p className="text-xs text-[#FCA5A5]">{coordinateErrors.departure}</p>
                  ) : formData.departure_latitude && formData.departure_longitude ? (
                    <p className="text-xs text-gray-400">
                      Resolved to {formData.departure_latitude}, {formData.departure_longitude}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Enter an MGRS reference to place the departure marker.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium">
                    Arrival MGRS
                  </label>
                  <input
                    type="text"
                    placeholder="Example: 32NPH5432154321"
                    value={formData.arrival_mgrs}
                    onChange={(e) => handleMgrsChange("arrival", e.target.value)}
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm uppercase tracking-wide text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {coordinateErrors.arrival ? (
                    <p className="text-xs text-[#FCA5A5]">{coordinateErrors.arrival}</p>
                  ) : formData.arrival_latitude && formData.arrival_longitude ? (
                    <p className="text-xs text-gray-400">
                      Resolved to {formData.arrival_latitude}, {formData.arrival_longitude}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Enter an MGRS reference to place the arrival marker.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section>
              <div className="flex items-center gap-4 mb-4 border-b border-[#0A4D66]/40 pb-2">
                <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider">
                  Aircraft
                </h2>
                <button
                  type="button"
                  onClick={addAsset}
                  className="inline-flex items-center gap-2 rounded-sm bg-[#0A4D66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083c50] transition-colors"
                >
                  <Icon icon="mdi:plus-circle" className="h-4 w-4" />
                  Add Aircraft
                </button>
              </div>

              <div className="space-y-6">
                {assets.map((asset, index) => (
                  <div
                    key={index}
                    className="bg-[#001219]/50 p-4 rounded-lg border border-[#0A4D66]/20"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[#7FD5FF] text-xs font-bold uppercase">
                        AIRCRAFT {index + 1}
                      </h3>
                      {assets.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeAsset(index)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                          title="Remove aircraft"
                        >
                          <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Aircraft</label>
                        <select
                          value={asset.asset_id ?? 0}
                          onChange={(e) =>
                            handleAssetChange(index, "asset_id", e.target.value)
                          }
                          title={`Aircraft ${index + 1}`}
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                          required
                        >
                          <option value="0">Select Aircraft</option>
                          {aircraftOptions.map((aircraft) => (
                            <option
                              key={aircraft.asset_id ?? aircraft.id}
                              value={aircraft.asset_id ?? aircraft.id}
                            >
                              {aircraft.name} ({aircraft.tail_number || "-"})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-400 font-medium">Pilot in Command</label>
                          <button
                            type="button"
                            onClick={() => openAddPersonnelModal(index, "pilot_id")}
                            className="flex items-center gap-1 text-xs text-[#7FD5FF] hover:text-white transition-colors"
                          >
                            <Icon icon="mdi:plus-circle-outline" className="w-3.5 h-3.5" />
                            Add Personnel
                          </button>
                        </div>
                        <select
                          value={asset.pilot_id ?? ""}
                          onChange={(e) =>
                            handleAssetChange(index, "pilot_id", e.target.value)
                          }
                          title={`Pilot in command ${index + 1}`}
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        >
                          <option value="">Select Pilot</option>
                          {pilots.map((pilot) => (
                            <option key={pilot.id} value={pilot.id}>
                              {getPersonnelDisplayName(pilot)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-400 font-medium">Co-Pilot</label>
                          <button
                            type="button"
                            onClick={() => openAddPersonnelModal(index, "co_pilot_id")}
                            className="flex items-center gap-1 text-xs text-[#7FD5FF] hover:text-white transition-colors"
                          >
                            <Icon icon="mdi:plus-circle-outline" className="w-3.5 h-3.5" />
                            Add Personnel
                          </button>
                        </div>
                        <select
                          value={asset.co_pilot_id ?? ""}
                          onChange={(e) =>
                            handleAssetChange(index, "co_pilot_id", e.target.value)
                          }
                          title={`Co-pilot ${index + 1}`}
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        >
                          <option value="">Select Co-Pilot</option>
                          {pilots.map((pilot) => (
                            <option key={pilot.id} value={pilot.id}>
                              {getPersonnelDisplayName(pilot)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Flight Hours</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={asset.flight_hours ?? ""}
                          onChange={(e) =>
                            handleAssetChange(index, "flight_hours", e.target.value)
                          }
                          placeholder="e.g. 2.5"
                          title={`Flight hours ${index + 1}`}
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          <div className="mt-10 flex items-center justify-end gap-4 border-t border-[#0A4D66]/30 pt-8">
            <CancelButton
              fallbackUrl="/dashboard/operations"
              isDirty={isFormDirty}
              label="Cancel"
              variant="outline"
              size="md"
              className="h-14 px-8 text-base border-slate-600 text-gray-300 hover:bg-white/5"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-14 px-10 min-w-[200px] bg-[#0369A1] text-white text-lg font-semibold rounded hover:bg-[#0369A1]/90 transition-colors disabled:opacity-50 shadow-md"
            >
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>

      <Modal
        open={showTypeModal}
        onClose={() => {
          setShowTypeModal(false);
          setNewTypeName("");
          setNewTypeDescription("");
        }}
        title="Add Operation Type"
      >
        <form onSubmit={handleAddType} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">Name</label>
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g. Surveillance, Strike, Patrol"
              className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={newTypeDescription}
              onChange={(e) => setNewTypeDescription(e.target.value)}
              placeholder="Short description"
              rows={3}
              className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowTypeModal(false);
                setNewTypeName("");
                setNewTypeDescription("");
              }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingType || !newTypeName.trim()}
              className="px-5 py-2 bg-[#0369A1] text-white text-sm font-semibold rounded hover:bg-[#0369A1]/90 transition-colors disabled:opacity-50"
            >
              {isCreatingType ? "Adding..." : "Add Type"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setNewCategoryName("");
          setNewCategoryDescription("");
        }}
        title="Add Operation Category"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">Name</label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Combat, Logistics, Recon"
              className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">
              Description{" "}
              <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              placeholder="Short description"
              rows={3}
              className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowCategoryModal(false);
                setNewCategoryName("");
                setNewCategoryDescription("");
              }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingCategory || !newCategoryName.trim()}
              className="px-5 py-2 bg-[#0369A1] text-white text-sm font-semibold rounded hover:bg-[#0369A1]/90 transition-colors disabled:opacity-50"
            >
              {isCreatingCategory ? "Adding..." : "Add Category"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showAddPersonnelModal}
        onClose={() => setShowAddPersonnelModal(false)}
        title="Add Expatriate Personnel"
      >
        <form onSubmit={handleQuickAddPersonnel} className="space-y-4">
          <p className="text-xs text-gray-400">
            This person will be added as an expatriate and immediately available for selection.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">Call Sign</label>
            <input
              type="text"
              value={quickAddForm.call_sign}
              onChange={(e) => setQuickAddForm((prev) => ({ ...prev, call_sign: e.target.value }))}
              placeholder="e.g. JS01"
              className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowAddPersonnelModal(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingPersonnel || !quickAddForm.call_sign.trim()}
              className="px-5 py-2 bg-[#0369A1] text-white text-sm font-semibold rounded hover:bg-[#0369A1]/90 transition-colors disabled:opacity-50"
            >
              {isCreatingPersonnel ? "Adding..." : "Add Personnel"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};