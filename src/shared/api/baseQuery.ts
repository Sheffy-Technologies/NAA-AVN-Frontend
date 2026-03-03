import { type BaseQueryFn } from "@reduxjs/toolkit/query/react";
import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import type { RootState } from "@/app/store";
import { logout } from "@/features/auth/authSlice";
import { showToast } from "@/shared/store/toastSlice";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type AxiosBaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: AxiosRequestConfig["data"];
  params?: AxiosRequestConfig["params"];
  headers?: AxiosRequestConfig["headers"];
};

type AxiosBaseQueryError = {
  status?: number;
  data?: unknown;
};

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async ({ url, method = "GET", data, params, headers: extraHeaders }, api) => {
    try {
      const state = api.getState() as RootState;

      const token = state.auth?.token;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(extraHeaders as Record<string, string>),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // If data is FormData, let the browser set the Content-Type header with the boundary
      if (data instanceof FormData) {
        delete headers["Content-Type"];
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
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      if (
        status === 401 &&
        data &&
        typeof data === "object" &&
        "message" in data &&
        (data as { message: string }).message === "Unauthenticated."
      ) {
        api.dispatch(logout());
        api.dispatch(
          showToast({
            message: "Session expired. Please login again.",
            type: "error",
          }),
        );
      }

      return {
        error: {
          status,
          data: data ?? axiosError.message,
        },
      };
    }
  };
