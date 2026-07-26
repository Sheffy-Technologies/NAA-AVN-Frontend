import { configureStore } from "@reduxjs/toolkit";
import authReducer, {
  AUTH_STORAGE_KEY,
  type AuthState,
} from "@/features/auth/authSlice";
import { dashboardApi } from "@/features/dashboard/api";
import { personnelApi } from "@/features/personnel/api";
import { passApi } from "@/features/personnel/passApi";
import { inventoryApi } from "@/features/inventory/api";
import { financeApi } from "@/features/finance/api";
import { operationsApi } from "@/features/operations/api";
import { assetsApi } from "@/features/assets/api";
import { emergenciesApi } from "@/features/emergencies/api";
import { notificationsApi } from "@/features/notifications/api";
import { securityApi } from "@/features/security/api";
import { usersApi } from "@/features/users/api";
import { maintenanceApi } from "@/features/maintenance/api";
import { documentsApi } from "@/features/documents/api";
import { reportsApi } from "@/features/reports/api";
import { messagesApi } from "@/features/messages/api";
import messageComposeReducer from "@/features/messages/composeSlice";
import { callsApi } from "@/features/calls/api";
import callReducer from "@/features/calls/callSlice";
import { unitsApi } from "@/shared/api/units";
import toastReducer from "@/shared/store/toastSlice";

const getPersistedAuthState = (): AuthState | undefined => {
  if (typeof window === "undefined") return undefined;

  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return undefined;

    const parsed = JSON.parse(stored) as Partial<AuthState>;

    return {
      user: parsed.user ?? null,
      token: parsed.token ?? null,
      isAuthenticated: !!parsed.token,
    };
  } catch {
    return undefined;
  }
};

const persistedAuthState = getPersistedAuthState();

export const store = configureStore({
  reducer: {
    auth: authReducer,
    toast: toastReducer,
    messageCompose: messageComposeReducer,
    call: callReducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [personnelApi.reducerPath]: personnelApi.reducer,
    [passApi.reducerPath]: passApi.reducer,
    [inventoryApi.reducerPath]: inventoryApi.reducer,
    [financeApi.reducerPath]: financeApi.reducer,
    [operationsApi.reducerPath]: operationsApi.reducer,
    [assetsApi.reducerPath]: assetsApi.reducer,
    [emergenciesApi.reducerPath]: emergenciesApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [securityApi.reducerPath]: securityApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [maintenanceApi.reducerPath]: maintenanceApi.reducer,
    [documentsApi.reducerPath]: documentsApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
    [callsApi.reducerPath]: callsApi.reducer,
    [reportsApi.reducerPath]: reportsApi.reducer,
    [unitsApi.reducerPath]: unitsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      dashboardApi.middleware,
      personnelApi.middleware,
      passApi.middleware,
      inventoryApi.middleware,
      financeApi.middleware,
      operationsApi.middleware,
      assetsApi.middleware,
      emergenciesApi.middleware,
      notificationsApi.middleware,
      securityApi.middleware,
      usersApi.middleware,
      maintenanceApi.middleware,
      documentsApi.middleware,
      messagesApi.middleware,
      callsApi.middleware,
      reportsApi.middleware,
      unitsApi.middleware,
    ),
  preloadedState: persistedAuthState ? { auth: persistedAuthState } : undefined,
});

if (typeof window !== "undefined") {
  store.subscribe(() => {
    const state = store.getState();
    const auth = state.auth as AuthState;

    try {
      if (auth.isAuthenticated && auth.token) {
        window.localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            user: auth.user,
            token: auth.token,
          }),
        );
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore persistence errors
    }
  });
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import {
  type TypedUseSelectorHook,
  useDispatch,
  useSelector,
} from "react-redux";
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
