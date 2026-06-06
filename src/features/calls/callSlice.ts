import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CallItem } from "@/features/calls/api";

type CallState = {
  incomingCall: CallItem | null;
  outgoingCall: CallItem | null;
  activeCall: CallItem | null;
};

const initialState: CallState = {
  incomingCall: null,
  outgoingCall: null,
  activeCall: null,
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    setIncomingCall(state, action: PayloadAction<CallItem | null>) {
      state.incomingCall = action.payload;
    },
    clearIncomingCall(state) {
      state.incomingCall = null;
    },
    setOutgoingCall(state, action: PayloadAction<CallItem | null>) {
      state.outgoingCall = action.payload;
    },
    clearOutgoingCall(state) {
      state.outgoingCall = null;
    },
    setActiveCall(state, action: PayloadAction<CallItem | null>) {
      state.activeCall = action.payload;
    },
    clearActiveCall(state) {
      state.activeCall = null;
    },
    resetCallState() {
      return initialState;
    },
  },
});

export const {
  setIncomingCall,
  clearIncomingCall,
  setOutgoingCall,
  clearOutgoingCall,
  setActiveCall,
  clearActiveCall,
  resetCallState,
} = callSlice.actions;

export default callSlice.reducer;
