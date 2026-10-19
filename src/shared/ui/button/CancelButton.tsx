import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { UnsavedChangesModal } from "../modal/UnsavedChangesModal";

export interface CancelButtonProps {
  onCancel?: () => void;
  fallbackUrl?: string;
  isDirty?: boolean;
  label?: string;
  className?: string;
  variant?: "secondary" | "outline" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  disabled?: boolean;
}

export const CancelButton: React.FC<CancelButtonProps> = ({
  onCancel,
  fallbackUrl,
  isDirty = false,
  label = "Cancel",
  className,
  variant = "secondary",
  size = "sm",
  disabled = false,
}) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const executeCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (fallbackUrl) {
      navigate(fallbackUrl);
    } else if (window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(-1);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isDirty) {
      setShowModal(true);
    } else {
      executeCancel();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        onClick={handleClick}
      >
        {label}
      </Button>

      {isDirty && (
        <UnsavedChangesModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onConfirm={() => {
            setShowModal(false);
            executeCancel();
          }}
        />
      )}
    </>
  );
};

export default CancelButton;
