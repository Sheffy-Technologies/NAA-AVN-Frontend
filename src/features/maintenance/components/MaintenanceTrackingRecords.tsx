import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import {
  useGetMaintenanceDueItemsQuery,
  type MaintenanceDueItem,
  type MaintenanceDuePartType,
  type MaintenanceDueStatus,
} from "@/features/maintenance/api";

type DueFilter = "all" | "due" | MaintenanceDueStatus;

const DUE_FILTERS: Array<{ value: DueFilter; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "due", label: "Due for Maintenance (Overdue + Due Soon)" },
  { value: "overdue", label: "Overdue Only" },
  { value: "due_soon", label: "Due Soon Only" },
  { value: "ok", label: "OK" },
  { value: "not_tracked", label: "Not Tracked" },
];

const STATUS_STYLES: Record<MaintenanceDueStatus, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "border-red-500/40 bg-red-900/20 text-red-300" },
  due_soon: { label: "Due Soon", className: "border-amber-500/40 bg-amber-900/20 text-amber-300" },
  ok: { label: "OK", className: "border-emerald-500/40 bg-emerald-900/20 text-emerald-300" },
  not_tracked: { label: "Not Tracked", className: "border-gray-500/40 bg-gray-500/10 text-gray-300" },
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatNumber = (value: number | null | undefined, suffix: string) =>
  value === null || value === undefined ? null : `${value.toLocaleString()} ${suffix}`;

// Negative remaining values mean the item is past its limit.
const formatRemaining = (row: MaintenanceDueItem) => {
  const parts = [
    row.hours_remaining !== null ? `${row.hours_remaining.toLocaleString()} hrs` : null,
    row.cycles_remaining !== null ? `${row.cycles_remaining.toLocaleString()} cyc` : null,
    row.days_remaining !== null ? `${row.days_remaining.toLocaleString()} days` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "-";
};

const formatNextDue = (row: MaintenanceDueItem) => {
  const parts = [
    formatNumber(row.next_due_hours, "hrs"),
    formatNumber(row.next_due_cycles, "cyc"),
    row.next_due_date ? formatDate(row.next_due_date) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "-";
};

const rowKey = (row: Pick<MaintenanceDueItem, "part_type" | "part_id">) =>
  `${row.part_type}-${row.part_id}`;

export const MaintenanceTrackingRecords = () => {
  const navigate = useNavigate();
  const [assetFilter, setAssetFilter] = useState<number | null>(null);
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [partTypeFilter, setPartTypeFilter] = useState<MaintenanceDuePartType | "">("");

  // No filters sent to the API: it returns every tracked part system-wide, and
  // filtering client-side keeps the asset dropdown populated from the full set.
  const { data, isLoading, isError } = useGetMaintenanceDueItemsQuery();
  const allRows = useMemo(() => data?.data ?? [], [data]);

  const assetOptions: SearchableSelectOption[] = useMemo(() => {
    const seen = new Map<number, SearchableSelectOption>();
    allRows.forEach((row) => {
      if (seen.has(row.asset_id)) return;
      seen.set(row.asset_id, {
        value: row.asset_id,
        label: row.asset_tail_number
          ? `${row.asset_name} (${row.asset_tail_number})`
          : row.asset_name,
        description: row.asset_type ? String(row.asset_type) : undefined,
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  const rows = useMemo(
    () =>
      allRows.filter((row) => {
        if (assetFilter !== null && row.asset_id !== assetFilter) return false;
        if (partTypeFilter && row.part_type !== partTypeFilter) return false;
        if (dueFilter === "due") return row.status === "overdue" || row.status === "due_soon";
        if (dueFilter !== "all") return row.status === dueFilter;
        return true;
      }),
    [allRows, assetFilter, dueFilter, partTypeFilter],
  );

  const counts = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc[row.status] = (acc[row.status] ?? 0) + 1;
          return acc;
        },
        {} as Partial<Record<MaintenanceDueStatus, number>>,
      ),
    [rows],
  );

  const hasFilters = assetFilter !== null || dueFilter !== "all" || partTypeFilter !== "";

  return (
    <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-[#7FD5FF] uppercase">
            Maintenance Tracking Records
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Components, engines and avionics across all assets
          </p>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setAssetFilter(null);
              setDueFilter("all");
              setPartTypeFilter("");
            }}
            className="text-xs text-[#7FD5FF] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SearchableSelect
          placeholder="All Assets"
          searchPlaceholder="Search assets..."
          options={assetOptions}
          value={assetFilter}
          onChange={(value) => setAssetFilter(value === null ? null : Number(value))}
          buttonClassName="py-2"
        />
        <select
          title="Maintenance status"
          value={dueFilter}
          onChange={(e) => setDueFilter(e.target.value as DueFilter)}
          className="rounded-md border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-gray-200 focus:outline-none"
        >
          {DUE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          title="Item type"
          value={partTypeFilter}
          onChange={(e) => setPartTypeFilter(e.target.value as MaintenanceDuePartType | "")}
          className="rounded-md border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-gray-200 focus:outline-none"
        >
          <option value="">All Item Types</option>
          <option value="component">Components</option>
          <option value="engine">Engines</option>
          <option value="avionics">Avionics</option>
          <option value="asset">Airframe Inspections</option>
        </select>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
          <span className="text-gray-400">Showing {rows.length} of {allRows.length}</span>
          {(Object.keys(STATUS_STYLES) as MaintenanceDueStatus[]).map((status) =>
            counts[status] ? (
              <span key={status} className={cn("rounded-full border px-2 py-0.5", STATUS_STYLES[status].className)}>
                {STATUS_STYLES[status].label}: {counts[status]}
              </span>
            ) : null,
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400">Loading tracking records...</div>
      ) : isError ? (
        <div className="text-red-300">Failed to load tracking records.</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-400">
          {allRows.length === 0
            ? "No components, engines, or avionics are being tracked."
            : "No tracking records match the selected filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-[#0A4D66]/40">
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Serial</th>
                <th className="py-2 pr-3">Asset</th>
                <th className="py-2 pr-3">Current</th>
                <th className="py-2 pr-3">Next Due</th>
                <th className="py-2 pr-3">Remaining</th>
                <th className="py-2 pr-3">Projected Due</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = STATUS_STYLES[row.status] ?? STATUS_STYLES.not_tracked;
                return (
                  <tr key={rowKey(row)} className="border-b border-[#0A4D66]/20 text-gray-200">
                    <td className="py-2 pr-3 capitalize">{row.part_type}</td>
                    <td className="py-2 pr-3 text-white">{row.part_label}</td>
                    <td className="py-2 pr-3">{row.part_serial_number || "-"}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/assets/${row.asset_id}`)}
                        className="text-[#7FD5FF] hover:underline text-left"
                      >
                        {row.asset_name}
                        {row.asset_tail_number ? ` (${row.asset_tail_number})` : ""}
                      </button>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {[formatNumber(row.current_hours, "hrs"), formatNumber(row.current_cycles, "cyc")]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatNextDue(row)}</td>
                    <td
                      className={cn(
                        "py-2 pr-3 whitespace-nowrap",
                        row.status === "overdue" && "text-red-300",
                      )}
                    >
                      {formatRemaining(row)}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.projected_due_date)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs whitespace-nowrap",
                          status.className,
                        )}
                        title={row.reasons?.join("\n")}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
