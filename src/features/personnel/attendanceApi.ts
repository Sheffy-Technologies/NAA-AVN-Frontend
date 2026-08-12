import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import type { Personnel } from "./api";

export type AttendanceStatus = "present" | "absent" | "late" | "half_day";

export type AttendanceLog = {
  id: number;
  personnel_id: number;
  user_id: number | null;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_lat: number | null;
  clock_in_lon: number | null;
  clock_out_lat: number | null;
  clock_out_lon: number | null;
  is_within_range: boolean;
  status: AttendanceStatus;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  personnel?: Pick<Personnel, "id" | "firstname" | "lastname" | "service_number" | "rank" | "unit">;
};

export type TodayAttendance = {
  date: string;
  present: AttendanceLog[];
  absent: Personnel[];
  summary: {
    present_count: number;
    absent_count: number;
    clocked_out: number;
  };
};

export type MyAttendanceStatus = {
  clocked_in: boolean;
  clocked_out: boolean;
  attendance: AttendanceLog | null;
  personnel: Personnel | null;
};

export type AttendanceFilters = {
  personnel_id?: number;
  unit_id?: number;
  date?: string;
  date_from?: string;
  date_to?: string;
  status?: AttendanceStatus;
};

export type ClockInRequest = {
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
};

export type ClockOutRequest = {
  latitude?: number | null;
  longitude?: number | null;
};

export type CreateAttendanceRequest = {
  personnel_id: number;
  date: string;
  clock_in?: string | null;
  clock_out?: string | null;
  status?: AttendanceStatus;
  notes?: string | null;
};

export const attendanceApi = createApi({
  reducerPath: "attendanceApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Attendance", "AttendanceToday", "MyAttendance"],
  endpoints: (builder) => ({
    getAttendance: builder.query<AttendanceLog[], AttendanceFilters>({
      query: (params) => ({ url: "/attendance", method: "GET", params }),
      providesTags: [{ type: "Attendance", id: "LIST" }],
    }),

    getTodayAttendance: builder.query<TodayAttendance, { unit_id?: number }>({
      query: (params) => ({ url: "/attendance/today", method: "GET", params }),
      providesTags: [{ type: "AttendanceToday", id: "TODAY" }],
    }),

    getMyAttendanceStatus: builder.query<MyAttendanceStatus, void>({
      query: () => ({ url: "/attendance/my-status", method: "GET" }),
      providesTags: [{ type: "MyAttendance", id: "ME" }],
    }),

    clockIn: builder.mutation<{ attendance: AttendanceLog; within_range: boolean }, ClockInRequest>({
      query: (body) => ({ url: "/attendance/clock-in", method: "POST", data: body }),
      invalidatesTags: [
        { type: "AttendanceToday", id: "TODAY" },
        { type: "MyAttendance", id: "ME" },
        { type: "Attendance", id: "LIST" },
      ],
    }),

    clockOut: builder.mutation<AttendanceLog, ClockOutRequest>({
      query: (body) => ({ url: "/attendance/clock-out", method: "POST", data: body }),
      invalidatesTags: [
        { type: "AttendanceToday", id: "TODAY" },
        { type: "MyAttendance", id: "ME" },
        { type: "Attendance", id: "LIST" },
      ],
    }),

    createAttendance: builder.mutation<AttendanceLog, CreateAttendanceRequest>({
      query: (body) => ({ url: "/attendance", method: "POST", data: body }),
      invalidatesTags: [
        { type: "Attendance", id: "LIST" },
        { type: "AttendanceToday", id: "TODAY" },
      ],
    }),

    updateAttendance: builder.mutation<AttendanceLog, { id: number; data: Partial<CreateAttendanceRequest> }>({
      query: ({ id, data }) => ({ url: `/attendance/${id}`, method: "PUT", data }),
      invalidatesTags: [
        { type: "Attendance", id: "LIST" },
        { type: "AttendanceToday", id: "TODAY" },
      ],
    }),

    deleteAttendance: builder.mutation<void, number>({
      query: (id) => ({ url: `/attendance/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Attendance", id: "LIST" }],
    }),
  }),
});

export const {
  useGetAttendanceQuery,
  useGetTodayAttendanceQuery,
  useGetMyAttendanceStatusQuery,
  useClockInMutation,
  useClockOutMutation,
  useCreateAttendanceMutation,
  useUpdateAttendanceMutation,
  useDeleteAttendanceMutation,
} = attendanceApi;
