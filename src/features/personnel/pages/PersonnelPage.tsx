import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetPersonnelQuery,
  type Personnel as ApiPersonnel,
} from "@/features/personnel/api";

type PersonnelStatus = "Active" | "Grounded" | "Medical";

type Personnel = {
  id: string;
  serviceNo: string;
  name: string;
  rank: string;
  callSign: string;
  unit: string;
  branch: string;
  specialty: string;
  status: PersonnelStatus;
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
  const { data: apiPersonnel, isLoading: isPersonnelLoading } =
    useGetPersonnelQuery();

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
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [statusMenuForId, setStatusMenuForId] = useState<string | null>(null);

  const displayedPersonnel = personnel.length > 0 ? personnel : mappedPersonnel;

  const handleToggleActions = (id: string) => {
    setStatusMenuForId(null);
    setOpenActionId((current) => (current === id ? null : id));
  };

  const handleChangeStatus = (id: string, status: PersonnelStatus) => {
    setPersonnel((prev) => {
      const existing = prev.length > 0 ? prev : mappedPersonnel;
      return existing.map((p) => (p.id === id ? { ...p, status } : p));
    });
    setStatusMenuForId(null);
  };

  const handleOpenDetail = (id: string) => {
    navigate(`/dashboard/personnel/${id}`);
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center gap-4">
            <h2 className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
              Personnel
            </h2>
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#021a27] p-1">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200"
            >
              {displayedPersonnel.length}
            </button>
            <button
              type="button"
              className="hidden md:inline-flex px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 whitespace-nowrap"
            >
              All Units
            </button>
            <button
              type="button"
              className="hidden md:inline-flex px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 whitespace-nowrap"
            >
              All Personnel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Add Personnel</span>
            </button>
          </div>
        </div>

        {viewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-gray-200">
              <thead>
                <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 sm:px-6 py-3 text-left">Service No.</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Call Sign</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                  <th className="px-4 py-3 text-left">Specialty</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isPersonnelLoading && displayedPersonnel.length === 0 ? (
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
                  displayedPersonnel.map((p, index) => (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-t border-[#0A4D66]/40",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-4 sm:px-6 py-3 align-middle text-gray-100">
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
                            <span className="text-xs text-gray-400">
                              {p.unit}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {p.rank}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {p.callSign}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {p.unit}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {p.branch}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
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
                      <td className="relative px-4 sm:px-6 py-3 align-middle text-right">
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
