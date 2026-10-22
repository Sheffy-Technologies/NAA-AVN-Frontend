import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

/** Module keys registered in the backend ApprovalRegistry. */
export type ApprovalModuleKey =
  | "purchase-orders"
  | "passes"
  | "inventory-requisitions"
  | "stock-issues"
  | "operations"
  | "courses"
  | (string & {});

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ApprovalActionRow = {
  id: number;
  action: "submitted" | "approved" | "rejected" | "cancelled";
  stage_sequence: number | null;
  stage_name: string | null;
  comment: string | null;
  user: { id: number; name: string } | null;
  signed_at: string | null;
  created_at: string | null;
  /** API path (relative to the API base) of the signature PNG, if signed. */
  signature_path: string | null;
};

export type ApprovalStageRow = {
  sequence: number;
  name: string;
  approver_label: string | null;
  state: "approved" | "rejected" | "current" | "waiting";
  decision: ApprovalActionRow | null;
};

export type ApprovalRequestRow = {
  id: number;
  module: ApprovalModuleKey;
  module_label: string;
  approvable_id: number;
  title: string;
  status: ApprovalStatus;
  notes: string | null;
  unit: { id: number; name: string } | null;
  current_stage: number | null;
  submitted_by: { id: number; name: string } | null;
  submitted_at: string | null;
  completed_at: string | null;
  frontend_path: string | null;
  stages: ApprovalStageRow[];
  actions: ApprovalActionRow[];
  can_act: boolean;
  can_cancel: boolean;
};

export type RecordApproval = {
  module: { key: string; label: string; gated_statuses: string[]; status_on_approve: string | null };
  record_title: string;
  record_status: string | null;
  workflow: { id: number; name: string; stages: Array<{ sequence: number; name: string; approver_label: string }> } | null;
  can_submit: boolean;
  current: ApprovalRequestRow | null;
  history: ApprovalRequestRow[];
};

export type ApproverType = "permission" | "role" | "user";

export type WorkflowStageInput = { name: string; approver_type: ApproverType; approver_value: string };

export type ApprovalWorkflow = {
  id: number;
  module: string;
  module_label: string;
  name: string;
  description: string | null;
  is_active: boolean;
  stages: Array<WorkflowStageInput & { id: number; sequence: number; approver_label: string }>;
};

export type ApprovalModuleInfo = {
  key: string;
  label: string;
  frontend_path: string;
  status_field: string | null;
  gated_statuses: string[];
  status_on_submit: string | null;
  status_on_approve: string | null;
  status_on_reject: string | null;
  workflow_id: number | null;
  is_active: boolean;
  stages_count: number;
};

export type ApprovalModulesResponse = {
  modules: ApprovalModuleInfo[];
  roles: string[];
  permissions: string[];
  users: Array<{ id: number; firstname: string; lastname: string; email: string }>;
};

export const approvalsApi = createApi({
  reducerPath: "approvalsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Approvals", "RecordApproval", "ApprovalCount", "Workflows"],
  endpoints: (builder) => ({
    getApprovals: builder.query<
      ApprovalRequestRow[],
      { box?: "inbox" | "submitted" | "all"; module?: string; status?: ApprovalStatus }
    >({
      query: (params) => ({ url: "/approvals", method: "GET", params }),
      providesTags: ["Approvals"],
    }),
    getActiveApprovalModules: builder.query<string[], void>({
      query: () => ({ url: "/approvals/active-modules", method: "GET" }),
      providesTags: ["Workflows"],
    }),
    getPendingApprovalCount: builder.query<{ count: number }, void>({
      query: () => ({ url: "/approvals/pending-count", method: "GET" }),
      providesTags: ["ApprovalCount"],
    }),
    getRecordApproval: builder.query<RecordApproval, { module: ApprovalModuleKey; id: number }>({
      query: ({ module, id }) => ({ url: `/approvals/record/${module}/${id}`, method: "GET" }),
      providesTags: (_r, _e, { module, id }) => [{ type: "RecordApproval", id: `${module}:${id}` }],
    }),
    submitForApproval: builder.mutation<ApprovalRequestRow, { module: ApprovalModuleKey; id: number; notes?: string }>({
      query: ({ module, id, notes }) => ({ url: `/approvals/record/${module}/${id}/submit`, method: "POST", data: { notes } }),
      invalidatesTags: (_r, _e, { module, id }) => [
        { type: "RecordApproval", id: `${module}:${id}` },
        "Approvals",
        "ApprovalCount",
      ],
    }),
    decideApproval: builder.mutation<
      ApprovalRequestRow,
      { requestId: number; decision: "approve" | "reject"; signature: string; comment?: string; module: string; recordId: number }
    >({
      query: ({ requestId, decision, signature, comment }) => ({
        url: `/approval-requests/${requestId}/${decision}`,
        method: "POST",
        data: { signature, comment },
      }),
      invalidatesTags: (_r, _e, { module, recordId }) => [
        { type: "RecordApproval", id: `${module}:${recordId}` },
        "Approvals",
        "ApprovalCount",
      ],
    }),
    cancelApproval: builder.mutation<ApprovalRequestRow, { requestId: number; module: string; recordId: number }>({
      query: ({ requestId }) => ({ url: `/approval-requests/${requestId}/cancel`, method: "POST" }),
      invalidatesTags: (_r, _e, { module, recordId }) => [
        { type: "RecordApproval", id: `${module}:${recordId}` },
        "Approvals",
        "ApprovalCount",
      ],
    }),
    getApprovalModules: builder.query<ApprovalModulesResponse, void>({
      query: () => ({ url: "/approval-modules", method: "GET" }),
      providesTags: ["Workflows"],
    }),
    getWorkflows: builder.query<ApprovalWorkflow[], void>({
      query: () => ({ url: "/approval-workflows", method: "GET" }),
      providesTags: ["Workflows"],
    }),
    saveWorkflow: builder.mutation<
      ApprovalWorkflow,
      { id?: number; module: string; name: string; description?: string | null; is_active: boolean; stages: WorkflowStageInput[] }
    >({
      query: ({ id, ...body }) =>
        id ? { url: `/approval-workflows/${id}`, method: "PUT", data: body } : { url: "/approval-workflows", method: "POST", data: body },
      // Turning a workflow on/off changes whether every record of that module needs approval.
      invalidatesTags: ["Workflows", "RecordApproval", "Approvals", "ApprovalCount"],
    }),
    deleteWorkflow: builder.mutation<void, number>({
      query: (id) => ({ url: `/approval-workflows/${id}`, method: "DELETE" }),
      invalidatesTags: ["Workflows", "RecordApproval", "Approvals", "ApprovalCount"],
    }),
  }),
});

export const {
  useGetApprovalsQuery,
  useGetPendingApprovalCountQuery,
  useGetActiveApprovalModulesQuery,
  useGetRecordApprovalQuery,
  useSubmitForApprovalMutation,
  useDecideApprovalMutation,
  useCancelApprovalMutation,
  useGetApprovalModulesQuery,
  useGetWorkflowsQuery,
  useSaveWorkflowMutation,
  useDeleteWorkflowMutation,
} = approvalsApi;
