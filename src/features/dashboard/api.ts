import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type DashboardHomeOperationUnit = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardHomeOperation = {
  id: number;
  unit_id: number;
  operation_type_id: number | null;
  name: string;
  date: string;
  time: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  updated_at: string;
  unit: DashboardHomeOperationUnit;
  operation_type: unknown;
};

export type DashboardHomePilotRank = {
  id: number;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type DashboardHomeBasicEntity = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardHomePilot = {
  id: number;
  user_id: number | null;
  rank_id: number;
  unit_id: number;
  branch_id: number;
  specialty_id: number;
  corp_id: number;
  service_number: string;
  firstname: string;
  lastname: string;
  othernames: string;
  dob: string;
  email: string;
  phone_number: string;
  address: string;
  blood_group: string;
  call_sign: string;
  rating_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  rank: DashboardHomePilotRank;
  corp: DashboardHomeBasicEntity;
  branch: DashboardHomeBasicEntity;
  specialty: DashboardHomeBasicEntity;
  unit: DashboardHomeBasicEntity;
};

export type DashboardHomeFlightProgramType = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardHomeFlightProgram = {
  id: number;
  unit_id: number;
  pilot_id: number;
  flight_program_type_id: number;
  name: string;
  total_hours: string;
  start_time: string;
  end_time: string;
  status: string;
  description: string;
  created_at: string;
  updated_at: string;
  unit: DashboardHomeBasicEntity;
  flight_program_type: DashboardHomeFlightProgramType;
  pilot: DashboardHomePilot;
};

export type DashboardHomeResponse = {
  user_count: number;
  aircraft_count: number;
  personnel_count: number;
  spare_count: number;
  supplier_count: number;
  operation_count: number;
  inventories_count: number;
  finances: number;
  recent_operations: DashboardHomeOperation[];
  recent_flight_programs: DashboardHomeFlightProgram[];
};

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getDashboardHome: builder.query<DashboardHomeResponse, void>({
      query: () => ({
        url: "/dashboard/home",
        method: "GET",
      }),
    }),
    getFlightPrograms: builder.query<DashboardHomeFlightProgram[], void>({
      query: () => ({
        url: "/flight-programs",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetDashboardHomeQuery, useGetFlightProgramsQuery } =
  dashboardApi;
