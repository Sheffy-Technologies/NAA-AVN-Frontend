import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type Unit = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateUnitPayload = {
  name: string;
};

export const unitsApi = createApi({
  reducerPath: "unitsApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getUnits: builder.query<Unit[], void>({
      query: () => ({
        url: "/units",
        method: "GET",
      }),
    }),
    createUnit: builder.mutation<Unit, CreateUnitPayload>({
      query: (body) => ({
        url: "/units",
        method: "POST",
        data: body,
      }),
    }),
  }),
});

export const { useGetUnitsQuery, useCreateUnitMutation } = unitsApi;
