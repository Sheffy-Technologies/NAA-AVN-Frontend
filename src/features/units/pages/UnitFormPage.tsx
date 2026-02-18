import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useCreateUnitMutation } from "@/shared/api/units";

type UnitFormValues = {
  name: string;
};

const emptyUnitValues: UnitFormValues = {
  name: "",
};

export const UnitFormPage = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState<UnitFormValues>(emptyUnitValues);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createUnit, { isLoading: isSubmitting }] = useCreateUnitMutation();

  const handleChange =
    (field: keyof UnitFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
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
      await createUnit({ name: values.name.trim() }).unwrap();
      navigate("/dashboard/units");
    } catch {
      setSubmitError("Failed to create unit. Please try again.");
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
            Add Unit
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

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <h2 className="text-sm sm:text-base font-semibold text-white uppercase tracking-wide">
            Unit Details
          </h2>
        </div>
        <div className="px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Unit Name
              </label>
              <input
                type="text"
                value={values.name}
                onChange={handleChange("name")}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
                placeholder="Enter Unit Name"
              />
            </div>
          </div>

          {submitError && (
            <p className="mt-4 text-[11px] sm:text-xs text-red-400">
              {submitError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

