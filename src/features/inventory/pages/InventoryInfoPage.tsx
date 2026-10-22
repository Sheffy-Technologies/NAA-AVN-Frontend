import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import {
  useGetInventoryByIdQuery,
  useUpdateInventoryStockMutation,
  useDeleteInventoryMutation,
  type InventoryItem,
} from "@/features/inventory/api";
import { BackButton } from "@/shared/ui/button";
import { formatCategoryName, formatAtaChapter } from "../inventoryUtils";

type UpdateStockAdjustmentType = "add" | "remove" | "audit";

type UpdateStockModalProps = {
  inventory: InventoryItem;
  onClose: (shouldRefresh?: boolean) => void;
};

const UpdateStockModal = ({ inventory, onClose }: UpdateStockModalProps) => {
  const [adjustmentType, setAdjustmentType] =
    useState<UpdateStockAdjustmentType>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [updateInventoryStock, { isLoading }] =
    useUpdateInventoryStockMutation();

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuantity(event.target.value);
    setSubmitError(null);
  };

  const handleReasonChange = (event: ChangeEvent<HTMLInputElement>) => {
    setReason(event.target.value);
    setSubmitError(null);
  };

  const parsedQuantity = quantity.trim().length > 0 ? Number(quantity) : 0;

  const isQuantityInvalid =
    quantity.trim().length === 0 ||
    Number.isNaN(parsedQuantity) ||
    parsedQuantity <= 0;

  let newStockLevel = inventory.current_stock;

  if (!Number.isNaN(parsedQuantity) && parsedQuantity > 0) {
    if (adjustmentType === "add") {
      newStockLevel = inventory.current_stock + parsedQuantity;
    } else if (adjustmentType === "remove") {
      newStockLevel = Math.max(0, inventory.current_stock - parsedQuantity);
    } else {
      newStockLevel = parsedQuantity;
    }
  }

  const handleSubmit = async () => {
    setSubmitError(null);
    if (isQuantityInvalid) {
      setSubmitError("Enter a valid quantity greater than zero.");
      return;
    }

    let finalQuantity = parsedQuantity;
    let finalStockType: "in_stock" | "out_of_stock" =
      adjustmentType === "remove" ? "out_of_stock" : "in_stock";

    if (adjustmentType === "audit") {
      const diff = parsedQuantity - inventory.current_stock;
      if (diff === 0) {
        onClose(false);
        return;
      }
      finalQuantity = Math.abs(diff);
      finalStockType = diff > 0 ? "in_stock" : "out_of_stock";
    }

    try {
      await updateInventoryStock({
        inventory_id: inventory.id,
        stock_type: finalStockType,
        quantity: finalQuantity,
      }).unwrap();

      onClose(true);
    } catch {
      setSubmitError("Failed to update stock. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/60 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001219]">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:database-plus" className="w-4 h-4 text-[#0369A1] dark:text-[#7FD5FF]" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-slate-900 dark:text-white uppercase">
              Update Stock
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Close update stock modal"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-200 dark:hover:bg-[#0A4D66]/40 text-slate-500 hover:text-slate-800 dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4 text-xs sm:text-sm text-slate-700 dark:text-gray-200">
          <div className="space-y-1">
            <div className="text-[11px] uppercase text-slate-500 dark:text-gray-400">
              Inventory ID: {inventory.id}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">Item Description / Part:</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {inventory.description || inventory.part_name || inventory.part_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500 dark:text-gray-400">Category:</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {formatCategoryName(inventory.expense_category?.name)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-slate-500 dark:text-gray-400">
              Adjustment Type
            </p>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-gray-200">
                <input
                  type="radio"
                  name="adjustmentType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={adjustmentType === "add"}
                  onChange={() => setAdjustmentType("add")}
                />
                <span>Add Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-gray-200">
                <input
                  type="radio"
                  name="adjustmentType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={adjustmentType === "remove"}
                  onChange={() => setAdjustmentType("remove")}
                />
                <span>Remove Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-gray-200">
                <input
                  type="radio"
                  name="adjustmentType"
                  className="form-radio text-[#0369A1] dark:text-[#7FD5FF]"
                  checked={adjustmentType === "audit"}
                  onChange={() => setAdjustmentType("audit")}
                />
                <span>Audit Stock</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-slate-500 dark:text-gray-400">Quantity</p>
            <input
              type="number"
              value={quantity}
              onChange={handleQuantityChange}
              className="w-full bg-white dark:bg-[#001825] border border-slate-300 dark:border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1]"
              placeholder="Enter Quantity"
              min={1}
            />
            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-gray-300">
              <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
              <span>
                New Stock Level{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{newStockLevel}</span>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-slate-500 dark:text-gray-400">
              Reason (Optional)
            </p>
            <input
              type="text"
              value={reason}
              onChange={handleReasonChange}
              className="w-full bg-white dark:bg-[#001825] border border-slate-300 dark:border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1]"
              placeholder="e.g. Received shipment"
            />
          </div>

          {submitError ? (
            <p className="text-[11px] text-red-500 dark:text-red-400">{submitError}</p>
          ) : null}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001219] flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm",
              isLoading
                ? "bg-[#0369A1]/40 text-white/60 cursor-not-allowed"
                : "bg-[#0369A1] text-white hover:bg-[#0369A1]/90",
            )}
          >
            {isLoading ? "Updating..." : "Update Stock"}
          </button>
        </div>
      </div>
    </div>
  );
};

const mapStockLevelColor = (level: string) => {
  const normalized = level.toLowerCase();

  if (normalized === "high") return "text-emerald-600 dark:text-emerald-400";
  if (normalized === "medium") return "text-amber-600 dark:text-amber-300";
  if (normalized === "low" || normalized === "out of stock") return "text-red-600 dark:text-red-400";

  return "text-slate-700 dark:text-gray-300";
};

const formatStockHistoryDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "-";
  return parsedDate.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatIsoDateOnly = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.split("T")[0] || "-";
};

const mapStockTypeLabel = (stockType: string) => {
  if (stockType === "in_stock") return "In Stock";
  if (stockType === "out_of_stock") return "Out of Stock";
  return stockType.replaceAll("_", " ");
};

const mapStockTypeColor = (stockType: string) => {
  if (stockType === "in_stock") return "text-emerald-600 dark:text-emerald-300";
  if (stockType === "out_of_stock") return "text-red-600 dark:text-red-300";
  return "text-slate-600 dark:text-gray-300";
};

const formatStockHistoryUserName = (
  user:
    | {
        firstname: string | null;
        lastname: string | null;
      }
    | null
    | undefined,
) => {
  if (!user) return "-";
  const fullName = [user.firstname, user.lastname]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");
  return fullName || "-";
};

export const InventoryInfoPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const [isUpdateStockModalOpen, setIsUpdateStockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const isInvalidId = !id || id === "new" || id === "add";

  useEffect(() => {
    if (id === "new" || id === "add") {
      navigate("/dashboard/inventory/add", { replace: true });
    }
  }, [id, navigate]);

  const {
    data: inventory,
    isLoading,
    isError,
    refetch,
  } = useGetInventoryByIdQuery(id ?? "", {
    skip: isInvalidId,
  });

  const [deleteInventory, { isLoading: isDeleting }] = useDeleteInventoryMutation();

  const stockLevelColor = useMemo(
    () => (inventory ? mapStockLevelColor(inventory.stock_level) : "text-slate-700 dark:text-gray-300"),
    [inventory],
  );

  const stockHistory = useMemo(() => {
    if (!inventory?.stocks) return [];
    return [...inventory.stocks].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [inventory]);

  const [unitSearchQuery, setUnitSearchQuery] = useState("");

  const filteredUnits = useMemo(() => {
    if (!inventory?.units) return [];
    if (!unitSearchQuery.trim()) return inventory.units;
    const q = unitSearchQuery.toLowerCase();
    return inventory.units.filter(
      (u) =>
        u.serial_number?.toLowerCase().includes(q) ||
        u.part_number?.toLowerCase().includes(q) ||
        u.cage_code?.toLowerCase().includes(q) ||
        u.nsn?.toLowerCase().includes(q) ||
        u.alternate_support_part_no?.toLowerCase().includes(q) ||
        String(u.unit_index).includes(q),
    );
  }, [inventory?.units, unitSearchQuery]);

  const handleCopyAllSerials = () => {
    if (!inventory?.units || inventory.units.length === 0) return;
    const serialsList = inventory.units
      .map((u, i) => `${i + 1}. ${u.serial_number || "-"}`)
      .join("\n");
    navigator.clipboard.writeText(serialsList);
    dispatch(
      showToast({
        message: `Copied ${inventory.units.length} item identifications to clipboard`,
        type: "success",
      }),
    );
  };

  const handleEdit = () => {
    if (!id) return;
    navigate(`/dashboard/inventory/${id}/edit`, {
      state: {
        from: `/dashboard/inventory/${id}`,
        fromLabel: inventory?.part_name || inventory?.description || "Inventory Item",
      },
    });
  };

  const handleDownload = () => {
    if (!inventory) return;
    const headers = ["Field", "Value"];
    const rows = [
      ["Inventory ID", String(inventory.id)],
      ["Part Number", inventory.part_number || "-"],
      ["Serial Number", inventory.serial_number || "-"],
      ["NSN", inventory.nsn || inventory.nsn_number || "-"],
      ["ATA Chapter", formatAtaChapter(inventory.ata_chapter || inventory.ata_chapter_rel)],
      ["Description", inventory.description || inventory.part_name || "-"],
      ["Category", formatCategoryName(inventory.expense_category?.name || (inventory as { category?: string })?.category)],
      ["Stock Type", inventory.store || "-"],
      ["Current Stock", String(inventory.current_stock ?? 0)],
      ["Unit", inventory.unit?.name || inventory.measurement_unit || "-"],
      ["Re-Order Level", String(inventory.re_order_level ?? 0)],
      ["Unit Cost", String(inventory.unit_cost ?? 0)],
      ["Stock Level Status", inventory.stock_level || "-"],
      ["Date Received", inventory.date_received || "-"],
      ["Expiry Date", inventory.expiry_date || "-"],
      ["Remark", inventory.remark || "-"],
    ];
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-item-${inventory.part_number || inventory.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    dispatch(showToast({ message: "Stock info downloaded successfully", type: "success" }));
  };

  const handleDeleteConfirm = async () => {
    if (!inventory?.id) return;
    try {
      await deleteInventory(String(inventory.id)).unwrap();
      dispatch(showToast({ message: "Inventory item deleted successfully", type: "success" }));
      navigate("/dashboard/inventory");
    } catch {
      dispatch(showToast({ message: "Failed to delete inventory item", type: "error" }));
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  if (!id || isError) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-xs">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] flex items-center justify-between">
            <BackButton fallbackUrl="/dashboard/inventory" />
          </div>
          <div className="p-6 text-center text-slate-500 dark:text-gray-400">
            Failed to load inventory.
          </div>
        </section>
      </div>
    );
  }

  if (isLoading || !inventory) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-xs">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] flex items-center justify-between">
            <BackButton fallbackUrl="/dashboard/inventory" />
            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">
              Stock Info
            </span>
          </div>
          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
              <div className="h-64 bg-slate-100 dark:bg-[#001825] border border-slate-200 dark:border-[#0A4D66]/40 rounded-lg animate-pulse" />
              <div className="h-64 bg-slate-100 dark:bg-[#001825] border border-slate-200 dark:border-[#0A4D66]/40 rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton fallbackUrl="/dashboard/inventory" />
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-semibold tracking-wide text-slate-900 dark:text-white uppercase">
                Stock Info
              </span>
              <span className="text-[11px] text-slate-500 dark:text-gray-400">
                Inventory ID{inventory.id}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              title="Download Stock Info CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span className="font-semibold">Download</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              title="Delete Item"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border border-red-300 dark:border-red-500/40 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-400 dark:hover:border-red-400 shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="font-semibold">Delete</span>
            </button>
            <button
              type="button"
              onClick={() => setIsUpdateStockModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0369A1] hover:bg-[#0369A1]/90 text-white text-xs sm:text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <Icon icon="mdi:database-plus" className="w-4 h-4 text-white" />
              <span>Update Stock</span>
            </button>
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0369A1] hover:bg-[#0369A1]/90 text-white text-xs sm:text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4 text-white" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
            <div className="bg-white dark:bg-[#001825] border border-slate-200 dark:border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-slate-700 dark:text-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] uppercase text-slate-500 dark:text-gray-400">
                    Inventory Info
                  </div>
                  <div className="mt-1 text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                    {inventory.description || inventory.part_name || `Part #${inventory.part_number}`}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400">
                    Part No. {inventory.part_number}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600 dark:text-gray-300">
                  <span className="font-medium text-slate-900 dark:text-white">{inventory.unit?.name || "-"}</span>
                  <span className="text-slate-500 dark:text-gray-400">Category</span>
                  <span className="font-medium text-slate-900 dark:text-white">{formatCategoryName(inventory.expense_category?.name)}</span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-slate-200 dark:border-[#0A4D66]/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Item Description:</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-right max-w-[60%] truncate" title={inventory.description || inventory.part_name || "-"}>
                      {inventory.description || inventory.part_name || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Serial No.:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.serial_number || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">NSN:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.nsn || inventory.nsn_number || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">ATA Chapter:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatAtaChapter(inventory.ata_chapter || inventory.ata_chapter_rel)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Stock Type:</span>
                    <span className="font-semibold text-slate-900 dark:text-white capitalize">
                      {inventory.store || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Date Received:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.date_received || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Expiry Date:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.expiry_date || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Created At:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatIsoDateOnly(inventory.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Updated At:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatIsoDateOnly(inventory.updated_at)}
                    </span>
                  </div>
                </div>
              </div>

              {inventory.description && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#0A4D66]/30">
                  <div className="text-[11px] uppercase text-slate-500 dark:text-gray-400">Full Description</div>
                  <div className="mt-1 text-xs text-slate-800 dark:text-gray-200 leading-relaxed font-normal">
                    {inventory.description}
                  </div>
                </div>
              )}

              {inventory.remark && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#0A4D66]/20">
                  <div className="text-[11px] uppercase text-slate-500 dark:text-gray-400">Remark</div>
                  <div className="mt-0.5 text-xs text-slate-700 dark:text-gray-300">
                    {inventory.remark}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#001825] border border-slate-200 dark:border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-slate-700 dark:text-gray-200 shadow-xs">
              <div className="text-[11px] uppercase text-slate-500 dark:text-gray-400 mb-3">
                Stock Summary
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-gray-400">Re-Order Level:</span>
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    {inventory.re_order_level}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-gray-400">Quantity in-stock:</span>
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    {inventory.current_stock}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-gray-400">Stock Level:</span>
                  <span className={cn("text-base font-semibold", stockLevelColor)}>
                    {inventory.stock_level}
                  </span>
                </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-[#0A4D66]/20">
                    <span className="text-slate-500 dark:text-gray-400">Unit Cost:</span>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {inventory.currency?.symbol || inventory.currency_code || "$"}
                      {inventory.unit_cost ?? "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Unit of Issue:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.unit_of_issue || inventory.measurement_unit || "EA"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Special Storage:</span>
                    <span className="font-semibold text-slate-900 dark:text-white capitalize">
                      {inventory.special_storage || "Standard"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Lead Time:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.lead_time_days ? `${inventory.lead_time_days} ${inventory.lead_time_unit || 'days'}` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">CAGE Code:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.cage_code || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Manufacturer:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.manufacturer || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-gray-400">Supplier:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {inventory.supplier?.name || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          {/* Shelf Life & Life Limit Details */}
          {(inventory.shelf_life_types?.length || inventory.life_limit_types?.length) ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {inventory.shelf_life_types && inventory.shelf_life_types.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
                    <Icon icon="mdi:clock-fast" className="w-4 h-4 text-amber-500" />
                    <span>Shelf Life Tracking</span>
                  </div>
                  <div className="space-y-1 text-slate-700 dark:text-gray-300">
                    <div>
                      Dimensions: <span className="font-semibold uppercase">{inventory.shelf_life_types.join(", ")}</span>
                    </div>
                    {inventory.shelf_life_hours && (
                      <div>Hours Limit: <span className="font-semibold">{inventory.shelf_life_hours} hrs</span></div>
                    )}
                    {inventory.shelf_life_cycles && (
                      <div>Cycles Limit: <span className="font-semibold">{inventory.shelf_life_cycles} cycles</span></div>
                    )}
                    {inventory.shelf_life_calendar_value && (
                      <div>Calendar Duration: <span className="font-semibold">{inventory.shelf_life_calendar_value} {inventory.shelf_life_calendar_interval}</span></div>
                    )}
                    {inventory.shelf_life_start_date && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        Started: {new Date(inventory.shelf_life_start_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {inventory.life_limit_types && inventory.life_limit_types.length > 0 && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-200 uppercase tracking-wide">
                    <Icon icon="mdi:shield-alert-outline" className="w-4 h-4 text-rose-500" />
                    <span>Life Limited (LLP) Thresholds</span>
                  </div>
                  <div className="space-y-1 text-slate-700 dark:text-gray-300">
                    <div>
                      Dimensions: <span className="font-semibold uppercase">{inventory.life_limit_types.join(", ")}</span>
                    </div>
                    {inventory.life_limit_hours && (
                      <div>Max Hours: <span className="font-semibold">{inventory.life_limit_hours} hrs</span></div>
                    )}
                    {inventory.life_limit_cycles && (
                      <div>Max Cycles: <span className="font-semibold">{inventory.life_limit_cycles} cycles</span></div>
                    )}
                    {inventory.life_limit_calendar_value && (
                      <div>Max Duration: <span className="font-semibold">{inventory.life_limit_calendar_value} {inventory.life_limit_calendar_interval}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Item Identification / Serialized Units Matrix */}
          {inventory.units && inventory.units.length > 0 ? (
            <div className="mt-6 bg-white dark:bg-[#001825] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl p-4 sm:p-5 text-xs sm:text-sm text-slate-700 dark:text-gray-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-200 dark:border-[#0A4D66]/30 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-300">
                    <Icon icon="mdi:barcode-scan" className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Item Identification Matrix</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                        {inventory.units.length} {inventory.units.length === 1 ? "Unit" : "Units"}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Individual item tracking, serial number assignment, and status
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={unitSearchQuery}
                      onChange={(e) => setUnitSearchQuery(e.target.value)}
                      placeholder="Filter serials or P/N..."
                      className="rounded-lg pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#001219] border border-slate-300 dark:border-[#0A4D66]/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <Icon
                      icon="mdi:magnify"
                      className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAllSerials}
                    title="Copy all serial numbers to clipboard"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors shadow-xs"
                  >
                    <Icon icon="mdi:content-copy" className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy All ({inventory.units.length})</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-[#0A4D66]/30 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50/80 dark:bg-[#001219]/90 tracking-wider">
                      <th className="py-2.5 px-3 w-14">#</th>
                      <th className="py-2.5 px-3">Item Identification / Serial No</th>
                      <th className="py-2.5 px-3">Part Number</th>
                      <th className="py-2.5 px-3">CAGE Code</th>
                      <th className="py-2.5 px-3">NSN</th>
                      <th className="py-2.5 px-3">Alt Support P/N</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#0A4D66]/20">
                    {filteredUnits.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-xs text-slate-500 dark:text-gray-400">
                          No item identification matches &ldquo;{unitSearchQuery}&rdquo;
                        </td>
                      </tr>
                    ) : (
                      filteredUnits.map((u, idx) => (
                        <tr
                          key={u.id || idx}
                          className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-600 dark:text-gray-300">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#0A4D66]/30 text-slate-700 dark:text-slate-300">
                              {u.unit_index || idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-sky-600 dark:text-sky-400 text-xs sm:text-sm">
                              <span>{u.serial_number || "-"}</span>
                              {u.serial_number && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(u.serial_number);
                                    dispatch(showToast({ message: `Copied ${u.serial_number}`, type: "success" }));
                                  }}
                                  title="Copy Serial Number"
                                  className="text-slate-400 hover:text-sky-500 p-0.5 rounded transition-colors"
                                >
                                  <Icon icon="mdi:content-copy" className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-gray-200">
                            {u.part_number || inventory.part_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400 font-mono text-[11px]">
                            {u.cage_code || inventory.cage_code || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400 font-mono text-[11px]">
                            {u.nsn || inventory.nsn || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400">
                            {u.alternate_support_part_no || inventory.alternate_support_part_no || "-"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 capitalize border border-emerald-300 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{u.status || "available"}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (inventory.is_serialized || formatCategoryName(inventory.expense_category?.name).toLowerCase().includes("spare") || inventory.serial_number) ? (
            <div className="mt-6 bg-white dark:bg-[#001825] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl p-4 sm:p-5 text-xs sm:text-sm text-slate-700 dark:text-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#0A4D66]/30 pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:barcode-scan" className="w-5 h-5 text-sky-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                    Item Identification ({inventory.current_stock || 1} Total In Stock)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-100"
                >
                  <Icon icon="mdi:pencil-outline" className="w-3.5 h-3.5" />
                  <span>Configure Individual Unit IDs</span>
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-[#0A4D66]/30 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50/80 dark:bg-[#001219]/90 tracking-wider">
                      <th className="py-2.5 px-3 w-14">#</th>
                      <th className="py-2.5 px-3">Item Identification / Serial No</th>
                      <th className="py-2.5 px-3">Part Number</th>
                      <th className="py-2.5 px-3">CAGE Code</th>
                      <th className="py-2.5 px-3">NSN</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-600 dark:text-gray-300">#1</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {inventory.serial_number || "Single Part Tracking"}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-gray-200">
                        {inventory.part_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400 font-mono text-[11px]">
                        {inventory.cage_code || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-gray-400 font-mono text-[11px]">
                        {inventory.nsn || "-"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 capitalize border border-emerald-300 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>available</span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="mt-6 bg-white dark:bg-[#001825] border border-slate-200 dark:border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-slate-700 dark:text-gray-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase text-slate-500 dark:text-gray-400">
                Stock Update History
              </div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400">
                {stockHistory.length} record{stockHistory.length === 1 ? "" : "s"}
              </div>
            </div>

            {stockHistory.length === 0 ? (
              <div className="rounded-md border border-slate-200 dark:border-[#0A4D66]/30 bg-slate-50 dark:bg-[#001219] px-3 py-4 text-center text-slate-500 dark:text-gray-400">
                No stock updates yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-130 text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] uppercase text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-[#0A4D66]/30">
                      <th className="py-2 pr-3 font-medium">ID</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Quantity</th>
                      <th className="py-2 pr-3 font-medium">User</th>
                      <th className="py-2 pr-3 font-medium">Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 dark:border-[#0A4D66]/20 last:border-b-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-2 pr-3 text-slate-600 dark:text-gray-300">{item.id}</td>
                        <td
                          className={cn(
                            "py-2 pr-3 font-medium",
                            mapStockTypeColor(item.stock_type),
                          )}
                        >
                          {mapStockTypeLabel(item.stock_type)}
                        </td>
                        <td className="py-2 pr-3 text-slate-900 dark:text-white font-semibold">
                          {item.quantity}
                        </td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-gray-300">
                          {formatStockHistoryUserName(item.user)}
                        </td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-gray-300">
                          {formatStockHistoryDateTime(item.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {isUpdateStockModalOpen && inventory ? (
        <UpdateStockModal
          inventory={inventory}
          onClose={(shouldRefresh) => {
            setIsUpdateStockModalOpen(false);
            if (shouldRefresh) {
              void refetch();
            }
          }}
        />
      ) : null}

      {isDeleteModalOpen && inventory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                <Icon icon="mdi:alert-circle-outline" className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white text-center">
                Delete Inventory Item?
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-gray-300 text-center leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">Part #{inventory.part_number}</span> (ID: {inventory.id})? This action cannot be undone.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#001825] text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors flex items-center gap-2"
                >
                  {isDeleting && <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />}
                  <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

