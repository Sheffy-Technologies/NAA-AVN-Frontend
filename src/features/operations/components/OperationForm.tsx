import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import {
  useGetOperationTypesQuery,
  type CreateOperationRequest,
  type Operation,
  type OperationAsset,
} from "../api";
import { OperationLocationPicker } from "./OperationLocationPicker";

type OperationFormMode = "create" | "edit";

type OperationFormData = {
  name: string;
  operation_type_id: string;
  unit_id: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  departure_longitude: string;
  departure_latitude: string;
  arrival_longitude: string;
  arrival_latitude: string;
  priority: "low" | "medium" | "high";
  is_flight: boolean;
  status: "planned" | "completed" | "ongoing" | "aborted";
  description: string;
};

type OperationFormProps = {
  mode: OperationFormMode;
  initialOperation?: Operation | null;
  onSubmit: (payload: CreateOperationRequest) => Promise<void>;
  isSubmitting: boolean;
};

const emptyFormData: OperationFormData = {
  name: "",
  operation_type_id: "",
  unit_id: "",
  start_date: "",
  start_time: "00:00",
  end_date: "",
  end_time: "00:00",
  departure_longitude: "",
  departure_latitude: "",
  arrival_longitude: "",
  arrival_latitude: "",
  priority: "medium",
  is_flight: true,
  status: "planned",
  description: "",
};

const getPersonnelDisplayName = (person: {
  firstname?: string | null;
  lastname?: string | null;
  rank?: { name?: string | null } | null;
}) => {
  const rankName = person.rank?.name?.trim();
  const firstName = person.firstname?.trim() ?? "";
  const lastName = person.lastname?.trim() ?? "";
  return `${rankName ? `${rankName} ` : ""}${firstName} ${lastName}`.trim();
};

const formatCoordinate = (value?: number | null) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? ""
    : Number(value).toFixed(6);

const extractDate = (value?: string | null) => {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const extractTime = (value?: string | null) => {
  if (!value) return "00:00";
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "00:00";
};

const mapOperationToFormData = (operation: Operation): OperationFormData => ({
  name: operation.name ?? "",
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
  arrival_longitude: formatCoordinate(operation.arrival_longitude),
  arrival_latitude: formatCoordinate(operation.arrival_latitude),
  priority: operation.priority,
  is_flight: Boolean(operation.is_flight),
  status: operation.status,
  description: operation.description ?? "",
});

export const OperationForm = ({
  mode,
  initialOperation,
  onSubmit,
  isSubmitting,
}: OperationFormProps) => {
  const navigate = useNavigate();
  const [activeMapTarget, setActiveMapTarget] = useState<"departure" | "arrival">(
    "departure",
  );
  const [formData, setFormData] = useState<OperationFormData>(
    initialOperation ? mapOperationToFormData(initialOperation) : emptyFormData,
  );
  const [assets, setAssets] = useState<OperationAsset[]>([
    { asset_id: 0, pilot_id: null, co_pilot_id: null },
  ]);

  const { data: units = [] } = useGetUnitsQuery();
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
  const pilots = personnel;

  useEffect(() => {
    if (initialOperation) {
      setFormData(mapOperationToFormData(initialOperation));
    }
  }, [initialOperation]);

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
      { asset_id: 0, pilot_id: null, co_pilot_id: null },
    ]);
  };

  const removeAsset = (index: number) => {
    setAssets((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCoordinateSelect = (
    target: "departure" | "arrival",
    latitude: number,
    longitude: number,
  ) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [`${target}_latitude`]: latitude.toFixed(6),
        [`${target}_longitude`]: longitude.toFixed(6),
      } as OperationFormData;

      if (
        target === "departure" &&
        !prev.arrival_latitude &&
        !prev.arrival_longitude
      ) {
        setActiveMapTarget("arrival");
      }

      return next;
    });
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

    if (isCreateMode) {
      payload.operation_assets = assets
        .filter((asset) => asset.asset_id)
        .map((asset) => ({
          asset_id: asset.asset_id,
          pilot_id: asset.pilot_id ?? null,
          co_pilot_id: asset.co_pilot_id ?? null,
        }));
    }

    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen bg-[#021019] text-gray-200 flex flex-col">
      <div className="bg-[#0A4D66] px-6 py-4 flex items-center justify-between shadow-md">
        <h1 className="text-white font-bold text-lg uppercase tracking-wider">
          {pageTitle}
        </h1>
        <button
          onClick={() => navigate("/dashboard/operations")}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium"
          type="button"
        >
          <Icon icon="mdi:close-circle" className="w-5 h-5" />
          Save & Exit
        </button>
      </div>

      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
          <section>
            <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider mb-4 border-b border-[#0A4D66]/40 pb-2">
              Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Purpose</label>
                <input
                  type="text"
                  placeholder="Enter Purpose"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Operation Type
                </label>
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
                <label className="text-xs text-gray-400 font-medium">Departure Time</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  title="Departure time"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Return Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  title="Return time"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  title="Start date"
                  className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  title="End date"
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

              <div className="flex flex-col gap-2 lg:col-span-3">
                <label className="text-xs text-gray-400 font-medium">Activities</label>
                <input
                  type="text"
                  placeholder="Enter description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider mb-4 border-b border-[#0A4D66]/40 pb-2">
              Coordinates (Optional)
            </h2>
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("departure")}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                    activeMapTarget === "departure"
                      ? "bg-[#7FD5FF] text-[#001219]"
                      : "bg-[#052333] text-gray-200 hover:bg-[#0A4D66]"
                  }`}
                >
                  Pick Departure
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMapTarget("arrival")}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                    activeMapTarget === "arrival"
                      ? "bg-[#7FD5FF] text-[#001219]"
                      : "bg-[#052333] text-gray-200 hover:bg-[#0A4D66]"
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
                onCoordinateSelect={handleCoordinateSelect}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <input
                type="number"
                step="any"
                placeholder="Departure Latitude (-90 to 90)"
                value={formData.departure_latitude}
                onChange={(e) =>
                  setFormData({ ...formData, departure_latitude: e.target.value })
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
                  setFormData({ ...formData, departure_longitude: e.target.value })
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
                  setFormData({ ...formData, arrival_latitude: e.target.value })
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
                  setFormData({ ...formData, arrival_longitude: e.target.value })
                }
                min={-180}
                max={180}
                className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
              />
            </div>
          </section>

          {isCreateMode ? (
            <section>
              <div className="flex items-center gap-4 mb-4 border-b border-[#0A4D66]/40 pb-2">
                <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider">
                  Aircraft
                </h2>
                <button
                  type="button"
                  onClick={addAsset}
                  className="inline-flex items-center gap-2 rounded-sm bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 transition-colors"
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                              {aircraft.name} ({aircraft.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Pilot in Command</label>
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
                        <label className="text-xs text-gray-400 font-medium">Co-Pilot</label>
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
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-10 flex justify-end border-t border-[#0A4D66]/30 pt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-16 w-full max-w-130 bg-[#7FD5FF] text-[#00090D] text-2xl font-semibold rounded-sm hover:bg-[#7FD5FF]/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};