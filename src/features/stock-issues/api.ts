import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type StockIssueStatus = "draft" | "pending_approval" | "approved" | "rejected" | "issued" | "received" | "cancelled";

export type IssueDocumentType = "voucher_photo" | "afg_1033" | "other";

type PersonRef = {
  id: number;
  firstname: string;
  lastname: string;
  service_number: string;
  rank?: { id: number; name: string } | null;
} | null;

type UserRef = { id: number; firstname: string; lastname: string } | null;

export type StockIssueDocument = {
  id: number;
  name: string;
  document_type: IssueDocumentType;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploader: UserRef;
  created_at: string;
};

export type StockIssue = {
  id: number;
  reference: string | null;
  inventory_id: number | null;
  inventory: { id: number; description: string | null; part_number: string | null; nsn: string | null; unit_id: number | null } | null;
  description: string;
  part_number: string | null;
  nsn: string | null;
  quantity: number;
  unit_of_issue: string | null;
  issue_date: string;
  unit_id: number | null;
  unit: { id: number; name: string } | null;
  receiving_unit_id: number;
  receiving_unit: { id: number; name: string } | null;
  authorizing_officer: PersonRef;
  receiving_officer: PersonRef;
  inventory_requisition_id: number | null;
  status: StockIssueStatus;
  remarks: string | null;
  issued_at: string | null;
  issuer: UserRef;
  received_at: string | null;
  receiver: UserRef;
  quantity_received: number | null;
  receiving_inventory_id: number | null;
  receipt_remarks: string | null;
  creator: UserRef;
  documents: StockIssueDocument[];
  created_at: string;
};

export const stockIssuesApi = createApi({
  reducerPath: "stockIssuesApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["StockIssues", "StockIssue"],
  endpoints: (builder) => ({
    getStockIssues: builder.query<StockIssue[], { status?: string; q?: string; unit_id?: number; receiving_unit_id?: number } | void>({
      query: (params) => ({ url: "/stock-issues", method: "GET", params: params ?? undefined }),
      providesTags: ["StockIssues"],
    }),
    getStockIssue: builder.query<StockIssue, number>({
      query: (id) => ({ url: `/stock-issues/${id}`, method: "GET" }),
      providesTags: (_r, _e, id) => [{ type: "StockIssue", id }],
    }),
    /** Multipart: item fields plus documents[i][name|document_type|file]. */
    createStockIssue: builder.mutation<StockIssue, FormData>({
      query: (body) => ({ url: "/stock-issues", method: "POST", data: body }),
      invalidatesTags: ["StockIssues"],
    }),
    updateStockIssue: builder.mutation<StockIssue, { id: number; body: FormData }>({
      query: ({ id, body }) => {
        body.append("_method", "PUT");
        return { url: `/stock-issues/${id}`, method: "POST", data: body };
      },
      invalidatesTags: (_r, _e, { id }) => ["StockIssues", { type: "StockIssue", id }],
    }),
    deleteStockIssue: builder.mutation<void, number>({
      query: (id) => ({ url: `/stock-issues/${id}`, method: "DELETE" }),
      invalidatesTags: ["StockIssues"],
    }),
    addStockIssueDocuments: builder.mutation<StockIssue, { id: number; body: FormData }>({
      query: ({ id, body }) => ({ url: `/stock-issues/${id}/documents`, method: "POST", data: body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "StockIssue", id }],
    }),
    deleteStockIssueDocument: builder.mutation<void, { issueId: number; documentId: number }>({
      query: ({ documentId }) => ({ url: `/stock-issue-documents/${documentId}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { issueId }) => [{ type: "StockIssue", id: issueId }],
    }),
    issueStock: builder.mutation<StockIssue, { id: number; remarks?: string }>({
      query: ({ id, remarks }) => ({ url: `/stock-issues/${id}/issue`, method: "POST", data: { remarks } }),
      invalidatesTags: (_r, _e, { id }) => ["StockIssues", { type: "StockIssue", id }],
    }),
    receiveStock: builder.mutation<StockIssue, { id: number; quantity_received?: number; receipt_remarks?: string }>({
      query: ({ id, ...body }) => ({ url: `/stock-issues/${id}/receive`, method: "POST", data: body }),
      invalidatesTags: (_r, _e, { id }) => ["StockIssues", { type: "StockIssue", id }],
    }),
  }),
});

export const {
  useGetStockIssuesQuery,
  useGetStockIssueQuery,
  useCreateStockIssueMutation,
  useUpdateStockIssueMutation,
  useDeleteStockIssueMutation,
  useAddStockIssueDocumentsMutation,
  useDeleteStockIssueDocumentMutation,
  useIssueStockMutation,
  useReceiveStockMutation,
} = stockIssuesApi;
