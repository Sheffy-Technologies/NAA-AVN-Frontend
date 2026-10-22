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
  {
    label: "Course",
    path: "/dashboard/personnel/courses",
    icon: "mdi:school-outline",
    end: false,
  },
  {
    label: "Attendance",
    path: "/dashboard/personnel/attendance",
    icon: "mdi:clipboard-check-outline",
    end: false,
  },
];

export const PersonnelModuleTabs = () => (
  <nav
    role="tablist"
    aria-label="Personnel Navigation Tabs"
    className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 dark:border-[#0A4D66]/40 px-3 sm:px-6 bg-slate-50/80 dark:bg-[#001219] overflow-x-auto scrollbar-none"
  >
    {TABS.map((tab) => (
      <NavLink
        key={tab.path}
        to={tab.path}
        end={tab.end}
        role="tab"
        className={({ isActive }) =>
          cn(
            "tab-link group relative inline-flex items-center gap-2 px-3.5 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px rounded-t-lg outline-none",
            isActive
              ? "active border-[#0369A1] dark:border-[#7FD5FF] text-[#0369A1] dark:text-[#7FD5FF] bg-sky-100/70 dark:bg-[#0A4D66]/30 font-bold shadow-none"
              : "border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:bg-slate-100/70 dark:hover:bg-white/5",
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              icon={tab.icon}
              className={cn(
                "w-4 h-4 transition-colors",
                isActive
                  ? "text-[#0369A1] dark:text-[#7FD5FF]"
                  : "text-slate-400 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-200",
              )}
            />
            <span className={isActive ? "font-bold text-[#0369A1] dark:text-[#7FD5FF]" : ""}>
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0369A1] dark:bg-[#7FD5FF] shadow-[0_0_8px_rgba(3,105,161,0.5)] dark:shadow-[0_0_8px_rgba(127,213,255,0.7)]" />
            )}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);
