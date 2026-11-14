import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import type { VisitStatus } from "./api";

/**
 * VMS scheduled dates arrive as midnight UTC. Read the date part as-is so the
 * day never shifts with the browser's time zone.
 */
export const formatVmsDate = (value: string | null | undefined): string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return format(new Date(y, m - 1, d), "d MMM yyyy");
};

export const formatVmsDateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  try {
    return format(parseISO(value), "d MMM yyyy, HH:mm");
  } catch {
    return value;
  }
};

export const formatVmsTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  try {
    return format(parseISO(value), "HH:mm");
  } catch {
    return value;
  }
};

export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const visitDurationMinutes = (checkIn: string | null, checkOut: string | null): number | null => {
  if (!checkIn || !checkOut) return null;
  const diff = (parseISO(checkOut).getTime() - parseISO(checkIn).getTime()) / 60000;
  return diff >= 0 ? Math.round(diff) : null;
};

export const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** Delays a fast-changing value (search boxes) so each keystroke doesn't call the VMS. */
export const useDebouncedValue = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  checked_in: "Checked in",
  checked_out: "Checked out",
  rejected: "Rejected",
};

/** Bar colours per visit status, in the same families as the badges. */
export const VISIT_STATUS_BAR: Record<VisitStatus, string> = {
  pending: "bg-amber-400",
  approved: "bg-sky-500",
  checked_in: "bg-emerald-500",
  checked_out: "bg-slate-400",
  rejected: "bg-red-500",
};

