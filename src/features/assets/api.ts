import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import { type Operation } from "@/features/operations/api";

export type AssetConfiguration = string[];

export type Engine = {
  id?: number;
  asset_id?: number;
  position_id: number;
  category_id?: number;
  ata_chapter_id?: number;
  serial_number: string;
  model: string;
  installation_date: string;
  time_since_new: number | string;
  last_inspection?: number | string | null;
  service_life_limit: number | string;
  inspection_interval_unit?: "hours" | "months" | "cycle";
  inspection_interval?: number | string | null;
  inspection_interval_hours?: number | string | null;
  inspection_interval_cycles?: number | string | null;
  maintenance_strategy?: "hard-time" | "on-condition" | "condition";
  operation_flight_hours?: number;
  current_time_since_new?: number;
  current_time_since_new_label?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type Component = {
  id?: number;
  asset_id?: number;
  component_type_id?: number;
  ata_chapter_id?: number;
  part_number: string;
  serial_number: string;
  time_since_new?: number | string;
  service_life_limit_hours?: number | string;
  last_inspection?: number | string | null;
  inspection_interval_unit?: "hours" | "months" | "cycle";
  inspection_interval?: number | string;
  inspection_interval_hours?: number | string | null;
  inspection_interval_cycles?: number | string | null;
  maintenance_strategy?: "hard-time" | "on-condition" | "condition";
  operation_flight_hours?: number;
  current_time_since_new?: number;
  current_time_since_new_label?: string;
  installed_at: string;
  removed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type Document = {
  id?: number;
  asset_id?: number;
  maintenance_event_id?: number | null;
  document_type_id?: number | null;
  file: string;
  issue_date: string | null;
  expiry_date: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  document_type?: {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
  } | null;
};

export type Avionics = {
  id?: number;
  asset_id?: number;
  avionic_category_id?: number;
  ata_chapter_id?: number;
  serial_number: string;
  model: string;
  manufacturer?: string | null;
  installed_at: string;
  time_since_new?: number | string;
  service_life_limit?: number | string;
  last_inspection?: number | string | null;
  inspection_interval_unit?: "hours" | "months" | "cycle";
  inspection_interval?: number | string;
  maintenance_strategy?: "hard-time" | "on-condition" | "condition";
  operation_flight_hours?: number;
  current_time_since_new?: number;
  current_time_since_new_label?: string;
  removed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type Defect = {
  id?: number;
  asset_id?: number;
  operation_id: number;
  component_id?: number | null;
  engine_id?: number | null;
  avionics_id?: number | null;
  title: string;
  description: string;
  reported_at: string;
  status: "open" | "resolved" | "in_progress";
  severity: string;
  remarks?: string | null;
  resolved_at?: string | null;
  reported_by?: number | null;
  personnel?: number[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
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
  aircraft_airworthiness?: string;
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

export type EnginePosition = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ComponentType = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type EngineCategory = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type AtaChapter = {
  id: number;
  chapter_number?: string;
  chapter_name?: string;
  name?: string;
  description?: string | null;
  maintenance_category?: "engines" | "avionics" | "components" | string | null;
  applicability?: "component" | "engine" | "avionics" | string | null;
  created_at?: string;
  updated_at?: string;
};

export type AvionicCategory = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type AssetType = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type VehicleType = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: number;
  name: string;
  vehicle_type_id?: number;
  registration_number?: string | null;
  serial_number?: string | null;
  unit_id?: number | null;
  photo?: string | null;
  photo_url?: string | null;
  serviceability_status?: Asset["serviceability_status"] | null;
  operation_status?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Facility = {
  id: number;
  name: string;
  description?: string | null;
  unit_id?: number | null;
  image?: string | null;
  image_url?: string | null;
  longitude?: string | null;
  latitude?: string | null;
  serviceability_status?: Asset["serviceability_status"] | null;
  operation_status?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DocumentType = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type AssetImageUploadResponse = {
  image_url?: string;
  file_url?: string;
  image?: string;
  file?: string;
  data?: string;
};

export type CreateDocumentRequest = {
  asset_id: number | null;
  maintenance_event_id: number | null;
  document_type_id: number | null;
  file: File | null;
  issue_date: string | null;
  expiry_date: string | null;
};

export type DocumentUpload = {
  id: number;
  asset_id: number | null;
  maintenance_event_id: number | null;
  document_type_id: number | null;
  file: string;
  issue_date: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
  file_url: string;
};

export type CreateAssetComponentPayload = {
  asset_id?: number;
  component_type_id: number;
  ata_chapter_id: number;
  part_number: string;
  serial_number: string;
  time_since_new: number;
  service_life_limit_hours: number;
  inspection_interval_unit: "hours" | "months" | "cycle";
  inspection_interval: number | null;
  inspection_interval_hours?: number | null;
  inspection_interval_cycles?: number | null;
  maintenance_strategy: "hard-time" | "on-condition" | "condition";
  installed_at: string;
  removed_at: string | null;
};

export type CreateAssetAvionicsPayload = {
  avionic_category_id: number;
  ata_chapter_id: number;
  serial_number: string;
  model: string;
  manufacturer?: string | null;
  time_since_new: number;
  service_life_limit: number;
  inspection_interval_unit: "hours" | "months" | "cycle";
  inspection_interval: number | null;
  maintenance_strategy: "hard-time" | "on-condition" | "condition";
  installed_at: string;
  removed_at: string | null;
};

export type CreateAssetDocumentPayload = {
  document_type_id: number;
  file: string;
  issue_date: string | null;
  expiry_date: string | null;
};

export type CreateDefectPayload = {
  asset_id: number;
  title: string;
  description: string;
  remarks: string;
  operation_id?: number;
  personnel_ids: number[];
  maintenance_events?: Array<{
    inspection_name: string;
    work_done: string;
  }>;
};

export type CreateAssetPayload = {
  type: "aircraft" | "vehicle" | "airbase" | "equipment";
  unit_id: number;
  asset_type_id: number;
  name: string;
  image?: string;
  image_url?: string;
  serial_number: string;
  model: string;
  configuration: AssetConfiguration;
  serviceability_status:
    | "serviceable"
    | "under_maintenance"
    | "grounded"
    | "medical";
  tail_number: string;
  manufacturer: string;
  purchase_date: string;
  total_airframe_hours: number;
  service_life_limit: number;
  total_cycles: number;
  cycle_limit: number;
  last_inspection_cycles: number;
  inspection_interval_cycle: number;
  last_inspection_hours: number;
  inspection_interval: number;
  next_annual_inspection_date: string;
  next_type_of_inspection: string;
  last_inspection_date: string;
  landings: string;
  operation_status: string;
  engines: Array<{
    position_id: number;
    category_id: number;
    ata_chapter_id: number;
    serial_number: string;
    model: string;
    installation_date: string;
    time_since_new: number;
    service_life_limit: number;
    inspection_interval_unit: "hours" | "months" | "cycle";
    inspection_interval: number | null;
    inspection_interval_hours?: number | null;
    inspection_interval_cycles?: number | null;
    maintenance_strategy: "hard-time" | "on-condition" | "condition";
  }>;
  components: CreateAssetComponentPayload[];
  documents: CreateAssetDocumentPayload[];
  maintenance_events: Array<{
    component_id?: number;
    performed_by: number;
    event_type: string;
    description: string;
    started_at: string;
    completed_at: string;
    hours_logged: number;
    status: string;
    aircraft_airworthiness: string;
  }>;
  avionics: CreateAssetAvionicsPayload[];
  defects: Array<{
    operation_id: number;
    title: string;
    description: string;
    reported_at: string;
    status: string;
    severity: string;
    personnel: number[];
  }>;
};

export type CreateVehiclePayload = {
  name: string;
  vehicle_type_id: number;
  registration_number: string;
  serial_number?: string;
  unit_id: number;
  photo?: File | null;
};

export type UpdateVehiclePayload = {
  id: number;
  name?: string;
  vehicle_type_id?: number;
  registration_number?: string;
  serial_number?: string;
  unit_id?: number;
  photo?: File | null;
};

export type CreateFacilityPayload = {
  name: string;
  image?: File | null;
  description: string;
  longitude: string;
  latitude: string;
};

export type Asset = {
  id: number;
  asset_id?: number;
  type: "aircraft" | "vehicle" | "airbase" | "equipment" | "facility";
  unit_id: number;
  asset_type_id?: number;
  name: string;
  image?: string | null;
  image_url?: string | null;
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
  deleted_at?: string | null;
  total_cycles?: string;
  cycle_limit?: string;
  last_inspection_cycles?: string;
  inspection_interval_cycle?: string;
  operations_count?: number;
  operations_total_hours: number;
  operations_total_hours_label: string;
};

export type AssetDetail = Asset & {
  maintenance_events: MaintenanceEvent[];
  engines: Engine[];
  components: Component[];
  documents: Document[];
  avionics: Avionics[];
  defects: Defect[];
  operations: Operation[];
};

export const assetsApi = createApi({
  reducerPath: "assetsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    "Assets",
    "AssetTypes",
    "EnginePositions",
    "ComponentTypes",
    "EngineCategories",
    "AvionicCategories",
    "DocumentTypes",
    "Documents",
  ],
  endpoints: (builder) => ({
    getAssetTypes: builder.query<AssetType[], void>({
      query: () => ({
        url: "/asset-types",
        method: "GET",
      }),
      providesTags: ["AssetTypes"],
    }),
    getVehicleTypes: builder.query<VehicleType[], void>({
      query: () => ({
        url: "/vehicle-types",
        method: "GET",
      }),
      providesTags: ["AssetTypes"],
    }),
    uploadAssetImage: builder.mutation<AssetImageUploadResponse, File>({
      query: (image) => {
        const formData = new FormData();
        formData.append("image", image);

        return {
          url: "/assets/image",
          method: "POST",
          data: formData,
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
    }),
    getEnginePositions: builder.query<EnginePosition[], void>({
      query: () => ({
        url: "/engine-positions",
        method: "GET",
      }),
      providesTags: ["EnginePositions"],
    }),
    getComponentTypes: builder.query<ComponentType[], void>({
      query: () => ({
        url: "/component-types",
        method: "GET",
      }),
      providesTags: ["ComponentTypes"],
    }),
    getEngineCategories: builder.query<EngineCategory[], void>({
      query: () => ({
        url: "/engine-categories",
        method: "GET",
      }),
      providesTags: ["EngineCategories"],
    }),
    getAtaChapters: builder.query<AtaChapter[], void>({
      query: () => ({
        url: "/ata-chapters",
        method: "GET",
      }),
      providesTags: ["EngineCategories"],
    }),
    getAvionicCategories: builder.query<AvionicCategory[], void>({
      query: () => ({
        url: "/avionic-categories",
        method: "GET",
      }),
      providesTags: ["AvionicCategories"],
    }),
    getDocumentTypes: builder.query<DocumentType[], void>({
      query: () => ({
        url: "/document-types",
        method: "GET",
      }),
      providesTags: ["DocumentTypes"],
    }),
    createDocument: builder.mutation<DocumentUpload, CreateDocumentRequest>({
      query: (body) => {
        const formData = new FormData();

        formData.append(
          "asset_id",
          body.asset_id === null ? "" : String(body.asset_id),
        );
        formData.append(
          "maintenance_event_id",
          body.maintenance_event_id === null
            ? ""
            : String(body.maintenance_event_id),
        );
        formData.append(
          "document_type_id",
          body.document_type_id === null ? "" : String(body.document_type_id),
        );
        formData.append("issue_date", body.issue_date ?? "");
        formData.append("expiry_date", body.expiry_date ?? "");

        if (body.file) {
          formData.append("file", body.file);
        }

        return {
          url: "/documents",
          method: "POST",
          data: formData,
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
      invalidatesTags: ["Documents"],
    }),
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
    getVehicles: builder.query<Vehicle[], void>({
      query: () => ({
        url: "/vehicles",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Assets" as const, id })),
              { type: "Assets", id: "LIST" },
            ]
          : [{ type: "Assets", id: "LIST" }],
    }),
    getFacilities: builder.query<Facility[], void>({
      query: () => ({
        url: "/facilities",
        method: "GET",
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
    createVehicle: builder.mutation<unknown, CreateVehiclePayload>({
      query: (body) => {
        const formData = new FormData();
        formData.append("name", body.name);
        formData.append("vehicle_type_id", String(body.vehicle_type_id));
        formData.append("registration_number", body.registration_number);
        if (body.serial_number) {
          formData.append("serial_number", body.serial_number);
        }
        formData.append("unit_id", String(body.unit_id));

        if (body.photo) {
          formData.append("photo", body.photo);
        }

        return {
          url: "/vehicles",
          method: "POST",
          data: formData,
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
      invalidatesTags: [{ type: "Assets", id: "LIST" }],
    }),
    updateVehicle: builder.mutation<unknown, UpdateVehiclePayload>({
      query: ({ id, ...body }) => {
        const formData = new FormData();

        if (body.name !== undefined) {
          formData.append("name", body.name);
        }
        if (body.vehicle_type_id !== undefined) {
          formData.append("vehicle_type_id", String(body.vehicle_type_id));
        }
        if (body.registration_number !== undefined) {
          formData.append("registration_number", body.registration_number);
        }
        if (body.serial_number !== undefined) {
          formData.append("serial_number", body.serial_number);
        }
        if (body.unit_id !== undefined) {
          formData.append("unit_id", String(body.unit_id));
        }
        if (body.photo) {
          formData.append("photo", body.photo);
        }

        return {
          url: `/vehicles/${id}`,
          method: "POST",
          data: formData,
          params: { _method: "PUT" },
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
      invalidatesTags: (result, error, body) => {
        void result;
        void error;
        return [
          { type: "Assets", id: body.id },
          { type: "Assets", id: "LIST" },
        ];
      },
    }),
    createFacility: builder.mutation<unknown, CreateFacilityPayload>({
      query: (body) => {
        const formData = new FormData();
        formData.append("name", body.name);
        formData.append("description", body.description);
        formData.append("longitude", body.longitude);
        formData.append("latitude", body.latitude);

        if (body.image) {
          formData.append("image", body.image);
        }

        return {
          url: "/facilities",
          method: "POST",
          data: formData,
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
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
    deleteAsset: builder.mutation<{ message?: string }, number>({
      query: (id) => ({
        url: `/assets/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => {
        void result;
        void error;
        return [
          { type: "Assets", id },
          { type: "Assets", id: "LIST" },
        ];
      },
    }),
    createDefect: builder.mutation<Defect, CreateDefectPayload>({
      query: (body) => ({
        url: "/defects",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (result, error, body) => {
        void result;
        void error;
        return [
          { type: "Assets", id: body.asset_id },
          { type: "Assets", id: "LIST" },
        ];
      },
    }),
  }),
});

export const {
  useGetAssetTypesQuery,
  useGetVehicleTypesQuery,
  useUploadAssetImageMutation,
  useGetEnginePositionsQuery,
  useGetComponentTypesQuery,
  useGetEngineCategoriesQuery,
  useGetAtaChaptersQuery,
  useGetAvionicCategoriesQuery,
  useGetDocumentTypesQuery,
  useCreateDocumentMutation,
  useGetAssetsQuery,
  useGetVehiclesQuery,
  useGetFacilitiesQuery,
  useGetAssetByIdQuery,
  useCreateAssetMutation,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useCreateFacilityMutation,
  useUpdateAssetMutation,
  useDeleteAssetMutation,
  useCreateDefectMutation,
} = assetsApi;
