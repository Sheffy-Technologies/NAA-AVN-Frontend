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
};

type DocumentsApiResponse =
  | DocumentItem[]
  | {
      data?: DocumentItem[];
      documents?: DocumentItem[];
      results?: DocumentItem[];
    };

export const documentsApi = createApi({
  reducerPath: "documentsApi",
  baseQuery: axiosBaseQuery(),
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
    }),
    createDocument: builder.mutation<DocumentItem, FormData>({
      query: (body) => ({
        url: "/documents",
        method: "POST",
        data: body,
      }),
    }),
  }),
});

export const { useGetDocumentsQuery, useCreateDocumentMutation } = documentsApi;
