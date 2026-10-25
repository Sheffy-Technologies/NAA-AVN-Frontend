import type { VehicleStatus } from "@/features/assets/api";
import { VEHICLE_STATUSES, type VehicleRegisterValues } from "@/features/assets/vehicleHelpers";

const inputClass =
  "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500";

/**
 * The vehicle register fields on the add and edit forms (model, authority
 * for issue, date issued, location, status). Renders grid cells, so it sits
 * inside the forms' existing three-column grid.
 */
export const VehicleRegisterInputs = ({
  values,
  onChange,
}: {
  values: VehicleRegisterValues;
  onChange: <K extends keyof VehicleRegisterValues>(field: K, value: VehicleRegisterValues[K]) => void;
}) => (
  <>
    <div className="space-y-1">
      <label className="text-[11px] uppercase text-gray-400">Model</label>
      <input
        type="text"
        value={values.model}
        onChange={(e) => onChange("model", e.target.value)}
        placeholder="e.g. Toyota Hilux 2.4"
        title="Vehicle model"
        className={inputClass}
      />
    </div>

    <div className="space-y-1">
      <label className="text-[11px] uppercase text-gray-400">Authority for Issue</label>
      <input
        type="text"
        value={values.issue_authority}
        onChange={(e) => onChange("issue_authority", e.target.value)}
        placeholder="e.g. AHQ DOAA/MT/2026/014"
        title="Authority for issue"
        className={inputClass}
      />
    </div>

    <div className="space-y-1">
      <label className="text-[11px] uppercase text-gray-400">Date Issued</label>
      <input
        type="date"
        value={values.date_issued}
        onChange={(e) => onChange("date_issued", e.target.value)}
        title="Date issued"
        className={inputClass}
      />
    </div>

    <div className="space-y-1">
      <label className="text-[11px] uppercase text-gray-400">Deployment / Location</label>
      <input
        type="text"
        value={values.location}
        onChange={(e) => onChange("location", e.target.value)}
        placeholder="e.g. MT Yard, Kaduna"
        title="Where the vehicle is deployed, within its unit"
        className={inputClass}
      />
    </div>

    <div className="space-y-1">
      <label className="text-[11px] uppercase text-gray-400">Status</label>
      <select
        aria-label="Vehicle status"
        value={values.status}
        onChange={(e) => onChange("status", e.target.value as VehicleStatus)}
        className={`${inputClass} appearance-none`}
      >
        {VEHICLE_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  </>
);
