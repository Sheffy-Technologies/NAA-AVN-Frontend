import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import * as XLSX from "xlsx";
import { cn } from "@/shared/utils/cn";
import { useGetOperationsQuery } from "../api";

type ViewMode = "table" | "grid";

const parseApiDateTime = (value: string): Date | null => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(" ")
    ? trimmed.replace(" ", "T")
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  completed: "bg-emerald-400",
  ongoing: "bg-amber-400",
  aborted: "bg-red-500",
};

const priorityTextColor: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-300",
  high: "text-red-400",
};

export const OperationsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: operations = [], isLoading } = useGetOperationsQuery();
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    const status = searchParams.get("status");
    const validStatuses = ["planned", "completed", "ongoing", "aborted"];
    return status && validStatuses.includes(status) ? status : "all";
  });
  const stats = useMemo(() => {
    return {
      planned: operations.filter((op) => op.status === "planned").length,
      completed: operations.filter((op) => op.status === "completed").length,
      ongoing: operations.filter((op) => op.status === "ongoing").length,
      aborted: operations.filter((op) => op.status === "aborted").length,
    };
  }, [operations]);

  const unitOptions = useMemo(() => {
    const map = new Map<number, string>();
    operations.forEach((op) => {
      if (op.unit?.id && op.unit?.name && !map.has(op.unit.id)) {
        map.set(op.unit.id, op.unit.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [operations]);

  const filteredOperations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return operations.filter((op) => {
      if (
        selectedUnitId !== "all" &&
        String(op.unit?.id ?? "") !== selectedUnitId
      ) {
        return false;
      }

      if (selectedPriority !== "all" && op.priority !== selectedPriority) {
        return false;
      }

      if (selectedStatus !== "all" && op.status !== selectedStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchFields = [
        op.name,
        op.description,
        op.priority,
        op.status,
        op.unit?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchFields.includes(query);
    });
  }, [operations, searchTerm, selectedPriority, selectedUnitId, selectedStatus]);

  const handleDownloadExcel = () => {
    if (filteredOperations.length === 0) return;

    const rows = filteredOperations.map((op) => ({
      Name: op.name || "-",
      Date: parseApiDateTime(op.start_date_time)?.toLocaleDateString() ?? "-",
      Type: op.operation_type?.name || "-",
      Category: op.operation_category?.name || "-",
      Unit: op.unit?.name || "-",
      Priority: op.priority || "-",
      Status: op.status || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Operations");
    XLSX.writeFile(
      workbook,
      `operations-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const renderTableView = () => (
    <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-200">
          <thead className="bg-[#001219] text-gray-400 uppercase text-xs">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Region</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Unit</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperations.map((op, idx) => (
              <tr
                key={op.id}
                onClick={() => navigate(String(op.id))}
                className={cn(
                  "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors",
                  idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                )}
              >
                <td className="px-6 py-3 font-medium text-white">{op.name || "—"}</td>
                <td className="px-4 py-3 text-gray-200">
                  {parseApiDateTime(op.start_date_time)?.toLocaleDateString() ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-200">{op.operation_type?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-200">{op.operation_category?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-200">{op.unit?.name || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        statusDotColor[op.status] || "bg-gray-400",
                      )}
                    />
                    <span className="capitalize">{op.status}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${op.id}/edit`);
                      }}
                      className="text-gray-400 hover:text-[#7FD5FF] transition-colors"
                      aria-label="Edit operation"
                    >
                      <Icon icon="mdi:pencil-outline" className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(String(op.id));
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                      aria-label="View operation details"
                    >
                      <Icon icon="mdi:eye-outline" className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filteredOperations.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-8 text-center text-gray-400"
                >
                  No operations match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredOperations.map((op) => (
        <div
          key={op.id}
          onClick={() => navigate(String(op.id))}
          className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-[#7FD5FF]/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{op.unit.name}</p>
              <p className="text-base font-semibold text-white">{op.name}</p>
            </div>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border border-current",
                priorityTextColor[op.priority],
              )}
            >
              {op.priority}
            </span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-2">{op.description}</p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-2 border-t border-[#0A4D66]/20">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  statusDotColor[op.status] || "bg-gray-400",
                )}
              />
              <span className="capitalize">{op.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{parseApiDateTime(op.start_date_time)?.toLocaleDateString() ?? "—"}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`${op.id}/edit`);
                }}
                className="text-gray-400 hover:text-[#7FD5FF] transition-colors"
                aria-label="Edit operation"
              >
                <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
      {filteredOperations.length === 0 && (
        <div className="col-span-full rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-6 text-center text-sm text-gray-400">
          No operations match the selected filters.
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#001219] text-gray-200">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-wide">
            OPERATIONS
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#001219] border border-[#0A4D66]/40 rounded text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:border-cyan-500/50 w-64"
              />
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#001219] p-3 rounded-lg border border-[#0A4D66]/40">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {(
              [
                { status: "planned", dot: "bg-blue-400", label: "Planned", count: stats.planned },
                { status: "completed", dot: "bg-emerald-400", label: "Completed", count: stats.completed },
                { status: "ongoing", dot: "bg-amber-400", label: "Ongoing", count: stats.ongoing },
                { status: "aborted", dot: "bg-red-500", label: "Aborted", count: stats.aborted },
              ] as const
            ).map(({ status, dot, label, count }) => (
              <button
                key={status}
                type="button"
                onClick={() =>
                  setSelectedStatus((prev) => (prev === status ? "all" : status))
                }
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1 transition-colors",
                  selectedStatus === status
                    ? "bg-[#0A4D66]/40 ring-1 ring-[#0A4D66]"
                    : "hover:bg-[#0A4D66]/20",
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", dot)} />
                {label}:{" "}
                <span className="font-bold text-white">{count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#001219] rounded-md p-1 flex border border-[#0A4D66]/40">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "table"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:table" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:view-grid" className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-[#0A4D66]/40 mx-1"></div>

            <div className="relative">
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="appearance-none px-3 py-1.5 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 focus:outline-none"
                aria-label="Filter operations by unit"
              >
                <option value="all">All Units</option>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={String(unit.id)}>
                    {unit.name}
                  </option>
                ))}
              </select>
              <Icon
                icon="mdi:chevron-down"
                className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
            </div>
            <div className="relative">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="appearance-none px-3 py-1.5 pr-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 focus:outline-none"
                aria-label="Filter operations by priority"
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <Icon
                icon="mdi:chevron-down"
                className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
            </div>

            <button
              onClick={handleDownloadExcel}
              disabled={filteredOperations.length === 0}
              className={cn(
                "p-1.5 transition-colors",
                filteredOperations.length === 0
                  ? "text-gray-600 cursor-not-allowed"
                  : "text-gray-400 hover:text-white",
              )}
              title="Download operations as Excel"
              aria-label="Download operations as Excel"
            >
              <Icon icon="mdi:download" className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate("/dashboard/operations/add")}
              className="bg-[#0369A1] text-black text-xs font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-[#0369A1]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              ADD MISSION/FLIGHT OPERATION
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mr-2" />{" "}
            Loading operations...
          </div>
        ) : (
          <>
            {viewMode === "table" && renderTableView()}
            {viewMode === "grid" && renderGridView()}
          </>
        )}
      </div>
    </div>
  );
};
