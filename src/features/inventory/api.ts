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

export type InventoryItem = {
  id: number;
  store: "bonded" | "quarantine" | "flammable" | "rubber" | "others";
  type?: string;
  asset_id: number;
  expense_category_id: number;
  unit_id: number;
  serial_number: string;
  part_number: string;
  current_stock: number;
  re_order_level: number;
  unit_cost: string;
  measurement_unit: string;
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
  ata_chapter?: string;
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
};

export type CreateInventoryPayload = {
  store:
    | "bonded"
    | "quarantine"
    | "flammable"
    | "rubber"
    | "others"
    | string;
  asset_id: number | null;
  expense_category_id: number | null;
  unit_id: number | null;
  serial_number: string;
  part_number: string;
  current_stock: number;
  re_order_level: number;
  unit_cost: number;
  measurement_unit: string;
  expiry_date: string | null;
  date_received: string | null;
  remark: string;
  description: string;
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

export const inventoryApi = createApi({
  reducerPath: "inventoryApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getInventoryDashboard: builder.query<InventoryDashboardResponse, void>({
      query: () => ({
        url: "/dashboard/inventories",
        method: "GET",
      }),
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
    }),
    deleteInventory: builder.mutation<void, number | string>({
      query: (id) => ({
        url: `/inventories/${id}`,
        method: "DELETE",
      }),
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
  useGetStockMovementsQuery,
  useCreateStockMovementMutation,
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
} = inventoryApi;
