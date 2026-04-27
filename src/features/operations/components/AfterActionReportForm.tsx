import { useState } from "react";
import { Icon } from "@iconify/react";
import {
  useCreateAfterActionReportMutation,
  useGetOperationByIdQuery,
  useUpdateOperationMutation,
  type CreateAfterActionReportRequest,
  type Contact,
  type ResourceUtilization,
  type Operation,
} from "../api";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import { useGetAssetsQuery } from "@/features/assets/api";

interface AfterActionReportFormProps {
  operationId: number;
  operation?: Operation | null;
  onSuccess?: () => void;
}

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

const EngagementOptions = [
  { value: "visuals_only", label: "Visuals Only" },
  { value: "attack", label: "Attack" },
  { value: "base_support", label: "Base Support" },
  { value: "returned_fire", label: "Returned Fire" },
];

const MissionOptions = [
  { value: "logistics", label: "Logistics" },
  { value: "recon", label: "Recon" },
  { value: "attack", label: "Attack" },
  { value: "base_support", label: "Base Support" },
];

export const AfterActionReportForm = ({
  operationId,
  operation: initialOperation,
  onSuccess,
}: AfterActionReportFormProps) => {
  const [createReport, { isLoading }] = useCreateAfterActionReportMutation();
  const [updateOperation] = useUpdateOperationMutation();
  const { data: fetchedOperation } = useGetOperationByIdQuery(operationId);
  const operation = initialOperation || fetchedOperation;
  const { data: inventories = [] } = useGetInventoriesQuery();
  const { data: assets = [] } = useGetAssetsQuery();

  const [formData, setFormData] = useState<
    Omit<
      CreateAfterActionReportRequest,
      "operation_id" | "contacts" | "resource_utilizations"
    >
  >({
    mission: "logistics",
    task_no: "",
    infantry_no: 0,
    activities: "",
  });

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [resources, setResources] = useState<ResourceUtilization[]>([]);
  const [flightTimes, setFlightTimes] = useState<Record<number, {
    departure_takeoff: string;
    departure_landing: string;
    return_takeoff: string;
    return_landing: string;
  }>>({});

  const calculateDurationMinutes = (takeoff: string, landing: string): number => {
    if (!takeoff || !landing) return 0;
    const [takeoffHour, takeoffMin] = takeoff.split(":").map(Number);
    const [landingHour, landingMin] = landing.split(":").map(Number);
    let duration = (landingHour * 60 + landingMin) - (takeoffHour * 60 + takeoffMin);
    if (duration < 0) duration += 24 * 60;
    return duration;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  const getAssetFlightTimes = (idx: number, asset: OperationAssignedAsset) => ({
    departure_takeoff: flightTimes[idx]?.departure_takeoff ?? (asset.departure_takeoff?.slice(0, 5) || ""),
    departure_landing: flightTimes[idx]?.departure_landing ?? (asset.departure_landing?.slice(0, 5) || ""),
    return_takeoff: flightTimes[idx]?.return_takeoff ?? (asset.arrival_takeoff?.slice(0, 5) || ""),
    return_landing: flightTimes[idx]?.return_landing ?? (asset.arrival_landing?.slice(0, 5) || ""),
  });

  const calculateAssetTotalMinutes = (idx: number, asset: OperationAssignedAsset): number => {
    const times = getAssetFlightTimes(idx, asset);
    const depMinutes = calculateDurationMinutes(times.departure_takeoff, times.departure_landing);
    const retMinutes = calculateDurationMinutes(times.return_takeoff, times.return_landing);
    return depMinutes + retMinutes;
  };

  const calculateTotalFlightHours = (): string => {
    let totalMinutes = 0;
    (operation?.assets || []).forEach((asset, idx) => {
      totalMinutes += calculateAssetTotalMinutes(idx, asset);
    });

    return formatDuration(totalMinutes);
  };

  const handleContactChange = (
    index: number,
    field: keyof Contact,
    value: string | number,
  ) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: value } as Contact;
    setContacts(newContacts);
  };

  const handlePhotoUpload = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const newContacts = [...contacts];
        newContacts[index].photos.push({ file: base64String });
        setContacts(newContacts);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (contactIndex: number, photoIndex: number) => {
    const newContacts = [...contacts];
    newContacts[contactIndex].photos = newContacts[contactIndex].photos.filter(
      (_, i) => i !== photoIndex,
    );
    setContacts(newContacts);
  };

  const addContact = () => {
    setContacts([
      ...contacts,
      {
        engagement: "visuals_only",
        location: "",
        time_of_contact: "00:00",
        date_of_contact: "",
        enemy_resources_description: "",
        enemy_infantry_no: 0,
        enemy_vehicle_no: 0,
        targets_treated_description: "",
        targets_infantry_no: 0,
        targets_vehicle_no: 0,
        damage_received: "",
        photos: [],
      },
    ]);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleResourceChange = (
    index: number,
    field: keyof ResourceUtilization,
    value: string | number,
  ) => {
    const newResources = [...resources];
    newResources[index] = {
      ...newResources[index],
      [field]: value,
    } as ResourceUtilization;
    setResources(newResources);
  };

  const addResource = () => {
    setResources([
      ...resources,
      {
        inventory_id: 0, // Should be selected from dropdown
        item_description: "",
        quantity_used: 0,
        asset_id: 0, // Should be selected from dropdown
      },
    ]);
  };

  const removeResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const toApiTime = (time?: string): string | null => {
    if (!time) return null;
    return time.length === 5 ? `${time}:00` : time;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (operation?.id) {
        const operationAssetsPayload = (operation.assets ?? [])
          .map((asset, idx) => {
            const times = getAssetFlightTimes(idx, asset);

            return {
              asset_id: asset.asset_id ?? asset.asset?.id ?? 0,
              pilot_id: asset.pilot_id ?? null,
              co_pilot_id: asset.co_pilot_id ?? null,
              departure_takeoff: toApiTime(times.departure_takeoff),
              departure_landing: toApiTime(times.departure_landing),
              arrival_takeoff: toApiTime(times.return_takeoff),
              arrival_landing: toApiTime(times.return_landing),
              flight_hours: Number((calculateAssetTotalMinutes(idx, asset) / 60).toFixed(2)),
            };
          })
          .filter((item) => item.asset_id > 0);

        await updateOperation({
          id: operation.id,
          data: {
            operation_assets: operationAssetsPayload,
          },
        }).unwrap();
      }

      await createReport({
        operation_id: operationId,
        ...formData,
        contacts,
        resource_utilizations: resources,
      }).unwrap();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Failed to submit AAR:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 text-gray-200">
      {/* Mission Type */}
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        <h3 className="text-[#7FD5FF] text-sm font-bold mb-4 uppercase">
          Mission
        </h3>
        <div className="flex flex-wrap gap-6">
          {MissionOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="mission"
                value={option.value}
                checked={formData.mission === option.value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mission: e.target.value as
                      | "logistics"
                      | "recon"
                      | "attack"
                      | "base_support",
                  })
                }
                className="accent-[#7FD5FF] w-4 h-4"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Task Details */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">Task No.</label>
          <input
            type="text"
            placeholder="Enter Task No."
            value={formData.task_no}
            onChange={(e) =>
              setFormData({ ...formData, task_no: e.target.value })
            }
            className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">
            Infantry No.
          </label>
          <input
            type="number"
            placeholder="Enter Number"
            value={formData.infantry_no || ""}
            onChange={(e) =>
              setFormData({ ...formData, infantry_no: Number(e.target.value) })
            }
            className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          />
        </div>
        <div className="col-span-1 md:col-span-3 flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">
            Activities
          </label>
          <textarea
            placeholder="Enter Activities"
            value={formData.activities}
            onChange={(e) =>
              setFormData({ ...formData, activities: e.target.value })
            }
            className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] min-h-[100px]"
          />
        </div>
      </section>

      {/* Aircraft Information */}
      {operation && operation.assets && operation.assets.length > 0 && (
        <section className="space-y-6">
          {operation.assets.map((asset, idx) => (
            <div
              key={idx}
              className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6"
            >
              <h3 className="text-[#7FD5FF] text-sm font-bold mb-4 uppercase tracking-wide">
                Aircraft {idx + 1}
              </h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-[#0A4D66]/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">
                      Aircraft Name
                    </label>
                    <p className="text-sm text-white font-semibold">
                      {asset.asset?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">
                      Pilot In Command
                    </label>
                    <p className="text-sm text-white font-semibold">
                      {asset.pilot ? getPersonnelDisplayName(asset.pilot) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">
                      Co-Pilot
                    </label>
                    <p className="text-sm text-white font-semibold">
                      {asset.co_pilot ? getPersonnelDisplayName(asset.co_pilot) : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold text-[#7FD5FF] uppercase tracking-wide">
                      Departure Flight
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Actual Take Off</label>
                        <input
                          type="time"
                          title="Departure takeoff time"
                          placeholder="Departure takeoff"
                          value={getAssetFlightTimes(idx, asset).departure_takeoff}
                          onChange={(e) =>
                            setFlightTimes((prev) => ({
                              ...prev,
                              [idx]: {
                                ...prev[idx],
                                departure_takeoff: e.target.value,
                              },
                            }))
                          }
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Actual Landing</label>
                        <input
                          type="time"
                          title="Departure landing time"
                          placeholder="Departure landing"
                          value={getAssetFlightTimes(idx, asset).departure_landing}
                          onChange={(e) =>
                            setFlightTimes((prev) => ({
                              ...prev,
                              [idx]: {
                                ...prev[idx],
                                departure_landing: e.target.value,
                              },
                            }))
                          }
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Total Duration</label>
                        <div className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-2xl leading-none font-bold text-white">
                          {formatDuration(
                            calculateDurationMinutes(
                              getAssetFlightTimes(idx, asset).departure_takeoff,
                              getAssetFlightTimes(idx, asset).departure_landing,
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold text-[#7FD5FF] uppercase tracking-wide">
                      Return Flight
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Actual Take Off</label>
                        <input
                          type="time"
                          title="Return takeoff time"
                          placeholder="Return takeoff"
                          value={getAssetFlightTimes(idx, asset).return_takeoff}
                          onChange={(e) =>
                            setFlightTimes((prev) => ({
                              ...prev,
                              [idx]: {
                                ...prev[idx],
                                return_takeoff: e.target.value,
                              },
                            }))
                          }
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Actual Landing</label>
                        <input
                          type="time"
                          title="Return landing time"
                          placeholder="Return landing"
                          value={getAssetFlightTimes(idx, asset).return_landing}
                          onChange={(e) =>
                            setFlightTimes((prev) => ({
                              ...prev,
                              [idx]: {
                                ...prev[idx],
                                return_landing: e.target.value,
                              },
                            }))
                          }
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-medium">Total Duration</label>
                        <div className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-2xl leading-none font-bold text-white">
                          {formatDuration(
                            calculateDurationMinutes(
                              getAssetFlightTimes(idx, asset).return_takeoff,
                              getAssetFlightTimes(idx, asset).return_landing,
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#0A4D66]/20">
                  <p className="text-sm font-semibold text-gray-300">
                    Aircraft Total Flight Hours: {Number((calculateAssetTotalMinutes(idx, asset) / 60).toFixed(2)).toFixed(2)} hrs
                  </p>
                </div>

                <div className="pt-2">
                  <p className="text-4xl font-bold text-white">
                    Total Flight Hrs: <span className="text-[#7FD5FF]">{calculateTotalFlightHours()}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Enemy In Contact */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-[#7FD5FF] text-sm font-bold uppercase">
            ENEMY IN CONTACT
          </h3>
          <button
            type="button"
            onClick={addContact}
            className="bg-white text-black text-xs font-bold px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200 transition-colors"
          >
            <Icon icon="mdi:plus" className="w-4 h-4" /> Add Contact
          </button>
        </div>

        <div className="space-y-6">
          {contacts.map((contact, index) => (
            <div
              key={index}
              className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 relative"
            >
              <button
                type="button"
                onClick={() => removeContact(index)}
                title={`Remove contact ${index + 1}`}
                aria-label={`Remove contact ${index + 1}`}
                className="absolute top-4 right-4 text-gray-500 hover:text-red-400"
              >
                <Icon icon="mdi:trash-can-outline" className="w-5 h-5" />
              </button>

              <h4 className="text-xs font-bold uppercase mb-4 text-gray-400">
                CONTACT {index + 1}
              </h4>

              {/* Engagement Type */}
              <div className="mb-6">
                <label className="text-xs text-gray-400 font-medium block mb-2">
                  Engagement
                </label>
                <div className="flex flex-wrap gap-4">
                  {EngagementOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`engagement-${index}`}
                        value={opt.value}
                        checked={contact.engagement === opt.value}
                        onChange={(e) =>
                          handleContactChange(
                            index,
                            "engagement",
                            e.target.value,
                          )
                        }
                        className="accent-[#7FD5FF] w-4 h-4"
                      />
                      <span className="text-sm text-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-2">
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
                      value={contact.location}
                      onChange={(e) =>
                        handleContactChange(index, "location", e.target.value)
                      }
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Time Of Contact
                    </label>
                    <div className="relative">
                      <Icon
                        icon="mdi:clock-outline"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="time"
                        title="Time of contact"
                        placeholder="Time of contact"
                        value={contact.time_of_contact}
                        onChange={(e) =>
                          handleContactChange(
                            index,
                            "time_of_contact",
                            e.target.value,
                          )
                        }
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                      />
                    </div>
                  </div>
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
                        title="Date of contact"
                        placeholder="Date of contact"
                        value={contact.date_of_contact}
                        onChange={(e) =>
                          handleContactChange(
                            index,
                            "date_of_contact",
                            e.target.value,
                          )
                        }
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Enemy Resources */}
              <div className="mb-6">
                <h5 className="text-xs font-bold uppercase mb-2 text-gray-400">
                  Enemy Resources
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Descriptions"
                      value={contact.enemy_resources_description}
                      onChange={(e) =>
                        handleContactChange(
                          index,
                          "enemy_resources_description",
                          e.target.value,
                        )
                      }
                      className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Infantry No.
                    </label>
                    <input
                      type="number"
                      placeholder="Enter Number"
                      value={contact.enemy_infantry_no || ""}
                      onChange={(e) =>
                        handleContactChange(
                          index,
                          "enemy_infantry_no",
                          Number(e.target.value),
                        )
                      }
                      className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Vehicle No.
                    </label>
                    <input
                      type="number"
                      placeholder="Enter Number"
                      value={contact.enemy_vehicle_no || ""}
                      onChange={(e) =>
                        handleContactChange(
                          index,
                          "enemy_vehicle_no",
                          Number(e.target.value),
                        )
                      }
                      className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                </div>
              </div>

              {/* Targets Treated */}
              <div className="mb-6">
                <h5 className="text-xs font-bold uppercase mb-2 text-gray-400">
                  Targets Treated
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Descriptions"
                      value={contact.targets_treated_description}
                      onChange={(e) =>
                        handleContactChange(
                          index,
                          "targets_treated_description",
                          e.target.value,
                        )
                      }
                      className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Infantry No.
                    </label>
                    <input
                      type="number"
                      placeholder="Enter Number"
                      value={contact.targets_infantry_no || ""}
                      onChange={(e) =>
                        handleContactChange(
                          index,
                          "targets_infantry_no",
                          Number(e.target.value),
                        )
                      }
                      className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Vehicle No.
                    </label>
                    <input
                      type="number"
                      placeholder="Enter Number"
                      value={contact.targets_vehicle_no || ""}
                      onChange={(e) =>
                        handleContactChange(
                          index,
                          "targets_vehicle_no",
                          Number(e.target.value),
                        )
                      }
                      className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                </div>
              </div>

              {/* Damage Received */}
              <div className="mb-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-medium">
                    Damage Received
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Code Name"
                    value={contact.damage_received}
                    onChange={(e) =>
                      handleContactChange(
                        index,
                        "damage_received",
                        e.target.value,
                      )
                    }
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                  />
                </div>
              </div>

              {/* Photos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {contact.photos.map((photo, photoIndex) => (
                  <div
                    key={photoIndex}
                    className="relative h-32 bg-[#001825] border border-[#0A4D66]/40 rounded-lg overflow-hidden group"
                  >
                    <img
                      src={photo.file}
                      alt={`Contact ${index + 1} Photo ${photoIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index, photoIndex)}
                      title={`Remove photo ${photoIndex + 1}`}
                      aria-label={`Remove photo ${photoIndex + 1}`}
                      className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon icon="mdi:close" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center gap-2 h-32 bg-[#001825] border border-dashed border-[#0A4D66]/40 rounded-lg hover:bg-[#002030] transition-colors cursor-pointer">
                  <div className="p-2 bg-[#7FD5FF]/10 rounded-full text-[#7FD5FF]">
                    <Icon icon="mdi:plus" className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-white">
                    Upload Photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(index, e)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Operational Resource Utilisation */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-xs font-bold uppercase text-gray-400">
            OPERATIONAL RESOURCE UTILISATION
          </h3>
          <button
            type="button"
            onClick={addResource}
            className="bg-white text-black text-xs font-bold px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-200 transition-colors"
          >
            <Icon icon="mdi:plus" className="w-4 h-4" /> Add Resource Used
          </button>
        </div>

        <div className="space-y-4">
          {resources.map((res, index) => (
            <div
              key={index}
              className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 relative"
            >
              <button
                type="button"
                onClick={() => removeResource(index)}
                title={`Remove resource ${index + 1}`}
                aria-label={`Remove resource ${index + 1}`}
                className="absolute top-4 right-4 text-gray-500 hover:text-red-400"
              >
                <Icon icon="mdi:trash-can-outline" className="w-5 h-5" />
              </button>

              <h4 className="text-xs font-bold uppercase mb-4 text-gray-400">
                ENTRY {index + 1}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-medium">
                    Item Description
                  </label>
                  <div className="relative">
                    <select
                      title="Resource inventory item"
                      aria-label="Resource inventory item"
                      value={res.inventory_id}
                      onChange={(e) => {
                        const selectedId = Number(e.target.value);
                        const selectedItem = inventories.find(
                          (inv) => inv.id === selectedId,
                        );
                        const newResources = [...resources];
                        newResources[index] = {
                          ...newResources[index],
                          inventory_id: selectedId,
                          item_description:
                            selectedItem?.description ??
                            selectedItem?.part_name ??
                            "",
                        };
                        setResources(newResources);
                      }}
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                    >
                      <option value={0}>Select Item</option>
                      {inventories.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.description}
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
                  <label className="text-xs text-gray-400 font-medium">
                    Quantity
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Select Quantity"
                      value={res.quantity_used || ""}
                      onChange={(e) =>
                        handleResourceChange(
                          index,
                          "quantity_used",
                          Number(e.target.value),
                        )
                      }
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-medium">
                    Asset Assignment
                  </label>
                  <div className="relative">
                    <select
                      title="Resource asset assignment"
                      aria-label="Resource asset assignment"
                      value={res.asset_id}
                      onChange={(e) =>
                        handleResourceChange(
                          index,
                          "asset_id",
                          Number(e.target.value),
                        )
                      }
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] appearance-none"
                    >
                      <option value={0}>Select Asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name || `Asset #${asset.id}`}
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

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-[#0A4D66]/40">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#7FD5FF] text-black font-bold py-3 px-12 rounded hover:bg-[#7FD5FF]/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
};
