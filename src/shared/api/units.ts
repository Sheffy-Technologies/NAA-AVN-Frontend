import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type Unit = {
  id: number;
  name: string;
  description: string | null;
  location_id: number | null;
  created_at: string;
  updated_at: string;
};

export type UnitDetails = Unit & {
  assets_count: number;
  operations_count: number;
  personnel_count: number;
  inventory_count: number;
  finances_count: number;
  total_stock: number;
  low_stock: number;
  expired_stock: number;
  critical_stock: number;
};

export type CreateUnitPayload = {
  name: string;
  description?: string;
  location_id?: number | null;
  asset_id?: number | null;
};

export type UpdateUnitPayload = {
  id: number;
  name: string;
  description: string;
  location_id?: number | null;
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
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Units" as const, id })),
              { type: "Units", id: "LIST" },
            ]
          : [{ type: "Units", id: "LIST" }],
    }),
    getUnitById: builder.query<UnitDetails, string | number>({
      query: (id) => ({
        url: `/units/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Units", id }],
    }),
    createUnit: builder.mutation<Unit, CreateUnitPayload>({
      query: (body) => ({
        url: "/units",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Units", id: "LIST" }],
    }),
    updateUnit: builder.mutation<Unit, UpdateUnitPayload>({
      query: ({ id, ...body }) => ({
        url: `/units/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Units", id },
        { type: "Units", id: "LIST" },
      ],
    }),
    deleteUnit: builder.mutation<void, number>({
      query: (id) => ({
        url: `/units/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Units", id },
        { type: "Units", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetUnitsQuery,
  useGetUnitByIdQuery,
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useDeleteUnitMutation,
} = unitsApi;
