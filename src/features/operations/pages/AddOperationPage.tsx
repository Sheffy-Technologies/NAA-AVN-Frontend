import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetUnitsQuery } from "@/shared/api/units";
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
    start_time: "00:00",
    end_date: "",
    end_time: "00:00",
    departure_longitude: "",
    departure_latitude: "",
    arrival_longitude: "",
    arrival_latitude: "",
    priority: "medium",
    is_flight: true,
    status: "planned" as "planned" | "completed" | "ongoing" | "aborted",
    description: "",
  });

  const [assets, setAssets] = useState<OperationAsset[]>([
    { asset_id: 0, pilot_id: null, co_pilot_id: null },
  ]);

  const handleAssetChange = (
    index: number,
    field: keyof OperationAsset,
    value: string,
  ) => {
    const newAssets = [...assets];
    newAssets[index] = {
      ...newAssets[index],
      [field]: value ? Number(value) : null,
    };
    setAssets(newAssets);
  };

  const addAsset = () => {
    setAssets([...assets, { asset_id: 0, pilot_id: null, co_pilot_id: null }]);
  };

  const removeAsset = (index: number) => {
    if (assets.length > 1) {
      setAssets(assets.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      operation_assets: assets
        .filter((a) => a.asset_id)
        .map((a) => ({
          asset_id: a.asset_id,
          pilot_id: a.pilot_id ?? null,
          co_pilot_id: a.co_pilot_id ?? null,
        })),
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
    <div className="min-h-screen bg-[#021019] text-gray-200 flex flex-col">
      {/* Header */}
      <div className="bg-[#0A4D66] px-6 py-4 flex items-center justify-between shadow-md">
        <h1 className="text-white font-bold text-lg uppercase tracking-wider">
          ADD OPERATION
        </h1>
        <button
          onClick={() => navigate("/dashboard/operations")}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium"
        >
          <Icon icon="mdi:close-circle" className="w-5 h-5" />
          Save & Exit
        </button>
      </div>

      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
          {/* Information Section */}
          <section>
            <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider mb-4 border-b border-[#0A4D66]/40 pb-2">
              Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Purpose */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Purpose
                </label>
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

              {/* Operation Type */}
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
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                    required
                  >
                    <option value="">Select Type</option>
                    {operationTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                    {/* Fallback/Mock options if API is empty */}
                    {!operationTypes.length && (
                      <>
                        <option value="1">Reconnaissance</option>
                        <option value="2">Transport</option>
                        <option value="3">Training</option>
                        <option value="4">Combat</option>
                      </>
                    )}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Unit */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Unit
                </label>
                <div className="relative">
                  <select
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_id: e.target.value })
                    }
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

              {/* Departure Time */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Departure Time
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:clock-outline"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                    required
                  />
                </div>
              </div>

              {/* Return Time */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Return Time
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:clock-outline"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                    required
                  />
                </div>
              </div>

              {/* Start Date */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Start Date
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:calendar"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                    required
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  End Date
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:calendar"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Priority
                </label>
                <div className="relative">
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as typeof formData.status,
                      })
                    }
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                  >
                    <option value="planned">Planned</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="aborted">Aborted</option>
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Is Flight */}
              <div className="flex flex-col gap-2 justify-center">
                <label className="text-xs text-gray-400 font-medium">
                  Is Flight
                </label>
                <label className="flex items-center gap-3 cursor-pointer h-[46px]">
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

              {/* Activities */}
              <div className="flex flex-col gap-2 lg:col-span-3">
                <label className="text-xs text-gray-400 font-medium">
                  Activities
                </label>
                <input
                  type="text"
                  placeholder="Enter Code Name"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
              </div>
            </div>
          </section>

          {/* Coordinates Section */}
          <section>
            <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider mb-4 border-b border-[#0A4D66]/40 pb-2">
              Coordinates (Optional)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Departure Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="-90 to 90"
                  value={formData.departure_latitude}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      departure_latitude: e.target.value,
                    })
                  }
                  min={-90}
                  max={90}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Departure Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="-180 to 180"
                  value={formData.departure_longitude}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      departure_longitude: e.target.value,
                    })
                  }
                  min={-180}
                  max={180}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Arrival Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="-90 to 90"
                  value={formData.arrival_latitude}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      arrival_latitude: e.target.value,
                    })
                  }
                  min={-90}
                  max={90}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Arrival Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="-180 to 180"
                  value={formData.arrival_longitude}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      arrival_longitude: e.target.value,
                    })
                  }
                  min={-180}
                  max={180}
                  className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-600"
                />
              </div>
            </div>
          </section>

          {/* Aircraft Section */}
          <section>
            <div className="flex items-center gap-4 mb-4 border-b border-[#0A4D66]/40 pb-2">
              <h2 className="text-[#7FD5FF] text-xs font-bold uppercase tracking-wider">
                Aircraft
              </h2>
              <button
                type="button"
                onClick={addAsset}
                className="bg-white text-black text-xs font-bold px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200 transition-colors"
              >
                <Icon icon="mdi:plus" className="w-4 h-4" /> Add Aircraft
              </button>
            </div>

            <div className="space-y-6">
              {assets.map((asset, index) => (
                <div
                  key={index}
                  className="bg-[#001219]/50 p-4 rounded-lg border border-[#0A4D66]/20"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-[#7FD5FF] text-xs font-bold uppercase">
                      AIRCRAFT {index + 1}
                    </h3>
                    {assets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAsset(index)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Icon
                          icon="mdi:trash-can-outline"
                          className="w-4 h-4"
                        />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Aircraft Select */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-gray-400 font-medium">
                        Aircraft
                      </label>
                      <div className="relative">
                        <select
                          value={asset.asset_id ?? 0}
                          onChange={(e) =>
                            handleAssetChange(
                              index,
                              "asset_id",
                              e.target.value,
                            )
                          }
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                          required
                        >
                          <option value="0">Select Aircraft</option>
                          {aircrafts.map((ac) => (
                            <option key={ac.id} value={ac.id}>
                              {ac.name} ({ac.type})
                            </option>
                          ))}
                        </select>
                        <Icon
                          icon="mdi:chevron-down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Pilot Select */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-gray-400 font-medium">
                        Pilot in Command
                      </label>
                      <div className="relative">
                        <select
                          value={asset.pilot_id ?? ""}
                          onChange={(e) =>
                            handleAssetChange(index, "pilot_id", e.target.value)
                          }
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                        >
                          <option value="">Select Pilot</option>
                          {pilots.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.rank?.name} {p.firstname} {p.lastname}
                            </option>
                          ))}
                        </select>
                        <Icon
                          icon="mdi:chevron-down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Co-Pilot Select */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-gray-400 font-medium">
                        Co-Pilot
                      </label>
                      <div className="relative">
                        <select
                          value={asset.co_pilot_id ?? ""}
                          onChange={(e) =>
                            handleAssetChange(
                              index,
                              "co_pilot_id",
                              e.target.value,
                            )
                          }
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                        >
                          <option value="">Select Co-Pilot</option>
                          {pilots.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.rank?.name} {p.firstname} {p.lastname}
                            </option>
                          ))}
                        </select>
                        <Icon
                          icon="mdi:chevron-down"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-[#0A4D66]/40">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#7FD5FF] text-black font-bold py-3 px-12 rounded hover:bg-[#7FD5FF]/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
