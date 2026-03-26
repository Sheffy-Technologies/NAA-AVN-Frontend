import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

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

export const securityApi = createApi({
  reducerPath: "securityApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getActivityLogs: builder.query<ActivityLog[], void>({
      query: () => ({
        url: "/activity/logs",
        method: "GET",
      }),
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
    }),
  }),
});

export const {
  useGetActivityLogsQuery,
  useGetDevicesQuery,
  useUpdateDeviceStatusMutation,
} = securityApi;
