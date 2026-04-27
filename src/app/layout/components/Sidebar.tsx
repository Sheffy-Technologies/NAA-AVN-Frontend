import { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { AUTH_STORAGE_KEY, logout } from "@/features/auth/authSlice";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard", icon: "mdi:view-dashboard" },
  // { name: "Weather", path: "/dashboard/weather", icon: "mdi:thermometer" },
  { name: "Units", path: "/dashboard/units", icon: "mdi:office-building" },
  { name: "Assets", path: "/dashboard/assets", icon: "mdi:sitemap" },
  { name: "Operations", path: "/dashboard/operations", icon: "mdi:database" },
  { name: "Personnel", path: "/dashboard/personnel", icon: "mdi:account" },
  { name: "Inventory", path: "/dashboard/inventory", icon: "mdi:package-variant" },
  { name: "Finances", path: "/dashboard/finance", icon: "mdi:wallet-outline" },
  { name: "Security", path: "/dashboard/security", icon: "mdi:shield-outline" },
  { name: "Reports", path: "/dashboard/reports", icon: "mdi:chart-line" },
  {
    name: "Documents",
    path: "/dashboard/documents",
    icon: "mdi:book-open-page-variant",
  },
];

const MAINTENANCE_ITEMS = [
  {
    name: "Maintenance Hub",
    path: "/dashboard/maintenance",
    icon: "mdi:wrench-cog-outline",
  },
];

const BOTTOM_ITEMS = [
  {
    name: "User",
    path: "/dashboard/users",
    icon: "mdi:user-outline",
  },
];

export const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const toTitleCase = (value: string) =>
    value
      .replace(/[_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  const formatRolesLabel = (roles: string[]) => {
    if (!roles.length) return "No role";

    const normalizedRoles = roles.map(toTitleCase);
    const visibleRoles = normalizedRoles.slice(0, 2);
    const remainingCount = normalizedRoles.length - visibleRoles.length;

    return remainingCount > 0
      ? `${visibleRoles.join(", ")} +${remainingCount}`
      : visibleRoles.join(", ");
  };

  const signedInUser = useMemo(() => {
    if (typeof window === "undefined") return { name: "User", rolesLabel: "No role" };

    try {
      const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return { name: "User", rolesLabel: "No role" };

      const parsed = JSON.parse(stored) as {
        user?: {
          firstname?: string | null;
          lastname?: string | null;
          name?: string | null;
          roles?: Array<{ name?: string | null }>;
          role_names?: string[];
        };
      };

      const firstname = parsed.user?.firstname?.trim() || "";
      const lastname = parsed.user?.lastname?.trim() || "";
      const fullName = `${firstname} ${lastname}`.trim();

      const roleNamesFromRoles = Array.isArray(parsed.user?.roles)
        ? parsed.user?.roles
            .map((role) => (role?.name || "").trim())
            .filter((name) => name.length > 0)
        : [];

      const roleNamesFromRoleNames = Array.isArray(parsed.user?.role_names)
        ? parsed.user?.role_names
            .map((name) => (name || "").trim())
            .filter((name) => name.length > 0)
        : [];

      const roleNames = roleNamesFromRoleNames.length
        ? roleNamesFromRoleNames
        : roleNamesFromRoles;

      const rolesLabel = formatRolesLabel(roleNames);

      if (fullName) return { name: fullName, rolesLabel };
      if (parsed.user?.name?.trim()) {
        return { name: parsed.user.name.trim(), rolesLabel };
      }

      return { name: "User", rolesLabel };
    } catch {
      return { name: "User", rolesLabel: "No role" };
    }
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/auth/login");
  };

  return (
    <aside className="w-64 bg-[#00090D] border-r border-[#0A4D66]/30 flex flex-col h-screen text-gray-300">
      {/* Logo Area */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#001219] flex items-center justify-center">
          <img
            src="/images/logo.png"
            alt="NA AVN logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg tracking-wider">
            NA AVN
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">
            Digital Data Base Management System
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/dashboard"} // Only exact match for dashboard root if needed, but usually dashboard is exact
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-[#0A4D66] text-white shadow-lg shadow-blue-900/20 border-l-2 border-[#7FD5FF]"
                  : "hover:bg-[#0A4D66]/50 hover:text-white text-gray-400",
              )
            }
          >
            <Icon icon={item.icon} className="w-5 h-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}

        <div className="pt-3 mt-3 border-t border-[#0A4D66]/30">
          <div className="px-4 pb-2 text-[10px] uppercase tracking-widest text-gray-500">
            Maintenance
          </div>
          <div className="space-y-1">
            {MAINTENANCE_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "bg-[#0A4D66] text-white shadow-lg shadow-blue-900/20 border-l-2 border-[#7FD5FF]"
                      : "hover:bg-[#0A4D66]/50 hover:text-white text-gray-400",
                  )
                }
              >
                <Icon icon={item.icon} className="w-5 h-5" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 mt-auto border-t border-[#0A4D66]/30 bg-[#00090D]">
        <div className="space-y-1 mb-4">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "bg-[#0A4D66] text-white"
                    : "hover:bg-[#0A4D66]/50 hover:text-white text-gray-400",
                )
              }
            >
              <Icon icon={item.icon} className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 text-gray-400 hover:bg-red-700/30 hover:text-red-400"
          >
            <Icon icon="mdi:logout" className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>

        {/* User Profile */}
        <div className="mx-2 p-3 rounded-lg bg-[#001219] border border-[#0A4D66]/30 flex items-center gap-3 cursor-pointer hover:bg-[#0A4D66]/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-gray-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {signedInUser.name}
            </p>
            <p className="text-xs text-gray-500 truncate">{signedInUser.rolesLabel}</p>
          </div>
          {/* <Icon icon="mdi:chevron-down" className="w-4 h-4 text-gray-400" /> */}
        </div>
      </div>
    </aside>
  );
};
