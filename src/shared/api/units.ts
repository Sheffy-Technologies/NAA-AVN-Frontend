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
  description?: string;
};

export type UpdateUnitPayload = {
  id: number;
  name: string;
  description: string;
};

export const unitsApi = createApi({
  reducerPath: "unitsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Units"],
  endpoints: (builder) => ({
    getUnits: builder.query<Unit[], void>({
      query: () => ({
        url: "/units",
        method: "GET",
      }),
      providesTags: ["Units"],
    }),
    createUnit: builder.mutation<Unit, CreateUnitPayload>({
      query: (body) => ({
        url: "/units",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Units"],
    }),
    updateUnit: builder.mutation<Unit, UpdateUnitPayload>({
      query: ({ id, ...body }) => ({
        url: `/units/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: ["Units"],
    }),
    deleteUnit: builder.mutation<void, number>({
      query: (id) => ({
        url: `/units/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Units"],
    }),
  }),
});

export const {
  useGetUnitsQuery,
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useDeleteUnitMutation,
} = unitsApi;
