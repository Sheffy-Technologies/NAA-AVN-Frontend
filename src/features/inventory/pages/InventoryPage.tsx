import { useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetInventoryDashboardQuery,
  useGetInventoriesQuery,
  useUpdateInventoryStockMutation,
  type InventoryItem,
} from "@/features/inventory/api";

type InventoryViewMode = "table" | "grid";

type InventoryStatusLevel = "High" | "Low" | "Critical" | "Medium" | "Unknown";

type InventoryRow = {
  id: number;
  inventoryId: string;
  partNumber: string;
  partName: string;
  category: string;
  nsn: string;
  ataChapter: string;
  unit: string;
  stockLevel: InventoryStatusLevel;
  currentStock: number;
  reorderLevel: number;
};

const stockLevelBadgeColor: Record<InventoryStatusLevel, string> = {
  High: "bg-emerald-500/20 text-emerald-300",
  Medium: "bg-amber-500/20 text-amber-300",
  Low: "bg-orange-500/20 text-orange-300",
  Critical: "bg-red-500/20 text-red-300",
  Unknown: "bg-gray-500/20 text-gray-300",
};

const stockLevelDotColor: Record<InventoryStatusLevel, string> = {
  High: "bg-emerald-400",
  Medium: "bg-amber-300",
  Low: "bg-orange-300",
  Critical: "bg-red-400",
  Unknown: "bg-gray-400",
};

const mapStockLevel = (value: string | undefined): InventoryStatusLevel => {
  if (!value) return "Unknown";
  const normalized = value.toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  if (normalized === "critical") return "Critical";
  return "Unknown";
};

type UpdateStockAdjustmentType = "add" | "remove" | "audit";

type UpdateStockModalProps = {
  row: InventoryRow;
  onClose: (shouldRefresh?: boolean) => void;
};

const UpdateStockModal = ({ row, onClose }: UpdateStockModalProps) => {
  const [adjustmentType, setAdjustmentType] =
    useState<UpdateStockAdjustmentType>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [updateInventoryStock, { isLoading }] = useUpdateInventoryStockMutation();

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
    quantity.trim().length === 0 || Number.isNaN(parsedQuantity) || parsedQuantity <= 0;

  let newStockLevel = row.currentStock;

  if (!Number.isNaN(parsedQuantity) && parsedQuantity > 0) {
    if (adjustmentType === "add") {
      newStockLevel = row.currentStock + parsedQuantity;
    } else if (adjustmentType === "remove") {
      newStockLevel = Math.max(0, row.currentStock - parsedQuantity);
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

    const stockType =
      adjustmentType === "remove" ? ("out_of_stock" as const) : ("in_stock" as const);

    try {
      await updateInventoryStock({
        inventory_id: row.id,
        stock_type: stockType,
        quantity: parsedQuantity,
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
            className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4 text-xs sm:text-sm text-gray-200">
          <div className="space-y-1">
            <div className="text-[11px] uppercase text-gray-400">
              Inventory ID:{row.inventoryId}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-gray-400">Part Name:</p>
                <p className="font-semibold text-white">{row.partName}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400">Category:</p>
                <p className="font-semibold text-white">{row.category}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-gray-400">Adjustment Type</p>
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
              Reason for Adjustment (optional)
            </p>
            <input
              type="text"
              value={reason}
              onChange={handleReasonChange}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
              placeholder="Enter Reason"
            />
          </div>

          {submitError && (
            <p className="text-[11px] text-red-400">{submitError}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            className={cn(
              "w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors",
              (isLoading || isQuantityInvalid) && "opacity-70 cursor-not-allowed",
            )}
            disabled={isLoading || isQuantityInvalid}
          >
            {isLoading ? "Updating..." : "Confirm Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const InventoryPage = () => {
  const navigate = useNavigate();
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    refetch: refetchDashboard,
  } = useGetInventoryDashboardQuery();
  const {
    data: inventoriesData,
    isLoading: isInventoriesLoading,
    isError: isInventoriesError,
    refetch: refetchInventories,
  } = useGetInventoriesQuery();

  const [viewMode, setViewMode] = useState<InventoryViewMode>("table");
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [updateStockRow, setUpdateStockRow] = useState<InventoryRow | null>(
    null,
  );

  const rows: InventoryRow[] = useMemo(() => {
    if (!inventoriesData) {
      return [];
    }

    return inventoriesData.map((item: InventoryItem) => ({
      id: item.id,
      inventoryId: `INV-${item.id.toString().padStart(4, "0")}`,
      partNumber: item.part_number,
      partName: item.part_name,
      category: item.expense_category.name,
      nsn: item.nsn_number,
      ataChapter: item.ata_chapter,
      unit: item.unit.name,
      stockLevel: mapStockLevel(item.stock_level),
      currentStock: item.current_stock,
      reorderLevel: item.re_order_level,
    }));
  }, [inventoriesData]);

  const recentInventories: InventoryRow[] = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.recent_inventories.map((item) => ({
      id: item.id,
      inventoryId: `INV-${item.id.toString().padStart(4, "0")}`,
      partNumber: item.part_number,
      partName: item.part_name,
      category: item.expense_category.name,
      nsn: item.nsn_number,
      ataChapter: item.ata_chapter,
      unit: item.unit.name,
      stockLevel: mapStockLevel(item.stock_level),
      currentStock: item.current_stock,
      reorderLevel: item.re_order_level,
    }));
  }, [dashboardData]);

  const handleToggleActions = (id: number) => {
    setOpenActionId((current) => (current === id ? null : id));
  };

  const handleAddStock = () => {
    navigate("/dashboard/inventory/add");
  };

  const handleViewStock = (id: number) => {
    navigate(`/dashboard/inventory/${id}`);
  };

  const handleEditStock = (id: number) => {
    navigate(`/dashboard/inventory/${id}/edit`);
  };

  const handleOpenUpdateStock = (row: InventoryRow) => {
    setOpenActionId(null);
    setUpdateStockRow(row);
  };

  const handleCloseUpdateStock = (shouldRefresh?: boolean) => {
    setUpdateStockRow(null);
    if (shouldRefresh) {
      refetchInventories();
      refetchDashboard();
    }
  };

  const totalInStock = dashboardData?.total_stock ?? 0;
  const lowStockItems = dashboardData?.low_stock ?? 0;
  const expiredItems = dashboardData?.expired_items ?? 0;
  const criticalStock = dashboardData?.critical_stock ?? 0;

  const summaryCards = [
    {
      id: "total",
      label: "Total In Stock",
      value: totalInStock,
      icon: "mdi:archive-outline",
      bg: "bg-emerald-700",
    },
    {
      id: "low",
      label: "Low Stock Items",
      value: lowStockItems,
      icon: "mdi:alert-outline",
      bg: "bg-lime-700",
    },
    {
      id: "expired",
      label: "Expired Items",
      value: expiredItems,
      icon: "mdi:skull-outline",
      bg: "bg-amber-700",
    },
    {
      id: "critical",
      label: "Critical",
      value: criticalStock,
      icon: "mdi:alert-octagram-outline",
      bg: "bg-red-800",
    },
  ];

  const isSummaryError = isDashboardError;
  const isTableError = isInventoriesError;

  return (
    <div className="px-2 sm:px-0">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {isDashboardLoading
          ? summaryCards.map((card) => (
              <div
                key={card.id}
                className="h-24 sm:h-28 bg-[#001219] border border-[#0A4D66]/40 rounded-xl flex items-center justify-between px-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 bg-[#021a27] rounded-full animate-pulse" />
                  <div className="h-6 w-16 bg-[#021a27] rounded-full animate-pulse" />
                </div>
                <div className="w-10 h-10 rounded bg-[#021a27] animate-pulse" />
              </div>
            ))
          : summaryCards.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "h-24 sm:h-28 rounded-xl flex items-center justify-between px-4 border border-[#0A4D66]/40",
                  "bg-[#001219]",
                )}
              >
                <div>
                  <p className="text-[11px] sm:text-xs uppercase tracking-wide text-gray-400">
                    {card.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-semibold text-white mt-1">
                    {isSummaryError ? "—" : card.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 rounded flex items-center justify-center",
                    card.bg,
                  )}
                >
                  <Icon icon={card.icon} className="w-5 h-5 text-white" />
                </div>
              </div>
            ))}
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center gap-4">
            <h2 className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
              Inventory
            </h2>
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#021a27] p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "px-2 py-1 rounded-sm flex items-center justify-center",
                  viewMode === "table"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400",
                )}
              >
                <Icon icon="mdi:view-list" className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "px-2 py-1 rounded-sm flex items-center justify-center",
                  viewMode === "grid"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400",
                )}
              >
                <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200"
            >
              {rows.length}
            </button>
            <button
              type="button"
              className="hidden md:inline-flex px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 whitespace-nowrap"
            >
              All Units
            </button>
            <button
              type="button"
              className="hidden md:inline-flex px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 whitespace-nowrap"
            >
              All Category
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
              onClick={handleAddStock}
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Add Stock</span>
            </button>
          </div>
        </div>

        {viewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-gray-200">
              <thead>
                <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 sm:px-6 py-3 text-left">Inventory ID</th>
                  <th className="px-4 py-3 text-left">Part No.</th>
                  <th className="px-4 py-3 text-left">Part Name</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">NSN</th>
                  <th className="px-4 py-3 text-left">ATA Chapter</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">Stock Level</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isInventoriesLoading && rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                        <span>Loading inventory...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 sm:px-6 py-6 text-center text-gray-400"
                    >
                      {isTableError
                        ? "Failed to load inventory."
                        : "No inventory records found."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-[#0A4D66]/40",
                        index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                      )}
                    >
                      <td className="px-4 sm:px-6 py-3 align-middle text-gray-100">
                        {row.inventoryId}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.partNumber}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.partName}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.category}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.nsn}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.ataChapter}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-100">
                        {row.unit}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              stockLevelDotColor[row.stockLevel],
                            )}
                          />
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[11px]",
                              stockLevelBadgeColor[row.stockLevel],
                            )}
                          >
                            {row.stockLevel}
                          </span>
                        </div>
                      </td>
                      <td className="relative px-4 sm:px-6 py-3 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleActions(row.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                        >
                          <Icon icon="mdi:dots-vertical" className="w-5 h-5" />
                        </button>

                        {openActionId === row.id && (
                          <div className="absolute right-4 top-10 z-20 w-48 bg-[#001219] border border-[#0A4D66]/50 rounded-md shadow-xl">
                            <div className="py-1 text-xs text-gray-200">
                              <button
                                type="button"
                                onClick={() => handleViewStock(row.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:eye-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenUpdateStock(row)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:pencil-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditStock(row.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:database-plus"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>Update Stock</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#0A4D66]/40 text-left"
                              >
                                <Icon
                                  icon="mdi:download-outline"
                                  className="w-4 h-4 text-gray-300"
                                />
                                <span>Download</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-left text-red-400"
                              >
                                <Icon
                                  icon="mdi:trash-can-outline"
                                  className="w-4 h-4"
                                />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "grid" && (
          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {isInventoriesLoading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-3 py-3 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="h-3 w-28 bg-[#021a27] rounded-full animate-pulse" />
                        <div className="h-2.5 w-20 bg-[#021a27] rounded-full animate-pulse" />
                      </div>
                      <div className="h-6 w-16 bg-[#021a27] rounded-full animate-pulse" />
                    </div>
                    <div className="space-y-2 text-[11px] text-gray-300">
                      <div className="h-2.5 w-32 bg-[#021a27] rounded-full animate-pulse" />
                      <div className="h-2.5 w-32 bg-[#021a27] rounded-full animate-pulse" />
                      <div className="h-2.5 w-24 bg-[#021a27] rounded-full animate-pulse" />
                    </div>
                  </div>
                ))
              : (recentInventories.length > 0 ? recentInventories : rows).map(
                  (item) => (
                    <div
                      key={item.id}
                      className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-3 py-3 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs font-semibold text-white truncate max-w-[160px]">
                            {item.partName}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            Inventory {item.inventoryId}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap",
                            stockLevelBadgeColor[item.stockLevel],
                          )}
                        >
                          Stock Level: {item.stockLevel}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-300 space-y-1">
                        <p>
                          Quantity In-Stock:{" "}
                          <span className="text-gray-100">
                            {item.currentStock}
                          </span>
                        </p>
                        <p>
                          Re-Order Level:{" "}
                          <span className="text-gray-100">
                            {item.reorderLevel}
                          </span>
                        </p>
                        <p>
                          Unit:{" "}
                          <span className="text-gray-100">{item.unit}</span>
                        </p>
                      </div>
                    </div>
                  ),
                )}
          </div>
        )}
      </section>
      {updateStockRow && (
        <UpdateStockModal row={updateStockRow} onClose={handleCloseUpdateStock} />
      )}
    </div>
  );
};
