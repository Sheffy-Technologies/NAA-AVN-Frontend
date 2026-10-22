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

export type OperationCategory = {
  id: number;
  name: string;
  description: string | null;
  operations_count?: number;
  ongoing_count?: number;
  completed_count?: number;
  planned_count?: number;
  aborted_count?: number;
  operations?: Operation[];
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
  call_sign?: string | null;
  rating_type?: string | null;
  rank?: {
    name?: string | null;
  } | null;
};

export type OperationAssetDetails = {
  id?: number;
  name?: string;
  type?: string;
  tail_number?: string | null;
  asset_type?: {
    id: number;
    name: string;
  } | null;
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
  // Flat shape: `id` is the asset's id and the crew/flight-time columns live here.
  pivot?: {
    asset_id?: number;
    pilot_id?: number | null;
    co_pilot_id?: number | null;
    departure_takeoff?: string | null;
    departure_landing?: string | null;
    arrival_takeoff?: string | null;
    arrival_landing?: string | null;
    flight_hours?: number | string | null;
  } | null;
  estimated_distance_nm?: number | null;
  estimated_flight_hours?: number | null;
  estimated_flight_time_label?: string | null;
  estimated_end_time?: string | null;
  actual_flight_hours?: number | null;
  actual_flight_time_label?: string | null;
  actual_landing?: number | null;
  actual_cycle?: number | null;
  logged_to_asset_at?: string | null;
  logged_by_user_id?: number | null;
};

export type LogOperationFlightHoursRequest = {
  operation_id: number | string;
  asset_id: number | string;
  flight_hours: number;
  landing?: number | null;
  cycle?: number | null;
  remarks?: string | null;
};

export type LogOperationFlightHoursResponse = {
  flight_log: {
    id: number;
    asset_id: number;
    operation_id: number | null;
    flight_date: string;
    hours_flown: string | number;
    landings: number;
    cycles: number;
  };
  logged_to_asset_at: string;
  logged_by_user_id: number | null;
  asset_current_total_hours: number;
};

export type CreateOperationRequest = {
  name: string;
  unit_id: number;
  operation_type_id?: number | null;
  operation_category_id?: number | null;
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
  file: string; // URL returned by the upload endpoint
};

export type Contact = {
  engagement: "visuals_only" | "attack" | "base_support" | "returned_fire";
  location: string;
  time_of_contact: string;
  date_of_contact?: string;
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
  report_date?: string;
  infantry_no: number;
  vehicles_no?: number;
  ammo_spent?: string;
  unit_formation?: string;
  aircraft_formation?: "formation" | "single_ship" | "none" | string;
  activities: string;
  contacts: Contact[];
  resource_utilizations: ResourceUtilization[];
  co_name?: string | null;
  co_service_number?: string | null;
  co_rank?: string | null;
  co_user_id?: number | null;
  co_signature?: string | null;
  co_signed_at?: string | null;
  pic_name?: string | null;
  pic_service_number?: string | null;
  pic_rank?: string | null;
  pic_personnel_id?: number | null;
  pic_signature?: string | null;
  pic_signed_at?: string | null;
  copilot_name?: string | null;
  copilot_service_number?: string | null;
  copilot_rank?: string | null;
  copilot_personnel_id?: number | null;
  copilot_signature?: string | null;
  copilot_signed_at?: string | null;
  status?: string | null;
};

export type CommandingOfficerOption = {
  user_id: number;
  name: string;
  service_number: string;
  rank: string;
  role: string;
};

export type AfterActionReport = CreateAfterActionReportRequest & {
  id: number;
  created_at: string;
  updated_at: string;
  vehicles?: AfterActionReportVehicle[];
  commandingOfficerUser?: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  pilotPersonnel?: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
    service_number?: string | null;
    rank?: { name?: string | null } | null;
  } | null;
  copilotPersonnel?: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
    service_number?: string | null;
    rank?: { name?: string | null } | null;
  } | null;
};

export type Operation = {
  id: number;
  unit_id: number;
  operation_type_id: number | null;
  operation_category_id: number | null;
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
  operation_category: OperationCategory | null;
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
  tagTypes: [
    "Operations",
    "OperationTypes",
    "OperationCategories",
    "OperationDetails",
    "OperationTelemetry",
    "OperationMessages",
  ],
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
    getOperationCategories: builder.query<OperationCategory[], void>({
      query: () => ({
        url: "/operation-categories",
        method: "GET",
      }),
      providesTags: ["OperationCategories"],
    }),
    createOperationCategory: builder.mutation<
      OperationCategory,
      { name: string; description?: string | null }
    >({
      query: (body) => ({
        url: "/operation-categories",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["OperationCategories"],
    }),
    getOperationCategoryById: builder.query<OperationCategory, number | string>({
      query: (id) => ({
        url: `/operation-categories/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "OperationCategories", id }],
    }),
    updateOperationCategory: builder.mutation<
      OperationCategory,
      { id: number | string; name: string; description?: string | null }
    >({
      query: ({ id, ...body }) => ({
        url: `/operation-categories/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: ["OperationCategories"],
    }),
    deleteOperationCategory: builder.mutation<void, number | string>({
      query: (id) => ({
        url: `/operation-categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["OperationCategories"],
    }),
    createOperationType: builder.mutation<
      OperationType,
      { name: string; description?: string | null }
    >({
      query: (body) => ({
        url: "/operation-types",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["OperationTypes"],
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
    /** One AAR by id; used to open it from the approvals inbox. */
    getAfterActionReport: builder.query<AfterActionReport, number>({
      query: (id) => ({ url: `/after-action-reports/${id}`, method: "GET" }),
    }),
    signAfterActionReport: builder.mutation<
      AfterActionReport,
      {
        id: number;
        operation_id: number;
        role: "commanding_officer" | "pilot_in_command" | "co_pilot";
        signature: string;
        name?: string;
        service_number?: string;
        rank?: string;
      }
    >({
      query: ({ id, operation_id: _opId, ...body }) => ({
        url: `/after-action-reports/${id}/sign`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_result, _error, { operation_id }) => [
        { type: "OperationDetails", id: operation_id },
        "Operations",
      ],
    }),
    getCommandingOfficers: builder.query<CommandingOfficerOption[], void>({
      query: () => ({
        url: "/after-action-reports/commanding-officers",
        method: "GET",
      }),
    }),
    logOperationFlightHours: builder.mutation<
      LogOperationFlightHoursResponse,
      LogOperationFlightHoursRequest
    >({
      query: ({ operation_id, asset_id, ...body }) => ({
        url: `/operations/${operation_id}/assets/${asset_id}/log-flight-hours`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_result, _error, { operation_id }) => [
        { type: "OperationDetails", id: operation_id },
        "Operations",
      ],
    }),
    getWeatherBriefing: builder.query<
      WeatherBriefingResponse,
      {
        departure_lat?: number | null;
        departure_lon?: number | null;
        arrival_lat?: number | null;
        arrival_lon?: number | null;
        stations?: string;
        flight_date?: string | null;
        flight_time?: string | null;
        force_refresh?: boolean;
      } | void
    >({
      query: (params) => ({
        url: "/weather/briefing",
        method: "GET",
        params: params || undefined,
      }),
    }),
    getOperationTelemetry: builder.query<OperationTelemetryResponse, number | string>({
      query: (operationId) => ({
        url: `/operations/${operationId}/telemetry`,
        method: "GET",
      }),
      providesTags: (_result, _error, operationId) => [
        { type: "OperationTelemetry", id: operationId },
      ],
    }),
    getOperationSatelliteMessages: builder.query<SatelliteMessage[], number | string>({
      query: (operationId) => ({
        url: `/operations/${operationId}/satellite-messages`,
        method: "GET",
      }),
      providesTags: (_result, _error, operationId) => [
        { type: "OperationMessages", id: operationId },
      ],
    }),
    sendSatelliteMessage: builder.mutation<
      { message: SatelliteMessage; dispatch: Record<string, unknown> },
      SendSatelliteMessageRequest
    >({
      query: ({ operation_id, ...data }) => ({
        url: `/operations/${operation_id}/satellite-messages`,
        method: "POST",
        data,
      }),
      invalidatesTags: (_result, _error, { operation_id }) => [
        { type: "OperationMessages", id: operation_id },
      ],
    }),
    simulateGarminPing: builder.mutation<
      {
        status: string;
        simulated: boolean;
        telemetry: TelemetryPoint;
        satellite_message?: SatelliteMessage | null;
      },
      SimulateTelemetryRequest
    >({
      query: (data) => ({
        url: "/telemetry/garmin/simulate",
        method: "POST",
        data,
      }),
      invalidatesTags: (_result, _error, { operation_id }) => [
        { type: "OperationTelemetry", id: operation_id },
        { type: "OperationMessages", id: operation_id },
      ],
    }),
  }),
});

export type TelemetryPoint = {
  id: number;
  operation_id?: number | null;
  asset_id?: number | null;
  device_id?: number | null;
  imei: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  course?: number | null;
  message_code: number;
  recorded_at: string;
};

export type LiveAircraftPosition = {
  asset_id?: number;
  asset_name?: string;
  asset_model?: string;
  call_sign?: string;
  imei: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  course?: number | null;
  battery_level?: number | null;
  recorded_at: string;
};

export type OperationTelemetryResponse = {
  operation_id: number;
  tracks: TelemetryPoint[];
  latest_positions: LiveAircraftPosition[];
  device_count: number;
};

export type SatelliteMessage = {
  id: number;
  operation_id?: number | null;
  asset_id?: number | null;
  device_id?: number | null;
  imei: string;
  direction: "inbound" | "outbound";
  message_code: number;
  sender?: string | null;
  recipient?: string | null;
  message_text: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  is_sos: boolean;
  status: string;
  sent_at: string;
};

export type SendSatelliteMessageRequest = {
  operation_id: number | string;
  message_text: string;
  asset_id?: number | null;
  imei?: string | null;
  recipient?: string | null;
};

export type SimulateTelemetryRequest = {
  operation_id: number;
  asset_id?: number | null;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  course?: number | null;
  message_text?: string | null;
  is_sos?: boolean;
  imei?: string | null;
};

export type WeatherStationData = {
  icao: string;
  name: string;
  elevation_ft: number | null;
  status: "available" | "no_metar" | "service_unavailable";
  has_data: boolean;
  flight_category: "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKNOWN";
  raw_metar: string | null;
  raw_taf: string | null;
  has_taf?: boolean;
  taf_status?: "available" | "no_taf" | "service_unavailable";
  taf_valid_from?: string | null;
  taf_valid_to?: string | null;
  observed_at: string | null;
  age_minutes: number | null;
  is_outdated?: boolean;
  wind: {
    speed_kts: number | null;
    direction_deg: number | null;
    direction_label?: string;
    gust_kts: number | null;
    label: string;
  } | null;
  visibility: {
    statute_miles: number | string | null;
    label: string;
  } | null;
  weather_phenomena?: {
    raw: string | null;
    label: string | null;
  } | null;
  clouds: Array<{
    cover: string;
    base_ft: number | null;
  }>;
  temperature_c: number | null;
  dewpoint_c: number | null;
  altimeter_hpa: number | null;
  altimeter_inhg: number | null;
  service_unavailable?: boolean;
  status_message?: string;
  context?: "departure" | "arrival";
  distance_to_query_nm?: number;
};

export type FlightScheduleIntelligence = {
  flight_date: string;
  flight_time: string | null;
  flight_datetime_formatted: string;
  is_today: boolean;
  is_past: boolean;
  is_future: boolean;
  days_from_today: number;
  status: "TODAY_ACTIVE" | "SCHEDULED_FUTURE" | "HISTORICAL_ARCHIVED";
  advisory: string;
};

export type WeatherBriefingResponse = {
  source: string;
  attribution: string;
  fetched_at: string;
  last_updated?: string;
  stations: Record<string, WeatherStationData>;
  departure_station: string | null;
  arrival_station: string | null;
  flight_schedule?: FlightScheduleIntelligence | null;
};

export const {
  useGetAfterActionReportQuery,
  useGetOperationsQuery,
  useGetOperationByIdQuery,
  useGetOperationTypesQuery,
  useGetOperationCategoriesQuery,
  useGetOperationCategoryByIdQuery,
  useCreateOperationCategoryMutation,
  useUpdateOperationCategoryMutation,
  useDeleteOperationCategoryMutation,
  useCreateOperationTypeMutation,
  useCreateOperationMutation,
  useUpdateOperationMutation,
  useUpdateOperationStatusMutation,
  useDeleteOperationMutation,
  useCreateAfterActionReportMutation,
  useSignAfterActionReportMutation,
  useGetCommandingOfficersQuery,
  useLogOperationFlightHoursMutation,
  useGetWeatherBriefingQuery,
  useGetOperationTelemetryQuery,
  useGetOperationSatelliteMessagesQuery,
  useSendSatelliteMessageMutation,
  useSimulateGarminPingMutation,
} = operationsApi;
