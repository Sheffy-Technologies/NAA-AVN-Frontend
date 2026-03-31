import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetInventoryByIdQuery,
  useUpdateInventoryStockMutation,
  type InventoryItem,
} from "@/features/inventory/api";

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
      <div className="w-full max-w-md bg-[#001219] border border-[#0A4D66]/60 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:database-plus" className="w-4 h-4 text-[#7FD5FF]" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
              Update Stock
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Close update stock modal"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4 text-xs sm:text-sm text-gray-200">
          <div className="space-y-1">
            <div className="text-[11px] uppercase text-gray-400">
              Inventory ID: {inventory.id}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-gray-400">Part Name:</p>
                <p className="font-semibold text-white">
                  {inventory.part_name || inventory.part_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400">Category:</p>
                <p className="font-semibold text-white">
                  {inventory.expense_category?.name || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-gray-400">
              Adjustment Type
            </p>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="adjustmentType"
                  className="form-radio text-[#7FD5FF]"
                  checked={adjustmentType === "add"}
                  onChange={() => setAdjustmentType("add")}
                />
                <span>Add Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="adjustmentType"
                  className="form-radio text-[#7FD5FF]"
                  checked={adjustmentType === "remove"}
                  onChange={() => setAdjustmentType("remove")}
                />
                <span>Remove Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="adjustmentType"
                  className="form-radio text-[#7FD5FF]"
                  checked={adjustmentType === "audit"}
                  onChange={() => setAdjustmentType("audit")}
                />
                <span>Audit Stock</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-gray-400">Quantity</p>
            <input
              type="number"
              value={quantity}
              onChange={handleQuantityChange}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              placeholder="Enter Quantity"
              min={1}
            />
            <div className="flex items-center gap-2 text-[11px] text-gray-300">
              <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
              <span>
                New Stock Level{" "}
                <span className="font-semibold text-white">{newStockLevel}</span>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-gray-400">
              Reason (Optional)
            </p>
            <input
              type="text"
              value={reason}
              onChange={handleReasonChange}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              placeholder="e.g. Received shipment"
            />
          </div>

          {submitError ? (
            <p className="text-[11px] text-red-400">{submitError}</p>
          ) : null}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-[#0A4D66]/40 bg-[#000f18] flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-3 py-1.5 rounded border border-[#0A4D66]/50 text-gray-300 text-xs sm:text-sm hover:bg-[#0A4D66]/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={cn(
              "px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors",
              isLoading
                ? "bg-[#7FD5FF]/40 text-black/60 cursor-not-allowed"
                : "bg-[#7FD5FF] text-black hover:bg-[#7FD5FF]/90",
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

  if (normalized === "high") return "text-emerald-400";
  if (normalized === "medium") return "text-amber-300";
  if (normalized === "low") return "text-red-400";

  return "text-gray-300";
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

const mapStockTypeLabel = (stockType: string) => {
  if (stockType === "in_stock") return "In Stock";
  if (stockType === "out_of_stock") return "Out of Stock";
  return stockType.replaceAll("_", " ");
};

const mapStockTypeColor = (stockType: string) => {
  if (stockType === "in_stock") return "text-emerald-300";
  if (stockType === "out_of_stock") return "text-red-300";
  return "text-gray-300";
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
  const { id } = useParams<{ id: string }>();
  const [isUpdateStockModalOpen, setIsUpdateStockModalOpen] = useState(false);

  const {
    data: inventory,
    isLoading,
    isError,
    refetch,
  } = useGetInventoryByIdQuery(id ?? "", {
    skip: !id,
  });

  const stockLevelColor = useMemo(
    () => (inventory ? mapStockLevelColor(inventory.stock_level) : "text-gray-300"),
    [inventory],
  );

  const stockHistory = useMemo(() => {
    if (!inventory?.stocks) return [];
    return [...inventory.stocks].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [inventory]);

  const handleBack = () => {
    navigate("/dashboard/inventory");
  };

  const handleEdit = () => {
    if (!id) return;
    navigate(`/dashboard/inventory/${id}/edit`);
  };

  if (!id || isError) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
          <div className="p-6 text-center text-gray-400">
            Failed to load inventory.
          </div>
        </section>
      </div>
    );
  }

  if (isLoading || !inventory) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Stock Info
            </span>
          </div>
          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
              <div className="h-64 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
              <div className="h-64 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
                Stock Info
              </span>
              <span className="text-[11px] text-gray-400">
                Inventory ID{inventory.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUpdateStockModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:database-plus" className="w-4 h-4" />
              <span>Update Stock</span>
            </button>
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
            <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] uppercase text-gray-400">
                    Inventory Info
                  </div>
                  <div className="mt-1 text-sm sm:text-base font-semibold text-white">
                    {inventory.part_name}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Part No. {inventory.part_number}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-[11px] text-gray-300">
                  <span>{inventory.unit?.name}</span>
                  <span className="text-gray-400">Category</span>
                  <span>{inventory.expense_category?.name}</span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">NSN:</span>
                    <span className="font-semibold">
                      {inventory.nsn_number || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">ATA Chapter:</span>
                    <span className="font-semibold">
                      {inventory.ata_chapter || "-"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Expiry Date:</span>
                    <span className="font-semibold">
                      {inventory.expiry_date || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Created At:</span>
                    <span className="font-semibold">
                      {inventory.created_at.split("T")[0]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Updated At:</span>
                    <span className="font-semibold">
                      {inventory.updated_at.split("T")[0]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
              <div className="text-[11px] uppercase text-gray-400 mb-3">
                Stock Summary
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">Re-Order Level:</span>
                  <span className="text-base font-semibold text-gray-100">
                    {inventory.re_order_level}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">Quantity in-stock:</span>
                  <span className="text-base font-semibold text-gray-100">
                    {inventory.current_stock}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">Stock Level:</span>
                  <span className={cn("text-base font-semibold", stockLevelColor)}>
                    {inventory.stock_level}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase text-gray-400">
                Stock Update History
              </div>
              <div className="text-[11px] text-gray-400">
                {stockHistory.length} record{stockHistory.length === 1 ? "" : "s"}
              </div>
            </div>

            {stockHistory.length === 0 ? (
              <div className="rounded-md border border-[#0A4D66]/30 bg-[#001219] px-3 py-4 text-center text-gray-400">
                No stock updates yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-130 text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] uppercase text-gray-400 border-b border-[#0A4D66]/30">
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
                        className="border-b border-[#0A4D66]/20 last:border-b-0"
                      >
                        <td className="py-2 pr-3 text-gray-300">{item.id}</td>
                        <td
                          className={cn(
                            "py-2 pr-3 font-medium",
                            mapStockTypeColor(item.stock_type),
                          )}
                        >
                          {mapStockTypeLabel(item.stock_type)}
                        </td>
                        <td className="py-2 pr-3 text-gray-100 font-semibold">
                          {item.quantity}
                        </td>
                        <td className="py-2 pr-3 text-gray-300">
                          {formatStockHistoryUserName(item.user)}
                        </td>
                        <td className="py-2 pr-3 text-gray-300">
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
    </div>
  );
};

