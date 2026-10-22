import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

/** Backend resource slugs for the Safety & Quality registers (see routes/api.php). */
export type SqResource =
  | "safety-reports"
  | "safety-risks"
  | "safety-investigations"
  | "quality-audits"
  | "quality-findings"
  | "corrective-actions"
  | "controlled-documents"
  | "compliance-requirements"
  | "personnel-qualifications"
  | "pilot-check-records"
  | "unit-oversight-reviews";

export type SqRecord = { id: number; [key: string]: unknown };

export type SqStatusCounts = Record<string, number>;

export type SqDashboard = {
  reference_date: string;
  safety_reports: {
    open: number;
    high_priority: number;
    under_investigation: number;
    closed_this_month: number;
    recent: SqRecord[];
  };
  risks: { active: number; high: number; medium: number; low: number; awaiting_review: number; overdue_reviews: number };
  investigations: { open: number; overdue: number };
  audits: { planned: number; in_progress: number; completed_this_month: number };
  findings: { open: number; high: number; recent: SqRecord[] };
  corrective_actions: {
    open: number;
    in_progress: number;
    awaiting_verification: number;
    overdue: number;
    on_track_percent: number;
  };
  documents: { approved: number; draft: number; review_due: number };
  compliance: { current: number; review_due: number; missing: number; not_applicable: number };
  qualifications: { total: number; current: number; expiring_soon: number; lapsed: number };
  pilot_currency: { total: number; current: number; expiring_soon: number; action_required: number; lapsed: number };
  units: { total: number; on_track: number; review_due: number; attention_required: number };
};

export type OversightStatus = "on_track" | "review_due" | "attention_required";

export type UnitOversightRow = {
  unit_id: number;
  name: string;
  description: string | null;
  open_safety_reports: number;
  high_risk_reports: number;
  high_risks: number;
  open_findings: number;
  high_findings: number;
  open_actions: number;
  overdue_actions: number;
  pilots: number;
  lapsed_pilots: number;
  last_review_date: string | null;
  last_review_type: string | null;
  review_due: boolean;
  safety_status: OversightStatus;
  quality_status: OversightStatus;
  overall_status: OversightStatus;
};

export type CurrencyStatus = "current" | "expiring_soon" | "action_required" | "lapsed";

export type PilotCurrencyRow = {
  personnel_id: number;
  name: string;
  service_number: string;
  call_sign: string | null;
  unit_id: number | null;
  unit: string | null;
  /** Type ratings from personnel_rating_table, comma-separated. */
  aircraft_type: string | null;
  ratings: Array<{ id: number; name: string; expiry_date: string | null; status: string }>;
  last_flight_date: string | null;
  next_flight_due_date: string | null;
  flight_status: "current" | "due_for_flight" | "overdue" | "no_flights" | null;
  last_check_date: string | null;
  last_check_type: string | null;
  checks: Array<{
    id: number;
    check_type: string;
    check_date: string | null;
    valid_until: string | null;
    aircraft_type: string | null;
    status: string;
  }>;
  currency_due_date: string | null;
  currency_status: CurrencyStatus;
};

export type QualificationRow = {
  id: number | null;
  source: "qualification_record" | "personnel_profile";
  personnel_id: number;
  name: string;
  service_number: string;
  unit: string | null;
  role: "pilot" | "aircraft_engineer" | "aircraft_technician";
  aircraft_type: string | null;
  asset_type_id: number | null;
  scope: string | null;
  issued_date: string | null;
  valid_until: string | null;
  evidence_reference: string | null;
  status: "current" | "expiring_soon" | "lapsed";
};

export type TrainingSummary = {
  courses: {
    scheduled: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    starting_next_30_days: number;
  };
  recurrent_training: { recorded: number; current: number; expiring_soon: number; lapsed: number };
  recent_courses: Array<{
    id: number;
    title: string;
    institution: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    personnel?: {
      id: number;
      firstname: string;
      lastname: string;
      service_number: string;
      unit?: { id: number; name: string } | null;
    } | null;
  }>;
};

export type SqReportType =
  | "safety-summary"
  | "quality-summary"
  | "document-control"
  | "risk-register"
  | "pilot-currency"
  | "unit-oversight";

export type SqReport = {
  type: SqReportType;
  title: string;
  period: { from: string; to: string };
  generated_at: string;
  metrics: Array<{ label: string; value: number }>;
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

const TAGS = [
  "SqDashboard",
  "SqUnits",
  "SqCurrency",
  "SqQualifications",
  "SqTraining",
  "SqReport",
  "safety-reports",
  "safety-risks",
  "safety-investigations",
  "quality-audits",
  "quality-findings",
  "corrective-actions",
  "controlled-documents",
  "compliance-requirements",
  "personnel-qualifications",
  "pilot-check-records",
  "unit-oversight-reviews",
] as const;

/**
 * Mutating one register can change linked registers (opening an investigation
 * moves its report; closing an action updates its finding) and every
 * aggregate, so mutations invalidate the related lists plus all summaries.
 */
const RELATED: Partial<Record<SqResource, SqResource[]>> = {
  "safety-investigations": ["safety-reports"],
  "corrective-actions": ["quality-findings"],
};

const invalidatesFor = (resource: SqResource) => [
  resource,
  ...(RELATED[resource] ?? []),
  "SqDashboard" as const,
  "SqUnits" as const,
  "SqCurrency" as const,
  "SqQualifications" as const,
  "SqTraining" as const,
  "SqReport" as const,
];

export const safetyApi = createApi({
  reducerPath: "safetyApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: TAGS,
  endpoints: (builder) => ({
    getSqRecords: builder.query<SqRecord[], { resource: SqResource; params?: Record<string, unknown> }>({
      query: ({ resource, params }) => ({ url: `/${resource}`, method: "GET", params }),
      providesTags: (_result, _error, { resource }) => [resource],
    }),
    getSqRecord: builder.query<SqRecord, { resource: SqResource; id: number }>({
      query: ({ resource, id }) => ({ url: `/${resource}/${id}`, method: "GET" }),
      providesTags: (_result, _error, { resource }) => [resource],
    }),
    createSqRecord: builder.mutation<SqRecord, { resource: SqResource; body: Record<string, unknown> | FormData }>({
      query: ({ resource, body }) => ({ url: `/${resource}`, method: "POST", data: body }),
      invalidatesTags: (_result, _error, { resource }) => invalidatesFor(resource),
    }),
    updateSqRecord: builder.mutation<
      SqRecord,
      { resource: SqResource; id: number; body: Record<string, unknown> | FormData }
    >({
      // Multipart bodies (file uploads) can't be sent as PUT to Laravel, so
      // they go as POST with a _method override.
      query: ({ resource, id, body }) => {
        if (body instanceof FormData) {
          body.append("_method", "PUT");
          return { url: `/${resource}/${id}`, method: "POST", data: body };
        }
        return { url: `/${resource}/${id}`, method: "PUT", data: body };
      },
      invalidatesTags: (_result, _error, { resource }) => invalidatesFor(resource),
    }),
    deleteSqRecord: builder.mutation<void, { resource: SqResource; id: number }>({
      query: ({ resource, id }) => ({ url: `/${resource}/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { resource }) => invalidatesFor(resource),
    }),
    getSqDashboard: builder.query<SqDashboard, void>({
      query: () => ({ url: "/safety-quality/dashboard", method: "GET" }),
      providesTags: ["SqDashboard"],
    }),
    getUnitOversight: builder.query<{ review_interval_months: number; data: UnitOversightRow[] }, void>({
      query: () => ({ url: "/safety-quality/unit-oversight", method: "GET" }),
      providesTags: ["SqUnits"],
    }),
    getPilotCurrency: builder.query<
      { flight_interval_weeks: number; counts: SqDashboard["pilot_currency"]; data: PilotCurrencyRow[] },
      { unit_id?: number } | void
    >({
      query: (params) => ({ url: "/safety-quality/pilot-currency", method: "GET", params: params ?? undefined }),
      providesTags: ["SqCurrency"],
    }),
    getQualifications: builder.query<{ counts: SqDashboard["qualifications"]; data: QualificationRow[] }, void>({
      query: () => ({ url: "/safety-quality/qualifications", method: "GET" }),
      providesTags: ["SqQualifications"],
    }),
    getTrainingSummary: builder.query<TrainingSummary, void>({
      query: () => ({ url: "/safety-quality/training", method: "GET" }),
      providesTags: ["SqTraining"],
    }),
    getSqReport: builder.query<SqReport, { type: SqReportType; from?: string; to?: string }>({
      query: ({ type, from, to }) => ({
        url: `/safety-quality/reports/${type}`,
        method: "GET",
        params: { from: from || undefined, to: to || undefined },
      }),
      providesTags: ["SqReport"],
    }),
  }),
});

export const {
  useGetSqRecordsQuery,
  useGetSqRecordQuery,
  useCreateSqRecordMutation,
  useUpdateSqRecordMutation,
  useDeleteSqRecordMutation,
  useGetSqDashboardQuery,
  useGetUnitOversightQuery,
  useGetPilotCurrencyQuery,
  useGetQualificationsQuery,
  useGetTrainingSummaryQuery,
  useLazyGetSqReportQuery,
} = safetyApi;
