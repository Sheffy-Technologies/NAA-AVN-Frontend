import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

/**
 * Visitor Management: read-only data from the external NAAC VMS, proxied and
 * cached by the backend (VmsController / VmsClient). Everything needs `vms.view`.
 */

export type VisitStatus = "pending" | "approved" | "checked_in" | "checked_out" | "rejected";

export const VISIT_STATUSES: { value: VisitStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "checked_in", label: "Checked in" },
  { value: "checked_out", label: "Checked out" },
  { value: "rejected", label: "Rejected" },
];

export type BadgeStatus =
  | "Pending"
  | "Active"
  | "Returned"
  | "Expired"
  | "Cancelled"
  | "Lost"
  | "Damaged"
  | "Revoked";

export type VmsBadge = { badge_number: string | null; badge_status: BadgeStatus };

export type VmsPagination = { page: number; limit: number; total: number; total_pages: number };

export type VmsVisit = {
  id: string;
  purpose: string | null;
  status: VisitStatus;
  scheduled_date: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  created_at: string;
  updated_at: string;
  visitor: { full_name: string; visitor_organization: string | null } | null;
  employee: { full_name: string; department: string | null } | null;
  badges: VmsBadge[];
};

export type VmsVisitor = {
  id: string;
  full_name: string;
  visitor_organization: string | null;
  created_at: string;
  updated_at: string;
};

export type VmsVisitorDetails = VmsVisitor & {
  visits: Omit<VmsVisit, "visitor" | "employee">[];
};

/** A visit as the summary returns it (flattened). */
export type VmsVisitRow = {
  id: string;
  visitor: string | null;
  organization: string | null;
  host: string | null;
  department: string;
  purpose: string | null;
  status: VisitStatus;
  scheduled_date: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  badges: VmsBadge[];
};

export type VmsSummary = {
  fetched_at: string;
  /** True when the VMS holds more visits than the backend reads for the summary. */
  truncated: boolean;
  visits_in_vms: number;
  visits_read: number;
  timezone: string;
  filters: { from: string | null; to: string | null; department: string | null };
  departments: string[];
  totals: {
    visitors: number;
    visits: number;
    unique_visitors: number;
    on_site: number;
    pending: number;
    today: number;
    average_duration_minutes: number | null;
  };
  by_status: { status: VisitStatus; count: number }[];
  by_department: { department: string; visits: number; on_site: number }[];
  by_day: { date: string; count: number }[];
  by_check_in_hour: { hour: number; count: number }[];
  top_hosts: { name: string; count: number; department: string }[];
  top_organizations: { name: string; count: number }[];
  top_purposes: { name: string; count: number }[];
  badges: { total: number; by_status: { status: BadgeStatus; count: number }[] };
  on_site_now: VmsVisitRow[];
  recent_visits: VmsVisitRow[];
};

export type VmsSummaryParams = {
  from?: string;
  to?: string;
  department?: string;
  /** Any non-zero value (a timestamp) makes the backend re-read the VMS instead of using its cache. */
  refresh?: number;
};

export type VmsVisitsParams = {
  page?: number;
  limit?: number;
  status?: VisitStatus;
  visitor_id?: string;
  visit_date?: string;
  search?: string;
};

export type VmsVisitorsParams = {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
};

type Paged<T> = { data: T[]; pagination: VmsPagination | null };

const clean = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== "" && value !== false));

export const vmsApi = createApi({
  reducerPath: "vmsApi",
  baseQuery: axiosBaseQuery(),
  // The backend caches VMS responses for a minute; no need to refetch more often.
  keepUnusedDataFor: 60,
  endpoints: (builder) => ({
    getVmsSummary: builder.query<VmsSummary, VmsSummaryParams | void>({
      query: (params) => ({
        url: "/vms/summary",
        method: "GET",
        params: clean({ ...(params ?? {}), refresh: params?.refresh ? 1 : undefined }),
      }),
      transformResponse: (response: { data: VmsSummary }) => response.data,
    }),
    getVmsVisits: builder.query<Paged<VmsVisit>, VmsVisitsParams>({
      query: (params) => ({ url: "/vms/visits", method: "GET", params: clean(params) }),
    }),
    getVmsVisitors: builder.query<Paged<VmsVisitor>, VmsVisitorsParams>({
      query: (params) => ({ url: "/vms/visitors", method: "GET", params: clean(params) }),
    }),
    getVmsVisitor: builder.query<VmsVisitorDetails, string>({
      query: (id) => ({ url: `/vms/visitors/${id}`, method: "GET" }),
      transformResponse: (response: { data: VmsVisitorDetails }) => response.data,
    }),
  }),
});

export const {
  useGetVmsSummaryQuery,
  useGetVmsVisitsQuery,
  useGetVmsVisitorsQuery,
  useGetVmsVisitorQuery,
} = vmsApi;

/** The backend's error message, e.g. "The visitor management system is unavailable right now." */
export const vmsErrorMessage = (error: unknown): string => {
  const data = (error as { data?: unknown } | undefined)?.data;
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  return "Could not load data from the visitor management system.";
};
