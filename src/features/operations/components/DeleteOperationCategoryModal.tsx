import React from "react";
import { Icon } from "@iconify/react";
import Modal from "@/shared/ui/modal/Modal";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { useDeleteOperationCategoryMutation, type OperationCategory } from "../api";

interface DeleteOperationCategoryModalProps {
  open: boolean;
  onClose: () => void;
  category: OperationCategory | null;
  onSuccess?: () => void;
}

export const DeleteOperationCategoryModal: React.FC<DeleteOperationCategoryModalProps> = ({
  open,
  onClose,
  category,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const [deleteCategory, { isLoading }] = useDeleteOperationCategoryMutation();

  if (!category) return null;

  const missionCount = category.operations_count ?? category.operations?.length ?? 0;

  const handleDelete = async () => {
    try {
      await deleteCategory(category.id).unwrap();
      dispatch(
        showToast({
          message: `Operation "${category.name}" removed successfully.`,
          type: "success",
        }),
      );
      onSuccess?.();
      onClose();
    } catch {
      dispatch(
        showToast({
          message: "Failed to delete operation. Please try again.",
          type: "error",
        }),
      );
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Delete Operation / Campaign">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-950/20 p-4">
          <Icon
            icon="mdi:alert-octagon-outline"
            className="w-6 h-6 text-red-400 shrink-0 mt-0.5"
          />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-200">
              Confirm Deletion of {category.name}
            </h4>
            <p className="text-xs text-gray-300">
              Are you sure you want to remove this operational campaign? This action will soft-delete the operation record.
            </p>
          </div>
        </div>

        {missionCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Icon icon="mdi:alert" className="w-4 h-4 text-amber-400" />
              <span>{missionCount} Active Missions Attached</span>
            </div>
            <p className="text-[11px] text-gray-300">
              There are currently {missionCount} flight missions assigned to this operation. Deleting this campaign will detach or archive its association.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#0A4D66]/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50 shadow-sm"
          >
            {isLoading ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                <span>Confirm Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
