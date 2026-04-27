import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetPersonnelRanksQuery,
  useGetPersonnelSpecialtiesQuery,
  useGetPersonnelBranchesQuery,
  useGetPersonnelCorpsQuery,
  useGetPersonnelRatingsQuery,
  useCreatePersonnelMutation,
  useUploadPersonnelImageMutation,
  type CreatePersonnelRequest,
} from "@/features/personnel/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/shared/ui/multi-select/MultiSelect";
import { useGetAssetsQuery } from "@/features/assets/api";

interface ApiError {
  data?: {
    message?: string;
  };
}

type DeploymentFormData = {
  from_unit_id: string;
  to_unit_id: string;
  start_date: string;
  end_date: string;
};

const createEmptyDeployment = (): DeploymentFormData => ({
  from_unit_id: "",
  to_unit_id: "",
  start_date: "",
  end_date: "",
});

type AddPersonnelFormData = {
  service_number: string;
  firstname: string;
  lastname: string;
  othernames: string;
  phone_number: string;
  email: string;
  address: string;
  blood_group: string;
  call_sign: string;
  rating_type: string;
  rank_id: number;
  unit_id: number;
  branch_id: number;
  specialty_id: number;
  corp_id: number;
};

export const AddPersonnelPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [createPersonnel, { isLoading: isSubmitting }] =
    useCreatePersonnelMutation();
  const [uploadImage, { isLoading: isUploadingImage }] =
    useUploadPersonnelImageMutation();

  // Queries
  const { data: ranks } = useGetPersonnelRanksQuery();
  const { data: specialties } = useGetPersonnelSpecialtiesQuery();
  const { data: branches } = useGetPersonnelBranchesQuery();
  const { data: corps } = useGetPersonnelCorpsQuery();
  const { data: ratings = [], isLoading: isLoadingRatings } =
    useGetPersonnelRatingsQuery();
  const { data: units } = useGetUnitsQuery();
  const { data: aircraftAssets = [], isLoading: isLoadingAircraftAssets } =
    useGetAssetsQuery({ type: "aircraft" });

  // Form State
  const [formData, setFormData] = useState<AddPersonnelFormData>({
    service_number: "",
    firstname: "",
    lastname: "",
    othernames: "",
    phone_number: "",
    email: "",
    address: "",
    blood_group: "",
    call_sign: "",
    rating_type: "",
    rank_id: 0,
    unit_id: 0,
    branch_id: 0,
    specialty_id: 0,
    corp_id: 0,
  });

  // Additional State for Ratings & Flight Hours
  const [selectedAircraftIds, setSelectedAircraftIds] = useState<number[]>([]);
  const [flightHours, setFlightHours] = useState<Record<number, string>>({});

  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [ratingExpiryDates, setRatingExpiryDates] = useState<
    Record<number, string>
  >({});

  // Image Upload State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      try {
        const formData = new FormData();
        formData.append("image", file);
        const response = await uploadImage(formData).unwrap();
        setImageUrl(response.data);
      } catch (error) {
        console.error("Failed to upload image:", error);
        // Reset preview if upload fails
        setImagePreview(null);
      }
    }
  };

  const [status, setStatus] = useState<string>("");
  const [deployments, setDeployments] = useState<DeploymentFormData[]>([
    createEmptyDeployment(),
  ]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.endsWith("_id") && value !== "" ? Number(value) : value,
    }));
  };

  const handleAircraftChange = (selected: (string | number)[]) => {
    const ids = selected as number[];
    setSelectedAircraftIds(ids);

    // Clean up flight hours for deselected aircraft
    setFlightHours((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!ids.includes(Number(key))) {
          delete next[Number(key)];
        }
      });
      return next;
    });
  };

  const handleFlightHourChange = (aircraftId: number, value: string) => {
    setFlightHours((prev) => ({
      ...prev,
      [aircraftId]: value,
    }));
  };

  const handleRatingChange = (selected: (string | number)[]) => {
    const ratings = selected as number[];
    setSelectedRatings(ratings);

    setRatingExpiryDates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const ratingId = Number(key);
        if (!ratings.includes(ratingId)) {
          delete next[ratingId];
        }
      });
      return next;
    });
  };

  const handleRatingExpiryChange = (ratingId: number, value: string) => {
    setRatingExpiryDates((prev) => ({
      ...prev,
      [ratingId]: value,
    }));
  };

  const handleDeploymentChange = (
    index: number,
    field: keyof DeploymentFormData,
    value: string,
  ) => {
    setDeployments((prev) =>
      prev.map((deployment, deploymentIndex) =>
        deploymentIndex === index
          ? { ...deployment, [field]: value }
          : deployment,
      ),
    );
  };

  const addDeploymentRow = () => {
    setDeployments((prev) => [...prev, createEmptyDeployment()]);
  };

  const removeDeploymentRow = (index: number) => {
    setDeployments((prev) =>
      prev.length === 1
        ? [createEmptyDeployment()]
        : prev.filter((_, deploymentIndex) => deploymentIndex !== index),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedDeployments = deployments
        .filter((deployment) =>
          Object.values(deployment).some((value) => Boolean(value)),
        )
        .map((deployment) => ({
          from_unit_id: deployment.from_unit_id
            ? Number(deployment.from_unit_id)
            : null,
          to_unit_id: deployment.to_unit_id
            ? Number(deployment.to_unit_id)
            : null,
          start_date: deployment.start_date || null,
          end_date: deployment.end_date || null,
        }));

      const payload: CreatePersonnelRequest = {
        ...formData,
        rank_id: String(formData.rank_id),
        unit_id: String(formData.unit_id),
        branch_id: String(formData.branch_id),
        specialty_id: String(formData.specialty_id),
        corp_id: String(formData.corp_id),
        image: imageUrl || undefined,
        ratings: selectedRatings.map((ratingId) => ({
          rating_id: ratingId,
          expiry_date: ratingExpiryDates[ratingId] || "",
        })),
        flight_experiences: selectedAircraftIds.map((assetId) => ({
          asset_id: assetId,
          flight_hours: Number(flightHours[assetId] || 0),
          notes: "",
        })),
        deployments: normalizedDeployments.length
          ? normalizedDeployments
          : undefined,
      };

      await createPersonnel(payload).unwrap();
      dispatch(
        showToast({
          message: "Personnel created successfully",
          type: "success",
        }),
      );
      navigate("/dashboard/personnel");
    } catch (error) {
      console.error("Failed to create personnel:", error);
      const apiError = error as ApiError;
      const errorMessage =
        apiError?.data?.message || "Failed to create personnel";
      dispatch(
        showToast({
          message: errorMessage,
          type: "error",
        }),
      );
    }
  };

  // Helper for select options
  const renderOptions = (
    items: { id: number; [key: string]: unknown }[] | undefined,
    labelKey: string = "name",
  ) => {
    if (!items) return null;
    return items.map((item) => (
      <option key={item.id} value={item.id}>
        {String(item[labelKey])}
      </option>
    ));
  };

  const aircraftOptions: MultiSelectOption[] = useMemo(() => {
    if (isLoadingAircraftAssets) return [];

    return aircraftAssets.map((a) => ({
      label: `${a.name}${a.tail_number ? ` (${a.tail_number})` : ""}`,
      value: a.id,
    }));
  }, [aircraftAssets, isLoadingAircraftAssets]);

  const ratingOptions: MultiSelectOption[] = useMemo(
    () =>
      ratings.map((rating) => ({
        label: rating.name,
        value: rating.id,
      })),
    [ratings],
  );

  const ratingLabelById = useMemo(
    () =>
      new Map(
        ratingOptions.map((option) => [Number(option.value), option.label]),
      ),
    [ratingOptions],
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
        >
          <Icon icon="mdi:arrow-left" className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-semibold text-white">Add New Personnel</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 max-w-6xl">
        {/* Personnel Identification Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2">
            PERSONNEL IDENTIFICATION
          </h2>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Image Upload */}
            <div className="flex-shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-40 h-40 border-2 border-dashed border-cyan-500/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-cyan-500/10 transition-colors relative overflow-hidden group"
              >
                {imagePreview ? (
                  <div className="relative w-full h-full">
                    <img
                      src={imagePreview}
                      alt="Personnel"
                      className={cn(
                        "w-full h-full object-cover",
                        isUploadingImage && "opacity-50",
                      )}
                    />
                    {isUploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon
                          icon="mdi:loading"
                          className="w-8 h-8 text-white animate-spin"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Icon
                      icon="mdi:account-box-outline"
                      className="w-12 h-12 text-cyan-400 mb-2 group-hover:scale-110 transition-transform"
                    />
                    <span className="text-sm text-cyan-400 font-medium">
                      Upload Photo
                    </span>
                  </>
                )}
                {imagePreview && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                      Change Photo
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Identification Fields */}
            <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField
                label="First Name"
                name="firstname"
                value={formData.firstname}
                onChange={handleChange}
                required
                placeholder="Enter First Name"
              />
              <InputField
                label="Last Name"
                name="lastname"
                value={formData.lastname}
                onChange={handleChange}
                required
                placeholder="Enter Last Name"
              />
              <InputField
                label="Middle Name"
                name="othernames"
                value={formData.othernames}
                onChange={handleChange}
                placeholder="Enter Middle Name"
              />
              <InputField
                label="Service No."
                name="service_number"
                value={formData.service_number}
                onChange={handleChange}
                required
                placeholder="Enter Service No."
              />
              <SelectField
                label="Rank"
                name="rank_id"
                value={formData.rank_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Rank</option>
                {renderOptions(ranks)}
              </SelectField>
              <SelectField
                label="Blood Group"
                name="blood_group"
                value={formData.blood_group}
                onChange={handleChange}
                required
              >
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </SelectField>
              <InputField
                label="Call Sign"
                name="call_sign"
                value={formData.call_sign}
                onChange={handleChange}
                placeholder="Enter Call Sign"
              />
              {/* <InputField
                label="Dialogue Box"
                placeholder="Enter Dialogue Box"
                disabled // Placeholder as requested in UI but no field in form data yet?
              /> */}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <MultiSelect
              label="Type of License"
              placeholder="Select Type of License"
              options={ratingOptions}
              selectedValues={selectedRatings}
              onChange={handleRatingChange}
              disabled={isLoadingRatings}
            />
            <MultiSelect
              label="Aircraft Rated On"
              placeholder="Select Status"
              options={aircraftOptions}
              selectedValues={selectedAircraftIds}
              onChange={handleAircraftChange}
            />
          </div>
        </div>

        {/* Aircraft Ratings Validity Section */}
        {selectedRatings.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2 uppercase">
              Aircraft Ratings Validity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedRatings.map((rating) => (
                <InputField
                  key={rating}
                  label={`${ratingLabelById.get(rating) || "Rating"} Expiry Date`}
                  type="date"
                  value={ratingExpiryDates[rating] || ""}
                  onChange={(e) =>
                    handleRatingExpiryChange(rating, e.target.value)
                  }
                  placeholder="00/00/0000"
                  required
                />
              ))}
            </div>
          </div>
        )}

        {/* Aircraft Operational Experience Section */}
        {selectedAircraftIds.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2 uppercase">
              Aircraft Operational Experience
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedAircraftIds.map((aircraftId) => {
                const aircraft = aircraftAssets.find(
                  (a) => a.id === aircraftId,
                );
                return (
                  <InputField
                    key={aircraftId}
                    label={aircraft?.name || "Unknown Aircraft"}
                    type="number"
                    value={flightHours[aircraftId] || ""}
                    onChange={(e) =>
                      handleFlightHourChange(aircraftId, e.target.value)
                    }
                    placeholder="Enter Total Flight Hours"
                    min="0"
                    step="0.1"
                    required
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Service Details Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2 uppercase">
            Service Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SelectField
              label="Branch"
              name="branch_id"
              value={formData.branch_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Branch</option>
              {renderOptions(branches)}
            </SelectField>

            <SelectField
              label="Specialty"
              name="specialty_id"
              value={formData.specialty_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Specialty</option>
              {renderOptions(specialties)}
            </SelectField>

            <SelectField
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Select Status</option>
              <option value="Active">Active</option>
              <option value="Grounded">Grounded</option>
              <option value="Medical">Medical</option>
            </SelectField>

            {/* Fields required by API */}
            <SelectField
              label="Unit"
              name="unit_id"
              value={formData.unit_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Unit</option>
              {renderOptions(units)}
            </SelectField>

            <SelectField
              label="Corp"
              name="corp_id"
              value={formData.corp_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Corp</option>
              {renderOptions(corps)}
            </SelectField>
          </div>
        </div>

        {/* Deployment Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
            <h2 className="text-lg font-medium text-cyan-400 uppercase">
              Deployment
            </h2>
            <button
              type="button"
              onClick={addDeploymentRow}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
            >
              <Icon icon="mdi:plus" className="h-4 w-4" />
              Add Deployment
            </button>
          </div>
          <div className="space-y-4">
            {deployments.map((deployment, index) => (
              <div
                key={index}
                className="rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-white">
                    Deployment {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDeploymentRow(index)}
                    className="inline-flex items-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
                  >
                    <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SelectField
                    label="From Unit"
                    value={deployment.from_unit_id}
                    onChange={(e) =>
                      handleDeploymentChange(index, "from_unit_id", e.target.value)
                    }
                  >
                    <option value="">Select Unit</option>
                    {renderOptions(units)}
                  </SelectField>
                  <SelectField
                    label="To Unit"
                    value={deployment.to_unit_id}
                    onChange={(e) =>
                      handleDeploymentChange(index, "to_unit_id", e.target.value)
                    }
                  >
                    <option value="">Select Unit</option>
                    {renderOptions(units)}
                  </SelectField>
                  <InputField
                    label="Start Date"
                    type="date"
                    value={deployment.start_date}
                    onChange={(e) =>
                      handleDeploymentChange(index, "start_date", e.target.value)
                    }
                  />
                  <InputField
                    label="End Date"
                    type="date"
                    value={deployment.end_date}
                    onChange={(e) =>
                      handleDeploymentChange(index, "end_date", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2 uppercase">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter Email"
            />
            <InputField
              label="Phone No."
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              required
              placeholder="Enter Phone No."
            />
            <InputField
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              placeholder="Enter Address"
            />
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-12 py-3 bg-[#7FD5FF] text-black font-semibold rounded-md hover:bg-[#7FD5FF]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7FD5FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
          >
            {isSubmitting ? "Creating..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
};

// Reusable Components within the page for simplicity

const InputField = ({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {label}
    </label>
    <input
      className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40 transition-all disabled:opacity-50"
      {...props}
    />
  </div>
);

const SelectField = ({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {label}
    </label>
    <div className="relative">
      <select
        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40 transition-all cursor-pointer disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <Icon icon="mdi:chevron-down" className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  </div>
);
