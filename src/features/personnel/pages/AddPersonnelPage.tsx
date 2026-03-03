import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetPersonnelRanksQuery,
  useGetPersonnelSpecialtiesQuery,
  useGetPersonnelBranchesQuery,
  useGetPersonnelCorpsQuery,
  useGetAircraftsQuery,
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

interface ApiError {
  data?: {
    message?: string;
  };
}

const RATING_OPTIONS: MultiSelectOption[] = [
  { label: "PPL", value: "PPL" },
  { label: "CPL", value: "CPL" },
  { label: "ATPL", value: "ATPL" },
  { label: "IR", value: "IR" },
  { label: "ME", value: "ME" },
  { label: "NVG", value: "NVG" },
  { label: "Tactical", value: "Tactical" },
  { label: "QFI", value: "QFI" },
  { label: "Cat A", value: "Cat A" },
  { label: "B1", value: "B1" },
  { label: "B2", value: "B2" },
  { label: "C", value: "C" },
];

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
  const { data: units } = useGetUnitsQuery();
  const { data: aircrafts, isLoading: isLoadingAircrafts } =
    useGetAircraftsQuery();

  // Form State
  const [formData, setFormData] = useState<CreatePersonnelRequest>({
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

  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [ratingExpiryDates, setRatingExpiryDates] = useState<
    Record<string, string>
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
  const [currentDeploymentUnitId, setCurrentDeploymentUnitId] =
    useState<string>("");
  const [currentDeploymentDate, setCurrentDeploymentDate] =
    useState<string>("");
  const [lastDeploymentUnitId, setLastDeploymentUnitId] = useState<string>("");
  const [lastDeploymentDate, setLastDeploymentDate] = useState<string>("");
  const [tosDate, setTosDate] = useState<string>("");

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
    const ratings = selected as string[];
    setSelectedRatings(ratings);

    // Clean up expiry dates for deselected ratings
    setRatingExpiryDates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!ratings.includes(key)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const handleRatingExpiryChange = (rating: string, value: string) => {
    setRatingExpiryDates((prev) => ({
      ...prev,
      [rating]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare the payload strictly according to the user's request body
      // Note: flightHours, selectedAircraftIds, ratingExpiryDates are collected but not sent
      // in the CreatePersonnelRequest as per the current API definition.

      const aircraftNames = selectedAircraftIds
        .map((id) => aircrafts?.find((a) => a.id === id)?.name)
        .filter(Boolean) as string[];

      const payload: CreatePersonnelRequest = {
        ...formData,
        rating_type: [...selectedRatings, ...aircraftNames].join(","), // Join selected ratings and aircraft names
        // Ensure numeric fields are numbers
        rank_id: Number(formData.rank_id),
        unit_id: Number(formData.unit_id),
        branch_id: Number(formData.branch_id),
        specialty_id: Number(formData.specialty_id),
        corp_id: Number(formData.corp_id),
        image: imageUrl || undefined,
        deployments:
          currentDeploymentUnitId &&
          lastDeploymentUnitId &&
          currentDeploymentDate &&
          lastDeploymentDate
            ? [
                {
                  from_unit_id: String(lastDeploymentUnitId),
                  to_unit_id: String(currentDeploymentUnitId),
                  start_date: lastDeploymentDate,
                  end_date: currentDeploymentDate,
                },
              ]
            : [],
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
    if (isLoadingAircrafts) {
      return [];
    }

    return (
      aircrafts?.map((a) => ({
        label: `${a.name} (${a.type})`,
        value: a.id,
      })) || []
    );
  }, [aircrafts, isLoadingAircrafts]);

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
                required
                placeholder="Enter Call Sign"
              />
              <InputField
                label="Dialogue Box"
                placeholder="Enter Dialogue Box"
                disabled // Placeholder as requested in UI but no field in form data yet?
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <MultiSelect
              label="Type of Rating"
              placeholder="Select Type of rating"
              options={RATING_OPTIONS}
              selectedValues={selectedRatings}
              onChange={handleRatingChange}
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
                  label={`${rating} Expiry Date`}
                  type="date"
                  value={ratingExpiryDates[rating] || ""}
                  onChange={(e) =>
                    handleRatingExpiryChange(rating, e.target.value)
                  }
                  placeholder="00/00/0000"
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
                const aircraft = aircrafts?.find((a) => a.id === aircraftId);
                return (
                  <InputField
                    key={aircraftId}
                    label={aircraft?.name || "Unknown Aircraft"}
                    type="text"
                    value={flightHours[aircraftId] || ""}
                    onChange={(e) =>
                      handleFlightHourChange(aircraftId, e.target.value)
                    }
                    placeholder="Enter Total Flight Hours"
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
          <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2 uppercase">
            Deployment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SelectField
              label="Current Deployment Unit"
              value={currentDeploymentUnitId}
              onChange={(e) => setCurrentDeploymentUnitId(e.target.value)}
            >
              <option value="">Select Unit</option>
              {renderOptions(units)}
            </SelectField>
            <InputField
              label="Current Deployment Date"
              type="date"
              value={currentDeploymentDate}
              onChange={(e) => setCurrentDeploymentDate(e.target.value)}
            />
            <SelectField
              label="Last Deployment Unit"
              value={lastDeploymentUnitId}
              onChange={(e) => setLastDeploymentUnitId(e.target.value)}
            >
              <option value="">Select Unit</option>
              {renderOptions(units)}
            </SelectField>
            <InputField
              label="Last Deployment Date"
              type="date"
              value={lastDeploymentDate}
              onChange={(e) => setLastDeploymentDate(e.target.value)}
            />
            <InputField
              label="Date Taken on Strength (TOS)"
              type="date"
              value={tosDate}
              onChange={(e) => setTosDate(e.target.value)}
            />
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
