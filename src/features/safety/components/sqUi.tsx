import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { StatusBadge, type BadgeVariant } from "@/shared/ui/badge/StatusBadge";
import { humanize, usePanelClass } from "./sqHelpers";

/** Safety & Quality statuses mapped to the shared badge colours. */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  high: "danger",
  lapsed: "danger",
  attention_required: "danger",
  missing: "danger",
  overdue: "danger",
  medium: "warning",
  under_review: "warning",
  investigation: "warning",
  in_progress: "warning",
  action_in_progress: "warning",
  awaiting_verification: "warning",
  evidence_review: "warning",
  review_due: "warning",
  expiring_soon: "warning",
  action_required: "warning",
  due_for_flight: "warning",
  no_flights: "warning",
  low: "info",
  open: "info",
  planned: "info",
  draft: "info",
  monitoring: "info",
  restricted: "danger",
  general: "neutral",
  superseded: "neutral",
  not_applicable: "neutral",
  cancelled: "neutral",
  current: "success",
  on_track: "success",
  closed: "success",
  completed: "success",
  approved: "success",
  accepted: "success",
  active: "warning",
};

export const SqStatus = ({ value, label }: { value?: string | null; label?: string }) => (
  <StatusBadge status={value ?? undefined} variant={value ? STATUS_VARIANTS[value] : undefined} label={label ?? humanize(value)} />
);

export const SqPanel = ({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => {
  const { isDark } = useTheme();
  const panel = usePanelClass();
  return (
    <div className={cn("border rounded-xl p-5", panel, className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && (
              <h2 className="text-sm font-bold text-[#0A4D66] dark:text-[#7FD5FF] uppercase tracking-wide">{title}</h2>
            )}
            {subtitle && <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
};

export const PrimaryButton = ({
  icon = "mdi:plus-circle-outline",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }) => (
  <button
    type="button"
    {...props}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap",
      props.className,
    )}
  >
    <Icon icon={icon} className="w-4 h-4" />
    <span>{children}</span>
  </button>
);

export const SecondaryButton = ({
  icon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }) => (
  <button
    type="button"
    {...props}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#0A4D66] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 whitespace-nowrap",
      props.className,
    )}
  >
    {icon && <Icon icon={icon} className="w-4 h-4" />}
    <span>{children}</span>
  </button>
);

export type SqColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
};

export function SqTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty = "No records found.",
  loading,
}: {
  rows: T[];
  columns: SqColumn<T>[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  empty?: string;
  loading?: boolean;
}) {
  const { isDark } = useTheme();

  if (loading) {
    return <div className={cn("py-10 text-center text-xs", isDark ? "text-gray-400" : "text-slate-500")}>Loading…</div>;
  }

  if (!rows.length) {
    return <div className={cn("py-10 text-center text-xs", isDark ? "text-gray-400" : "text-slate-500")}>{empty}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr
            className={cn(
              "text-left border-b font-semibold uppercase tracking-wider",
              isDark ? "text-gray-400 border-[#0A4D66]/40" : "text-slate-500 border-slate-200",
            )}
          >
            {columns.map((c) => (
              <th key={c.key} className={cn("py-2.5 px-3 whitespace-nowrap", c.align === "right" && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn("divide-y", isDark ? "divide-[#0A4D66]/20" : "divide-slate-100")}>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={(e) => {
                if (!onRowClick) return;
                const target = e.target as HTMLElement;
                if (target.closest("button, a, input, select, textarea")) return;
                onRowClick(row);
              }}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
              className={cn(
                onRowClick && "cursor-pointer",
                onRowClick && (isDark ? "hover:bg-white/5" : "hover:bg-slate-50"),
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("py-2.5 px-3 align-top", c.align === "right" && "text-right")}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const StatTile = ({
  label,
  value,
  sub,
  icon,
  tone = "sky",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: string;
  tone?: "sky" | "amber" | "red" | "emerald";
}) => {
  const { isDark } = useTheme();
  const panel = usePanelClass();
  const toneClass = {
    sky: "text-sky-600 dark:text-[#7FD5FF]",
    amber: "text-amber-600 dark:text-amber-300",
    red: "text-red-600 dark:text-red-400",
    emerald: "text-emerald-600 dark:text-emerald-300",
  }[tone];

  return (
    <div className={cn("border rounded-xl p-4", panel)}>
      <div className={cn("flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
        <span>{label}</span>
        <Icon icon={icon} className={cn("w-5 h-5", toneClass)} />
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
      {sub && <div className={cn("text-[11px] mt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>{sub}</div>}
    </div>
  );
};
