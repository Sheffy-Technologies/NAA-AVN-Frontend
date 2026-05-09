import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import type { NavigationTarget } from "@/features/notifications/api";

export type EmergencyAssetInspectionItem = {
  id: number;
  name?: string | null;
  serial_number?: string | null;
  next_inspection_date?: string | null;
  navigation?: NavigationTarget | null;
};

export type EmergencyLowStockInventoryItem = {
  id: number;
  type?: string | null;
  serial_number?: string | null;
  part_number?: string | null;
  current_stock?: number | null;
  re_order_level?: number | null;
  stock_level?: string | null;
  unit?: {
    name?: string | null;
  } | null;
  navigation?: NavigationTarget | null;
};

export type EmergencySummarySection<T> = {
  count: number;
  data: T[];
};

export type EmergencySummary = {
  reference_date?: string;
  assets_due_for_inspection?: EmergencySummarySection<EmergencyAssetInspectionItem>;
  low_stock_inventories?: EmergencySummarySection<EmergencyLowStockInventoryItem>;
};

type EmergencySummaryApiResponse =
  | EmergencySummary
  | {
      data?: EmergencySummary;
      summary?: EmergencySummary;
      result?: EmergencySummary;
    };

export const emergenciesApi = createApi({
  reducerPath: "emergenciesApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getEmergencySummary: builder.query<EmergencySummary, void>({
      query: () => ({
        url: "/emergency/summary",
        method: "GET",
      }),
      transformResponse: (response: EmergencySummaryApiResponse) => {
        if (
          response &&
          typeof response === "object" &&
          !Array.isArray(response)
        ) {
          if ("data" in response && response.data) return response.data;
          if ("summary" in response && response.summary) return response.summary;
          if ("result" in response && response.result) return response.result;
          return response as EmergencySummary;
        }
        return {};
      },
    }),
  }),
});

export const { useGetEmergencySummaryQuery } = emergenciesApi;
