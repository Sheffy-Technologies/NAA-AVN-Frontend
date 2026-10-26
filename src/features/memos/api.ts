import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type MemoStatus = "draft" | "pending" | "approved" | "rejected";
export type MemoBox = "mine" | "approvals" | "shared" | "all";
export type MemoPerson = { id: number; name: string };

export type MemoSummary = {
  id: number;
  reference: string | null;
  classification: string;
  subject: string;
  to: string;
  from: string;
  memo_date: string | null;
  status: MemoStatus;
  originator: MemoPerson | null;
  approving_officer: MemoPerson | null;
  recipients_count: number;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string;
  is_recipient?: boolean;
  read_at?: string | null;
};

/** A supporting document (enclosure) on a memo. */
export type MemoAttachment = {
  id: number;
  name: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: MemoPerson | null;
  created_at: string;
};

export type Memo = MemoSummary & {
  body: string | null;
  originator_rank: string | null;
  originator_name: string | null;
  has_originator_signature: boolean;
  recipients: (MemoPerson & { read_at: string | null })[];
  attachments: MemoAttachment[];
  approval: { id: number; status: string; submitted_at: string | null; completed_at: string | null } | null;
  decision: {
    action: "approved" | "rejected";
    by: MemoPerson | null;
    comment: string | null;
    signed_at: string | null;
    has_signature: boolean;
  } | null;
  can: { edit: boolean; attach: boolean; delete: boolean; submit: boolean; withdraw: boolean; decide: boolean; copy: boolean };
};

export type MemoCounts = { awaiting_my_approval: number; unread_shared: number };

export type MemoOptions = {
  /** Accounts; `name` is "Rank First Last" from the linked personnel record when there is one. */
  users: { id: number; name: string; email: string | null; personnel_id: number | null; service_number: string | null }[];
  classifications: string[];
  defaults: {
    classification: string;
    originator_rank: string | null;
    originator_name: string | null;
    memo_date: string;
  };
};

export type MemoPayload = {
  reference?: string | null;
  classification?: string;
  to: string;
  from: string;
  memo_date: string;
  subject: string;
  body: string;
  originator_rank?: string | null;
  originator_name?: string | null;
  approving_officer_id?: number | null;
};

export const memosApi = createApi({
  reducerPath: "memosApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Memo"],
  endpoints: (builder) => ({
    getMemos: builder.query<{ data: MemoSummary[]; counts: MemoCounts }, { box: MemoBox; status?: string; q?: string }>({
      query: (params) => ({ url: "/memos", params }),
      providesTags: [{ type: "Memo", id: "LIST" }],
    }),
    getMemo: builder.query<Memo, number>({
      query: (id) => ({ url: `/memos/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "Memo", id }],
    }),
    getMemoOptions: builder.query<MemoOptions, void>({
      query: () => ({ url: "/memos/options" }),
    }),
    createMemo: builder.mutation<Memo, MemoPayload>({
      query: (data) => ({ url: "/memos", method: "POST", data }),
      invalidatesTags: [{ type: "Memo", id: "LIST" }],
    }),
    updateMemo: builder.mutation<Memo, { id: number; data: Partial<MemoPayload> }>({
      query: ({ id, data }) => ({ url: `/memos/${id}`, method: "PUT", data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Memo", id }, { type: "Memo", id: "LIST" }],
    }),
    deleteMemo: builder.mutation<void, number>({
      query: (id) => ({ url: `/memos/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Memo", id: "LIST" }],
    }),
    submitMemo: builder.mutation<Memo, { id: number; approving_officer_id: number; signature: string }>({
      query: ({ id, ...data }) => ({ url: `/memos/${id}/submit`, method: "POST", data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Memo", id }, { type: "Memo", id: "LIST" }],
    }),
    approveMemo: builder.mutation<Memo, { id: number; signature: string; comment?: string; recipient_ids?: number[] }>({
      query: ({ id, ...data }) => ({ url: `/memos/${id}/approve`, method: "POST", data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Memo", id }, { type: "Memo", id: "LIST" }],
    }),
    rejectMemo: builder.mutation<Memo, { id: number; signature: string; comment: string }>({
      query: ({ id, ...data }) => ({ url: `/memos/${id}/reject`, method: "POST", data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Memo", id }, { type: "Memo", id: "LIST" }],
    }),
    withdrawMemo: builder.mutation<Memo, number>({
      query: (id) => ({ url: `/memos/${id}/withdraw`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [{ type: "Memo", id }, { type: "Memo", id: "LIST" }],
    }),
    /** Originator only, while the memo is a draft or rejected. */
    addMemoAttachments: builder.mutation<Memo, { id: number; files: { file: File; name?: string }[] }>({
      query: ({ id, files }) => {
        const data = new FormData();
        files.forEach(({ file, name }, i) => {
          data.append(`attachments[${i}][file]`, file);
          if (name?.trim()) data.append(`attachments[${i}][name]`, name.trim());
        });
        return { url: `/memos/${id}/attachments`, method: "POST", data, headers: { "Content-Type": "multipart/form-data" } };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Memo", id }],
    }),
    deleteMemoAttachment: builder.mutation<Memo, { id: number; memoId: number }>({
      query: ({ id }) => ({ url: `/memo-attachments/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { memoId }) => [{ type: "Memo", id: memoId }],
    }),
    copyMemo: builder.mutation<Memo, { id: number; user_ids: number[] }>({
      query: ({ id, ...data }) => ({ url: `/memos/${id}/recipients`, method: "POST", data }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Memo", id }, { type: "Memo", id: "LIST" }],
    }),
  }),
});

export const {
  useGetMemosQuery,
  useGetMemoQuery,
  useGetMemoOptionsQuery,
  useCreateMemoMutation,
  useUpdateMemoMutation,
  useDeleteMemoMutation,
  useSubmitMemoMutation,
  useApproveMemoMutation,
  useRejectMemoMutation,
  useWithdrawMemoMutation,
  useCopyMemoMutation,
  useAddMemoAttachmentsMutation,
  useDeleteMemoAttachmentMutation,
} = memosApi;
