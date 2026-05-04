import React from "react";
import { useTheme } from "@/context/ThemeContext";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, className }) => {
  const { isDark } = useTheme();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className={`rounded-lg shadow-lg max-w-lg w-full p-6 relative ${
          isDark
            ? "bg-[#001825] text-white border border-[#0A4D66]/40"
            : "bg-white text-[#111827] border border-[#E5E7EB] shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
        } ${className || ""}`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <h2
            className={`text-lg font-semibold mb-4 ${
              isDark ? "text-white" : "text-[#111827]"
            }`}
          >
            {title}
          </h2>
        )}
        <button
          className={`absolute top-3 right-3 hover:opacity-80 ${
            isDark ? "text-gray-400" : "text-gray-500"
          }`}
          onClick={onClose}
          aria-label="Close modal"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
