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
    end_time: "00:00",
    location: "",
    description: "", // Activities
  });

  const [assets, setAssets] = useState<OperationAsset[]>([
    { aircraft_id: 0, pilot_id: 0, co_pilot_id: 0 },
  ]);

  const handleAssetChange = (
    index: number,
    field: keyof OperationAsset,
    value: string,
  ) => {
    const newAssets = [...assets];
    newAssets[index] = { ...newAssets[index], [field]: Number(value) };
    setAssets(newAssets);
  };

  const addAsset = () => {
    setAssets([...assets, { aircraft_id: 0, pilot_id: 0, co_pilot_id: 0 }]);
  };

  const removeAsset = (index: number) => {
    if (assets.length > 1) {
      setAssets(assets.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Combine date and time
    const startDateTime = `${formData.start_date}T${formData.start_time}:00`;
    // End date is assumed to be same day or handled via logic, for now just use same date + end time
    // Or if end time < start time, assume next day.
    // For simplicity, let's just use same date for now or we might need an end date field if operations span days.
    // The UI only shows "Date" once.
    const endDateTime = `${formData.start_date}T${formData.end_time}:00`;

    const payload: CreateOperationRequest = {
      name: formData.name,
      description: formData.description,
      unit_id: Number(formData.unit_id),
      operation_type_id: Number(formData.operation_type_id),
      start_date_time: startDateTime,
      end_date_time: endDateTime,
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

              {/* Date */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">
                  Date
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

              {/* Location */}
              <div className="flex flex-col gap-2 lg:col-span-1">
                <label className="text-xs text-gray-400 font-medium">
                  Location
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:map-marker"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Select Location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-500"
                  />
                </div>
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
                          value={asset.aircraft_id}
                          onChange={(e) =>
                            handleAssetChange(
                              index,
                              "aircraft_id",
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
                          value={asset.pilot_id}
                          onChange={(e) =>
                            handleAssetChange(index, "pilot_id", e.target.value)
                          }
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                          required
                        >
                          <option value="0">Select Pilot</option>
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
                          value={asset.co_pilot_id}
                          onChange={(e) =>
                            handleAssetChange(
                              index,
                              "co_pilot_id",
                              e.target.value,
                            )
                          }
                          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                        >
                          <option value="0">Select Co-Pilot</option>
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
