import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const AUTH_STORAGE_KEY = "naavn_auth";

export interface UserRole {
  id?: number;
  name: string;
  guard_name?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  firstname?: string;
  lastname?: string;
  username?: string;
  phone_number?: string;
  roles?: UserRole[];
  role_names?: string[];
  permissions?: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string }>,
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
    updateCurrentUser: (state, action: PayloadAction<Partial<User>>) => {
      if (!state.user) return;
      state.user = {
        ...state.user,
        ...action.payload,
      };
    },
  },
});

export const { setCredentials, logout, updateCurrentUser } = authSlice.actions;
export default authSlice.reducer;
