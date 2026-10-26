import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type GeneratorStatus = "serviceable" | "under_maintenance" | "unserviceable" | "decommissioned";
export type FuelType = "diesel" | "petrol" | "gas" | "other";

export type MaintenanceStatus = "ok" | "due_soon" | "overdue" | "not_set";

/** Service-interval counter, computed by GeneratorUsageService::maintenance(). */
export type GeneratorMaintenance = {
  status: MaintenanceStatus;
  service_interval_hours: number | null;
  last_service_hours: number;
  last_service_date: string | null;
  hours_since_service: number;
  hours_remaining: number | null;
  next_service_at_hours: number | null;
  /** Where the last-service reading came from. */
  baseline: "maintenance_log" | "generator_profile" | "opening_hours";
};

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
  hours_at_last_service: number | null;
  status: GeneratorStatus;
  image: string | null;
  notes: string | null;
  created_at: string;
  /** List view only. */
  cumulative_hours?: number;
  fuel_balance_litres?: number | null;
  last_run_date?: string | null;
  maintenance?: GeneratorMaintenance;
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
  /** Null when no closing balance has been recorded yet. */
  next_entry_defaults: { fuel_opening_litres: number | null };
  maintenance: GeneratorMaintenance;
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
    | "hours_at_last_service"
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
  // Per-run balances are optional: often only the day's closing is known.
  fuel_opening_litres: number | null;
  fuel_received_litres: number;
  fuel_total_available_litres: number | null;
  fuel_closing_litres: number | null;
  fuel_consumed_litres: number | null;
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
  fuel_opening_litres: number | null;
  fuel_received_litres: number | null;
  fuel_closing_litres: number | null;
  operator_personnel_id: number | null;
  operator_name: string | null;
  /** PNG data URL from the signature pad. Required on create and on every edit. */
  signature: string;
  remarks: string | null;
};

/** One day's fuel and hours (GeneratorUsageService::days()). */
export type GeneratorFuelDay = {
  date: string;
  runs: number;
  hours_worked: number;
  cumulative_hours: number | null;
  fuel_opening_litres: number | null;
  fuel_received_litres: number;
  fuel_total_available_litres: number | null;
  fuel_closing_litres: number | null;
  /** "day": the signed end-of-day balance; "last_run": the last run's own closing. */
  closing_source: "day" | "last_run" | null;
  fuel_consumed_litres: number | null;
  litres_per_hour: number | null;
  fuel_day: {
    id: number;
    closing_litres: number;
    operator_name: string;
    operator_personnel_id: number | null;
    signed_at: string;
    remarks: string | null;
    signature_url_path: string;
  } | null;
};

export type FuelDayPayload = {
  closing_litres: number;
  operator_personnel_id: number | null;
  operator_name: string | null;
  signature: string;
  remarks: string | null;
};

export type MaintenanceType = "routine_service" | "oil_change" | "filter_change" | "repair" | "overhaul" | "inspection" | "other";

export type GeneratorMaintenanceLog = {
  id: number;
  generator_id: number;
  service_date: string;
  hour_meter_reading: number;
  maintenance_type: MaintenanceType;
  description: string | null;
  performed_by: string | null;
  cost: number | null;
  resets_service_counter: boolean;
  recorder?: { id: number; firstname: string; lastname: string } | null;
  created_at: string;
};

export type MaintenanceLogPayload = Pick<
  GeneratorMaintenanceLog,
  "service_date" | "hour_meter_reading" | "maintenance_type" | "description" | "performed_by" | "cost" | "resets_service_counter"
>;

export const generatorsApi = createApi({
  reducerPath: "generatorsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Generators", "Generator", "UsageLogs", "FuelDays", "MaintenanceLogs"],
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
      invalidatesTags: (_r, _e, { id }) => ["Generators", { type: "Generator", id }, "UsageLogs", "FuelDays"],
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
      invalidatesTags: (_r, _e, { generator_id }) => ["UsageLogs", "FuelDays", "Generators", { type: "Generator", id: generator_id }],
    }),
    updateUsageLog: builder.mutation<GeneratorUsageLog, { id: number; generator_id: number; data: UsageLogPayload }>({
      query: ({ id, data }) => ({ url: `/generator-usage-logs/${id}`, method: "PUT", data }),
      invalidatesTags: (_r, _e, { generator_id }) => ["UsageLogs", "FuelDays", "Generators", { type: "Generator", id: generator_id }],
    }),
    deleteUsageLog: builder.mutation<void, { id: number; generator_id: number }>({
      query: ({ id }) => ({ url: `/generator-usage-logs/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { generator_id }) => ["UsageLogs", "FuelDays", "Generators", { type: "Generator", id: generator_id }],
    }),
    getFuelDays: builder.query<GeneratorFuelDay[], { generator_id: number; from?: string; to?: string }>({
      query: ({ generator_id, ...params }) => ({ url: `/generators/${generator_id}/fuel-days`, method: "GET", params }),
      providesTags: ["FuelDays"],
    }),
    setFuelDay: builder.mutation<GeneratorFuelDay, { generator_id: number; date: string; data: FuelDayPayload }>({
      query: ({ generator_id, date, data }) => ({ url: `/generators/${generator_id}/fuel-days/${date}`, method: "PUT", data }),
      invalidatesTags: (_r, _e, { generator_id }) => ["FuelDays", "Generators", { type: "Generator", id: generator_id }],
    }),
    deleteFuelDay: builder.mutation<void, { generator_id: number; date: string }>({
      query: ({ generator_id, date }) => ({ url: `/generators/${generator_id}/fuel-days/${date}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { generator_id }) => ["FuelDays", "Generators", { type: "Generator", id: generator_id }],
    }),
    getMaintenanceLogs: builder.query<GeneratorMaintenanceLog[], number>({
      query: (generator_id) => ({ url: "/generator-maintenance-logs", method: "GET", params: { generator_id } }),
      providesTags: ["MaintenanceLogs"],
    }),
    // Maintenance restarts the service counter shown on the generator and in the list.
    createMaintenanceLog: builder.mutation<GeneratorMaintenanceLog, MaintenanceLogPayload & { generator_id: number }>({
      query: (data) => ({ url: "/generator-maintenance-logs", method: "POST", data }),
      invalidatesTags: (_r, _e, { generator_id }) => ["MaintenanceLogs", "Generators", { type: "Generator", id: generator_id }],
    }),
    updateMaintenanceLog: builder.mutation<GeneratorMaintenanceLog, { id: number; generator_id: number; data: MaintenanceLogPayload }>({
      query: ({ id, data }) => ({ url: `/generator-maintenance-logs/${id}`, method: "PUT", data }),
      invalidatesTags: (_r, _e, { generator_id }) => ["MaintenanceLogs", "Generators", { type: "Generator", id: generator_id }],
    }),
    deleteMaintenanceLog: builder.mutation<void, { id: number; generator_id: number }>({
      query: ({ id }) => ({ url: `/generator-maintenance-logs/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { generator_id }) => ["MaintenanceLogs", "Generators", { type: "Generator", id: generator_id }],
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
  useGetFuelDaysQuery,
  useSetFuelDayMutation,
  useDeleteFuelDayMutation,
  useGetMaintenanceLogsQuery,
  useCreateMaintenanceLogMutation,
  useUpdateMaintenanceLogMutation,
  useDeleteMaintenanceLogMutation,
} = generatorsApi;
