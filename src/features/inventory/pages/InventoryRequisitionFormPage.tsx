import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { BackButton } from "@/shared/ui/button";
import {
  useCreateInventoryMutation,
  useCreateInventoryRequisitionMutation,
  useGetExpenseCategoriesQuery,
  useGetInventoriesQuery,
} from "@/features/inventory/api";
import { useGetAssetsQuery } from "@/features/assets/api";
import { formatCategoryName } from "../inventoryUtils";

// Requisitions only draw from the central store's stock (unit_id 1).
const REQUISITION_UNIT_ID = 1;

type RequisitionLine = {
  id: string;
  expenseCategoryId: number | "";
  aircraftAssetId: number | "";
  inventoryId: number | "";
  quantity: string;
};

const createEmptyLine = (): RequisitionLine => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  expenseCategoryId: "",
  aircraftAssetId: "",
  inventoryId: "",
  quantity: "",
});

type NewInventoryDraft = {
  part_number: string;
  description: string;
};

const createEmptyInventoryDraft = (): NewInventoryDraft => ({
  part_number: "",
  description: "",
});

export const InventoryRequisitionFormPage = () => {
  const navigate = useNavigate();

  const [lines, setLines] = useState<RequisitionLine[]>([createEmptyLine()]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: aircraftAssets = [] } = useGetAssetsQuery({ type: "aircraft" });
  const {
    data: inventories = [],
    isLoading: isInventoriesLoading,
    refetch: refetchInventories,
  } = useGetInventoriesQuery({ unit_id: REQUISITION_UNIT_ID });
  const { data: expenseCategories = [], isLoading: isCategoriesLoading } =
    useGetExpenseCategoriesQuery();

  const [createRequisition, { isLoading: isSubmitting }] =
    useCreateInventoryRequisitionMutation();
  const [createInventory, { isLoading: isCreatingInventory }] =
    useCreateInventoryMutation();

  const [addInventoryLineIndex, setAddInventoryLineIndex] = useState<
    number | null
  >(null);
  const [newInventoryDraft, setNewInventoryDraft] = useState<NewInventoryDraft>(
    createEmptyInventoryDraft(),
  );
  const [addInventoryError, setAddInventoryError] = useState<string | null>(
    null,
  );

  const isAircraftCategory = useMemo(() => {
    const aircraftCategoryIds = new Set(
      expenseCategories
        .filter((category) => category.name.toLowerCase().includes("aircraft"))
        .map((category) => category.id),
    );
    return (categoryId: number | "") =>
      categoryId !== "" && aircraftCategoryIds.has(categoryId);
  }, [expenseCategories]);

  const handleExit = () => {
    navigate("/dashboard/inventory", {
      state: { inventoryTab: "Requisitions" },
    });
  };

  const updateLine = (
    index: number,
    updates: Partial<Omit<RequisitionLine, "id">>,
  ) => {
    setLines((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, ...updates };
      return next;
    });
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => {
      if (prev.length === 1) return [createEmptyLine()];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleOpenAddInventory = (index: number) => {
    const line = lines[index];
    if (line.expenseCategoryId === "") {
      setSubmitError("Select a stock type before adding a new inventory item.");
      return;
    }
    if (isAircraftCategory(line.expenseCategoryId) && line.aircraftAssetId === "") {
      setSubmitError("Select an aircraft type before adding a new inventory item.");
      return;
    }

    setSubmitError(null);
    setAddInventoryError(null);
    setNewInventoryDraft(createEmptyInventoryDraft());
    setAddInventoryLineIndex(index);
  };

  const handleCloseAddInventory = () => {
    setAddInventoryLineIndex(null);
    setAddInventoryError(null);
  };

  const handleCreateInventory = async () => {
    if (addInventoryLineIndex === null) return;
    const line = lines[addInventoryLineIndex];

    if (
      !newInventoryDraft.part_number.trim() &&
      !newInventoryDraft.description.trim()
    ) {
      setAddInventoryError("Enter a part number or description.");
      return;
    }

    setAddInventoryError(null);

    try {
      const created = await createInventory({
        store: "others",
        asset_id:
          isAircraftCategory(line.expenseCategoryId) &&
          line.aircraftAssetId !== ""
            ? line.aircraftAssetId
            : null,
        expense_category_id:
          line.expenseCategoryId === "" ? null : line.expenseCategoryId,
        unit_id: REQUISITION_UNIT_ID,
        serial_number: "",
        part_number: newInventoryDraft.part_number.trim(),
        current_stock: 0,
        re_order_level: 0,
        unit_cost: 0,
        measurement_unit: "",
        expiry_date: null,
        date_received: null,
        remark: "",
        description: newInventoryDraft.description.trim(),
      }).unwrap();

      await refetchInventories();
      updateLine(addInventoryLineIndex, { inventoryId: created.id });
      setAddInventoryLineIndex(null);
    } catch {
      setAddInventoryError("Failed to add inventory item. Please try again.");
    }
  };

  const validate = () => {
    if (lines.length === 0) {
      setSubmitError("Add at least one request item.");
      return false;
    }

    for (const line of lines) {
      if (line.expenseCategoryId === "") {
        setSubmitError("Select a category for all requests.");
        return false;
      }
      if (isAircraftCategory(line.expenseCategoryId) && line.aircraftAssetId === "") {
        setSubmitError("Select aircraft type for all aircraft requests.");
        return false;
      }
      if (line.inventoryId === "") {
        setSubmitError("Select item description for all requests.");
        return false;
      }
      const qty = Number(line.quantity);
      if (line.quantity.trim().length === 0 || Number.isNaN(qty) || qty <= 0) {
        setSubmitError("Enter valid quantity for all requests.");
        return false;
      }
    }

    setSubmitError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmitError(null);
    if (!validate()) return;

    try {
      await createRequisition({
        items: lines.map((line) => ({
          inventory_id: line.inventoryId as number,
          quantity: Number(line.quantity),
        })),
      }).unwrap();

      handleExit();
    } catch {
      setSubmitError("Failed to send requisition. Please try again.");
    }
  };

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            ADD REQUEST
          </h1>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-300 hover:text-white"
        >
          <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
          <span>Save &amp; Exit</span>
        </button>
      </div>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-gray-300 uppercase">
            <span>Requisitions</span>
            <button
              type="button"
              onClick={handleAddLine}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm transition-colors font-semibold"
            >
              <Icon icon="mdi:plus" className="w-3.5 h-3.5 text-white" />
              <span>Add</span>
            </button>
          </div>

          <div className="mt-4 space-y-6">
            {lines.map((line, index) => {
              const showAircraftType = isAircraftCategory(line.expenseCategoryId);

              const availableInventories =
                line.expenseCategoryId === ""
                  ? []
                  : inventories.filter(
                      (inv) => inv.expense_category_id === line.expenseCategoryId,
                    );

              return (
                <div key={line.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs font-semibold tracking-wide text-white uppercase">
                      REQUEST {index + 1}
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:border-red-900/40 transition-colors shadow-xs"
                        title="Remove request"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] text-gray-400 uppercase">
                      Select Stock Type
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-200">
                      {isCategoriesLoading && (
                        <span className="text-gray-500">Loading categories...</span>
                      )}
                      {expenseCategories.map((category) => (
                        <label
                          key={category.id}
                          className="inline-flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`stock-type-${line.id}`}
                            className="form-radio text-[#7FD5FF]"
                            checked={line.expenseCategoryId === category.id}
                            onChange={() =>
                              updateLine(index, {
                                expenseCategoryId: category.id,
                                aircraftAssetId: "",
                                inventoryId: "",
                              })
                            }
                          />
                          <span>{formatCategoryName(category.name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid gap-4",
                      showAircraftType ? "lg:grid-cols-3" : "lg:grid-cols-2",
                    )}
                  >
                    {showAircraftType && (
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">
                          Aircraft Type
                        </label>
                        <div className="relative">
                          <select
                            value={line.aircraftAssetId}
                            onChange={(e) =>
                              updateLine(index, {
                                aircraftAssetId: e.target.value
                                  ? Number(e.target.value)
                                  : "",
                              })
                            }
                            className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-[#7FD5FF] appearance-none"
                          >
                            <option value="">Select</option>
                            {aircraftAssets.map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.name}
                              </option>
                            ))}
                          </select>
                          <Icon
                            icon="mdi:chevron-down"
                            className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] text-gray-400">
                          Item Description
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenAddInventory(index)}
                          className="inline-flex items-center gap-1 text-[11px] text-[#7FD5FF] hover:text-white transition-colors"
                        >
                          <Icon icon="mdi:plus-circle-outline" className="w-3.5 h-3.5" />
                          Add Inventory
                        </button>
                      </div>
                      <div className="relative">
                        <select
                          value={line.inventoryId}
                          onChange={(e) =>
                            updateLine(index, {
                              inventoryId: e.target.value
                                ? Number(e.target.value)
                                : "",
                            })
                          }
                          disabled={isInventoriesLoading}
                          className={cn(
                            "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-[#7FD5FF] appearance-none",
                            isInventoriesLoading && "opacity-70 cursor-not-allowed",
                          )}
                        >
                          <option value="">
                            {isInventoriesLoading ? "Loading..." : "Select"}
                          </option>
                          {availableInventories.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {(
                                inv.description ||
                                inv.part_name ||
                                "Item"
                              ).trim()}{" "}
                              ({inv.part_number})
                            </option>
                          ))}
                        </select>
                        <Icon
                          icon="mdi:chevron-down"
                          className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(index, { quantity: e.target.value })
                        }
                        min={1}
                        className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]"
                        placeholder="Enter Quantity"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {submitError && (
            <div className="mt-4 text-[11px] text-red-400">{submitError}</div>
          )}

          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                "px-8 sm:px-12 py-3 rounded bg-[#0369A1] text-white text-xs sm:text-sm font-bold hover:bg-[#0369A1]/90 transition-colors",
                isSubmitting && "opacity-70 cursor-not-allowed",
              )}
            >
              {isSubmitting ? "Sending..." : "Send Requisition"}
            </button>
          </div>
        </div>
      </section>

      {addInventoryLineIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase">
                Add Inventory Item
              </h2>
              <button
                type="button"
                onClick={handleCloseAddInventory}
                className="text-gray-400 hover:text-white"
              >
                <Icon icon="mdi:close" className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">
                  Part Number
                </label>
                <input
                  type="text"
                  value={newInventoryDraft.part_number}
                  onChange={(e) =>
                    setNewInventoryDraft((prev) => ({
                      ...prev,
                      part_number: e.target.value,
                    }))
                  }
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-[#7FD5FF]"
                  placeholder="Enter Part Number"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-gray-400">
                  Description
                </label>
                <input
                  type="text"
                  value={newInventoryDraft.description}
                  onChange={(e) =>
                    setNewInventoryDraft((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-[#7FD5FF]"
                  placeholder="Enter Description"
                />
              </div>
            </div>

            {addInventoryError && (
              <div className="text-[11px] text-red-400">{addInventoryError}</div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseAddInventory}
                className="rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateInventory}
                disabled={isCreatingInventory}
                className={cn(
                  "inline-flex items-center gap-2 rounded bg-[#0369A1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0369A1]/90 transition-colors",
                  isCreatingInventory && "opacity-70 cursor-not-allowed",
                )}
              >
                <Icon
                  icon={isCreatingInventory ? "mdi:loading" : "mdi:check-bold"}
                  className={cn("w-4 h-4", isCreatingInventory && "animate-spin")}
                />
                {isCreatingInventory ? "Adding..." : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
