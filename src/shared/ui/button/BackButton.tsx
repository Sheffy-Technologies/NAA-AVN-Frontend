import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { UnsavedChangesModal } from "../modal/UnsavedChangesModal";

export interface BackButtonProps {
  fallbackUrl?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
  isDirty?: boolean;
  variant?: "button" | "ghost" | "icon";
}

export const BackButton: React.FC<BackButtonProps> = ({
  fallbackUrl,
  label = "Back",
  className,
  onClick,
  isDirty = false,
  variant = "button",
}) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const executeBack = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
    } else if (fallbackUrl) {
      navigate(fallbackUrl);
    } else {
      navigate(-1);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDirty) {
      setShowModal(true);
    } else {
      executeBack();
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label={label}
          title={label}
          className={cn(
            "p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]",
            className,
          )}
        >
          <Icon icon="mdi:arrow-left" className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
      ) : variant === "ghost" ? (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "inline-flex items-center gap-1.5 py-1 px-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]",
            className,
          )}
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-semibold text-xs transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]",
            className,
          )}
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          <span>{label}</span>
        </button>
      )}

      {isDirty && (
        <UnsavedChangesModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onConfirm={() => {
            setShowModal(false);
            executeBack();
          }}
        />
      )}
    </>
  );
};

export default BackButton;
