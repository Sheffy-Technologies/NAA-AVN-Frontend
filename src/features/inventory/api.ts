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
  expense_category_id: number;
  unit_id: number;
  part_number: string;
  part_name: string;
  nsn_number: string;
  ata_chapter: string;
  re_order_level: number;
  measurement_unit: string;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
  current_stock: number;
  stock_level: string;
  expense_category: InventoryExpenseCategory;
  unit: InventoryUnit;
  stocks: InventoryStock[];
};

export type InventoryDashboardResponse = {
  total_stock: number;
  low_stock: number;
  expired_items: number;
  critical_stock: number;
  recent_inventories: InventoryItem[];
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
    getInventories: builder.query<InventoryItem[], void>({
      query: () => ({
        url: "/inventories",
        method: "GET",
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
  useGetInventoriesQuery,
  useGetInventoryByIdQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
  useUpdateInventoryStockMutation,
} = inventoryApi;
