import { useMemo, useRef, useState } from "react";

import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { PersonnelModuleTabs } from "../components/PersonnelModuleTabs";
import { cn } from "@/shared/utils/cn";
import { BackButton } from "@/shared/ui/button/BackButton";
import {
  useGetPersonnelQuery,
  type Personnel as ApiPersonnel,
  useGetPersonnelRanksQuery,
  useGetPersonnelSpecialtiesQuery,
  useGetPersonnelBranchesQuery,
  useUpdatePersonnelMutation,
  useDeletePersonnelMutation,
  useCreatePersonnelMutation,
  type PersonnelFilters,
} from "@/features/personnel/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import {
  ImportCsvModal,
  type ImportCsvField,
} from "@/shared/components/ImportCsvModal";

type PersonnelStatus = "Active" | "Grounded" | "Medical";

type FlightStatus = "no_flights" | "current" | "due_for_flight" | "overdue" | null;

type Personnel = {
  id: string;
  unitId: number;
  rankId: number;
  branchId: number;
  specialtyId: number;
  serviceNo: string;
  name: string;
  image: string | null;
  rank: string;
  callSign: string;
  unit: string;
  branch: string;
  specialty: string;
  status: PersonnelStatus;
  isPilot: boolean;
  flightStatus: FlightStatus;
  nextFlightDueDate: string | null;
};

const FLIGHT_STATUS_LABELS: Record<NonNullable<FlightStatus>, string> = {
  no_flights: "No Flights Logged",
  current: "Current",
  due_for_flight: "Due for Flight",
  overdue: "Overdue for Flight",
};

const FLIGHT_STATUS_COLORS: Record<NonNullable<FlightStatus>, string> = {
  no_flights: "text-gray-400 bg-gray-400/10",
  current: "text-emerald-400 bg-emerald-400/10",
  due_for_flight: "text-amber-400 bg-amber-400/10",
  overdue: "text-red-400 bg-red-400/10",
};

const FLIGHT_STATUS_DOT: Record<NonNullable<FlightStatus>, string> = {
  no_flights: "bg-gray-400",
  current: "bg-emerald-400",
  due_for_flight: "bg-amber-400",
  overdue: "bg-red-400",
};

type MultiFilterState<T> = {
  all: boolean;
  selected: T[];
};

const statusDotColor: Record<PersonnelStatus, string> = {
  Active: "bg-emerald-400",
  Grounded: "bg-red-400",
  Medical: "bg-amber-300",
};

const statusTextColor: Record<PersonnelStatus, string> = {
  Active: "text-emerald-400",
  Grounded: "text-red-400",
  Medical: "text-amber-300",
};

const PERSONNEL_IMPORT_FIELDS: ImportCsvField[] = [
  { key: "firstname", label: "First Name", required: true, example: "John" },
  { key: "lastname", label: "Last Name", required: true, example: "Doe" },
  { key: "service_number", label: "Service Number", required: false, example: "NAF/1234" },
  { key: "rank", label: "Rank", required: false, example: "Flight Lieutenant" },
  { key: "unit", label: "Unit", required: false, example: "1 Squadron" },
  { key: "branch", label: "Branch", required: false, example: "Engineering" },
  { key: "specialty", label: "Specialty", required: false, example: "Avionics" },
  { key: "call_sign", label: "Call Sign", required: false, example: "Eagle-1" },
  { key: "status", label: "Status (Active/Grounded/Medical)", required: false, example: "Active" },
  { key: "phone_number", label: "Phone Number", required: false, example: "08012345678" },
  { key: "email", label: "Email", required: false, example: "john.doe@example.com" },
  { key: "address", label: "Address", required: false, example: "12 Base Road" },
  { key: "blood_group", label: "Blood Group", required: false, example: "O+" },
  { key: "is_expatriate", label: "Is Expatriate (true/false)", required: false, example: "false" },
];

export const PersonnelPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [unitFilter, setUnitFilter] = useState<MultiFilterState<number>>({
    all: true,
    selected: [],
  });
  const [rankFilter, setRankFilter] = useState<MultiFilterState<number>>({
    all: true,
    selected: [],
  });
  const [branchFilter, setBranchFilter] = useState<MultiFilterState<number>>({
    all: true,
    selected: [],
  });
  const [specialtyFilter, setSpecialtyFilter] = useState<
    MultiFilterState<number>
  >({
    all: true,
    selected: [],
  });
  const [statusFilter, setStatusFilter] = useState<
    MultiFilterState<PersonnelStatus>
  >({
    all: true,
    selected: [],
  });
  // ?flight_status=due_for_flight,overdue (e.g. from the Strategic Dashboard)
  // narrows the list to pilots with those flight currency statuses.
  const [searchParams, setSearchParams] = useSearchParams();
  const flightStatusFilter = useMemo(
    () =>
      (searchParams.get("flight_status") ?? "")
        .split(",")
        .filter(
          (status): status is NonNullable<FlightStatus> => status in FLIGHT_STATUS_LABELS,
        ),
    [searchParams],
  );
  const setFlightStatusFilter = (statuses: NonNullable<FlightStatus>[]) => {
    const next = new URLSearchParams(searchParams);
    if (statuses.length) next.set("flight_status", statuses.join(","));
    else next.delete("flight_status");
    setSearchParams(next, { replace: true, state: location.state });
  };
  const [expatriateFilter, setExpatriateFilter] = useState<
    "all" | "true" | "false"
  >(() => (flightStatusFilter.length ? "all" : "false"));
  const [searchQuery, setSearchQuery] = useState("");

  const { data: units = [] } = useGetUnitsQuery();
  const { data: ranks = [] } = useGetPersonnelRanksQuery();
  const { data: specialties = [] } = useGetPersonnelSpecialtiesQuery();
  const { data: branches = [] } = useGetPersonnelBranchesQuery();

  const filteredSpecialtiesOptions = useMemo(() => {
    if (branchFilter.all || branchFilter.selected.length === 0) {
      return specialties;
    }
    return specialties.filter(
      (specialty) =>
        specialty.branch_id &&
        branchFilter.selected.includes(specialty.branch_id),
    );
  }, [specialties, branchFilter]);

  const effectiveSpecialtiesSelected = useMemo(() => {
    if (specialtyFilter.all) return [];
    if (branchFilter.all || branchFilter.selected.length === 0)
      return specialtyFilter.selected;

    const availableIds = new Set(filteredSpecialtiesOptions.map((s) => s.id));
    return specialtyFilter.selected.filter((id) => availableIds.has(id));
  }, [
    specialtyFilter.all,
    specialtyFilter.selected,
    branchFilter.all,
    branchFilter.selected.length,
    filteredSpecialtiesOptions,
  ]);

  const filters: PersonnelFilters = useMemo(
    () => ({
      units: unitFilter.selected,
      ranks: rankFilter.selected,
      branches: branchFilter.selected,
      specialties: effectiveSpecialtiesSelected,
      status: statusFilter.selected,
      corps: [],
      is_expatriate:
        expatriateFilter === "all" ? undefined : expatriateFilter === "true",
    }),
    [
      unitFilter.selected,
      rankFilter.selected,
      branchFilter.selected,
      effectiveSpecialtiesSelected,
      statusFilter.selected,
      expatriateFilter,
    ],
  );

  const { data: apiPersonnel, isLoading: isPersonnelLoading } =
    useGetPersonnelQuery(filters);

  const [createPersonnel] = useCreatePersonnelMutation();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const PERSONNEL_STATUSES = ["active", "grounded", "medical"];

  const handleImportPersonnelRow = async (row: Record<string, string>) => {
    const rankMatch = row.rank
      ? ranks.find(
          (r) => r.name.trim().toLowerCase() === row.rank.trim().toLowerCase(),
        )
      : undefined;
    if (row.rank && !rankMatch) {
      throw new Error(`Rank "${row.rank}" not found`);
    }

    const unitMatch = row.unit
      ? units.find(
          (u) => u.name.trim().toLowerCase() === row.unit.trim().toLowerCase(),
        )
      : undefined;
    if (row.unit && !unitMatch) {
      throw new Error(`Unit "${row.unit}" not found`);
    }

    const branchMatch = row.branch
      ? branches.find(
          (b) =>
            b.name.trim().toLowerCase() === row.branch.trim().toLowerCase(),
        )
      : undefined;
    if (row.branch && !branchMatch) {
      throw new Error(`Branch "${row.branch}" not found`);
    }

    const specialtyMatch = row.specialty
      ? specialties.find(
          (s) =>
            s.name.trim().toLowerCase() === row.specialty.trim().toLowerCase(),
        )
      : undefined;
    if (row.specialty && !specialtyMatch) {
      throw new Error(`Specialty "${row.specialty}" not found`);
    }

    if (
      row.status &&
      !PERSONNEL_STATUSES.includes(row.status.trim().toLowerCase())
    ) {
      throw new Error("Status must be one of: Active, Grounded, Medical");
    }

    const isExpatriate = row.is_expatriate
      ? row.is_expatriate.trim().toLowerCase() === "true"
      : undefined;

    await createPersonnel({
      firstname: row.firstname,
      lastname: row.lastname,
      service_number: row.service_number || undefined,
      rank_id: rankMatch?.id,
      unit_id: unitMatch?.id,
      branch_id: branchMatch?.id,
      specialty_id: specialtyMatch?.id,
      call_sign: row.call_sign || undefined,
      status: row.status || undefined,
      phone_number: row.phone_number || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      blood_group: row.blood_group || undefined,
      is_expatriate: isExpatriate,
    }).unwrap();
  };

  const mappedPersonnel: Personnel[] = useMemo(() => {
    if (!apiPersonnel) {
      return [];
    }

    const mapStatus = (status: string): PersonnelStatus => {
      const normalized = status.toLowerCase();
      if (normalized === "active") return "Active";
      if (normalized === "grounded") return "Grounded";
      return "Medical";
    };

    return apiPersonnel.map((p: ApiPersonnel) => ({
      id: String(p.id),
      unitId: p.unit_id,
      rankId: p.rank_id,
      branchId: p.branch_id,
      specialtyId: p.specialty_id,
      serviceNo: p.service_number ?? "",
      name: [p.firstname, p.lastname].filter(Boolean).join(" "),
      image: p.image,
      rank: p.rank?.name ?? "",
      callSign: p.call_sign ?? "",
      unit: p.unit?.name ?? "",
      branch: p.branch?.name ?? "",
      specialty: p.specialty?.name ?? "",
      status: mapStatus(p.status),
      isPilot: p.is_pilot,
      flightStatus: p.flight_status,
      nextFlightDueDate: p.next_flight_due_date,
    }));
  }, [apiPersonnel]);

  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [statusMenuForId, setStatusMenuForId] = useState<string | null>(null);
  const [openFilterMenu, setOpenFilterMenu] = useState<
    "units" | "ranks" | "branches" | "specialties" | "status" | "expatriate" | null
  >(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const displayedPersonnel = useMemo(() => {
    let result = mappedPersonnel;
    if (!unitFilter.all && unitFilter.selected.length > 0) {
      result = result.filter(
        (p) => p.unitId != null && unitFilter.selected.includes(p.unitId),
      );
    }
    return result;
  }, [mappedPersonnel, unitFilter]);

  const handleToggleAll =
    <T,>(setState: React.Dispatch<React.SetStateAction<MultiFilterState<T>>>) =>
    (checked: boolean) => {
      if (checked) {
        setState({ all: true, selected: [] });
      } else {
        setState((prev) => ({ all: false, selected: prev.selected }));
      }
    };

  const handleToggleItem =
    <T,>(setState: React.Dispatch<React.SetStateAction<MultiFilterState<T>>>) =>
    (value: T, checked: boolean) => {
      setState((prev) => {
        const exists = prev.selected.some((item) => item === value);
        const nextSelected = checked
          ? exists
            ? prev.selected
            : [...prev.selected, value]
          : prev.selected.filter((item) => item !== value);

        return {
          all: nextSelected.length === 0,
          selected: nextSelected.length === 0 ? [] : nextSelected,
        };
      });
    };

  const filteredPersonnel = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const byFlightStatus = flightStatusFilter.length
      ? displayedPersonnel.filter(
          (person) =>
            person.isPilot &&
            person.flightStatus !== null &&
            flightStatusFilter.includes(person.flightStatus),
        )
      : displayedPersonnel;
    if (!query) return byFlightStatus;

    return byFlightStatus.filter((person) =>
      [
        person.serviceNo,
        person.name,
        person.rank,
        person.callSign,
        person.unit,
        person.branch,
        person.specialty,
      ].some((value) => (value ?? "").toLowerCase().includes(query)),
    );
  }, [displayedPersonnel, flightStatusFilter, searchQuery]);

  const stats = useMemo(() => {
    return filteredPersonnel.reduce(
      (acc, p) => {
        if (p.status === "Active") acc.active++;
        else if (p.status === "Grounded") acc.grounded++;
        else if (p.status === "Medical") acc.medical++;
        if (p.flightStatus === "due_for_flight" || p.flightStatus === "overdue") {
          acc.dueForFlight++;
        }
        return acc;
      },
      { total: filteredPersonnel.length, active: 0, grounded: 0, medical: 0, dueForFlight: 0 },
    );
  }, [filteredPersonnel]);

  const handleResetFilters = () => {
    setUnitFilter({ all: true, selected: [] });
    setRankFilter({ all: true, selected: [] });
    setBranchFilter({ all: true, selected: [] });
    setSpecialtyFilter({ all: true, selected: [] });
    setStatusFilter({ all: true, selected: [] });
    setExpatriateFilter("false");
    setFlightStatusFilter([]);
    setOpenFilterMenu(null);
  };
  useClickOutside(
    filterBarRef,
    () => {
      setOpenFilterMenu(null);
      setShowMobileFilters(false);
    },
    !!openFilterMenu || showMobileFilters,
  );
  useClickOutside(
    actionMenuRef,
    () => {
      setOpenActionId(null);
      setStatusMenuForId(null);
    },
    openActionId !== null || statusMenuForId !== null,
  );

  const handleToggleActions = (id: string) => {
    setStatusMenuForId(null);
    setOpenActionId((current) => (current === id ? null : id));
  };

  const [updatePersonnel] = useUpdatePersonnelMutation();
  const [deletePersonnel] = useDeletePersonnelMutation();

  const handleDeletePersonnel = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This action cannot be undone.`)) return;
    try {
      await deletePersonnel(id).unwrap();
      dispatch(showToast({ message: "Personnel deleted successfully", type: "success" }));
      setOpenActionId(null);
    } catch {
      dispatch(showToast({ message: "Failed to delete personnel", type: "error" }));
    }
  };

  const handleChangeStatus = async (id: string, status: PersonnelStatus) => {
    try {
      await updatePersonnel({
        id,
        data: { status },
      }).unwrap();
    } catch (error) {
      console.error("Failed to update status", error);
    }
    setStatusMenuForId(null);
  };

  const handleOpenDetail = (id: string) => {
    navigate(`/dashboard/personnel/${id}`, {
      state: { from: "/dashboard/personnel", fromLabel: "Personnel" },
    });
  };

  const getPersonnelInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="px-2 sm:px-0 space-y-4">
      {location.state?.from && (
        <div className="flex items-center">
          <BackButton fallbackUrl="/dashboard" />
        </div>
      )}
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        {/* Module-level tab bar */}
        <PersonnelModuleTabs />

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#001219]">
          <div className="flex items-center gap-4">
            <h2 className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
              Personnel
            </h2>
            <div className="flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#001219] p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Table view"
                aria-label="Table view"
                className={cn(
                  "px-2 py-1 rounded-sm flex items-center justify-center",
                  viewMode === "table"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400",
                )}
              >
                <Icon icon="mdi:view-list" className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                aria-label="Grid view"
                className={cn(
                  "px-2 py-1 rounded-sm flex items-center justify-center",
                  viewMode === "grid"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400",
                )}
              >
                <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={filterBarRef} className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="px-3 py-1.5 rounded-full border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 hidden sm:block"
            >
              {filteredPersonnel.length}
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] sm:text-xs text-[#7FD5FF] underline underline-offset-4 hidden sm:block"
            >
              Reset Filter
            </button>

            {/* Mobile Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="xl:hidden px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-[11px] text-gray-200 inline-flex items-center gap-1"
            >
              <Icon icon="mdi:filter-variant" className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {([
                unitFilter,
                rankFilter,
                branchFilter,
                specialtyFilter,
                statusFilter,
              ].some((f) => !f.all) ||
                expatriateFilter !== "false") && (
                <span className="w-2 h-2 rounded-full bg-[#0369A1]" />
              )}
            </button>

            {/* Filters */}
            <div
              className={cn(
                // Base
                "hidden",
                // Desktop
                "xl:flex xl:flex-row xl:flex-wrap xl:items-center xl:gap-2 xl:static xl:w-auto xl:bg-transparent xl:border-none xl:shadow-none xl:p-0 xl:space-y-0 xl:animate-none",
                // Mobile
                showMobileFilters &&
                  "flex flex-col absolute top-14 right-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg p-3 shadow-xl z-30 w-64 space-y-3 animate-in fade-in slide-in-from-top-2",
              )}
            >
              <div className="xl:hidden flex items-center justify-between px-1 pb-2 border-b border-[#0A4D66]/40 mb-2">
                <span className="text-xs font-medium text-white">Filters</span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[10px] text-[#7FD5FF] underline underline-offset-4"
                >
                  Reset All
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu((current) =>
                      current === "units" ? null : "units",
                    )
                  }
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-[11px] text-gray-200 inline-flex items-center gap-1"
                >
                  <span>
                    {unitFilter.all
                      ? "All Units"
                      : `${unitFilter.selected.length} Unit${
                          unitFilter.selected.length > 1 ? "s" : ""
                        }`}
                  </span>
                  <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                </button>
                {openFilterMenu === "units" && (
                  <div className="absolute right-0 mt-2 z-20 w-56 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-3 text-xs text-gray-200">
                    <div className="mb-2">
                      <Checkbox
                        checked={unitFilter.all}
                        onChange={(event) =>
                          handleToggleAll(setUnitFilter)(event.target.checked)
                        }
                        label="All Units"
                      />
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {units.map((unit: Unit) => (
                        <Checkbox
                          key={unit.id}
                          checked={unitFilter.selected.includes(unit.id)}
                          onChange={(event) =>
                            handleToggleItem(setUnitFilter)(
                              unit.id,
                              event.target.checked,
                            )
                          }
                          label={unit.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu((current) =>
                      current === "ranks" ? null : "ranks",
                    )
                  }
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-[11px] text-gray-200 inline-flex items-center gap-1"
                >
                  <span>
                    {rankFilter.all
                      ? "All Ranks"
                      : `${rankFilter.selected.length} Rank${
                          rankFilter.selected.length > 1 ? "s" : ""
                        }`}
                  </span>
                  <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                </button>
                {openFilterMenu === "ranks" && (
                  <div className="absolute right-0 mt-2 z-20 w-56 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-3 text-xs text-gray-200">
                    <div className="mb-2">
                      <Checkbox
                        checked={rankFilter.all}
                        onChange={(event) =>
                          handleToggleAll(setRankFilter)(event.target.checked)
                        }
                        label="All Ranks"
                      />
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {ranks.map((rank) => (
                        <Checkbox
                          key={rank.id}
                          checked={rankFilter.selected.includes(rank.id)}
                          onChange={(event) =>
                            handleToggleItem(setRankFilter)(
                              rank.id,
                              event.target.checked,
                            )
                          }
                          label={rank.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu((current) =>
                      current === "branches" ? null : "branches",
                    )
                  }
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-[11px] text-gray-200 inline-flex items-center gap-1"
                >
                  <span>
                    {branchFilter.all
                      ? "All Branches"
                      : `${branchFilter.selected.length} Branch${
                          branchFilter.selected.length > 1 ? "es" : ""
                        }`}
                  </span>
                  <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                </button>
                {openFilterMenu === "branches" && (
                  <div className="absolute right-0 mt-2 z-20 w-56 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-3 text-xs text-gray-200">
                    <div className="mb-2">
                      <Checkbox
                        checked={branchFilter.all}
                        onChange={(event) =>
                          handleToggleAll(setBranchFilter)(event.target.checked)
                        }
                        label="All Branches"
                      />
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {branches.map((branch) => (
                        <Checkbox
                          key={branch.id}
                          checked={branchFilter.selected.includes(branch.id)}
                          onChange={(event) =>
                            handleToggleItem(setBranchFilter)(
                              branch.id,
                              event.target.checked,
                            )
                          }
                          label={branch.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu((current) =>
                      current === "specialties" ? null : "specialties",
                    )
                  }
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-[11px] text-gray-200 inline-flex items-center gap-1"
                >
                  <span>
                    {specialtyFilter.all
                      ? "All Specialties"
                      : `${effectiveSpecialtiesSelected.length} Specialt${
                          effectiveSpecialtiesSelected.length > 1 ? "ies" : "y"
                        }`}
                  </span>
                  <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                </button>
                {openFilterMenu === "specialties" && (
                  <div className="absolute right-0 mt-2 z-20 w-56 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-3 text-xs text-gray-200">
                    <div className="mb-2">
                      <Checkbox
                        checked={specialtyFilter.all}
                        onChange={(event) =>
                          handleToggleAll(setSpecialtyFilter)(
                            event.target.checked,
                          )
                        }
                        label="All Specialties"
                      />
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {filteredSpecialtiesOptions.map((specialty) => (
                        <Checkbox
                          key={specialty.id}
                          checked={specialtyFilter.selected.includes(
                            specialty.id,
                          )}
                          onChange={(event) =>
                            handleToggleItem(setSpecialtyFilter)(
                              specialty.id,
                              event.target.checked,
                            )
                          }
                          label={specialty.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu((current) =>
                      current === "status" ? null : "status",
                    )
                  }
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-[11px] text-gray-200 inline-flex items-center gap-1"
                >
                  <span>
                    {statusFilter.all
                      ? "All Status"
                      : `${statusFilter.selected.length} Status${
                          statusFilter.selected.length > 1 ? "es" : ""
                        }`}
                  </span>
                  <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                </button>
                {openFilterMenu === "status" && (
                  <div className="absolute right-0 mt-2 z-20 w-56 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-3 text-xs text-gray-200">
                    <div className="mb-2">
                      <Checkbox
                        checked={statusFilter.all}
                        onChange={(event) =>
                          handleToggleAll(setStatusFilter)(event.target.checked)
                        }
                        label="All Status"
                      />
                    </div>
                    <div className="space-y-1">
                      {(
                        ["Active", "Grounded", "Medical"] as PersonnelStatus[]
                      ).map((status) => (
                        <Checkbox
                          key={status}
                          checked={statusFilter.selected.includes(status)}
                          onChange={(event) =>
                            handleToggleItem(setStatusFilter)(
                              status,
                              event.target.checked,
                            )
                          }
                          label={status}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilterMenu((current) =>
                      current === "expatriate" ? null : "expatriate",
                    )
                  }
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-[11px] text-gray-200 inline-flex items-center gap-1"
                >
                  <span>
                    {expatriateFilter === "all"
                      ? "All Personnel"
                      : expatriateFilter === "true"
                        ? "Expatriate"
                        : "Non-Expatriate"}
                  </span>
                  <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                </button>
                {openFilterMenu === "expatriate" && (
                  <div className="absolute right-0 mt-2 z-20 w-48 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-3 text-xs text-gray-200">
                    <div className="space-y-1">
                      {(
                        [
                          { value: "all", label: "All Personnel" },
                          { value: "true", label: "Expatriate" },
                          { value: "false", label: "Non-Expatriate" },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setExpatriateFilter(option.value);
                            setOpenFilterMenu(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-[#0A4D66]/40",
                            expatriateFilter === option.value
                              ? "text-[#7FD5FF]"
                              : "text-gray-200",
                          )}
                        >
                          <span>{option.label}</span>
                          {expatriateFilter === option.value && (
                            <Icon icon="mdi:check" className="w-4 h-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <Icon icon="mdi:upload" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span className="hidden sm:inline text-slate-700 dark:text-slate-200 font-semibold">Import CSV</span>
              <span className="sm:hidden text-slate-700 dark:text-slate-200 font-semibold">Import</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/personnel/add")}
              className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 rounded bg-[#0369A1] text-white text-xs sm:text-sm font-medium hover:bg-[#0369A1]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span className="hidden sm:inline">Add Personnel</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#001219]">
          <div className="relative w-full sm:max-w-md">
            <Icon
              icon="mdi:magnify"
              className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search personnel by name, service no, rank, unit..."
              title="Search personnel"
              aria-label="Search personnel"
              className="w-full rounded-md border border-[#0A4D66]/40 bg-[#001825] pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40"
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-4 sm:px-6 py-3 bg-[#001219] border-b border-[#0A4D66]/40 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0369A1]" />
            <span className="text-gray-300">Total:</span>
            <span className="font-bold text-white">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-gray-300">Active:</span>
            <span className="font-bold text-white">{stats.active}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-gray-300">Grounded:</span>
            <span className="font-bold text-white">{stats.grounded}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-gray-300">Medical:</span>
            <span className="font-bold text-white">{stats.medical}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setFlightStatusFilter(
                flightStatusFilter.length ? [] : ["due_for_flight", "overdue"],
              )
            }
            title={flightStatusFilter.length ? "Show all personnel" : "Show only pilots due or overdue for flight"}
            className={cn(
              "flex items-center gap-2 rounded px-1.5 -mx-1.5 hover:bg-[#0A4D66]/30",
              flightStatusFilter.length > 0 && "ring-1 ring-amber-400/60",
            )}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-gray-300">Due for Flight:</span>
            <span className="font-bold text-white">{stats.dueForFlight}</span>
          </button>
          {flightStatusFilter.length > 0 && (
            <button
              type="button"
              onClick={() => setFlightStatusFilter([])}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-500/20"
            >
              Showing pilots{" "}
              {flightStatusFilter.map((status) => FLIGHT_STATUS_LABELS[status]).join(" / ")}
              <Icon icon="mdi:close" className="w-3 h-3" />
            </button>
          )}
        </div>

        {viewMode === "table" && (
          <div className="overflow-x-auto pb-2">
            <table className="min-w-max w-full text-xs sm:text-sm text-gray-200 whitespace-nowrap">
              <thead>
                <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 sm:px-6 py-3 text-left">
                    Service No.
                  </th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">
                    Call Sign
                  </th>
                  <th className="px-4 py-3 text-left">
                    Flight Status
                  </th>
                  <th className="px-4 py-3 text-left">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-left">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left">
                    Specialty
                  </th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isPersonnelLoading && filteredPersonnel.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                        <span>Loading personnel...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPersonnel.map((p, index) => (
                    <tr
                      key={p.id}
                      tabIndex={0}
                      role="button"
                      title="Click to view personnel details"
                      onClick={(e) =>
                        onInteractiveRowClick(e, () => handleOpenDetail(p.id))
                      }
                      onKeyDown={(e) =>
                        onInteractiveRowKeyDown(e, () => handleOpenDetail(p.id))
                      }
                      className={cn(
                        "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors focus:outline-none focus:bg-[#0A4D66]/30",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-4 sm:px-6 py-3 align-middle text-white">
                        {p.serviceNo}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-9 h-9 rounded-full object-cover bg-[#0A4D66] shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#0A4D66] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                              {getPersonnelInitials(p.name)}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm text-white">{p.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {p.rank}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {p.callSign}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {p.isPilot && p.flightStatus ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
                              FLIGHT_STATUS_COLORS[p.flightStatus],
                            )}
                            title={
                              p.nextFlightDueDate
                                ? `Due ${new Date(p.nextFlightDueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                                : undefined
                            }
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                FLIGHT_STATUS_DOT[p.flightStatus],
                              )}
                            />
                            {FLIGHT_STATUS_LABELS[p.flightStatus]}
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {p.unit}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {p.branch}
                      </td>
                      <td className="px-4 py-3 align-middle text-white">
                        {p.specialty}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              statusDotColor[p.status],
                            )}
                          />
                          <span className="text-white">{p.status}</span>
                        </div>
                      </td>
                      <td
                        className="relative px-4 sm:px-6 py-3 align-middle text-right"
                        ref={openActionId === p.id ? actionMenuRef : undefined}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActions(p.id);
                          }}
                          title="Open personnel actions"
                          aria-label="Open personnel actions"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                        >
                          <Icon icon="mdi:dots-vertical" className="w-5 h-5" />
                        </button>

                        {openActionId === p.id && (
                          <div className="absolute right-4 top-10 z-20 w-48 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl">
                            <div className="py-1 text-xs text-gray-200">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(p.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:eye-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/dashboard/personnel/${p.id}/edit`)
                                }
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:pencil-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>Edit</span>
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusMenuForId((current) =>
                                      current === p.id ? null : p.id,
                                    )
                                  }
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <Icon
                                      icon="mdi:swap-horizontal"
                                      className="w-4 h-4 text-gray-300"
                                    />
                                    <span>Update Status</span>
                                  </span>
                                  <Icon
                                    icon="mdi:chevron-right"
                                    className="w-4 h-4 text-gray-400"
                                  />
                                </button>

                                {statusMenuForId === p.id && (
                                  <div className="absolute top-0 right-full mr-1 w-32 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl">
                                    {(
                                      ["Active", "Grounded", "Medical"] as const
                                    ).map((status) => (
                                      <button
                                        key={status}
                                        type="button"
                                        onClick={() =>
                                          handleChangeStatus(p.id, status)
                                        }
                                        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#0A4D66]/40"
                                      >
                                        <span>{status}</span>
                                        {p.status === status && (
                                          <Icon
                                            icon="mdi:check"
                                            className="w-4 h-4 text-emerald-400"
                                          />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:download-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>Download</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePersonnel(p.id, p.name)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400"
                              >
                                <Icon
                                  icon="mdi:trash-can-outline"
                                  className="w-4 h-4"
                                />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "grid" && (
          <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {isPersonnelLoading && filteredPersonnel.length === 0
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-xl p-5 flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#001219] animate-pulse" />
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <div className="h-3.5 w-40 bg-[#001219] rounded-full animate-pulse" />
                        <div className="h-2.5 w-28 bg-[#001219] rounded-full animate-pulse" />
                        <div className="h-2.5 w-20 bg-[#001219] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 6 }).map((__, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="h-2 w-16 bg-[#001219] rounded-full animate-pulse" />
                          <div className="h-2.5 w-24 bg-[#001219] rounded-full animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              : filteredPersonnel.map((p) => (
                  <div
                    key={p.id}
                    tabIndex={0}
                    role="button"
                    title="Click to view personnel details"
                    onClick={(e) =>
                      onInteractiveRowClick(e, () => handleOpenDetail(p.id))
                    }
                    onKeyDown={(e) =>
                      onInteractiveRowKeyDown(e, () => handleOpenDetail(p.id))
                    }
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover:border-[#7FD5FF]/70 transition-colors focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]"
                  >
                    <div className="flex items-start gap-4">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-16 h-16 rounded-full object-cover bg-[#0A4D66] shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[#0A4D66] flex items-center justify-center text-base font-semibold text-white shrink-0">
                          {getPersonnelInitials(p.name)}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-base font-semibold text-white truncate">
                          {p.name}
                        </span>
                        <span className="text-xs text-gray-400 truncate">
                          Service No. {p.serviceNo}
                        </span>
                        <div
                          className={cn(
                            "mt-1.5 inline-flex items-center gap-1.5 text-xs w-fit",
                            statusTextColor[p.status],
                          )}
                        >
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              statusDotColor[p.status],
                            )}
                          />
                          <span>{p.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#0A4D66]/30 pt-3">
                      <div className="flex flex-col">
                        <span className="text-gray-500 mb-0.5">Rank</span>
                        <span className="text-white truncate">{p.rank}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 mb-0.5">Call Sign</span>
                        <span className="text-white truncate">
                          {p.callSign}
                        </span>
                      </div>
                      {p.isPilot && p.flightStatus && (
                        <div className="flex flex-col col-span-2">
                          <span className="text-gray-500 mb-0.5">Flight Status</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[10px] font-medium",
                              FLIGHT_STATUS_COLORS[p.flightStatus],
                            )}
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                FLIGHT_STATUS_DOT[p.flightStatus],
                              )}
                            />
                            {FLIGHT_STATUS_LABELS[p.flightStatus]}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-gray-500 mb-0.5">Unit</span>
                        <span className="text-white truncate">{p.unit}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 mb-0.5">Branch</span>
                        <span className="text-white truncate">{p.branch}</span>
                      </div>
                      <div className="flex flex-col col-span-2">
                        <span className="text-gray-500 mb-0.5">Specialty</span>
                        <span className="text-white truncate">
                          {p.specialty}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </section>

      <ImportCsvModal
        open={isImportOpen}
        title="Import Personnel from CSV"
        fields={PERSONNEL_IMPORT_FIELDS}
        sampleFileName="personnel-import-sample.csv"
        onImportRow={handleImportPersonnelRow}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
};
