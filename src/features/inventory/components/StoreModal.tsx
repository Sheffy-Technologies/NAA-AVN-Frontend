import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Modal from "@/shared/ui/modal/Modal";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { useGetUnitsQuery } from "@/shared/api/units";
import {
  useCreateStoreMutation,
  useUpdateStoreMutation,
  type Store,
} from "../api";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/shared/utils/cn";

interface StoreModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Store | null;
  onSuccess?: (store: Store) => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({
  open,
  onClose,
  initialData,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const { data: units = [], isLoading: isLoadingUnits } = useGetUnitsQuery();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [description, setDescription] = useState("");

  const [createStore, { isLoading: isCreating }] = useCreateStoreMutation();
  const [updateStore, { isLoading: isUpdating }] = useUpdateStoreMutation();

  const isSubmitting = isCreating || isUpdating;
  const isEditing = Boolean(initialData && initialData.id);
  const isProtectedSystemStore = Boolean(initialData?.is_system);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? "");
      setCode(initialData.code ?? "");
      setUnitId(initialData.unit_id ?? "");
      setDescription(initialData.description ?? "");
    } else {
      setName("");
      setCode("");
      setUnitId("");
      setDescription("");
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isProtectedSystemStore) {
      dispatch(
        showToast({
          message: "Core system stores are protected and cannot be modified.",
          type: "error",
        }),
      );
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      dispatch(
        showToast({
          message: "Store name is required.",
          type: "error",
        }),
      );
      return;
    }

    const payload = {
      name: trimmedName,
      code: code.trim() || null,
      unit_id: unitId === "" ? null : Number(unitId),
      description: description.trim() || null,
    };

    try {
      if (isEditing && initialData) {
        const result = await updateStore({
          id: initialData.id,
          body: payload,
        }).unwrap();
        dispatch(
          showToast({
            message: `Store "${trimmedName}" updated successfully.`,
            type: "success",
          }),
        );
        onSuccess?.(result);
      } else {
        const result = await createStore(payload).unwrap();
        dispatch(
          showToast({
            message: `Store "${trimmedName}" created successfully.`,
            type: "success",
          }),
        );
        onSuccess?.(result);
      }
      onClose();
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to save store. Please verify that the name or code is unique.";
      dispatch(showToast({ message: errorMsg, type: "error" }));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEditing
          ? isProtectedSystemStore
            ? `Store Details: ${initialData?.name}`
            : `Edit Store: ${initialData?.name}`
          : "Add Inventory Store"
      }
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isProtectedSystemStore && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            <Icon icon="mdi:shield-lock-outline" className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">System Protected Repository</p>
              <p className="mt-0.5 text-amber-300/80">
                This store is a core system repository for {initialData?.name} and its configuration cannot be modified.
              </p>
            </div>
          </div>
        )}

        {/* Store Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block">
            Store Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Avionics Depot, Tactical Armory"
            disabled={isProtectedSystemStore || isSubmitting}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors border",
              isDark
                ? "bg-[#001219] border-[#0A4D66]/40 text-white placeholder:text-gray-500 focus:border-[#7FD5FF]"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-gray-400 focus:border-[#0369A1] shadow-sm",
              (isProtectedSystemStore || isSubmitting) && "opacity-60 cursor-not-allowed",
            )}
            required
          />
        </div>

        {/* Store Code */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block">
            Store Code (Identifier)
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. AVN-01, TAC-STR"
            disabled={isProtectedSystemStore || isSubmitting}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition-colors border uppercase",
              isDark
                ? "bg-[#001219] border-[#0A4D66]/40 text-white placeholder:text-gray-500 focus:border-[#7FD5FF]"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-gray-400 focus:border-[#0369A1] shadow-sm",
              (isProtectedSystemStore || isSubmitting) && "opacity-60 cursor-not-allowed",
            )}
          />
        </div>

        {/* Unit / Location Assignment */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block">
            Operating Unit / Air Wing Base
          </label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={isProtectedSystemStore || isSubmitting || isLoadingUnits}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors border",
              isDark
                ? "bg-[#001219] border-[#0A4D66]/40 text-white focus:border-[#7FD5FF]"
                : "bg-white border-slate-300 text-slate-800 focus:border-[#0369A1] shadow-sm",
              (isProtectedSystemStore || isSubmitting) && "opacity-60 cursor-not-allowed",
            )}
          >
            <option value="">General / All Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block">
            Description / Storage Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Specify storage location, access controls, or item categories housed..."
            rows={3}
            disabled={isProtectedSystemStore || isSubmitting}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors border resize-none",
              isDark
                ? "bg-[#001219] border-[#0A4D66]/40 text-white placeholder:text-gray-500 focus:border-[#7FD5FF]"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-gray-400 focus:border-[#0369A1] shadow-sm",
              (isProtectedSystemStore || isSubmitting) && "opacity-60 cursor-not-allowed",
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#0A4D66]/30">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              isDark
                ? "border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/20"
                : "border-slate-300 text-slate-700 hover:bg-slate-100",
            )}
          >
            {isProtectedSystemStore ? "Close" : "Cancel"}
          </button>
          {!isProtectedSystemStore && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0369A1] hover:bg-[#0284C7] text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="mdi:loading" className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Icon icon={isEditing ? "mdi:check" : "mdi:plus"} className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Save Changes" : "Create Store"}</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};
