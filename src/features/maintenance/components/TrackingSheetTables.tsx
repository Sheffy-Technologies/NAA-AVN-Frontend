import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useGetInspectionItemsQuery, type InspectionItem, type MaintenanceDueItem } from "../api";
import { NumberedPagination } from "@/shared/ui/pagination/NumberedPagination";

/*
 * The Maintenance Tracking tables follow the mechanics' offline tracking sheet
 * (e.g. "Tracking -011"): life-limited parts on top, recurring inspections /
 * ADs / SBs below. Every column header has an ⓘ explaining what it means and,
 * where computed, the formula — the same arithmetic as the sheet.
 */

type ColumnHelp = { label: string; title: string; text: string; formula?: string; align?: "right" };

const PART_COLUMNS: ColumnHelp[] = [
  {
    label: "% Rem",
    title: "% REM — life remaining",
    text: "How much of the part's service life is left. Below 5% the part is flagged Due Soon, as the tracking sheet highlights it.",
    formula: "% REM = Time remaining ÷ Service life",
  },
  { label: "Part No.", title: "Part number", text: "Manufacturer part number (P/N). For engines and avionics without a P/N, the model is shown." },
  { label: "Description", title: "Description", text: "What the part is: component type, engine category/position or avionics category." },
  { label: "S/N", title: "Serial number", text: "Serial number of the individual part fitted to this aircraft." },
  { label: "Aircraft", title: "Aircraft", text: "The aircraft the part is installed on. Click the row to open the aircraft." },
  {
    label: "Service Action",
    title: "Service action",
    text: "How the part is controlled and what happens at the limit. HRS = flying hours, CYC = cycles, CAL = calendar, COND = on-condition (no fixed limit). RET = retire (scrap), OH = overhaul, INSP = inspect, REP = replace.",
    formula: "e.g. HRS/RET = retire at a flying-hours limit",
  },
  {
    label: "Comp Current",
    title: "Component current (TSN/TSO/I)",
    text: "The part's own hours now: Time Since New, Since Overhaul or Since Inspection. The part's clock starts from its hours when fitted and runs with the airframe's flying.",
    formula: "Comp current = Comp @ inst + (A/C T.T. − A/F @ inst)",
  },
  {
    label: "Time Remaining",
    title: "Time remaining",
    text: "Flying hours left before the part reaches its service life (or the next interval for items tracked by inspection interval). Days are shown for calendar items. Negative means overdue.",
    formula: "Time remaining = A/F hrs due − A/C T.T.",
  },
  {
    label: "A/F Hrs Due",
    title: "Airframe hours due",
    text: "The aircraft's total hours at which the part reaches its life, so it can be compared with the airframe hour meter directly. For calendar items, the due date.",
    formula: "A/F hrs due = Service life − Comp @ inst + A/F @ inst",
  },
  {
    label: "Service Life",
    title: "Service life",
    text: "The part's life limit in hours (retirement or overhaul life), from the manufacturer or maintenance programme. 'COND' parts have no fixed limit.",
  },
  {
    label: "A/F @ Inst",
    title: "Airframe hours at installation",
    text: "The aircraft's total hours on the day the part was fitted. Without it the part's hours can't be advanced, and the row is marked so it can be completed.",
  },
  {
    label: "Comp @ Inst",
    title: "Component hours at installation",
    text: "The part's own hours (TSN/TSO/I) when it was fitted, from its log card. Recorded as Time Since New on the part.",
  },
  {
    label: "Status",
    title: "Status",
    text: "Overdue: no time left on any limit. Due Soon: under 5% of life, or under 50 hours / 30 cycles / 30 days to the next due point. OK otherwise. An overdue part grounds the aircraft.",
    align: "right",
  },
];

const INSPECTION_COLUMNS: ColumnHelp[] = [
  { label: "Task", title: "Task", text: "The recurring task from the maintenance programme: inspection, phase check, lube, oil change, AD, SB or retorque." },
  {
    label: "Category",
    title: "Category",
    text: "Scheduled maintenance, Airworthiness Directive (AD, mandatory) or Service Bulletin (SB/ASB), with its reference number.",
  },
  { label: "Aircraft", title: "Aircraft", text: "The aircraft this task applies to. Programme tasks not tied to one aircraft apply to every aircraft." },
  {
    label: "Interval",
    title: "Interval",
    text: "How often the task repeats, in flying hours, cycles and/or months. When more than one applies, whichever comes first.",
  },
  {
    label: "Last Done",
    title: "Last done",
    text: "Airframe hours and date when the task was last completed: the latest completed work-order task for this programme on this aircraft.",
  },
  {
    label: "Next Due",
    title: "Next due",
    text: "Airframe hours (and/or date) at which the task is due again.",
    formula: "Next due = A/F hrs last done + interval hours\nDate due = date last done + interval months",
  },
  {
    label: "Remaining",
    title: "Remaining",
    text: "Hours, cycles or days left until the task is due. Negative means overdue.",
    formula: "Remaining = Next due − A/C T.T.",
  },
  {
    label: "Status",
    title: "Status",
    text: "Overdue: past due. Due Soon: 10 hours / cycles / days or fewer left, as the sheet highlights. Not recorded: never completed in the system, so no due point can be worked out yet.",
    align: "right",
  },
];

const fmt = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? null : value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;

const Dash = () => <span className="text-slate-400">–</span>;

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, [string, string]> = {
    overdue: ["Overdue", "bg-red-500/10 text-red-500 dark:text-red-300 border-red-500/30"],
    due_soon: ["Due Soon", "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30"],
    ok: ["OK", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"],
    not_recorded: ["Not recorded", "bg-slate-500/10 text-slate-500 dark:text-gray-300 border-slate-400/30"],
    not_tracked: ["Not tracked", "bg-slate-500/10 text-slate-500 dark:text-gray-300 border-slate-400/30"],
  };
  const [label, cls] = map[status] ?? map.not_tracked;
  return <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap", cls)}>{label}</span>;
};

const HeaderRow = ({ columns }: { columns: ColumnHelp[] }) => {
  const { isDark } = useTheme();
  return (
    <tr
      className={cn(
        "text-left border-b font-semibold uppercase tracking-wider",
        isDark ? "text-gray-400 border-[#0A4D66]/40" : "text-slate-500 border-slate-200",
      )}
    >
      {columns.map((c) => (
        <th key={c.label} className={cn("py-2.5 px-3 whitespace-nowrap", c.align === "right" && "text-right")}>
          {c.label}
          <InfoTip title={c.title} formula={c.formula}>
            {c.text}
          </InfoTip>
        </th>
      ))}
    </tr>
  );
};

/** Life-limited parts: the top half of the tracking sheet. */
export const PartTrackingTable = ({ rows }: { rows: MaintenanceDueItem[] }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const open = (assetId: number) =>
    navigate(`/dashboard/assets/${assetId}`, { state: { from: "/dashboard/maintenance", fromLabel: "Maintenance Tracking" } });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <HeaderRow columns={PART_COLUMNS} />
          </thead>
          <tbody className={cn("divide-y", isDark ? "divide-[#0A4D66]/20" : "divide-slate-100")}>
            {pagedRows.map((row) => {
              const hasLife = row.life_limit_hours !== null && row.life_limit_hours !== undefined;
              const remainingHours = hasLife ? row.life_remaining_hours : row.hours_remaining;
              const dueHours = hasLife ? row.airframe_hours_due : row.next_due_hours;
              const pct = row.percent_remaining;
              return (
                <tr
                  key={`${row.part_type}-${row.part_id}-${row.asset_id}`}
                  tabIndex={0}
                  role="button"
                  title="Click to view the aircraft"
                  onClick={(e) => onInteractiveRowClick(e, () => open(row.asset_id))}
                  onKeyDown={(e) => onInteractiveRowKeyDown(e, () => open(row.asset_id))}
                  className={cn(
                    "cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50",
                    isDark ? "text-gray-200 hover:bg-[#0A4D66]/20" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <td className={cn("py-2.5 px-3 font-semibold", pct !== null && pct !== undefined && pct < 0.05 && "text-red-500")}>
                    {pct !== null && pct !== undefined ? `${Math.round(pct * 100)}%` : <Dash />}
                  </td>
                  <td className="py-2.5 px-3 font-mono">{row.part_number || <Dash />}</td>
                  <td className="py-2.5 px-3 font-semibold">
                    {row.part_label}
                    <div className="text-[10px] font-normal uppercase opacity-60">{row.part_type}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono">{row.part_serial_number || <Dash />}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {row.asset_name}
                    {row.asset_tail_number ? ` (${row.asset_tail_number})` : ""}
                  </td>
                  <td className="py-2.5 px-3 font-mono whitespace-nowrap">{row.service_action_code || <Dash />}</td>
                  <td className="py-2.5 px-3">{fmt(row.component_current_hours) ?? <Dash />}</td>
                  <td className={cn("py-2.5 px-3 whitespace-nowrap", remainingHours !== null && remainingHours !== undefined && remainingHours <= 0 && "text-red-500 font-semibold")}>
                    {remainingHours !== null && remainingHours !== undefined ? (
                      `${fmt(remainingHours)} hrs`
                    ) : row.days_remaining !== null ? (
                      `${row.days_remaining} days`
                    ) : (
                      <Dash />
                    )}
                    {remainingHours !== null && remainingHours !== undefined && row.days_remaining !== null && (
                      <div className="text-[10px] opacity-60">{row.days_remaining} days</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {dueHours !== null && dueHours !== undefined ? fmt(dueHours) : fmtDate(row.next_due_date) ?? <Dash />}
                    {dueHours !== null && dueHours !== undefined && row.next_due_date && <div className="text-[10px] opacity-60">{fmtDate(row.next_due_date)}</div>}
                  </td>
                  <td className="py-2.5 px-3">{hasLife ? fmt(row.life_limit_hours, 0) : row.service_action_code === "COND" ? "COND" : <Dash />}</td>
                  <td className="py-2.5 px-3">
                    {row.airframe_hours_at_installation_missing ? (
                      <span className="text-amber-600 dark:text-amber-300" title="Record the airframe hours when this part was fitted so its hours can be tracked.">
                        Not recorded
                      </span>
                    ) : (
                      fmt(row.airframe_hours_at_installation) ?? <Dash />
                    )}
                  </td>
                  <td className="py-2.5 px-3">{fmt(row.component_hours_at_installation) ?? <Dash />}</td>
                  <td className="py-2.5 px-3 text-right">
                    <StatusPill status={row.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          className={cn(
            "flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-lg border text-xs",
            isDark ? "bg-[#001825] border-[#0A4D66]/30 text-gray-400" : "bg-slate-50 border-slate-200 text-slate-600",
          )}
        >
          <span>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, rows.length)} of {rows.length} tracked components
          </span>
          <NumberedPagination currentPage={page} lastPage={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
};

const CATEGORY_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  airworthiness_directive: "AD",
  service_bulletin: "SB / ASB",
};

const intervalLabel = (i: InspectionItem) =>
  [i.interval_hours ? `${fmt(i.interval_hours, 0)} hrs` : null, i.interval_cycles ? `${i.interval_cycles} cyc` : null, i.interval_months ? `${i.interval_months} mon` : null]
    .filter(Boolean)
    .join(" / ") || null;

/** Recurring tasks per aircraft: the inspections / AD & ASB / retorque half of the sheet. */
export const InspectionTrackingTable = ({ assetId, statusFilter }: { assetId?: string; statusFilter?: string }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading, isError } = useGetInspectionItemsQuery({
    asset_type: "aircraft",
    ...(assetId ? { asset_id: Number(assetId) } : {}),
  });

  const rows = useMemo(
    () =>
      (data?.data ?? []).filter(
        (r) => (!category || r.category === category) && (!statusFilter || statusFilter === "all" || r.status === statusFilter),
      ),
    [data, category, statusFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [rows.length, category, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

  return (
    <div className="mt-8 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#0A4D66] dark:text-[#7FD5FF] uppercase tracking-wide">Inspections, ADs &amp; Recurring Tasks</h3>
          <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
            Maintenance programme tasks per aircraft, from their last completed work order. Advisory: these don't ground an aircraft by
            themselves.
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          {[["", "All"], ["scheduled", "Inspections"], ["airworthiness_directive", "ADs"], ["service_bulletin", "SBs"]].map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                "rounded px-2 py-1 border transition-colors",
                category === value
                  ? "bg-[#0A4D66] border-[#7FD5FF] text-[#7FD5FF]"
                  : isDark
                    ? "border-[#0A4D66]/40 text-gray-400 hover:text-gray-200"
                    : "border-slate-300 text-slate-600 hover:bg-slate-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className={cn("text-xs py-6 text-center", isDark ? "text-gray-400" : "text-slate-500")}>Loading inspections…</div>
      ) : isError ? (
        <div className="text-red-500 dark:text-red-300 text-xs py-4">Failed to load inspections.</div>
      ) : rows.length === 0 ? (
        <div className={cn("text-xs py-6 text-center", isDark ? "text-gray-400" : "text-slate-500")}>
          No maintenance programme tasks match. Add tasks under Maintenance Program.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <HeaderRow columns={INSPECTION_COLUMNS} />
            </thead>
            <tbody className={cn("divide-y", isDark ? "divide-[#0A4D66]/20" : "divide-slate-100")}>
              {pagedRows.map((r) => {
                const remaining =
                  r.hours_remaining !== null
                    ? `${fmt(r.hours_remaining)} hrs`
                    : r.cycles_remaining !== null
                      ? `${r.cycles_remaining} cyc`
                      : r.days_remaining !== null
                        ? `${r.days_remaining} days`
                        : null;
                const negative = [r.hours_remaining, r.cycles_remaining, r.days_remaining].some((v) => v !== null && v <= 0);
                return (
                  <tr
                    key={`${r.asset_id}-${r.program_id}`}
                    tabIndex={r.last_work_order_id ? 0 : undefined}
                    onClick={(e) => r.last_work_order_id && onInteractiveRowClick(e, () => navigate(`/dashboard/maintenance/work-orders/${r.last_work_order_id}`))}
                    onKeyDown={(e) => r.last_work_order_id && onInteractiveRowKeyDown(e, () => navigate(`/dashboard/maintenance/work-orders/${r.last_work_order_id}`))}
                    title={r.last_work_order_id ? "Open the work order that last completed this task" : undefined}
                    className={cn(
                      "transition-colors",
                      r.last_work_order_id && "cursor-pointer",
                      isDark ? "text-gray-200 hover:bg-[#0A4D66]/20" : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <td className="py-2.5 px-3 font-semibold min-w-[220px]">
                      {r.name}
                      {r.ata_chapter && <div className="text-[10px] font-normal opacity-60">ATA {r.ata_chapter}</div>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.category ? CATEGORY_LABEL[r.category] : <Dash />}
                      {r.reference_number && <div className="text-[10px] opacity-60 font-mono">{r.reference_number}</div>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.asset_name}
                      {r.asset_tail_number ? ` (${r.asset_tail_number})` : ""}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{intervalLabel(r) ?? <Dash />}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.last_done_airframe_hours !== null ? `${fmt(r.last_done_airframe_hours)} hrs` : <Dash />}
                      {r.last_done_date && <div className="text-[10px] opacity-60">{fmtDate(r.last_done_date)}</div>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.next_due_hours !== null ? `${fmt(r.next_due_hours)} hrs` : fmtDate(r.next_due_date) ?? <Dash />}
                      {r.next_due_hours !== null && r.next_due_date && <div className="text-[10px] opacity-60">{fmtDate(r.next_due_date)}</div>}
                    </td>
                    <td className={cn("py-2.5 px-3 whitespace-nowrap", negative && "text-red-500 font-semibold")}>{remaining ?? <Dash />}</td>
                    <td className="py-2.5 px-3 text-right">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div
          className={cn(
            "flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-lg border text-xs",
            isDark ? "bg-[#001825] border-[#0A4D66]/30 text-gray-400" : "bg-slate-50 border-slate-200 text-slate-600",
          )}
        >
          <span>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, rows.length)} of {rows.length} inspections
          </span>
          <NumberedPagination currentPage={page} lastPage={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
};
