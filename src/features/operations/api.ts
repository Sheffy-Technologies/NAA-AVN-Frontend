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
  departure_takeoff?: string | null;
  departure_landing?: string | null;
  arrival_takeoff?: string | null;
  arrival_landing?: string | null;
  flight_hours?: number | null;
  landing?: number | null;
  cycle?: number | null;
};

export type OperationAssetPerson = {
  id?: number;
  firstname?: string | null;
  lastname?: string | null;
  othernames?: string | null;
  rank?: {
    name?: string | null;
  } | null;
};

export type OperationAssetDetails = {
  id?: number;
  name?: string;
  type?: string;
  total_hours?: number | string;
  total_flight_hours?: number | string;
  total_landings?: number | string;
  next_inspection?: string;
  next_inspection_date?: string;
  last_snag?: string;
  last_defect?: {
    title?: string | null;
    description?: string | null;
  } | null;
  average_speed?: number | null;
  speed_unit?: string | null;
};

export type OperationAssignedAsset = {
  id?: number;
  asset_id?: number;
  pilot_id?: number | null;
  co_pilot_id?: number | null;
  departure_takeoff?: string | null;
  departure_landing?: string | null;
  arrival_takeoff?: string | null;
  arrival_landing?: string | null;
  flight_hours?: number | string | null;
  landing?: number | null;
  cycle?: number | null;
  // Nested shape (some endpoints)
  asset?: OperationAssetDetails | null;
  pilot?: OperationAssetPerson | null;
  co_pilot?: OperationAssetPerson | null;
  // Flat shape returned by the operations list/detail endpoint
  name?: string | null;
  serial_number?: string | null;
  model?: string | null;
  tail_number?: string | null;
  type?: string | null;
  pilot_details?: OperationAssetPerson & {
    service_number?: string | null;
    call_sign?: string | null;
    email?: string | null;
    phone_number?: string | null;
  } | null;
  co_pilot_details?: OperationAssetPerson & {
    service_number?: string | null;
    call_sign?: string | null;
    email?: string | null;
    phone_number?: string | null;
  } | null;
  estimated_distance_nm?: number | null;
  estimated_flight_hours?: number | null;
  estimated_flight_time_label?: string | null;
  estimated_end_time?: string | null;
  actual_flight_hours?: number | null;
  actual_flight_time_label?: string | null;
  actual_landing?: number | null;
  actual_cycle?: number | null;
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
  waypoints?: OperationWaypointInput[];
};

export type OperationWaypointInput = {
  sequence?: number;
  name?: string | null;
  latitude: number;
  longitude: number;
};

export type OperationWaypoint = {
  id: number;
  operation_id: number;
  sequence: number;
  name: string | null;
  latitude: number;
  longitude: number;
  created_at?: string;
  updated_at?: string;
};

export type UpdateOperationRequest = {
  id: string | number;
  data: Partial<CreateOperationRequest>;
};

export type UpdateOperationStatusRequest = {
  id: string | number;
  status: "planned" | "ongoing" | "completed" | "aborted";
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
  photos?: ContactPhoto[];
};

export type ResourceUtilization = {
  inventory_id: number;
  item_description: string;
  quantity_used: number | string;
  asset_id?: number;
};

export type AfterActionReportVehicle = {
  id?: number;
  name?: string | null;
  registration_number?: string | null;
  plate_number?: string | null;
  serial_number?: string | null;
  type?: string | null;
  [key: string]: unknown;
};

export type CreateAfterActionReportRequest = {
  operation_id: number;
  mission: "logistics" | "recon" | "attack" | "base_support";
  task_no: string;
  infantry_no: number;
  activities: string;
  contacts: Contact[];
  resource_utilizations: ResourceUtilization[];
};

export type AfterActionReport = CreateAfterActionReportRequest & {
  id: number;
  created_at: string;
  updated_at: string;
  vehicles?: AfterActionReportVehicle[];
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
  assets: OperationAssignedAsset[];
  afterActionReport: AfterActionReport | null;
  after_action_report?: AfterActionReport | null;
  departure_longitude?: number | null;
  departure_latitude?: number | null;
  arrival_longitude?: number | null;
  arrival_latitude?: number | null;
  location?: {
    lat: number;
    lng: number;
  };
  departure_location: string | null;
  arrival_location: string | null;
  waypoints?: OperationWaypoint[];
};

type OperationApiResponse = Omit<Operation, "afterActionReport"> & {
  afterActionReport?: AfterActionReport | null;
  after_action_report?: AfterActionReport | null;
};

const normalizeOperation = (operation: OperationApiResponse): Operation => ({
  ...operation,
  afterActionReport:
    operation.afterActionReport ?? operation.after_action_report ?? null,
});

export type GetOperationsParams = {
  operations_id?: string;
};

const getOperationLocation = (operation: Operation) => {
  if (
    operation.departure_latitude !== null &&
    operation.departure_latitude !== undefined &&
    operation.departure_longitude !== null &&
    operation.departure_longitude !== undefined
  ) {
    return {
      lat: Number(operation.departure_latitude),
      lng: Number(operation.departure_longitude),
    };
  }

  if (
    operation.arrival_latitude !== null &&
    operation.arrival_latitude !== undefined &&
    operation.arrival_longitude !== null &&
    operation.arrival_longitude !== undefined
  ) {
    return {
      lat: Number(operation.arrival_latitude),
      lng: Number(operation.arrival_longitude),
    };
  }

  return {
    lat: 9.0765 + (Math.random() - 0.5) * 0.1,
    lng: 7.3986 + (Math.random() - 0.5) * 0.1,
  };
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
      transformResponse: (response: OperationApiResponse[]) => {
        return response.map((op) => {
          const normalized = normalizeOperation(op);
          return {
            ...normalized,
            location: getOperationLocation(normalized),
          };
        });
      },
    }),
    getOperationById: builder.query<Operation, string | number>({
      query: (id) => ({
        url: `/operations/${id}`,
        method: "GET",
      }),
      transformResponse: (response: OperationApiResponse) => {
        const normalized = normalizeOperation(response);
        return {
          ...normalized,
          location: getOperationLocation(normalized),
        };
      },
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
    updateOperation: builder.mutation<Operation, UpdateOperationRequest>({
      query: ({ id, data }) => ({
        url: `/operations/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        "Operations",
        { type: "OperationDetails", id },
      ],
    }),
    updateOperationStatus: builder.mutation<
      Operation,
      UpdateOperationStatusRequest
    >({
      query: ({ id, status }) => ({
        url: `/operations/${id}`,
        method: "PUT",
        data: { status },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        "Operations",
        { type: "OperationDetails", id },
      ],
    }),
    deleteOperation: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/operations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        "Operations",
        { type: "OperationDetails", id },
      ],
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
  useUpdateOperationMutation,
  useUpdateOperationStatusMutation,
  useDeleteOperationMutation,
  useCreateAfterActionReportMutation,
} = operationsApi;
