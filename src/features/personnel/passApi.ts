import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import type { Personnel, PersonnelRank, PersonnelBasicEntity } from "./api";

export type PassStatus =
  | "upcoming"
  | "due_for_pass"
  | "pending_approval"
  | "on_pass"
  | "overdue";

export type PassRecordStatus =
  | "pending"
  | "approved"
  | "active"
  | "completed"
  | "rejected";

export type PassUser = {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email: string;
};

export type Pass = {
  id: number;
  personnel_id: number;
  start_date: string;
  end_date: string;
  duration: number;
  status: PassRecordStatus;
  remarks: string | null;
  created_by: number | null;
  approved_by: number | null;
  created_at: string;
  updated_at: string;
  personnel?: Personnel;
  created_by_user?: PassUser | null;
  approved_by_user?: PassUser | null;
};

export type PersonnelWithPass = {
  id: number;
  service_number: string;
  firstname: string;
  lastname: string;
  image: string | null;
  pass_status: PassStatus | null;
  last_pass_date: string | null;
  next_pass_date: string | null;
  pass_duration: number;
  rank: PersonnelRank;
  unit: PersonnelBasicEntity;
  latest_pass?: Pass | null;
};

export type PersonnelPassDetail = {
  personnel: PersonnelWithPass & {
    passes: Pass[];
  };
  total_passes: number;
};

export type PassFilters = {
  personnel_id?: number;
  status?: PassRecordStatus;
  date_from?: string;
  date_to?: string;
  unit_id?: number;
  rank_id?: number;
};

export type PersonnelPassFilters = {
  unit_id?: number;
  rank_id?: number;
  pass_status?: PassStatus;
  branch_id?: number;
  specialty_id?: number;
};

export type InitiatePassRequest = {
  personnel_id: number;
  start_date: string;
  end_date: string;
  duration?: number;
  status?: PassRecordStatus;
  remarks?: string | null;
};

export type UpdatePassRequest = {
  start_date?: string;
  end_date?: string;
  duration?: number;
  status?: PassRecordStatus;
  remarks?: string | null;
  approved_by?: number | null;
};

export const passApi = createApi({
  reducerPath: "passApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Pass", "PersonnelPass"],
  endpoints: (builder) => ({
    // All pass records (history)
    getPasses: builder.query<Pass[], PassFilters>({
      query: (params) => ({ url: "/passes", method: "GET", params }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Pass" as const, id })),
              { type: "Pass", id: "LIST" },
            ]
          : [{ type: "Pass", id: "LIST" }],
    }),

    // All personnel with their pass summary
    getPersonnelPass: builder.query<PersonnelWithPass[], PersonnelPassFilters>({
      query: (params) => ({ url: "/personnel/pass", method: "GET", params }),
      providesTags: [{ type: "PersonnelPass", id: "LIST" }],
    }),

    // Single personnel's pass detail + history
    getPersonnelPassById: builder.query<PersonnelPassDetail, string | number>({
      query: (id) => ({ url: `/personnel/${id}/pass`, method: "GET" }),
      providesTags: (_result, _error, id) => [{ type: "PersonnelPass", id }],
    }),

    // Initiate a pass
    initiatePass: builder.mutation<Pass, InitiatePassRequest>({
      query: (body) => ({ url: "/passes", method: "POST", data: body }),
      invalidatesTags: [
        { type: "Pass", id: "LIST" },
        { type: "PersonnelPass", id: "LIST" },
      ],
    }),

    // Update a pass
    updatePass: builder.mutation<Pass, { id: number; data: UpdatePassRequest }>({
      query: ({ id, data }) => ({
        url: `/passes/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Pass", id },
        { type: "Pass", id: "LIST" },
        { type: "PersonnelPass", id: "LIST" },
      ],
    }),

    // Delete a pass
    deletePass: builder.mutation<void, number>({
      query: (id) => ({ url: `/passes/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Pass", id },
        { type: "Pass", id: "LIST" },
        { type: "PersonnelPass", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetPassesQuery,
  useGetPersonnelPassQuery,
  useGetPersonnelPassByIdQuery,
  useInitiatePassMutation,
  useUpdatePassMutation,
  useDeletePassMutation,
} = passApi;
