import { type BaseQueryFn } from "@reduxjs/toolkit/query/react";
import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import type { RootState } from "@/app/store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type AxiosBaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: AxiosRequestConfig["data"];
  params?: AxiosRequestConfig["params"];
};

type AxiosBaseQueryError = {
  status?: number;
  data?: unknown;
};

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async ({ url, method = "GET", data, params }, api) => {
    try {
      const state = api.getState() as RootState;

      const token = state.auth?.token;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const result = await axios.request({
        baseURL: API_BASE_URL,
        url,
        method,
        data,
        params,
        headers,
      });

      return { data: result.data };
    } catch (error) {
      const axiosError = error as AxiosError;

      return {
        error: {
          status: axiosError.response?.status,
          data: axiosError.response?.data ?? axiosError.message,
        },
      };
    }
  };

