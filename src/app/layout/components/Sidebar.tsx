import { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { AUTH_STORAGE_KEY, logout } from "@/features/auth/authSlice";
import { useTheme } from "@/context/ThemeContext";
import { useGetPendingApprovalCountQuery } from "@/features/approvals/api";

type NavItem = {
  name: string;
  path: string;
  icon: string;
  /** If set, the item is only shown to users who have at least one of these permissions. */
  requiredPermissions?: string[];
  /** Shows the number of approval requests awaiting the user's signature. */
  showApprovalCount?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: "mdi:view-dashboard",
    requiredPermissions: ["dashboard.home.view"],
  },
  // { name: "Weather", path: "/dashboard/weather", icon: "mdi:thermometer" },
  {
    name: "Units",
    path: "/dashboard/units",
    icon: "mdi:office-building",
    requiredPermissions: ["units.viewAny"],
  },
  {
    name: "Assets",
    path: "/dashboard/assets",
    icon: "mdi:sitemap",
    requiredPermissions: ["assets.viewAny", "dashboard.home.view", "accommodation-categories.viewAny"],
  },
  {
    name: "Operations",
    path: "/dashboard/operations",
    icon: "mdi:database",
    requiredPermissions: ["dashboard.operations.view", "operations.viewAny"],
  },
  {
    name: "Personnel",
    path: "/dashboard/personnel",
    icon: "mdi:account",
    requiredPermissions: ["dashboard.personnel.view", "personnel.viewAny"],
  },
  {
    name: "Inventory",
    path: "/dashboard/inventory",
    icon: "mdi:package-variant",
    requiredPermissions: ["dashboard.inventories.view", "inventories.viewAny"],
  },
  {
    name: "Maintenance Hub",
    path: "/dashboard/maintenance",
    icon: "mdi:wrench-outline",
    requiredPermissions: [
      "dashboard.maintenance.view",
      "work-orders.viewAny",
      "maintenance-programs.viewAny",
      "maintenance-store.view",
      "maintenance-store.issue",
    ],
  },
  {
    name: "Approvals",
    path: "/dashboard/approvals",
    icon: "mdi:file-sign",
    requiredPermissions: ["approvals.viewAny", "approval-workflows.viewAny"],
    showApprovalCount: true,
  },
  {
    name: "Safety & Quality",
    path: "/dashboard/safety-quality",
    icon: "mdi:shield-check-outline",
    requiredPermissions: [
      "safety-quality.dashboard.view",
      "safety-reports.viewAny",
      "safety-risks.viewAny",
      "safety-investigations.viewAny",
      "quality-audits.viewAny",
      "quality-findings.viewAny",
      "corrective-actions.viewAny",
      "compliance-requirements.viewAny",
      "controlled-documents.viewAny",
      "personnel-qualifications.viewAny",
      "safety-quality.pilot-currency.view",
      "safety-quality.training.view",
      "safety-quality.unit-oversight.view",
      "safety-quality.reports.view",
    ],
  },
  {
    name: "Finances",
    path: "/dashboard/finance",
    icon: "mdi:wallet-outline",
    requiredPermissions: [
      "dashboard.finance.view",
      "expenses.viewAny",
      "budgets.viewAny",
    ],
  },
  {
    name: "Strategic Command",
    path: "/dashboard/strategic",
    icon: "mdi:radar",
    requiredPermissions: ["dashboard.strategic.view"],
  },
  {
    name: "Security",
    path: "/dashboard/security",
    icon: "mdi:shield-outline",
    requiredPermissions: [
      "roles.viewAny",
      "permissions.viewAny",
      "devices.viewAny",
      "activity-logs.viewAny",
    ],
  },
  {
    name: "Reports",
    path: "/dashboard/reports",
    icon: "mdi:chart-line",
    requiredPermissions: ["reports.resources.view", "reports.query"],
  },
  {
    name: "Documents",
    path: "/dashboard/documents",
    icon: "mdi:book-open-page-variant",
  },
];

const MESSAGING_ITEMS: NavItem[] = [
  {
    name: "Messages",
    path: "/dashboard/messages",
    icon: "mdi:email-outline",
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    name: "User",
    path: "/dashboard/users",
    icon: "mdi:user-outline",
    requiredPermissions: ["users.viewAny"],
  },
];

export const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const userPermissions = useAppSelector(
    (state) => state.auth.user?.permissions ?? [],
  );

  const canAccess = (item: NavItem) => {
    if (!item.requiredPermissions?.length) return true;
    return item.requiredPermissions.some((p) => userPermissions.includes(p));
  };

  const visibleNavItems = NAV_ITEMS.filter(canAccess);
  const { data: approvalCountData } = useGetPendingApprovalCountQuery(undefined, {
    skip: !userPermissions.includes("approvals.viewAny"),
    pollingInterval: 60_000,
  });
  const approvalCount = approvalCountData?.count ?? 0;
  const visibleMessagingItems = MESSAGING_ITEMS.filter(canAccess);
  const visibleBottomItems = BOTTOM_ITEMS.filter(canAccess);

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
    if (typeof window === "undefined")
      return { name: "User", rolesLabel: "No role" };

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

  /* ── theme-derived classes ─────────────────────────── */
  const sidebarBg = isDark
    ? "bg-[#001219] border-[#0A4D66]/30"
    : "bg-white border-gray-200";
  const defaultText = isDark ? "text-gray-400" : "text-gray-600";
  const sectionLbl = isDark ? "text-gray-500" : "text-gray-400";
  const dividerCls = isDark ? "border-[#0A4D66]/30" : "border-gray-200";
  const profileCard = isDark
    ? "bg-[#001219] border-[#0A4D66]/30 hover:bg-[#0A4D66]/30"
    : "bg-gray-50 border-gray-200 hover:bg-gray-100";
  const profileName = isDark ? "text-white" : "text-gray-900";
  const profileRole = isDark ? "text-gray-500" : "text-gray-500";

  const navItemCls = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
      isActive
        ? isDark
          ? "bg-[#0A4D66] text-white shadow-lg shadow-blue-900/20 border-l-4 border-[#7FD5FF]"
          : "bg-blue-50/90 text-[#0369A1] font-bold border-l-4 border-[#0369A1] shadow-sm"
        : isDark
          ? `hover:bg-[#0A4D66]/50 hover:text-white ${defaultText}`
          : `hover:bg-gray-100 hover:text-gray-900 ${defaultText}`,
    );

  const navItemSmCls = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
      isActive
        ? isDark
          ? "bg-[#0A4D66] text-white shadow-lg shadow-blue-900/20 border-l-4 border-[#7FD5FF]"
          : "bg-blue-50/90 text-[#0369A1] font-bold border-l-4 border-[#0369A1] shadow-sm"
        : isDark
          ? `hover:bg-[#0A4D66]/50 hover:text-white ${defaultText}`
          : `hover:bg-gray-100 hover:text-gray-900 ${defaultText}`,
    );

  const bottomItemCls = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
      isActive
        ? isDark
          ? "bg-[#0A4D66] text-white border-l-4 border-[#7FD5FF]"
          : "bg-blue-50/90 text-[#0369A1] font-bold border-l-4 border-[#0369A1] shadow-sm"
        : isDark
          ? `hover:bg-[#0A4D66]/50 hover:text-white ${defaultText}`
          : `hover:bg-gray-100 hover:text-gray-900 ${defaultText}`,
    );

  return (
    <aside
      className={`w-64 border-r flex flex-col h-screen ${sidebarBg} ${defaultText}`}
    >
      {/* Logo Area */}
      <div className="p-6 flex items-center">
        <img
          src={isDark ? "/images/logoDarkMode.png" : "/images/logoLightMode.png"}
          alt="NA AVN logo"
          className="h-10 object-contain"
        />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/dashboard"}
            className={({ isActive }) => navItemCls(isActive)}
          >
            {({ isActive }) => (
              <>
                <Icon
                  icon={item.icon}
                  className={cn(
                    "w-5 h-5 shrink-0 transition-colors",
                    isActive
                      ? isDark
                        ? "text-[#7FD5FF]"
                        : "text-[#0369A1]"
                      : isDark
                        ? "text-gray-400"
                        : "text-gray-500",
                  )}
                />
                <span
                  className={cn(
                    "truncate",
                    isActive
                      ? isDark
                        ? "text-white font-medium"
                        : "text-[#0369A1] font-bold"
                      : "",
                  )}
                >
                  {item.name}
                </span>
                {item.showApprovalCount && approvalCount > 0 && (
                  <span className="ml-auto px-1.5 min-w-[1.25rem] text-center rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {approvalCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className={`pt-3 mt-3 border-t ${dividerCls}`}>
          <div
            className={`px-4 pb-2 text-[10px] uppercase tracking-widest ${sectionLbl}`}
          >
            Messaging
          </div>
          <div className="space-y-1">
            {visibleMessagingItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => navItemSmCls(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      icon={item.icon}
                      className={cn(
                        "w-5 h-5 shrink-0 transition-colors",
                        isActive
                          ? isDark
                            ? "text-[#7FD5FF]"
                            : "text-[#0369A1]"
                          : isDark
                            ? "text-gray-400"
                            : "text-gray-500",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate",
                        isActive
                          ? isDark
                            ? "text-white font-medium"
                            : "text-[#0369A1] font-bold"
                          : "",
                      )}
                    >
                      {item.name}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div
        className={`p-3 mt-auto border-t ${dividerCls} ${isDark ? "bg-[#001219]" : "bg-white"}`}
      >
        <div className="space-y-1 mb-4">
          {visibleBottomItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => bottomItemCls(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    icon={item.icon}
                    className={cn(
                      "w-5 h-5 shrink-0 transition-colors",
                      isActive
                        ? isDark
                          ? "text-[#7FD5FF]"
                          : "text-[#0369A1]"
                        : isDark
                          ? "text-gray-400"
                          : "text-gray-500",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate",
                      isActive
                        ? isDark
                          ? "text-white font-medium"
                          : "text-[#0369A1] font-bold"
                        : "",
                    )}
                  >
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className={`mt-1 w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 hover:bg-red-500/10 hover:text-red-500 ${defaultText}`}
          >
            <Icon icon="mdi:logout" className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>

        {/* User Profile */}
        <div
          className={`mx-2 p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${profileCard}`}
        >
          <div className="w-8 h-8 rounded-full bg-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${profileName}`}>
              {signedInUser.name}
            </p>
            <p className={`text-xs truncate ${profileRole}`}>
              {signedInUser.rolesLabel}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
