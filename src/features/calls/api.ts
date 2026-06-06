import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type CallUser = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
};

export type CallItem = {
  id: number;
  channel_name: string;
  status: "ringing" | "active" | "declined" | "ended" | "missed";
  caller_id: number;
  callee_id: number;
  caller?: CallUser | null;
  callee?: CallUser | null;
  accepted_at?: string | null;
  ended_at?: string | null;
  end_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StartCallPayload = {
  callee_id: number;
};

export type CallTokenResponse = {
  call_id: number;
  app_id: string;
  channel_name: string;
  uid: string;
  token: string;
  expires_at: string;
};

export const callsApi = createApi({
  reducerPath: "callsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Calls"],
  endpoints: (builder) => ({
    getCalls: builder.query<CallItem[], void>({
      query: () => ({
        url: "/calls",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((call) => ({ type: "Calls" as const, id: call.id })),
              { type: "Calls", id: "LIST" },
            ]
          : [{ type: "Calls", id: "LIST" }],
    }),
    startCall: builder.mutation<CallItem, StartCallPayload>({
      query: (body) => ({
        url: "/calls",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Calls", id: "LIST" }],
    }),
    acceptCall: builder.mutation<CallItem, number>({
      query: (id) => ({
        url: `/calls/${id}/accept`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Calls", id },
        { type: "Calls", id: "LIST" },
      ],
    }),
    declineCall: builder.mutation<CallItem, number>({
      query: (id) => ({
        url: `/calls/${id}/decline`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Calls", id },
        { type: "Calls", id: "LIST" },
      ],
    }),
    endCall: builder.mutation<CallItem, number>({
      query: (id) => ({
        url: `/calls/${id}/end`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Calls", id },
        { type: "Calls", id: "LIST" },
      ],
    }),
    getCallToken: builder.query<CallTokenResponse, number>({
      query: (id) => ({
        url: `/calls/${id}/token`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetCallsQuery,
  useStartCallMutation,
  useAcceptCallMutation,
  useDeclineCallMutation,
  useEndCallMutation,
  useLazyGetCallTokenQuery,
} = callsApi;
