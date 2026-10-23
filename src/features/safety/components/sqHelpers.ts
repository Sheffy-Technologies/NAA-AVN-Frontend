import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppSelector } from "@/app/store";

export const humanize = (value?: string | null) =>
  value ? value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "-";

export const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const useSqPermissions = () => {
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);
  return {
    has: (permission: string) => permissions.includes(permission),
    hasAny: (list: string[]) => list.some((p) => permissions.includes(p)),
  };
};

export const usePanelClass = () => {
  const { isDark } = useTheme();
  return isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800 shadow-sm";
};

export const useFieldClass = () => {
  const { isDark } = useTheme();
  return cn(
    "w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors",
    isDark
      ? "bg-[#001219] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF]"
      : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#0A4D66]",
  );
};
