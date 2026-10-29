import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
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
import { WeatherBriefingCard } from "./WeatherBriefingCard";
import { MissionPlanningCard, type MissionPlanningData } from "./MissionPlanningCard";
import { AeronauticalDatabaseModal } from "./AeronauticalDatabaseModal";
import { type AeronauticalPoint } from "../utils/navigationEngine";
import Modal from "@/shared/ui/modal/Modal";
import { BackButton, CancelButton } from "@/shared/ui/button";
import {
  decimalToDms,
  dmsToDecimal,
  latLonToMgrs,
  mgrsToLatLon,
  formatDecimal,
  isValidCoordinate,
  formatMgrsSpaced,
} from "../utils/coordinates";

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
  departure_dms_lat: string;
  departure_dms_lng: string;
  arrival_longitude: string;
  arrival_latitude: string;
  arrival_mgrs: string;
  arrival_dms_lat: string;
  arrival_dms_lng: string;
  priority: "low" | "medium" | "high";
  is_flight: boolean;
  status: "planned" | "completed" | "ongoing" | "aborted";
  description: string;
};

type CoordinateTarget = "departure" | "arrival";
type CoordinateAxis = "latitude" | "longitude";
type CoordinateInputMode = "latlon" | "mgrs" | "dms";
type CoordinateErrorState = Record<CoordinateTarget, string>;
type MapTarget = "departure" | "arrival" | "waypoint";

type WaypointFormItem = {
  name: string;
  latitude: string;
  longitude: string;
  mgrs: string;
  dms_lat: string;
  dms_lng: string;
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
  departure_dms_lat: "",
  departure_dms_lng: "",
  arrival_longitude: "",
  arrival_latitude: "",
  arrival_mgrs: "",
  arrival_dms_lat: "",
  arrival_dms_lng: "",
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

const formatAircraftAirframeLabel = (aircraft: {
  name?: string | null;
  tail_number?: string | null;
  asset_type?: { name?: string | null } | null;
}) => {
  const platform =
    aircraft.asset_type?.name ||
    (aircraft.name?.toLowerCase().includes("bell")
      ? "Bell UH-1H Helicopter"
      : aircraft.name?.toLowerCase().includes("magnus")
      ? "Magnus Fusion 212"
      : aircraft.name?.replace(/\s*\([^)]*\)/, "").trim()) ||
    "Aircraft Platform";
  const tailNumber = aircraft.tail_number?.trim();
  return tailNumber ? `${platform} → ${tailNumber}` : aircraft.name || platform;
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

const mapOperationToFormData = (operation: Operation): OperationFormData => {
  const depLat = formatDecimal(operation.departure_latitude);
  const depLng = formatDecimal(operation.departure_longitude);
  const arrLat = formatDecimal(operation.arrival_latitude);
  const arrLng = formatDecimal(operation.arrival_longitude);

  return {
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
    departure_latitude: depLat,
    departure_longitude: depLng,
    departure_mgrs: latLonToMgrs(depLat, depLng),
    departure_dms_lat: decimalToDms(depLat, true),
    departure_dms_lng: decimalToDms(depLng, false),
    arrival_latitude: arrLat,
    arrival_longitude: arrLng,
    arrival_mgrs: latLonToMgrs(arrLat, arrLng),
    arrival_dms_lat: decimalToDms(arrLat, true),
    arrival_dms_lng: decimalToDms(arrLng, false),
    priority: operation.priority,
    is_flight: Boolean(operation.is_flight),
    status: operation.status,
    description: operation.description ?? "",
  };
};

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
  const [missionPlan, setMissionPlan] = useState<MissionPlanningData | null>(null);
  const [coordinateInputMode, setCoordinateInputMode] =
    useState<CoordinateInputMode>("latlon");
  const [activeMapTarget, setActiveMapTarget] = useState<MapTarget>("departure");
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
          .map((w) => {
            const lat = formatDecimal(w.latitude);
            const lng = formatDecimal(w.longitude);
            return {
              name: w.name ?? "",
              latitude: lat,
              longitude: lng,
              mgrs: latLonToMgrs(lat, lng),
              dms_lat: decimalToDms(lat, true),
              dms_lng: decimalToDms(lng, false),
            };
          })
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
  const [quickAddedPersonnel, setQuickAddedPersonnel] = useState<
    Array<{
      id: number;
      firstname: string;
      lastname: string;
      rank?: { name?: string | null } | null;
      call_sign?: string | null;
    }>
  >([]);
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
  const submitLabel = isCreateMode ? "Save Operation" : "Save Changes";

  const pilots = useMemo(() => {
    const existingIds = new Set(personnel.map((p) => p.id));
    const extras = quickAddedPersonnel.filter((p) => !existingIds.has(p.id));
    return [...personnel, ...extras] as typeof personnel;
  }, [personnel, quickAddedPersonnel]);

  const selectedUnit = useMemo(() => {
    return units.find((u) => String(u.id) === formData.unit_id) ?? null;
  }, [units, formData.unit_id]);

  const handleUnitChange = (unitIdStr: string) => {
    const unitMatch = units.find((u) => String(u.id) === unitIdStr);
    setFormData((prev) => {
      const next = { ...prev, unit_id: unitIdStr };
      if (
        unitMatch &&
        unitMatch.latitude != null &&
        unitMatch.longitude != null &&
        (!prev.departure_latitude || !prev.departure_longitude)
      ) {
        const latStr = Number(unitMatch.latitude).toFixed(6);
        const lngStr = Number(unitMatch.longitude).toFixed(6);
        next.departure_latitude = latStr;
        next.departure_longitude = lngStr;
        next.departure_mgrs = latLonToMgrs(latStr, lngStr);
        next.departure_dms_lat = decimalToDms(Number(latStr), true);
        next.departure_dms_lng = decimalToDms(Number(lngStr), false);
      }
      return next;
    });
  };

  // Synchronized Coordinate Updates
  const setTargetFromLatLon = (
    target: CoordinateTarget,
    latitude: string,
    longitude: string,
  ) => {
    const mgrs = latLonToMgrs(latitude, longitude);
    const dmsLat = decimalToDms(latitude, true);
    const dmsLng = decimalToDms(longitude, false);

    setFormData((prev) => ({
      ...prev,
      [`${target}_latitude`]: latitude,
      [`${target}_longitude`]: longitude,
      [`${target}_mgrs`]: mgrs,
      [`${target}_dms_lat`]: dmsLat,
      [`${target}_dms_lng`]: dmsLng,
    }));
    setCoordinateErrors((prev) => ({ ...prev, [target]: "" }));
  };

  const [aeroModalTarget, setAeroModalTarget] = useState<"departure" | "arrival" | "waypoint" | null>(null);

  const handleSelectAeronauticalPoint = (point: AeronauticalPoint) => {
    const latStr = point.latitude.toFixed(6);
    const lngStr = point.longitude.toFixed(6);

    if (aeroModalTarget === "departure") {
      setTargetFromLatLon("departure", latStr, lngStr);
    } else if (aeroModalTarget === "arrival") {
      setTargetFromLatLon("arrival", latStr, lngStr);
    } else if (aeroModalTarget === "waypoint") {
      setWaypoints((prev) => [
        ...prev,
        {
          name: `${point.ident} - ${point.name}`,
          latitude: latStr,
          longitude: lngStr,
          mgrs: latLonToMgrs(latStr, lngStr),
          dms_lat: decimalToDms(point.latitude, true),
          dms_lng: decimalToDms(point.longitude, false),
        },
      ]);
    }
  };

  const handleLatLonChange = (
    target: CoordinateTarget,
    axis: CoordinateAxis,
    value: string,
  ) => {
    setFormData((prev) => {
      const nextLat = axis === "latitude" ? value : prev[`${target}_latitude`];
      const nextLng = axis === "longitude" ? value : prev[`${target}_longitude`];
      const mgrs = latLonToMgrs(nextLat, nextLng);
      const dmsLat = decimalToDms(nextLat, true);
      const dmsLng = decimalToDms(nextLng, false);

      return {
        ...prev,
        [`${target}_${axis}`]: value,
        [`${target}_mgrs`]: mgrs,
        [`${target}_dms_lat`]: dmsLat,
        [`${target}_dms_lng`]: dmsLng,
      };
    });
    setCoordinateErrors((prev) => ({ ...prev, [target]: "" }));
  };

  const handleMgrsChange = (target: CoordinateTarget, value: string) => {
    const clean = value.trim().toUpperCase();
    const point = mgrsToLatLon(clean);

    setFormData((prev) => {
      if (!clean) {
        return {
          ...prev,
          [`${target}_mgrs`]: "",
          [`${target}_latitude`]: "",
          [`${target}_longitude`]: "",
          [`${target}_dms_lat`]: "",
          [`${target}_dms_lng`]: "",
        };
      }

      if (!point) {
        return {
          ...prev,
          [`${target}_mgrs`]: clean,
        };
      }

      const latStr = point.latitude.toFixed(6);
      const lngStr = point.longitude.toFixed(6);

      return {
        ...prev,
        [`${target}_mgrs`]: clean,
        [`${target}_latitude`]: latStr,
        [`${target}_longitude`]: lngStr,
        [`${target}_dms_lat`]: decimalToDms(latStr, true),
        [`${target}_dms_lng`]: decimalToDms(lngStr, false),
      };
    });

    setCoordinateErrors((prev) => ({
      ...prev,
      [target]: clean && !point ? "Invalid MGRS coordinate (e.g. 32NPH1234512345)" : "",
    }));
  };

  const handleDmsChange = (
    target: CoordinateTarget,
    axis: CoordinateAxis,
    value: string,
  ) => {
    const isLat = axis === "latitude";
    const fieldName = `${target}_dms_${isLat ? "lat" : "lng"}` as const;

    setFormData((prev) => {
      const nextState = { ...prev, [fieldName]: value };
      const parsed = dmsToDecimal(value);

      if (parsed !== null) {
        const nextLat = isLat ? parsed.toFixed(6) : prev[`${target}_latitude`];
        const nextLng = !isLat ? parsed.toFixed(6) : prev[`${target}_longitude`];

        nextState[`${target}_${axis}`] = parsed.toFixed(6);
        if (isValidCoordinate(Number(nextLat), Number(nextLng))) {
          nextState[`${target}_mgrs`] = latLonToMgrs(nextLat, nextLng);
        }
      }

      return nextState;
    });
  };

  const handleCoordinateSelect = (
    target: MapTarget,
    latitude: number,
    longitude: number,
  ) => {
    const latStr = latitude.toFixed(6);
    const lngStr = longitude.toFixed(6);
    const mgrsStr = latLonToMgrs(latitude, longitude);
    const dmsLat = decimalToDms(latitude, true);
    const dmsLng = decimalToDms(longitude, false);

    if (target === "waypoint") {
      setWaypoints((prev) => [
        ...prev,
        {
          name: "",
          latitude: latStr,
          longitude: lngStr,
          mgrs: mgrsStr,
          dms_lat: dmsLat,
          dms_lng: dmsLng,
        },
      ]);

      // If destination is not yet selected, naturally advance to arrival/destination next
      if (!formData.arrival_latitude || !formData.arrival_longitude) {
        setActiveMapTarget("arrival");
      }
      return;
    }

    setTargetFromLatLon(target, latStr, lngStr);

    // If departure was just selected, naturally advance to arrival/destination next
    if (
      target === "departure" &&
      (!formData.arrival_latitude || !formData.arrival_longitude)
    ) {
      setActiveMapTarget("arrival");
    }
  };

  const handleWaypointMove = (
    index: number,
    latitude: number,
    longitude: number,
  ) => {
    const latStr = latitude.toFixed(6);
    const lngStr = longitude.toFixed(6);
    const mgrsStr = latLonToMgrs(latitude, longitude);
    const dmsLat = decimalToDms(latitude, true);
    const dmsLng = decimalToDms(longitude, false);

    setWaypoints((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          latitude: latStr,
          longitude: lngStr,
          mgrs: mgrsStr,
          dms_lat: dmsLat,
          dms_lng: dmsLng,
        };
      }),
    );
  };

  const handleDepartureMove = (latitude: number, longitude: number) => {
    const latStr = latitude.toFixed(6);
    const lngStr = longitude.toFixed(6);
    setTargetFromLatLon("departure", latStr, lngStr);
  };

  const handleArrivalMove = (latitude: number, longitude: number) => {
    const latStr = latitude.toFixed(6);
    const lngStr = longitude.toFixed(6);
    setTargetFromLatLon("arrival", latStr, lngStr);
  };

  const handleDepartureClear = () => {
    setFormData((prev) => ({
      ...prev,
      departure_latitude: "",
      departure_longitude: "",
      departure_mgrs: "",
      departure_dms_lat: "",
      departure_dms_lng: "",
    }));
    setCoordinateErrors((prev) => ({ ...prev, departure: "" }));
    setActiveMapTarget("departure");
  };

  const handleArrivalClear = () => {
    setFormData((prev) => ({
      ...prev,
      arrival_latitude: "",
      arrival_longitude: "",
      arrival_mgrs: "",
      arrival_dms_lat: "",
      arrival_dms_lng: "",
    }));
    setCoordinateErrors((prev) => ({ ...prev, arrival: "" }));
    setActiveMapTarget("arrival");
  };

  const updateWaypointLatLon = (
    index: number,
    axis: CoordinateAxis,
    val: string,
  ) => {
    setWaypoints((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const nextLat = axis === "latitude" ? val : item.latitude;
        const nextLng = axis === "longitude" ? val : item.longitude;
        return {
          ...item,
          [axis]: val,
          mgrs: latLonToMgrs(nextLat, nextLng),
          dms_lat: decimalToDms(nextLat, true),
          dms_lng: decimalToDms(nextLng, false),
        };
      }),
    );
  };

  const updateWaypointMgrs = (index: number, val: string) => {
    const clean = val.trim().toUpperCase();
    const point = mgrsToLatLon(clean);

    setWaypoints((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (!point) {
          return { ...item, mgrs: clean };
        }
        const latStr = point.latitude.toFixed(6);
        const lngStr = point.longitude.toFixed(6);
        return {
          ...item,
          mgrs: clean,
          latitude: latStr,
          longitude: lngStr,
          dms_lat: decimalToDms(latStr, true),
          dms_lng: decimalToDms(lngStr, false),
        };
      }),
    );
  };

  const updateWaypointDms = (
    index: number,
    axis: CoordinateAxis,
    val: string,
  ) => {
    const isLat = axis === "latitude";
    setWaypoints((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const parsed = dmsToDecimal(val);
        const nextDmsLat = isLat ? val : item.dms_lat;
        const nextDmsLng = !isLat ? val : item.dms_lng;

        if (parsed !== null) {
          const nextLat = isLat ? parsed.toFixed(6) : item.latitude;
          const nextLng = !isLat ? parsed.toFixed(6) : item.longitude;
          return {
            ...item,
            dms_lat: nextDmsLat,
            dms_lng: nextDmsLng,
            latitude: nextLat,
            longitude: nextLng,
            mgrs: latLonToMgrs(nextLat, nextLng),
          };
        }
        return { ...item, dms_lat: nextDmsLat, dms_lng: nextDmsLng };
      }),
    );
  };

  const updateWaypointName = (index: number, name: string) => {
    setWaypoints((prev) =>
      prev.map((item, i) => (i === index ? { ...item, name } : item)),
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
      {
        name: "",
        latitude: "",
        longitude: "",
        mgrs: "",
        dms_lat: "",
        dms_lng: "",
      },
    ]);
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

  const openAddPersonnelModal = (
    assetIndex: number,
    role: "pilot_id" | "co_pilot_id",
  ) => {
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
        {
          id: created.id,
          firstname: created.firstname,
          lastname: created.lastname,
          rank: created.rank,
          call_sign: created.call_sign,
        },
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
      // RTK Query surfaces error
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
      // handled silently
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
      // handled silently
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

    const planningHeader = missionPlan
      ? `[PLAN: ${missionPlan.totalDistanceNm} NM | ${missionPlan.totalFuelLiters}L Jet A-1 Fuel | TOW ${missionPlan.takeoffWeightKg}kg / MTOW ${missionPlan.maxTakeoffWeightKg}kg | Config: ${missionPlan.equipmentConfig}]`
      : "";

    const combinedDescription = [planningHeader, formData.description]
      .filter(Boolean)
      .join("\n\n");

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
      description: combinedDescription || undefined,
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
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/operations" isDirty={isFormDirty} />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {pageTitle}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CancelButton fallbackUrl="/dashboard/operations" isDirty={isFormDirty} label="Cancel" size="md" />
          <button
            type="submit"
            form="operation-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0369A1] hover:bg-[#025682] text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Icon icon="mdi:check-circle-outline" className="w-4 h-4" />
            <span>{isSubmitting ? "Saving..." : submitLabel}</span>
          </button>
        </div>
      </div>

      <form id="operation-form" onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Mission Overview & Classification */}
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
              <span>1. Mission Overview &amp; Classification</span>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0A4D66]/30 text-[#7FD5FF] border border-[#0A4D66]/60">
              Status: {formData.status.toUpperCase()}
            </span>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Category / Operation Name */}
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
                    required
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

              {/* Region */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Theater Region</label>
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

              {/* Operation Type */}
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

              {/* Unit */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Tasked Unit</label>
                <div className="relative">
                  <select
                    value={formData.unit_id}
                    onChange={(e) => handleUnitChange(e.target.value)}
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

              {/* Operation Date */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Operation Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  title="Operation date"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                  required
                />
              </div>

              {/* Start Time */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Estimated Departure Time (ZULU/Local)</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  title="Start time"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                />
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Priority Level</label>
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
                  <option value="high">High (Urgent Operational Requirement)</option>
                </select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Initial Status</label>
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

              {/* Flight Operation Checkbox */}
              <div className="flex flex-col gap-2 justify-center">
                <label className="text-xs text-gray-400 font-medium">Sortie Type</label>
                <label className="flex items-center gap-3 cursor-pointer h-11.5 bg-[#001825] px-4 rounded border border-[#0A4D66]/30">
                  <input
                    type="checkbox"
                    checked={formData.is_flight}
                    onChange={(e) =>
                      setFormData({ ...formData, is_flight: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#7FD5FF]"
                  />
                  <span className="text-sm text-white font-medium">Aviation Flight Sortie</span>
                </label>
              </div>
            </div>

            {/* Mission Description */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-medium">
                Mission Brief &amp; Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                placeholder="Outline operational objectives, tactical rules of engagement, or call signs..."
                className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600 resize-none"
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: Route, Navigation & Real-Time Weather Briefing */}
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
              <span>2. Route, Navigation &amp; Weather Briefing</span>
            </div>

            {/* Coordinate Mode Selector */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-[#0A4D66]/50 bg-slate-100 dark:bg-[#001825] p-1">
              <button
                type="button"
                onClick={() => setCoordinateInputMode("latlon")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  coordinateInputMode === "latlon"
                    ? "bg-[#0369A1] text-white"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Decimal (DD)
              </button>
              <button
                type="button"
                onClick={() => setCoordinateInputMode("mgrs")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  coordinateInputMode === "mgrs"
                    ? "bg-[#0369A1] text-white"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                MGRS Grid
              </button>
              <button
                type="button"
                onClick={() => setCoordinateInputMode("dms")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  coordinateInputMode === "dms"
                    ? "bg-[#0369A1] text-white"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                DMS (Deg/Min/Sec)
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Map Target Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Map Pointer Target:</span>
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("departure")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    activeMapTarget === "departure"
                      ? "bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)] ring-1 ring-white/20"
                      : "bg-[#001825] text-gray-300 hover:bg-[#0A4D66]/40"
                  }`}
                >
                  Pick Departure Point
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("waypoint")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    activeMapTarget === "waypoint"
                      ? "bg-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.5)] ring-1 ring-white/20"
                      : "bg-[#001825] text-gray-300 hover:bg-[#0A4D66]/40"
                  }`}
                >
                  + Click Map for Waypoint
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("arrival")}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    activeMapTarget === "arrival"
                      ? "bg-red-600 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)] ring-1 ring-white/20"
                      : "bg-[#001825] text-gray-300 hover:bg-[#0A4D66]/40"
                  }`}
                >
                  Pick Arrival Point
                </button>
              </div>

              <div className="text-xs text-gray-400">
                Target active:{" "}
                <span className="font-bold uppercase text-[#7FD5FF]">
                  {activeMapTarget}
                </span>
              </div>
            </div>

            {/* Interactive Leaflet Map */}
            <OperationLocationPicker
              activeTarget={activeMapTarget}
              onTargetChange={setActiveMapTarget}
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
              onWaypointMove={handleWaypointMove}
              onWaypointDelete={removeWaypoint}
              onWaypointRename={updateWaypointName}
              onDepartureMove={handleDepartureMove}
              onArrivalMove={handleArrivalMove}
              onDepartureClear={handleDepartureClear}
              onArrivalClear={handleArrivalClear}
            />

            {/* Departure and Arrival Coordinate Inputs */}
            <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825]/60 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A4D66]/30 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#7FD5FF]">
                    Flight Aerodrome Endpoints
                  </h3>
                  <span className="text-[11px] text-gray-400">
                    Mode: {coordinateInputMode.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUnit && selectedUnit.latitude != null && selectedUnit.longitude != null && (
                    <button
                      type="button"
                      onClick={() => {
                        const latStr = Number(selectedUnit.latitude).toFixed(6);
                        const lngStr = Number(selectedUnit.longitude).toFixed(6);
                        setTargetFromLatLon("departure", latStr, lngStr);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/70 bg-transparent hover:bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 hover:text-white hover:border-amber-400 transition-all cursor-pointer shadow-sm"
                      title={`Set Departure to ${selectedUnit.name} Base Coordinates`}
                    >
                      <Icon icon="mdi:map-marker-radius" className="w-4 h-4 text-amber-400" />
                      <span>{selectedUnit.name} Base (Take-off)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAeroModalTarget("departure")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#0284C7] bg-transparent hover:bg-[#0284C7]/15 px-3 py-1.5 text-xs font-medium text-[#38BDF8] hover:text-white hover:border-[#38BDF8] transition-all cursor-pointer shadow-sm"
                    title="Select Departure Aerodrome from Database"
                  >
                    <Icon icon="mdi:airplane-takeoff" className="w-4 h-4 text-[#38BDF8]" />
                    <span>DEP Database Fix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAeroModalTarget("arrival")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/70 bg-transparent hover:bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-white hover:border-emerald-400 transition-all cursor-pointer shadow-sm"
                    title="Select Arrival Aerodrome from Database"
                  >
                    <Icon icon="mdi:airplane-landing" className="w-4 h-4 text-emerald-400" />
                    <span>ARR Database Fix</span>
                  </button>
                </div>
              </div>

              {coordinateInputMode === "latlon" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Departure Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 9.0067"
                      value={formData.departure_latitude}
                      onChange={(e) =>
                        handleLatLonChange("departure", "latitude", e.target.value)
                      }
                      min={-90}
                      max={90}
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Departure Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 7.2631"
                      value={formData.departure_longitude}
                      onChange={(e) =>
                        handleLatLonChange("departure", "longitude", e.target.value)
                      }
                      min={-180}
                      max={180}
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Arrival Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 11.8369"
                      value={formData.arrival_latitude}
                      onChange={(e) =>
                        handleLatLonChange("arrival", "latitude", e.target.value)
                      }
                      min={-90}
                      max={90}
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Arrival Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 13.1500"
                      value={formData.arrival_longitude}
                      onChange={(e) =>
                        handleLatLonChange("arrival", "longitude", e.target.value)
                      }
                      min={-180}
                      max={180}
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                </div>
              )}

              {coordinateInputMode === "mgrs" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400 font-medium">
                      Departure MGRS 10-Figure Grid
                    </label>
                    <input
                      type="text"
                      placeholder="Example: 32NPH1234512345"
                      value={formData.departure_mgrs}
                      onChange={(e) => handleMgrsChange("departure", e.target.value)}
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs uppercase tracking-wider text-white focus:outline-none focus:border-[#7FD5FF] font-mono"
                    />
                    {coordinateErrors.departure ? (
                      <p className="text-xs text-red-400">{coordinateErrors.departure}</p>
                    ) : formData.departure_latitude && formData.departure_longitude ? (
                      <p className="text-[11px] text-[#7FD5FF]">
                        Resolved: {formData.departure_latitude}°, {formData.departure_longitude}° (
                        {formatMgrsSpaced(formData.departure_mgrs)})
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400 font-medium">
                      Arrival MGRS 10-Figure Grid
                    </label>
                    <input
                      type="text"
                      placeholder="Example: 33PVP1676608542"
                      value={formData.arrival_mgrs}
                      onChange={(e) => handleMgrsChange("arrival", e.target.value)}
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs uppercase tracking-wider text-white focus:outline-none focus:border-[#7FD5FF] font-mono"
                    />
                    {coordinateErrors.arrival ? (
                      <p className="text-xs text-red-400">{coordinateErrors.arrival}</p>
                    ) : formData.arrival_latitude && formData.arrival_longitude ? (
                      <p className="text-[11px] text-[#7FD5FF]">
                        Resolved: {formData.arrival_latitude}°, {formData.arrival_longitude}° (
                        {formatMgrsSpaced(formData.arrival_mgrs)})
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {coordinateInputMode === "dms" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Departure Lat (DMS)</label>
                    <input
                      type="text"
                      placeholder={`09° 00' 24" N`}
                      value={formData.departure_dms_lat}
                      onChange={(e) =>
                        handleDmsChange("departure", "latitude", e.target.value)
                      }
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Departure Lng (DMS)</label>
                    <input
                      type="text"
                      placeholder={`007° 15' 47" E`}
                      value={formData.departure_dms_lng}
                      onChange={(e) =>
                        handleDmsChange("departure", "longitude", e.target.value)
                      }
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Arrival Lat (DMS)</label>
                    <input
                      type="text"
                      placeholder={`11° 50' 12" N`}
                      value={formData.arrival_dms_lat}
                      onChange={(e) =>
                        handleDmsChange("arrival", "latitude", e.target.value)
                      }
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Arrival Lng (DMS)</label>
                    <input
                      type="text"
                      placeholder={`013° 09' 00" E`}
                      value={formData.arrival_dms_lng}
                      onChange={(e) =>
                        handleDmsChange("arrival", "longitude", e.target.value)
                      }
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF] font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Waypoints & Checkpoints Table */}
            <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825]/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#0A4D66]/30 pb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#7FD5FF]">
                    Tactical Waypoints &amp; Enroute Checkpoints
                  </h3>
                  <p className="text-xs text-gray-400">
                    Sequential navigation fixes plotted along the corridor.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAeroModalTarget("waypoint")}
                    className="inline-flex items-center gap-1.5 rounded bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0284c7] transition-colors"
                  >
                    <Icon icon="mdi:radar" className="h-4 w-4" />
                    <span>+ From Aeronautical DB</span>
                  </button>
                  <button
                    type="button"
                    onClick={addManualWaypoint}
                    className="inline-flex items-center gap-1.5 rounded bg-[#0A4D66] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#083c50] transition-colors"
                  >
                    <Icon icon="mdi:plus" className="h-4 w-4" />
                    <span>Add Waypoint</span>
                  </button>
                </div>
              </div>

              {waypoints.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">
                  No enroute checkpoints added yet. Click &ldquo;+ Click Map for Waypoint&rdquo; on the map above or click &ldquo;Add Waypoint&rdquo;.
                </p>
              ) : (
                <ul className="space-y-2">
                  {waypoints.map((waypoint, index) => (
                    <li
                      key={index}
                      className="grid grid-cols-1 gap-2 rounded border border-[#0A4D66]/40 bg-[#001219] p-3 lg:grid-cols-[55px_1fr_1.5fr_1.5fr_auto] lg:items-center"
                    >
                      <span className="text-xs font-bold text-[#F59E0B]">
                        CP-{index + 1}
                      </span>

                      <input
                        type="text"
                        value={waypoint.name}
                        onChange={(e) => updateWaypointName(index, e.target.value)}
                        placeholder="Fix/Name (e.g. LZ Alpha)"
                        className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF]"
                      />

                      {coordinateInputMode === "latlon" && (
                        <>
                          <input
                            type="number"
                            step="any"
                            value={waypoint.latitude}
                            onChange={(e) =>
                              updateWaypointLatLon(index, "latitude", e.target.value)
                            }
                            placeholder="Latitude"
                            className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF]"
                          />
                          <input
                            type="number"
                            step="any"
                            value={waypoint.longitude}
                            onChange={(e) =>
                              updateWaypointLatLon(index, "longitude", e.target.value)
                            }
                            placeholder="Longitude"
                            className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF]"
                          />
                        </>
                      )}

                      {coordinateInputMode === "mgrs" && (
                        <div className="lg:col-span-2 space-y-1">
                          <input
                            type="text"
                            value={waypoint.mgrs}
                            onChange={(e) => updateWaypointMgrs(index, e.target.value)}
                            placeholder="MGRS 10-Figure Grid (e.g. 32NPH1234512345)"
                            className="w-full rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs uppercase tracking-wider text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] font-mono"
                          />
                          {waypoint.latitude && waypoint.longitude && (
                            <span className="text-[10px] text-gray-400">
                              Lat/Lon: {waypoint.latitude}°, {waypoint.longitude}°
                            </span>
                          )}
                        </div>
                      )}

                      {coordinateInputMode === "dms" && (
                        <>
                          <input
                            type="text"
                            value={waypoint.dms_lat}
                            onChange={(e) =>
                              updateWaypointDms(index, "latitude", e.target.value)
                            }
                            placeholder={`Lat DMS (09° 00' 00" N)`}
                            className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] font-mono"
                          />
                          <input
                            type="text"
                            value={waypoint.dms_lng}
                            onChange={(e) =>
                              updateWaypointDms(index, "longitude", e.target.value)
                            }
                            placeholder={`Lng DMS (007° 15' 00" E)`}
                            className="rounded border border-[#0A4D66]/40 bg-[#001219] p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] font-mono"
                          />
                        </>
                      )}

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

            {/* Operational Route Leg Breakdown */}
            <div className="pt-4 border-t border-slate-200 dark:border-[#0A4D66]/40 space-y-3">
              <MissionPlanningCard
                variant="all"
                departureLat={formData.departure_latitude}
                departureLng={formData.departure_longitude}
                arrivalLat={formData.arrival_latitude}
                arrivalLng={formData.arrival_longitude}
                waypoints={waypoints}
                unitId={formData.unit_id}
                operationName={formData.name}
                operationDate={formData.start_date}
                aircraftCount={assets.length || 1}
                isEditable={true}
                onPlanningChange={setMissionPlan}
              />
            </div>

            {/* Integrated Real-Time Pre-Flight Weather Briefing */}
            <div className="pt-4 border-t border-slate-200 dark:border-[#0A4D66]/40 space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#7FD5FF]">
                  Real-Time Pre-Flight Weather Briefing
                </h3>
                <p className="text-xs text-gray-400">
                  Live aerodrome METAR observations, wind vectors, and flight categories linked directly to your route coordinates.
                </p>
              </div>

              {formData.departure_latitude && formData.departure_longitude ? (
                <WeatherBriefingCard
                  departureLat={formData.departure_latitude}
                  departureLon={formData.departure_longitude}
                  arrivalLat={formData.arrival_latitude || undefined}
                  arrivalLon={formData.arrival_longitude || undefined}
                  flightDate={formData.start_date}
                  flightTime={formData.start_time}
                  onSelectDepartureAirport={(airport) => {
                    handleDepartureMove(airport.lat, airport.lon);
                  }}
                  onSelectArrivalAirport={(airport) => {
                    handleArrivalMove(airport.lat, airport.lon);
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-dashed border-[#0A4D66]/60 bg-[#001825]/40 p-4 text-xs text-gray-400">
                    Showing Command Headquarters (DNAA Abuja) and Operations Hub (DNMA Maiduguri) METAR baseline for{" "}
                    <span className="text-[#7FD5FF] font-semibold">{formData.start_date || "selected date"}</span>.
                    Plot departure and arrival points on the map above, or use the search field below to check weather at Lagos, Kaduna, or any airfield.
                  </div>
                  <WeatherBriefingCard
                    stations="DNAA,DNMA"
                    flightDate={formData.start_date}
                    flightTime={formData.start_time}
                    onSelectDepartureAirport={(airport) => {
                      handleDepartureMove(airport.lat, airport.lon);
                    }}
                    onSelectArrivalAirport={(airport) => {
                      handleArrivalMove(airport.lat, airport.lon);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 3: Aircraft & Flight Crew Allocation with Integrated Fuel Calculation */}
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
                3. Aircraft &amp; Flight Crew Allocation
              </span>
              <span className="rounded bg-[#0A4D66]/40 px-2 py-0.5 text-[11px] font-semibold text-[#7FD5FF]">
                {assets.length} Airframe Sortie{assets.length > 1 ? "s" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={addAsset}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A4D66] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#083c50] transition-colors"
            >
              <Icon icon="mdi:plus-circle" className="h-4 w-4" />
              <span>Add Airframe Sortie</span>
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Airframe Sortie Assignments */}
            <div className="space-y-4">
              {assets.map((asset, index) => (
                <div
                  key={index}
                  className="bg-[#001825] p-5 rounded-xl border border-[#0A4D66]/30 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#0A4D66]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="mdi:helicopter" className="w-4 h-4 text-[#7FD5FF]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#7FD5FF]">
                        Airframe Sortie #{index + 1}
                      </h3>
                      {missionPlan?.estimatedFlightHours ? (
                        <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
                          • Route ETE: ~{missionPlan.estimatedFlightHours}h • Req. Fuel: ~{missionPlan.totalFuelLiters} L
                        </span>
                      ) : null}
                    </div>
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

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Aircraft Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-gray-400 font-medium">Aircraft Airframe</label>
                      <select
                        value={asset.asset_id ?? 0}
                        onChange={(e) =>
                          handleAssetChange(index, "asset_id", e.target.value)
                        }
                        title={`Aircraft ${index + 1}`}
                        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                        required
                      >
                        <option value="0">Select Aircraft</option>
                        {aircraftOptions.map((aircraft) => (
                          <option
                            key={aircraft.asset_id ?? aircraft.id}
                            value={aircraft.asset_id ?? aircraft.id}
                          >
                            {formatAircraftAirframeLabel(aircraft)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pilot in Command */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400 font-medium">Pilot in Command (PIC)</label>
                        <button
                          type="button"
                          onClick={() => openAddPersonnelModal(index, "pilot_id")}
                          className="flex items-center gap-1 text-[11px] text-[#7FD5FF] hover:text-white transition-colors"
                        >
                          <Icon icon="mdi:plus-circle-outline" className="w-3 h-3" />
                          Quick-Add
                        </button>
                      </div>
                      <select
                        value={asset.pilot_id ?? ""}
                        onChange={(e) =>
                          handleAssetChange(index, "pilot_id", e.target.value)
                        }
                        title={`Pilot in command ${index + 1}`}
                        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                      >
                        <option value="">Select Pilot</option>
                        {pilots.map((pilot) => (
                          <option key={pilot.id} value={pilot.id}>
                            {getPersonnelDisplayName(pilot)}
                            {pilot.rating_type ? ` [${pilot.rating_type}]` : ""}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const selectedAircraft = aircraftOptions.find(
                          (a) => (a.asset_id ?? a.id) === Number(asset.asset_id)
                        );
                        const selectedPilot = pilots.find(
                          (p) => p.id === Number(asset.pilot_id)
                        );
                        if (!selectedAircraft || !selectedPilot) return null;
                        const platform =
                          selectedAircraft.asset_type?.name ||
                          (selectedAircraft.name?.toLowerCase().includes("bell")
                            ? "Bell UH-1H Helicopter"
                            : selectedAircraft.name?.toLowerCase().includes("magnus")
                            ? "Magnus Fusion 212"
                            : "");
                        const isRated =
                          selectedPilot.rating_type && platform
                            ? selectedPilot.rating_type
                                .toLowerCase()
                                .includes(platform.toLowerCase()) ||
                              (platform.toLowerCase().includes("bell") &&
                                selectedPilot.rating_type
                                  .toLowerCase()
                                  .includes("bell"))
                            : false;
                        return isRated ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                            <Icon icon="mdi:check-decagram" className="w-3 h-3" />
                            Type-Rated on {platform}
                          </span>
                        ) : selectedPilot.rating_type ? (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                            <Icon icon="mdi:alert-circle-outline" className="w-3 h-3" />
                            Rated: {selectedPilot.rating_type}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    {/* Co-Pilot */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400 font-medium">Co-Pilot / Gunner</label>
                        <button
                          type="button"
                          onClick={() => openAddPersonnelModal(index, "co_pilot_id")}
                          className="flex items-center gap-1 text-[11px] text-[#7FD5FF] hover:text-white transition-colors"
                        >
                          <Icon icon="mdi:plus-circle-outline" className="w-3 h-3" />
                          Quick-Add
                        </button>
                      </div>
                      <select
                        value={asset.co_pilot_id ?? ""}
                        onChange={(e) =>
                          handleAssetChange(index, "co_pilot_id", e.target.value)
                        }
                        title={`Co-pilot ${index + 1}`}
                        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                      >
                        <option value="">Select Co-Pilot</option>
                        {pilots.map((pilot) => (
                          <option key={pilot.id} value={pilot.id}>
                            {getPersonnelDisplayName(pilot)}
                            {pilot.rating_type ? ` [${pilot.rating_type}]` : ""}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const selectedAircraft = aircraftOptions.find(
                          (a) => (a.asset_id ?? a.id) === Number(asset.asset_id)
                        );
                        const selectedCoPilot = pilots.find(
                          (p) => p.id === Number(asset.co_pilot_id)
                        );
                        if (!selectedAircraft || !selectedCoPilot) return null;
                        const platform =
                          selectedAircraft.asset_type?.name ||
                          (selectedAircraft.name?.toLowerCase().includes("bell")
                            ? "Bell UH-1H Helicopter"
                            : selectedAircraft.name?.toLowerCase().includes("magnus")
                            ? "Magnus Fusion 212"
                            : "");
                        const isRated =
                          selectedCoPilot.rating_type && platform
                            ? selectedCoPilot.rating_type
                                .toLowerCase()
                                .includes(platform.toLowerCase()) ||
                              (platform.toLowerCase().includes("bell") &&
                                selectedCoPilot.rating_type
                                  .toLowerCase()
                                  .includes("bell"))
                            : false;
                        return isRated ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                            <Icon icon="mdi:check-decagram" className="w-3 h-3" />
                            Type-Rated on {platform}
                          </span>
                        ) : selectedCoPilot.rating_type ? (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                            <Icon icon="mdi:alert-circle-outline" className="w-3 h-3" />
                            Rated: {selectedCoPilot.rating_type}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    {/* Estimated Flight Hours */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400 font-medium">Est. Flight Hours</label>
                        {missionPlan?.estimatedFlightHours && !asset.flight_hours ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleAssetChange(
                                index,
                                "flight_hours",
                                String(missionPlan.estimatedFlightHours)
                              )
                            }
                            className="text-[11px] text-[#7FD5FF] hover:text-white transition-colors"
                            title="Auto-fill with route flight hours"
                          >
                            Use ETE ({missionPlan.estimatedFlightHours}h)
                          </button>
                        ) : null}
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={asset.flight_hours ?? ""}
                        onChange={(e) =>
                          handleAssetChange(index, "flight_hours", e.target.value)
                        }
                        placeholder={
                          missionPlan?.estimatedFlightHours
                            ? `e.g. ${missionPlan.estimatedFlightHours}`
                            : "e.g. 2.5"
                        }
                        title={`Flight hours ${index + 1}`}
                        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Persistent Form Footer with Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#0A4D66]/30">
          <CancelButton
            fallbackUrl="/dashboard/operations"
            isDirty={isFormDirty}
            label="Cancel"
            variant="outline"
            size="md"
            className="h-11 px-6 text-sm border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 px-8 min-w-[200px] bg-[#0369A1] hover:bg-[#025682] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-md inline-flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Saving Operation...</span>
              </>
            ) : (
              <>
                <Icon icon="mdi:content-save-outline" className="w-4 h-4" />
                <span>{submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal: Add Operation Type */}
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

      {/* Modal: Add Operation Category */}
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
              Description <span className="text-gray-600">(optional)</span>
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

      {/* Modal: Quick Add Expatriate Personnel */}
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

      <AeronauticalDatabaseModal
        isOpen={Boolean(aeroModalTarget)}
        onClose={() => setAeroModalTarget(null)}
        onSelectPoint={handleSelectAeronauticalPoint}
        title={
          aeroModalTarget === "departure"
            ? "Select Departure Aerodrome / Air Base"
            : aeroModalTarget === "arrival"
            ? "Select Arrival Aerodrome / Air Base"
            : "Select Aeronautical Waypoint / Tactical LZ"
        }
      />
    </div>
  );
};