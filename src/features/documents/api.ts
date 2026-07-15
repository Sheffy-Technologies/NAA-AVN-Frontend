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

export const documentsApi = createApi({
  reducerPath: "documentsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Document", "DocumentMinute"],
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
  }),
});

export const {
  useGetDocumentsQuery,
  useGetDocumentByIdQuery,
  useCreateDocumentMutation,
  useGetDocumentMinutesQuery,
  useCreateDocumentMinuteMutation,
} = documentsApi;
