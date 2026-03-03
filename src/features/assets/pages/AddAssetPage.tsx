import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useCreateAssetMutation, type CreateAssetPayload } from "../api";

// Mock data for dropdowns
const AIRCRAFT_TYPES = ["Helicopter", "Fixed Wing", "UAV"];
const POSITIONS = ["Engine 1", "Engine 2", "Main Rotor", "Tail Rotor"];
const COMPONENT_TYPES = ["Avionics", "Landing Gear", "Weapon System"];
const DOCUMENT_TYPES = [
  "Airworthiness Certificate",
  "Insurance",
  "Registration",
];

export const AddAssetPage = () => {
  const navigate = useNavigate();
  const [createAsset, { isLoading }] = useCreateAssetMutation();
  const { data: units = [] } = useGetUnitsQuery();

  // Form State
  const [formData, setFormData] = useState({
    // Identification
    type: "aircraft",
    name: "",
    tail_number: "",
    serial_number: "",
    model: "",
    aircraft_id: "", // UI only?
    internal_id: "", // UI only?
    military_registration: "", // UI only?
    date_inducted: "", // UI only?
    date_into_service: "", // UI only?
    unit_id: "",
    airbase: "", // UI only?
    hangar: "", // UI only?

    // Airframe
    total_airframe_hours: "",
    service_life_limit: "",
    operation_status: "serviceable",
    last_major_inspection_date: "",
    last_major_inspection_hours: "",
    inspection_interval: "",
    next_annual_inspection: "",
    next_type_of_inspection: "",
    airframe_cycles: "", // Optional
    service_life_limit_cycles: "", // Optional
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
      serial_number: "",
      model: "",
      installation_date: "",
      time_since_new: "",
      time_since_overhaul: "",
      service_life_limit: "",
      overhaul_limit: "",
    },
  ]);

  const [components, setComponents] = useState([
    {
      part_number: "",
      serial_number: "",
      life_limit_hours: "",
      time_since_overhaul: "",
      time_since_new: "",
      overhaul_limit: "",
      hours_used: "",
      installed_at: "",
    },
  ]);

  const [defects, setDefects] = useState([
    {
      defect_reported: "",
      date_of_defect: "",
      pilots_involved: "",
      location: "",
      defect_description: "",
      remark: "",
      rectified: false,
      rectification_details: "",
      work_done: "",
      certifying_engineer: "",
    },
  ]);

  const [documents, setDocuments] = useState([
    {
      document_type: "",
      file: "",
      issue_date: "",
      expiry_date: "",
    },
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

  const removeItem = <T,>(
    setter: (val: T[]) => void,
    list: T[],
    index: number,
  ) => {
    setter(list.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      const payload: CreateAssetPayload = {
        type: "aircraft",
        unit_id: Number(formData.unit_id) || 1, // Default to 1 if not selected
        name: formData.name,
        serial_number: formData.serial_number,
        model: formData.model,
        configuration: {
          role: formData.role,
          seats: Number(formData.seats),
        },
        serviceability_status: formData.operation_status as
          | "serviceable"
          | "under_maintenance"
          | "grounded"
          | "medical",
        tail_number: formData.tail_number,
        used_hours: Number(formData.total_airframe_hours) || 0,
        manufacturer: formData.manufacturer,
        purchase_date: formData.purchase_date,

        engines: engines.map((e) => ({
          ...e,
          position_id: 1, // Default or map from UI
          time_since_new: Number(e.time_since_new) || 0,
          time_since_overhaul: Number(e.time_since_overhaul) || 0,
          service_life_limit: Number(e.service_life_limit) || 0,
          overhaul_limit: Number(e.overhaul_limit) || 0,
        })),

        components: components.map((c) => ({
          ...c,
          life_limit_hours: Number(c.life_limit_hours) || 0,
          time_since_overhaul: Number(c.time_since_overhaul) || 0,
          time_since_new: Number(c.time_since_new) || 0,
          overhaul_limit: Number(c.overhaul_limit) || 0,
          hours_used: Number(c.hours_used) || 0,
        })),

        documents: documents.map((d) => ({
          ...d,
        })),

        maintenance_events: defects.map(
          ({ pilots_involved, certifying_engineer, ...d }) => ({
            event_type: "Defect",
            description: d.defect_description,
            status: d.rectified ? "rectified" : "pending",
            pilots_involved: Number(pilots_involved) || undefined,
            certifying_engineer: Number(certifying_engineer) || undefined,
            ...d,
          }),
        ),
      };

      await createAsset(payload).unwrap();
      navigate("/dashboard/assets");
    } catch (error) {
      console.error("Failed to create asset:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#00090D] text-white p-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-[#0A4D66]/40 pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wider text-white">
          Add Aircraft
        </h1>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex items-center space-x-2 bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 text-[#00090D] px-6 py-2 rounded text-sm font-bold transition-colors"
        >
          <Icon icon="mdi:check" className="w-5 h-5" />
          <span>{isLoading ? "Saving..." : "Save & Exit"}</span>
        </button>
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
                value={formData.model}
                onChange={(e) => handleInputChange("model", e.target.value)}
              >
                <option value="">Select Type</option>
                {AIRCRAFT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
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
            <div className="col-span-1 md:col-span-1 row-span-2 flex items-center justify-center border-2 border-dashed border-[#0A4D66] rounded-lg bg-[#001825]/50 hover:bg-[#001825] transition-colors cursor-pointer group">
              <div className="text-center p-4">
                <Icon
                  icon="mdi:helicopter"
                  className="w-12 h-12 text-[#0A4D66] group-hover:text-[#7FD5FF] mx-auto mb-2 transition-colors"
                />
                <span className="text-xs text-gray-400 group-hover:text-white">
                  Upload Photo
                </span>
              </div>
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
              <label className="text-xs text-gray-400">Airbase</label>
              <select
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={formData.airbase}
                onChange={(e) => handleInputChange("airbase", e.target.value)}
              >
                <option value="">Select Airbase</option>
                <option value="base1">Base 1</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Hangar</label>
              <select
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={formData.hangar}
                onChange={(e) => handleInputChange("hangar", e.target.value)}
              >
                <option value="">Select Hangar</option>
                <option value="h1">Hangar 1</option>
              </select>
            </div>
          </div>
        </section>

        {/* Airframe */}
        <section>
          <h2 className="text-xs font-bold text-[#7FD5FF] uppercase mb-4">
            Airframe
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Total Airframe Hrs
              </label>
              <input
                type="number"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Hrs"
                value={formData.total_airframe_hours}
                onChange={(e) =>
                  handleInputChange("total_airframe_hours", e.target.value)
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
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Life Remaining</label>
              <div className="text-xl font-bold text-white">00 hrs</div>
            </div>

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
                Last Major Inspection hrs
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
                next inspection due
              </label>
              <div className="text-xl font-bold text-white">00 hrs</div>
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
                  handleInputChange("next_annual_inspection", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Next Type of Inspection
              </label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Type"
                value={formData.next_type_of_inspection}
                onChange={(e) =>
                  handleInputChange("next_type_of_inspection", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Airframe Cycles (optional)
              </label>
              <input
                type="number"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Cycles"
                value={formData.airframe_cycles}
                onChange={(e) =>
                  handleInputChange("airframe_cycles", e.target.value)
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
                onChange={(e) => handleInputChange("landings", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Engine */}
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-bold text-[#7FD5FF] uppercase">
              Engine
            </h2>
            <button
              onClick={() =>
                addItem(setEngines, engines, {
                  position_id: 1,
                  serial_number: "",
                  model: "",
                  installation_date: "",
                  time_since_new: "",
                  time_since_overhaul: "",
                  service_life_limit: "",
                  overhaul_limit: "",
                })
              }
              className="flex items-center gap-1 bg-white text-[#00090D] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
            >
              <Icon icon="mdi:plus" className="w-3 h-3" />
              Add Engine
            </button>
          </div>

          <div className="space-y-4">
            {engines.map((engine, idx) => (
              <div
                key={idx}
                className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
              >
                <button
                  onClick={() => removeItem(setEngines, engines, idx)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
                >
                  <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                </button>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">
                  Engine {idx + 1}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Position</label>
                    <select
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      value={engine.position_id}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
                          "position_id",
                          e.target.value,
                        )
                      }
                    >
                      {POSITIONS.map((p, i) => (
                        <option key={i} value={i + 1}>
                          {p}
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
                      placeholder="Enter Hrs"
                      value={engine.serial_number}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
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
                      value={engine.model}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
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
                      value={engine.installation_date}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
                          "installation_date",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Time Since New
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter Hrs"
                      value={engine.time_since_new}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
                          "time_since_new",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Time Since Overhaul
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      placeholder="Enter Hrs"
                      value={engine.time_since_overhaul}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
                          "time_since_overhaul",
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
                      value={engine.service_life_limit}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
                          "service_life_limit",
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
                      value={engine.overhaul_limit}
                      onChange={(e) =>
                        updateItem(
                          setEngines,
                          engines,
                          idx,
                          "overhaul_limit",
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

        {/* Component */}
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-bold text-[#7FD5FF] uppercase">
              Component
            </h2>
            <button
              onClick={() =>
                addItem(setComponents, components, {
                  part_number: "",
                  serial_number: "",
                  life_limit_hours: "",
                  time_since_overhaul: "",
                  time_since_new: "",
                  overhaul_limit: "",
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
            {components.map((comp, idx) => (
              <div
                key={idx}
                className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
              >
                <button
                  onClick={() => removeItem(setComponents, components, idx)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
                >
                  <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                </button>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">
                  Component {idx + 1}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Component</label>
                    <select className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]">
                      <option value="">Select Type</option>
                      {COMPONENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
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
                    <label className="text-xs text-gray-400">Part Number</label>
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

                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">
                      Time Since New
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
                      Time Since Overhaul
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
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Defects */}
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-bold text-[#7FD5FF] uppercase">
              Defects
            </h2>
            <button
              onClick={() =>
                addItem(setDefects, defects, {
                  defect_reported: "",
                  date_of_defect: "",
                  pilots_involved: "",
                  location: "",
                  defect_description: "",
                  remark: "",
                  rectified: false,
                  rectification_details: "",
                  work_done: "",
                  certifying_engineer: "",
                })
              }
              className="flex items-center gap-1 bg-white text-[#00090D] px-2 py-0.5 rounded text-xs font-bold hover:bg-gray-200"
            >
              <Icon icon="mdi:plus" className="w-3 h-3" />
              Add Defect
            </button>
          </div>

          <div className="space-y-4">
            {defects.map((defect, idx) => (
              <div
                key={idx}
                className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 relative"
              >
                <button
                  onClick={() => removeItem(setDefects, defects, idx)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
                >
                  <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                </button>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">
                  Defect {idx + 1}
                </h3>

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
                    <label className="text-xs text-gray-400">
                      Pilots Involved
                    </label>
                    <select
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                      value={defect.pilots_involved}
                      onChange={(e) =>
                        updateItem(
                          setDefects,
                          defects,
                          idx,
                          "pilots_involved",
                          e.target.value,
                        )
                      }
                    >
                      <option value="">Select Pilots</option>
                      <option value="1">Pilot A</option>
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
                      onChange={() =>
                        updateItem(setDefects, defects, idx, "rectified", true)
                      }
                      className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input
                      type="radio"
                      name={`rectified-${idx}`}
                      checked={!defect.rectified}
                      onChange={() =>
                        updateItem(setDefects, defects, idx, "rectified", false)
                      }
                      className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
                    />
                    No
                  </label>
                </div>

                {defect.rectified && (
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
                          <option value="1">Eng A</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Documentation */}
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-bold text-[#7FD5FF] uppercase">
              Documentation
            </h2>
            <button
              onClick={() =>
                addItem(setDocuments, documents, {
                  document_type: "",
                  file: "",
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
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Document</label>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-2 bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white w-full hover:bg-[#0A4D66]/20">
                        <Icon
                          icon="mdi:upload"
                          className="w-4 h-4 text-[#7FD5FF]"
                        />
                        <span>Upload Document</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Issue date</label>
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
                    <label className="text-xs text-gray-400">Expiry Date</label>
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

        {/* Footer Actions */}
        <div className="flex justify-end pt-8">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full md:w-auto bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 text-[#00090D] px-8 py-3 rounded text-sm font-bold transition-colors uppercase tracking-widest"
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
