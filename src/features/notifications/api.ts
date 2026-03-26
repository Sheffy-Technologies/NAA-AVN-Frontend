import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type NotificationItem = {
  id: number;
  title?: string | null;
  message?: string | null;
  description?: string | null;
  body?: string | null;
  read_at?: string | null;
  created_at?: string | null;
  date?: string | null;
};

type NotificationsApiResponse =
  | NotificationItem[]
  | {
      data?: NotificationItem[];
      results?: NotificationItem[];
      notifications?: NotificationItem[];
    };

export const notificationsApi = createApi({
  reducerPath: "notificationsApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationItem[], void>({
      query: () => ({
        url: "/notifications",
        method: "GET",
      }),
      transformResponse: (response: NotificationsApiResponse) => {
        if (Array.isArray(response)) return response;
        return (
          response.data || response.results || response.notifications || []
        );
      },
    }),
  }),
});

export const { useGetNotificationsQuery } = notificationsApi;
