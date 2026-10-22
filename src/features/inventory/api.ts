import type { NewInventoryPayload } from "./newInventoryItem";
import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type InventoryExpenseCategory = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryUnit = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type InventorySupplier = {
  id: number;
  name: string;
  contact?: string | null;
  email?: string | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type InventoryStock = {
  id: number;
  user_id?: number | null;
  inventory_id: number;
  stock_type: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  user?: {
    firstname: string | null;
    lastname: string | null;
  } | null;
};

export type Store = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  is_system: boolean;
  unit_id: number | null;
  unit?: InventoryUnit | null;
  inventories_count?: number;
  total_stock?: number;
  total_value?: number;
  inventories?: InventoryItem[];
  created_at?: string;
  updated_at?: string;
};

export type CreateStorePayload = {
  name: string;
  code?: string | null;
  description?: string | null;
  unit_id?: number | null;
};

export type UpdateStorePayload = {
  name: string;
  code?: string | null;
  description?: string | null;
  unit_id?: number | null;
};

export type InventorySerializedUnit = {
  id?: number;
  inventory_id?: number;
  unit_index?: number;
  serial_number: string;
  cage_code?: string | null;
  part_number?: string | null;
  nsn?: string | null;
  alternate_support_part_no?: string | null;
  status?: string;
  store_id?: number | null;
  unit_id?: number | null;
  installed_asset_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type AtaChapter = {
  id: number;
  code?: string;
  chapter_number?: string;
  chapter_name?: string;
  name?: string;
  description?: string | null;
  maintenance_category?: "engines" | "avionics" | "components" | string | null;
  created_at?: string;
  updated_at?: string;
};

export type InventoryItem = {
  id: number;
  store: "bonded" | "quarantine" | "flammable" | "rubber" | "others" | string;
  store_id?: number | null;
  store_location?: Store | null;
  type?: string;
  asset_id: number | null;
  expense_category_id: number;
  unit_id: number;
  serial_number?: string | null;
  part_number: string;
  cage_code?: string | null;
  nsn?: string | null;
  alternate_support_part_no?: string | null;
  batch_number?: string | null;
  lot_number?: string | null;
  calibration_due_date?: string | null;
  calibration_interval_days?: number | null;
  ata_chapter?: string | null;
  ata_chapter_id?: number | null;
  ata_chapter_rel?: AtaChapter | null;
  current_stock: number;
  re_order_level: number;
  unit_cost: string | number;
  measurement_unit: string;
  unit_of_issue?: string | null;
  lead_time_days?: number | null;
  lead_time_unit?: string | null;
  manufacturer?: string | null;
  supplier_id?: number | null;
  supplier?: InventorySupplier | null;
  special_storage?: string | null;
  currency_id?: number | null;
  currency_code?: string | null;
  currency?: ProcurementCurrency | null;
  is_serialized?: boolean;
  shelf_life_types?: string[] | null;
  shelf_life_hours?: number | null;
  shelf_life_cycles?: number | null;
  shelf_life_calendar_interval?: string | null;
  shelf_life_calendar_value?: number | null;
  shelf_life_start_date?: string | null;
  life_limit_types?: string[] | null;
  life_limit_hours?: number | null;
  life_limit_cycles?: number | null;
  life_limit_calendar_interval?: string | null;
  life_limit_calendar_value?: number | null;
  units?: InventorySerializedUnit[];
  expiry_date: string | null;
  date_received: string | null;
  remark: string;
  description: string;
  created_at: string;
  updated_at: string;
  stock_level: string;
  expense_category: InventoryExpenseCategory;
  unit: InventoryUnit;
  stocks: InventoryStock[];
  // Legacy fields that might still be needed or can be removed if verified
  part_name?: string;
  nsn_number?: string;
};

export type InventoryDashboardResponse = {
  total_stock: number;
  low_stock: number;
  expired_items: number;
  critical_stock: number;
};

export type InventoryFilters = {
  units?: number[];
  categories?: number[];
  aircraft_types?: number[];
  type?: string;
  unit_id?: number;
  store_id?: number | string;
};

export type CreateInventoryPayload = {
  store:
    | "bonded"
    | "quarantine"
    | "flammable"
    | "rubber"
    | "others"
    | string;
  store_id?: number | null;
  asset_id?: number | null;
  expense_category_id?: number | null;
  unit_id?: number | null;
  serial_number?: string | null;
  part_number: string;
  cage_code?: string | null;
  nsn?: string | null;
  alternate_support_part_no?: string | null;
  batch_number?: string | null;
  lot_number?: string | null;
  calibration_due_date?: string | null;
  calibration_interval_days?: number | null;
  ata_chapter?: string | null;
  ata_chapter_id?: number | null;
  current_stock: number;
  re_order_level?: number;
  unit_cost: number;
  measurement_unit?: string;
  unit_of_issue?: string | null;
  lead_time_days?: number | null;
  lead_time_unit?: string | null;
  manufacturer?: string | null;
  supplier_id?: number | null;
  special_storage?: string | null;
  currency_id?: number | null;
  currency_code?: string | null;
  is_serialized?: boolean;
  shelf_life_types?: string[] | null;
  shelf_life_hours?: number | null;
  shelf_life_cycles?: number | null;
  shelf_life_calendar_interval?: string | null;
  shelf_life_calendar_value?: number | null;
  shelf_life_start_date?: string | null;
  life_limit_types?: string[] | null;
  life_limit_hours?: number | null;
  life_limit_cycles?: number | null;
  life_limit_calendar_interval?: string | null;
  life_limit_calendar_value?: number | null;
  units?: InventorySerializedUnit[];
  expiry_date?: string | null;
  date_received?: string | null;
  remark?: string;
  description?: string;
};

export type UpdateInventoryPayload = CreateInventoryPayload;

export type ProcurementBudget = {
  id: number;
  name: string;
  currency_id?: number | null;
};

export type ProcurementCurrency = {
  id: number;
  code: string;
  name: string;
  symbol?: string | null;
};
export type CreateSupplierPayload = {
  name: string;
  contact?: string | null;
  email?: string | null;
  address?: string | null;
};

export type InventoryStockUpdatePayload = {
  inventory_id: number;
  stock_type: "in_stock" | "out_of_stock";
  quantity: number;
};

export type InventoryRequisitionStatus =
  | "approved"
  | "under_review"
  | "rejected"
  | "received"
  | "pending";

export type InventoryRequisitionRequester = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
  phone_number?: string | null;
};

export type InventoryRequisition = {
  id: number;
  requesting_unit_id: number | null;
  user_id?: number | null;
  total_cost: number | string | null;
  status: InventoryRequisitionStatus | string;
  created_at: string;
  updated_at: string;
  requesting_unit?: InventoryUnit;
  requested_by?: InventoryRequisitionRequester | null;
  last_updated_by?: { id: number; name: string } | string | null;
};

export type InventoryRequisitionFilters = {
  period?: "all" | "month" | "quarter" | "year";
  unit_id?: number;
};

export type CreateInventoryRequisitionItem = {
  inventory_id: number;
  quantity: number;
};

export type CreateInventoryRequisitionPayload = {
  requesting_unit_id?: number | null;
  items: CreateInventoryRequisitionItem[];
};

export type InventoryRequisitionLine = {
  id: number;
  inventory_id: number;
  requested_quantity: number | null;
  approved_quantity: number | null;
  available_quantity: number | null;
  approved_cost: number | string | null;
  unit_cost: number | string | null;
  inventory?: InventoryItem;
};

export type InventoryRequisitionDetail = InventoryRequisition & {
  remark?: string | null;
  items?: InventoryRequisitionLine[];
};

export type UpdateInventoryRequisitionPayload = {
  status?: "pending" | "under_review" | "approved" | "rejected" | "received" | string;
  remark?: string | null;
  items?: Array<{
    id?: number;
    inventory_id: number;
    approved_quantity: number;
  }>;
};

export type PurchaseOrderItem = {
  id: number;
  purchase_order_id?: number;
  inventory_id: number;
  part_number?: string | null;
  quantity_ordered?: number | null;
  quantity_received?: number | null;
  unit_price?: number | string | null;
  created_at?: string;
  updated_at?: string;
  inventory?: InventoryItem;
};

export type PurchaseOrder = {
  id: number;
  supplier_id?: number | null;
  budget_id?: number | null;
  currency_id?: number | null;
  rfq_id?: number | null;
  name?: string | null;
  order_date?: string | null;
  expected_date_of_delivery?: string | null;
  status?: "draft" | "sent" | "received" | string | null;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseOrderItem[];
  supplier?: InventorySupplier | null;
  budget?: ProcurementBudget | null;
  currency?: ProcurementCurrency | null;
};

export type UpdatePurchaseOrderPayload = {
  supplier_id?: number | null;
  budget_id?: number | null;
  currency_id?: number | null;
  rfq_id?: number | null;
  name?: string | null;
  order_date?: string | null;
  expected_date_of_delivery?: string | null;
  status?: "draft" | "sent" | "received";
  items?: Array<{
    inventory_id: number;
    part_number?: string | null;
    quantity_ordered?: number;
    quantity_received?: number | null;
    unit_price?: number | null;
  }>;
};

export type CreatePurchaseOrderPayload = {
  supplier_id?: number | null;
  budget_id?: number | null;
  currency_id?: number | null;
  rfq_id?: number | null;
  name?: string | null;
  order_date?: string | null;
  expected_date_of_delivery?: string | null;
  status?: "draft" | "sent" | "received";
  items: Array<{
    inventory_id?: number;
    new_inventory?: NewInventoryPayload;
    part_number?: string | null;
    quantity_ordered?: number;
    quantity_received?: number | null;
    unit_price?: number | null;
  }>;
};

export type StockMovementLine = {
  id?: number;
  inventory_id?: number | null;
  spare_id?: number | null;
  quantity_requested: number;
  quantity_approved?: number | null;
  inventory?: InventoryItem;
};

export type StockMovement = {
  id: number;
  quantity: number;
  movement_type: "issue" | "receipt";
  work_order_id?: number | null;
  requesting_unit_id?: number | null;
  performed_by?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  stocks?: StockMovementLine[];
  requesting_unit?: { id?: number; name?: string; unit_name?: string } | null;
  work_order?: { id?: number; work_order_number?: string; title?: string } | null;
};

export type CreateStockMovementPayload = {
  quantity: number;
  movement_type: "issue" | "receipt";
  work_order_id?: number | null;
  requesting_unit_id?: number | null;
  performed_by?: number | null;
  notes?: string | null;
  stocks: Array<{
    inventory_id?: number | null;
    spare_id?: number | null;
    quantity_requested: number;
    quantity_approved?: number | null;
  }>;
};

export type SupplierQuotation = {
  id: number;
  rfq_id: number;
  supplier_id: number;
  quotation_number?: string | null;
  total_amount?: number | string | null;
  currency?: string | null;
  valid_until?: string | null;
  status?: "submitted" | "approved" | "rejected" | string;
  notes?: string | null;
  quoted_at?: string | null;
  supplier?: InventorySupplier;
};

export type Rfq = {
  id: number;
  stock_movement_id: number;
  rfq_number: string;
  requested_by?: number | null;
  requester?: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  status?: "draft" | "sent" | "closed" | "cancelled" | string;
  notes?: string | null;
  issued_at?: string | null;
  suppliers?: InventorySupplier[];
  quotations?: SupplierQuotation[];
  stock_movement?: StockMovement;
};

export type CreateRfqPayload = {
  stock_movement_id: number;
  rfq_number?: string;
  status?: "draft" | "sent" | "closed" | "cancelled";
  notes?: string | null;
  issued_at?: string | null;
  supplier_ids: number[];
};

export type CreateSupplierQuotationPayload = {
  rfq_id: number;
  supplier_id: number;
  quotation_number?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  valid_until?: string | null;
  status?: "submitted" | "approved" | "rejected";
  notes?: string | null;
  quoted_at?: string | null;
};

export type GoodsReceivedNoteItem = {
  id: number;
  purchase_order_item_id?: number | null;
  inventory_id: number;
  quantity_received: number;
  batch_number?: string | null;
};

export type GoodsReceivedNote = {
  id: number;
  purchase_order_id: number;
  grn_number: string;
  received_by?: number | null;
  received_at?: string | null;
  notes?: string | null;
  items?: GoodsReceivedNoteItem[];
  receiver?: { id?: number; name?: string } | null;
  purchase_order?: PurchaseOrder | null;
};

export type CreateGoodsReceivedNotePayload = {
  purchase_order_id: number;
  grn_number?: string;
  received_at?: string | null;
  notes?: string | null;
  items: Array<{
    purchase_order_item_id?: number | null;
    inventory_id: number;
    quantity_received: number;
    batch_number?: string | null;
  }>;
};

export type ShipmentStatus = "picked_up" | "customs_clearance" | "in_transit" | "delivered";

export type ShipmentCheckpoint = {
  id: number;
  shipment_id: number;
  checkpoint_time?: string | null;
  status_stage: ShipmentStatus;
  location?: string | null;
  description?: string | null;
  substatus?: string | null;
  raw_data?: unknown;
  logged_by_user_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type Shipment = {
  id: number;
  purchase_order_id: number;
  tracking_number: string;
  carrier_code?: string | null;
  carrier_name?: string | null;
  status: ShipmentStatus;
  origin?: string | null;
  destination?: string | null;
  latest_event_description?: string | null;
  estimated_delivery_date?: string | null;
  customs_reference?: string | null;
  customs_notes?: string | null;
  notes?: string | null;
  tracking_more_id?: string | null;
  raw_payload?: unknown;
  picked_up_at?: string | null;
  customs_cleared_at?: string | null;
  in_transit_at?: string | null;
  delivered_at?: string | null;
  created_by_user_id?: number | null;
  created_at?: string;
  updated_at?: string;
  checkpoints?: ShipmentCheckpoint[];
  purchase_order?: PurchaseOrder;
  created_by?: { id: number; name: string; email?: string } | null;
};

export type CreateShipmentPayload = {
  purchase_order_id: number;
  tracking_number: string;
  carrier_code?: string;
  carrier_name?: string;
  origin?: string;
  destination?: string;
  estimated_delivery_date?: string;
  customs_reference?: string;
  customs_notes?: string;
  notes?: string;
  status?: ShipmentStatus;
};

export type UpdateShipmentStatusPayload = {
  id: number;
  status: ShipmentStatus;
  location?: string;
  description?: string;
  customs_reference?: string;
  customs_notes?: string;
};

export const inventoryApi = createApi({
  reducerPath: "inventoryApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Inventories", "Stores", "Currencies", "AtaChapters", "Shipments"],
  endpoints: (builder) => ({
    getInventoryDashboard: builder.query<InventoryDashboardResponse, void>({
      query: () => ({
        url: "/dashboard/inventories",
        method: "GET",
      }),
      providesTags: ["Inventories"],
    }),
    getExpenseCategories: builder.query<InventoryExpenseCategory[], void>({
      query: () => ({
        url: "/expense-categories",
        method: "GET",
      }),
    }),
    getSuppliers: builder.query<InventorySupplier[], void>({
      query: () => ({
        url: "/suppliers",
        method: "GET",
      }),
    }),
    createSupplier: builder.mutation<InventorySupplier, CreateSupplierPayload>({
      query: (body) => ({
        url: "/suppliers",
        method: "POST",
        data: body,
      }),
    }),
    getInventories: builder.query<InventoryItem[], InventoryFilters | void>({
      query: (params) => ({
        url: "/inventories",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: ["Inventories"],
    }),
    getInventoryById: builder.query<InventoryItem, number | string>({
      query: (id) => ({
        url: `/inventories/${id}`,
        method: "GET",
      }),
    }),
    createInventory: builder.mutation<InventoryItem, CreateInventoryPayload>({
      query: (body) => ({
        url: "/inventories",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Inventories", "Stores"],
    }),
    updateInventory: builder.mutation<
      InventoryItem,
      { id: number | string; body: UpdateInventoryPayload }
    >({
      query: ({ id, body }) => ({
        url: `/inventories/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: ["Inventories", "Stores"],
    }),
    deleteInventory: builder.mutation<void, number | string>({
      query: (id) => ({
        url: `/inventories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Inventories", "Stores"],
    }),
    updateInventoryStock: builder.mutation<
      unknown,
      InventoryStockUpdatePayload
    >({
      query: (body) => ({
        url: "/inventory-stocks",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Inventories", "Stores"],
    }),
    getInventoryRequisitions: builder.query<
      InventoryRequisition[],
      InventoryRequisitionFilters | void
    >({
      query: (params) => ({
        url: "/inventory-requisitions",
        method: "GET",
        params: params || undefined,
      }),
    }),
    createInventoryRequisition: builder.mutation<
      InventoryRequisition,
      CreateInventoryRequisitionPayload
    >({
      query: (body) => ({
        url: "/inventory-requisitions",
        method: "POST",
        data: body,
      }),
    }),
    getInventoryRequisitionById: builder.query<
      InventoryRequisitionDetail,
      number | string
    >({
      query: (id) => ({
        url: `/inventory-requisitions/${id}`,
        method: "GET",
      }),
    }),
    updateInventoryRequisition: builder.mutation<
      InventoryRequisitionDetail,
      { id: number | string; body: UpdateInventoryRequisitionPayload }
    >({
      query: ({ id, body }) => ({
        url: `/inventory-requisitions/${id}`,
        method: "PUT",
        data: body,
      }),
    }),
    getPurchaseOrders: builder.query<PurchaseOrder[], void>({
      query: () => ({
        url: "/purchase-orders",
        method: "GET",
      }),
    }),
    getBudgets: builder.query<ProcurementBudget[], void>({
      query: () => ({
        url: "/budgets",
        method: "GET",
      }),
    }),
    getCurrencies: builder.query<ProcurementCurrency[], void>({
      query: () => ({
        url: "/currencies",
        method: "GET",
      }),
    }),
    getStockMovements: builder.query<StockMovement[], void>({
      query: () => ({
        url: "/stock-movements",
        method: "GET",
      }),
    }),
    createStockMovement: builder.mutation<StockMovement, CreateStockMovementPayload>({
      query: (body) => ({
        url: "/stock-movements",
        method: "POST",
        data: body,
      }),
    }),
    // Issues stock out of the store to the requisition's unit. The backend
    // deducts store stock and records the issued quantity in one transaction.
    issueStockMovement: builder.mutation<
      StockMovement,
      { id: number; items: Array<{ stock_movement_stock_id: number; quantity: number }> }
    >({
      query: ({ id, items }) => ({
        url: `/stock-movements/${id}/issue`,
        method: "POST",
        data: { items },
      }),
    }),
    getRfqs: builder.query<Rfq[], void>({
      query: () => ({
        url: "/rfqs",
        method: "GET",
      }),
    }),
    getRfqById: builder.query<Rfq, number | string>({
      query: (id) => ({
        url: `/rfqs/${id}`,
        method: "GET",
      }),
    }),
    createRfq: builder.mutation<Rfq, CreateRfqPayload>({
      query: (body) => ({
        url: "/rfqs",
        method: "POST",
        data: body,
      }),
    }),
    updateRfq: builder.mutation<Rfq, { id: number | string; body: Partial<CreateRfqPayload> }>({
      query: ({ id, body }) => ({
        url: `/rfqs/${id}`,
        method: "PUT",
        data: body,
      }),
    }),
    getSupplierQuotations: builder.query<SupplierQuotation[], { rfq_id?: number } | void>({
      query: (params) => ({
        url: "/supplier-quotations",
        method: "GET",
        params: params || undefined,
      }),
    }),
    createSupplierQuotation: builder.mutation<SupplierQuotation, CreateSupplierQuotationPayload>({
      query: (body) => ({
        url: "/supplier-quotations",
        method: "POST",
        data: body,
      }),
    }),
    approveSupplierQuotation: builder.mutation<SupplierQuotation, number | string>({
      query: (id) => ({
        url: `/supplier-quotations/${id}/approve`,
        method: "PUT",
      }),
    }),
    getPurchaseOrderById: builder.query<PurchaseOrder, number | string>({
      query: (id) => ({
        url: `/purchase-orders/${id}`,
        method: "GET",
      }),
    }),
    createPurchaseOrder: builder.mutation<PurchaseOrder, CreatePurchaseOrderPayload>({
      query: (body) => ({
        url: "/purchase-orders",
        method: "POST",
        data: body,
      }),
    }),
    updatePurchaseOrder: builder.mutation<
      PurchaseOrder,
      { id: number | string; body: UpdatePurchaseOrderPayload }
    >({
      query: ({ id, body }) => ({
        url: `/purchase-orders/${id}`,
        method: "PUT",
        data: body,
      }),
    }),
    sendPurchaseOrder: builder.mutation<PurchaseOrder, number | string>({
      query: (id) => ({
        url: `/purchase-orders/${id}/send`,
        method: "POST",
      }),
    }),
    getGoodsReceivedNotes: builder.query<GoodsReceivedNote[], void>({
      query: () => ({
        url: "/goods-received-notes",
        method: "GET",
      }),
    }),
    createGoodsReceivedNote: builder.mutation<
      GoodsReceivedNote,
      CreateGoodsReceivedNotePayload
    >({
      query: (body) => ({
        url: "/goods-received-notes",
        method: "POST",
        data: body,
      }),
    }),
    getStores: builder.query<Store[], void>({
      query: () => ({
        url: "/stores",
        method: "GET",
      }),
      providesTags: ["Stores"],
    }),
    getStoreById: builder.query<Store, number | string>({
      query: (id) => ({
        url: `/stores/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Stores", id }],
    }),
    createStore: builder.mutation<Store, CreateStorePayload>({
      query: (body) => ({
        url: "/stores",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Stores"],
    }),
    updateStore: builder.mutation<Store, { id: number | string; body: UpdateStorePayload }>({
      query: ({ id, body }) => ({
        url: `/stores/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: ["Stores"],
    }),
    deleteStore: builder.mutation<void, number | string>({
      query: (id) => ({
        url: `/stores/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Stores"],
    }),
    getAtaChapters: builder.query<AtaChapter[], void>({
      query: () => ({
        url: "/ata-chapters",
        method: "GET",
      }),
      providesTags: ["AtaChapters"],
    }),
    getShipments: builder.query<
      Shipment[],
      { purchase_order_id?: number | string; status?: string; search?: string } | void
    >({
      query: (params) => ({
        url: "/shipments",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: ["Shipments"],
    }),
    getShipmentById: builder.query<Shipment, number | string>({
      query: (id) => ({
        url: `/shipments/${id}`,
        method: "GET",
      }),
      providesTags: ["Shipments"],
    }),
    getPurchaseOrderShipments: builder.query<Shipment[], number | string>({
      query: (poId) => ({
        url: `/purchase-orders/${poId}/shipments`,
        method: "GET",
      }),
      providesTags: ["Shipments"],
    }),
    createShipment: builder.mutation<Shipment, CreateShipmentPayload>({
      query: (body) => ({
        url: "/shipments",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Shipments"],
    }),
    syncShipmentLive: builder.mutation<{ message: string; shipment: Shipment }, number | string>({
      query: (id) => ({
        url: `/shipments/${id}/sync`,
        method: "POST",
      }),
      invalidatesTags: ["Shipments"],
    }),
    updateShipmentStatus: builder.mutation<Shipment, UpdateShipmentStatusPayload>({
      query: ({ id, ...body }) => ({
        url: `/shipments/${id}/status`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: ["Shipments"],
    }),
  }),
});

export const {
  useGetInventoryDashboardQuery,
  useGetExpenseCategoriesQuery,
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useGetInventoriesQuery,
  useGetInventoryByIdQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
  useDeleteInventoryMutation,
  useUpdateInventoryStockMutation,
  useGetInventoryRequisitionsQuery,
  useCreateInventoryRequisitionMutation,
  useGetInventoryRequisitionByIdQuery,
  useUpdateInventoryRequisitionMutation,
  useGetPurchaseOrdersQuery,
  useGetBudgetsQuery,
  useGetCurrenciesQuery,
  useGetAtaChaptersQuery,
  useGetStockMovementsQuery,
  useCreateStockMovementMutation,
  useIssueStockMovementMutation,
  useGetRfqsQuery,
  useGetRfqByIdQuery,
  useCreateRfqMutation,
  useUpdateRfqMutation,
  useGetSupplierQuotationsQuery,
  useCreateSupplierQuotationMutation,
  useApproveSupplierQuotationMutation,
  useGetPurchaseOrderByIdQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useSendPurchaseOrderMutation,
  useGetGoodsReceivedNotesQuery,
  useCreateGoodsReceivedNoteMutation,
  useGetStoresQuery,
  useGetStoreByIdQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useDeleteStoreMutation,
  useGetShipmentsQuery,
  useGetShipmentByIdQuery,
  useGetPurchaseOrderShipmentsQuery,
  useCreateShipmentMutation,
  useSyncShipmentLiveMutation,
  useUpdateShipmentStatusMutation,
} = inventoryApi;
