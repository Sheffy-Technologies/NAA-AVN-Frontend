import { createSlice } from "@reduxjs/toolkit";

interface ComposeState {
  isOpen: boolean;
}

const initialState: ComposeState = {
  isOpen: false,
};

const composeSlice = createSlice({
  name: "messageCompose",
  initialState,
  reducers: {
    openCompose(state) {
      state.isOpen = true;
    },
    closeCompose(state) {
      state.isOpen = false;
    },
  },
});

export const { openCompose, closeCompose } = composeSlice.actions;
export default composeSlice.reducer;
