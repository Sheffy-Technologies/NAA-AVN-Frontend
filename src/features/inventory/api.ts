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

export type InventoryStock = {
  id: number;
  inventory_id: number;
  stock_type: string;
  quantity: number;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
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
};

export type CreateInventoryPayload = {
  expense_category_id: number;
  unit_id: number;
  part_number: string;
  part_name: string;
  nsn_number: string | null;
  ata_chapter: string | null;
  re_order_level: number;
  measurement_unit: string;
  expiry_date: string | null;
  quantity: number;
};

export type UpdateInventoryPayload = CreateInventoryPayload;

export type InventoryStockUpdatePayload = {
  inventory_id: number;
  stock_type: "in_stock" | "out_of_stock";
  quantity: number;
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
  }),
});

export const {
  useGetInventoryDashboardQuery,
  useGetExpenseCategoriesQuery,
  useGetInventoriesQuery,
  useGetInventoryByIdQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
  useUpdateInventoryStockMutation,
} = inventoryApi;
