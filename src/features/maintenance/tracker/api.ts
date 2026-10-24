import { maintenanceApi } from "@/features/maintenance/api";

/*
 * Maintenance tracker (Maintenance Hub → Maintenance → Maintenance Tracking).
 * Backend: app/Http/Controllers/MaintenanceTracking/*, arithmetic in
 * App\Services\MaintenanceTracking\TrackingCalculator. The endpoints are
 * injected into the existing maintenanceApi slice, so no store wiring is
 * needed.
 */

export type TrackerCategory = "component" | "engine" | "inspection";

export type TrackerBasis =
  | "airframe_hours"
  | "engine_hours"
  | "rin"
  | "starts"
  | "starts_landings"
  | "interval_airframe_hours"
  | "interval_engine_hours"
  | "phase"
  | "calendar"
  | "expiry"
  | "on_condition"
  | "daily";

export type TrackerStatus = "overdue" | "due_soon" | "watch" | "ok" | "no_data" | "completed" | "on_condition" | "daily";

export type TrackerUnit = "hours" | "cycles" | "rin" | "days";

export type TrackerComputed = {
  counter_value: number | null;
  current_value: number | null;
  remaining: number | null;
  due_value: number | null;
  due_date: string | null;
  unit: TrackerUnit;
  life: number | null;
  percent_remaining: number | null;
  status: TrackerStatus;
};

export type TrackerItemFields = {
  asset_id: number;
  category: TrackerCategory;
  system_group: string | null;
  basis: TrackerBasis;
  description: string;
  part_number: string | null;
  serial_number: string | null;
  service_action: string | null;
  life_limit: number | null;
  counter_at_install: number | null;
  value_at_install: number | null;
  rin_multiplier: number | null;
  landing_factor: number | null;
  interval_days: number | null;
  last_done_value: number | null;
  last_done_date: string | null;
  expiry_date: string | null;
  phase_number: number | null;
  notes: string | null;
  sort_order: number;
  component_id: number | null;
  engine_id: number | null;
  avionics_id: number | null;
  maintenance_program_id: number | null;
};

export type TrackerItem = TrackerItemFields & {
  id: number;
  label: string;
  tracking: TrackerComputed;
  open_work_order: { id: number; work_order_number: string | null } | null;
  created_at?: string;
  updated_at?: string;
};

export type TrackerCounters = {
  airframe_hours: number;
  engine_hours: number | null;
  engine_starts: number | null;
  landings: number;
  hobbs_hours: number | null;
  as_of: string | null;
};

export type TrackerAssetHeader = {
  id: number;
  name: string;
  tail_number: string | null;
  registration: string;
  serial_number: string | null;
  type: string | null;
  model: string | null;
  unit_id: number | null;
  engine_model: string | null;
  engine_serial_number: string | null;
};

export type TrackerCounts = Record<TrackerStatus, number>;

export type TrackerPhaseCycle = {
  cycle_number: number;
  ended_at_hours: number;
  phases: { item_id: number; phase_number: number; description: string; done_at_hours: number | null }[];
  created_at: string;
};

export type TrackerSheet = {
  asset: TrackerAssetHeader;
  as_of: string;
  counters: TrackerCounters;
  counts: TrackerCounts;
  items: TrackerItem[];
  phase: {
    count: number;
    current_cycle: number;
    anchor_hours: number | null;
    next: { item_id: number; description: string; phase_number: number; due_value: number | null; remaining: number | null } | null;
    history: TrackerPhaseCycle[];
  };
  open_work_orders: number;
};

export type TrackerFleetRow = TrackerAssetHeader & {
  counters: TrackerCounters;
  counts: TrackerCounts;
  item_count: number;
  open_work_orders: number;
};

export type TrackerOptions = {
  categories: { value: TrackerCategory; label: string }[];
  bases: { value: TrackerBasis; label: string; fields: (keyof TrackerItemFields)[] }[];
  statuses: { value: TrackerStatus; label: string }[];
  thresholds: { due_soon_hours: number; due_soon_fraction: number; watch_fraction: number; due_soon_days: number; watch_days: number };
  defaults: { rin_multiplier: number; landing_factor: number };
  auto_raise_work_orders: boolean;
};

export type TrackerLog = {
  id: number;
  asset_id: number | null;
  maintenance_tracking_item_id: number | null;
  work_order_id: number | null;
  action: "compliance" | "replacement" | "phase_cycle" | "work_order" | "counters" | "voucher" | "other" | string;
  item_label: string;
  entry: string;
  created_at: string;
  asset?: { id: number; name: string; tail_number: string | null } | null;
  user?: { id: number; firstname: string | null; lastname: string | null } | null;
  work_order?: { id: number; work_order_number: string | null } | null;
};

export type RecordCompliancePayload = {
  performed_value?: number | null;
  performed_date?: string | null;
  value_at_install?: number | null;
  serial_number?: string | null;
  part_number?: string | null;
  expiry_date?: string | null;
  remarks?: string | null;
};

// ---- Work orders (NAAVN-005 workpack) ----

export type WorkpackComponentRow = {
  id?: number;
  position?: number;
  description: string | null;
  part_number_off: string | null;
  serial_number_off: string | null;
  part_number_on: string | null;
  serial_number_on: string | null;
};

export type SpareLine = {
  part_number: string | null;
  alternate_part_number: string | null;
  description: string | null;
  quantity: number | null;
  mm_reference: string | null;
};

export type Workpack = {
  id: number;
  work_order_number: string | null;
  asset_id: number | null;
  maintenance_tracking_item_id: number | null;
  title: string;
  status: "pending" | "in_progress" | "completed" | string;
  location: string | null;
  work_date: string | null;
  airframe_total_time: number | null;
  engine_total_time: number | null;
  task_defect: string | null;
  action_taken: string | null;
  engineer_name: string | null;
  engineer_licence_number: string | null;
  certifying_engineer_name: string | null;
  certifying_engineer_licence_number: string | null;
  has_engineer_signature: boolean;
  has_certifying_engineer_signature: boolean;
  pending_spares: SpareLine[] | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  components?: WorkpackComponentRow[];
  tracking_item?: (TrackerItemFields & { id: number }) | null;
  asset?: { id: number; name: string; tail_number: string | null } | null;
};

export type WorkpackUpdate = Partial<{
  title: string;
  location: string | null;
  work_date: string | null;
  airframe_total_time: number | null;
  engine_total_time: number | null;
  task_defect: string | null;
  action_taken: string | null;
  engineer_name: string | null;
  engineer_licence_number: string | null;
  engineer_signature: string | null;
  certifying_engineer_name: string | null;
  certifying_engineer_licence_number: string | null;
  certifying_engineer_signature: string | null;
  pending_spares: SpareLine[] | null;
  components: WorkpackComponentRow[];
}>;

// ---- Spares requests (NAAVN-007) ----

export type SparesRequestStatus = "draft" | "submitted" | "approved" | "issued";

export type SparesRequestLine = SpareLine & {
  id?: number;
  position?: number;
  asset_id: number | null;
  aircraft_registration: string | null;
  work_order_id: number | null;
  work_order?: { id: number; work_order_number: string | null } | null;
};

export type SparesRequest = {
  id: number;
  request_number: string;
  request_date: string;
  status: SparesRequestStatus;
  unit_id: number | null;
  contract_engineer_name: string | null;
  contract_engineer_date: string | null;
  aviation_engineer_name: string | null;
  aviation_engineer_date: string | null;
  has_contract_engineer_signature: boolean;
  has_aviation_engineer_signature: boolean;
  remarks: string | null;
  lines: SparesRequestLine[];
  lines_count?: number;
  stock_issues?: { id: number; reference: string | null; status: string }[];
  created_at: string;
  updated_at: string;
};

export type SparesRequestUpdate = Partial<{
  request_date: string;
  status: SparesRequestStatus;
  remarks: string | null;
  contract_engineer_name: string | null;
  contract_engineer_date: string | null;
  contract_engineer_signature: string | null;
  aviation_engineer_name: string | null;
  aviation_engineer_date: string | null;
  aviation_engineer_signature: string | null;
  lines: Partial<SparesRequestLine>[];
}>;

// ---- Spares catalog ----

export type CatalogItem = {
  id: number;
  part_number: string;
  alternate_part_number: string | null;
  description: string | null;
  item_type: "spare" | "hardware";
  mm_reference: string | null;
};

// ---- Stores ----

export type StockMatrixRow = {
  part_number: string | null;
  alternate_part_number: string | null;
  description: string | null;
  item_type: "spare" | "hardware";
  quantities: Record<string, number>;
  inventory_ids: Record<string, number>;
  total: number;
  in_catalog: boolean;
};

export type StockMatrix = {
  units: { id: number; name: string }[];
  unit_totals: Record<string, { quantity: number; lines: number }>;
  rows: StockMatrixRow[];
};

export type StockEntry = {
  id: number;
  date: string | null;
  reason: "opening_balance" | "receipt" | "adjustment";
  unit_id: number | null;
  unit_name: string | null;
  inventory_id: number;
  part_number: string | null;
  description: string | null;
  quantity: number;
  note: string | null;
  user: string | null;
};

export type StockEntryPayload = {
  unit_id: number;
  reason: StockEntry["reason"];
  part_number: string;
  description?: string | null;
  item_type?: "spare" | "hardware";
  quantity: number;
  movement_date?: string | null;
  note?: string | null;
};

export type VoucherStatus = "draft" | "pending_approval" | "approved" | "rejected" | "issued" | "received" | "cancelled";

export type VoucherLine = {
  id?: number;
  inventory_id: number | null;
  part_number: string | null;
  description: string | null;
  quantity: number;
  quantity_received?: number | null;
};

export type Voucher = {
  id: number;
  reference: string | null;
  description: string;
  part_number: string | null;
  quantity: number;
  issue_date: string;
  status: VoucherStatus;
  unit_id: number | null;
  receiving_unit_id: number;
  spares_request_id: number | null;
  remarks: string | null;
  authorizing_officer_id: number | null;
  receiving_officer_id: number | null;
  items: VoucherLine[];
  unit?: { id: number; name: string } | null;
  receiving_unit?: { id: number; name: string } | null;
  spares_request?: { id: number; request_number: string; status: string } | null;
  authorizing_officer?: { id: number; firstname: string | null; lastname: string | null; rank?: { name: string } | null } | null;
  receiving_officer?: { id: number; firstname: string | null; lastname: string | null; rank?: { name: string } | null } | null;
  issuer?: { firstname: string | null; lastname: string | null } | null;
  receiver?: { firstname: string | null; lastname: string | null } | null;
  issued_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type VoucherPayload = {
  issue_date: string;
  unit_id?: number | null;
  receiving_unit_id: number;
  spares_request_id?: number | null;
  remarks?: string | null;
  authorizing_officer_id?: number | null;
  receiving_officer_id?: number | null;
  items: { inventory_id?: number | null; part_number?: string | null; description?: string | null; quantity: number }[];
};

// ---- Flight log & documents ----

export type TrackerFlight = {
  id: number;
  asset_id: number;
  flight_date: string;
  hours_flown: number | string;
  landings: number;
  cycles: number;
  engine_starts: number;
  remarks: string | null;
  operation_id: number | null;
};

export type TrackerDocument = {
  id: number;
  title: string | null;
  classification: "open" | "classified";
  module: string | null;
  asset_id: number | null;
  file: string | null;
  file_url?: string;
  file_reference: string | null;
  document_type_id: number | null;
  document_type?: { id: number; name: string } | null;
  issue_date: string | null;
  expiry_date: string | null;
  created_at: string;
  uploaded_by?: { id: number; firstname: string | null; lastname: string | null } | null;
  asset?: { id: number; name: string; tail_number: string | null } | null;
};

const SHEET = (assetId: number) => ({ type: "TrackerSheet" as const, id: assetId });

export const trackerApi = maintenanceApi
  .enhanceEndpoints({
    addTagTypes: ["TrackerOptions", "TrackerSheet", "TrackerFleet", "TrackerLogs", "TrackerWorkOrders", "SparesRequests", "PartCatalog", "TrackerStock", "TrackerVouchers", "TrackerFlights", "TrackerDocuments"],
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      getTrackerOptions: builder.query<TrackerOptions, void>({
        query: () => ({ url: "/maintenance-tracking/options", method: "GET" }),
        providesTags: ["TrackerOptions"],
      }),
      /** Super-admin only (system settings): raise work orders for overdue items automatically, daily. */
      setAutoRaiseWorkOrders: builder.mutation<unknown, boolean>({
        query: (value) => ({ url: "/system-settings", method: "PUT", data: { tracking_auto_raise_work_orders: value } }),
        invalidatesTags: ["TrackerOptions"],
      }),
      getTrackerFleet: builder.query<TrackerFleetRow[], void>({
        query: () => ({ url: "/maintenance-tracking/fleet", method: "GET" }),
        providesTags: ["TrackerFleet"],
      }),
      getTrackerSheet: builder.query<TrackerSheet, { assetId: number; asOf?: string }>({
        query: ({ assetId, asOf }) => ({ url: `/maintenance-tracking/assets/${assetId}`, method: "GET", params: asOf ? { as_of: asOf } : undefined }),
        providesTags: (_r, _e, { assetId }) => [SHEET(assetId)],
      }),
      updateTrackerCounters: builder.mutation<TrackerCounters, { assetId: number } & Partial<Record<"airframe_hours" | "engine_hours" | "engine_starts" | "landings" | "hobbs_hours", number | null>> & { as_of?: string | null }>({
        query: ({ assetId, ...data }) => ({ url: `/maintenance-tracking/assets/${assetId}/counters`, method: "PUT", data }),
        invalidatesTags: (_r, _e, { assetId }) => [SHEET(assetId), "TrackerFleet", "TrackerLogs"],
      }),
      createTrackerItem: builder.mutation<TrackerItem, Partial<TrackerItemFields> & { asset_id: number }>({
        query: (data) => ({ url: "/maintenance-tracking-items", method: "POST", data }),
        invalidatesTags: (_r, _e, { asset_id }) => [SHEET(asset_id), "TrackerFleet"],
      }),
      updateTrackerItem: builder.mutation<TrackerItem, { id: number; assetId: number; data: Partial<TrackerItemFields> }>({
        query: ({ id, data }) => ({ url: `/maintenance-tracking-items/${id}`, method: "PUT", data }),
        invalidatesTags: (_r, _e, { assetId }) => [SHEET(assetId), "TrackerFleet"],
      }),
      deleteTrackerItem: builder.mutation<void, { id: number; assetId: number }>({
        query: ({ id }) => ({ url: `/maintenance-tracking-items/${id}`, method: "DELETE" }),
        invalidatesTags: (_r, _e, { assetId }) => [SHEET(assetId), "TrackerFleet"],
      }),
      recordTrackerCompliance: builder.mutation<{ log: TrackerLog; item: TrackerItem }, { id: number; assetId: number; data: RecordCompliancePayload }>({
        query: ({ id, data }) => ({ url: `/maintenance-tracking-items/${id}/record`, method: "POST", data }),
        invalidatesTags: (_r, _e, { assetId }) => [SHEET(assetId), "TrackerFleet", "TrackerLogs"],
      }),
      raiseTrackerWorkOrder: builder.mutation<Workpack, { id: number; assetId: number }>({
        query: ({ id }) => ({ url: `/maintenance-tracking-items/${id}/work-order`, method: "POST" }),
        invalidatesTags: (_r, _e, { assetId }) => [SHEET(assetId), "TrackerFleet", "TrackerWorkOrders", "WorkOrders"],
      }),
      raiseOverdueWorkOrders: builder.mutation<{ raised: number; work_orders: { id: number; work_order_number: string }[] }, number>({
        query: (assetId) => ({ url: `/maintenance-tracking/assets/${assetId}/raise-overdue`, method: "POST" }),
        invalidatesTags: (_r, _e, assetId) => [SHEET(assetId), "TrackerFleet", "TrackerWorkOrders", "WorkOrders"],
      }),
      copyTrackerItems: builder.mutation<{ copied: number }, { assetId: number; source_asset_id: number; replace?: boolean }>({
        query: ({ assetId, ...data }) => ({ url: `/maintenance-tracking/assets/${assetId}/copy-items`, method: "POST", data }),
        invalidatesTags: (_r, _e, { assetId }) => [SHEET(assetId), "TrackerFleet", "TrackerLogs"],
      }),
      importTrackerItems: builder.mutation<{ imported: number }, { assetId: number; items: Partial<TrackerItemFields>[]; replace?: boolean }>({
        query: ({ assetId, ...data }) => ({ url: `/maintenance-tracking/assets/${assetId}/import-items`, method: "POST", data }),
        invalidatesTags: (_r, _e, { assetId }) => [SHEET(assetId), "TrackerFleet", "TrackerLogs"],
      }),
      importInstalledParts: builder.mutation<{ imported: number }, number>({
        query: (assetId) => ({ url: `/maintenance-tracking/assets/${assetId}/import-installed-parts`, method: "POST" }),
        invalidatesTags: (_r, _e, assetId) => [SHEET(assetId), "TrackerFleet", "TrackerLogs"],
      }),
      getTrackerLogs: builder.query<TrackerLog[], { asset_id?: number } | void>({
        query: (params) => ({ url: "/maintenance-tracking/logs", method: "GET", params: params || undefined }),
        providesTags: ["TrackerLogs"],
      }),

      // Work orders
      getTrackerWorkOrders: builder.query<Workpack[], { asset_id?: number } | void>({
        query: (params) => ({ url: "/work-orders", method: "GET", params: params || undefined }),
        providesTags: ["TrackerWorkOrders"],
      }),
      getWorkpack: builder.query<Workpack, number>({
        query: (id) => ({ url: `/work-orders/${id}`, method: "GET" }),
        providesTags: (_r, _e, id) => [{ type: "TrackerWorkOrders", id }],
      }),
      updateWorkpack: builder.mutation<Workpack, { id: number; data: WorkpackUpdate }>({
        query: ({ id, data }) => ({ url: `/work-orders/${id}`, method: "PUT", data }),
        invalidatesTags: (_r, _e, { id }) => [{ type: "TrackerWorkOrders", id }, "TrackerWorkOrders", "WorkOrders"],
      }),
      closeWorkpack: builder.mutation<Workpack, { id: number; assetId?: number | null; data: WorkpackUpdate }>({
        query: ({ id, data }) => ({ url: `/work-orders/${id}/close`, method: "POST", data }),
        invalidatesTags: (_r, _e, { id, assetId }) => [
          { type: "TrackerWorkOrders", id },
          "TrackerWorkOrders",
          "WorkOrders",
          "TrackerFleet",
          "TrackerLogs",
          ...(assetId ? [SHEET(assetId)] : []),
        ],
      }),
      deleteWorkpack: builder.mutation<void, { id: number; assetId?: number | null }>({
        query: ({ id }) => ({ url: `/work-orders/${id}`, method: "DELETE" }),
        invalidatesTags: (_r, _e, { assetId }) => ["TrackerWorkOrders", "WorkOrders", "TrackerFleet", ...(assetId ? [SHEET(assetId)] : [])],
      }),

      // Spares requests
      getSparesRequests: builder.query<SparesRequest[], { status?: string; asset_id?: number; work_order_id?: number } | void>({
        query: (params) => ({ url: "/spares-requests", method: "GET", params: params || undefined }),
        providesTags: ["SparesRequests"],
      }),
      getSparesRequest: builder.query<SparesRequest, number>({
        query: (id) => ({ url: `/spares-requests/${id}`, method: "GET" }),
        providesTags: (_r, _e, id) => [{ type: "SparesRequests", id }],
      }),
      createSparesRequest: builder.mutation<SparesRequest, SparesRequestUpdate>({
        query: (data) => ({ url: "/spares-requests", method: "POST", data }),
        invalidatesTags: ["SparesRequests"],
      }),
      updateSparesRequest: builder.mutation<SparesRequest, { id: number; data: SparesRequestUpdate }>({
        query: ({ id, data }) => ({ url: `/spares-requests/${id}`, method: "PUT", data }),
        invalidatesTags: (_r, _e, { id }) => [{ type: "SparesRequests", id }, "SparesRequests"],
      }),
      deleteSparesRequest: builder.mutation<void, number>({
        query: (id) => ({ url: `/spares-requests/${id}`, method: "DELETE" }),
        invalidatesTags: ["SparesRequests", "TrackerWorkOrders"],
      }),
      fileSparesRequest: builder.mutation<SparesRequest, { workOrderId: number; target_request_id?: number | null; lines?: SpareLine[] }>({
        query: ({ workOrderId, ...data }) => ({ url: `/work-orders/${workOrderId}/spares-request`, method: "POST", data }),
        invalidatesTags: (_r, _e, { workOrderId }) => ["SparesRequests", { type: "TrackerWorkOrders", id: workOrderId }],
      }),
      issueVoucherFromRequest: builder.mutation<Voucher, { id: number; unit_id: number; receiving_unit_id: number }>({
        query: ({ id, ...data }) => ({ url: `/spares-requests/${id}/issue-voucher`, method: "POST", data }),
        invalidatesTags: (_r, _e, { id }) => [{ type: "SparesRequests", id }, "SparesRequests", "TrackerVouchers"],
      }),

      // Spares catalog
      getPartCatalog: builder.query<CatalogItem[], { q?: string } | void>({
        query: (params) => ({ url: "/part-catalog", method: "GET", params: params || undefined }),
        providesTags: ["PartCatalog"],
      }),
      createCatalogItem: builder.mutation<CatalogItem, Partial<CatalogItem> & { part_number: string }>({
        query: (data) => ({ url: "/part-catalog", method: "POST", data }),
        invalidatesTags: ["PartCatalog"],
      }),
      updateCatalogItem: builder.mutation<CatalogItem, { id: number; data: Partial<CatalogItem> }>({
        query: ({ id, data }) => ({ url: `/part-catalog/${id}`, method: "PUT", data }),
        invalidatesTags: ["PartCatalog"],
      }),
      deleteCatalogItem: builder.mutation<void, number>({
        query: (id) => ({ url: `/part-catalog/${id}`, method: "DELETE" }),
        invalidatesTags: ["PartCatalog"],
      }),
      importCatalog: builder.mutation<{ rows: number; created: number; updated: number }, Partial<CatalogItem>[]>({
        query: (rows) => ({ url: "/part-catalog/import", method: "POST", data: { rows } }),
        invalidatesTags: ["PartCatalog", "TrackerStock"],
      }),

      // Stores
      getStockMatrix: builder.query<StockMatrix, { include_zero?: boolean } | void>({
        query: (params) => ({ url: "/maintenance-tracking/stock", method: "GET", params: params ? { include_zero: params.include_zero ? 1 : 0 } : undefined }),
        providesTags: ["TrackerStock"],
      }),
      getStockEntries: builder.query<StockEntry[], void>({
        query: () => ({ url: "/maintenance-tracking/stock-entries", method: "GET" }),
        providesTags: ["TrackerStock"],
      }),
      createStockEntry: builder.mutation<unknown, StockEntryPayload>({
        query: (data) => ({ url: "/maintenance-tracking/stock-entries", method: "POST", data }),
        invalidatesTags: ["TrackerStock", "PartCatalog"],
      }),
      deleteStockEntry: builder.mutation<void, number>({
        query: (id) => ({ url: `/maintenance-tracking/stock-entries/${id}`, method: "DELETE" }),
        invalidatesTags: ["TrackerStock"],
      }),
      getVouchers: builder.query<Voucher[], void>({
        query: () => ({ url: "/stock-issues", method: "GET" }),
        providesTags: ["TrackerVouchers"],
      }),
      getVoucher: builder.query<Voucher, number>({
        query: (id) => ({ url: `/stock-issues/${id}`, method: "GET" }),
        providesTags: (_r, _e, id) => [{ type: "TrackerVouchers", id }],
      }),
      createVoucher: builder.mutation<Voucher, VoucherPayload>({
        query: (data) => ({ url: "/stock-issues", method: "POST", data }),
        invalidatesTags: ["TrackerVouchers"],
      }),
      updateVoucher: builder.mutation<Voucher, { id: number; data: Partial<VoucherPayload> }>({
        query: ({ id, data }) => ({ url: `/stock-issues/${id}`, method: "PUT", data }),
        invalidatesTags: (_r, _e, { id }) => [{ type: "TrackerVouchers", id }, "TrackerVouchers"],
      }),
      deleteVoucher: builder.mutation<void, number>({
        query: (id) => ({ url: `/stock-issues/${id}`, method: "DELETE" }),
        invalidatesTags: ["TrackerVouchers"],
      }),
      voucherAction: builder.mutation<Voucher, { id: number; action: "issue" | "receive" | "cancel"; reason?: string }>({
        query: ({ id, action, reason }) => ({ url: `/stock-issues/${id}/${action}`, method: "POST", data: reason ? { reason } : {} }),
        invalidatesTags: (_r, _e, { id }) => [{ type: "TrackerVouchers", id }, "TrackerVouchers", "TrackerStock", "SparesRequests"],
      }),

      // Flight log (the same flight-logs records as the aircraft's engineering page)
      getTrackerFlights: builder.query<TrackerFlight[], number>({
        query: (assetId) => ({ url: "/flight-logs", method: "GET", params: { asset_id: assetId } }),
        providesTags: (_r, _e, assetId) => [{ type: "TrackerFlights", id: assetId }],
      }),
      logTrackerFlight: builder.mutation<TrackerFlight, { asset_id: number; flight_date: string; hours_flown: number; landings: number; cycles: number; engine_starts: number; remarks?: string | null }>({
        query: (data) => ({ url: "/flight-logs", method: "POST", data }),
        invalidatesTags: (_r, _e, { asset_id }) => [{ type: "TrackerFlights", id: asset_id }, SHEET(asset_id), "TrackerFleet"],
      }),
      deleteTrackerFlight: builder.mutation<void, { id: number; assetId: number }>({
        query: ({ id }) => ({ url: `/flight-logs/${id}`, method: "DELETE" }),
        invalidatesTags: (_r, _e, { assetId }) => [{ type: "TrackerFlights", id: assetId }, SHEET(assetId), "TrackerFleet"],
      }),

      // Document tab: the Documents module, filed as module=maintenance, classification=open
      getDocumentTypes: builder.query<{ id: number; name: string }[], void>({
        query: () => ({ url: "/document-types", method: "GET" }),
      }),
      getTrackerDocuments: builder.query<TrackerDocument[], void>({
        query: () => ({ url: "/documents", method: "GET", params: { module: "maintenance" } }),
        providesTags: ["TrackerDocuments"],
      }),
      uploadTrackerDocument: builder.mutation<TrackerDocument, FormData>({
        query: (data) => ({ url: "/documents", method: "POST", data }),
        invalidatesTags: ["TrackerDocuments"],
      }),
      deleteTrackerDocument: builder.mutation<void, number>({
        query: (id) => ({ url: `/documents/${id}`, method: "DELETE" }),
        invalidatesTags: ["TrackerDocuments"],
      }),
    }),
  });

export const {
  useGetTrackerOptionsQuery,
  useSetAutoRaiseWorkOrdersMutation,
  useGetTrackerFleetQuery,
  useGetTrackerSheetQuery,
  useUpdateTrackerCountersMutation,
  useCreateTrackerItemMutation,
  useUpdateTrackerItemMutation,
  useDeleteTrackerItemMutation,
  useRecordTrackerComplianceMutation,
  useRaiseTrackerWorkOrderMutation,
  useRaiseOverdueWorkOrdersMutation,
  useCopyTrackerItemsMutation,
  useImportTrackerItemsMutation,
  useImportInstalledPartsMutation,
  useGetTrackerLogsQuery,
  useGetTrackerWorkOrdersQuery,
  useGetWorkpackQuery,
  useUpdateWorkpackMutation,
  useCloseWorkpackMutation,
  useDeleteWorkpackMutation,
  useGetSparesRequestsQuery,
  useGetSparesRequestQuery,
  useCreateSparesRequestMutation,
  useUpdateSparesRequestMutation,
  useDeleteSparesRequestMutation,
  useFileSparesRequestMutation,
  useIssueVoucherFromRequestMutation,
  useGetPartCatalogQuery,
  useCreateCatalogItemMutation,
  useUpdateCatalogItemMutation,
  useDeleteCatalogItemMutation,
  useImportCatalogMutation,
  useGetStockMatrixQuery,
  useGetStockEntriesQuery,
  useCreateStockEntryMutation,
  useDeleteStockEntryMutation,
  useGetVouchersQuery,
  useGetVoucherQuery,
  useCreateVoucherMutation,
  useUpdateVoucherMutation,
  useDeleteVoucherMutation,
  useVoucherActionMutation,
  useGetTrackerFlightsQuery,
  useLogTrackerFlightMutation,
  useDeleteTrackerFlightMutation,
  useGetDocumentTypesQuery,
  useGetTrackerDocumentsQuery,
  useUploadTrackerDocumentMutation,
  useDeleteTrackerDocumentMutation,
} = trackerApi;
