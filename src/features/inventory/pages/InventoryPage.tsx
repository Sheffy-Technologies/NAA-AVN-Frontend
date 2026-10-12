import { useMemo, useState, type ChangeEvent, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetInventoriesQuery,
  useUpdateInventoryStockMutation,
  useDeleteInventoryMutation,
  useGetInventoryRequisitionsQuery,
  useGetStockMovementsQuery,
  useGetRfqsQuery,
  useCreateRfqMutation,
  useCreateInventoryMutation,
  useCreateSupplierMutation,
  useGetExpenseCategoriesQuery,
  useGetSupplierQuotationsQuery,
  useGetGoodsReceivedNotesQuery,
  useGetSuppliersQuery,
  useGetPurchaseOrdersQuery,
} from "@/features/inventory/api";
import { useAppDispatch } from "@/app/store";
import { CreatePartsRequisitionModal } from "@/features/inventory/components/CreatePartsRequisitionModal";
import { describeRequisitionItems, requisitionOrigin } from "@/features/inventory/inventoryOptions";
import { showToast } from "@/shared/store/toastSlice";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { FloatingActionMenu } from "@/shared/ui/menu/FloatingActionMenu";
import { DataTable } from "@/shared/ui/table/DataTable";
import {
  ImportCsvModal,
  type ImportCsvField,
} from "@/shared/components/ImportCsvModal";

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
  type: string;
  assetId: number;
  description: string;
  remark: string;
  serialNumber: string;
  lastUpdated: string;
  expiryDate: string | null;
  aircraftType: string;
  measurementUnit: string;
};

type PurchaseOrderListRow = {
  id: number;
  name?: string | null;
  status?: string | null;
  order_date?: string | null;
  expected_date_of_delivery?: string | null;
};

type MultiFilterState<T> = {
  all: boolean;
  selected: T[];
};

const INVENTORY_TABS = [
  { id: "Stocks", label: "All", icon: "mdi:cube-outline" },
  {
    id: "Requisitions",
    label: "Requisitions",
    icon: "mdi:file-document-outline",
  },
  {
    id: "Parts Requisitions",
    label: "Parts Requisitions",
    icon: "mdi:wrench-clock",
  },
  {
    id: "Purchase Orders",
    label: "Purchase Orders",
    icon: "mdi:cart-outline",
  },
  {
    id: "Suppliers",
    label: "Suppliers",
    icon: "mdi:truck-delivery-outline",
  },
] as const;

const STOCK_TABLE_COLUMNS = [
  { key: "description", header: "Item Description", className: "px-6 py-4" },
  { key: "serial", header: "Unit", className: "px-6 py-4" },
  { key: "aircraft", header: "Aircraft Type", className: "px-6 py-4" },
  { key: "category", header: "Category", className: "px-6 py-4" },
  { key: "level", header: "Stock Level", className: "px-6 py-4" },
  {
    key: "current",
    header: "Current Stock",
    className: "px-6 py-4 text-right",
  },
  { key: "updated", header: "Last Updated", className: "px-6 py-4" },
  { key: "action", header: "Action", className: "px-6 py-4 text-right" },
] as const;

const stockLevelColor: Record<InventoryStatusLevel, string> = {
  High: "text-emerald-400",
  Medium: "text-amber-400",
  Low: "text-red-400",
  Critical: "text-orange-500",
  Unknown: "text-gray-400",
};

const stockLevelStripColor: Record<InventoryStatusLevel, string> = {
  High: "bg-emerald-500",
  Medium: "bg-amber-500",
  Low: "bg-red-500",
  Critical: "bg-orange-500",
  Unknown: "bg-gray-500",
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

type RequisitionStatusLabel =
  | "Approved"
  | "Under Review"
  | "Rejected"
  | "Received"
  | "Pending"
  | "Unknown";

const normalizeRequisitionStatus = (status: string | null | undefined) => {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "approved") return "Approved";
  if (
    value === "under_review" ||
    value === "under review" ||
    value === "review"
  )
    return "Under Review";
  if (value === "rejected") return "Rejected";
  if (value === "received") return "Received";
  if (value === "pending") return "Pending";
  if (value.length === 0) return "Unknown";
  return "Unknown";
};

const requisitionStatusColor: Record<RequisitionStatusLabel, string> = {
  Approved: "text-emerald-400",
  "Under Review": "text-amber-400",
  Rejected: "text-red-400",
  Received: "text-sky-400",
  Pending: "text-gray-300",
  Unknown: "text-gray-400",
};

const requisitionStatusDotColor: Record<RequisitionStatusLabel, string> = {
  Approved: "bg-emerald-400",
  "Under Review": "bg-amber-400",
  Rejected: "bg-red-400",
  Received: "bg-sky-400",
  Pending: "bg-gray-400",
  Unknown: "bg-gray-500",
};

const formatDateShort = (isoString: string | null | undefined) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTimeShort = (isoString: string | null | undefined) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const INVENTORY_STORES = [
  "bonded",
  "quarantine",
  "flammable",
  "rubber",
  "others",
] as const;

const INVENTORY_IMPORT_FIELDS: ImportCsvField[] = [
  { key: "description", label: "Item Description", required: true, example: "Main Rotor Blade" },
  { key: "part_number", label: "Part Number", required: true, example: "PN-10234" },
  { key: "serial_number", label: "Serial Number", required: false, example: "SN-98213" },
  { key: "store", label: "Store (bonded/quarantine/flammable/rubber/others)", required: true, example: "bonded" },
  { key: "unit", label: "Unit", required: true, example: "1 Squadron" },
  { key: "category", label: "Category", required: false, example: "Consumables" },
  { key: "aircraft_type", label: "Aircraft Type", required: false, example: "Mi-17" },
  { key: "current_stock", label: "Current Stock", required: true, example: "10" },
  { key: "re_order_level", label: "Reorder Level", required: true, example: "2" },
  { key: "unit_cost", label: "Unit Cost", required: true, example: "1500" },
  { key: "measurement_unit", label: "Measurement Unit", required: true, example: "pcs" },
  { key: "expiry_date", label: "Expiry Date (YYYY-MM-DD)", required: false, example: "2026-12-31" },
  { key: "date_received", label: "Date Received (YYYY-MM-DD)", required: false, example: "2026-01-15" },
  { key: "remark", label: "Remark", required: false, example: "Received in good condition" },
];

const SUPPLIER_IMPORT_FIELDS: ImportCsvField[] = [
  { key: "name", label: "Supplier Name", required: true, example: "Sky Parts Ltd" },
  { key: "contact", label: "Contact", required: false, example: "+234 801 234 5678" },
  { key: "email", label: "Email", required: false, example: "sales@skyparts.com" },
  { key: "address", label: "Address", required: false, example: "12 Airport Road, Lagos" },
];

const downloadCsv = (filename: string, rows: string[][]) => {
  const content = rows
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

    let finalQuantity = parsedQuantity;
    let finalStockType: "in_stock" | "out_of_stock" =
      adjustmentType === "remove" ? "out_of_stock" : "in_stock";

    if (adjustmentType === "audit") {
      const diff = parsedQuantity - row.currentStock;
      if (diff === 0) {
        onClose(false);
        return;
      }
      finalQuantity = Math.abs(diff);
      finalStockType = diff > 0 ? "in_stock" : "out_of_stock";
    }

    try {
      await updateInventoryStock({
        inventory_id: row.id,
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
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#0A4D66]/40 bg-[#001219]">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:database-plus" className="w-4 h-4 text-[#7FD5FF]" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
              Update Stock
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            title="Close update stock modal"
            aria-label="Close update stock modal"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4 text-xs sm:text-sm text-gray-200">
          <div className="space-y-1">
            <div className="text-[11px] uppercase text-gray-400">
              Inventory ID: {row.inventoryId}
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
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="Enter Quantity"
              min={1}
            />
            <div className="flex items-center gap-2 text-[11px] text-gray-300">
              <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
              <span>
                New Stock Level{" "}
                <span className="font-semibold text-white">
                  {newStockLevel}
                </span>
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
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
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
              "w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded bg-[#0369A1] text-black text-xs sm:text-sm font-medium hover:bg-[#0369A1]/90 transition-colors",
              (isLoading || isQuantityInvalid) &&
                "opacity-70 cursor-not-allowed",
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
  const dispatch = useAppDispatch();
  const location = useLocation();
  const initialTab = useMemo(() => {
    const nextTab = (location.state as { inventoryTab?: unknown } | null)
      ?.inventoryTab;
    if (
      typeof nextTab === "string" &&
      INVENTORY_TABS.some((tab) => tab.id === nextTab)
    ) {
      return nextTab;
    }
    return "Stocks";
  }, [location.state]);

  // State for Tabs and Filters
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeSubTab, setActiveSubTab] = useState("all");
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockStatFilter, setStockStatFilter] = useState<
    "all" | "inStock" | "low" | "expired" | "critical"
  >("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [updateStockRow, setUpdateStockRow] = useState<InventoryRow | null>(
    null,
  );
  const [openFilterMenu, setOpenFilterMenu] = useState<"units" | null>(null);
  const [requisitionPeriod, setRequisitionPeriod] = useState<
    "all" | "month" | "quarter" | "year"
  >("all");
  const [requisitionUnitId, setRequisitionUnitId] = useState<number | "">("");
  const [selectedPartRequisitionIds, setSelectedPartRequisitionIds] = useState<
    number[]
  >([]);
  const [selectedRfqSupplierIds, setSelectedRfqSupplierIds] = useState<number[]>([]);
  const [isCreateRequisitionOpen, setIsCreateRequisitionOpen] = useState(false);

  const navigate = useNavigate();
  const [deleteInventory] = useDeleteInventoryMutation();
  const [createRfq, { isLoading: isCreatingPartsRfq }] = useCreateRfqMutation();
  const [createInventory] = useCreateInventoryMutation();
  const { data: expenseCategories = [] } = useGetExpenseCategoriesQuery();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleDeleteInventory = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteInventory(id).unwrap();
      dispatch(showToast({ message: "Item deleted successfully", type: "success" }));
      setOpenActionId(null);
    } catch {
      dispatch(showToast({ message: "Failed to delete item", type: "error" }));
    }
  };

  // Filters State
  const [unitFilter, setUnitFilter] = useState<MultiFilterState<number>>({
    all: true,
    selected: [],
  });

  // Queries
  const { data: units = [] } = useGetUnitsQuery();
  const { data: aircraftAssets = [] } = useGetAssetsQuery({ type: "aircraft" });

  // Memoized filters for API
  const apiFilters = useMemo(() => {
    return {
      units: unitFilter.all ? undefined : unitFilter.selected,
    };
  }, [unitFilter]);

  const {
    data: inventoriesData,
    isLoading: isInventoriesLoading,
    refetch: refetchInventories,
  } = useGetInventoriesQuery(apiFilters, { skip: activeTab !== "Stocks" });

  const handleImportInventoryRow = async (row: Record<string, string>) => {
    const unitMatch = units.find(
      (u) => u.name.trim().toLowerCase() === row.unit.trim().toLowerCase(),
    );
    if (!unitMatch) throw new Error(`Unit "${row.unit}" not found`);

    const categoryMatch = row.category
      ? expenseCategories.find(
          (c) =>
            c.name.trim().toLowerCase() === row.category.trim().toLowerCase(),
        )
      : undefined;
    if (row.category && !categoryMatch) {
      throw new Error(`Category "${row.category}" not found`);
    }

    const aircraftMatch = row.aircraft_type
      ? aircraftAssets.find(
          (a) =>
            a.name.trim().toLowerCase() ===
            row.aircraft_type.trim().toLowerCase(),
        )
      : undefined;
    if (row.aircraft_type && !aircraftMatch) {
      throw new Error(`Aircraft type "${row.aircraft_type}" not found`);
    }

    const store = row.store.trim().toLowerCase();
    if (!(INVENTORY_STORES as readonly string[]).includes(store)) {
      throw new Error(`Store must be one of: ${INVENTORY_STORES.join(", ")}`);
    }

    const currentStock = Number(row.current_stock);
    const reorderLevel = Number(row.re_order_level);
    const unitCost = Number(row.unit_cost);
    if (
      Number.isNaN(currentStock) ||
      Number.isNaN(reorderLevel) ||
      Number.isNaN(unitCost)
    ) {
      throw new Error(
        "Current Stock, Reorder Level, and Unit Cost must be numbers",
      );
    }

    await createInventory({
      store,
      asset_id: aircraftMatch?.id ?? null,
      expense_category_id: categoryMatch?.id ?? null,
      unit_id: unitMatch.id,
      serial_number: row.serial_number ?? "",
      part_number: row.part_number,
      current_stock: currentStock,
      re_order_level: reorderLevel,
      unit_cost: unitCost,
      measurement_unit: row.measurement_unit,
      expiry_date: row.expiry_date || null,
      date_received: row.date_received || null,
      remark: row.remark ?? "",
      description: row.description,
    }).unwrap();
  };

  const requisitionFilters = useMemo(() => {
    return {
      period: requisitionPeriod === "all" ? undefined : requisitionPeriod,
      unit_id: requisitionUnitId === "" ? undefined : requisitionUnitId,
    };
  }, [requisitionPeriod, requisitionUnitId]);

  const { data: requisitionsData, isLoading: isRequisitionsLoading } =
    useGetInventoryRequisitionsQuery(requisitionFilters, {
      skip: activeTab !== "Requisitions",
    });

  const {
    data: suppliersData = [],
    isLoading: isSuppliersLoading,
    refetch: refetchSuppliers,
  } = useGetSuppliersQuery(undefined, {
    skip: activeTab !== "Suppliers" && activeTab !== "Parts Requisitions",
  });

  const [createSupplier] = useCreateSupplierMutation();

  const handleImportSupplierRow = async (row: Record<string, string>) => {
    await createSupplier({
      name: row.name,
      contact: row.contact || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
    }).unwrap();
  };

  const {
    data: stockMovementsData = [],
    isLoading: isPartsRequisitionsLoading,
    refetch: refetchStockMovements,
  } = useGetStockMovementsQuery(undefined, {
    skip: activeTab !== "Parts Requisitions" && activeTab !== "Requisitions",
  });

  const { data: rfqsData = [], refetch: refetchRfqs } = useGetRfqsQuery(
    undefined,
    {
      skip: activeTab !== "Parts Requisitions" && activeTab !== "Requisitions",
    },
  );

  const { data: quotationsData = [] } =
    useGetSupplierQuotationsQuery(undefined, {
      skip: activeTab !== "Parts Requisitions" && activeTab !== "Requisitions",
    });

  const { data: goodsReceivedNotesData = [] } = useGetGoodsReceivedNotesQuery(undefined, {
    skip: activeTab !== "Parts Requisitions" && activeTab !== "Requisitions",
  });

  const {
    data: purchaseOrdersData = [],
    isLoading: isPurchaseOrdersLoading,
    isError: isPurchaseOrdersError,
  } = useGetPurchaseOrdersQuery(undefined, {
    skip:
      activeTab !== "Purchase Orders" &&
      activeTab !== "Parts Requisitions" &&
      activeTab !== "Requisitions",
  });

  // Handlers
  const handleToggleAll =
    <T,>(setState: React.Dispatch<React.SetStateAction<MultiFilterState<T>>>) =>
    (checked: boolean) => {
      if (checked) {
        setState({ all: true, selected: [] });
      } else {
        setState((prev) => ({ all: false, selected: prev.selected }));
      }
    };

  const handleToggleItem =
    <T,>(setState: React.Dispatch<React.SetStateAction<MultiFilterState<T>>>) =>
    (item: T, checked: boolean) => {
      setState((prev) => {
        const newSelected = checked
          ? [...prev.selected, item]
          : prev.selected.filter((i) => i !== item);
        return {
          all: newSelected.length === 0,
          selected: newSelected,
        };
      });
    };

  // Close filters when clicking outside
  const filtersRef = useRef<HTMLDivElement>(null);
  useClickOutside(filtersRef, () => setOpenFilterMenu(null));
  const actionButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const activeActionButtonRef = useRef<HTMLButtonElement | null>(null);

  // Transform data
  const inventoryRows: InventoryRow[] = useMemo(() => {
    if (!inventoriesData) return [];
    return inventoriesData.map((item) => {
      return {
        id: item.id,
        inventoryId: `INV-${item.id.toString().padStart(4, "0")}`,
        partNumber: item.part_number,
        partName: item.description || item.part_name || "N/A",
        category: item.expense_category?.name || "Uncategorized",
        nsn: item.nsn_number || "-",
        ataChapter: item.ata_chapter || "-",
        unit: item.unit?.name || "N/A",
        stockLevel: mapStockLevel(item.stock_level),
        currentStock: item.current_stock,
        reorderLevel: item.re_order_level,
        type: item.type ?? "unknown",
        assetId: item.asset_id,
        description: item.description,
        remark: item.remark,
        serialNumber: item.serial_number || "-",
        lastUpdated: item.updated_at,
        expiryDate: item.expiry_date,
        aircraftType:
          aircraftAssets.find((a) => a.id === item.asset_id)?.name || "-",
        measurementUnit: item.measurement_unit || "Units",
      };
    });
  }, [inventoriesData, aircraftAssets]);

  const stockSubTabs = useMemo(() => {
    const seen = new Set<string>();
    const dynamic: { id: string; label: string }[] = [];
    for (const row of inventoryRows) {
      if (row.category && !seen.has(row.category)) {
        seen.add(row.category);
        dynamic.push({ id: row.category, label: row.category });
      }
    }
    return [{ id: "all", label: "All" }, ...dynamic];
  }, [inventoryRows]);

  const isExpiredRow = (row: InventoryRow) => {
    if (!row.expiryDate) return false;
    const expiryDate = new Date(row.expiryDate);
    return !Number.isNaN(expiryDate.getTime()) && expiryDate < new Date();
  };

  const categorySearchFilteredRows = useMemo(() => {
    const byCategory =
      activeSubTab === "all"
        ? inventoryRows
        : inventoryRows.filter((row) => row.category === activeSubTab);

    const query = stockSearchQuery.trim().toLowerCase();
    if (!query) return byCategory;

    return byCategory.filter((row) =>
      [
        row.description,
        row.partName,
        row.partNumber,
        row.serialNumber,
        row.nsn,
        row.inventoryId,
      ].some((field) => field?.toLowerCase().includes(query)),
    );
  }, [inventoryRows, activeSubTab, stockSearchQuery]);

  const filteredInventoryRows = useMemo(() => {
    switch (stockStatFilter) {
      case "inStock":
        return categorySearchFilteredRows.filter((row) => row.currentStock > 0);
      case "low":
        return categorySearchFilteredRows.filter((row) => row.stockLevel === "Low");
      case "expired":
        return categorySearchFilteredRows.filter(isExpiredRow);
      case "critical":
        return categorySearchFilteredRows.filter(
          (row) => row.stockLevel === "Critical",
        );
      default:
        return categorySearchFilteredRows;
    }
  }, [categorySearchFilteredRows, stockStatFilter]);

  const stats: Array<{
    id: "all" | "inStock" | "low" | "expired" | "critical";
    label: string;
    value: number;
    color: string;
    clickable: boolean;
  }> = [
    {
      id: "all",
      label: "Total Items",
      value: categorySearchFilteredRows.length,
      color: "bg-[#0369A1]",
      clickable: true,
    },
    {
      id: "inStock",
      label: "Total In Stock",
      value: categorySearchFilteredRows.reduce(
        (total, row) => total + row.currentStock,
        0,
      ),
      color: "bg-emerald-400",
      clickable: false,
    },
    {
      id: "low",
      label: "Low In Stock",
      value: categorySearchFilteredRows.filter((row) => row.stockLevel === "Low")
        .length,
      color: "bg-amber-400",
      clickable: true,
    },
    {
      id: "expired",
      label: "Expired",
      value: categorySearchFilteredRows.filter(isExpiredRow).length,
      color: "bg-red-400",
      clickable: true,
    },
    {
      id: "critical",
      label: "Critical",
      value: categorySearchFilteredRows.filter(
        (row) => row.stockLevel === "Critical",
      ).length,
      color: "bg-red-600",
      clickable: true,
    },
  ];

  const requisitionStats = useMemo(() => {
    const initial = {
      total: 0,
      approved: 0,
      underReview: 0,
      rejected: 0,
      received: 0,
    };

    if (!requisitionsData) return initial;

    return requisitionsData.reduce((acc, requisition) => {
      acc.total++;
      const statusLabel = normalizeRequisitionStatus(requisition.status);
      if (statusLabel === "Approved") acc.approved++;
      else if (statusLabel === "Under Review") acc.underReview++;
      else if (statusLabel === "Rejected") acc.rejected++;
      else if (statusLabel === "Received") acc.received++;
      return acc;
    }, initial);
  }, [requisitionsData]);

  const selectedFilterCount = unitFilter.all ? 0 : unitFilter.selected.length;

  const supplierStats = useMemo(() => {
    const withEmail = suppliersData.filter((supplier) =>
      Boolean(supplier.email?.trim()),
    ).length;
    const withContact = suppliersData.filter((supplier) =>
      Boolean(supplier.contact?.trim()),
    ).length;
    const withAddress = suppliersData.filter((supplier) =>
      Boolean(supplier.address?.trim()),
    ).length;

    return {
      total: suppliersData.length,
      withEmail,
      withContact,
      withAddress,
    };
  }, [suppliersData]);

  const partRequisitions = useMemo(() => {
    return [...stockMovementsData]
      .filter((movement) => movement.movement_type === "issue")
      .sort((a, b) => b.id - a.id);
  }, [stockMovementsData]);

  const existingRfqStockMovementIds = useMemo(
    () => new Set(rfqsData.map((rfq) => Number(rfq.stock_movement_id))),
    [rfqsData],
  );

  const rfqRows = useMemo(() => {
    return [...rfqsData].sort((a, b) => b.id - a.id);
  }, [rfqsData]);

  const lifecycleCardData = useMemo(
    () => [
      {
        title: "1. Parts Requisition",
        description: "Raise parts requisitions directly or from work orders",
        count: partRequisitions.length,
        color: "text-[#7FD5FF]",
        hash: "#requisition-section",
      },
      {
        title: "2. RFQ",
        description: "Issue RFQs to multiple suppliers",
        count: rfqsData.length,
        color: "text-emerald-300",
        hash: "#rfq-section",
      },
      {
        title: "3. Supplier Quotation",
        description: "Capture and approve quotations",
        count: quotationsData.length,
        color: "text-amber-300",
        hash: "#quotation-section",
      },
      {
        title: "4. Purchase Order",
        description: "Create PO from approved quotation",
        count: purchaseOrdersData.length,
        color: "text-sky-300",
        hash: "#po-section",
      },
      {
        title: "5. GRN",
        description: "Post goods received notes and update stock",
        count: goodsReceivedNotesData.length,
        color: "text-fuchsia-300",
        hash: "#grn-section",
      },
    ],
    [
      goodsReceivedNotesData.length,
      partRequisitions.length,
      purchaseOrdersData.length,
      quotationsData.length,
      rfqsData.length,
    ],
  );

  const handleTogglePartRequisition = (id: number, checked: boolean) => {
    setSelectedPartRequisitionIds((current) => {
      if (checked) {
        if (current.includes(id)) return current;
        return [...current, id];
      }
      return current.filter((itemId) => itemId !== id);
    });
  };

  const handleToggleSupplierForRfq = (supplierId: number) => {
    setSelectedRfqSupplierIds((current) =>
      current.includes(supplierId)
        ? current.filter((id) => id !== supplierId)
        : [...current, supplierId],
    );
  };

  const handleRequestRfqFromPartsRequisitions = async () => {
    if (selectedPartRequisitionIds.length === 0) {
      dispatch(
        showToast({
          message: "Select at least one parts requisition.",
          type: "error",
        }),
      );
      return;
    }

    if (selectedRfqSupplierIds.length === 0) {
      dispatch(
        showToast({
          message: "Select at least one supplier for RFQ.",
          type: "error",
        }),
      );
      return;
    }

    const pendingIds = selectedPartRequisitionIds.filter(
      (id) => !existingRfqStockMovementIds.has(id),
    );

    if (pendingIds.length === 0) {
      dispatch(
        showToast({
          message: "All selected requisitions already have RFQs.",
          type: "error",
        }),
      );
      return;
    }

    let successCount = 0;
    for (const stockMovementId of pendingIds) {
      try {
        await createRfq({
          stock_movement_id: stockMovementId,
          supplier_ids: selectedRfqSupplierIds,
          status: "sent",
          issued_at: new Date().toISOString(),
          notes: `Bulk RFQ request from parts requisitions on ${new Date().toLocaleString()}`,
        }).unwrap();
        successCount += 1;
      } catch {
        // Continue and report aggregated result.
      }
    }

    if (successCount > 0) {
      dispatch(
        showToast({
          message: `RFQ requested for ${successCount} requisition${successCount > 1 ? "s" : ""}.`,
          type: "success",
        }),
      );
      setSelectedPartRequisitionIds([]);
      refetchStockMovements();
      refetchRfqs();
    } else {
      dispatch(
        showToast({
          message: "Failed to request RFQ for selected requisitions.",
          type: "error",
        }),
      );
    }
  };

  const handleOpenRfqDetails = (rfqId: number) => {
    navigate(`/dashboard/inventory/rfq/${rfqId}`);
  };

  const handleExportStocks = () => {
    const headers = ["Item Description", "Part Number", "Unit", "Aircraft Type", "Category", "Stock Level", "Current Stock", "Reorder Level", "Last Updated"];
    const rows = filteredInventoryRows.map((r) => [
      r.description || r.partName,
      r.partNumber,
      r.unit,
      r.aircraftType,
      r.category,
      r.stockLevel,
      String(r.currentStock),
      String(r.reorderLevel),
      formatDateShort(r.lastUpdated),
    ]);
    downloadCsv("inventories.csv", [headers, ...rows]);
  };

  const handleExportRequisitions = () => {
    const headers = ["Date", "Time", "Requesting Location", "Status", "Last Updated By"];
    const rows = (requisitionsData ?? []).map((r) => {
      const lastUpdatedBy = typeof r.last_updated_by === "string" ? r.last_updated_by : (r.last_updated_by?.name ?? "-");
      const location = r.requesting_unit?.name ?? (r.requesting_unit_id ? `Unit #${r.requesting_unit_id}` : "-");
      return [
        formatDateShort(r.created_at),
        formatTimeShort(r.created_at),
        location,
        normalizeRequisitionStatus(r.status),
        lastUpdatedBy,
      ];
    });
    downloadCsv("requisitions.csv", [headers, ...rows]);
  };

  const handleExportPartsRequisitions = () => {
    const headers = ["Requisition ID", "Origin", "Items", "Requested Qty", "Created", "RFQ Status"];
    const rows = partRequisitions.map((r) => [
      `REQ #${r.id}`,
      requisitionOrigin(r),
      describeRequisitionItems(r),
      String(r.quantity),
      `${formatDateShort(r.created_at)} ${formatTimeShort(r.created_at)}`,
      existingRfqStockMovementIds.has(r.id) ? "RFQ Requested" : "Pending RFQ",
    ]);
    downloadCsv("parts-requisitions.csv", [headers, ...rows]);
  };

  const handleExportPurchaseOrders = () => {
    const headers = ["PO ID", "Name", "Status", "Order Date", "Expected Delivery"];
    const rows = (purchaseOrdersData as PurchaseOrderListRow[]).map((o) => [
      `#${o.id}`,
      o.name || `PO #${o.id}`,
      o.status || "-",
      formatDateShort(o.order_date),
      formatDateShort(o.expected_date_of_delivery),
    ]);
    downloadCsv("purchase-orders.csv", [headers, ...rows]);
  };

  const handleExportSuppliers = () => {
    const headers = ["Supplier", "Contact", "Email", "Address", "Created"];
    const rows = suppliersData.map((s) => [
      s.name,
      s.contact || "-",
      s.email || "-",
      s.address || "-",
      formatDateShort(s.created_at),
    ]);
    downloadCsv("suppliers.csv", [headers, ...rows]);
  };

  const renderLifecycleCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 border-t border-[#0A4D66]/40 pt-4">
      {lifecycleCardData.map((item) => (
        <button
          key={item.title}
          type="button"
          onClick={() =>
            navigate(`/dashboard/inventory/procurement-lifecycle${item.hash}`)
          }
          className="text-left rounded-lg border border-[#0A4D66]/40 bg-[#001825] p-3 hover:border-[#7FD5FF]/50 transition-colors"
        >
          <div className="text-xs text-gray-400">{item.title}</div>
          <div className={cn("text-2xl font-bold mt-1", item.color)}>
            {item.count}
          </div>
          <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
            {item.description}
          </div>
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#7FD5FF]">
            <span>Open Stage</span>
            <Icon icon="mdi:arrow-right" className="w-3.5 h-3.5" />
          </div>
        </button>
      ))}
    </div>
  );

  const resetFilters = () => {
    setUnitFilter({ all: true, selected: [] });
    setOpenFilterMenu(null);
  };

  const handleOpenDetail = (id: number) => {
    navigate(`/dashboard/inventory/${id}`);
    setOpenActionId(null);
  };

  const handleOpenEdit = (id: number) => {
    navigate(`/dashboard/inventory/${id}/edit`);
    setOpenActionId(null);
  };

  const handleToggleActions = (id: number) => {
    setOpenActionId((current) => {
      const nextId = current === id ? null : id;
      activeActionButtonRef.current =
        nextId === null ? null : actionButtonRefs.current[nextId];
      return nextId;
    });
    setOpenFilterMenu(null);
  };

  const openActionRow =
    activeTab === "Stocks"
      ? (filteredInventoryRows.find((row) => row.id === openActionId) ?? null)
      : null;

  const renderInventoryActionMenu = (row: InventoryRow) => (
    <>
      <button
        type="button"
        onClick={() => handleOpenDetail(row.id)}
        className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white flex items-center gap-2"
      >
        <Icon icon="mdi:eye" className="w-3.5 h-3.5 text-blue-400" />
        View
      </button>
      <button
        type="button"
        onClick={() => handleOpenEdit(row.id)}
        className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white flex items-center gap-2"
      >
        <Icon icon="mdi:pencil" className="w-3.5 h-3.5 text-amber-400" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          setUpdateStockRow(row);
          setOpenActionId(null);
        }}
        className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white flex items-center gap-2"
      >
        <Icon
          icon="mdi:database-edit"
          className="w-3.5 h-3.5 text-emerald-400"
        />
        Update Stock
      </button>
      <button
        type="button"
        className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white flex items-center gap-2"
      >
        <Icon icon="mdi:download" className="w-3.5 h-3.5 text-gray-400" />
        Download
      </button>
      <div className="h-px bg-[#0A4D66]/40 my-1" />
      <button
        type="button"
        onClick={() => handleDeleteInventory(row.id, row.partName)}
        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#0A4D66]/40 hover:text-red-300 flex items-center gap-2"
      >
        <Icon icon="mdi:delete" className="w-3.5 h-3.5" />
        Delete
      </button>
    </>
  );

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8 border-b border-[#0A4D66]/40 w-full">
          {INVENTORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setOpenActionId(null);
                setOpenFilterMenu(null);
              }}
              className={cn(
                "flex items-center space-x-2 pb-4 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-[#7FD5FF]"
                  : "text-gray-400 hover:text-gray-300",
              )}
            >
              <Icon icon={tab.icon} className="w-5 h-5" />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0369A1] shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {activeTab === "Stocks" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-black text-xs font-semibold shadow hover:bg-emerald-600 transition-colors"
                  onClick={() => navigate("/dashboard/inventory/purchase-orders/new")}
                >
                  <Icon icon="mdi:cart-plus" className="w-4 h-4" />
                  Create Purchase Order
                </button>
              </div>
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-1 bg-[#0A4D66] p-1 rounded-lg border border-[#0A4D66]">
                  {stockSubTabs.map((subTab) => (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={() => setActiveSubTab(subTab.id)}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        activeSubTab === subTab.id
                          ? "bg-[#001825] text-white shadow-sm"
                          : "text-gray-300 hover:text-white",
                      )}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full lg:w-64">
                  <Icon
                    icon="mdi:magnify"
                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    placeholder="Search description, part number..."
                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded pl-9 pr-8 py-1.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-[#7FD5FF]"
                  />
                  {stockSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStockSearchQuery("")}
                      title="Clear search"
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1 bg-[#0A4D66] p-1 rounded-lg border border-[#0A4D66]">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    title="Table view"
                    aria-label="Table view"
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      viewMode === "table"
                        ? "bg-[#001825] text-white shadow-sm"
                        : "text-gray-300 hover:text-white",
                    )}
                  >
                    <Icon icon="mdi:table" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    title="Grid view"
                    aria-label="Grid view"
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      viewMode === "grid"
                        ? "bg-[#001825] text-white shadow-sm"
                        : "text-gray-300 hover:text-white",
                    )}
                  >
                    <Icon icon="mdi:view-grid" className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1" />

                <div
                  className="flex flex-wrap items-center gap-2 max-w-full"
                  ref={filtersRef}
                >
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={selectedFilterCount === 0}
                    className={cn(
                      "text-xs whitespace-nowrap bg-[#001825] px-2 py-1 rounded-full border border-[#0A4D66]/40 transition-colors",
                      selectedFilterCount === 0
                        ? "text-gray-500 cursor-not-allowed"
                        : "text-[#7FD5FF] hover:underline",
                    )}
                  >
                    {selectedFilterCount} Reset Filter
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFilterMenu(
                          openFilterMenu === "units" ? null : "units",
                        )
                      }
                      className={cn(
                        "bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF] inline-flex items-center gap-1 whitespace-nowrap",
                        !unitFilter.all && "border-[#7FD5FF] text-[#7FD5FF]",
                      )}
                    >
                      <span>
                        {unitFilter.all
                          ? "All Units"
                          : `${unitFilter.selected.length} Units`}
                      </span>
                      <Icon icon="mdi:chevron-down" className="w-3 h-3" />
                    </button>
                    {openFilterMenu === "units" && (
                      <div className="absolute top-full mt-1 left-0 z-40 w-56 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-3 text-xs text-gray-200">
                        <div className="mb-2">
                          <Checkbox
                            checked={unitFilter.all}
                            onChange={(e) =>
                              handleToggleAll(setUnitFilter)(e.target.checked)
                            }
                            label="All Locations"
                          />
                        </div>
                        <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                          {units.map((unit) => (
                            <Checkbox
                              key={unit.id}
                              checked={unitFilter.selected.includes(unit.id)}
                              onChange={(e) =>
                                handleToggleItem(setUnitFilter)(
                                  unit.id,
                                  e.target.checked,
                                )
                              }
                              label={unit.name}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportStocks}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/40 text-gray-300 hover:text-white hover:border-[#7FD5FF]/50 transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:download" className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/40 text-gray-300 hover:text-white hover:border-[#7FD5FF]/50 transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:upload" className="w-4 h-4" />
                  Import CSV
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/inventory/add")}
                  className="flex items-center space-x-2 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Inventory</span>
                </button>
              </div>

              <div className="flex items-center gap-6 text-sm border-t border-[#0A4D66]/40 pt-4 overflow-x-auto">
                {stats.map((stat) =>
                  stat.clickable ? (
                    <button
                      key={stat.id}
                      type="button"
                      onClick={() =>
                        setStockStatFilter((current) =>
                          current === stat.id ? "all" : stat.id,
                        )
                      }
                      className={cn(
                        "flex items-center space-x-2 whitespace-nowrap rounded-full px-2 py-1 transition-colors",
                        stockStatFilter === stat.id
                          ? "bg-[#0A4D66]/50 ring-1 ring-[#7FD5FF]/60"
                          : "hover:bg-[#0A4D66]/25",
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                      <span className="text-gray-400">{stat.label}:</span>
                      <span className="text-white font-bold">{stat.value}</span>
                    </button>
                  ) : (
                    <div
                      key={stat.id}
                      className="flex items-center space-x-2 whitespace-nowrap px-2 py-1"
                    >
                      <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                      <span className="text-gray-400">{stat.label}:</span>
                      <span className="text-white font-bold">{stat.value}</span>
                    </div>
                  ),
                )}
              </div>
            </div>

            {viewMode === "table" ? (
              <DataTable
                columns={STOCK_TABLE_COLUMNS}
                isLoading={isInventoriesLoading}
                isEmpty={filteredInventoryRows.length === 0}
                loadingText="Loading inventory..."
                emptyText="No inventory items found."
              >
                {filteredInventoryRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "hover:bg-[#0A4D66]/20 transition-colors",
                      idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">
                        {row.description || row.partName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.partNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {row.unit}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {row.aircraftType}
                    </td>
                    <td className="px-6 py-4 text-gray-400">{row.category}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "font-medium",
                          stockLevelColor[row.stockLevel],
                        )}
                      >
                        {row.stockLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-white">
                      {row.currentStock}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      <div>{formatDateShort(row.lastUpdated)}</div>
                      <div className="text-xs text-gray-500">
                        {formatTimeShort(row.lastUpdated)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        ref={(node) => {
                          actionButtonRefs.current[row.id] = node;
                        }}
                        type="button"
                        onClick={() => handleToggleActions(row.id)}
                        className="p-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-400 hover:text-white transition-colors"
                      >
                        <Icon icon="mdi:dots-vertical" className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isInventoriesLoading ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    Loading inventory...
                  </div>
                ) : filteredInventoryRows.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No inventory items found.
                  </div>
                ) : (
                  filteredInventoryRows.map((row) => (
                    <div
                      key={row.id}
                      className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-4 relative group hover:border-[#7FD5FF]/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "absolute top-0 left-0 w-1 h-full",
                          stockLevelStripColor[row.stockLevel],
                        )}
                      />

                      <div className="flex items-start justify-between pl-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-[#0A4D66]/40 flex items-center justify-center">
                            <Icon
                              icon="mdi:cube-outline"
                              className="w-8 h-8 text-[#7FD5FF]"
                            />
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-lg">
                              {row.partName}
                            </h3>
                            <p className="text-xs text-gray-400">
                              {row.partNumber}
                            </p>
                          </div>
                        </div>

                        <div className="relative">
                          <button
                            ref={(node) => {
                              actionButtonRefs.current[row.id] = node;
                            }}
                            type="button"
                            onClick={() => handleToggleActions(row.id)}
                            title="Open inventory actions"
                            aria-label="Open inventory actions"
                            className="p-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-400 hover:text-white transition-colors"
                          >
                            <Icon
                              icon="mdi:dots-vertical"
                              className="w-4 h-4"
                            />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pl-2 text-xs bg-[#001825] p-3 rounded-lg border border-[#0A4D66]/20">
                        <div>
                          <span className="text-gray-500 block mb-1">
                            Current Stock
                          </span>
                          <span className="text-white font-medium">
                            {row.currentStock} {row.measurementUnit}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">
                            Reorder Level
                          </span>
                          <span className="text-white font-medium">
                            {row.reorderLevel}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">
                            Category
                          </span>
                          <span className="text-white font-medium">
                            {row.category}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">
                            Aircraft Type
                          </span>
                          <span className="text-white font-medium">
                            {row.aircraftType}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pl-2">
                        <span
                          className={cn(
                            "text-xs font-medium flex items-center gap-1.5",
                            stockLevelColor[row.stockLevel],
                          )}
                        >
                          {row.stockLevel}
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              stockLevelStripColor[row.stockLevel],
                            )}
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => setUpdateStockRow(row)}
                          className="text-xs text-[#7FD5FF] hover:underline"
                        >
                          Update Stock
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        ) : activeTab === "Requisitions" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-1 bg-[#0A4D66] p-1 rounded-lg border border-[#0A4D66]">
                  <button className="px-3 py-1.5 bg-[#001825] text-white rounded text-xs font-medium shadow-sm">
                    Requisitions
                  </button>
                </div>

                <div className="flex items-center space-x-1 bg-[#0A4D66] p-1 rounded-lg border border-[#0A4D66]">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    title="Table view"
                    aria-label="Table view"
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      viewMode === "table"
                        ? "bg-[#001825] text-white shadow-sm"
                        : "text-gray-300 hover:text-white",
                    )}
                  >
                    <Icon icon="mdi:table" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    title="Grid view"
                    aria-label="Grid view"
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      viewMode === "grid"
                        ? "bg-[#001825] text-white shadow-sm"
                        : "text-gray-300 hover:text-white",
                    )}
                  >
                    <Icon icon="mdi:view-grid" className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1" />

                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  <select
                    title="Filter requisitions by period"
                    aria-label="Filter requisitions by period"
                    value={requisitionPeriod}
                    onChange={(e) =>
                      setRequisitionPeriod(
                        e.target.value as "all" | "month" | "quarter" | "year",
                      )
                    }
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                  >
                    <option value="all">All Time</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                  </select>

                  <select
                    title="Filter requisitions by location"
                    aria-label="Filter requisitions by location"
                    value={requisitionUnitId}
                    onChange={(e) =>
                      setRequisitionUnitId(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7FD5FF] min-w-44"
                  >
                    <option value="">All Locations</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExportRequisitions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/40 text-gray-300 hover:text-white hover:border-[#7FD5FF]/50 transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:download" className="w-4 h-4" />
                  Export CSV
                </button>
                <Link
                  to="/dashboard/inventory/requisitions/add"
                  className="flex items-center space-x-2 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Request</span>
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm border-t border-[#0A4D66]/40 pt-4">
                <div className="flex items-center gap-6 overflow-x-auto">
                  {[
                    {
                      label: "Total Requests",
                      value: requisitionStats.total,
                      color: "bg-[#0369A1]",
                    },
                    {
                      label: "Approved",
                      value: requisitionStats.approved,
                      color: requisitionStatusDotColor.Approved,
                    },
                    {
                      label: "Under Review",
                      value: requisitionStats.underReview,
                      color: requisitionStatusDotColor["Under Review"],
                    },
                    {
                      label: "Rejected",
                      value: requisitionStats.rejected,
                      color: requisitionStatusDotColor.Rejected,
                    },
                    {
                      label: "Received",
                      value: requisitionStats.received,
                      color: requisitionStatusDotColor.Received,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center space-x-2 whitespace-nowrap"
                    >
                      <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                      <span className="text-gray-400">{stat.label}:</span>
                      <span className="text-white font-bold">{stat.value}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/dashboard/inventory/procurement-lifecycle"
                  className="inline-flex items-center gap-2 rounded-md border border-[#7FD5FF]/30 bg-[#0369A1]/10 px-3 py-2 text-xs font-medium text-[#7FD5FF] transition-colors hover:bg-[#0369A1]/20"
                >
                  <Icon icon="mdi:source-merge" className="h-4 w-4" />
                  Procurement Lifecycle
                </Link>
              </div>

              {renderLifecycleCards()}
            </div>

            {viewMode === "table" ? (
              <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-250">
                  <thead>
                    <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Time</th>
                      <th className="px-6 py-4 font-medium">
                        Requesting Location
                      </th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Last Updated By</th>
                      <th className="px-6 py-4 font-medium text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                    {isRequisitionsLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          Loading requisitions...
                        </td>
                      </tr>
                    ) : (requisitionsData?.length ?? 0) === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          No requisitions found.
                        </td>
                      </tr>
                    ) : (
                      requisitionsData?.map((requisition, idx) => {
                        const statusLabel = normalizeRequisitionStatus(
                          requisition.status,
                        );
                        const lastUpdatedBy =
                          typeof requisition.last_updated_by === "string"
                            ? requisition.last_updated_by
                            : (requisition.last_updated_by?.name ?? "-");
                        const requestingLocation =
                          requisition.requesting_unit?.name ??
                          (requisition.requesting_unit_id
                            ? `Unit #${requisition.requesting_unit_id}`
                            : "-");

                        return (
                          <tr
                            key={requisition.id}
                            className={cn(
                              "hover:bg-[#0A4D66]/20 transition-colors",
                              idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                            )}
                          >
                            <td className="px-6 py-4 text-gray-300">
                              {formatDateShort(requisition.created_at)}
                            </td>
                            <td className="px-6 py-4 text-gray-300">
                              {formatTimeShort(requisition.created_at)}
                            </td>
                            <td className="px-6 py-4 text-gray-200">
                              {requestingLocation}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={cn(
                                  "font-medium",
                                  requisitionStatusColor[statusLabel],
                                )}
                              >
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-300">
                              {lastUpdatedBy}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/dashboard/inventory/requisitions/${requisition.id}`,
                                  )
                                }
                                title="View requisition"
                                aria-label="View requisition"
                                className="inline-flex items-center justify-center p-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-400 hover:text-white transition-colors"
                              >
                                <Icon icon="mdi:eye" className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isRequisitionsLoading ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    Loading requisitions...
                  </div>
                ) : (requisitionsData?.length ?? 0) === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No requisitions found.
                  </div>
                ) : (
                  requisitionsData?.map((requisition) => {
                    const statusLabel = normalizeRequisitionStatus(
                      requisition.status,
                    );
                    const requestingLocation =
                      requisition.requesting_unit?.name ??
                      (requisition.requesting_unit_id
                        ? `Unit #${requisition.requesting_unit_id}`
                        : "-");

                    return (
                      <button
                        key={requisition.id}
                        type="button"
                        onClick={() =>
                          navigate(
                            `/dashboard/inventory/requisitions/${requisition.id}`,
                          )
                        }
                        className="text-left bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 hover:border-[#7FD5FF]/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-white font-semibold">
                              Request #{requisition.id}
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              {formatDateShort(requisition.created_at)} •{" "}
                              {formatTimeShort(requisition.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                requisitionStatusDotColor[statusLabel],
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs font-medium",
                                requisitionStatusColor[statusLabel],
                              )}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 text-xs bg-[#001825] p-3 rounded-lg border border-[#0A4D66]/20">
                          <span className="text-gray-500 block mb-1">
                            Location
                          </span>
                          <span className="text-white font-medium">
                            {requestingLocation}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        ) : activeTab === "Parts Requisitions" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
                  <button className="px-3 py-1.5 bg-[#0A4D66] text-white rounded text-xs font-medium">
                    Parts Requisitions
                  </button>
                </div>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={() => setIsCreateRequisitionOpen(true)}
                  className="flex items-center gap-1.5 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  New Requisition
                </button>
                <button
                  type="button"
                  onClick={handleExportPartsRequisitions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/40 text-gray-300 hover:text-white hover:border-[#7FD5FF]/50 transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:download" className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleRequestRfqFromPartsRequisitions}
                  disabled={
                    isCreatingPartsRfq ||
                    selectedPartRequisitionIds.length === 0 ||
                    selectedRfqSupplierIds.length === 0
                  }
                  className="flex items-center space-x-2 bg-emerald-400 hover:bg-emerald-500 text-black px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon icon="mdi:send" className="w-4 h-4" />
                  <span>
                    {isCreatingPartsRfq
                      ? "Requesting RFQ..."
                      : `Request RFQ (${selectedPartRequisitionIds.length})`}
                  </span>
                </button>
              </div>

              {renderLifecycleCards()}

              <div className="border-t border-[#0A4D66]/40 pt-4">
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                  Select Suppliers for RFQ
                </div>
                <div className="flex flex-wrap gap-2 rounded border border-[#0A4D66]/40 bg-[#001825] p-2">
                  {suppliersData.map((supplier) => {
                    const selected = selectedRfqSupplierIds.includes(supplier.id);
                    return (
                      <button
                        type="button"
                        key={supplier.id}
                        className={cn(
                          "rounded px-2 py-1 text-xs transition-colors",
                          selected
                            ? "bg-[#0369A1] text-black"
                            : "bg-[#0A4D66]/30 text-gray-200 hover:bg-[#0A4D66]/50",
                        )}
                        onClick={() => handleToggleSupplierForRfq(supplier.id)}
                      >
                        {supplier.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-250">
                <thead>
                  <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="px-6 py-4 font-medium">Select</th>
                    <th className="px-6 py-4 font-medium">Requisition ID</th>
                    <th className="px-6 py-4 font-medium">Origin</th>
                    <th className="px-6 py-4 font-medium">Items</th>
                    <th className="px-6 py-4 font-medium">Requested Qty</th>
                    <th className="px-6 py-4 font-medium">Created</th>
                    <th className="px-6 py-4 font-medium">RFQ Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                  {isPartsRequisitionsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        Loading parts requisitions...
                      </td>
                    </tr>
                  ) : partRequisitions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No parts requisitions found.
                      </td>
                    </tr>
                  ) : (
                    partRequisitions.map((req, idx) => {
                      const hasRfq = existingRfqStockMovementIds.has(req.id);
                      const selected = selectedPartRequisitionIds.includes(req.id);
                      return (
                        <tr
                          key={req.id}
                          className={cn(
                            "hover:bg-[#0A4D66]/20 transition-colors",
                            idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={hasRfq}
                              onChange={(e) =>
                                handleTogglePartRequisition(req.id, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-[#0A4D66]/60 bg-[#001825] text-[#7FD5FF]"
                              title={`Select requisition ${req.id}`}
                            />
                          </td>
                          <td className="px-6 py-4 text-white font-medium">REQ #{req.id}</td>
                          <td className="px-6 py-4 text-gray-300">{requisitionOrigin(req)}</td>
                          <td className="px-6 py-4 text-gray-300 max-w-xs truncate" title={describeRequisitionItems(req)}>
                            {describeRequisitionItems(req)}
                          </td>
                          <td className="px-6 py-4 text-gray-300">{req.quantity}</td>
                          <td className="px-6 py-4 text-gray-300">
                            {formatDateShort(req.created_at)} {formatTimeShort(req.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-1 text-xs",
                                hasRfq
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                              )}
                            >
                              {hasRfq ? "RFQ Requested" : "Pending RFQ"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-x-auto">
              <div className="flex items-center justify-between border-b border-[#0A4D66]/40 px-6 py-4">
                <div className="text-sm font-semibold text-white">RFQs</div>
                <div className="text-xs text-gray-400">Click an RFQ to view details and quotations</div>
              </div>
              <table className="w-full text-left border-collapse min-w-250">
                <thead>
                  <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="px-6 py-4 font-medium">RFQ No</th>
                    <th className="px-6 py-4 font-medium">Requisition</th>
                    <th className="px-6 py-4 font-medium">Issued</th>
                    <th className="px-6 py-4 font-medium">Suppliers</th>
                    <th className="px-6 py-4 font-medium">Quotations</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                  {rfqRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No RFQs found.
                      </td>
                    </tr>
                  ) : (
                    rfqRows.map((rfq, idx) => {
                      const rfqQuotationCount = quotationsData.filter(
                        (quotation) => quotation.rfq_id === rfq.id,
                      ).length;
                      const hasApproved = quotationsData.some(
                        (quotation) =>
                          quotation.rfq_id === rfq.id &&
                          (quotation.status ?? "").toLowerCase() === "approved",
                      );

                      return (
                        <tr
                          key={rfq.id}
                          className={cn(
                            "cursor-pointer hover:bg-[#0A4D66]/20 transition-colors",
                            idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                          onClick={() => handleOpenRfqDetails(rfq.id)}
                        >
                          <td className="px-6 py-4 text-white font-medium">
                            {rfq.rfq_number || `RFQ #${rfq.id}`}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {rfq.stock_movement_id
                              ? `REQ #${rfq.stock_movement_id}`
                              : "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {formatDateShort(rfq.issued_at)} {formatTimeShort(rfq.issued_at)}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {rfq.suppliers?.length ?? 0}
                          </td>
                          <td className="px-6 py-4 text-gray-300">{rfqQuotationCount}</td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-1 text-xs",
                                hasApproved
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                              )}
                            >
                              {hasApproved ? "Quotation Approved" : "Awaiting Approval"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <CreatePartsRequisitionModal
              open={isCreateRequisitionOpen}
              onClose={() => setIsCreateRequisitionOpen(false)}
              onCreated={() => {
                dispatch(showToast({ message: "Parts requisition created.", type: "success" }));
                refetchStockMovements();
              }}
            />
          </>
        ) : activeTab === "Purchase Orders" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
                  <button className="px-3 py-1.5 bg-[#0A4D66] text-white rounded text-xs font-medium">
                    Purchase Orders
                  </button>
                </div>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={handleExportPurchaseOrders}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/40 text-gray-300 hover:text-white hover:border-[#7FD5FF]/50 transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:download" className="w-4 h-4" />
                  Export CSV
                </button>
                <Link
                  to="/dashboard/inventory/purchase-orders/new"
                  className="flex items-center space-x-2 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Create Purchase Order</span>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm border-t border-[#0A4D66]/40 pt-4 overflow-x-auto">
                <div className="flex items-center space-x-2 whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-[#0369A1]" />
                  <span className="text-gray-400">Total Purchase Orders:</span>
                  <span className="text-white font-bold">{purchaseOrdersData.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-250">
                <thead>
                  <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="px-6 py-4 font-medium">PO ID</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Order Date</th>
                    <th className="px-6 py-4 font-medium">Expected Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                  {isPurchaseOrdersLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        Loading purchase orders...
                      </td>
                    </tr>
                  ) : isPurchaseOrdersError ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-red-400">
                        Failed to load purchase orders.
                      </td>
                    </tr>
                  ) : purchaseOrdersData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No purchase orders found.
                      </td>
                    </tr>
                  ) : (
                    (purchaseOrdersData as PurchaseOrderListRow[]).map((order, idx) => (
                      <tr
                        key={order.id}
                        className={cn(
                          "hover:bg-[#0A4D66]/20 transition-colors cursor-pointer",
                          idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                        )}
                        onClick={() => navigate(`/dashboard/inventory/purchase-orders/${order.id}`)}
                      >
                        <td className="px-6 py-4 text-gray-200">#{order.id}</td>
                        <td className="px-6 py-4 text-white">{order.name || `PO #${order.id}`}</td>
                        <td className="px-6 py-4 text-gray-300">{order.status || "-"}</td>
                        <td className="px-6 py-4 text-gray-300">{formatDateShort(order.order_date)}</td>
                        <td className="px-6 py-4 text-gray-300">
                          {formatDateShort(order.expected_date_of_delivery)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === "Suppliers" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
                  <button className="px-3 py-1.5 bg-[#0A4D66] text-white rounded text-xs font-medium">
                    Suppliers
                  </button>
                </div>

                <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      viewMode === "table"
                        ? "bg-[#0A4D66] text-white"
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    <Icon icon="mdi:table" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      viewMode === "grid"
                        ? "bg-[#0A4D66] text-white"
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    <Icon icon="mdi:view-grid" className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={handleExportSuppliers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/40 text-gray-300 hover:text-white hover:border-[#7FD5FF]/50 transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:download" className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#0A4D66]/40 text-gray-300 hover:text-white hover:border-[#7FD5FF]/50 transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:upload" className="w-4 h-4" />
                  Import CSV
                </button>
                <Link
                  to="/dashboard/inventory/suppliers/add"
                  className="flex items-center space-x-2 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Supplier</span>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm border-t border-[#0A4D66]/40 pt-4 overflow-x-auto">
                {[
                  {
                    label: "Total Suppliers",
                    value: supplierStats.total,
                    color: "bg-[#0369A1]",
                  },
                  {
                    label: "With Contact",
                    value: supplierStats.withContact,
                    color: "bg-emerald-400",
                  },
                  {
                    label: "With Email",
                    value: supplierStats.withEmail,
                    color: "bg-amber-400",
                  },
                  {
                    label: "With Address",
                    value: supplierStats.withAddress,
                    color: "bg-sky-400",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center space-x-2 whitespace-nowrap"
                  >
                    <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                    <span className="text-gray-400">{stat.label}:</span>
                    <span className="text-white font-bold">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {viewMode === "table" ? (
              <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-250">
                  <thead>
                    <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                      <th className="px-6 py-4 font-medium">Supplier</th>
                      <th className="px-6 py-4 font-medium">Contact</th>
                      <th className="px-6 py-4 font-medium">Email</th>
                      <th className="px-6 py-4 font-medium">Address</th>
                      <th className="px-6 py-4 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                    {isSuppliersLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          Loading suppliers...
                        </td>
                      </tr>
                    ) : suppliersData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          No suppliers found.
                        </td>
                      </tr>
                    ) : (
                      suppliersData.map((supplier, idx) => (
                        <tr
                          key={supplier.id}
                          className={cn(
                            "hover:bg-[#0A4D66]/20 transition-colors",
                            idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-6 py-4 text-gray-200 font-medium">
                            {supplier.name}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {supplier.contact || "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {supplier.email || "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-300 max-w-90">
                            <span className="line-clamp-2">
                              {supplier.address || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {formatDateShort(supplier.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isSuppliersLoading ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    Loading suppliers...
                  </div>
                ) : suppliersData.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No suppliers found.
                  </div>
                ) : (
                  suppliersData.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-3 hover:border-[#7FD5FF]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-[#0A4D66]/40 flex items-center justify-center">
                          <Icon
                            icon="mdi:truck-delivery-outline"
                            className="w-6 h-6 text-[#7FD5FF]"
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white font-semibold truncate">
                            {supplier.name}
                          </h3>
                          <p className="text-xs text-gray-400">
                            ID: {supplier.id}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-xs bg-[#001825] p-3 rounded-lg border border-[#0A4D66]/20">
                        <div>
                          <span className="text-gray-500 block mb-0.5">
                            Contact
                          </span>
                          <span className="text-white font-medium">
                            {supplier.contact || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-0.5">
                            Email
                          </span>
                          <span className="text-white font-medium break-all">
                            {supplier.email || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-0.5">
                            Address
                          </span>
                          <span className="text-white font-medium">
                            {supplier.address || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-0.5">
                            Created
                          </span>
                          <span className="text-white font-medium">
                            {formatDateShort(supplier.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Icon icon="mdi:tools" className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">
              {activeTab} module coming soon
            </p>
            <p className="text-sm">
              This feature is currently under development.
            </p>
          </div>
        )}
      </div>

      {openActionRow && (
        <FloatingActionMenu
          open
          anchorRef={activeActionButtonRef}
          onClose={() => setOpenActionId(null)}
        >
          {renderInventoryActionMenu(openActionRow)}
        </FloatingActionMenu>
      )}

      {/* Update Stock Modal */}
      {updateStockRow && (
        <UpdateStockModal
          row={updateStockRow}
          onClose={(shouldRefresh) => {
            setUpdateStockRow(null);
            if (shouldRefresh) {
              refetchInventories();
            }
          }}
        />
      )}

      <ImportCsvModal
        open={isImportOpen}
        title={
          activeTab === "Suppliers"
            ? "Import Suppliers from CSV"
            : "Import Inventory from CSV"
        }
        fields={
          activeTab === "Suppliers"
            ? SUPPLIER_IMPORT_FIELDS
            : INVENTORY_IMPORT_FIELDS
        }
        sampleFileName={
          activeTab === "Suppliers"
            ? "suppliers-import-sample.csv"
            : "inventory-import-sample.csv"
        }
        onImportRow={
          activeTab === "Suppliers"
            ? handleImportSupplierRow
            : handleImportInventoryRow
        }
        onClose={(result) => {
          setIsImportOpen(false);
          if (result && result.successCount > 0) {
            if (activeTab === "Suppliers") {
              refetchSuppliers();
            } else {
              refetchInventories();
            }
          }
        }}
      />
    </div>
  );
};
