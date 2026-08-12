import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type DocumentUser = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

export type DocumentAction = {
  id: number;
  document_id: number;
  created_by: number | null;
  action_type: "treat" | "inform" | "approve" | "sign" | "acknowledge" | "forward" | string;
  description: string | null;
  location: string | null;
  action_addressees: { id: number; name?: string | null }[] | null;
  informed_addressees: { id: number; name?: string | null }[] | null;
  status: "pending" | "completed" | string;
  completed_at: string | null;
  created_at: string | null;
  created_by_user?: DocumentUser | null;
};

export type DocumentItem = {
  id: number;
  title?: string | null;
  name?: string | null;
  file?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  filename?: string | null;
  file_path?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  file_size?: number | string | null;
  size?: number | string | null;
  status?: string | null;
  // Classification & tracking fields
  file_header?: string | null;
  file_reference?: string | null;
  classification?: "classified" | "open" | string | null;
  current_location?: string | null;
  current_action?: string | null;
  assigned_personnel?: { id: number; firstname?: string | null; lastname?: string | null; pivot?: { access?: "read" | "write" } }[] | null;
  actions?: DocumentAction[] | null;
  latest_action?: DocumentAction | null;
  created_at?: string | null;
  updated_at?: string | null;
  uploaded_by?: DocumentUser | null;
  user?: DocumentUser | null;
  document_type_id?: number | null;
  document_type?: {
    id?: number;
    name?: string | null;
    description?: string | null;
  } | null;
};

type DocumentsApiResponse =
  | DocumentItem[]
  | {
      data?: DocumentItem[];
      documents?: DocumentItem[];
      results?: DocumentItem[];
    };

export type DocumentMinute = {
  id: number;
  document_id: number;
  user_id: number;
  body: string;
  forwarded_to_user_id?: number | null;
  author?: DocumentUser | null;
  forwarded_to?: DocumentUser | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateDocumentMinutePayload = {
  document_id: number;
  body: string;
  forwarded_to_user_id?: number | null;
};

export type CreateDocumentActionPayload = {
  action_type: string;
  description?: string | null;
  location?: string | null;
  action_addressees?: number[] | null;
  informed_addressees?: number[] | null;
  status?: string;
};

export type UpdateDocumentActionPayload = {
  documentId: number | string;
  actionId: number | string;
  data: Partial<CreateDocumentActionPayload>;
};

export const documentsApi = createApi({
  reducerPath: "documentsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Document", "DocumentMinute", "DocumentAction"],
  endpoints: (builder) => ({
    getDocuments: builder.query<DocumentItem[], void>({
      query: () => ({
        url: "/documents",
        method: "GET",
      }),
      transformResponse: (response: DocumentsApiResponse) => {
        if (Array.isArray(response)) return response;
        return response.data || response.documents || response.results || [];
      },
      providesTags: [{ type: "Document", id: "LIST" }],
    }),
    getDocumentById: builder.query<DocumentItem, number | string>({
      query: (id) => ({
        url: `/documents/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Document", id }],
    }),
    createDocument: builder.mutation<DocumentItem, FormData>({
      query: (body) => ({
        url: "/documents",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Document", id: "LIST" }],
    }),
    getDocumentMinutes: builder.query<DocumentMinute[], number | string>({
      query: (documentId) => ({
        url: "/document-minutes",
        method: "GET",
        params: { document_id: documentId },
      }),
      providesTags: (_result, _error, documentId) => [
        { type: "DocumentMinute", id: documentId },
      ],
    }),
    createDocumentMinute: builder.mutation<
      DocumentMinute,
      CreateDocumentMinutePayload
    >({
      query: (body) => ({
        url: "/document-minutes",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_result, _error, { document_id }) => [
        { type: "DocumentMinute", id: document_id },
      ],
    }),

    createDocumentAction: builder.mutation<DocumentAction, { documentId: number | string; data: CreateDocumentActionPayload }>({
      query: ({ documentId, data }) => ({
        url: `/documents/${documentId}/actions`,
        method: "POST",
        data,
      }),
      invalidatesTags: (_result, _error, { documentId }) => [
        { type: "Document", id: documentId },
        { type: "DocumentAction", id: documentId },
      ],
    }),

    updateDocumentAction: builder.mutation<DocumentAction, UpdateDocumentActionPayload>({
      query: ({ documentId, actionId, data }) => ({
        url: `/documents/${documentId}/actions/${actionId}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: (_result, _error, { documentId }) => [
        { type: "Document", id: documentId },
        { type: "DocumentAction", id: documentId },
      ],
    }),
  }),
});

export const {
  useGetDocumentsQuery,
  useGetDocumentByIdQuery,
  useCreateDocumentMutation,
  useGetDocumentMinutesQuery,
  useCreateDocumentMinuteMutation,
  useCreateDocumentActionMutation,
  useUpdateDocumentActionMutation,
} = documentsApi;
