import React from "react";
import { cn } from "@/shared/utils/cn";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusBadgeProps = {
  status?: string | null;
  variant?: BadgeVariant;
  label?: string;
  className?: string;
  children?: React.ReactNode;
};

const resolveVariant = (status?: string | null): BadgeVariant => {
  if (!status) return "neutral";
  const s = status.toLowerCase().trim();

  // Success
  if (
    s === "ok" ||
    s === "serviceable" ||
    s === "operational" ||
    s === "active" ||
    s === "resolved" ||
    s === "completed" ||
    s === "closed" ||
    s === "passed" ||
    s === "approved" ||
    s === "authorized" ||
    s === "received" ||
    s === "issued" ||
    s === "delivered"
  ) {
    return "success";
  }

  // Warning
  if (
    s === "due_soon" ||
    s === "due soon" ||
    s === "due" ||
    s === "pending" ||
    s === "in_progress" ||
    s === "in progress" ||
    s === "unserviceable" ||
    s === "medium" ||
    s === "major" ||
    s === "review" ||
    s === "ordered" ||
    s === "partially_received" ||
    s === "pending_approval" ||
    s === "pending approval" ||
    s === "awaiting_approval"
  ) {
    return "warning";
  }

  // Danger
  if (
    s === "overdue" ||
    s === "critical" ||
    s === "danger" ||
    s === "failed" ||
    s === "rejected" ||
    s === "inactive" ||
    s === "aog" ||
    s === "grounded" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "declined"
  ) {
    return "danger";
  }

  // Info
  if (
    s === "routine" ||
    s === "low" ||
    s === "info" ||
    s === "sent" ||
    s === "scheduled" ||
    s === "draft" ||
    s === "submitted" ||
    s === "new" ||
    s === "requested"
  ) {
    return "info";
  }

  return "neutral";
};

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30",
  warning:
    "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30",
  danger:
    "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-500/30",
  info:
    "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-500/30",
  neutral:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/50 dark:text-gray-300 dark:border-slate-700/50",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  label,
  className,
  children,
}) => {
  const resolved = variant || resolveVariant(status);
  const displayLabel = label || children || (status ? status.replace(/_/g, " ") : "-");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors",
        VARIANT_STYLES[resolved],
        className,
      )}
    >
      {displayLabel}
    </span>
  );
};
