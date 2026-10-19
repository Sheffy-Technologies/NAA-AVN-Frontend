import React from "react";
import Modal from "./Modal";
import { Button } from "../button/Button";
import { Icon } from "@/shared/icons/Icon";

export interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void; // Keep Editing
  onConfirm: () => void; // Discard Changes
  title?: string;
  message?: string;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Unsaved Changes",
  message = "You have unsaved changes that will be lost if you leave this page. Are you sure you want to discard them?",
}) => {
  return (
    <Modal open={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20 flex-shrink-0">
            <Icon icon="lucide:alert-triangle" className="w-5 h-5" />
          </div>
          <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#0A4D66]/40">
          <Button variant="secondary" onClick={onClose}>
            Keep Editing
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Discard Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UnsavedChangesModal;
