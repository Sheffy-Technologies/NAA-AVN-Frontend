import { NavLink } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";

const TABS = [
  {
    label: "Personnel",
    path: "/dashboard/personnel",
    icon: "mdi:account-group-outline",
    end: true,
  },
  {
    label: "Pass",
    path: "/dashboard/personnel/pass",
    icon: "mdi:calendar-check-outline",
    end: false,
  },
];

export const PersonnelModuleTabs = () => (
  <div className="flex items-center gap-1 border-b border-[#0A4D66]/40 px-4 sm:px-6 bg-[#001219]">
    {TABS.map((tab) => (
      <NavLink
        key={tab.path}
        to={tab.path}
        end={tab.end}
        className={({ isActive }) =>
          cn(
            "inline-flex items-center gap-2 px-3 py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors",
            isActive
              ? "border-[#7FD5FF] text-white"
              : "border-transparent text-gray-400 hover:text-gray-200",
          )
        }
      >
        <Icon icon={tab.icon} className="w-4 h-4" />
        <span>{tab.label}</span>
      </NavLink>
    ))}
  </div>
);
