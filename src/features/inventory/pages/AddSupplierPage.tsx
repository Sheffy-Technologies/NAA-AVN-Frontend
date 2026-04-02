import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useCreateSupplierMutation } from "@/features/inventory/api";

type SupplierFormValues = {
  name: string;
  contact: string;
  email: string;
  address: string;
};

const emptySupplierValues: SupplierFormValues = {
  name: "",
  contact: "",
  email: "",
  address: "",
};

export const AddSupplierPage = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState<SupplierFormValues>(emptySupplierValues);
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierFormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createSupplier, { isLoading }] = useCreateSupplierMutation();

  const handleChange =
    (field: keyof SupplierFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setSubmitError(null);
    };

  const validate = () => {
    const nextErrors: Partial<Record<keyof SupplierFormValues, string>> = {};

    if (!values.name.trim()) {
      nextErrors.name = "Supplier name is required.";
    }

    if (values.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(values.email.trim())) {
        nextErrors.email = "Enter a valid email address.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validate()) return;

    try {
      await createSupplier({
        name: values.name.trim(),
        contact: values.contact.trim() || null,
        email: values.email.trim() || null,
        address: values.address.trim() || null,
      }).unwrap();

      navigate("/dashboard/inventory", {
        state: { inventoryTab: "Suppliers" },
      });
    } catch {
      setSubmitError("Failed to create supplier. Please try again.");
    }
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() =>
              navigate("/dashboard/inventory", {
                state: { inventoryTab: "Suppliers" },
              })
            }
            className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-400 hover:text-gray-200"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            <span>Back to Suppliers</span>
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-white">
            Add Supplier
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors",
            isLoading
              ? "bg-[#7FD5FF]/50 text-black cursor-not-allowed"
              : "bg-[#7FD5FF] text-black hover:bg-[#7FD5FF]/90",
          )}
        >
          <span>{isLoading ? "Saving..." : "Save & Exit"}</span>
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
            Supplier Details
          </h2>
        </div>

        <div className="px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={values.name}
                onChange={handleChange("name")}
                title="Supplier name"
                placeholder="Enter supplier name"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
              />
              {errors.name && (
                <p className="text-[11px] text-red-400">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Contact
              </label>
              <input
                type="text"
                value={values.contact}
                onChange={handleChange("contact")}
                title="Supplier contact"
                placeholder="Enter contact person"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">
                Email
              </label>
              <input
                type="email"
                value={values.email}
                onChange={handleChange("email")}
                title="Supplier email"
                placeholder="Enter supplier email"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
              />
              {errors.email && (
                <p className="text-[11px] text-red-400">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label className="text-[11px] uppercase text-gray-400">
                Address
              </label>
              <input
                type="text"
                value={values.address}
                onChange={handleChange("address")}
                title="Supplier address"
                placeholder="Enter supplier address"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
