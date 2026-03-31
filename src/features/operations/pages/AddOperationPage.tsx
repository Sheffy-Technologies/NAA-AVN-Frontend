import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetUnitsQuery } from "@/shared/api/units";
import { cn } from "@/shared/utils/cn";
import {
  useGetAircraftsQuery,
  useGetPersonnelQuery,
} from "@/features/personnel/api";
import {
  useCreateOperationMutation,
  useGetOperationTypesQuery,
  type CreateOperationRequest,
  type OperationAsset,
} from "../api";

type OperationAssetForm = OperationAsset & {
  departure_takeoff: string;
  departure_landing: string;
  return_takeoff: string;
  return_landing: string;
};

const createEmptyAsset = (): OperationAssetForm => ({
  aircraft_id: 0,
  pilot_id: 0,
  co_pilot_id: 0,
  departure_takeoff: "00:00",
  departure_landing: "00:00",
  return_takeoff: "00:00",
  return_landing: "00:00",
});

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

const getDurationMinutes = (start: string, end: string) => {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (endMinutes >= startMinutes) {
    return endMinutes - startMinutes;
  }

  return 24 * 60 - startMinutes + endMinutes;
};

const formatDurationDisplay = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${remainingMinutes
    .toString()
    .padStart(2, "0")}`;
};

const formatDurationHoursLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours.toString().padStart(2, "0")} hrs`;
  }

  return `${hours.toString().padStart(2, "0")}h ${remainingMinutes
    .toString()
    .padStart(2, "0")}m`;
};

const buildDateTime = (date: string, time: string) => `${date}T${time}:00`;

const getPersonnelDisplayName = (person: {
  firstname: string;
  lastname: string;
  rank?: { name?: string | null } | null;
}) => {
  return `${person.rank?.name ? `${person.rank.name} ` : ""}${person.firstname} ${
    person.lastname
  }`.trim();
};

export const AddOperationPage = () => {
  const navigate = useNavigate();
  const [createOperation, { isLoading: isSubmitting }] =
    useCreateOperationMutation();

  // Data queries
  const { data: units = [] } = useGetUnitsQuery();
  const { data: operationTypes = [] } = useGetOperationTypesQuery();
  const { data: aircrafts = [] } = useGetAircraftsQuery();
  const { data: personnel = [] } = useGetPersonnelQuery({
    branches: [],
    units: [],
    ranks: [],
    corps: [],
    specialties: [],
    status: [],
  });

  // Filter pilots (assuming rank/specialty logic or just use all for now)
  // In a real app, we would filter by specialty "Pilot" or similar
  const pilots = personnel;

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    operation_type_id: "",
    unit_id: "",
    start_date: "",
    location: "",
    description: "", // Activities
  });

  const [assets, setAssets] = useState<OperationAssetForm[]>([
    createEmptyAsset(),
  ]);

  const handleAssetChange = (
    index: number,
    field: keyof OperationAssetForm,
    value: string,
  ) => {
    const newAssets = [...assets];
    if (
      field === "aircraft_id" ||
      field === "pilot_id" ||
      field === "co_pilot_id"
    ) {
      newAssets[index] = { ...newAssets[index], [field]: Number(value) };
    } else {
      newAssets[index] = { ...newAssets[index], [field]: value };
    }
    setAssets(newAssets);
  };

  const addAsset = () => {
    setAssets([...assets, createEmptyAsset()]);
  };

  const removeAsset = (index: number) => {
    if (assets.length > 1) {
      setAssets(assets.filter((_, i) => i !== index));
    }
  };

  const assetDurations = useMemo(() => {
    return assets.map((asset) => {
      const departureMinutes = getDurationMinutes(
        asset.departure_takeoff,
        asset.departure_landing,
      );
      const returnMinutes = getDurationMinutes(
        asset.return_takeoff,
        asset.return_landing,
      );
      const totalMinutes = departureMinutes + returnMinutes;

      return {
        departureMinutes,
        returnMinutes,
        totalMinutes,
      };
    });
  }, [assets]);

  const operationTimes = useMemo(() => {
    const firstAsset = assets[0];
    if (!firstAsset) {
      return {
        startTime: "00:00",
        endTime: "00:00",
      };
    }

    const hasReturnFlight =
      firstAsset.return_takeoff !== "00:00" ||
      firstAsset.return_landing !== "00:00";

    return {
      startTime: firstAsset.departure_takeoff || "00:00",
      endTime: hasReturnFlight
        ? firstAsset.return_landing || firstAsset.departure_landing || "00:00"
        : firstAsset.departure_landing || "00:00",
    };
  }, [assets]);

  const fieldLabelClassName =
    "text-[11px] sm:text-xs text-gray-400 font-medium";
  const fieldClassName =
    "w-full bg-[#002233] border border-[#0A4D66]/30 rounded-md h-14 px-5 text-base text-gray-100 outline-none focus:border-[#7FD5FF] placeholder:text-gray-500";
  const selectClassName = cn(fieldClassName, "appearance-none pr-12");
  const timeFieldClassName = cn(fieldClassName, "pl-12 [color-scheme:dark]");
  const durationCardClassName =
    "bg-[#001825] border border-[#0A4D66]/25 rounded-md min-h-14 px-5 flex items-center text-2xl font-bold text-gray-100";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateOperationRequest = {
      name: formData.name,
      description: formData.description,
      unit_id: Number(formData.unit_id),
      operation_type_id: Number(formData.operation_type_id),
      start_date_time: buildDateTime(
        formData.start_date,
        operationTimes.startTime,
      ),
      end_date_time: buildDateTime(formData.start_date, operationTimes.endTime),
      priority: "medium", // Default or add field
      is_flight: 1, // Default to flight since aircrafts are involved
      location: formData.location,
      assets: assets
        .map((a) => ({
          aircraft_id: a.aircraft_id,
          pilot_id: a.pilot_id,
          co_pilot_id: a.co_pilot_id || undefined,
        }))
        .filter((a) => a.aircraft_id && a.pilot_id), // Filter out incomplete entries
    };

    try {
      await createOperation(payload).unwrap();
      navigate("/dashboard/operations");
    } catch (error) {
      console.error("Failed to create operation:", error);
      // Handle error (toast)
    }
  };

  return (
    <div className="min-h-screen bg-[#021019] text-gray-200 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-white font-bold text-lg uppercase tracking-wider">
            Add Operation
          </h1>
          <button
            type="button"
            onClick={() => navigate("/dashboard/operations")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#7FD5FF]/20 text-[#7FD5FF] hover:bg-[#7FD5FF]/30 transition-colors"
          >
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-none sm:rounded-xl border border-[#0A4D66]/40 bg-[#001219] px-5 py-6 sm:px-6 sm:py-8 lg:px-10"
        >
          <section className="space-y-5">
            <h2 className="text-sm font-medium text-gray-200 uppercase tracking-wide">
              Information
            </h2>

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-2">
                <label className={fieldLabelClassName}>Purpose</label>
                <input
                  type="text"
                  placeholder="Enter Purpose"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={fieldClassName}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className={fieldLabelClassName}>Operation Type</label>
                <div className="relative">
                  <select
                    value={formData.operation_type_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        operation_type_id: e.target.value,
                      })
                    }
                    className={selectClassName}
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
                    className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={fieldLabelClassName}>Unit</label>
                <div className="relative">
                  <select
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_id: e.target.value })
                    }
                    className={selectClassName}
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
                    className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={fieldLabelClassName}>Date</label>
                <div className="relative">
                  <Icon
                    icon="mdi:calendar-month-outline"
                    className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    className={cn(timeFieldClassName, "pl-14")}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className={fieldLabelClassName}>Location</label>
                <div className="relative">
                  <Icon
                    icon="mdi:map-marker"
                    className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300"
                  />
                  <input
                    type="text"
                    placeholder="Select Location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className={cn(fieldClassName, "pl-14")}
                  />
                </div>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className={fieldLabelClassName}>Activities</label>
                <input
                  type="text"
                  placeholder="Enter Code Name"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className={fieldClassName}
                />
              </div>
            </div>
          </section>

          <section className="mt-10 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-medium text-gray-200 uppercase tracking-wide">
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

            <div className="space-y-8">
              {assets.map((asset, index) => {
                const duration = assetDurations[index] ?? {
                  departureMinutes: 0,
                  returnMinutes: 0,
                  totalMinutes: 0,
                };

                return (
                  <div key={index} className="space-y-5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[15px] font-medium uppercase tracking-wide text-gray-200">
                        Aircraft {index + 1}
                      </h3>
                      {assets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAsset(index)}
                          className="text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Icon
                            icon="mdi:trash-can-outline"
                            className="h-5 w-5"
                          />
                        </button>
                      )}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-3">
                      <div className="space-y-2">
                        <label className={fieldLabelClassName}>Aircraft</label>
                        <div className="relative">
                          <select
                            value={asset.aircraft_id}
                            onChange={(e) =>
                              handleAssetChange(
                                index,
                                "aircraft_id",
                                e.target.value,
                              )
                            }
                            className={selectClassName}
                            required
                          >
                            <option value="0">Select Aircraft</option>
                            {aircrafts.map((aircraft) => (
                              <option key={aircraft.id} value={aircraft.id}>
                                {aircraft.name} ({aircraft.type})
                              </option>
                            ))}
                          </select>
                          <Icon
                            icon="mdi:chevron-down"
                            className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className={fieldLabelClassName}>
                          Pilot in Command
                        </label>
                        <div className="relative">
                          <select
                            value={asset.pilot_id}
                            onChange={(e) =>
                              handleAssetChange(
                                index,
                                "pilot_id",
                                e.target.value,
                              )
                            }
                            className={selectClassName}
                            required
                          >
                            <option value="0">Select Pilot</option>
                            {pilots.map((pilot) => (
                              <option key={pilot.id} value={pilot.id}>
                                {getPersonnelDisplayName(pilot)}
                              </option>
                            ))}
                          </select>
                          <Icon
                            icon="mdi:chevron-down"
                            className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className={fieldLabelClassName}>Co-Pilot</label>
                        <div className="relative">
                          <select
                            value={asset.co_pilot_id}
                            onChange={(e) =>
                              handleAssetChange(
                                index,
                                "co_pilot_id",
                                e.target.value,
                              )
                            }
                            className={selectClassName}
                          >
                            <option value="0">Select Pilots</option>
                            {pilots.map((pilot) => (
                              <option key={pilot.id} value={pilot.id}>
                                {getPersonnelDisplayName(pilot)}
                              </option>
                            ))}
                          </select>
                          <Icon
                            icon="mdi:chevron-down"
                            className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-8 xl:grid-cols-2">
                      <div className="space-y-4">
                        <div className="text-sm font-medium uppercase text-gray-200">
                          Departure Flight
                        </div>
                        <div className="grid gap-5 md:grid-cols-[1fr_1fr_180px]">
                          <div className="space-y-2">
                            <label className={fieldLabelClassName}>
                              Estimated Take Off
                            </label>
                            <div className="relative">
                              <Icon
                                icon="mdi:clock-outline"
                                className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300"
                              />
                              <input
                                type="time"
                                value={asset.departure_takeoff}
                                onChange={(e) =>
                                  handleAssetChange(
                                    index,
                                    "departure_takeoff",
                                    e.target.value,
                                  )
                                }
                                className={timeFieldClassName}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className={fieldLabelClassName}>
                              Estimated Landing
                            </label>
                            <div className="relative">
                              <Icon
                                icon="mdi:clock-outline"
                                className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300"
                              />
                              <input
                                type="time"
                                value={asset.departure_landing}
                                onChange={(e) =>
                                  handleAssetChange(
                                    index,
                                    "departure_landing",
                                    e.target.value,
                                  )
                                }
                                className={timeFieldClassName}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className={fieldLabelClassName}>
                              Total Duration
                            </label>
                            <div className={durationCardClassName}>
                              {formatDurationDisplay(duration.departureMinutes)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="text-sm font-medium uppercase text-gray-200">
                          Return Flight
                        </div>
                        <div className="grid gap-5 md:grid-cols-[1fr_1fr_180px]">
                          <div className="space-y-2">
                            <label className={fieldLabelClassName}>
                              Estimated Take Off
                            </label>
                            <div className="relative">
                              <Icon
                                icon="mdi:clock-outline"
                                className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300"
                              />
                              <input
                                type="time"
                                value={asset.return_takeoff}
                                onChange={(e) =>
                                  handleAssetChange(
                                    index,
                                    "return_takeoff",
                                    e.target.value,
                                  )
                                }
                                className={timeFieldClassName}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className={fieldLabelClassName}>
                              Estimated Landing
                            </label>
                            <div className="relative">
                              <Icon
                                icon="mdi:clock-outline"
                                className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300"
                              />
                              <input
                                type="time"
                                value={asset.return_landing}
                                onChange={(e) =>
                                  handleAssetChange(
                                    index,
                                    "return_landing",
                                    e.target.value,
                                  )
                                }
                                className={timeFieldClassName}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className={fieldLabelClassName}>
                              Total Duration
                            </label>
                            <div className={durationCardClassName}>
                              {formatDurationDisplay(duration.returnMinutes)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-2xl sm:text-3xl font-semibold text-gray-100">
                      Total Flight Hrs:{" "}
                      {formatDurationHoursLabel(duration.totalMinutes)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-10 flex justify-end border-t border-[#0A4D66]/30 pt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-16 w-full max-w-[520px] bg-[#7FD5FF] text-[#00090D] text-2xl font-semibold rounded-sm hover:bg-[#7FD5FF]/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
