import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetUnitsQuery } from "@/shared/api/units";
import {
  useGetVehicleTypesQuery,
  useGetVehiclesQuery,
  useUpdateVehicleMutation,
} from "@/features/assets/api";

type VehicleFormValues = {
  name: string;
  vehicle_type_id: number | "";
  registration_number: string;
  serial_number: string;
  unit_id: number | "";
  photo: File | null;
};

const emptyVehicleValues: VehicleFormValues = {
  name: "",
  vehicle_type_id: "",
  registration_number: "",
  serial_number: "",
  unit_id: "",
  photo: null,
};

export const EditVehiclePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const vehicleId = id ? Number(id) : NaN;

  const [values, setValues] = useState<VehicleFormValues>(emptyVehicleValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const { data: units = [] } = useGetUnitsQuery();
  const { data: vehicleTypes = [] } = useGetVehicleTypesQuery();
  const { data: vehicles = [], isLoading: isVehicleLoading } = useGetVehiclesQuery();
  const [updateVehicle, { isLoading: isSubmitting }] = useUpdateVehicleMutation();

  const vehicle = useMemo(
    () => vehicles.find((item) => item.id === vehicleId),
    [vehicles, vehicleId],
  );

  useEffect(() => {
    if (!vehicle) {
      return;
    }

    setValues({
      name: vehicle.name || "",
      vehicle_type_id: vehicle.vehicle_type_id ?? "",
      registration_number: vehicle.registration_number || "",
      serial_number: vehicle.serial_number || "",
      unit_id: vehicle.unit_id ?? "",
      photo: null,
    });
    setPhotoPreviewUrl(vehicle.photo_url || vehicle.photo || null);
  }, [vehicle]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const handleTextChange =
    (field: "name" | "registration_number" | "serial_number") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
      setSubmitError(null);
    };

  const handleSelectChange =
    (field: "vehicle_type_id" | "unit_id") =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value === "" ? "" : Number(event.target.value),
      }));
      setSubmitError(null);
    };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setValues((prev) => ({ ...prev, photo: null }));
      setSubmitError(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSubmitError("Please select an image file.");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setSubmitError("Photo must be 5MB or smaller.");
      return;
    }

    if (photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setValues((prev) => ({ ...prev, photo: file }));
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!vehicle || Number.isNaN(vehicleId)) {
      setSubmitError("Vehicle not found.");
      return;
    }

    if (!values.name.trim()) {
      setSubmitError("Enter vehicle name.");
      return;
    }

    if (values.vehicle_type_id === "") {
      setSubmitError("Select vehicle type.");
      return;
    }

    if (!values.registration_number.trim()) {
      setSubmitError("Enter registration number.");
      return;
    }

    if (values.unit_id === "") {
      setSubmitError("Select unit.");
      return;
    }

    try {
      await updateVehicle({
        id: vehicleId,
        name: values.name.trim(),
        vehicle_type_id: values.vehicle_type_id,
        registration_number: values.registration_number.trim(),
        serial_number: values.serial_number.trim(),
        unit_id: values.unit_id,
        photo: values.photo,
      }).unwrap();

      navigate("/dashboard/assets");
    } catch {
      setSubmitError("Failed to update vehicle. Please try again.");
    }
  };

  if (Number.isNaN(vehicleId)) {
    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 text-red-300">
        Invalid vehicle ID.
      </div>
    );
  }

  if (isVehicleLoading && !vehicle) {
    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 text-gray-400">
        Loading vehicle...
      </div>
    );
  }

  if (!isVehicleLoading && !vehicle) {
    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 text-red-300">
        Vehicle not found.
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-300 hover:text-white"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-white uppercase tracking-wide">
            Edit Vehicle
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/assets")}
          className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-300 hover:text-white"
        >
          <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Name</label>
            <input
              type="text"
              value={values.name}
              onChange={handleTextChange("name")}
              title="Vehicle name"
              placeholder="Enter vehicle name"
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Vehicle Type</label>
            <select
              aria-label="Vehicle type"
              value={values.vehicle_type_id === "" ? "" : String(values.vehicle_type_id)}
              onChange={handleSelectChange("vehicle_type_id")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
            >
              <option value="">Select vehicle type</option>
              {vehicleTypes.map((vehicleType) => (
                <option key={vehicleType.id} value={vehicleType.id}>
                  {vehicleType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Registration Number</label>
            <input
              type="text"
              value={values.registration_number}
              onChange={handleTextChange("registration_number")}
              title="Registration number"
              placeholder="Enter registration number"
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Serial Number</label>
            <input
              type="text"
              value={values.serial_number}
              onChange={handleTextChange("serial_number")}
              title="Serial number"
              placeholder="Enter serial number"
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Unit</label>
            <select
              aria-label="Vehicle unit"
              value={values.unit_id === "" ? "" : String(values.unit_id)}
              onChange={handleSelectChange("unit_id")}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
            >
              <option value="">Select unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Photo</label>
            <input
              type="file"
              aria-label="Vehicle photo"
              accept="image/*"
              onChange={handlePhotoChange}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none file:mr-3 file:rounded file:border-0 file:bg-[#0A4D66] file:px-3 file:py-1 file:text-white"
            />
            {photoPreviewUrl ? (
              <div className="mt-2 rounded-md border border-[#0A4D66]/40 bg-[#001825] p-2">
                <img
                  src={photoPreviewUrl}
                  alt="Vehicle preview"
                  className="h-24 w-full object-cover rounded"
                />
              </div>
            ) : null}
          </div>
        </div>

        {submitError ? (
          <p className="mt-4 text-[11px] text-red-400">{submitError}</p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "px-6 sm:px-10 py-2 rounded text-xs sm:text-sm font-medium transition-colors",
              isSubmitting
                ? "bg-[#0369A1]/40 text-black/60 cursor-not-allowed"
                : "bg-[#0369A1] text-black hover:bg-[#0369A1]/90",
            )}
          >
            {isSubmitting ? "Saving..." : "Update Vehicle"}
          </button>
        </div>
      </section>
    </div>
  );
};
