import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useSqPermissions } from "@/features/safety/components/sqHelpers";
import { useGetAccommodationCategoriesQuery } from "../api";
import { CategoryResidents } from "./CategoryResidents";
import { ManageAccommodation } from "./ManageAccommodation";

const MANAGE = "manage";
const MANAGE_PERMISSIONS = [
  "accommodation-categories.create",
  "accommodation-categories.update",
  "accommodation-blocks.create",
  "accommodation-blocks.update",
  "residences.create",
  "residences.update",
];

/** "Accommodation" tab of the Assets page: one pill per category, plus Manage. */
export const AccommodationTab = () => {
  const { isDark } = useTheme();
  const { hasAny } = useSqPermissions();
  const { data: categories = [], isLoading } = useGetAccommodationCategoriesQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const canManage = hasAny(MANAGE_PERMISSIONS);

  // Default to the first category; fall back if the selected one was deleted.
  const active =
    selected === MANAGE && canManage
      ? MANAGE
      : categories.find((c) => String(c.id) === selected)
        ? selected
        : categories[0]
          ? String(categories[0].id)
          : canManage
            ? MANAGE
            : null;
  const category = categories.find((c) => String(c.id) === active);

  const pill = (id: string, label: React.ReactNode, icon?: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setSelected(id)}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap",
        active === id
          ? isDark
            ? "bg-[#0A4D66] text-white font-semibold shadow-sm border border-[#7FD5FF]/40"
            : "bg-[#0A4D66] text-white font-semibold shadow-sm"
          : isDark
            ? "text-gray-300 hover:text-white hover:bg-slate-800/40"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
      )}
    >
      {icon && <Icon icon={icon} className="w-4 h-4" />}
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <div className={cn("inline-flex items-center space-x-1 p-1 rounded-lg border", isDark ? "bg-[#001825] border-[#0A4D66]/50" : "bg-slate-100 border-slate-200")}>
          {categories.map((c) =>
            pill(
              String(c.id),
              <>
                {c.name}
                <span className="opacity-60">({c.occupants_count})</span>
              </>,
            ),
          )}
          {canManage && pill(MANAGE, "Manage", "mdi:cog-outline")}
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-center py-10 opacity-60">Loading…</p>
      ) : active === MANAGE ? (
        <ManageAccommodation categories={categories} />
      ) : category ? (
        <CategoryResidents key={category.id} category={category} />
      ) : (
        <p className="text-xs text-center py-10 opacity-60">No accommodation categories have been set up yet.</p>
      )}
    </div>
  );
};
