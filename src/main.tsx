import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { store } from "@/app/store";
import { router } from "@/app/router/routes";
import { ToastContainer } from "@/shared/ui/toast/ToastContainer";
import "@/shared/styles/tailwind.css";

const DEVICE_ID_KEY = "naavn_device_id";
const DEVICE_REGISTERED_KEY = "naavn_device_registered";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ensureDeviceId = (): string | null => {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const randomSegment = () => Math.random().toString(36).slice(2, 10);
    const newId = `${Date.now().toString(36)}-${randomSegment()}-${randomSegment()}`;

    window.localStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const registerDeviceIfNeeded = async () => {
  if (typeof window === "undefined") return;

  const deviceId = ensureDeviceId();
  if (!deviceId || !API_BASE_URL) return;

  try {
    const alreadyRegistered = window.localStorage.getItem(
      DEVICE_REGISTERED_KEY,
    );
    if (alreadyRegistered === "true") return;

    const response = await fetch(`${API_BASE_URL}/auth/register/device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_code: deviceId }),
    });

    if (response.ok) {
      window.localStorage.setItem(DEVICE_REGISTERED_KEY, "true");
    }
  } catch (error) {
    console.error(error);
  }
};

registerDeviceIfNeeded();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
      <ToastContainer />
    </Provider>
  </React.StrictMode>,
);
