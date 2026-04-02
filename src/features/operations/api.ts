import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type OperationUnit = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationType = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationAsset = {
  asset_id: number;
  pilot_id: number | null;
  co_pilot_id?: number | null;
};

export type CreateOperationRequest = {
  name: string;
  unit_id: number;
  operation_type_id?: number | null;
  asset_id?: number | null;
  start_date_time?: string;
  end_date_time?: string;
  departure_longitude?: number | null;
  departure_latitude?: number | null;
  arrival_longitude?: number | null;
  arrival_latitude?: number | null;
  priority?: string;
  is_flight?: boolean;
  status?: 'planned' | 'completed' | 'ongoing' | 'aborted';
  description?: string | null;
  asset_ids?: number[];
  operation_assets?: OperationAsset[];
};

export type ContactPhoto = {
  file: string; // base64 or path
};

export type Contact = {
  engagement: "visuals_only" | "attack" | "base_support" | "returned_fire";
  location: string;
  time_of_contact: string;
  date_of_contact: string;
  enemy_resources_description: string;
  enemy_infantry_no: number;
  enemy_vehicle_no: number;
  targets_treated_description: string;
  targets_infantry_no: number;
  targets_vehicle_no: number;
  damage_received: string;
  photos: ContactPhoto[];
};

export type ResourceUtilization = {
  inventory_id: number;
  item_description: string;
  quantity_used: number;
  asset_id?: number;
};

export type CreateAfterActionReportRequest = {
  operation_id: number;
  mission: "logistics" | "recon" | "attack" | "base_support";
  task_no: string;
  infantry_no: number;
  vehicles_no: number;
  activities: string;
  contacts: Contact[];
  resource_utilizations: ResourceUtilization[];
};

export type AfterActionReport = CreateAfterActionReportRequest & {
  id: number;
  created_at: string;
  updated_at: string;
};

export type Operation = {
  id: number;
  unit_id: number;
  operation_type_id: number | null;
  name: string;
  start_date_time: string;
  end_date_time: string;
  priority: "low" | "medium" | "high";
  is_flight: number;
  description: string;
  status: "ongoing" | "completed" | "planned" | "aborted";
  created_at: string;
  updated_at: string;
  duration_hours: number;
  duration_label: string;
  unit: OperationUnit;
  operation_type: OperationType | null;
  assets: unknown[];
  after_action_report: AfterActionReport | null;
  // Mock fields for UI that might not be in API yet
  location?: {
    lat: number;
    lng: number;
  };
  departure_location: string | null;
  arrival_location: string | null;
};

export type GetOperationsParams = {
  operations_id?: string;
};

export const operationsApi = createApi({
  reducerPath: "operationsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Operations", "OperationTypes", "OperationDetails"],
  endpoints: (builder) => ({
    getOperations: builder.query<Operation[], GetOperationsParams | void>({
      query: (params) => ({
        url: "/operations",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: ["Operations"],
      transformResponse: (response: Operation[]) => {
        // Mock locations for map view since they are missing in the sample response
        // In a real app, these should come from the backend
        return response.map((op) => ({
          ...op,
          location: {
            lat: 9.0765 + (Math.random() - 0.5) * 0.1, // Near Abuja
            lng: 7.3986 + (Math.random() - 0.5) * 0.1,
          },
        }));
      },
    }),
    getOperationById: builder.query<Operation, string | number>({
      query: (id) => ({
        url: `/operations/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "OperationDetails", id }],
    }),
    getOperationTypes: builder.query<OperationType[], void>({
      query: () => ({
        url: "/operation-types",
        method: "GET",
      }),
      providesTags: ["OperationTypes"],
    }),
    createOperation: builder.mutation<Operation, CreateOperationRequest>({
      query: (body) => ({
        url: "/operations",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Operations"],
    }),
    createAfterActionReport: builder.mutation<AfterActionReport, CreateAfterActionReportRequest>({
      query: (body) => ({
        url: "/after-action-reports",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_result, _error, { operation_id }) => [
        { type: "OperationDetails", id: operation_id },
        "Operations",
      ],
    }),
  }),
});

export const {
  useGetOperationsQuery,
  useGetOperationByIdQuery,
  useGetOperationTypesQuery,
  useCreateOperationMutation,
  useCreateAfterActionReportMutation,
} = operationsApi;
