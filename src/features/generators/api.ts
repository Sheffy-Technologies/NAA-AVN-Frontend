import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type GeneratorStatus = "operational" | "under_maintenance" | "unserviceable" | "decommissioned";
export type FuelType = "diesel" | "petrol" | "gas" | "other";

export type Generator = {
  id: number;
  name: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  capacity_kva: number | null;
  fuel_type: FuelType | null;
  fuel_tank_capacity_litres: number | null;
  date_purchased: string | null;
  purchase_cost: number | null;
  supplier: string | null;
  unit_id: number | null;
  unit?: { id: number; name: string } | null;
  location: string | null;
  opening_hours: number;
  service_interval_hours: number | null;
  status: GeneratorStatus;
  image: string | null;
  notes: string | null;
  created_at: string;
  /** List view only. */
  cumulative_hours?: number;
  fuel_balance_litres?: number | null;
  last_run_date?: string | null;
};

export type GeneratorSummary = {
  total_runs: number;
  hours_logged: number;
  cumulative_hours: number;
  fuel_received_litres: number;
  fuel_consumed_litres: number;
  litres_per_hour: number | null;
  fuel_balance_litres: number | null;
  last_run_date: string | null;
  next_entry_defaults: { fuel_opening_litres: number };
};

export type GeneratorDetails = Generator & { summary: GeneratorSummary };

export type GeneratorPayload = Partial<
  Pick<
    Generator,
    | "name"
    | "serial_number"
    | "manufacturer"
    | "model"
    | "capacity_kva"
    | "fuel_type"
    | "fuel_tank_capacity_litres"
    | "date_purchased"
    | "purchase_cost"
    | "supplier"
    | "unit_id"
    | "location"
    | "opening_hours"
    | "service_interval_hours"
    | "status"
    | "image"
    | "notes"
  >
>;

export type GeneratorUsageLog = {
  id: number;
  generator_id: number;
  usage_date: string;
  time_on: string;
  time_off: string;
  hours_worked: number;
  cumulative_hours: number;
  fuel_opening_litres: number;
  fuel_received_litres: number;
  fuel_total_available_litres: number;
  fuel_closing_litres: number;
  fuel_consumed_litres: number;
  operator_personnel_id: number | null;
  operator?: { id: number; firstname: string; lastname: string; service_number: string } | null;
  operator_name: string;
  signed_at: string;
  remarks: string | null;
  recorder?: { id: number; firstname: string; lastname: string } | null;
  /** API path (relative to the API base) of the operator's signature PNG. */
  signature_url_path: string;
};

export type UsageLogPayload = {
  usage_date: string;
  time_on: string;
  time_off: string;
  fuel_opening_litres: number;
  fuel_received_litres: number | null;
  fuel_closing_litres: number;
  operator_personnel_id: number | null;
  operator_name: string | null;
  /** PNG data URL from the signature pad. Required on create and on every edit. */
  signature: string;
  remarks: string | null;
};

export const generatorsApi = createApi({
  reducerPath: "generatorsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Generators", "Generator", "UsageLogs"],
  endpoints: (builder) => ({
    getGenerators: builder.query<Generator[], { q?: string; status?: string; unit_id?: number } | void>({
      query: (params) => ({ url: "/generators", method: "GET", params: params ?? undefined }),
      providesTags: ["Generators"],
    }),
    getGenerator: builder.query<GeneratorDetails, number>({
      query: (id) => ({ url: `/generators/${id}`, method: "GET" }),
      providesTags: (_r, _e, id) => [{ type: "Generator", id }],
    }),
    createGenerator: builder.mutation<GeneratorDetails, GeneratorPayload>({
      query: (data) => ({ url: "/generators", method: "POST", data }),
      invalidatesTags: ["Generators"],
    }),
    updateGenerator: builder.mutation<GeneratorDetails, { id: number; data: GeneratorPayload }>({
      query: ({ id, data }) => ({ url: `/generators/${id}`, method: "PUT", data }),
      invalidatesTags: (_r, _e, { id }) => ["Generators", { type: "Generator", id }, "UsageLogs"],
    }),
    deleteGenerator: builder.mutation<void, number>({
      query: (id) => ({ url: `/generators/${id}`, method: "DELETE" }),
      invalidatesTags: ["Generators"],
    }),
    uploadGeneratorImage: builder.mutation<{ data: string }, File>({
      query: (file) => {
        const data = new FormData();
        data.append("image", file);
        return { url: "/generators/image", method: "POST", data };
      },
    }),
    getUsageLogs: builder.query<GeneratorUsageLog[], { generator_id: number; from?: string; to?: string }>({
      query: (params) => ({ url: "/generator-usage-logs", method: "GET", params }),
      providesTags: ["UsageLogs"],
    }),
    // Any run change can renumber cumulative hours and fuel balances for the whole generator.
    createUsageLog: builder.mutation<GeneratorUsageLog, UsageLogPayload & { generator_id: number }>({
      query: (data) => ({ url: "/generator-usage-logs", method: "POST", data }),
      invalidatesTags: (_r, _e, { generator_id }) => ["UsageLogs", "Generators", { type: "Generator", id: generator_id }],
    }),
    updateUsageLog: builder.mutation<GeneratorUsageLog, { id: number; generator_id: number; data: UsageLogPayload }>({
      query: ({ id, data }) => ({ url: `/generator-usage-logs/${id}`, method: "PUT", data }),
      invalidatesTags: (_r, _e, { generator_id }) => ["UsageLogs", "Generators", { type: "Generator", id: generator_id }],
    }),
    deleteUsageLog: builder.mutation<void, { id: number; generator_id: number }>({
      query: ({ id }) => ({ url: `/generator-usage-logs/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { generator_id }) => ["UsageLogs", "Generators", { type: "Generator", id: generator_id }],
    }),
  }),
});

export const {
  useGetGeneratorsQuery,
  useGetGeneratorQuery,
  useCreateGeneratorMutation,
  useUpdateGeneratorMutation,
  useDeleteGeneratorMutation,
  useUploadGeneratorImageMutation,
  useGetUsageLogsQuery,
  useCreateUsageLogMutation,
  useUpdateUsageLogMutation,
  useDeleteUsageLogMutation,
} = generatorsApi;
