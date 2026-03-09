import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import { type Operation } from "@/features/operations/api";

export type AssetConfiguration = {
  role: string;
  seats: number;
};

export type Engine = {
  id?: number;
  asset_id?: number;
  position_id: number;
  serial_number: string;
  model: string;
  installation_date: string;
  time_since_new: number | string;
  time_since_overhaul: number | string;
  service_life_limit: number | string;
  overhaul_limit: number | string;
  created_at?: string;
  updated_at?: string;
};

export type Component = {
  id?: number;
  asset_id?: number;
  part_number: string;
  serial_number: string;
  life_limit_hours: number | string;
  time_since_overhaul: number | string;
  time_since_new: number | string;
  overhaul_limit: number | string;
  hours_used: number | string;
  installed_at: string;
  removed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Document = {
  id?: number;
  asset_id?: number;
  document_type: string;
  file: string;
  issue_date: string;
  expiry_date: string;
  created_at?: string;
  updated_at?: string;
};

export type MaintenanceEvent = {
  id?: number;
  asset_id?: number;
  component_id?: number;
  performed_by?: number;
  event_type: string;
  description: string;
  started_at?: string;
  completed_at?: string;
  hours_logged?: number | string;
  status?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  // UI specific fields for Defects?
  defect_reported?: string;
  date_of_defect?: string;
  pilots_involved?: number; // ID?
  location?: string;
  defect_description?: string;
  remark?: string;
  rectified?: boolean;
  rectification_details?: string;
  work_done?: string;
  certifying_engineer?: number;
};

export type CreateAssetPayload = {
  type: "aircraft" | "vehicle" | "airbase" | "equipment";
  unit_id: number;
  name: string;
  serial_number: string;
  model: string;
  configuration: AssetConfiguration;
  serviceability_status:
    | "serviceable"
    | "under_maintenance"
    | "grounded"
    | "medical";
  tail_number: string;
  used_hours: number; // Payload uses used_hours, distinct from total_airframe_hours in Asset?
  manufacturer: string;
  purchase_date: string;
  engines?: Engine[];
  components?: Component[];
  documents?: Document[];
  maintenance_events?: MaintenanceEvent[];
};

export type Asset = {
  id: number;
  type: "aircraft" | "vehicle" | "airbase" | "equipment";
  unit_id: number;
  name: string;
  serial_number: string;
  model: string;
  configuration: AssetConfiguration;
  serviceability_status:
    | "serviceable"
    | "under_maintenance"
    | "grounded"
    | "medical";
  tail_number: string;
  total_airframe_hours: string;
  service_life_limit: string;
  last_inspection_hours: string;
  inspection_interval: string;
  next_annual_inspection_date: string;
  next_type_of_inspection: string;
  last_inspection_date: string;
  landings: string;
  operation_status: string;
  manufacturer: string;
  purchase_date: string;
  created_at: string;
  updated_at: string;
  operations_total_hours: number;
  operations_total_hours_label: string;
};

export type AssetDetail = Asset & {
  maintenance_events: MaintenanceEvent[];
  engines: Engine[];
  components: Component[];
  documents: Document[];
  operations: Operation[];
};

export const assetsApi = createApi({
  reducerPath: "assetsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Assets"],
  endpoints: (builder) => ({
    getAssets: builder.query<Asset[], { type?: string } | void>({
      query: (params) => ({
        url: "/assets",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Assets" as const, id })),
              { type: "Assets", id: "LIST" },
            ]
          : [{ type: "Assets", id: "LIST" }],
    }),
    getAssetById: builder.query<AssetDetail, number | string>({
      query: (id) => ({
        url: `/assets/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => {
        void error;
        const tagId = (result && (result as Asset).id) || id;
        return [{ type: "Assets", id: tagId }];
      },
    }),
    createAsset: builder.mutation<Asset, CreateAssetPayload>({
      query: (body) => ({
        url: "/assets",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Assets", id: "LIST" }],
    }),
    updateAsset: builder.mutation<
      Asset,
      { id: number; data: Partial<CreateAssetPayload> }
    >({
      query: ({ id, data }) => ({
        url: `/assets/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: (result, error, { id }) => {
        void error;
        const tagId = (result && result.id) || id;
        return [
          { type: "Assets", id: tagId },
          { type: "Assets", id: "LIST" },
        ];
      },
    }),
  }),
});

export const {
  useGetAssetsQuery,
  useGetAssetByIdQuery,
  useCreateAssetMutation,
  useUpdateAssetMutation,
} = assetsApi;
