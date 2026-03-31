import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type FinanceDashboardResponse = {
  total_expense: number;
  current_month_expense: number;
  current_quarter_expense: number;
  sum_amount: number;
  budget: number;
};

export type FinanceExpenseCategory = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceBudgetCategory = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceExpenseType = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceAircraft = {
  id: number;
  name: string;
  tail_number: string;
  type: string;
  model: string;
  serial_number: string;
  configuration: string | null;
  serviceability_status: string;
  total_flight_hours: string;
  created_at: string;
  updated_at: string;
};

export type FinanceUnit = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceBudget = {
  id: number;
  budget_category_id?: number;
  expense_category_id?: number;
  aircraft_id: number;
  unit_id: number;
  name: string;
  amount: number;
  start_date: string;
  end_date: string;
  description: string;
  created_at: string;
  updated_at: string;
  budget_category?: FinanceBudgetCategory;
  expense_category?: FinanceExpenseCategory;
  aircraft: FinanceAircraft;
  unit: FinanceUnit;
};

export type FinanceExpense = {
  id: number;
  expense_category_id: number;
  expense_type_id: number;
  aircraft_id: number;
  unit_id: number;
  budget_id: number;
  part_number: string;
  part_name: string;
  work_order: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
  expense_category: FinanceExpenseCategory;
  expense_type: FinanceExpenseType;
  aircraft: FinanceAircraft;
  unit: FinanceUnit;
  budget: FinanceBudget;
};

export type CreateExpensePayload = {
  expense_category_id: number;
  expense_type_id: number;
  aircraft_id: number;
  unit_id: number;
  budget_id: number;
  part_number: string;
  part_name: string;
  work_order: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
};

export type CreateBudgetPayload = {
  name: string;
  budget_category_id: number;
  amount: number;
  start_date: string;
  end_date: string;
  unit_id: number;
};

export const financeApi = createApi({
  reducerPath: "financeApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getFinanceDashboard: builder.query<FinanceDashboardResponse, void>({
      query: () => ({
        url: "/dashboard/finance",
        method: "GET",
      }),
    }),
    getExpenses: builder.query<FinanceExpense[], void>({
      query: () => ({
        url: "/expenses",
        method: "GET",
      }),
    }),
    createExpense: builder.mutation<FinanceExpense, CreateExpensePayload>({
      query: (body) => ({
        url: "/expenses",
        method: "POST",
        data: body,
      }),
    }),
    createBudget: builder.mutation<FinanceBudget, CreateBudgetPayload>({
      query: (body) => ({
        url: "/budgets",
        method: "POST",
        data: body,
      }),
    }),
    getBudgets: builder.query<FinanceBudget[], void>({
      query: () => ({
        url: "/budgets",
        method: "GET",
      }),
    }),
    getExpenseCategories: builder.query<FinanceExpenseCategory[], void>({
      query: () => ({
        url: "/expense-categories",
        method: "GET",
      }),
    }),
    getBudgetCategories: builder.query<FinanceBudgetCategory[], void>({
      query: () => ({
        url: "/budget-categories",
        method: "GET",
      }),
    }),
    getExpenseTypes: builder.query<FinanceExpenseType[], void>({
      query: () => ({
        url: "/expense-types",
        method: "GET",
      }),
    }),
    getAircraft: builder.query<FinanceAircraft[], void>({
      query: () => ({
        url: "/aircraft",
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetFinanceDashboardQuery,
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useCreateBudgetMutation,
  useGetBudgetsQuery,
  useGetExpenseCategoriesQuery,
  useGetBudgetCategoriesQuery,
  useGetExpenseTypesQuery,
  useGetAircraftQuery,
} = financeApi;
