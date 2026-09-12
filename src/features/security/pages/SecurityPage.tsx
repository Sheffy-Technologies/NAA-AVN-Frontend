import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import {
  useCreateRoleMutation,
  useGetActivityLogsQuery,
  useGetDevicesQuery,
  useGetPermissionsQuery,
  useGetRolesQuery,
  useGetSystemSettingsQuery,
  useGetUserRolesQuery,
  useSyncRolePermissionsMutation,
  useSyncUserRolesMutation,
  useSyncUserUnitsMutation,
  useUpdateDeviceStatusMutation,
  useUpdateSystemSettingsMutation,
  type RoleRecord,
} from "@/features/security/api";
import { useGetUsersQuery, useUpdateUserMutation } from "@/features/users/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { MultiSelect } from "@/shared/ui/multi-select/MultiSelect";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";

type SecurityTab = "activity" | "device" | "user" | "rbac" | "system";

export const SecurityPage = () => {
  const { isDark } = useTheme();

  const searchInputClassName = isDark
    ? "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
    : "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 transition-colors";

  const panelClassName = isDark
    ? "rounded-xl border border-[#0A4D66]/40 bg-[linear-gradient(180deg,rgba(0,42,64,0.95)_0%,rgba(0,22,34,0.98)_100%)]"
    : "rounded-xl border border-gray-200 bg-white shadow-[0_4px_15px_rgba(0,0,0,0.05)]";

  const titleText = isDark ? "text-white" : "text-gray-900";
  const labelText = isDark ? "text-gray-300" : "text-gray-700";
  const mutedText = isDark ? "text-gray-400" : "text-gray-500";
  const subtleText = isDark ? "text-gray-500" : "text-gray-400";
  const chipText = isDark ? "text-gray-200" : "text-gray-700";
  const accentText = isDark ? "text-[#7FD5FF]" : "text-[#0369A1]";
  const borderCls = isDark ? "border-[#0A4D66]/40" : "border-gray-200";
  const borderSubtleCls = isDark ? "border-[#0A4D66]/35" : "border-gray-200";
  const chipBg = isDark ? "bg-[#001219]" : "bg-gray-50";
  const cardBg = isDark ? "bg-[#001825]" : "bg-white";
  const accentChipBg = isDark ? "bg-[#0369A1]/15" : "bg-blue-50";
  const accentChipBorder = isDark ? "border-[#7FD5FF]/30" : "border-blue-300";
  const accentBtnBg = isDark ? "bg-[#001219]" : "bg-blue-50";
  const roleCardIdle = isDark
    ? "border-[#0A4D66]/35 bg-[#001825] hover:border-[#0A4D66]/70"
    : "border-gray-200 bg-white hover:border-blue-300";
  const roleCardSelected = isDark
    ? "border-[#7FD5FF]/70 bg-[#01283D] shadow-[0_0_0_1px_rgba(127,213,255,0.2)]"
    : "border-blue-400 bg-blue-50 shadow-[0_0_0_1px_rgba(37,99,235,0.2)]";
  const dashedBorderCls = isDark ? "border-[#0A4D66]/40" : "border-gray-300";

  const [activeTab, setActiveTab] = useState<SecurityTab>("activity");
  const [openDeviceActionId, setOpenDeviceActionId] = useState<number | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", permissions: [] as string[] });
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);
  const [permissionFilter, setPermissionFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [assignRolesUserId, setAssignRolesUserId] = useState<number | null>(null);
  const [assignRolesDraft, setAssignRolesDraft] = useState<string[]>([]);
  const [assignUnitsUserId, setAssignUnitsUserId] = useState<number | null>(null);
  const [assignUnitsDraft, setAssignUnitsDraft] = useState<number[]>([]);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editUserDraft, setEditUserDraft] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    phone_number: "",
    password: "",
    confirmPassword: "",
  });
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [activityEventFilter, setActivityEventFilter] = useState("");

  const { data: activityLogsResponse, isLoading } = useGetActivityLogsQuery({
    page: activityPage,
    event: activityEventFilter || undefined,
  });
  const { data: devices = [], isLoading: isDevicesLoading } = useGetDevicesQuery();
  const [updateDeviceStatus, { isLoading: isUpdatingDeviceStatus }] = useUpdateDeviceStatusMutation();
  const { data: users = [], isLoading: isUsersLoading, refetch: refetchUsers } = useGetUsersQuery();
  const { data: units = [], isLoading: isUnitsLoading } = useGetUnitsQuery();
  const { data: roles = [], isLoading: isRolesLoading, refetch: refetchRoles } = useGetRolesQuery();
  const {
    data: permissionCatalog,
    isLoading: isPermissionsLoading,
    refetch: refetchPermissions,
  } = useGetPermissionsQuery();
  const {
    data: selectedUserAssignment,
    isFetching: isUserRoleLoading,
    refetch: refetchUserAssignment,
  } = useGetUserRolesQuery(selectedUserId ?? 0, {
    skip: selectedUserId === null,
  });
  const [createRole, { isLoading: isCreatingRole }] = useCreateRoleMutation();
  const [syncRolePermissions, { isLoading: isSavingRolePermissions }] =
    useSyncRolePermissionsMutation();
  const [syncUserRoles, { isLoading: isSavingUserRoles }] =
    useSyncUserRolesMutation();
  const [syncUserUnits, { isLoading: isSavingUserUnits }] =
    useSyncUserUnitsMutation();
  const [updateUser, { isLoading: isSavingUserEdit }] = useUpdateUserMutation();

  const authUser = useAppSelector((state) => state.auth.user);
  const isSuperAdmin = useMemo(() => {
    const names = (authUser?.role_names ?? authUser?.roles?.map((r) => r.name) ?? []) as string[];
    return names.includes("super-admin");
  }, [authUser]);

  const {
    data: systemSettings,
    isFetching: isSystemSettingsLoading,
    refetch: refetchSystemSettings,
  } = useGetSystemSettingsQuery(undefined, { skip: !isSuperAdmin });
  const [updateSystemSettings, { isLoading: isSavingSystemSettings }] =
    useUpdateSystemSettingsMutation();

  const handleToggleOtpLogin = async (next: boolean) => {
    try {
      await updateSystemSettings({ otp_login_enabled: next }).unwrap();
      dispatch(
        showToast({
          message: next
            ? "OTP login enabled. Users will be required to verify by email."
            : "OTP login disabled.",
          type: "success",
        }),
      );
      void refetchSystemSettings();
    } catch {
      dispatch(showToast({ message: "Failed to update system settings.", type: "error" }));
    }
  };

  const [passIntervalDraft, setPassIntervalDraft] = useState("");

  useEffect(() => {
    if (systemSettings?.pass_interval_months !== undefined) {
      setPassIntervalDraft(String(systemSettings.pass_interval_months));
    }
  }, [systemSettings]);

  const handleSavePassInterval = async () => {
    const months = Number(passIntervalDraft);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      dispatch(
        showToast({
          message: "Enter a valid pass interval between 1 and 24 months.",
          type: "error",
        }),
      );
      return;
    }

    try {
      await updateSystemSettings({ pass_interval_months: months }).unwrap();
      dispatch(showToast({ message: "Pass interval updated.", type: "success" }));
      void refetchSystemSettings();
    } catch {
      dispatch(showToast({ message: "Failed to update pass interval.", type: "error" }));
    }
  };

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const currentDateTime = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  }, []);

  const userRows = useMemo(() => {
    return users.map((u) => {
      const created = u.created_at ? new Date(u.created_at) : null;
      const hasValid = created && !Number.isNaN(created.getTime());
      const name =
        [u.firstname, u.lastname].filter(Boolean).join(" ") ||
        u.username ||
        u.email ||
        "-";

      return {
        id: u.id,
        name,
        email: u.email || "-",
        phone: u.phone_number || "-",
        roles: (u.roles || []).map((role) => role.name).filter(Boolean) as string[],
        unitIds: (u.units || []).map((unit) => unit.id),
        unitNames: (u.units || []).map((unit) => unit.name),
        created: hasValid
          ? created.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : "-",
      };
    });
  }, [users]);

  const filteredUserRows = useMemo(() => {
    const query = userSearchQuery.trim().toLowerCase();
    if (!query) return userRows;

    return userRows.filter((row) =>
      [row.name, row.email, row.phone, ...row.roles].some((field) =>
        field?.toLowerCase().includes(query),
      ),
    );
  }, [userRows, userSearchQuery]);

  const displayRows = useMemo(() => {
    return (activityLogsResponse?.data ?? []).map((log) => {
      const createdAt = log.created_at ? new Date(log.created_at) : null;
      const validDate = createdAt && !Number.isNaN(createdAt.getTime());
      const date =
        log.date ||
        (validDate
          ? createdAt.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "-");
      const time =
        log.time ||
        (validDate
          ? `${createdAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })} Z`
          : "-");
      const name =
        [log.causer?.firstname, log.causer?.lastname].filter(Boolean).join(" ") ||
        log.name ||
        log.user?.name ||
        [log.user?.firstname, log.user?.lastname, log.user?.othernames]
          .filter(Boolean)
          .join(" ") ||
        "-";

      return {
        id: log.id,
        date,
        time,
        name,
        email: log.causer?.email || "-",
        action: log.description || log.action || "-",
        event: log.event || "-",
        userType: log.user_type || "-",
        deviceCode: log.device_code || "-",
        unit: log.unit?.name || "-",
      };
    });
  }, [activityLogsResponse]);

  const deviceRows = useMemo(() => {
    return devices.map((device) => {
      const lastSeenRaw = device.last_seen_at || device.updated_at || device.created_at;
      const parsed = lastSeenRaw ? new Date(lastSeenRaw) : null;
      const hasValidDate = parsed && !Number.isNaN(parsed.getTime());

      return {
        id: device.id,
        name: device.device_name || device.name || "-",
        code: device.device_code || device.code || "-",
        status:
          Number(device.is_active) === 1
            ? "active"
            : Number(device.is_active) === 0
              ? "inactive"
              : "-",
        lastSeen: hasValidDate
          ? parsed.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : "-",
      };
    });
  }, [devices]);

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.name, label: role.name })),
    [roles],
  );

  const unitOptions = useMemo(
    () => units.map((unit) => ({ value: unit.id, label: unit.name })),
    [units],
  );

  const permissionOptions = useMemo(() => {
    const names = permissionCatalog?.permissions || permissionCatalog?.defined_permissions || [];

    return names.map((permission) => ({ value: permission, label: permission }));
  }, [permissionCatalog]);

  const filteredPermissionOptions = useMemo(() => {
    if (!permissionFilter.trim()) return permissionOptions;
    const query = permissionFilter.trim().toLowerCase();

    return permissionOptions.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [permissionFilter, permissionOptions]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const rbacStats = useMemo(() => {
    const usersWithRoles = userRows.filter((user) => user.roles.length > 0).length;

    return {
      roleCount: roles.length,
      permissionCount:
        permissionCatalog?.permissions?.length ||
        permissionCatalog?.defined_permissions?.length ||
        0,
      assignedUsers: usersWithRoles,
    };
  }, [permissionCatalog, roles.length, userRows]);

  useEffect(() => {
    if (roles.length === 0) {
      setSelectedRoleId(null);
      setSelectedRolePermissions([]);
      return;
    }

    const exists = roles.some((role) => role.id === selectedRoleId);
    const targetRole = exists ? roles.find((role) => role.id === selectedRoleId) ?? null : roles[0];

    if (!targetRole) return;

    if (!exists) {
      setSelectedRoleId(targetRole.id);
    }

    setSelectedRolePermissions(
      (targetRole.permissions || []).map((permission) => permission.name),
    );
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedUserId === null && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (selectedUserAssignment) {
      setSelectedUserRoles(selectedUserAssignment.roles || []);
    }
  }, [selectedUserAssignment]);

  const handleDeviceAction = async (id: number, isActiveValue: 1 | 0) => {
    try {
      await updateDeviceStatus({ id, is_active: isActiveValue }).unwrap();
      setOpenDeviceActionId(null);
      const action = isActiveValue === 1 ? "approved" : "declined";
      dispatch(showToast({ message: `Device ${action} successfully`, type: "success" }));
    } catch (error) {
      console.error("Failed to update device status", error);
      dispatch(showToast({ message: "Failed to update device status", type: "error" }));
    }
  };

  const handleCreateRole = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!roleForm.name.trim()) {
      dispatch(showToast({ message: "Role name is required", type: "error" }));
      return;
    }

    try {
      const createdRole = await createRole({
        name: roleForm.name.trim(),
        permissions: roleForm.permissions,
      }).unwrap();

      setRoleForm({ name: "", permissions: [] });
      setSelectedRoleId(createdRole.id);
      await Promise.all([refetchRoles(), refetchPermissions()]);
      dispatch(showToast({ message: `Role ${createdRole.name} created`, type: "success" }));
    } catch (error) {
      console.error(error);
      dispatch(showToast({ message: "Failed to create role", type: "error" }));
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) {
      dispatch(showToast({ message: "Select a role first", type: "error" }));
      return;
    }

    try {
      await syncRolePermissions({
        roleId: selectedRole.id,
        permissions: selectedRolePermissions,
      }).unwrap();

      await Promise.all([refetchRoles(), refetchUsers()]);
      dispatch(
        showToast({
          message: `Permissions updated for ${selectedRole.name}`,
          type: "success",
        }),
      );
    } catch (error) {
      console.error(error);
      dispatch(showToast({ message: "Failed to update role permissions", type: "error" }));
    }
  };

  const handleSaveUserRoles = async () => {
    if (!selectedUserId) {
      dispatch(showToast({ message: "Select a user first", type: "error" }));
      return;
    }

    try {
      await syncUserRoles({ userId: selectedUserId, roles: selectedUserRoles }).unwrap();
      await Promise.all([refetchUsers(), refetchRoles(), refetchUserAssignment()]);
      dispatch(showToast({ message: "User roles updated", type: "success" }));
    } catch (error) {
      console.error(error);
      dispatch(showToast({ message: "Failed to update user roles", type: "error" }));
    }
  };

  const openAssignRolesModal = (userId: number, currentRoles: string[]) => {
    setAssignRolesUserId(userId);
    setAssignRolesDraft(currentRoles);
  };

  const closeAssignRolesModal = () => {
    setAssignRolesUserId(null);
    setAssignRolesDraft([]);
  };

  const handleAssignRolesSave = async () => {
    if (assignRolesUserId === null) return;
    try {
      await syncUserRoles({
        userId: assignRolesUserId,
        roles: assignRolesDraft,
      }).unwrap();
      await Promise.all([refetchUsers(), refetchRoles()]);
      dispatch(showToast({ message: "User roles updated", type: "success" }));
      closeAssignRolesModal();
    } catch (error) {
      console.error(error);
      dispatch(showToast({ message: "Failed to update user roles", type: "error" }));
    }
  };

  const assignRolesUser = useMemo(
    () => userRows.find((row) => row.id === assignRolesUserId) ?? null,
    [assignRolesUserId, userRows],
  );

  const openAssignUnitsModal = (userId: number, currentUnitIds: number[]) => {
    setAssignUnitsUserId(userId);
    setAssignUnitsDraft(currentUnitIds);
  };

  const closeAssignUnitsModal = () => {
    setAssignUnitsUserId(null);
    setAssignUnitsDraft([]);
  };

  const handleAssignUnitsSave = async () => {
    if (assignUnitsUserId === null) return;
    try {
      await syncUserUnits({
        userId: assignUnitsUserId,
        units: assignUnitsDraft,
      }).unwrap();
      await refetchUsers();
      dispatch(showToast({ message: "User units updated", type: "success" }));
      closeAssignUnitsModal();
    } catch (error) {
      console.error(error);
      dispatch(showToast({ message: "Failed to update user units", type: "error" }));
    }
  };

  const assignUnitsUser = useMemo(
    () => userRows.find((row) => row.id === assignUnitsUserId) ?? null,
    [assignUnitsUserId, userRows],
  );

  const openEditUserModal = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setEditUserId(userId);
    setEditUserError(null);
    setEditUserDraft({
      firstname: user.firstname || "",
      lastname: user.lastname || "",
      username: user.username || "",
      email: user.email || "",
      phone_number: user.phone_number || "",
      password: "",
      confirmPassword: "",
    });
  };

  const closeEditUserModal = () => {
    setEditUserId(null);
    setEditUserError(null);
  };

  const handleSaveUserEdit = async () => {
    if (editUserId === null) return;

    if (editUserDraft.password || editUserDraft.confirmPassword) {
      if (editUserDraft.password.length < 6) {
        setEditUserError("Password must be at least 6 characters.");
        return;
      }
      if (editUserDraft.password !== editUserDraft.confirmPassword) {
        setEditUserError("Passwords do not match.");
        return;
      }
    }

    setEditUserError(null);

    try {
      await updateUser({
        id: editUserId,
        data: {
          firstname: editUserDraft.firstname,
          lastname: editUserDraft.lastname,
          username: editUserDraft.username,
          email: editUserDraft.email,
          phone_number: editUserDraft.phone_number,
          ...(editUserDraft.password ? { password: editUserDraft.password } : {}),
        },
      }).unwrap();

      await refetchUsers();
      dispatch(showToast({ message: "User details updated", type: "success" }));
      closeEditUserModal();
    } catch (error) {
      console.error(error);
      dispatch(showToast({ message: "Failed to update user", type: "error" }));
    }
  };

  const editUser = useMemo(
    () => userRows.find((row) => row.id === editUserId) ?? null,
    [editUserId, userRows],
  );

  const renderTabButton = (tab: SecurityTab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn(
        "pb-3 text-lg font-semibold border-b-2 transition-colors",
        activeTab === tab ? "text-white border-white" : "text-gray-400 border-transparent",
      )}
    >
      {label}
    </button>
  );

  const renderRoleCard = (role: RoleRecord) => {
    const permissionNames = (role.permissions || []).map((permission) => permission.name);
    const isSelected = role.id === selectedRoleId;

    return (
      <button
        key={role.id}
        type="button"
        onClick={() => {
          setSelectedRoleId(role.id);
          setSelectedRolePermissions(permissionNames);
        }}
        className={cn(
          "w-full rounded-xl border p-4 text-left transition-all",
          isSelected ? roleCardSelected : roleCardIdle,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={cn("text-base font-semibold", titleText)}>{role.name}</div>
            <div className={cn("mt-1 text-xs uppercase tracking-[0.18em]", accentText)}>
              {(role.permissions || []).length} permissions
            </div>
          </div>
          {isSelected ? (
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-medium", accentChipBg, accentText)}>
              Selected
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissionNames.length === 0 ? (
            <span className={cn("text-xs", subtleText)}>No permissions assigned</span>
          ) : (
            permissionNames.slice(0, 6).map((permission) => (
              <span
                key={permission}
                className={cn("rounded-full border px-2.5 py-1 text-[11px]", borderCls, chipBg, chipText)}
              >
                {permission}
              </span>
            ))
          )}
          {permissionNames.length > 6 ? (
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", borderCls, chipBg, mutedText)}>
              +{permissionNames.length - 6} more
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  const selectedUserSummary = useMemo(() => {
    const user = userRows.find((entry) => entry.id === selectedUserId);
    if (!user) return null;

    return {
      ...user,
      effectivePermissions: selectedUserAssignment?.permissions || [],
    };
  }, [selectedUserAssignment?.permissions, selectedUserId, userRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-gray-300">{currentDateTime} Abuja</span>
        {activeTab === "user" && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
                placeholder="Search name, email, phone..."
                className="w-80 rounded border border-[#2B2B2B] bg-[#1A1A1A] px-9 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#0A4D66] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-8 border-b border-[#0A4D66]/40">
        {renderTabButton("activity", "Activity Log")}
        {renderTabButton("device", "Device Management")}
        {renderTabButton("user", "User Management")}
        {renderTabButton("rbac", "Access Control")}
        {isSuperAdmin && renderTabButton("system", "System Settings")}
      </div>

      <div className="overflow-hidden rounded-sm border border-[#0A4D66]/40 bg-[#001825]">
        <div className="flex items-center justify-between border-b border-[#0A4D66]/30 px-6 py-4">
          <h2 className="text-3xl font-bold uppercase text-white">
            {activeTab === "user"
              ? "User Management"
              : activeTab === "device"
                ? "Device Management"
                : activeTab === "rbac"
                  ? "Role Based Access Control"
                  : activeTab === "system"
                    ? "System Settings"
                    : "Activity Log"}
          </h2>
          <div className="flex items-center gap-3">
            {activeTab === "activity" ? (
              <select
                aria-label="Filter by status"
                title="Filter by status"
                value={activityEventFilter}
                onChange={(event) => {
                  setActivityEventFilter(event.target.value);
                  setActivityPage(1);
                }}
                className="rounded border border-[#0A4D66]/40 bg-[#001219] px-3 py-1.5 text-sm text-white outline-none focus:border-[#7FD5FF]"
              >
                <option value="">All Statuses</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="deleted">Deleted</option>
              </select>
            ) : null}
            {activeTab === "user" ? (
              <button
                onClick={() => navigate("/dashboard/users/add")}
                className="flex items-center gap-2 rounded bg-[#0369A1] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                aria-label="Add user"
                title="Add user"
              >
                <Icon icon="mdi:account-plus" className="h-4 w-4" />
                Add User
              </button>
            ) : null}
            <button className="text-gray-300 hover:text-white" aria-label="Download" title="Download">
              <Icon icon="mdi:download" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {activeTab === "activity" ? (
          <div className="overflow-x-auto">
            <table className="min-w-275 w-full text-left">
              <thead>
                <tr className="border-b border-[#0A4D66]/30 text-sm text-gray-400">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">User Type</th>
                  <th className="px-6 py-3 font-medium">Device Code</th>
                  <th className="px-6 py-3 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                      Loading activity logs...
                    </td>
                  </tr>
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-[#0A4D66]/20 text-white",
                        index % 2 === 0 ? "bg-[#001825]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-6 py-4">{row.date}</td>
                      <td className="px-6 py-4">{row.time}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span>{row.name}</span>
                          <span className="text-xs text-gray-300">{row.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{row.action}</td>
                      <td className="px-6 py-4 capitalize">{row.event}</td>
                      <td className="px-6 py-4">{row.userType}</td>
                      <td className="px-6 py-4">{row.deviceCode}</td>
                      <td className="whitespace-nowrap px-6 py-4">{row.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {activityLogsResponse && activityLogsResponse.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-[#0A4D66]/30 px-6 py-3 text-sm text-gray-300">
                <span>
                  Page {activityLogsResponse.current_page} of{" "}
                  {activityLogsResponse.last_page} · {activityLogsResponse.total} total
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                    disabled={activityLogsResponse.current_page <= 1}
                    className="rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivityPage((page) =>
                        Math.min(activityLogsResponse.last_page, page + 1),
                      )
                    }
                    disabled={
                      activityLogsResponse.current_page >= activityLogsResponse.last_page
                    }
                    className="rounded border border-[#0A4D66]/40 px-3 py-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "device" ? (
          <div className="overflow-x-auto">
            <table className="min-w-275 w-full text-left">
              <thead>
                <tr className="border-b border-[#0A4D66]/30 text-sm text-gray-400">
                  <th className="px-6 py-3 font-medium">Device Name</th>
                  <th className="px-6 py-3 font-medium">Device Code</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Last Seen</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isDevicesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      Loading devices...
                    </td>
                  </tr>
                ) : deviceRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      No devices found
                    </td>
                  </tr>
                ) : (
                  deviceRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-[#0A4D66]/20 text-white",
                        index % 2 === 0 ? "bg-[#001825]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-6 py-4">{row.name}</td>
                      <td className="px-6 py-4">{row.code}</td>
                      <td className="px-6 py-4 capitalize">{row.status}</td>
                      <td className="px-6 py-4">{row.lastSeen}</td>
                      <td className="relative px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            setOpenDeviceActionId((current) => (current === row.id ? null : row.id))
                          }
                          className="text-gray-300 hover:text-white"
                          aria-label="Device actions"
                          title="Device actions"
                        >
                          <Icon icon="mdi:dots-horizontal" className="h-5 w-5" />
                        </button>

                        {openDeviceActionId === row.id ? (
                          <div className="absolute right-6 top-12 z-50 w-32 overflow-hidden rounded-md border border-[#0A4D66]/50 bg-[#001825] shadow-xl">
                            <button
                              onClick={() => handleDeviceAction(row.id, 1)}
                              className="w-full px-3 py-2 text-left text-xs text-emerald-300 hover:bg-[#0A4D66]/40 disabled:opacity-50"
                              disabled={isUpdatingDeviceStatus}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeviceAction(row.id, 0)}
                              className="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-[#0A4D66]/40 disabled:opacity-50"
                              disabled={isUpdatingDeviceStatus}
                            >
                              Decline
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === "user" ? (
          <div className="overflow-x-auto">
            <table className="min-w-275 w-full text-left">
              <thead>
                <tr className="border-b border-[#0A4D66]/30 text-sm text-gray-400">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Roles</th>
                  <th className="px-6 py-3 font-medium">Units</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isUsersLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUserRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      {userSearchQuery
                        ? "No users match your search"
                        : "No users found"}
                    </td>
                  </tr>
                ) : (
                  filteredUserRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-[#0A4D66]/20 text-white",
                        index % 2 === 0 ? "bg-[#001825]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-6 py-4">{row.name}</td>
                      <td className="px-6 py-4">{row.email}</td>
                      <td className="px-6 py-4">{row.phone}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {row.roles.length === 0 ? (
                            <span className="text-sm text-gray-500">No roles</span>
                          ) : (
                            row.roles.map((role) => (
                              <span
                                key={`${row.id}-${role}`}
                                className="rounded-full border border-[#0A4D66]/40 bg-[#001825] px-2.5 py-1 text-xs text-[#7FD5FF]"
                              >
                                {role}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {row.unitNames.length === 0 ? (
                            <span className="text-sm text-gray-500">No units</span>
                          ) : (
                            row.unitNames.map((unitName, unitIndex) => (
                              <span
                                key={`${row.id}-unit-${row.unitIds[unitIndex]}`}
                                className="rounded-full border border-[#0A4D66]/40 bg-[#001825] px-2.5 py-1 text-xs text-emerald-300"
                              >
                                {unitName}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">{row.created}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openAssignRolesModal(row.id, row.roles)}
                            className="inline-flex items-center gap-1 rounded border border-[#7FD5FF]/40 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/30"
                          >
                            <Icon icon="mdi:account-key-outline" className="h-3.5 w-3.5" />
                            Assign Roles
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => openAssignUnitsModal(row.id, row.unitIds)}
                              className="inline-flex items-center gap-1 rounded border border-emerald-400/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
                            >
                              <Icon icon="mdi:office-building-marker-outline" className="h-3.5 w-3.5" />
                              Assign Units
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => openEditUserModal(row.id)}
                              className="inline-flex items-center gap-1 rounded border border-amber-400/40 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10"
                            >
                              <Icon icon="mdi:account-edit-outline" className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          )}
                          <button className="text-gray-300 hover:text-white">View</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === "rbac" ? (
          <div className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className={`${panelClassName} p-5`}>
                <div className={cn("text-xs uppercase tracking-[0.22em]", accentText)}>Roles</div>
                <div className={cn("mt-3 text-4xl font-semibold", titleText)}>{rbacStats.roleCount}</div>
                <p className={cn("mt-2 text-sm", mutedText)}>
                  Active access groups available for assignment.
                </p>
              </div>
              <div className={`${panelClassName} p-5`}>
                <div className={cn("text-xs uppercase tracking-[0.22em]", accentText)}>Permissions</div>
                <div className={cn("mt-3 text-4xl font-semibold", titleText)}>{rbacStats.permissionCount}</div>
                <p className={cn("mt-2 text-sm", mutedText)}>
                  Endpoint-level access rules currently exposed by the API.
                </p>
              </div>
              <div className={`${panelClassName} p-5`}>
                <div className={cn("text-xs uppercase tracking-[0.22em]", accentText)}>Assigned Users</div>
                <div className={cn("mt-3 text-4xl font-semibold", titleText)}>{rbacStats.assignedUsers}</div>
                <p className={cn("mt-2 text-sm", mutedText)}>
                  Users with one or more roles already attached.
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
              <form onSubmit={handleCreateRole} className={`${panelClassName} p-5`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={cn("text-xl font-semibold", titleText)}>Create Role</h3>
                    <p className={cn("mt-1 text-sm", mutedText)}>
                      Create a new role and optionally seed it with permissions.
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-3 py-1 text-xs", borderCls, labelText)}>
                    Admin action
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className={cn("mb-1 block text-sm font-medium", labelText)}>Role name</label>
                    <input
                      value={roleForm.name}
                      onChange={(event) =>
                        setRoleForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="e.g. auditor"
                      className={searchInputClassName}
                    />
                  </div>

                  <div>
                    <label className={cn("mb-1 block text-sm font-medium", labelText)}>
                      Filter permissions
                    </label>
                    <input
                      value={permissionFilter}
                      onChange={(event) => setPermissionFilter(event.target.value)}
                      placeholder="Search permissions"
                      className={searchInputClassName}
                    />
                  </div>

                  <MultiSelect
                    label="Permissions"
                    placeholder={isPermissionsLoading ? "Loading permissions..." : "Select permissions"}
                    options={filteredPermissionOptions}
                    selectedValues={roleForm.permissions}
                    onChange={(selected) =>
                      setRoleForm((current) => ({ ...current, permissions: selected as string[] }))
                    }
                    disabled={isPermissionsLoading}
                  />

                  <button
                    type="submit"
                    disabled={isCreatingRole}
                    className={cn("inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60", isDark ? "bg-[#0369A1]" : "bg-blue-600 hover:bg-blue-700")}
                  >
                    <Icon icon="mdi:shield-plus" className="h-4 w-4" />
                    {isCreatingRole ? "Creating..." : "Create Role"}
                  </button>
                </div>
              </form>

              <div className={`${panelClassName} p-5`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={cn("text-xl font-semibold", titleText)}>Roles Overview</h3>
                    <p className={cn("mt-1 text-sm", mutedText)}>
                      Inspect existing roles and the permissions attached to each.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void refetchRoles();
                      void refetchPermissions();
                    }}
                    className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:opacity-90", borderCls, labelText)}
                  >
                    <Icon icon="mdi:refresh" className="h-4 w-4" />
                    Refresh
                  </button>
                </div>

                <div className="mt-5 grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
                  {isRolesLoading ? (
                    <div className={cn("rounded-lg border border-dashed p-6 text-center", dashedBorderCls, mutedText)}>
                      Loading roles...
                    </div>
                  ) : roles.length === 0 ? (
                    <div className={cn("rounded-lg border border-dashed p-6 text-center", dashedBorderCls, mutedText)}>
                      No roles found
                    </div>
                  ) : (
                    roles.map(renderRoleCard)
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
              <div className={`${panelClassName} p-5`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={cn("text-xl font-semibold", titleText)}>Role Permissions</h3>
                    <p className={cn("mt-1 text-sm", mutedText)}>
                      Select a role and update the permissions it controls.
                    </p>
                  </div>
                  {selectedRole ? (
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", accentChipBg, accentText)}>
                      {selectedRole.name}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className={cn("mb-1 block text-sm font-medium", labelText)}>Active role</label>
                    <select
                      aria-label="Active role"
                      value={selectedRoleId ?? ""}
                      onChange={(event) => setSelectedRoleId(Number(event.target.value))}
                      className={searchInputClassName}
                      disabled={roles.length === 0}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <MultiSelect
                    label="Permissions assigned to role"
                    placeholder="Select permissions"
                    options={filteredPermissionOptions}
                    selectedValues={selectedRolePermissions}
                    onChange={(selected) => setSelectedRolePermissions(selected as string[])}
                    disabled={!selectedRole || isPermissionsLoading}
                  />

                  <button
                    type="button"
                    onClick={handleSaveRolePermissions}
                    disabled={!selectedRole || isSavingRolePermissions}
                    className={cn("inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60", accentChipBorder, accentBtnBg, accentText)}
                  >
                    <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                    {isSavingRolePermissions ? "Saving..." : "Save Permissions"}
                  </button>
                </div>
              </div>

              <div className={`${panelClassName} p-5`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={cn("text-xl font-semibold", titleText)}>User Role Assignment</h3>
                    <p className={cn("mt-1 text-sm", mutedText)}>
                      Attach one or more roles to a user and inspect effective access.
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-3 py-1 text-xs", borderCls, labelText)}>
                    {selectedUserSummary ? selectedUserSummary.name : "No user selected"}
                  </span>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-4">
                    <div>
                      <label className={cn("mb-1 block text-sm font-medium", labelText)}>User</label>
                      <select
                        aria-label="User role assignment target"
                        value={selectedUserId ?? ""}
                        onChange={(event) => setSelectedUserId(Number(event.target.value))}
                        className={searchInputClassName}
                        disabled={users.length === 0}
                      >
                        {userRows.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} {user.email !== "-" ? `(${user.email})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <MultiSelect
                      label="Roles"
                      placeholder="Select roles"
                      options={roleOptions}
                      selectedValues={selectedUserRoles}
                      onChange={(selected) => setSelectedUserRoles(selected as string[])}
                      disabled={isRolesLoading || roles.length === 0 || selectedUserId === null}
                    />

                    <button
                      type="button"
                      onClick={handleSaveUserRoles}
                      disabled={selectedUserId === null || isSavingUserRoles}
                      className={cn("inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60", accentChipBorder, accentBtnBg, accentText)}
                    >
                      <Icon icon="mdi:account-key-outline" className="h-4 w-4" />
                      {isSavingUserRoles ? "Saving..." : "Assign Roles"}
                    </button>
                  </div>

                  <div className={cn("rounded-xl border p-4", borderSubtleCls, cardBg)}>
                    <div className={cn("text-sm font-medium", titleText)}>User Access Summary</div>
                    {isUserRoleLoading && selectedUserId !== null ? (
                      <div className={cn("mt-4 text-sm", mutedText)}>Loading user access...</div>
                    ) : selectedUserSummary ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className={cn("text-xs uppercase tracking-[0.2em]", accentText)}>
                            Assigned Roles
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedUserSummary.roles.length === 0 ? (
                              <span className={cn("text-sm", subtleText)}>No roles assigned</span>
                            ) : (
                              selectedUserSummary.roles.map((role) => (
                                <span
                                  key={role}
                                  className={cn("rounded-full border px-2.5 py-1 text-xs", borderCls, chipBg, accentText)}
                                >
                                  {role}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <div className={cn("text-xs uppercase tracking-[0.2em]", accentText)}>
                            Effective Permissions
                          </div>
                          <div className="mt-2 max-h-48 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-2">
                              {selectedUserSummary.effectivePermissions.length === 0 ? (
                                <span className={cn("text-sm", subtleText)}>No effective permissions</span>
                              ) : (
                                selectedUserSummary.effectivePermissions.map((permission) => (
                                  <span
                                    key={permission}
                                    className={cn("rounded-full border px-2.5 py-1 text-[11px]", borderCls, chipBg, chipText)}
                                  >
                                    {permission}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={cn("mt-4 text-sm", subtleText)}>Select a user to inspect access.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "system" && isSuperAdmin ? (
          <div className="space-y-6 p-6">
            <div className={cn("rounded-xl border p-5", borderSubtleCls, cardBg)}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={cn("text-base font-semibold", titleText)}>
                    Two-Factor Login (Email OTP)
                  </h3>
                  <p className={cn("mt-1 text-sm", mutedText)}>
                    When enabled, every user must enter a one-time code emailed to them
                    after submitting their password before they receive an access token.
                  </p>
                  {isSystemSettingsLoading ? (
                    <p className={cn("mt-2 text-xs", subtleText)}>Loading current setting…</p>
                  ) : null}
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    aria-label="Toggle email OTP login"
                    title="Toggle email OTP login"
                    checked={Boolean(systemSettings?.otp_login_enabled)}
                    disabled={isSystemSettingsLoading || isSavingSystemSettings}
                    onChange={(event) => void handleToggleOtpLogin(event.target.checked)}
                  />
                  <div
                    className={cn(
                      "h-6 w-11 rounded-full transition-colors peer-checked:bg-[#0369A1]",
                      isDark ? "bg-[#0A4D66]/60" : "bg-gray-300",
                      "peer-disabled:opacity-60",
                    )}
                  />
                  <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                </label>
              </div>

              <div className={cn("mt-4 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs", borderCls, chipBg)}>
                <Icon
                  icon={systemSettings?.otp_login_enabled ? "mdi:shield-check" : "mdi:shield-off-outline"}
                  className={cn("h-4 w-4", systemSettings?.otp_login_enabled ? accentText : mutedText)}
                />
                <span className={chipText}>
                  Status: {systemSettings?.otp_login_enabled ? "Enabled" : "Disabled"}
                </span>
                {isSavingSystemSettings ? (
                  <span className={cn("ml-2", subtleText)}>Saving…</span>
                ) : null}
              </div>
            </div>

            <div className={cn("rounded-xl border p-5", borderSubtleCls, cardBg)}>
              <h3 className={cn("text-base font-semibold", titleText)}>
                Pass Interval
              </h3>
              <p className={cn("mt-1 text-sm", mutedText)}>
                How often (in months) personnel become due for their next pass,
                counted from the start date of their last pass. Used to compute
                each personnel&apos;s next pass date and status.
              </p>
              {isSystemSettingsLoading ? (
                <p className={cn("mt-2 text-xs", subtleText)}>Loading current setting…</p>
              ) : null}

              <div className="mt-4 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={passIntervalDraft}
                  onChange={(event) => setPassIntervalDraft(event.target.value)}
                  disabled={isSystemSettingsLoading || isSavingSystemSettings}
                  aria-label="Pass interval in months"
                  className={cn("w-24 rounded border px-3 py-2 text-sm focus:outline-none", borderCls, isDark ? "bg-[#001219] text-white" : "bg-white text-gray-900")}
                />
                <span className={cn("text-sm", mutedText)}>months</span>
                <button
                  type="button"
                  onClick={() => void handleSavePassInterval()}
                  disabled={isSystemSettingsLoading || isSavingSystemSettings}
                  className={cn("inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60", accentChipBorder, accentBtnBg, accentText)}
                >
                  <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                  {isSavingSystemSettings ? "Saving..." : "Save"}
                </button>
              </div>

              <div className={cn("mt-4 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs", borderCls, chipBg)}>
                <Icon icon="mdi:calendar-clock" className={cn("h-4 w-4", accentText)} />
                <span className={chipText}>
                  Current: every {systemSettings?.pass_interval_months ?? 4} month
                  {(systemSettings?.pass_interval_months ?? 4) === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("p-8 text-center text-sm", mutedText)}>
            You do not have access to this section.
          </div>
        )}
      </div>

      {assignRolesUserId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeAssignRolesModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-[#0A4D66]/50 bg-[#001825] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Assign Roles</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {assignRolesUser
                    ? `Update the roles assigned to ${assignRolesUser.name}.`
                    : "Update the roles assigned to this user."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAssignRolesModal}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <Icon icon="mdi:close" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <MultiSelect
                label="Roles"
                placeholder={isRolesLoading ? "Loading roles..." : "Select roles"}
                options={roleOptions}
                selectedValues={assignRolesDraft}
                onChange={(selected) => setAssignRolesDraft(selected as string[])}
                disabled={isRolesLoading || roles.length === 0}
              />
              {roles.length === 0 && !isRolesLoading ? (
                <p className="mt-2 text-xs text-amber-300">
                  No roles available. Create a role first under Access Control.
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAssignRolesModal}
                className="rounded-md border border-[#0A4D66]/50 px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignRolesSave}
                disabled={isSavingUserRoles}
                className="inline-flex items-center gap-2 rounded-md bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                {isSavingUserRoles ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignUnitsUserId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeAssignUnitsModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-[#0A4D66]/50 bg-[#001825] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Assign Units</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {assignUnitsUser
                    ? `Restrict ${assignUnitsUser.name} to specific units. Leave empty for unrestricted access.`
                    : "Restrict this user to specific units. Leave empty for unrestricted access."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAssignUnitsModal}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <Icon icon="mdi:close" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <MultiSelect
                label="Units"
                placeholder={isUnitsLoading ? "Loading units..." : "Select units"}
                options={unitOptions}
                selectedValues={assignUnitsDraft}
                onChange={(selected) => setAssignUnitsDraft(selected as number[])}
                disabled={isUnitsLoading || units.length === 0}
              />
              {units.length === 0 && !isUnitsLoading ? (
                <p className="mt-2 text-xs text-amber-300">
                  No units available. Create a unit first.
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAssignUnitsModal}
                className="rounded-md border border-[#0A4D66]/50 px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignUnitsSave}
                disabled={isSavingUserUnits}
                className="inline-flex items-center gap-2 rounded-md bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                {isSavingUserUnits ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editUserId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeEditUserModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-[#0A4D66]/50 bg-[#001825] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Edit User</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {editUser
                    ? `Update details or set a new password for ${editUser.name}.`
                    : "Update user details or set a new password."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditUserModal}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <Icon icon="mdi:close" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  First Name
                </label>
                <input
                  value={editUserDraft.firstname}
                  onChange={(event) =>
                    setEditUserDraft((current) => ({
                      ...current,
                      firstname: event.target.value,
                    }))
                  }
                  className={searchInputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Last Name
                </label>
                <input
                  value={editUserDraft.lastname}
                  onChange={(event) =>
                    setEditUserDraft((current) => ({
                      ...current,
                      lastname: event.target.value,
                    }))
                  }
                  className={searchInputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Username
                </label>
                <input
                  value={editUserDraft.username}
                  onChange={(event) =>
                    setEditUserDraft((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  className={searchInputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  value={editUserDraft.email}
                  onChange={(event) =>
                    setEditUserDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className={searchInputClassName}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Phone Number
                </label>
                <input
                  value={editUserDraft.phone_number}
                  onChange={(event) =>
                    setEditUserDraft((current) => ({
                      ...current,
                      phone_number: event.target.value,
                    }))
                  }
                  className={searchInputClassName}
                />
              </div>

              <div className="sm:col-span-2 mt-2 border-t border-[#0A4D66]/40 pt-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  Reset Password (optional)
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  New Password
                </label>
                <input
                  type="password"
                  value={editUserDraft.password}
                  onChange={(event) =>
                    setEditUserDraft((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to keep current password"
                  className={searchInputClassName}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={editUserDraft.confirmPassword}
                  onChange={(event) =>
                    setEditUserDraft((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  className={searchInputClassName}
                />
              </div>
            </div>

            {editUserError && (
              <p className="mt-3 text-xs text-red-400">{editUserError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditUserModal}
                className="rounded-md border border-[#0A4D66]/50 px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveUserEdit()}
                disabled={isSavingUserEdit}
                className="inline-flex items-center gap-2 rounded-md bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                {isSavingUserEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
