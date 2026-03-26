import { useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetPersonnelQuery,
  type Personnel as ApiPersonnel,
  useGetPersonnelRanksQuery,
  useGetPersonnelSpecialtiesQuery,
  useGetPersonnelBranchesQuery,
  useUpdatePersonnelMutation,
  type PersonnelFilters,
} from "@/features/personnel/api";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

type PersonnelStatus = "Active" | "Grounded" | "Medical";

type Personnel = {
  id: string;
  unitId: number;
  rankId: number;
  branchId: number;
  specialtyId: number;
  serviceNo: string;
  name: string;
  rank: string;
  callSign: string;
  unit: string;
  branch: string;
  specialty: string;
  status: PersonnelStatus;
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

export const PersonnelPage = () => {
  const navigate = useNavigate();
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
    }),
    [
      unitFilter.selected,
      rankFilter.selected,
      branchFilter.selected,
      effectiveSpecialtiesSelected,
      statusFilter.selected,
    ],
  );

  const { data: apiPersonnel, isLoading: isPersonnelLoading } =
    useGetPersonnelQuery(filters);

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
      serviceNo: p.service_number,
      name: `${p.firstname} ${p.lastname}`,
      rank: p.rank.name,
      callSign: p.call_sign,
      unit: p.unit.name,
      branch: p.branch.name,
      specialty: p.specialty.name,
      status: mapStatus(p.status),
    }));
  }, [apiPersonnel]);

  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [statusMenuForId, setStatusMenuForId] = useState<string | null>(null);
  const [openFilterMenu, setOpenFilterMenu] = useState<
    "units" | "ranks" | "branches" | "specialties" | "status" | null
  >(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLTableCellElement>(null);

  const displayedPersonnel = mappedPersonnel;

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

  const filteredPersonnel = displayedPersonnel;

  const stats = useMemo(() => {
    return filteredPersonnel.reduce(
      (acc, p) => {
        if (p.status === "Active") acc.active++;
        else if (p.status === "Grounded") acc.grounded++;
        else if (p.status === "Medical") acc.medical++;
        return acc;
      },
      { total: filteredPersonnel.length, active: 0, grounded: 0, medical: 0 },
    );
  }, [filteredPersonnel]);

  const handleResetFilters = () => {
    setUnitFilter({ all: true, selected: [] });
    setRankFilter({ all: true, selected: [] });
    setBranchFilter({ all: true, selected: [] });
    setSpecialtyFilter({ all: true, selected: [] });
    setStatusFilter({ all: true, selected: [] });
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
    navigate(`/dashboard/personnel/${id}`);
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18] rounded-t-xl">
          <div className="flex items-center gap-4">
            <h2 className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
              Personnel
            </h2>
            <div className="flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#021a27] p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
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

          <div ref={filterBarRef} className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-1.5 rounded-full border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 hidden sm:block"
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
              className="xl:hidden px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-[11px] text-gray-200 inline-flex items-center gap-1"
            >
              <Icon icon="mdi:filter-variant" className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {[
                unitFilter,
                rankFilter,
                branchFilter,
                specialtyFilter,
                statusFilter,
              ].some((f) => !f.all) && (
                <span className="w-2 h-2 rounded-full bg-[#7FD5FF]" />
              )}
            </button>

            {/* Filters */}
            <div
              className={cn(
                // Base
                "hidden",
                // Desktop
                "xl:flex xl:flex-row xl:items-center xl:gap-2 xl:static xl:w-auto xl:bg-transparent xl:border-none xl:shadow-none xl:p-0 xl:space-y-0 xl:animate-none",
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
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-[11px] text-gray-200 inline-flex items-center gap-1"
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
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-[11px] text-gray-200 inline-flex items-center gap-1"
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
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-[11px] text-gray-200 inline-flex items-center gap-1"
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
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-[11px] text-gray-200 inline-flex items-center gap-1"
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
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-[11px] text-gray-200 inline-flex items-center gap-1"
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
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/personnel/add")}
              className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span className="hidden sm:inline">Add Personnel</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-4 sm:px-6 py-3 bg-[#001219] border-b border-[#0A4D66]/40 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#7FD5FF]" />
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
        </div>

        {viewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-gray-200">
              <thead>
                <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                  <th className="hidden xl:table-cell px-4 sm:px-6 py-3 text-left">
                    Service No.
                  </th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="hidden lg:table-cell px-4 py-3 text-left">
                    Call Sign
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-left">
                    Unit
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-left">
                    Branch
                  </th>
                  <th className="hidden xl:table-cell px-4 py-3 text-left">
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
                      colSpan={9}
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
                      className={cn(
                        "border-t border-[#0A4D66]/40",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="hidden xl:table-cell px-4 sm:px-6 py-3 align-middle text-gray-100">
                        {p.serviceNo}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0A4D66] flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                            {p.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-white">{p.name}</span>
                            <span className="text-xs text-gray-400 block md:hidden">
                              {p.unit}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {p.rank}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 align-middle text-gray-100">
                        {p.callSign}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 align-middle text-gray-100">
                        {p.unit}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 align-middle text-gray-100">
                        {p.branch}
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3 align-middle text-gray-100">
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
                          <span className="text-gray-100">{p.status}</span>
                        </div>
                      </td>
                      <td
                        className="relative px-4 sm:px-6 py-3 align-middle text-right"
                        ref={openActionId === p.id ? actionMenuRef : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleActions(p.id)}
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
          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {isPersonnelLoading && displayedPersonnel.length === 0
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-3 py-3 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#021a27] animate-pulse" />
                        <div className="flex flex-col min-w-0 gap-2">
                          <div className="h-3 w-24 bg-[#021a27] rounded-full animate-pulse" />
                          <div className="h-2.5 w-32 bg-[#021a27] rounded-full animate-pulse" />
                        </div>
                      </div>
                      <div className="h-3 w-16 bg-[#021a27] rounded-full animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-300 whitespace-nowrap overflow-hidden">
                      <div className="h-2.5 w-28 bg-[#021a27] rounded-full animate-pulse" />
                      <span className="text-gray-600">•</span>
                      <div className="h-2.5 w-20 bg-[#021a27] rounded-full animate-pulse" />
                    </div>
                  </div>
                ))
              : displayedPersonnel.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleOpenDetail(p.id)}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-3 py-3 flex flex-col gap-2 cursor-pointer hover:border-[#7FD5FF]/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#0A4D66] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                          {p.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-white truncate">
                            {p.name}
                          </span>
                          <span className="text-[11px] text-gray-400 truncate">
                            Service No. {p.serviceNo}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1 text-[11px]",
                          statusTextColor[p.status],
                        )}
                      >
                        <span>{p.status}</span>
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            statusDotColor[p.status],
                          )}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-300 whitespace-nowrap overflow-hidden">
                      <span className="truncate">Rank: {p.rank}</span>
                      <span className="text-gray-600">•</span>
                      <span className="truncate">Call Sign: {p.callSign}</span>
                      <span className="text-gray-600 hidden xl:inline">•</span>
                      <span className="truncate hidden xl:inline">
                        {p.unit}
                      </span>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </section>
    </div>
  );
};
