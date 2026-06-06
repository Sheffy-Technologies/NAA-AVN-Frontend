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

export type FinanceCurrency = {
  id: number;
  code: string;
  name: string;
  symbol: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceBudget = {
  id: number;
  budget_category_id?: number;
  expense_category_id?: number;
  currency_id?: number | null;
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
  currency?: FinanceCurrency | null;
  aircraft: FinanceAircraft;
  unit: FinanceUnit;
  total_expense?: number | string;
  total_income?: number | string;
  remaining_amount?: number | string;
  utilization?: number | string;
  status?: string;
};

export type FinanceBudgetIncome = {
  id: number;
  budget_id: number;
  source: string;
  reference: string | null;
  description: string | null;
  amount: number | string;
  received_at: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type CreateBudgetIncomePayload = {
  budget_id: number;
  source: string;
  reference?: string | null;
  description?: string | null;
  amount: number;
  received_at: string;
};

export type BudgetStatementResponse = {
  budget: FinanceBudget;
  incomes: FinanceBudgetIncome[];
  expenses: FinanceExpense[];
  totals: {
    allocated: number;
    total_income: number;
    total_expense: number;
    available: number;
  };
  generated_at: string;
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
  date?: string | null;
  created_at: string;
  updated_at: string;
  expense_category: FinanceExpenseCategory;
  expense_type: FinanceExpenseType;
  aircraft: FinanceAircraft;
  unit: FinanceUnit;
  budget: FinanceBudget;
};

export type CreateExpensePayload = {
  expense_category_id?: number;
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
  date?: string;
};

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

export type CreateBudgetPayload = {
  name: string;
  budget_category_id: number;
  currency_id: number;
  amount: number;
  start_date: string;
  end_date: string;
  unit_id: number;
};

export const financeApi = createApi({
  reducerPath: "financeApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Expenses", "Budgets", "BudgetIncomes"],
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
      providesTags: [{ type: "Expenses", id: "LIST" }],
    }),
    createExpense: builder.mutation<FinanceExpense, CreateExpensePayload>({
      query: (body) => ({
        url: "/expenses",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Expenses", id: "LIST" }],
    }),
    updateExpense: builder.mutation<
      FinanceExpense,
      { id: number; body: UpdateExpensePayload }
    >({
      query: ({ id, body }) => ({
        url: `/expenses/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Expenses", id: "LIST" },
        { type: "Expenses", id: arg.id },
      ],
    }),
    deleteExpense: builder.mutation<void, number>({
      query: (id) => ({
        url: `/expenses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Expenses", id: "LIST" }],
    }),
    createBudget: builder.mutation<FinanceBudget, CreateBudgetPayload>({
      query: (body) => ({
        url: "/budgets",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Budgets", id: "LIST" }],
    }),
    deleteBudget: builder.mutation<void, number>({
      query: (id) => ({
        url: `/budgets/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Budgets", id: "LIST" }],
    }),
    getBudgets: builder.query<FinanceBudget[], void>({
      query: () => ({
        url: "/budgets",
        method: "GET",
      }),
      providesTags: [{ type: "Budgets", id: "LIST" }],
    }),
    getBudgetById: builder.query<FinanceBudget, number | string>({
      query: (id) => ({
        url: `/budgets/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Budgets", id }],
    }),
    getBudgetStatement: builder.query<BudgetStatementResponse, number | string>({
      query: (id) => ({
        url: `/budgets/${id}/statement`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [
        { type: "Budgets", id },
        { type: "BudgetIncomes", id: "LIST" },
        { type: "Expenses", id: "LIST" },
      ],
    }),
    getBudgetIncomes: builder.query<
      FinanceBudgetIncome[],
      { budget_id?: number } | void
    >({
      query: (arg) => ({
        url: "/budget-incomes",
        method: "GET",
        params: arg && arg.budget_id ? { budget_id: arg.budget_id } : undefined,
      }),
      providesTags: [{ type: "BudgetIncomes", id: "LIST" }],
    }),
    createBudgetIncome: builder.mutation<
      FinanceBudgetIncome,
      CreateBudgetIncomePayload
    >({
      query: (body) => ({
        url: "/budget-incomes",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "BudgetIncomes", id: "LIST" },
        { type: "Budgets", id: arg.budget_id },
        { type: "Budgets", id: "LIST" },
      ],
    }),
    deleteBudgetIncome: builder.mutation<void, number>({
      query: (id) => ({
        url: `/budget-incomes/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "BudgetIncomes", id: "LIST" },
        { type: "Budgets", id: "LIST" },
      ],
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
    getCurrencies: builder.query<FinanceCurrency[], void>({
      query: () => ({
        url: "/currencies",
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
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useCreateBudgetMutation,
  useDeleteBudgetMutation,
  useGetBudgetsQuery,
  useGetBudgetByIdQuery,
  useGetBudgetStatementQuery,
  useGetBudgetIncomesQuery,
  useCreateBudgetIncomeMutation,
  useDeleteBudgetIncomeMutation,
  useGetExpenseCategoriesQuery,
  useGetBudgetCategoriesQuery,
  useGetCurrenciesQuery,
  useGetExpenseTypesQuery,
  useGetAircraftQuery,
} = financeApi;
