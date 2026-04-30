import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useCreateFacilityMutation } from "@/features/assets/api";

type FacilityFormValues = {
  name: string;
  image: File | null;
  description: string;
  longitude: string;
  latitude: string;
};

const emptyFacilityValues: FacilityFormValues = {
  name: "",
  image: null,
  description: "",
  longitude: "",
  latitude: "",
};

export const AddFacilityPage = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState<FacilityFormValues>(emptyFacilityValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createFacility, { isLoading: isSubmitting }] = useCreateFacilityMutation();

  const handleTextChange =
    (field: "name" | "description" | "longitude" | "latitude") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
      setSubmitError(null);
    };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({
      ...prev,
      image: event.target.files?.[0] ?? null,
    }));
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setSubmitError("Enter facility name.");
      return;
    }

    if (!values.description.trim()) {
      setSubmitError("Enter facility description.");
      return;
    }

    if (!values.longitude.trim()) {
      setSubmitError("Enter longitude.");
      return;
    }

    if (!values.latitude.trim()) {
      setSubmitError("Enter latitude.");
      return;
    }

    try {
      await createFacility({
        name: values.name.trim(),
        image: values.image,
        description: values.description.trim(),
        longitude: values.longitude.trim(),
        latitude: values.latitude.trim(),
      }).unwrap();

      navigate("/dashboard/assets");
    } catch {
      setSubmitError("Failed to save facility. Please try again.");
    }
  };

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
            Add Facility
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
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Name</label>
            <input
              type="text"
              value={values.name}
              onChange={handleTextChange("name")}
              placeholder="Enter facility name"
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Image</label>
            <input
              type="file"
              accept="image/*"
              aria-label="Facility image"
              onChange={handleImageChange}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none file:mr-3 file:rounded file:border-0 file:bg-[#0A4D66] file:px-3 file:py-1 file:text-white"
            />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label className="text-[11px] uppercase text-gray-400">Description</label>
            <textarea
              rows={4}
              value={values.description}
              onChange={handleTextChange("description")}
              placeholder="Enter facility description"
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Longitude</label>
            <input
              type="text"
              value={values.longitude}
              onChange={handleTextChange("longitude")}
              placeholder="e.g. 3.3792"
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase text-gray-400">Latitude</label>
            <input
              type="text"
              value={values.latitude}
              onChange={handleTextChange("latitude")}
              placeholder="e.g. 6.5244"
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
            />
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
            {isSubmitting ? "Saving..." : "Save Facility"}
          </button>
        </div>
      </section>
    </div>
  );
};
