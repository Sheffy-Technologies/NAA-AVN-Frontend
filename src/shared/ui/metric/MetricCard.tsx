import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";

export type MetricBadgeColor =
  | "emerald"
  | "amber"
  | "red"
  | "sky"
  | "indigo"
  | "teal"
  | "neutral";

export interface MetricCardProps {
  id?: string;
  label: string;
  value: string | number;
  icon?: string;
  badge?: string;
  badgeColor?: MetricBadgeColor;
  subtext?: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  label,
  value,
  icon,
  badge,
  badgeColor = "sky",
  subtext,
  isActive = false,
  onClick,
  className,
}) => {
  const { isDark } = useTheme();

  const badgeStyles: Record<MetricBadgeColor, string> = {
    emerald: isDark
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : "bg-emerald-50 text-emerald-800 border-emerald-200",
    amber: isDark
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-amber-50 text-amber-800 border-amber-200",
    red: isDark
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : "bg-red-50 text-red-800 border-red-200",
    sky: isDark
      ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
      : "bg-sky-50 text-sky-800 border-sky-200",
    indigo: isDark
      ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
      : "bg-indigo-50 text-indigo-800 border-indigo-200",
    teal: isDark
      ? "bg-teal-500/15 text-teal-300 border-teal-500/30"
      : "bg-teal-50 text-teal-800 border-teal-200",
    neutral: isDark
      ? "bg-slate-800/50 text-slate-300 border-slate-700/50"
      : "bg-slate-100 text-slate-700 border-slate-200",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      id={id}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between w-full group relative",
        onClick ? "cursor-pointer hover:scale-[1.01]" : "cursor-default",
        isDark
          ? isActive
            ? "bg-[#001825] border-[#7FD5FF] ring-1 ring-[#7FD5FF]/60 shadow-lg text-white"
            : "bg-[#001219] border-[#0A4D66]/40 text-white hover:border-[#7FD5FF]/60 hover:shadow-lg"
          : isActive
            ? "bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20 shadow-md text-slate-900"
            : "bg-white border-slate-200 text-slate-900 shadow-sm hover:border-[#0A4D66]/50 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2 w-full">
        <span
          className={cn(
            "text-xs uppercase font-semibold tracking-wider truncate",
            isDark ? "text-gray-400 group-hover:text-gray-300" : "text-slate-500 group-hover:text-slate-700",
          )}
        >
          {label}
        </span>
        {icon && (
          <div
            className={cn(
              "p-2 rounded-lg shrink-0 transition-colors border",
              isDark
                ? "bg-[#001825] border-[#0A4D66]/40 text-[#7FD5FF]"
                : "bg-slate-100 border-slate-200 text-[#0A4D66]",
            )}
          >
            <Icon icon={icon} className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1 w-full">
        <span
          className={cn(
            "text-2xl font-bold tracking-tight truncate",
            isDark ? "text-white" : "text-slate-900",
          )}
        >
          {value}
        </span>
        {badge && (
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
              badgeStyles[badgeColor],
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {subtext && (
        <p
          className={cn(
            "text-[11px] mt-2 font-medium truncate",
            isDark ? "text-gray-400" : "text-slate-500",
          )}
        >
          {subtext}
        </p>
      )}
    </Component>
  );
};
