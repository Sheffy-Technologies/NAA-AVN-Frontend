import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type MaintenanceMetricsResponse = {
  reference_date: string;
  summary: {
    total_work_orders: number;
    total_work_order_tasks: number;
    total_maintenance_programs: number;
    open_defects: number;
    resolved_defects: number;
    defect_resolution_rate: number;
    compliance_completed_this_month: number;
    compliance_due_next_30_days: number;
    compliance_overdue_count?: number;
    parts_issued_count: number;
    parts_issued_cost: number;
  };
  recent: {
    work_orders: Array<{
      id: number;
      asset_id: number | null;
      title: string | null;
      reported_by: number | null;
      created_at: string | null;
    }>;
    upcoming_compliance: Array<{
      id: number;
      work_order_task_id: number | null;
      component_id: number | null;
      engine_id: number | null;
      avionics_id: number | null;
      next_due_date: string | null;
      next_due_hours: number | string | null;
      completion_date: string | null;
    }>;
  };
};

export type MaintenanceProgram = {
  id: number;
  ata_chapter_id?: number | null;
  name: string;
  description?: string | null;
  asset_id?: number | null;
  interval_hours?: number | null;
  interval_months?: number | null;
  applicability?: "component" | "engine" | "avionics";
  interval_type?: "hours" | "cycles" | "calendar";
  created_at?: string;
  updated_at?: string;
};

export type CreateWorkOrderRequest = {
  asset_id?: number | null;
  title: string;
  reported_by?: number | null;
  maintenance_program_ids?: number[];
  program_applicabilities?: Array<{
    program_id: number;
    component_ids?: number[];
    engine_ids?: number[];
    avionics_ids?: number[];
  }>;
  defect_ids?: number[];
  defect_applicabilities?: Array<{
    defect_id: number;
    component_id?: number | null;
    engine_id?: number | null;
    avionics_id?: number | null;
  }>;
};

export type WorkOrderTask = {
  id: number;
  work_order_id: number;
  maintenance_program_id?: number | null;
  defect_id?: number | null;
  status?: "pending" | "completed" | string;
  personnel_id?: number | null;
  component_id?: number | null;
  engine_id?: number | null;
  avionics_id?: number | null;
  description?: string | null;
  task_type?: string | null;
  actual_labour_hours?: number | string | null;
  labour_rate?: number | string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  program?: MaintenanceProgram | null;
  defect?: DefectRecord | null;
  maintenanceInventories?: MaintenanceInventoryRecord[];
};

export type MaintenanceInventoryRecord = {
  id: number;
  work_order_task_id: number;
  inventory_id: number;
  quantity: number;
  unit_cost_at_issue?: number | string | null;
  disposition: "installed" | "faulty";
  created_at?: string;
  updated_at?: string;
  inventory?: {
    id: number;
    part_number?: string | null;
    serial_number?: string | null;
    current_stock?: number;
    unit_cost?: number | string | null;
  } | null;
};

export type CreateMaintenanceInventoryRequest = {
  work_order_task_id: number;
  inventory_id: number;
  quantity?: number;
  unit_cost_at_issue?: number | null;
  disposition?: "installed" | "faulty";
};

export type UpdateMaintenanceInventoryRequest = {
  id: number;
  work_order_task_id?: number;
  inventory_id?: number;
  quantity?: number;
  unit_cost_at_issue?: number | null;
  disposition?: "installed" | "faulty";
};

export type UpdateWorkOrderTaskRequest = {
  id: number;
  status?: "pending" | "completed";
  description?: string | null;
  actual_labour_hours?: number | null;
  labour_rate?: number | null;
};

export type WorkOrderAsset = {
  id: number;
  type?: string | null;
  unit_id?: number | null;
  asset_type_id?: number | null;
  image?: string | null;
  name?: string | null;
  serial_number?: string | null;
  model?: string | null;
  configuration?: string[];
  serviceability_status?: string | null;
  tail_number?: string | null;
  total_airframe_hours?: string | number | null;
  service_life_limit?: string | number | null;
  total_cycles?: string | number | null;
  cycle_limit?: string | number | null;
  last_inspection_cycles?: string | number | null;
  inspection_interval_cycle?: string | number | null;
  last_inspection_hours?: string | number | null;
  inspection_interval?: string | number | null;
  next_annual_inspection_date?: string | null;
  next_type_of_inspection?: string | null;
  last_inspection_date?: string | null;
  landings?: number | null;
  operation_status?: string | null;
  manufacturer?: string | null;
  purchase_date?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  operations_total_hours?: number;
  operations_total_hours_label?: string;
};

export type WorkOrderResponse = {
  id: number;
  asset_id?: number | null;
  reported_by?: number | null;
  title: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  asset?: WorkOrderAsset;
  tasks?: WorkOrderTask[];
};

export type MaintenanceComponent = {
  id: number;
  part_number?: string | null;
  serial_number?: string | null;
  time_since_new?: number | string | null;
  service_life_limit_hours?: number | string | null;
  last_inspection?: number | string | null;
  inspection_interval?: number | string | null;
  inspection_interval_unit?: "hours" | "months" | "cycle" | string | null;
  removed_at?: string | null;
};

export type MaintenanceEngine = {
  id: number;
  model?: string | null;
  serial_number?: string | null;
  time_since_new?: number | string | null;
  service_life_limit?: number | string | null;
  last_inspection?: number | string | null;
  inspection_interval?: number | string | null;
  inspection_interval_unit?: "hours" | "months" | "cycle" | string | null;
};

export type MaintenanceAvionics = {
  id: number;
  model?: string | null;
  serial_number?: string | null;
  time_since_new?: number | string | null;
  service_life_limit?: number | string | null;
  last_inspection?: number | string | null;
  inspection_interval?: number | string | null;
  inspection_interval_unit?: "hours" | "months" | "cycle" | string | null;
  removed_at?: string | null;
};

export type ComplianceRecord = {
  id: number;
  completion_date?: string | null;
  next_due_date?: string | null;
  next_due_hours?: number | string | null;
  remarks?: string | null;
  component_id?: number | null;
  engine_id?: number | null;
  avionics_id?: number | null;
  work_order_task_id?: number | null;
};

export type DefectRecord = {
  id: number;
  asset_id?: number | null;
  operation_id?: number | null;
  work_order_id?: number | null;
  reported_by?: number | null;
  title?: string | null;
  description?: string | null;
  resolution?: string | null;
  severity?: string | null;
  status?: string | null;
  reported_at?: string | null;
  reported_hours?: number | string | null;
  resolved_at?: string | null;
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export const maintenanceApi = createApi({
  reducerPath: "maintenanceApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["MaintenancePrograms", "WorkOrders", "Defects"],
  endpoints: (builder) => ({
    getMaintenanceMetrics: builder.query<
      MaintenanceMetricsResponse,
      { reference_date?: string } | void
    >({
      query: (params) => ({
        url: "/maintenance-metrics",
        method: "GET",
        params: params || undefined,
      }),
    }),
    getMaintenancePrograms: builder.query<
      MaintenanceProgram[],
      { interval_hours?: number; applicability?: string } | void
    >({
      query: (params) => ({
        url: "/maintenance-programs",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: [{ type: "MaintenancePrograms", id: "LIST" }],
    }),
    createWorkOrder: builder.mutation<WorkOrderResponse, CreateWorkOrderRequest>({
      query: (body) => ({
        url: "/work-orders",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "WorkOrders", id: "LIST" }, { type: "Defects", id: "LIST" }],
    }),
    getWorkOrders: builder.query<WorkOrderResponse[], { asset_id?: number } | void>({
      query: (params) => ({
        url: "/work-orders",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: [{ type: "WorkOrders", id: "LIST" }],
    }),
    getWorkOrderById: builder.query<WorkOrderResponse, number>({
      query: (id) => ({
        url: `/work-orders/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "WorkOrders", id }],
    }),
    getComplianceRecords: builder.query<ComplianceRecord[], void>({
      query: () => ({
        url: "/compliance-history",
        method: "GET",
      }),
    }),
    getDefectRecords: builder.query<DefectRecord[], void>({
      query: () => ({
        url: "/defects",
        method: "GET",
      }),
      providesTags: [{ type: "Defects", id: "LIST" }],
    }),
    getComponents: builder.query<MaintenanceComponent[], void>({
      query: () => ({
        url: "/components",
        method: "GET",
      }),
    }),
    getEngines: builder.query<MaintenanceEngine[], void>({
      query: () => ({
        url: "/engines",
        method: "GET",
      }),
    }),
    getAvionics: builder.query<MaintenanceAvionics[], void>({
      query: () => ({
        url: "/avionics",
        method: "GET",
      }),
    }),
    createMaintenanceInventory: builder.mutation<
      MaintenanceInventoryRecord,
      CreateMaintenanceInventoryRequest
    >({
      query: (body) => ({
        url: "/maintenance-inventories",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "WorkOrders", id: "LIST" }],
    }),
    updateMaintenanceInventory: builder.mutation<
      MaintenanceInventoryRecord,
      UpdateMaintenanceInventoryRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/maintenance-inventories/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: [{ type: "WorkOrders", id: "LIST" }],
    }),
    updateWorkOrderTask: builder.mutation<WorkOrderTask, UpdateWorkOrderTaskRequest>({
      query: ({ id, ...body }) => ({
        url: `/work-order-tasks/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: [{ type: "WorkOrders", id: "LIST" }],
    }),
  }),
});

export const {
  useGetMaintenanceMetricsQuery,
  useGetMaintenanceProgramsQuery,
  useCreateWorkOrderMutation,
  useGetWorkOrdersQuery,
  useGetWorkOrderByIdQuery,
  useGetComplianceRecordsQuery,
  useGetDefectRecordsQuery,
  useGetComponentsQuery,
  useGetEnginesQuery,
  useGetAvionicsQuery,
  useCreateMaintenanceInventoryMutation,
  useUpdateMaintenanceInventoryMutation,
  useUpdateWorkOrderTaskMutation,
} = maintenanceApi;
