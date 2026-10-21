import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Modal from "@/shared/ui/modal/Modal";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateOperationCategoryMutation,
  useUpdateOperationCategoryMutation,
  type OperationCategory,
} from "../api";

interface OperationCategoryModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: OperationCategory | null;
  onSuccess?: (category: OperationCategory) => void;
}

export const OperationCategoryModal: React.FC<OperationCategoryModalProps> = ({
  open,
  onClose,
  initialData,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [createCategory, { isLoading: isCreating }] =
    useCreateOperationCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] =
    useUpdateOperationCategoryMutation();

  const isSubmitting = isCreating || isUpdating;
  const isEditing = Boolean(initialData && initialData.id);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? "");
      setDescription(initialData.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      dispatch(showToast({ message: "Operation name is required.", type: "error" }));
      return;
    }

    try {
      if (isEditing && initialData) {
        const result = await updateCategory({
          id: initialData.id,
          name: trimmedName,
          description: description.trim() || null,
        }).unwrap();
        dispatch(
          showToast({
            message: `Operation "${trimmedName}" updated successfully.`,
            type: "success",
          }),
        );
        onSuccess?.(result);
      } else {
        const result = await createCategory({
          name: trimmedName,
          description: description.trim() || null,
        }).unwrap();
        dispatch(
          showToast({
            message: `Operation "${trimmedName}" created successfully.`,
            type: "success",
          }),
        );
        onSuccess?.(result);
      }
      onClose();
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to save operation. Please check if the name already exists.";
      dispatch(showToast({ message: errorMsg, type: "error" }));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Operation / Campaign" : "Add New Operation / Campaign"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-300 font-semibold tracking-wide flex items-center justify-between">
            <span>Operation Name</span>
            <span className="text-[10px] text-amber-400 font-normal uppercase">Required</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Operation HADIN KAI, Operation SAFE HAVEN"
            className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-500"
            required
            autoFocus
          />
          <span className="text-[11px] text-gray-400">
            Designate the strategic campaign or joint operational command mandate.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-300 font-semibold tracking-wide flex items-center justify-between">
            <span>Operational Mandate / Description</span>
            <span className="text-[10px] text-gray-500 font-normal">Optional</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe operational theater, directive scope, participating formations, or mandate..."
            rows={4}
            className="bg-[#001219] border border-[#0A4D66]/40 rounded p-3 text-sm text-white focus:outline-none focus:border-[#7FD5FF] placeholder-gray-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#0A4D66]/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0369A1] text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-[#0369A1]/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Icon
                  icon={isEditing ? "mdi:content-save-edit-outline" : "mdi:plus-circle"}
                  className="w-4 h-4"
                />
                <span>{isEditing ? "Save Changes" : "Create Operation"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
