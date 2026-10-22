import { useState, useMemo, useEffect } from "react";
import { Icon } from "@iconify/react";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import {
  useCreateAfterActionReportMutation,
  useGetOperationByIdQuery,
  useUpdateOperationMutation,
  useGetCommandingOfficersQuery,
  type CreateAfterActionReportRequest,
  type Contact,
  type OperationAssignedAsset,
  type ResourceUtilization,
  type Operation,
} from "../api";
import { AARSignatureTable } from "./AARSignatureTable";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { useGetAssetsQuery, useUploadAssetImageMutation } from "@/features/assets/api";

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
  const dispatch = useAppDispatch();
  const [createReport, { isLoading }] = useCreateAfterActionReportMutation();
  const [updateOperation] = useUpdateOperationMutation();
  const [uploadImage] = useUploadAssetImageMutation();
  const { data: fetchedOperation } = useGetOperationByIdQuery(operationId);
  const operation = initialOperation || fetchedOperation;
  const { data: inventories = [] } = useGetInventoriesQuery();
  const { data: assets = [] } = useGetAssetsQuery();
  const { data: commandingOfficers = [] } = useGetCommandingOfficersQuery();

  const [signers, setSigners] = useState<{
    co: { name: string; serviceNumber: string; rank: string; userId: number | null; signature: string | null };
    pic: { name: string; serviceNumber: string; rank: string; personnelId: number | null; signature: string | null };
    copilot: { name: string; serviceNumber: string; rank: string; personnelId: number | null; signature: string | null };
  }>({
    co: { name: "", serviceNumber: "", rank: "", userId: null, signature: null },
    pic: { name: "", serviceNumber: "", rank: "", personnelId: null, signature: null },
    copilot: { name: "", serviceNumber: "", rank: "", personnelId: null, signature: null },
  });

  const rawUnitName = (operation as { unit?: { name?: string } })?.unit?.name || "";
  const isHqUnit = /HQ|HEADQUARTERS|COMMAND/i.test(rawUnitName);
  const initialUnit = isHqUnit ? "" : rawUnitName;
  const initialAssetCount = operation?.assets?.length ?? 0;
  const initialFormation =
    initialAssetCount > 1
      ? "formation"
      : initialAssetCount === 1
      ? "single_ship"
      : "none";

  const [formData, setFormData] = useState<
    Omit<
      CreateAfterActionReportRequest,
      "operation_id" | "contacts" | "resource_utilizations"
    >
  >({
    mission: "logistics",
    task_no: "",
    report_date: new Date().toISOString().split("T")[0],
    infantry_no: 0,
    vehicles_no: 0,
    ammo_spent: "",
    unit_formation: initialUnit,
    aircraft_formation: initialFormation,
    activities: "",
  });

  useEffect(() => {
    if (operation) {
      const uName = (operation as { unit?: { name?: string } })?.unit?.name || "";
      const isHq = /HQ|HEADQUARTERS|COMMAND/i.test(uName);
      const assetCount = operation.assets?.length ?? 0;
      const computedFormation =
        assetCount > 1 ? "formation" : assetCount === 1 ? "single_ship" : "none";

      setFormData((prev) => ({
        ...prev,
        unit_formation: prev.unit_formation ? prev.unit_formation : isHq ? "" : uName,
        aircraft_formation: prev.aircraft_formation ?? computedFormation,
      }));

      // Pre-fill PIC and Co-Pilot from operation assets
      const firstAsset = operation.assets?.[0];
      const pilotDetails =
        (firstAsset as unknown as { pilot_details?: Record<string, unknown> })?.pilot_details ||
        (firstAsset as unknown as { pilot?: Record<string, unknown> })?.pilot;
      const coPilotDetails =
        (firstAsset as unknown as { co_pilot_details?: Record<string, unknown> })?.co_pilot_details ||
        (firstAsset as unknown as { co_pilot?: Record<string, unknown> })?.co_pilot;

      const pRank =
        pilotDetails && typeof pilotDetails.rank === "object"
          ? (pilotDetails.rank as { name?: string })?.name || ""
          : (pilotDetails?.rank as string) || "";
      const pFirst = (pilotDetails?.firstname as string) || "";
      const pLast = (pilotDetails?.lastname as string) || "";
      const pSvc = (pilotDetails?.service_number as string) || "";
      const pId =
        (firstAsset?.pilot_id as number) ||
        (firstAsset?.pivot?.pilot_id as number) ||
        (pilotDetails?.id as number) ||
        null;

      const cpRank =
        coPilotDetails && typeof coPilotDetails.rank === "object"
          ? (coPilotDetails.rank as { name?: string })?.name || ""
          : (coPilotDetails?.rank as string) || "";
      const cpFirst = (coPilotDetails?.firstname as string) || "";
      const cpLast = (coPilotDetails?.lastname as string) || "";
      const cpSvc = (coPilotDetails?.service_number as string) || "";
      const cpId =
        (firstAsset?.co_pilot_id as number) ||
        (firstAsset?.pivot?.co_pilot_id as number) ||
        (coPilotDetails?.id as number) ||
        null;

      setSigners((prev) => ({
        ...prev,
        pic: {
          name: prev.pic.name || `${pFirst} ${pLast}`.trim(),
          serviceNumber: prev.pic.serviceNumber || pSvc,
          rank: prev.pic.rank || pRank,
          personnelId: prev.pic.personnelId || pId,
          signature: prev.pic.signature,
        },
        copilot: {
          name: prev.copilot.name || `${cpFirst} ${cpLast}`.trim(),
          serviceNumber: prev.copilot.serviceNumber || cpSvc,
          rank: prev.copilot.rank || cpRank,
          personnelId: prev.copilot.personnelId || cpId,
          signature: prev.copilot.signature,
        },
      }));
    }
  }, [operation]);

  useEffect(() => {
    if (commandingOfficers.length > 0) {
      const primaryCo = commandingOfficers[0];
      setSigners((prev) => ({
        ...prev,
        co: {
          name: prev.co.name || primaryCo.name || "",
          serviceNumber: prev.co.serviceNumber || primaryCo.service_number || "",
          rank: prev.co.rank || primaryCo.rank || "",
          userId: prev.co.userId || primaryCo.user_id || null,
          signature: prev.co.signature,
        },
      }));
    }
  }, [commandingOfficers]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [resources, setResources] = useState<ResourceUtilization[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState<Set<string>>(new Set());
  const [flightTimes, setFlightTimes] = useState<Record<number, {
    departure_takeoff: string;
    departure_landing: string;
    return_takeoff: string;
    return_landing: string;
  }>>({});

  const inventoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      inventories.map((inv) => {
        const desc = (inv.description || "").trim();
        const partName = (inv.part_name || "").trim();
        const partNo = (inv.part_number || "").trim();
        const label =
          desc ||
          partName ||
          (partNo ? `Part No. ${partNo}` : "") ||
          `Inventory #${inv.id}`;

        const details: string[] = [];
        if (partNo && desc && !desc.toLowerCase().includes(partNo.toLowerCase())) {
          details.push(`P/N: ${partNo}`);
        }
        if (inv.current_stock !== undefined && inv.current_stock !== null) {
          details.push(`Stock: ${inv.current_stock} ${inv.measurement_unit || "units"}`.trim());
        }
        if (inv.store) {
          details.push(`Store: ${inv.store}`);
        }

        return {
          value: inv.id,
          label,
          description: details.join(" • ") || undefined,
        };
      }),
    [inventories],
  );

  const assetOptions = useMemo<SearchableSelectOption[]>(
    () =>
      assets.map((asset) => {
        const details: string[] = [];
        if (asset.tail_number) details.push(`Tail: ${asset.tail_number}`);
        if (asset.type) details.push(asset.type);

        return {
          value: asset.id,
          label: asset.name || asset.tail_number || `Asset #${asset.id}`,
          description: details.join(" • ") || undefined,
        };
      }),
    [assets],
  );

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

  const getAssetFlightTimes = (idx: number, asset: OperationAssignedAsset) => {
    const departureTakeoff = asset.departure_takeoff ?? asset.pivot?.departure_takeoff;
    const departureLanding = asset.departure_landing ?? asset.pivot?.departure_landing;
    const arrivalTakeoff = asset.arrival_takeoff ?? asset.pivot?.arrival_takeoff;
    const arrivalLanding = asset.arrival_landing ?? asset.pivot?.arrival_landing;

    return {
      departure_takeoff: flightTimes[idx]?.departure_takeoff ?? (departureTakeoff?.slice(0, 5) || ""),
      departure_landing: flightTimes[idx]?.departure_landing ?? (departureLanding?.slice(0, 5) || ""),
      return_takeoff: flightTimes[idx]?.return_takeoff ?? (arrivalTakeoff?.slice(0, 5) || ""),
      return_landing: flightTimes[idx]?.return_landing ?? (arrivalLanding?.slice(0, 5) || ""),
    };
  };

  const calculateAssetTotalMinutes = (idx: number, asset: OperationAssignedAsset): number => {
    const times = getAssetFlightTimes(idx, asset);
    const depMinutes = calculateDurationMinutes(times.departure_takeoff, times.departure_landing);
    const retMinutes = calculateDurationMinutes(times.return_takeoff, times.return_landing);
    return depMinutes + retMinutes;
  };

  const calculateAssetCycleCount = (idx: number, asset: OperationAssignedAsset): number => {
    const times = getAssetFlightTimes(idx, asset);
    let count = 0;

    if (times.departure_takeoff && times.departure_landing) {
      count += 1;
    }

    if (times.return_takeoff && times.return_landing) {
      count += 1;
    }

    return count;
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

  const handlePhotoUpload = async (
    contactIndex: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";

    const photoIndex = (contacts[contactIndex]?.photos ?? []).length;
    const key = `${contactIndex}-${photoIndex}`;

    // Insert placeholder while uploading
    setContacts((prev) => {
      const updated = [...prev];
      if (!updated[contactIndex]) return prev;
      updated[contactIndex] = {
        ...updated[contactIndex],
        photos: [...(updated[contactIndex].photos ?? []), { file: "" }],
      };
      return updated;
    });
    setUploadingPhotos((prev) => new Set(prev).add(key));

    try {
      const result = await uploadImage(file).unwrap();
      const url =
        result.image_url ||
        result.file_url ||
        result.image ||
        result.file ||
        result.data ||
        "";

      setContacts((prev) => {
        const updated = [...prev];
        const photos = [...(updated[contactIndex]?.photos ?? [])];
        photos[photoIndex] = { file: url };
        updated[contactIndex] = { ...updated[contactIndex], photos };
        return updated;
      });
    } catch {
      // Remove the placeholder on failure
      setContacts((prev) => {
        const updated = [...prev];
        const photos = (updated[contactIndex]?.photos ?? []).filter(
          (_, i) => i !== photoIndex,
        );
        updated[contactIndex] = { ...updated[contactIndex], photos };
        return updated;
      });
    } finally {
      setUploadingPhotos((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const removePhoto = (contactIndex: number, photoIndex: number) => {
    const newContacts = [...contacts];
    const currentContact = newContacts[contactIndex];
    if (!currentContact) return;
    currentContact.photos = (currentContact.photos ?? []).filter(
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
        date_of_contact: formData.report_date || "",
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

            const cycleCount = calculateAssetCycleCount(idx, asset);

            // The operation endpoints return each row as the asset itself (`id` is the
            // asset id) with crew and times under `pivot`; other shapes use asset_id.
            return {
              asset_id: asset.asset_id ?? asset.asset?.id ?? asset.pivot?.asset_id ?? asset.id ?? 0,
              pilot_id: asset.pilot_id ?? asset.pivot?.pilot_id ?? null,
              co_pilot_id: asset.co_pilot_id ?? asset.pivot?.co_pilot_id ?? null,
              departure_takeoff: toApiTime(times.departure_takeoff),
              departure_landing: toApiTime(times.departure_landing),
              arrival_takeoff: toApiTime(times.return_takeoff),
              arrival_landing: toApiTime(times.return_landing),
              flight_hours: Number((calculateAssetTotalMinutes(idx, asset) / 60).toFixed(2)),
              landing: cycleCount,
              cycle: cycleCount,
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

      const contactsPayload = contacts.map((c) => ({
        ...c,
        date_of_contact: formData.report_date || c.date_of_contact || new Date().toISOString().split("T")[0],
      }));

      await createReport({
        operation_id: operationId,
        ...formData,
        contacts: contactsPayload,
        resource_utilizations: resources,
        co_name: signers.co.name || null,
        co_service_number: signers.co.serviceNumber || null,
        co_rank: signers.co.rank || null,
        co_user_id: signers.co.userId || null,
        co_signature: signers.co.signature || null,
        pic_name: signers.pic.name || null,
        pic_service_number: signers.pic.serviceNumber || null,
        pic_rank: signers.pic.rank || null,
        pic_personnel_id: signers.pic.personnelId || null,
        pic_signature: signers.pic.signature || null,
        copilot_name: signers.copilot.name || null,
        copilot_service_number: signers.copilot.serviceNumber || null,
        copilot_rank: signers.copilot.rank || null,
        copilot_personnel_id: signers.copilot.personnelId || null,
        copilot_signature: signers.copilot.signature || null,
      }).unwrap();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Failed to submit AAR:", error);
      const responseError = error as { data?: { message?: string } };
      dispatch(
        showToast({
          message: responseError?.data?.message || "Failed to submit after action report.",
          type: "error",
        }),
      );
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
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
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
          <label className="text-xs text-gray-400 font-medium">Date</label>
          <div className="relative">
            <Icon
              icon="mdi:calendar"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="date"
              title="Report Date"
              value={formData.report_date || ""}
              onChange={(e) =>
                setFormData({ ...formData, report_date: e.target.value })
              }
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">Aircraft</label>
          <div className="relative">
            <select
              value={formData.aircraft_formation || "none"}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  aircraft_formation: e.target.value as "none" | "single_ship" | "formation",
                })
              }
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark cursor-pointer"
            >
              <option value="none" className="bg-[#001825] text-white">None</option>
              <option value="single_ship" className="bg-[#001825] text-white">Single Ship</option>
              <option value="formation" className="bg-[#001825] text-white">Formation</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">Unit / Formation</label>
          <input
            type="text"
            placeholder="Enter Battalion / Formation (e.g. 212 Battalion)"
            value={formData.unit_formation || ""}
            onChange={(e) =>
              setFormData({ ...formData, unit_formation: e.target.value })
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
            min="0"
            placeholder="Enter Infantry Count"
            value={formData.infantry_no || ""}
            onChange={(e) =>
              setFormData({ ...formData, infantry_no: Number(e.target.value) })
            }
            className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">
            Vehicles
          </label>
          <input
            type="number"
            min="0"
            placeholder="Enter Vehicles Count"
            value={formData.vehicles_no || ""}
            onChange={(e) =>
              setFormData({ ...formData, vehicles_no: Number(e.target.value) })
            }
            className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          />
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">
            Ammo Spent
          </label>
          <input
            type="text"
            placeholder="e.g. 500x 7.62mm, 4x Rockets"
            value={formData.ammo_spent || ""}
            onChange={(e) =>
              setFormData({ ...formData, ammo_spent: e.target.value })
            }
            className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
          />
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium">
            Activities
          </label>
          <textarea
            placeholder="Enter Activities"
            value={formData.activities}
            onChange={(e) =>
              setFormData({ ...formData, activities: e.target.value })
            }
            className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] min-h-25"
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
                      {asset.name || asset.asset?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">
                      Pilot In Command
                    </label>
                    <p className="text-sm text-white font-semibold">
                      {(asset.pilot_details || asset.pilot)
                        ? getPersonnelDisplayName(asset.pilot_details ?? asset.pilot!)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">
                      Co-Pilot
                    </label>
                    <p className="text-sm text-white font-semibold">
                      {(asset.co_pilot_details || asset.co_pilot)
                        ? getPersonnelDisplayName(asset.co_pilot_details ?? asset.co_pilot!)
                        : "N/A"}
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
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
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
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
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
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
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
                          className="bg-[#001825] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
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
            className="bg-[#0A4D66] text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 hover:bg-[#083c50] transition-colors"
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
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      placeholder="Enter Location"
                      value={contact.location}
                      onChange={(e) =>
                        handleContactChange(index, "location", e.target.value)
                      }
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-medium">
                    Time Of Contact
                  </label>
                  <div className="relative">
                    <Icon
                      icon="mdi:clock-outline"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
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
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded p-3 pl-10 text-sm text-white focus:outline-none focus:border-[#7FD5FF] scheme-dark"
                    />
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
                {(contact.photos ?? []).map((photo, photoIndex) => {
                  const isUploading = uploadingPhotos.has(`${index}-${photoIndex}`);
                  return (
                    <div
                      key={photoIndex}
                      className="relative h-32 bg-[#001825] border border-[#0A4D66]/40 rounded-lg overflow-hidden group"
                    >
                      {isUploading ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon icon="mdi:loading" className="w-8 h-8 text-[#7FD5FF] animate-spin" />
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  );
                })}
                <label className="flex flex-col items-center justify-center gap-2 h-32 bg-[#001825] border border-dashed border-[#0A4D66]/40 rounded-lg hover:bg-[#001825] transition-colors cursor-pointer">
                  <div className="p-2 bg-[#0369A1]/10 rounded-full text-[#7FD5FF]">
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
            className="bg-[#0A4D66] text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 hover:bg-[#083c50] transition-colors"
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
                  <SearchableSelect
                    placeholder="Select Item"
                    searchPlaceholder="Search by part number, name..."
                    options={inventoryOptions}
                    value={res.inventory_id && res.inventory_id > 0 ? res.inventory_id : null}
                    onChange={(val) => {
                      const selectedId = val ? Number(val) : 0;
                      const selectedItem = inventories.find(
                        (inv) => inv.id === selectedId,
                      );
                      const newResources = [...resources];
                      newResources[index] = {
                        ...newResources[index],
                        inventory_id: selectedId,
                        item_description:
                          selectedItem?.description ||
                          selectedItem?.part_name ||
                          selectedItem?.part_number ||
                          "",
                      };
                      setResources(newResources);
                    }}
                    size="md"
                    className="w-full"
                  />
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
                      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-medium">
                    Asset Assignment
                  </label>
                  <SearchableSelect
                    placeholder="Select Asset"
                    searchPlaceholder="Search aircraft, vehicle..."
                    options={assetOptions}
                    value={res.asset_id && res.asset_id > 0 ? res.asset_id : null}
                    onChange={(val) => {
                      handleResourceChange(
                        index,
                        "asset_id",
                        val ? Number(val) : 0,
                      );
                    }}
                    size="md"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AAR Authentication & Signatures Section */}
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        <AARSignatureTable
          operationId={operationId}
          operationName={operation?.name}
          isFormMode={true}
          prefilledSigners={signers}
          onUpdateSigner={(role, field, value) => {
            setSigners((prev) => ({
              ...prev,
              [role]: {
                ...prev[role],
                [field]: value,
              },
            }));
          }}
        />
      </section>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-[#0A4D66]/40">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#0A4D66] text-white font-bold py-3 px-12 rounded hover:bg-[#083c50] transition-colors disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
};
