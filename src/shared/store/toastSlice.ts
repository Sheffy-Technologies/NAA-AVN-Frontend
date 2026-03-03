import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastState {
  message: string | null;
  type: ToastType;
}

const initialState: ToastState = {
  message: null,
  type: "info",
};

const toastSlice = createSlice({
  name: "toast",
  initialState,
  reducers: {
    showToast: (
      state,
      action: PayloadAction<{ message: string; type?: ToastType }>,
    ) => {
      state.message = action.payload.message;
      state.type = action.payload.type || "info";
    },
    hideToast: (state) => {
      state.message = null;
      state.type = "info"; // Reset to default
    },
  },
});

export const { showToast, hideToast } = toastSlice.actions;
export default toastSlice.reducer;
