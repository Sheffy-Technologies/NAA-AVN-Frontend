import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/shared/ui/multi-select/MultiSelect";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import {
  useGetPersonnelByIdQuery,
  useGetPersonnelRanksQuery,
  useGetPersonnelSpecialtiesQuery,
  useGetPersonnelBranchesQuery,
  useGetPersonnelCorpsQuery,
  useGetPersonnelRatingsQuery,
  useUpdatePersonnelMutation,
  useUploadPersonnelImageMutation,
  type CreatePersonnelRequest,
} from "@/features/personnel/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton, CancelButton } from "@/shared/ui/button";
import Modal from "@/shared/ui/modal/Modal";
import { extractAircraftPlatformName } from "../personnelUtils";

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

const toNullableId = (
  value: string | number | null | undefined,
): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => {
  const selectId =
    props.id ?? (typeof props.name === "string" ? props.name : undefined);

  return (
    <div className={className}>
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-gray-300 mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40 transition-all cursor-pointer disabled:opacity-50"
          {...props}
          title={label}
          aria-label={label}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <Icon icon="mdi:chevron-down" className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export const EditPersonnelPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  const [updatePersonnel, { isLoading: isSubmitting }] =
    useUpdatePersonnelMutation();
  const [uploadImage, { isLoading: isUploadingImage }] =
    useUploadPersonnelImageMutation();

  // Queries
  const { data: personnel, isLoading: isLoadingPersonnel } =
    useGetPersonnelByIdQuery(id!, {
      skip: !id,
    });
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
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformHours, setPlatformHours] = useState<
    Record<string, { operational: string; training: string }>
  >({});
  const [customPlatforms, setCustomPlatforms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("naa_custom_aircraft_platforms");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddAircraftModalOpen, setIsAddAircraftModalOpen] = useState(false);
  const [newAircraftName, setNewAircraftName] = useState("");
  const [aircraftModalError, setAircraftModalError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(
        "naa_custom_aircraft_platforms",
        JSON.stringify(customPlatforms),
      );
    } catch {
      // ignore
    }
  }, [customPlatforms]);

  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [ratingExpiryDates, setRatingExpiryDates] = useState<
    Record<number, string>
  >({});
  const [ratingLifetime, setRatingLifetime] = useState<
    Record<number, boolean>
  >({});
  const [ratingIssueDates, setRatingIssueDates] = useState<
    Record<number, string>
  >({});

  // Image Upload State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // useClickOutside removed as it was for custom dropdown

  const [status, setStatus] = useState<string>("");
  const [deployments, setDeployments] = useState<DeploymentFormData[]>([
    createEmptyDeployment(),
  ]);
  const [initializedId, setInitializedId] = useState<string | null>(null);

  const selectedBranch = useMemo(() => {
    return (branches ?? []).find(
      (b) => b.id === Number(formData.branch_id),
    );
  }, [branches, formData.branch_id]);

  const selectedSpecialty = useMemo(() => {
    return (specialties ?? []).find(
      (s) => s.id === Number(formData.specialty_id),
    );
  }, [specialties, formData.specialty_id]);

  const isPilot = useMemo(() => {
    const branchName = (selectedBranch?.name || "").toLowerCase();
    const specName = (selectedSpecialty?.name || "").toLowerCase();

    // If branch is explicitly engineering/technical/maintenance, not a pilot
    if (
      branchName.includes("engineer") ||
      branchName.includes("tech") ||
      branchName.includes("maintenance")
    ) {
      return false;
    }

    if (
      branchName.includes("pilot") ||
      branchName.includes("flight") ||
      branchName.includes("aircrew") ||
      branchName.includes("flying")
    ) {
      return true;
    }

    // If no branch is explicitly selected, fall back to specialty
    if (!branchName) {
      return specName.includes("pilot");
    }

    return false;
  }, [selectedBranch, selectedSpecialty]);

  const isEngineer = useMemo(() => {
    const branchName = (selectedBranch?.name || "").toLowerCase();
    const specName = (selectedSpecialty?.name || "").toLowerCase();

    if (
      branchName.includes("engineer") ||
      branchName.includes("tech") ||
      branchName.includes("maintenance")
    ) {
      return true;
    }

    if (
      branchName.includes("pilot") ||
      branchName.includes("flight") ||
      branchName.includes("aircrew") ||
      branchName.includes("flying")
    ) {
      return false;
    }

    return (
      specName.includes("engineer") ||
      specName.includes("technician") ||
      specName.includes("maintenance") ||
      specName.includes("avionics") ||
      specName.includes("airframe") ||
      specName.includes("powerplant")
    );
  }, [selectedBranch, selectedSpecialty]);

  const calculateExperience = (issueDateStr?: string) => {
    if (!issueDateStr) return null;
    const issue = new Date(issueDateStr);
    if (isNaN(issue.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - issue.getFullYear();
    let months = now.getMonth() - issue.getMonth();
    if (now.getDate() < issue.getDate()) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0) return "0 Months";
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} Year${years > 1 ? "s" : ""}`);
    if (months > 0 || parts.length === 0)
      parts.push(`${months} Month${months !== 1 ? "s" : ""}`);
    return parts.join(", ");
  };

  useEffect(() => {
    if (!personnel || String(personnel.id) === initializedId) return;
    if (
      isLoadingRatings &&
      personnel.rating_type &&
      (!Array.isArray(personnel.ratings) || personnel.ratings.length === 0)
    ) {
      return;
    }

    setFormData({
      service_number: personnel.service_number,
      firstname: personnel.firstname,
      lastname: personnel.lastname,
      othernames: personnel.othernames || "",
      phone_number: personnel.phone_number,
      email: personnel.email,
      address: personnel.address,
      blood_group: personnel.blood_group,
      call_sign: personnel.call_sign,
      rating_type: personnel.rating_type,
      rank_id: personnel.rank_id,
      unit_id: personnel.unit_id,
      branch_id: personnel.branch_id,
      specialty_id: personnel.specialty_id,
      corp_id: personnel.corp_id,
    });

    if (Array.isArray(personnel.ratings) && personnel.ratings.length > 0) {
      setSelectedRatings(personnel.ratings.map((rating) => rating.id));
      const expDates: Record<number, string> = {};
      const lifetimes: Record<number, boolean> = {};
      const issueDates: Record<number, string> = {};

      personnel.ratings.forEach((rating) => {
        expDates[rating.id] = rating.pivot?.expiry_date || "";
        lifetimes[rating.id] = Boolean(
          rating.pivot?.is_lifetime ||
            (!rating.pivot?.expiry_date && rating.pivot?.issue_date),
        );
        issueDates[rating.id] = rating.pivot?.issue_date || "";
      });

      setRatingExpiryDates(expDates);
      setRatingLifetime(lifetimes);
      setRatingIssueDates(issueDates);
    } else if (personnel.rating_type) {
      const allRatings = personnel.rating_type
        .split(",")
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);

      const ratingIdsFromNames = ratings
        .filter((rating) => allRatings.includes(rating.name.trim().toLowerCase()))
        .map((rating) => rating.id);
      const ratingIdsFromNumbers = allRatings
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

      setSelectedRatings(
        ratingIdsFromNames.length > 0 ? ratingIdsFromNames : ratingIdsFromNumbers,
      );
    }

    // Initialize Type Rating platforms
    if (personnel.rating_type) {
      const parts = personnel.rating_type
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      const recognizedPlatforms: string[] = [];
      parts.forEach((part) => {
        const cleaned = extractAircraftPlatformName(part);
        if (cleaned) {
          recognizedPlatforms.push(cleaned);
        }
      });
      setSelectedPlatforms(Array.from(new Set(recognizedPlatforms)));
    }

    if (
      Array.isArray(personnel.flight_experiences) &&
      personnel.flight_experiences.length > 0
    ) {
      const initialHours: Record<
        string,
        { operational: string; training: string }
      > = {};
      personnel.flight_experiences.forEach((exp) => {
        let opVal = "";
        let trVal = "";
        let platformName = exp.platform_name || "";

        if (exp.notes && exp.notes.startsWith("{")) {
          try {
            const parsed = JSON.parse(exp.notes);
            if (parsed.operational_hours !== undefined)
              opVal = String(parsed.operational_hours);
            if (parsed.training_hours !== undefined)
              trVal = String(parsed.training_hours);
            if (parsed.platform) platformName = parsed.platform;
          } catch {
            // ignore JSON parse error
          }
        }
        if (!opVal && !trVal) {
          opVal = String(exp.operational_hours ?? exp.flight_hours ?? 0);
          trVal = String(exp.training_hours ?? 0);
        }

        const asset = aircraftAssets.find((a) => a.id === exp.asset_id);
        const rawPlatform =
          platformName ||
          asset?.asset_type?.name ||
          asset?.model ||
          asset?.name ||
          "";
        const platform =
          extractAircraftPlatformName(rawPlatform) ||
          extractAircraftPlatformName(asset) ||
          "Bell UH-1H Helicopter";

        if (platform) {
          initialHours[platform] = { operational: opVal, training: trVal };
        }
      });
      setPlatformHours(initialHours);
    }

    setStatus((personnel.status || "").toLowerCase());

    if (personnel.image) {
      setImagePreview(personnel.image);
      setImageUrl(personnel.image);
    }

    setDeployments(
      personnel.deployments.length
        ? [...personnel.deployments]
            .sort(
              (a, b) =>
                new Date(a.start_date).getTime() -
                new Date(b.start_date).getTime(),
            )
            .map((deployment) => ({
              from_unit_id: deployment.from_unit_id
                ? String(deployment.from_unit_id)
                : "",
              to_unit_id: deployment.to_unit_id
                ? String(deployment.to_unit_id)
                : "",
              start_date: deployment.start_date
                ? deployment.start_date.split("T")[0]
                : "",
              end_date: deployment.end_date
                ? deployment.end_date.split("T")[0]
                : "",
            }))
        : [createEmptyDeployment()],
    );

    setInitializedId(String(personnel.id));
  }, [
    aircraftAssets,
    initializedId,
    isLoadingRatings,
    personnel,
    ratings,
  ]);

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.endsWith("_id") && value !== "" ? Number(value) : value,
    }));
  };

  const handleSelectChange = (
    name: string,
    value: string | number | null,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [name]:
        name.endsWith("_id") && value !== null && value !== ""
          ? Number(value)
          : (value ?? ""),
    }));
  };

  const handleTypeRatingChange = (selected: (string | number)[]) => {
    const platforms = Array.from(
      new Set(
        selected
          .map((item) => extractAircraftPlatformName(String(item)))
          .filter(Boolean),
      ),
    );
    setSelectedPlatforms(platforms);

    // Clean up flight hours for deselected platforms
    setPlatformHours((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!platforms.includes(key)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const handlePlatformHourChange = (
    platform: string,
    field: "operational" | "training",
    value: string,
  ) => {
    setPlatformHours((prev) => ({
      ...prev,
      [platform]: {
        operational:
          field === "operational"
            ? value
            : prev[platform]?.operational || "",
        training:
          field === "training" ? value : prev[platform]?.training || "",
      },
    }));
  };

  const handleRatingChange = (selected: (string | number)[]) => {
    const ratingIds = selected as number[];
    setSelectedRatings(ratingIds);

    // Clean up expiry dates for deselected ratings
    setRatingExpiryDates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const ratingId = Number(key);
        if (!ratingIds.includes(ratingId)) {
          delete next[ratingId];
        }
      });
      return next;
    });

    setRatingLifetime((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const ratingId = Number(key);
        if (!ratingIds.includes(ratingId)) {
          delete next[ratingId];
        }
      });
      return next;
    });

    setRatingIssueDates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const ratingId = Number(key);
        if (!ratingIds.includes(ratingId)) {
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

  const handleRatingLifetimeToggle = (ratingId: number, isLifetime: boolean) => {
    setRatingLifetime((prev) => ({
      ...prev,
      [ratingId]: isLifetime,
    }));
  };

  const handleRatingIssueDateChange = (ratingId: number, value: string) => {
    setRatingIssueDates((prev) => ({
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
    if (!id) return;

    try {
      const flightExperiencesPayload = selectedPlatforms
        .map((platform) => {
          const matchingAsset = aircraftAssets.find(
            (a) =>
              extractAircraftPlatformName(a) === platform ||
              a.asset_type?.name === platform ||
              (platform.includes("Bell") &&
                (a.name?.includes("Bell") || a.model?.includes("UH-1H"))) ||
              (platform.includes("Magnus") &&
                (a.name?.includes("Magnus") || a.model?.includes("212"))),
          );
          const opHours = Number(platformHours[platform]?.operational || 0);
          const trHours = Number(platformHours[platform]?.training || 0);
          const totalHours = Number((opHours + trHours).toFixed(2));

          return {
            asset_id: matchingAsset?.id ?? 0,
            flight_hours: totalHours,
            operational_hours: opHours,
            training_hours: trHours,
            platform_name: platform,
            notes: JSON.stringify({
              platform,
              operational_hours: opHours,
              training_hours: trHours,
              total_hours: totalHours,
            }),
          };
        });

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
        rating_type: selectedPlatforms.join(", "),
        status: status || undefined,
        ratings: selectedRatings.map((ratingId) => ({
          rating_id: ratingId,
          expiry_date: ratingLifetime[ratingId]
            ? null
            : ratingExpiryDates[ratingId] || null,
          is_lifetime: Boolean(ratingLifetime[ratingId]),
          issue_date: ratingIssueDates[ratingId] || null,
        })),
        flight_experiences: flightExperiencesPayload,
        // These are optional; an unselected dropdown resolves to "" or 0, which
        // must become null rather than 0 (an invalid foreign key) on submit.
        rank_id: toNullableId(formData.rank_id),
        unit_id: toNullableId(formData.unit_id),
        branch_id: toNullableId(formData.branch_id),
        specialty_id: toNullableId(formData.specialty_id),
        corp_id: toNullableId(formData.corp_id),
        service_number: (formData.service_number ?? "").trim() || null,
        image: imageUrl || undefined,
        deployments: normalizedDeployments.length
          ? normalizedDeployments
          : undefined,
      };

      await updatePersonnel({ id, data: payload }).unwrap();
      dispatch(
        showToast({
          message: "Personnel updated successfully",
          type: "success",
        }),
      );
      navigate(`/dashboard/personnel/${id}`);
    } catch (error) {
      console.error("Failed to update personnel:", error);
      const apiError = error as ApiError;
      const errorMessage =
        apiError?.data?.message || "Failed to update personnel";
      dispatch(
        showToast({
          message: errorMessage,
          type: "error",
        }),
      );
    }
  };

  const typeRatingPlatformOptions: MultiSelectOption[] = useMemo(() => {
    const rawPlatforms = [
      "Bell UH-1H Helicopter",
      "Magnus Fusion 212",
      ...aircraftAssets.map((a) => extractAircraftPlatformName(a)),
      ...customPlatforms.map((c) => extractAircraftPlatformName(c)),
      ...selectedPlatforms.map((s) => extractAircraftPlatformName(s)),
    ];
    const uniquePlatforms = Array.from(
      new Set(rawPlatforms.map((p) => p?.trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return uniquePlatforms.map((name) => ({
      label: name,
      value: name,
    }));
  }, [aircraftAssets, customPlatforms, selectedPlatforms]);

  const handleOpenAddAircraftModal = () => {
    setNewAircraftName("");
    setAircraftModalError("");
    setIsAddAircraftModalOpen(true);
  };

  const handleSaveCustomAircraft = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = newAircraftName.trim();
    if (!raw) {
      setAircraftModalError("Please enter an aircraft name or model");
      return;
    }

    const cleaned = extractAircraftPlatformName(raw);
    if (!cleaned) {
      setAircraftModalError("Please enter a valid aircraft model or platform name");
      return;
    }

    if (!customPlatforms.includes(cleaned)) {
      setCustomPlatforms((prev) => [...prev, cleaned]);
    }

    if (!selectedPlatforms.includes(cleaned)) {
      setSelectedPlatforms((prev) => [...prev, cleaned]);
    }

    if (!platformHours[cleaned]) {
      setPlatformHours((prev) => ({
        ...prev,
        [cleaned]: { operational: "", training: "" },
      }));
    }

    setIsAddAircraftModalOpen(false);
    setNewAircraftName("");
    dispatch(
      showToast({
        message: `Added "${cleaned}" to aircraft platforms`,
        type: "success",
      }),
    );
  };

  const handleRemovePlatform = (platformToRemove: string) => {
    setSelectedPlatforms((prev) => prev.filter((p) => p !== platformToRemove));
    setPlatformHours((prev) => {
      const next = { ...prev };
      delete next[platformToRemove];
      return next;
    });
    if (customPlatforms.includes(platformToRemove)) {
      setCustomPlatforms((prev) => prev.filter((p) => p !== platformToRemove));
    }
    dispatch(
      showToast({
        message: `Removed "${platformToRemove}" from platform operational experience`,
        type: "info",
      }),
    );
  };

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

  if (isLoadingPersonnel || isLoadingAircraftAssets) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Icon
          icon="mdi:loading"
          className="w-8 h-8 text-cyan-400 animate-spin"
        />
      </div>
    );
  }

  const isFormDirty = Boolean(
    formData.firstname?.trim() ||
    formData.lastname?.trim() ||
    formData.service_number?.trim(),
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallbackUrl="/dashboard/personnel" isDirty={isFormDirty} />
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Edit Personnel</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 max-w-6xl">
        {/* Personnel Identification Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2 uppercase">
            PERSONNEL IDENTIFICATION
          </h2>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Image Upload */}
            <div className="shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                title="Upload personnel photo"
                aria-label="Upload personnel photo"
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
            <div className="grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                value={formData.service_number ?? ""}
                onChange={handleChange}
                placeholder="Enter Service No."
              />
              <SearchableSelect
                label="Rank"
                placeholder="Select Rank"
                searchPlaceholder="Search rank..."
                options={(ranks ?? []).map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                value={formData.rank_id || null}
                onChange={(value) => handleSelectChange("rank_id", value)}
              />
              <SelectField
                label="Blood Group"
                name="blood_group"
                value={formData.blood_group}
                onChange={handleChange}
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
                disabled
              />
            </div>
          </div>
        </div>



        {/* Service Details Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-cyan-400 border-b border-white/10 pb-2 uppercase">
            Service Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SearchableSelect
              label="Branch"
              placeholder="Select Branch"
              searchPlaceholder="Search branch..."
              options={(branches ?? []).map((b) => ({
                value: b.id,
                label: b.name,
              }))}
              value={formData.branch_id || null}
              onChange={(value) => handleSelectChange("branch_id", value)}
            />

            <SearchableSelect
              label="Specialty"
              placeholder="Select Specialty"
              searchPlaceholder="Search specialty..."
              options={(specialties ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              value={formData.specialty_id || null}
              onChange={(value) => handleSelectChange("specialty_id", value)}
            />

            <SelectField
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Select Status</option>
              <option value="active">Active</option>
              <option value="grounded">Grounded</option>
              <option value="medical">Medical</option>
            </SelectField>

            <SearchableSelect
              label="Unit"
              placeholder="Select Unit"
              searchPlaceholder="Search unit..."
              options={(units ?? []).map((u) => ({
                value: u.id,
                label: u.name,
              }))}
              value={formData.unit_id || null}
              onChange={(value) => handleSelectChange("unit_id", value)}
            />

            <SearchableSelect
              label="Corp"
              placeholder="Select Corp"
              searchPlaceholder="Search corp..."
              options={(corps ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              value={formData.corp_id || null}
              onChange={(value) => handleSelectChange("corp_id", value)}
            />
          </div>
        </div>

        {/* Professional Credentials & Qualifications (Determined by Specialty) */}
        <div className="space-y-4">
          <div className="border-b border-white/10 pb-2 flex items-center justify-between">
            <h2 className="text-lg font-medium text-cyan-400 uppercase">
              Professional Credentials & Experience
            </h2>
            {isPilot ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-500/30">
                Pilot Track
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                {isEngineer ? "Engineer Track" : "Credentials & Experience Track"}
              </span>
            )}
          </div>

          <div className={cn("grid gap-4", isPilot ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            <MultiSelect
              label={isPilot ? "Type of License" : "Type of License / Certification"}
              placeholder="Select Type of License"
              options={ratingOptions}
              selectedValues={selectedRatings}
              onChange={handleRatingChange}
              disabled={isLoadingRatings}
              searchable
            />
            {isPilot && (
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-sm font-medium text-gray-300">
                    Type Rating (Aircraft Platforms)
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenAddAircraftModal}
                    className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium cursor-pointer"
                  >
                    <Icon icon="mdi:airplane-plus" className="w-3.5 h-3.5" />
                    <span>+ Add Aircraft Manually</span>
                  </button>
                </div>
                <MultiSelect
                  label=""
                  placeholder="Select or type aircraft platform..."
                  options={typeRatingPlatformOptions}
                  selectedValues={selectedPlatforms}
                  onChange={handleTypeRatingChange}
                  allowCustom
                  searchable
                />
              </div>
            )}
          </div>

          {/* License Validity & Experience Derivation */}
          {selectedRatings.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                {!isPilot ? "License Dates & Career Experience" : "Aircraft Ratings Validity"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedRatings.map((rating) => {
                  const ratingLabel = ratingLabelById.get(rating) || `License #${rating}`;
                  const isLifetime = Boolean(ratingLifetime[rating]);
                  const derivedExp = !isPilot ? calculateExperience(ratingIssueDates[rating]) : null;

                  return (
                    <div
                      key={rating}
                      className="rounded-lg border border-[#0A4D66]/50 bg-[#001825]/60 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm font-medium text-white">
                          {ratingLabel}
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-cyan-300 hover:text-cyan-200">
                          <input
                            type="checkbox"
                            checked={isLifetime}
                            onChange={(e) =>
                              handleRatingLifetimeToggle(rating, e.target.checked)
                            }
                            className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-400 h-4 w-4 bg-[#001219]"
                          />
                          <span>Lifetime / No Expiry</span>
                        </label>
                      </div>

                      <div className={cn("grid gap-3", !isPilot ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                        {!isPilot && (
                          <InputField
                            label="License Issue Date"
                            type="date"
                            value={ratingIssueDates[rating] || ""}
                            onChange={(e) =>
                              handleRatingIssueDateChange(rating, e.target.value)
                            }
                            placeholder="00/00/0000"
                          />
                        )}

                        <div>
                          <InputField
                            label="Expiry Date"
                            type="date"
                            value={isLifetime ? "" : ratingExpiryDates[rating] || ""}
                            onChange={(e) =>
                              handleRatingExpiryChange(rating, e.target.value)
                            }
                            placeholder="00/00/0000"
                            disabled={isLifetime}
                          />
                          {isLifetime && (
                            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                              <Icon icon="mdi:check-decagram" className="w-3.5 h-3.5" />
                              This license is permanent (no expiration date).
                            </p>
                          )}
                        </div>
                      </div>

                      {!isPilot && (
                        <div className="rounded bg-[#001219] border border-emerald-500/20 px-3 py-2 flex items-center justify-between text-xs">
                          <span className="text-gray-400">Total Derived Experience:</span>
                          <span className="font-semibold text-emerald-300">
                            {derivedExp || "Set issue date to compute"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aircraft Platform Operational Experience (Baseline Flight Hours) - Visible only for Pilot track */}
          {isPilot && selectedPlatforms.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                    <span>Platform Operational Experience (Baseline Flight Hours)</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                      {selectedPlatforms.length} {selectedPlatforms.length === 1 ? "Platform" : "Platforms"}
                    </span>
                  </h3>
                  <span className="text-xs text-gray-400">
                    Base flight experience recorded per platform and linked to operational logs
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPlatforms.map((platform) => {
                  const op = Number(platformHours[platform]?.operational) || 0;
                  const tr = Number(platformHours[platform]?.training) || 0;
                  const total = (op + tr).toFixed(1);
                  const isCustom = customPlatforms.includes(platform);

                  return (
                    <div
                      key={platform}
                      className="rounded-lg border border-[#0A4D66]/50 bg-[#001825]/60 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <Icon icon="mdi:airplane" className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm font-semibold text-white">
                            {platform}
                          </span>
                          {isCustom && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Non-Inventory
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                            Total: {total} HRS
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePlatform(platform)}
                            title={`Remove ${platform} from baseline experience`}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors cursor-pointer"
                          >
                            <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InputField
                          label="Operational Flight Hours"
                          type="number"
                          value={platformHours[platform]?.operational || ""}
                          onChange={(e) =>
                            handlePlatformHourChange(
                              platform,
                              "operational",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. 150.0"
                          min="0"
                          step="0.1"
                        />
                        <InputField
                          label="Training Flight Hours"
                          type="number"
                          value={platformHours[platform]?.training || ""}
                          onChange={(e) =>
                            handlePlatformHourChange(
                              platform,
                              "training",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. 50.0"
                          min="0"
                          step="0.1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                className="rounded-lg border border-white/10 bg-[#001825]/5 p-4"
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
                  <SearchableSelect
                    label="From Unit"
                    placeholder="Select Unit"
                    searchPlaceholder="Search unit..."
                    options={(units ?? []).map((u) => ({
                      value: u.id,
                      label: u.name,
                    }))}
                    value={deployment.from_unit_id || null}
                    onChange={(value) =>
                      handleDeploymentChange(
                        index,
                        "from_unit_id",
                        value === null ? "" : String(value),
                      )
                    }
                  />
                  <SearchableSelect
                    label="To Unit"
                    placeholder="Select Unit"
                    searchPlaceholder="Search unit..."
                    options={(units ?? []).map((u) => ({
                      value: u.id,
                      label: u.name,
                    }))}
                    value={deployment.to_unit_id || null}
                    onChange={(value) =>
                      handleDeploymentChange(
                        index,
                        "to_unit_id",
                        value === null ? "" : String(value),
                      )
                    }
                  />
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
            />
            <InputField
              label="Phone Number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
            />
            <InputField
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="sm:col-span-2"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-6">
          <CancelButton
            fallbackUrl="/dashboard/personnel"
            isDirty={isFormDirty}
            label="Cancel"
            size="md"
            className="h-10 px-6"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2 bg-[#0A4D66] text-white font-semibold rounded-md hover:bg-[#083c50] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7FD5FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? "Updating..." : "Update Personnel"}
          </button>
        </div>
      </form>

      {/* Modal: Add Aircraft Manually */}
      <Modal
        open={isAddAircraftModalOpen}
        onClose={() => setIsAddAircraftModalOpen(false)}
        title="Add Aircraft Manually"
      >
        <form onSubmit={handleSaveCustomAircraft} className="space-y-4">
          <p className="text-xs text-gray-400">
            Add an external, training, or legacy aircraft platform not present in the current inventory fleet for historical flight hour record-keeping.
          </p>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide">
              Aircraft Platform Name / Model <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={newAircraftName}
              onChange={(e) => {
                setNewAircraftName(e.target.value);
                if (aircraftModalError) setAircraftModalError("");
              }}
              placeholder="e.g. Cessna 172 Skyhawk, Diamond DA42, Mi-17..."
              className="w-full rounded-md border border-gray-700 bg-[#001219] px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {aircraftModalError && (
              <p className="text-xs text-red-400 mt-1">{aircraftModalError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsAddAircraftModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white rounded-md border border-gray-700 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Icon icon="mdi:check" className="w-4 h-4" />
              <span>Add Aircraft</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
