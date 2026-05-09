import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type ReportForeignKey = {
  column: string;
  foreign_table: string;
  foreign_column: string;
};

export type ReportResource = {
  model: string;
  model_class: string;
  table: string;
  columns?: string[];
  relations?: string[];
  foreign_keys?: ReportForeignKey[];
};

export type ReportFilterOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "like"
  | "in"
  | "not_in"
  | "between"
  | "null"
  | "not_null";

export type ReportFilter = {
  field: string;
  operator: ReportFilterOperator;
  value?: string | string[];
};

export type ReportQueryArgs = {
  model?: string;
  table?: string;
  include?: string[];
  select?: string[];
  search?: string;
  search_columns?: string[];
  filters?: ReportFilter[];
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  per_page?: number;
  page?: number;
};

export type PaginatedReportRows = {
  current_page: number;
  data: Array<Record<string, unknown>>;
  first_page_url?: string | null;
  from?: number | null;
  last_page: number;
  last_page_url?: string | null;
  next_page_url?: string | null;
  path?: string;
  per_page: number;
  prev_page_url?: string | null;
  to?: number | null;
  total: number;
};

export type ReportQueryResponse = {
  table: string;
  model: string;
  data: PaginatedReportRows;
};

export type ReportLookupOption = {
  value: string | number | null;
  label: string;
};

export type ReportLookupResponse = {
  table: string;
  value_column: string;
  label_column: string | null;
  data: ReportLookupOption[];
};

export type ReportLookupArgs = {
  table: string;
  search?: string;
  per_page?: number;
  value_column?: string;
  label_column?: string;
};

export const reportsApi = createApi({
  reducerPath: "reportsApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getReportResources: builder.query<ReportResource[], void>({
      query: () => ({
        url: "/reports/resources",
        method: "GET",
      }),
      transformResponse: (response: { data?: ReportResource[] } | ReportResource[]) => {
        if (Array.isArray(response)) return response;
        return response.data ?? [];
      },
    }),
    runReportQuery: builder.query<ReportQueryResponse, ReportQueryArgs>({
      query: (body) => ({
        url: "/reports/query",
        method: "POST",
        data: body,
      }),
    }),
    getReportLookup: builder.query<ReportLookupResponse, ReportLookupArgs>({
      query: (params) => ({
        url: "/reports/lookup",
        method: "GET",
        params,
      }),
    }),
  }),
});

export const {
  useGetReportResourcesQuery,
  useRunReportQueryQuery,
  useGetReportLookupQuery,
} = reportsApi;
