import { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useGetUnitsQuery,
} from "@/shared/api/units";
import { useGetFacilitiesQuery } from "@/features/assets/api";

type UnitFormValues = {
  name: string;
  description: string;
  facility_id: string;
};

const emptyUnitValues: UnitFormValues = {
  name: "",
  description: "",
  facility_id: "",
};

export const UnitFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const { data: units } = useGetUnitsQuery(undefined, {
    skip: !isEditMode,
  });

  const { data: facilities, isLoading: isLoadingFacilities } =
    useGetFacilitiesQuery();

  const [values, setValues] = useState<UnitFormValues>(emptyUnitValues);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createUnit, { isLoading: isCreating }] = useCreateUnitMutation();
  const [updateUnit, { isLoading: isUpdating }] = useUpdateUnitMutation();
  const isSubmitting = isCreating || isUpdating;

  useEffect(() => {
    if (isEditMode && units) {
      const unit = units.find((u) => u.id === Number(id));
      if (unit) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValues({
          name: unit.name,
          description: unit.description || "",
          facility_id: unit.facility_id != null ? String(unit.facility_id) : "",
        });
      }
    }
  }, [isEditMode, units, id]);

  const handleChange =
    (field: keyof UnitFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
      setSubmitError(null);
    };

  const handleSelectChange =
    (field: keyof UnitFormValues) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
      setSubmitError(null);
    };

  const handleBack = () => {
    navigate("/dashboard/units");
  };

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setSubmitError("Unit name is required.");
      return;
    }

    try {
      const facility_id = values.facility_id ? Number(values.facility_id) : null;

      if (isEditMode && id) {
        await updateUnit({
          id: Number(id),
          name: values.name.trim(),
          description: values.description.trim(),
          facility_id,
        }).unwrap();
      } else {
        await createUnit({
          name: values.name.trim(),
          description: values.description.trim(),
          facility_id,
        }).unwrap();
      }
      navigate("/dashboard/units");
    } catch {
      setSubmitError(
        `Failed to ${isEditMode ? "update" : "create"} unit. Please try again.`,
      );
    }
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-400 hover:text-gray-200"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            <span>Back to Units</span>
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-white">
            {isEditMode ? "Edit Unit" : "Add Unit"}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors",
            isSubmitting
              ? "bg-[#7FD5FF]/50 text-black cursor-not-allowed"
              : "bg-[#7FD5FF] text-black hover:bg-[#7FD5FF]/90",
          )}
        >
          <span>{isSubmitting ? "Saving..." : "Save & Exit"}</span>
          <Icon icon="mdi:content-save-outline" className="w-4 h-4" />
        </button>
      </section>

      {submitError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          {submitError}
        </div>
      )}

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <h2 className="text-sm sm:text-base font-semibold text-white uppercase tracking-wide">
            Unit Details
          </h2>
        </div>
        <div className="px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Unit Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={values.name}
                onChange={handleChange("name")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                placeholder="Enter Unit Name"
              />
            </div>

             <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                  Facility
              </label>
              <select
                  value={values.facility_id}
                  onChange={handleSelectChange("facility_id")}
                disabled={isLoadingFacilities}
                  aria-label="Select Facility"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none focus:border-[#7FD5FF]/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">
                    {isLoadingFacilities ? "Loading facilities..." : "Select Facility"}
                </option>
                {facilities?.map((facility) => (
                  <option key={facility.id} value={String(facility.id)}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>

            
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Description
              </label>
              <input
                type="text"
                value={values.description}
                onChange={handleChange("description")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                placeholder="Enter Description"
              />
            </div>
           
          </div>
        </div>
      </section>
    </div>
  );
};
