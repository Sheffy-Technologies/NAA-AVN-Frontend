import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { UnsavedChangesModal } from "../modal/UnsavedChangesModal";
import { useNavigationContext } from "@/shared/utils/navigationContext";

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
  const { navigateBack, returnLabel } = useNavigationContext(fallbackUrl);
  const [showModal, setShowModal] = useState(false);

  const executeBack = () => {
    if (onClick) {
      onClick();
      return;
    }
    navigateBack();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDirty) {
      setShowModal(true);
    } else {
      executeBack();
    }
  };

  const buttonTitle = returnLabel ? `Back to ${returnLabel}` : label;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label={buttonTitle}
          title={buttonTitle}
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
          aria-label={buttonTitle}
          title={buttonTitle}
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
          aria-label={buttonTitle}
          title={buttonTitle}
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
