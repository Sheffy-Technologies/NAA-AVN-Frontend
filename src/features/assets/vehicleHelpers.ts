import type { Vehicle, VehicleStatus } from "./api";

/** Same values as App\Models\Vehicle::STATUSES on the backend. */
export const VEHICLE_STATUSES: { value: VehicleStatus; label: string }[] = [
  { value: "serviceable", label: "Serviceable" },
  { value: "unserviceable", label: "Unserviceable" },
  { value: "under_repair", label: "Under Repair" },
  { value: "written_off", label: "Written Off" },
];

/** The register fields as the add/edit forms hold them (VehicleRegisterInputs). */
export type VehicleRegisterValues = {
  model: string;
  issue_authority: string;
  date_issued: string;
  location: string;
  status: VehicleStatus;
};

export const emptyVehicleRegisterValues: VehicleRegisterValues = {
  model: "",
  issue_authority: "",
  date_issued: "",
  location: "",
  status: "serviceable",
};

export const vehicleStatusLabel = (status?: string | null) =>
  VEHICLE_STATUSES.find((s) => s.value === status)?.label ?? (status ? status.replace(/_/g, " ") : "Serviceable");

/** Text colour and dot colour for a vehicle status. */
export const vehicleStatusTone = (status?: string | null) =>
  status === "under_repair"
    ? { text: "text-amber-400", dot: "bg-amber-500" }
    : status === "unserviceable" || status === "written_off"
      ? { text: "text-red-400", dot: "bg-red-500" }
      : { text: "text-emerald-400", dot: "bg-emerald-500" };

export const fmtVehicleDate = (value?: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

/** "Pickup Truck / Toyota Hilux": the register's Vehicle Type/Model column. */
export const vehicleTypeModel = (vehicle: Vehicle, typeName?: string | null) =>
  [typeName ?? vehicle.vehicle_type?.name, vehicle.model].filter(Boolean).join(" / ") || "-";

/** "601 Avn Bn – Motor Transport Yard": the register's Deployment/Location column. */
export const vehicleDeployment = (vehicle: Vehicle, unitName?: string | null) =>
  [unitName ?? vehicle.unit?.name, vehicle.location].filter((v) => v && v !== "-").join(" – ") || "-";

/**
 * The vehicle register's columns, in order. Used by the list, its Excel
 * export and the details page so the three always agree.
 */
export const vehicleRegisterRow = (vehicle: Vehicle, typeName?: string | null, unitName?: string | null) => ({
  "Vehicle Type/Model": vehicleTypeModel(vehicle, typeName),
  "Chassis Number": vehicle.chassis_number || "-",
  "Registration Number": vehicle.registration_number || "-",
  "Authority for Issue": vehicle.issue_authority || "-",
  "Date Issued": fmtVehicleDate(vehicle.date_issued),
  "Deployment/Location": vehicleDeployment(vehicle, unitName),
  Status: vehicleStatusLabel(vehicle.status),
});
