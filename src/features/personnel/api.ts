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
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
  rank: PersonnelRank;
  corp: PersonnelBasicEntity;
  branch: PersonnelBasicEntity;
  specialty: PersonnelBasicEntity;
  unit: PersonnelBasicEntity;
};

export const personnelApi = createApi({
  reducerPath: "personnelApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getPersonnel: builder.query<Personnel[], void>({
      query: () => ({
        url: "/personnel",
        method: "GET",
      }),
    }),
    getPersonnelById: builder.query<Personnel, string | number>({
      query: (id) => ({
        url: `/personnel/${id}`,
        method: "GET",
      }),
    }),
  }),
});

export const { useGetPersonnelQuery, useGetPersonnelByIdQuery } = personnelApi;
