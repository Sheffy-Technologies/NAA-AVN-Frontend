import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { StatusBadge, type BadgeVariant } from "@/shared/ui/badge/StatusBadge";
import type { BadgeStatus, VisitStatus } from "../api";
import { VISIT_STATUS_LABEL } from "../vmsHelpers";

/* Small dependency-free charts for the Visitor Management overview. */

const VISIT_STATUS_VARIANT: Record<VisitStatus, BadgeVariant> = {
  pending: "warning",
  approved: "info",
  checked_in: "success",
  checked_out: "neutral",
  rejected: "danger",
};

const BADGE_VARIANT: Record<BadgeStatus, BadgeVariant> = {
  Pending: "warning",
  Active: "success",
  Returned: "neutral",
  Expired: "neutral",
  Cancelled: "neutral",
  Lost: "danger",
  Damaged: "danger",
  Revoked: "danger",
};

export const VisitStatusBadge = ({ status }: { status: VisitStatus | null | undefined }) =>
  status ? (
    <StatusBadge variant={VISIT_STATUS_VARIANT[status] ?? "neutral"} label={VISIT_STATUS_LABEL[status] ?? status} />
  ) : (
    <span>—</span>
  );

export const BadgeStatusBadge = ({ status, number }: { status: BadgeStatus; number?: string | null }) => (
  <StatusBadge variant={BADGE_VARIANT[status] ?? "neutral"} label={number ? `${number} · ${status}` : status} />
);

export type BarRow = {
  key: string;
  label: string;
  value: number;
  sub?: string;
  barClassName?: string;
};

/** Horizontal bars, longest first as given. Rows are clickable when `onSelect` is set. */
export const BarList = ({
  rows,
  onSelect,
  activeKey,
  empty = "No data for this period.",
}: {
  rows: BarRow[];
  onSelect?: (key: string) => void;
  activeKey?: string | null;
  empty?: string;
}) => {
  const { isDark } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (!rows.length || rows.every((r) => r.value === 0)) {
    return <div className={cn("py-6 text-center text-xs", isDark ? "text-gray-400" : "text-slate-500")}>{empty}</div>;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const Comp = onSelect ? "button" : "div";
        const active = activeKey === row.key;
        return (
          <li key={row.key}>
            <Comp
              type={onSelect ? "button" : undefined}
              onClick={onSelect ? () => onSelect(row.key) : undefined}
              title={onSelect ? (active ? "Clear this filter" : `Filter by ${row.label}`) : undefined}
              className={cn(
                "block w-full text-left rounded-md",
                onSelect && "px-1.5 -mx-1.5 py-1 -my-1 transition-colors",
                onSelect && (isDark ? "hover:bg-white/5" : "hover:bg-slate-50"),
                active && (isDark ? "bg-white/10" : "bg-sky-50"),
              )}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className={cn("truncate", isDark ? "text-gray-200" : "text-slate-700")}>
                  {row.label}
                  {row.sub && <span className={cn("ml-1.5", isDark ? "text-gray-500" : "text-slate-400")}>{row.sub}</span>}
                </span>
                <span className={cn("font-semibold tabular-nums", isDark ? "text-white" : "text-slate-900")}>{row.value}</span>
              </div>
              <div className={cn("h-2 rounded-full", isDark ? "bg-white/10" : "bg-slate-100")}>
                <div
                  className={cn("h-2 rounded-full", row.barClassName ?? "bg-sky-500")}
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </Comp>
          </li>
        );
      })}
    </ul>
  );
};

/** Vertical columns (visits per day, check-ins per hour). Every n-th label is shown so they never overlap. */
export const ColumnChart = ({
  points,
  height = 160,
  formatTitle,
}: {
  points: { key: string; label: string; value: number }[];
  height?: number;
  formatTitle?: (point: { label: string; value: number }) => string;
}) => {
  const { isDark } = useTheme();
  const max = Math.max(1, ...points.map((p) => p.value));
  const labelEvery = Math.max(1, Math.ceil(points.length / 10));

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {points.map((point) => (
          <div
            key={point.key}
            className="group relative flex h-full flex-1 items-end"
            title={formatTitle ? formatTitle(point) : `${point.label}: ${point.value}`}
          >
            <div
              className={cn(
                "w-full rounded-t-sm transition-colors",
                point.value > 0 ? "bg-sky-500 group-hover:bg-sky-400" : isDark ? "bg-white/5" : "bg-slate-100",
              )}
              style={{ height: point.value > 0 ? `${Math.max(4, (point.value / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {points.map((point, index) => (
          <div
            key={point.key}
            className={cn("flex-1 overflow-visible whitespace-nowrap text-center text-[10px]", isDark ? "text-gray-500" : "text-slate-400")}
          >
            {index % labelEvery === 0 ? point.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
};
