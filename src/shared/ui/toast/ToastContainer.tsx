import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { hideToast, type ToastState } from "@/shared/store/toastSlice";
import { Icon } from "@/shared/icons/Icon";

export const ToastContainer = () => {
  const dispatch = useAppDispatch();
  // Using explicit type assertion since the state type might not be fully inferred yet
  const { message, type } = useAppSelector(
    (state) => state.toast as ToastState,
  );

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        dispatch(hideToast());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, dispatch]);

  if (!message) return null;

  const bgColors = {
    success: "bg-[#1F2937] border-emerald-500/70",
    error: "bg-[#1F130F] border-red-500/70",
    info: "bg-[#001219] border-[#0A4D66]/70",
    warning: "bg-[#1F1E0F] border-amber-500/70",
  };

  const iconColors = {
    success: "bg-emerald-500/90",
    error: "bg-red-500/90",
    info: "bg-[#0A4D66]/90",
    warning: "bg-amber-500/90",
  };

  const icons = {
    success: "mdi:check",
    error: "mdi:alert-circle-outline",
    info: "mdi:information-outline",
    warning: "mdi:alert-outline",
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`flex items-center gap-3 px-4 sm:px-5 py-3 rounded-full border shadow-lg shadow-black/40 text-sm text-white min-w-[280px] max-w-[90vw] ${bgColors[type]}`}
      >
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-full ${iconColors[type]}`}
        >
          <Icon icon={icons[type]} size={18} className="text-white" />
        </span>
        <p className="whitespace-nowrap sm:whitespace-normal">{message}</p>
        <button
          type="button"
          onClick={() => dispatch(hideToast())}
          className="ml-2 text-xs text-gray-300 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
