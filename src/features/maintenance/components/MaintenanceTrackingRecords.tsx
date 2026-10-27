import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import type { DueHorizon } from "@/features/maintenance/tracker/trackerHelpers";
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
  const [dueHorizonFilter, setDueHorizonFilter] = useState<DueHorizon>("all");
  const [customHours, setCustomHours] = useState<string>("50");
  const [customDays, setCustomDays] = useState<string>("30");

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

  const parsedCustomHours = Number(customHours) || 50;
  const parsedCustomDays = Number(customDays) || 30;

  const rows = useMemo(
    () =>
      allRows.filter((row) => {
        if (assetFilter !== null && row.asset_id !== assetFilter) return false;
        if (partTypeFilter && row.part_type !== partTypeFilter) return false;
        if (dueFilter === "due") {
          if (row.status !== "overdue" && row.status !== "due_soon") return false;
        } else if (dueFilter !== "all" && row.status !== dueFilter) {
          return false;
        }

        if (dueHorizonFilter !== "all") {
          const hrs = row.hours_remaining;
          const days = row.days_remaining;
          let match = true;
          switch (dueHorizonFilter) {
            case "hrs_50":
              match = hrs !== null && hrs <= 50;
              break;
            case "hrs_100":
              match = hrs !== null && hrs <= 100;
              break;
            case "hrs_200":
              match = hrs !== null && hrs <= 200;
              break;
            case "hrs_500":
              match = hrs !== null && hrs <= 500;
              break;
            case "custom_hrs":
              match = hrs !== null && hrs <= parsedCustomHours;
              break;
            case "cal_1m":
              match = days !== null && days <= 30;
              break;
            case "cal_2m":
              match = days !== null && days <= 60;
              break;
            case "cal_3m":
              match = days !== null && days <= 90;
              break;
            case "cal_6m":
              match = days !== null && days <= 180;
              break;
            case "cal_1y":
              match = days !== null && days <= 365;
              break;
            case "custom_days":
              match = days !== null && days <= parsedCustomDays;
              break;
            case "combo_50h_1m":
              match = (hrs !== null && hrs <= 50) || (days !== null && days <= 30);
              break;
            case "combo_100h_2m":
              match = (hrs !== null && hrs <= 100) || (days !== null && days <= 60);
              break;
            case "combo_200h_3m":
              match = (hrs !== null && hrs <= 200) || (days !== null && days <= 90);
              break;
          }
          if (!match) return false;
        }

        return true;
      }),
    [allRows, assetFilter, dueFilter, partTypeFilter, dueHorizonFilter, parsedCustomHours, parsedCustomDays],
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

  const hasFilters =
    assetFilter !== null ||
    dueFilter !== "all" ||
    partTypeFilter !== "" ||
    dueHorizonFilter !== "all";

  const handleClearFilters = () => {
    setAssetFilter(null);
    setDueFilter("all");
    setPartTypeFilter("");
    setDueHorizonFilter("all");
  };

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
            onClick={handleClearFilters}
            className="text-xs text-[#7FD5FF] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Quick Due Horizon Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs">
        <span className="text-gray-400 font-semibold mr-1">Coming due:</span>
        {[
          { id: "all", label: "All" },
          { id: "hrs_50", label: "≤ 50 hrs" },
          { id: "hrs_100", label: "≤ 100 hrs" },
          { id: "hrs_200", label: "≤ 200 hrs" },
          { id: "cal_1m", label: "≤ 1 mo (30d)" },
          { id: "cal_2m", label: "≤ 2 mos (60d)" },
          { id: "cal_3m", label: "≤ 3 mos (90d)" },
          { id: "cal_6m", label: "≤ 6 mos (180d)" },
          { id: "cal_1y", label: "≤ 1 yr (365d)" },
        ].map((chip) => {
          const isSelected = dueHorizonFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className={cn(
                "rounded-full px-2.5 py-0.5 font-medium transition-colors border text-xs",
                isSelected
                  ? "bg-amber-900/40 text-amber-300 border-amber-500/50 font-bold"
                  : "bg-[#001825] text-gray-300 border-[#0A4D66]/40 hover:border-[#7FD5FF]/50",
              )}
              onClick={() => setDueHorizonFilter(chip.id as DueHorizon)}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SearchableSelect
          placeholder="All Assets"
          searchPlaceholder="Search assets..."
          options={assetOptions}
          value={assetFilter}
          onChange={(value) => setAssetFilter(value === null ? null : Number(value))}
          buttonClassName="py-2"
        />

        <div className="flex gap-2 items-center">
          <select
            title="Due horizon"
            value={dueHorizonFilter}
            onChange={(e) => setDueHorizonFilter(e.target.value as DueHorizon)}
            className="w-full rounded-md border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-gray-200 focus:outline-none"
          >
            <option value="all">Due horizon: All</option>
            <optgroup label="Operating Hours Remaining">
              <option value="hrs_50">Due in ≤ 50 hours</option>
              <option value="hrs_100">Due in ≤ 100 hours</option>
              <option value="hrs_200">Due in ≤ 200 hours</option>
              <option value="hrs_500">Due in ≤ 500 hours</option>
              <option value="custom_hrs">Custom hours…</option>
            </optgroup>
            <optgroup label="Calendar Time Remaining">
              <option value="cal_1m">Due in ≤ 1 month (30 days)</option>
              <option value="cal_2m">Due in ≤ 2 months (60 days)</option>
              <option value="cal_3m">Due in ≤ 3 months (90 days)</option>
              <option value="cal_6m">Due in ≤ 6 months (180 days)</option>
              <option value="cal_1y">Due in ≤ 1 year (365 days)</option>
              <option value="custom_days">Custom days…</option>
            </optgroup>
            <optgroup label="Combined (Hours or Calendar)">
              <option value="combo_50h_1m">Due in ≤ 50 hrs OR ≤ 1 mo</option>
              <option value="combo_100h_2m">Due in ≤ 100 hrs OR ≤ 2 mos</option>
              <option value="combo_200h_3m">Due in ≤ 200 hrs OR ≤ 3 mos</option>
            </optgroup>
          </select>
          {dueHorizonFilter === "custom_hrs" && (
            <input
              type="number"
              min="1"
              step="5"
              value={customHours}
              onChange={(e) => setCustomHours(e.target.value)}
              placeholder="50"
              className="w-20 rounded-md border border-[#0A4D66]/40 bg-[#001825] px-2 py-2 text-sm text-gray-200 focus:outline-none"
            />
          )}
          {dueHorizonFilter === "custom_days" && (
            <input
              type="number"
              min="1"
              step="5"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="30"
              className="w-20 rounded-md border border-[#0A4D66]/40 bg-[#001825] px-2 py-2 text-sm text-gray-200 focus:outline-none"
            />
          )}
        </div>

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
                  <tr
                    key={rowKey(row)}
                    tabIndex={row.asset_id ? 0 : undefined}
                    role={row.asset_id ? "button" : undefined}
                    title={row.asset_id ? "Click to view asset details" : undefined}
                    onClick={(e) => {
                      if (row.asset_id) {
                        onInteractiveRowClick(e, () => navigate(`/dashboard/assets/${row.asset_id}`));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (row.asset_id) {
                        onInteractiveRowKeyDown(e, () => navigate(`/dashboard/assets/${row.asset_id}`));
                      }
                    }}
                    className={cn(
                      "border-b border-[#0A4D66]/20 text-gray-200 transition-colors",
                      row.asset_id && "cursor-pointer hover:bg-[#0A4D66]/20 focus:outline-none focus:bg-[#0A4D66]/30"
                    )}
                  >
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
