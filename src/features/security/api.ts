import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type PermissionName = string;

export type ActivityLog = {
  id: number;
  action?: string | null;
  description?: string | null;
  user_type?: string | null;
  device_code?: string | null;
  causer?: {
    id?: number;
    firstname?: string | null;
    lastname?: string | null;
    username?: string | null;
    email?: string | null;
    phone_number?: string | null;
    email_verified_at?: string | null;
    otp?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
  unit?: {
    id?: number;
    name?: string | null;
  } | null;
  user?: {
    id?: number;
    name?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    othernames?: string | null;
  } | null;
  name?: string | null;
  created_at?: string | null;
  date?: string | null;
  time?: string | null;
};

export type Device = {
  id: number;
  name?: string | null;
  device_name?: string | null;
  code?: string | null;
  device_code?: string | null;
  type?: string | null;
  device_type?: string | null;
  status?: string | null;
  is_active?: number | boolean | string | null;
  unit?: {
    id?: number;
    name?: string | null;
  } | null;
  last_seen_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type UpdateDeviceStatusPayload = {
  id: number;
  is_active: 1 | 0;
};

export type RoleRecord = {
  id: number;
  name: string;
  guard_name?: string;
  permissions?: Array<{
    id?: number;
    name: PermissionName;
    guard_name?: string;
  }>;
};

export type PermissionCatalog = {
  guard_name: string;
  permissions: PermissionName[];
  defined_permissions: PermissionName[];
};

export type CreateRolePayload = {
  name: string;
  permissions?: PermissionName[];
};

export type SyncRolePermissionsPayload = {
  roleId: number;
  permissions: PermissionName[];
};

export type UserRoleAssignment = {
  user: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
    username?: string | null;
    email?: string | null;
    phone_number?: string | null;
  };
  roles: string[];
  permissions: PermissionName[];
};

export type SyncUserRolesPayload = {
  userId: number;
  roles: string[];
};

export type MeResponse = {
  id: string | number;
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
  phone_number?: string | null;
  roles: Array<{ id?: number; name: string; guard_name?: string }>;
  role_names: string[];
  permissions: string[];
};

type ActivityLogApiResponse =
  | ActivityLog[]
  | {
      data?: ActivityLog[];
      results?: ActivityLog[];
      logs?: ActivityLog[];
    };

type DeviceApiResponse =
  | Device[]
  | {
      data?: Device[];
      results?: Device[];
      devices?: Device[];
    };

type RolesApiResponse =
  | RoleRecord[]
  | {
      data?: RoleRecord[];
      results?: RoleRecord[];
      roles?: RoleRecord[];
    };

export const securityApi = createApi({
  reducerPath: "securityApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["ActivityLog", "Device", "Role", "Permission", "UserRole"],
  endpoints: (builder) => ({
    getActivityLogs: builder.query<ActivityLog[], void>({
      query: () => ({
        url: "/activity/logs",
        method: "GET",
      }),
      providesTags: ["ActivityLog"],
      transformResponse: (response: ActivityLogApiResponse) => {
        if (Array.isArray(response)) return response;
        return response.data || response.results || response.logs || [];
      },
    }),
    getDevices: builder.query<Device[], void>({
      query: () => ({
        url: "/devices",
        method: "GET",
      }),
      providesTags: ["Device"],
      transformResponse: (response: DeviceApiResponse) => {
        if (Array.isArray(response)) return response;
        return response.data || response.results || response.devices || [];
      },
    }),
    updateDeviceStatus: builder.mutation<Device, UpdateDeviceStatusPayload>({
      query: ({ id, is_active }) => ({
        url: `/devices/${id}`,
        method: "PUT",
        data: { is_active },
      }),
      invalidatesTags: ["Device"],
    }),
    getRoles: builder.query<RoleRecord[], void>({
      query: () => ({
        url: "/roles",
        method: "GET",
      }),
      providesTags: ["Role"],
      transformResponse: (response: RolesApiResponse) => {
        if (Array.isArray(response)) return response;
        return response.data || response.results || response.roles || [];
      },
    }),
    createRole: builder.mutation<RoleRecord, CreateRolePayload>({
      query: (data) => ({
        url: "/roles",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Role", "Permission"],
    }),
    syncRolePermissions: builder.mutation<RoleRecord, SyncRolePermissionsPayload>({
      query: ({ roleId, permissions }) => ({
        url: `/roles/${roleId}/permissions`,
        method: "PUT",
        data: { permissions },
      }),
      invalidatesTags: ["Role", "UserRole"],
    }),
    getPermissions: builder.query<PermissionCatalog, void>({
      query: () => ({
        url: "/permissions",
        method: "GET",
      }),
      providesTags: ["Permission"],
    }),
    getUserRoles: builder.query<UserRoleAssignment, number>({
      query: (userId) => ({
        url: `/users/${userId}/roles`,
        method: "GET",
      }),
      providesTags: (_result, _error, userId) => [{ type: "UserRole", id: userId }],
    }),
    syncUserRoles: builder.mutation<UserRoleAssignment, SyncUserRolesPayload>({
      query: ({ userId, roles }) => ({
        url: `/users/${userId}/roles`,
        method: "PUT",
        data: { roles },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        "Role",
        { type: "UserRole", id: userId },
      ],
    }),
    getMe: builder.query<MeResponse, void>({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetActivityLogsQuery,
  useGetDevicesQuery,
  useUpdateDeviceStatusMutation,
  useGetRolesQuery,
  useCreateRoleMutation,
  useSyncRolePermissionsMutation,
  useGetPermissionsQuery,
  useGetUserRolesQuery,
  useSyncUserRolesMutation,
  useGetMeQuery,
} = securityApi;
