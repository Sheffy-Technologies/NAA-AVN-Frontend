import React from "react";
import { Icon } from "@iconify/react";
import Modal from "@/shared/ui/modal/Modal";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { useDeleteStoreMutation, type Store } from "../api";

interface DeleteStoreModalProps {
  open: boolean;
  onClose: () => void;
  store: Store | null;
  onSuccess?: () => void;
}

export const DeleteStoreModal: React.FC<DeleteStoreModalProps> = ({
  open,
  onClose,
  store,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const [deleteStore, { isLoading }] = useDeleteStoreMutation();

  if (!store) return null;

  const isProtectedSystemStore = Boolean(store.is_system);
  const itemsCount = store.inventories_count ?? store.inventories?.length ?? 0;
  const hasActiveInventories = itemsCount > 0;

  const handleDelete = async () => {
    if (isProtectedSystemStore) {
      dispatch(
        showToast({
          message: "Core system stores cannot be deleted.",
          type: "error",
        }),
      );
      return;
    }

    if (hasActiveInventories) {
      dispatch(
        showToast({
          message: `Cannot delete store while it contains ${itemsCount} active inventory items. Transfer or delete items first.`,
          type: "error",
        }),
      );
      return;
    }

    try {
      await deleteStore(store.id).unwrap();
      dispatch(
        showToast({
          message: `Store "${store.name}" deleted successfully.`,
          type: "success",
        }),
      );
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to delete store. Please try again.";
      dispatch(showToast({ message: errorMsg, type: "error" }));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Store Repository"
      className="max-w-md"
    >
      <div className="space-y-4">
        {isProtectedSystemStore ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
            <Icon
              icon="mdi:shield-lock-outline"
              className="w-6 h-6 text-amber-400 shrink-0 mt-0.5"
            />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-200">
                System Store Protected
              </h4>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                <span className="font-semibold text-white">{store.name}</span> is a core operational system repository ({store.code || "CORE"}). It is permanently protected under military air wing supply protocol and cannot be deleted or retired.
              </p>
            </div>
          </div>
        ) : hasActiveInventories ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
            <Icon
              icon="mdi:alert-circle-outline"
              className="w-6 h-6 text-amber-400 shrink-0 mt-0.5"
            />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-200">
                Store Contains Active Inventory
              </h4>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                This store currently contains{" "}
                <span className="font-bold text-white">{itemsCount} items</span>.
                To prevent accidental loss of material accountability, you must reallocate or remove these items before deleting the store.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-950/20 p-4">
            <Icon
              icon="mdi:alert-octagon-outline"
              className="w-6 h-6 text-red-400 shrink-0 mt-0.5"
            />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-red-200">
                Confirm Deletion of Store
              </h4>
              <p className="text-xs text-red-300/80 leading-relaxed">
                Are you sure you want to permanently delete store{" "}
                <span className="font-semibold text-white">"{store.name}"</span>?
                This action will decommission this storage repository.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#0A4D66]/30">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-[#0A4D66]/30 hover:bg-[#0A4D66]/50 border border-[#0A4D66]/60 transition-colors"
          >
            {isProtectedSystemStore || hasActiveInventories ? "Close" : "Cancel"}
          </button>
          {!isProtectedSystemStore && !hasActiveInventories && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Icon icon="mdi:loading" className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Icon icon="mdi:delete" className="w-3.5 h-3.5" />
                  <span>Delete Store</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
