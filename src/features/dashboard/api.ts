import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import type { MaintenanceDueItem } from "@/features/assets/api";

export type DashboardHomeOperationUnit = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardHomeOperation = {
  id: number;
  unit_id: number;
  operation_type_id: number | null;
  name: string;
  date: string;
  time: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  updated_at: string;
  unit: DashboardHomeOperationUnit;
  operation_type: unknown;
};

export type DashboardHomePilotRank = {
  id: number;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type DashboardHomeBasicEntity = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardHomePilot = {
  id: number;
  user_id: number | null;
  rank_id: number;
  unit_id: number;
  branch_id: number;
  specialty_id: number;
  corp_id: number;
  service_number: string;
  firstname: string;
  lastname: string;
  othernames: string;
  dob: string;
  email: string;
  phone_number: string;
  address: string;
  blood_group: string;
  call_sign: string;
  rating_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  rank: DashboardHomePilotRank;
  corp: DashboardHomeBasicEntity;
  branch: DashboardHomeBasicEntity;
  specialty: DashboardHomeBasicEntity;
  unit: DashboardHomeBasicEntity;
};

export type DashboardHomeFlightProgramType = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardHomeFlightProgram = {
  id: number;
  unit_id?: number | null;
  pilot_id?: number | null;
  flight_program_type_id?: number | null;
  name: string;
  total_hours?: string | number | null;
  start_time?: string | null;
  end_time?: string | null;
  start_date_time?: string | null;
  end_date_time?: string | null;
  status?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  unit?: DashboardHomeBasicEntity | null;
  flight_program_type?: DashboardHomeFlightProgramType | null;
  pilot?: DashboardHomePilot | null;
};

export type DashboardHomeResponse = {
  user_count: number;
  aircraft_count: number;
  personnel_count: number;
  spare_count: number;
  supplier_count: number;
  operation_count: number;
  inventories_count: number;
  /** Only present when the viewer also holds dashboard.finance.view. */
  finances?: number;
  recent_operations: DashboardHomeOperation[];
  recent_flight_programs: DashboardHomeFlightProgram[];
};

export type DashboardOperationsRecentOperation = {
  id?: number;
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  date?: string;
  time?: string;
  start_date_time?: string;
  end_date_time?: string;
  created_at?: string;
  unit?: {
    id?: number;
    name?: string;
  };
  operation_type?: {
    id?: number;
    name?: string;
  } | null;
};

export type DashboardOperationsResponse = {
  total_operations: number;
  planned: number;
  completed: number;
  ongoing: number;
  aborted: number;
  /** Still-upcoming (status "planned") operations. */
  recent_operations: DashboardOperationsRecentOperation[];
  /** Operations actually conducted (completed/ongoing/aborted) in the last 24 hours. */
  conducted_operations: DashboardOperationsRecentOperation[];
};

export type DashboardMaintenanceRecentAircraft = {
  id: number;
  type: string;
  unit_id: number;
  asset_type_id: number;
  name: string;
  serial_number: string;
  model: string;
  configuration: Array<unknown> | null;
  serviceability_status: string;
  tail_number: string;
  total_airframe_hours: string;
  service_life_limit: string;
  total_cycles: string;
  cycle_limit: string;
  last_inspection_cycles: string;
  inspection_interval_cycle: string;
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
  operations_total_hours: string;
  operations_total_hours_label: string;
};

export type DashboardMaintenanceResponse = {
  total_aircraft: number;
  total_vehicles: number;
  total_airbases: number;
  total_equipments: number;
  recent_aircrafts: DashboardMaintenanceRecentAircraft[];
  /** Components/engines/avionics across the fleet nearing or past their remaining hours/cycles limit. */
  coming_due: MaintenanceDueItem[];
  maintenance_events: {
    serviceable: number;
    under_maintenance: number;
    grounded: number;
  };
};

export type DashboardFinanceResponse = {
  total_expense: number;
  current_month_expense: number;
  current_quarter_expense: number;
  sum_amount: number;
  budget: number;
  /** Allocated starting amount across every account, before income/expense. */
  opening_balance: number;
  /** opening_balance + total income - total expense, across every account. */
  balance_of_account: number;
};

export type DashboardInventoryRecentItem = {
  id: number;
  type: string;
  asset_id: number;
  expense_category_id: number;
  unit_id: number;
  serial_number: string;
  part_number: string;
  current_stock: number;
  re_order_level: number;
  unit_cost: string;
  measurement_unit: string;
  vendor: string;
  expiry_date: string | null;
  remark: string;
  description: string;
  created_at: string;
  updated_at: string;
  stock_level: string;
  expense_category?: {
    id: number;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
  expenseCategory?: {
    id: number;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
  unit?: {
    id: number;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
  stocks?: Array<{
    id: number;
    inventory_id: number;
    stock_type: string;
    quantity: number;
    created_at: string;
    updated_at: string;
  }>;
};

export type DashboardInventoriesResponse = {
  total_stock: number | string;
  low_stock: number;
  expired_items: number;
  critical_stock: number;
  recent_inventories: DashboardInventoryRecentItem[];
};

export type DashboardPersonnelRecent = {
  id: number;
  status: string;
  image: string | null;
  firstname: string;
  lastname: string;
  othernames: string;
  full_name: string;
  rank?: { id: number; name: string; abbreviation: string; order: number };
  unit?: { id: number; name: string; description: string | null };
  branch?: { id: number; name: string; description: string | null };
};

export type DashboardPersonnelResponse = {
  total_personnel: number;
  active: number;
  medical: number;
  grounded: number;
  recent_personnel: DashboardPersonnelRecent[];
};


export type StrategicTempoDay = {
  date: string;
  label: string;
  count: number;
};

export type StrategicTempo = {
  flights_today: number;
  flights_this_week: number;
  operations_this_week: number;
  flights_by_day: StrategicTempoDay[];
};

export type StrategicOperationPoint = {
  lat: number;
  lng: number;
};

export type StrategicOperationWaypoint = StrategicOperationPoint & {
  name: string | null;
};

export type StrategicOperationStatus = "planned" | "ongoing" | "completed" | "aborted";

export type StrategicOperationAssetDetail = {
  id: number;
  name: string;
  tail_number?: string | null;
};

export type StrategicOperation = {
  id: number;
  name: string;
  status: StrategicOperationStatus;
  priority: string | null;
  is_flight: boolean;
  type: string | null;
  category?: string | null;
  unit: string | null;
  unit_id: number | null;
  description?: string | null;
  start_date_time: string | null;
  end_date_time: string | null;
  duration_hours?: number | null;
  duration_label?: string | null;
  departure: StrategicOperationPoint | null;
  arrival: StrategicOperationPoint | null;
  waypoints: StrategicOperationWaypoint[];
  assets: string[];
  asset_details?: StrategicOperationAssetDetail[];
};

export type StrategicGroundedAircraft = {
  id: number;
  name: string;
  tail_number: string | null;
  unit: string | null;
  reasons: string[];
};

export type StrategicDueItem = {
  asset_id: number | null;
  asset_name: string | null;
  asset_tail_number: string | null;
  name: string | null;
  category?: string | null;
  status: "overdue" | "due_soon";
  hours_remaining: number | null;
  days_remaining: number | null;
  cycles_remaining: number | null;
};

export type StrategicFleet = {
  total_aircraft: number;
  airworthy: number;
  grounded: number;
  grounded_aircraft: StrategicGroundedAircraft[];
  maintenance_due: {
    overdue: number;
    due_soon: number;
    overdue_items?: StrategicDueItem[];
    due_soon_items?: StrategicDueItem[];
  };
};

export type StrategicPersonnelReadiness = {
  total_personnel: number;
  active: number;
  medical: number;
  grounded: number;
  total_pilots: number;
  flight_currency: {
    current: number;
    due_for_flight: number;
    overdue: number;
    no_flights: number;
  };
  pass_status: {
    upcoming: number;
    due_for_pass: number;
    pending_approval: number;
    on_pass: number;
    overdue: number;
  };
};

export type StrategicDefects = {
  open_critical: number;
  open_high: number;
  open_total: number;
};

export type StrategicUnit = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  personnel_count: number;
  asset_count: number;
  operation_count: number;
};

export type StrategicFinance = {
  total_expense: number;
  current_month_expense: number;
  total_budget: number;
};

export type StrategicDashboardResponse = {
  generated_at: string;
  tempo: StrategicTempo;
  operations: StrategicOperation[];
  fleet: StrategicFleet;
  personnel_readiness: StrategicPersonnelReadiness;
  defects: StrategicDefects;
  units: StrategicUnit[];
  /** Only present when the viewer also holds dashboard.finance.view. */
  finance?: StrategicFinance;
};

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getDashboardHome: builder.query<DashboardHomeResponse, void>({
      query: () => ({
        url: "/dashboard/home",
        method: "GET",
      }),
    }),
    getDashboardOperations: builder.query<DashboardOperationsResponse, void>({
      query: () => ({
        url: "/dashboard/operations",
        method: "GET",
      }),
    }),
    getDashboardMaintenance: builder.query<DashboardMaintenanceResponse, void>({
      query: () => ({
        url: "/dashboard/maintenance",
        method: "GET",
      }),
    }),
    getDashboardFinance: builder.query<DashboardFinanceResponse, void>({
      query: () => ({
        url: "/dashboard/finance",
        method: "GET",
      }),
    }),
    getDashboardInventories: builder.query<DashboardInventoriesResponse, void>({
      query: () => ({
        url: "/dashboard/inventories",
        method: "GET",
      }),
    }),
    getDashboardPersonnel: builder.query<DashboardPersonnelResponse, void>({
      query: () => ({
        url: "/dashboard/personnel",
        method: "GET",
      }),
    }),
    getFlightPrograms: builder.query<DashboardHomeFlightProgram[], void>({
      query: () => ({
        url: "/flight-programs",
        method: "GET",
      }),
    }),
    getStrategicDashboard: builder.query<StrategicDashboardResponse, void>({
      query: () => ({
        url: "/dashboard/strategic",
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetDashboardHomeQuery,
  useGetDashboardOperationsQuery,
  useGetDashboardMaintenanceQuery,
  useGetDashboardFinanceQuery,
  useGetDashboardInventoriesQuery,
  useGetDashboardPersonnelQuery,
  useGetFlightProgramsQuery,
  useGetStrategicDashboardQuery,
} = dashboardApi;
