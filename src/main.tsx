import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { store } from "@/app/store";
import { router } from "@/app/router/routes";
import "@/shared/styles/tailwind.css";

const DEVICE_ID_KEY = "naavn_device_id";

const ensureDeviceId = () => {
  if (typeof window === "undefined") return;

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return;

    const randomSegment = () => Math.random().toString(36).slice(2, 10);
    const newId = `${Date.now().toString(36)}-${randomSegment()}-${randomSegment()}`;

    window.localStorage.setItem(DEVICE_ID_KEY, newId);
  } catch (error) {
    console.error(error);
  }
};

ensureDeviceId();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>,
);
