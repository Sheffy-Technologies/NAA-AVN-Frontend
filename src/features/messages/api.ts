import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type MessageAttachableType =
  | "operation"
  | "work-order"
  | "work-order-task"
  | "maintenance-event"
  | "purchase-order"
  | "asset"
  | "inventory";

export type MessageUser = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
};

export type MessageItem = {
  id: number;
  sender_id: number;
  sender?: MessageUser | null;
  subject?: string | null;
  body: string;
  attachable_type?: MessageAttachableType | null;
  attachable_id?: number | null;
  attachable_details?: { label: string; reference?: string | null } | null;
  recipients?: MessageUser[];
  is_read?: boolean | null;
  read_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GetMessagesParams = {
  box?: "inbox" | "sent";
};

export type SendMessagePayload = {
  subject?: string | null;
  body: string;
  recipient_ids: number[];
  attachable_type?: MessageAttachableType | null;
  attachable_id?: number | null;
};

export type UpdateMessagePayload = {
  id: number;
  is_read: boolean;
};

export const messagesApi = createApi({
  reducerPath: "messagesApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Messages"],
  endpoints: (builder) => ({
    getMessages: builder.query<MessageItem[], GetMessagesParams | void>({
      query: (params) => ({
        url: "/messages",
        method: "GET",
        params: params || undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((message) => ({
                type: "Messages" as const,
                id: message.id,
              })),
              { type: "Messages", id: "LIST" },
            ]
          : [{ type: "Messages", id: "LIST" }],
    }),
    sendMessage: builder.mutation<MessageItem, SendMessagePayload>({
      query: (body) => ({
        url: "/messages",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Messages", id: "LIST" }],
    }),
    updateMessage: builder.mutation<MessageItem, UpdateMessagePayload>({
      query: ({ id, is_read }) => ({
        url: `/messages/${id}`,
        method: "PUT",
        data: { is_read },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Messages", id },
        { type: "Messages", id: "LIST" },
      ],
    }),
    deleteMessage: builder.mutation<void, number>({
      query: (id) => ({
        url: `/messages/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Messages", id },
        { type: "Messages", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetMessagesQuery,
  useSendMessageMutation,
  useUpdateMessageMutation,
  useDeleteMessageMutation,
} = messagesApi;
