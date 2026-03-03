import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type PersonnelRank = {
  id: number;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type PersonnelBasicEntity = {
  id: number;
  name: string;
  description: string | null;
  branch_id?: number;
  created_at: string;
  updated_at: string;
};

export type Deployment = {
  id: number;
  personnel_id: number;
  from_unit_id: number | null;
  to_unit_id: number | null;
  start_date: string;
  end_date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  from_unit: PersonnelBasicEntity | null;
  to_unit: PersonnelBasicEntity | null;
};

export type Personnel = {
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
  image: string | null;
  created_at: string;
  updated_at: string;
  rank: PersonnelRank;
  corp: PersonnelBasicEntity;
  branch: PersonnelBasicEntity;
  specialty: PersonnelBasicEntity;
  unit: PersonnelBasicEntity;
  latest_deployment: Deployment | null;
  deployments: Deployment[];
};

export type Aircraft = {
  id: number;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
};

export type PersonnelFilters = {
  branches: number[];
  units: number[];
  ranks: number[];
  corps: number[];
  specialties: number[];
  status: string[];
};

export type CreatePersonnelRequest = {
  service_number: string;
  firstname: string;
  lastname: string;
  othernames?: string;
  phone_number: string;
  email: string;
  rank_id: number;
  unit_id: number;
  branch_id: number;
  specialty_id: number;
  corp_id: number;
  address: string;
  blood_group: string;
  call_sign: string;
  rating_type: string;
  image?: string;
  deployments?: {
    from_unit_id: string;
    to_unit_id: string;
    start_date: string;
    end_date: string;
  }[];
};

export type UploadImageResponse = {
  message: string;
  data: string;
};

export const personnelApi = createApi({
  reducerPath: "personnelApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Personnel"],
  endpoints: (builder) => ({
    getPersonnel: builder.query<Personnel[], PersonnelFilters>({
      query: (filters) => ({
        url: "/personnel",
        method: "GET",
        params: filters,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Personnel" as const, id })),
              { type: "Personnel", id: "LIST" },
            ]
          : [{ type: "Personnel", id: "LIST" }],
    }),
    createPersonnel: builder.mutation<Personnel, CreatePersonnelRequest>({
      query: (body) => ({
        url: "/personnel",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Personnel", id: "LIST" }],
    }),
    uploadPersonnelImage: builder.mutation<UploadImageResponse, FormData>({
      query: (body) => ({
        url: "/personnel/image",
        method: "POST",
        data: body,
      }),
    }),
    updatePersonnel: builder.mutation<
      Personnel,
      {
        id: string | number;
        data: Partial<CreatePersonnelRequest> | { status: string };
      }
    >({
      query: ({ id, data }) => ({
        url: `/personnel/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Personnel", id },
        { type: "Personnel", id: "LIST" },
      ],
    }),
    getPersonnelById: builder.query<Personnel, string | number>({
      query: (id) => ({
        url: `/personnel/${id}`,
        method: "GET",
      }),
    }),
    getPersonnelRanks: builder.query<PersonnelRank[], void>({
      query: () => ({
        url: "/ranks",
        method: "GET",
      }),
    }),
    getPersonnelSpecialties: builder.query<PersonnelBasicEntity[], void>({
      query: () => ({
        url: "/specialties",
        method: "GET",
      }),
    }),
    getPersonnelBranches: builder.query<PersonnelBasicEntity[], void>({
      query: () => ({
        url: "/branches",
        method: "GET",
      }),
    }),
    getPersonnelCorps: builder.query<PersonnelBasicEntity[], void>({
      query: () => ({
        url: "/corps",
        method: "GET",
      }),
    }),
    getAircrafts: builder.query<Aircraft[], void>({
      query: () => ({
        url: "/aircraft",
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetPersonnelQuery,
  useGetPersonnelByIdQuery,
  useGetPersonnelRanksQuery,
  useGetPersonnelSpecialtiesQuery,
  useGetPersonnelBranchesQuery,
  useGetPersonnelCorpsQuery,
  useGetAircraftsQuery,
  useCreatePersonnelMutation,
  useUploadPersonnelImageMutation,
  useUpdatePersonnelMutation,
} = personnelApi;
