import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppSelector } from "@/shared/hooks/redux";
import { MultiSelect } from "@/shared/ui/multi-select/MultiSelect";
import { FilterValueField } from "@/features/reports/components/FilterValueField";
import {
  useGetReportResourcesQuery,
  useRunReportQueryQuery,
  type ReportFilter,
  type ReportFilterOperator,
  type ReportQueryArgs,
  type ReportResource,
} from "@/features/reports/api";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

const FILTER_OPERATORS: ReportFilterOperator[] = [
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "like",
  "in",
  "not_in",
  "between",
  "null",
  "not_null",
];

type FilterDraft = {
  id: number;
  field: string;
  operator: ReportFilterOperator;
  value: string;
};

type DraftState = {
  resourceKey: string;
  includes: string[];
  selectColumns: string[];
  search: string;
  searchColumns: string[];
  sortBy: string;
  sortDir: "asc" | "desc";
  perPage: number;
  filters: FilterDraft[];
};

const createEmptyFilter = (id: number): FilterDraft => ({
  id,
  field: "",
  operator: "=",
  value: "",
});

const defaultDraftState: DraftState = {
  resourceKey: "",
  includes: [],
  selectColumns: [],
  search: "",
  searchColumns: [],
  sortBy: "",
  sortDir: "desc",
  perPage: 25,
  filters: [],
};

const parseFilterValue = (operator: ReportFilterOperator, value: string) => {
  if (operator === "null" || operator === "not_null") {
    return undefined;
  }

  if (operator === "in" || operator === "not_in" || operator === "between") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
};

const buildReportArgs = (
  draft: DraftState,
  resource: ReportResource | undefined,
  page: number,
): ReportQueryArgs | null => {
  if (!resource) return null;

  const filters: ReportFilter[] = draft.filters
    .filter((filter) => filter.field.trim().length > 0)
    .map((filter) => ({
      field: filter.field.trim(),
      operator: filter.operator,
      value: parseFilterValue(filter.operator, filter.value),
    }));

  return {
    table: resource.table,
    include: draft.includes,
    select: draft.selectColumns,
    search: draft.search.trim() || undefined,
    search_columns: draft.searchColumns,
    filters,
    sort_by: draft.sortBy.trim() || undefined,
    sort_dir: draft.sortDir,
    per_page: draft.perPage,
    page,
  };
};

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const ReportsPage = () => {
  const token = useAppSelector((state) => state.auth.token);
  const [draft, setDraft] = useState<DraftState>(defaultDraftState);
  const [appliedArgs, setAppliedArgs] = useState<ReportQueryArgs | null>(null);
  const [page, setPage] = useState(1);
  const [filterSeed, setFilterSeed] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const {
    data: resources = [],
    isLoading: isResourcesLoading,
    isError: isResourcesError,
  } = useGetReportResourcesQuery();

  const selectedResource = useMemo(
    () => resources.find((resource) => resource.table === draft.resourceKey),
    [draft.resourceKey, resources],
  );

  const resourceColumnOptions = useMemo(
    () =>
      (selectedResource?.columns ?? []).map((column) => ({
        value: column,
        label: column,
      })),
    [selectedResource],
  );

  const resourceRelationOptions = useMemo(
    () =>
      (selectedResource?.relations ?? []).map((relation) => ({
        value: relation,
        label: relation,
      })),
    [selectedResource],
  );

  // Reset selections that depend on the current resource when it changes.
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      includes: [],
      selectColumns: [],
      searchColumns: [],
      sortBy: "",
    }));
  }, [draft.resourceKey]);

  const queryArgs = appliedArgs
    ? {
        ...appliedArgs,
        page,
      }
    : null;

  const {
    data: reportData,
    isFetching: isQueryLoading,
    isError: isQueryError,
  } = useRunReportQueryQuery(queryArgs as ReportQueryArgs, {
    skip: !queryArgs,
  });

  const rows = useMemo(() => reportData?.data.data ?? [], [reportData]);
  const columns = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    return Object.keys(rows[0]);
  }, [rows]);

  const currentResource = reportData?.table ?? selectedResource?.table ?? "-";
  const totalRows = reportData?.data.total ?? 0;
  const currentPage = reportData?.data.current_page ?? 1;
  const lastPage = reportData?.data.last_page ?? 1;
  const runReport = () => {
    const nextArgs = buildReportArgs(draft, selectedResource, 1);
    if (!nextArgs) return;
    setPage(1);
    setAppliedArgs(nextArgs);
    setExportError(null);
  };

  const handleAddFilter = () => {
    setDraft((current) => ({
      ...current,
      filters: [...current.filters, createEmptyFilter(filterSeed)],
    }));
    setFilterSeed((current) => current + 1);
  };

  const handleUpdateFilter = (id: number, patch: Partial<FilterDraft>) => {
    setDraft((current) => ({
      ...current,
      filters: current.filters.map((filter) =>
        filter.id === id ? { ...filter, ...patch } : filter,
      ),
    }));
  };

  const handleRemoveFilter = (id: number) => {
    setDraft((current) => ({
      ...current,
      filters: current.filters.filter((filter) => filter.id !== id),
    }));
  };

  const handleExportCsv = async () => {
    if (!appliedArgs || !API_BASE_URL || !token) {
      setExportError("Run a report first before exporting.");
      return;
    }

    setExportError(null);
    setIsExporting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/reports/export/csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appliedArgs),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `${currentResource}-report.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setExportError("Failed to export CSV. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="px-2 sm:px-0 space-y-4">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { id: "resources", label: "Resources", value: resources.length },
          { id: "rows", label: "Rows", value: totalRows },
          { id: "table", label: "Table", value: currentResource },
          { id: "page", label: "Page", value: `${currentPage}/${lastPage}` },
        ].map((card) => (
          <div
            key={card.id}
            className="h-24 sm:h-28 rounded-xl flex items-center justify-between px-4 border border-[#0A4D66]/40 bg-[#001219]"
          >
            <div>
              <p className="text-[11px] sm:text-xs uppercase tracking-wide text-gray-400">
                {card.label}
              </p>
              <p className="text-xl sm:text-2xl font-semibold text-white mt-1 break-all">
                {String(card.value)}
              </p>
            </div>
            <div className="w-10 h-10 rounded bg-[#001219] flex items-center justify-center">
              <Icon icon="mdi:chart-box-outline" className="w-5 h-5 text-white" />
            </div>
          </div>
        ))}
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden min-h-90">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#001219]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-1.5 text-xs sm:text-sm rounded-md bg-[#0A4D66] text-white border border-[#0A4D66]"
            >
              Reports
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Resource</label>
              <select
                aria-label="Report resource"
                value={draft.resourceKey}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    resourceKey: event.target.value,
                  }))
                }
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="">Select table</option>
                {resources.map((resource) => (
                  <option key={resource.table} value={resource.table}>
                    {resource.table} ({resource.model})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Search</label>
              <input
                type="text"
                value={draft.search}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Search term"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Per Page</label>
              <select
                aria-label="Rows per page"
                value={draft.perPage}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    perPage: Number(event.target.value),
                  }))
                }
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                {[25, 50, 100, 250].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Includes</label>
              <MultiSelect
                label=""
                options={resourceRelationOptions}
                selectedValues={draft.includes}
                onChange={(values) =>
                  setDraft((current) => ({
                    ...current,
                    includes: values.map((value) => String(value)),
                  }))
                }
                placeholder={
                  selectedResource
                    ? resourceRelationOptions.length
                      ? "Select relations"
                      : "No relations available"
                    : "Select a resource first"
                }
                disabled={!selectedResource || resourceRelationOptions.length === 0}
                searchable
                searchPlaceholder="Search relations"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Select Columns</label>
              <MultiSelect
                label=""
                options={resourceColumnOptions}
                selectedValues={draft.selectColumns}
                onChange={(values) =>
                  setDraft((current) => ({
                    ...current,
                    selectColumns: values.map((value) => String(value)),
                  }))
                }
                placeholder={
                  selectedResource ? "All columns" : "Select a resource first"
                }
                disabled={!selectedResource || resourceColumnOptions.length === 0}
                searchable
                searchPlaceholder="Search columns"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Search Columns</label>
              <MultiSelect
                label=""
                options={resourceColumnOptions}
                selectedValues={draft.searchColumns}
                onChange={(values) =>
                  setDraft((current) => ({
                    ...current,
                    searchColumns: values.map((value) => String(value)),
                  }))
                }
                placeholder={
                  selectedResource ? "All searchable columns" : "Select a resource first"
                }
                disabled={!selectedResource || resourceColumnOptions.length === 0}
                searchable
                searchPlaceholder="Search columns"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Sort By</label>
              <select
                aria-label="Sort by column"
                value={draft.sortBy}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sortBy: event.target.value }))
                }
                disabled={!selectedResource || resourceColumnOptions.length === 0}
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none disabled:opacity-50"
              >
                <option value="">Default</option>
                {resourceColumnOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase text-gray-400">Sort Direction</label>
              <select
                aria-label="Sort direction"
                value={draft.sortDir}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sortDir: event.target.value as "asc" | "desc",
                  }))
                }
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <datalist id="report-columns">
            {(selectedResource?.columns ?? columns).map((column) => (
              <option key={column} value={column} />
            ))}
          </datalist>

          <div className="rounded-lg border border-[#0A4D66]/40 bg-[#001825] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase text-gray-400">Filters</p>
                <p className="text-xs text-gray-500">Use comma-separated values for in, not_in, and between.</p>
              </div>
              <button
                type="button"
                onClick={handleAddFilter}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#0369A1] text-white text-xs font-medium hover:bg-[#0369A1]/90 transition-colors"
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                <span>Add Filter</span>
              </button>
            </div>

            {draft.filters.length === 0 ? (
              <p className="text-xs text-gray-400">No filters added.</p>
            ) : (
              <div className="space-y-3">
                {draft.filters.map((filter) => (
                  <div key={filter.id} className="grid gap-3 lg:grid-cols-[1.3fr,1fr,1.6fr,auto]">
                    {resourceColumnOptions.length > 0 ? (
                      <select
                        aria-label="Filter field"
                        value={filter.field}
                        onChange={(event) =>
                          handleUpdateFilter(filter.id, { field: event.target.value })
                        }
                        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
                      >
                        <option value="">Select field</option>
                        {resourceColumnOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        list="report-columns"
                        value={filter.field}
                        onChange={(event) =>
                          handleUpdateFilter(filter.id, { field: event.target.value })
                        }
                        placeholder="field"
                        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
                      />
                    )}
                    <select
                      aria-label="Filter operator"
                      value={filter.operator}
                      onChange={(event) =>
                        handleUpdateFilter(filter.id, {
                          operator: event.target.value as ReportFilterOperator,
                        })
                      }
                      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
                    >
                      {FILTER_OPERATORS.map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </select>
                    <FilterValueField
                      field={filter.field}
                      operator={filter.operator}
                      value={filter.value}
                      onChange={(next) => handleUpdateFilter(filter.id, { value: next })}
                      foreignKeys={selectedResource?.foreign_keys ?? []}
                    />
                    <button
                      type="button"
                      aria-label="Remove filter"
                      onClick={() => handleRemoveFilter(filter.id)}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10"
                    >
                      <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={runReport}
              disabled={!selectedResource}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded text-white text-xs sm:text-sm font-medium transition-colors",
                selectedResource
                  ? "bg-[#0369A1] hover:bg-[#0369A1]/90"
                  : "bg-[#0369A1]/40 text-white/60 cursor-not-allowed",
              )}
            >
              <Icon icon="mdi:play-circle-outline" className="w-4 h-4" />
              <span>Run Report</span>
            </button>
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={!appliedArgs || isExporting}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded text-white text-xs sm:text-sm font-medium transition-colors",
                appliedArgs && !isExporting
                  ? "bg-[#0369A1] hover:bg-[#0369A1]/90"
                  : "bg-[#0369A1]/40 text-white/60 cursor-not-allowed",
              )}
            >
              <Icon icon="mdi:file-delimited-outline" className="w-4 h-4" />
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>

          {exportError ? <p className="text-[11px] text-red-400">{exportError}</p> : null}
          {isResourcesError ? <p className="text-[11px] text-red-400">Failed to load report resources.</p> : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-130 text-left border-collapse text-xs sm:text-sm text-gray-200">
              <thead>
                <tr className="text-[11px] uppercase text-gray-400 border-b border-[#0A4D66]/30">
                  {columns.length > 0 ? (
                    columns.map((column) => (
                      <th key={column} className="py-2 pr-3 font-medium">
                        {column}
                      </th>
                    ))
                  ) : (
                    <th className="py-2 pr-3 font-medium">Results</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {isResourcesLoading ? (
                  <tr>
                    <td className="py-6 text-gray-400" colSpan={Math.max(columns.length, 1)}>
                      Loading report resources...
                    </td>
                  </tr>
                ) : !appliedArgs ? (
                  <tr>
                    <td className="py-6 text-gray-400" colSpan={Math.max(columns.length, 1)}>
                      Select a resource and run a report.
                    </td>
                  </tr>
                ) : isQueryLoading ? (
                  <tr>
                    <td className="py-6 text-gray-400" colSpan={Math.max(columns.length, 1)}>
                      Running report...
                    </td>
                  </tr>
                ) : isQueryError ? (
                  <tr>
                    <td className="py-6 text-red-300" colSpan={Math.max(columns.length, 1)}>
                      Failed to fetch report data.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="py-6 text-gray-400" colSpan={Math.max(columns.length, 1)}>
                      No rows returned.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`row-${index}`}
                      className={cn(
                        "border-b border-[#0A4D66]/20 last:border-b-0",
                        index % 2 === 0 ? "bg-transparent" : "bg-[#001825]/40",
                      )}
                    >
                      {columns.map((column) => (
                        <td key={`${index}-${column}`} className="py-2 pr-3 align-top text-white whitespace-pre-wrap">
                          {formatCellValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-gray-400">
              {reportData?.data.from ?? 0} - {reportData?.data.to ?? 0} of {totalRows}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!appliedArgs || currentPage <= 1 || isQueryLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 disabled:opacity-40"
              >
                <Icon icon="mdi:chevron-left" className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <span className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200">
                {currentPage}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                disabled={!appliedArgs || currentPage >= lastPage || isQueryLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 disabled:opacity-40"
              >
                <span>Next</span>
                <Icon icon="mdi:chevron-right" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
