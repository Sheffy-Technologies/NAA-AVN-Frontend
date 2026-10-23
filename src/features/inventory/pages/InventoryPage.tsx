import { useMemo, useState, useEffect, type ChangeEvent, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  ProcurementSection,
  type ProcurementSubTabKey,
} from "@/features/inventory/components/ProcurementSection";
import {
  useGetInventoriesQuery,
  useUpdateInventoryStockMutation,
  useDeleteInventoryMutation,
  useGetInventoryRequisitionsQuery,
  useCreateInventoryMutation,
  useCreateSupplierMutation,
  useGetExpenseCategoriesQuery,
  useGetSuppliersQuery,
  useGetStoresQuery,
  type Store,
} from "@/features/inventory/api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useTheme } from "@/context/ThemeContext";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { FloatingActionMenu } from "@/shared/ui/menu/FloatingActionMenu";
import { DataTable } from "@/shared/ui/table/DataTable";
import { MetricCard } from "@/shared/ui/metric/MetricCard";
import { BackButton } from "@/shared/ui/button/BackButton";
import {
  ImportCsvModal,
  type ImportCsvField,
} from "@/shared/components/ImportCsvModal";
import {
  onInteractiveRowClick,
  formatCategoryName,
  isCategoryMatch,
  formatAtaChapter,
} from "../inventoryUtils";
import { StoreModal } from "@/features/inventory/components/StoreModal";
import { StoreInventoryModal } from "@/features/inventory/components/StoreInventoryModal";
import { DeleteStoreModal } from "@/features/inventory/components/DeleteStoreModal";

type InventoryStatusLevel = "High" | "Low" | "Critical" | "Medium" | "Unknown";

type InventoryRow = {
  id: number;
  inventoryId: string;
  partNumber: string;
  partName: string;
  category: string;
  storeId?: number | null;
  storeName?: string;
  storeCode?: string | null;
  nsn: string;
  ataChapter: string;
  unit: string;
  unitId?: number | null;
  stockLevel: InventoryStatusLevel;
  currentStock: number;
  reorderLevel: number;
  type: string;
  assetId: number | null;
  description: string;
  remark: string;
  serialNumber: string;
  lastUpdated: string;
  expiryDate: string | null;
  aircraftType: string;
  measurementUnit: string;
};

type MultiFilterState<T> = {
  all: boolean;
  selected: T[];
};

const INVENTORY_TABS = [
  { id: "Stock", label: "Stock", icon: "mdi:cube-outline" },
  {
    id: "Requisitions",
    label: "Requisitions",
    icon: "mdi:file-document-outline",
  },
  {
    id: "Procurement",
    label: "Procurement",
    icon: "mdi:cart-outline",
  },
  {
    id: "Suppliers",
    label: "Suppliers",
    icon: "mdi:truck-delivery-outline",
  },
  {
    id: "Stores",
    label: "Stores",
    icon: "mdi:store-outline",
  },
] as const;

const STOCK_TABLE_COLUMNS = [
  { key: "description", header: "Item Description", className: "px-6 py-4" },
  { key: "serial", header: "Unit", className: "px-6 py-4" },
  { key: "aircraft", header: "Aircraft Type", className: "px-6 py-4" },
  { key: "category", header: "Category", className: "px-6 py-4" },
  { key: "store", header: "Store", className: "px-6 py-4" },
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
  { key: "contact", label: "Phone Number", required: false, example: "+234 801 234 5678" },
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
              "w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded bg-[#0369A1] text-white text-xs sm:text-sm font-medium hover:bg-[#0369A1]/90 transition-colors",
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
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const initialTab = useMemo(() => {
    const nextTab = (location.state as { inventoryTab?: unknown } | null)
      ?.inventoryTab;
    if (typeof nextTab === "string") {
      if (nextTab === "Stocks" || nextTab === "Stock" || nextTab === "All") return "Stock";
      if (nextTab === "Requisitions") return "Requisitions";
      if (
        nextTab === "Parts Requisitions" ||
        nextTab === "Purchase Orders" ||
        nextTab === "Procurement"
      )
        return "Procurement";
      if (nextTab === "Suppliers") return "Suppliers";
      if (nextTab === "Stores" || nextTab === "Store") return "Stores";
    }
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab")?.toLowerCase();
    if (tabParam === "stock" || tabParam === "stocks") return "Stock";
    if (tabParam === "requisitions" || tabParam === "requisition") return "Requisitions";
    if (
      tabParam === "procurement" ||
      tabParam === "parts" ||
      tabParam === "purchase-orders"
    )
      return "Procurement";
    if (tabParam === "suppliers" || tabParam === "supplier") return "Suppliers";
    if (tabParam === "stores" || tabParam === "store") return "Stores";
    return "Stock";
  }, [location.state, location.search]);

  const initialProcurementSubTab = useMemo<ProcurementSubTabKey>(() => {
    const nextTab = (location.state as { inventoryTab?: unknown } | null)
      ?.inventoryTab;
    if (nextTab === "Parts Requisitions") return "part-requisitions";
    if (nextTab === "Purchase Orders") return "purchase-orders";
    const params = new URLSearchParams(location.search);
    const subtabParam = params.get("subtab")?.toLowerCase() as ProcurementSubTabKey | null;
    const validSubTabs: ProcurementSubTabKey[] = [
      "overview",
      "pipeline",
      "part-requisitions",
      "quotations",
      "purchase-orders",
      "stock-received",
      "stock-issued",
    ];
    if (subtabParam && validSubTabs.includes(subtabParam)) {
      return subtabParam;
    }
    return "overview";
  }, [location.state, location.search]);

  // State for Tabs and Filters
  const [activeTab, setActiveTab] = useState<(typeof INVENTORY_TABS)[number]["id"]>(initialTab);
  const [activeProcurementSubTab, setActiveProcurementSubTab] =
    useState<ProcurementSubTabKey>(initialProcurementSubTab);

  useEffect(() => {
    const nextTab = (location.state as { inventoryTab?: unknown } | null)
      ?.inventoryTab;
    if (typeof nextTab === "string") {
      if (nextTab === "Stocks" || nextTab === "Stock" || nextTab === "All") {
        setActiveTab("Stock");
      } else if (nextTab === "Requisitions") {
        setActiveTab("Requisitions");
      } else if (nextTab === "Parts Requisitions") {
        setActiveTab("Procurement");
        setActiveProcurementSubTab("part-requisitions");
      } else if (nextTab === "Purchase Orders") {
        setActiveTab("Procurement");
        setActiveProcurementSubTab("purchase-orders");
      } else if (nextTab === "Procurement") {
        setActiveTab("Procurement");
      } else if (nextTab === "Suppliers") {
        setActiveTab("Suppliers");
      } else if (nextTab === "Stores" || nextTab === "Store") {
        setActiveTab("Stores");
      }
    }
  }, [location.state]);

  const handleTabChange = (tabId: (typeof INVENTORY_TABS)[number]["id"]) => {
    setActiveTab(tabId);
    setOpenActionId(null);
    setOpenFilterMenu(null);
    const params = new URLSearchParams(location.search);
    params.set("tab", tabId.toLowerCase());
    if (tabId === "Procurement") {
      params.set("subtab", activeProcurementSubTab);
    } else {
      params.delete("subtab");
    }
    navigate({ search: params.toString() }, { replace: true });
  };

  const handleProcurementSubTabChange = (subTab: ProcurementSubTabKey) => {
    setActiveProcurementSubTab(subTab);
    const params = new URLSearchParams(location.search);
    params.set("tab", "procurement");
    params.set("subtab", subTab);
    navigate({ search: params.toString() }, { replace: true });
  };

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
  const [openFilterMenu, setOpenFilterMenu] = useState<"units" | "stores" | null>(null);

  // Stores Data and State
  const {
    data: storesData = [],
    isLoading: isStoresLoading,
    refetch: refetchStores,
  } = useGetStoresQuery();

  const generalStore = useMemo(() => {
    return storesData.find(
      (s) => s.code === "GEN-STR" || s.name.toLowerCase().includes("general"),
    );
  }, [storesData]);

  // Store filter on Stock tab: default to General Store ID when loaded
  const [storeFilterId, setStoreFilterId] = useState<number | "all">("all");
  const [hasSetDefaultStore, setHasSetDefaultStore] = useState(false);

  useEffect(() => {
    if (generalStore && !hasSetDefaultStore) {
      setStoreFilterId(generalStore.id);
      setHasSetDefaultStore(true);
    }
  }, [generalStore, hasSetDefaultStore]);

  // Stores Tab Specific State
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [storeTypeFilter, setStoreTypeFilter] = useState<"all" | "system" | "custom">("all");
  const [storeViewMode, setStoreViewMode] = useState<"grid" | "table">("grid");
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [storeForEdit, setStoreForEdit] = useState<Store | null>(null);
  const [storeForView, setStoreForView] = useState<Store | null>(null);
  const [storeForDelete, setStoreForDelete] = useState<Store | null>(null);
  const [requisitionPeriod, setRequisitionPeriod] = useState<
    "all" | "month" | "quarter" | "year"
  >("all");
  const [requisitionUnitId, setRequisitionUnitId] = useState<number | "">("");
  const [deleteInventory] = useDeleteInventoryMutation();
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
      unit_id:
        !unitFilter.all && unitFilter.selected.length === 1
          ? unitFilter.selected[0]
          : undefined,
    };
  }, [unitFilter]);

  const {
    data: inventoriesData,
    isLoading: isInventoriesLoading,
    refetch: refetchInventories,
  } = useGetInventoriesQuery(apiFilters, { skip: activeTab !== "Stock" });

  const handleImportInventoryRow = async (row: Record<string, string>) => {
    const unitMatch = units.find(
      (u) => u.name.trim().toLowerCase() === row.unit.trim().toLowerCase(),
    );
    if (!unitMatch) throw new Error(`Unit "${row.unit}" not found`);

    const categoryMatch = row.category
      ? expenseCategories.find(
          (c) =>
            c.name.trim().toLowerCase() === row.category.trim().toLowerCase() ||
            formatCategoryName(c.name).toLowerCase() ===
              row.category.trim().toLowerCase() ||
            isCategoryMatch(row.category, c.name),
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
    skip: activeTab !== "Suppliers",
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
        category: formatCategoryName(item.expense_category?.name),
        storeId: item.store_id,
        storeName: item.store_location?.name,
        storeCode: item.store_location?.code,
        nsn: item.nsn || item.nsn_number || "-",
        ataChapter: formatAtaChapter(item.ata_chapter || item.ata_chapter_rel),
        unit: item.unit?.name || "N/A",
        unitId: item.unit_id ?? item.unit?.id ?? null,
        stockLevel: mapStockLevel(item.stock_level),
        currentStock: item.current_stock,
        reorderLevel: item.re_order_level,
        type: item.type ?? "unknown",
        assetId: item.asset_id,
        description: item.description,
        remark: item.remark || "",
        serialNumber:
          item.units && item.units.length > 1
            ? `${item.units[0]?.serial_number || item.serial_number} (+${item.units.length - 1} units)`
            : item.serial_number || "-",
        lastUpdated: item.updated_at,
        expiryDate: item.expiry_date,
        aircraftType:
          aircraftAssets.find((a) => a.id === item.asset_id)?.name || "-",
        measurementUnit: item.measurement_unit || "Units",
      };
    });
  }, [inventoriesData, aircraftAssets]);

  const stockSubTabs = useMemo(() => {
    const standardCategories = [
      { id: "all", label: "All" },
      { id: "Aircraft spares", label: "Aircraft spares" },
      { id: "Minor spare", label: "Minor spare" },
      { id: "Consumables", label: "Consumables" },
      { id: "Ground support", label: "Ground support" },
      { id: "General (QM Stores)", label: "General (QM Stores)" },
    ];
    const seen = new Set(standardCategories.map((c) => c.id.toLowerCase()));
    seen.add("uncategorized");
    seen.add("others");
    seen.add("other");
    seen.add("general(qm stores)");
    seen.add("qm stores");

    const extras: { id: string; label: string }[] = [];
    if (expenseCategories && expenseCategories.length > 0) {
      for (const cat of expenseCategories) {
        const formatted = formatCategoryName(cat.name);
        if (!seen.has(formatted.toLowerCase())) {
          seen.add(formatted.toLowerCase());
          extras.push({ id: formatted, label: formatted });
        }
      }
    }

    return [
      ...standardCategories,
      ...extras,
      { id: "Uncategorized", label: "Uncategorized" },
    ];
  }, [expenseCategories]);

  const isExpiredRow = (row: InventoryRow) => {
    if (!row.expiryDate) return false;
    const expiryDate = new Date(row.expiryDate);
    return !Number.isNaN(expiryDate.getTime()) && expiryDate < new Date();
  };

  const categorySearchFilteredRows = useMemo(() => {
    let base = inventoryRows;

    // Filter by unit
    if (!unitFilter.all && unitFilter.selected.length > 0) {
      base = base.filter(
        (row) => row.unitId != null && unitFilter.selected.includes(row.unitId),
      );
    }

    // Filter by store (defaulting to General Store to differentiate from Maintenance Hub)
    if (storeFilterId !== "all") {
      base = base.filter((row) => row.storeId === storeFilterId);
    }

    const byCategory =
      activeSubTab === "all"
        ? base
        : base.filter((row) =>
            isCategoryMatch(row.category, activeSubTab),
          );

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
        row.aircraftType,
        row.category,
        row.storeName,
        row.storeCode,
      ].some((field) => field?.toLowerCase().includes(query)),
    );
  }, [inventoryRows, activeSubTab, stockSearchQuery, storeFilterId, unitFilter]);

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
    badgeColor: "sky" | "emerald" | "amber" | "red";
    icon: string;
    badge: string;
    clickable: boolean;
  }> = [
    {
      id: "all",
      label: "Total Items",
      value: categorySearchFilteredRows.length,
      color: "bg-[#0369A1]",
      badgeColor: "sky",
      icon: "mdi:package-variant-closed",
      badge: "Catalog",
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
      badgeColor: "emerald",
      icon: "mdi:check-circle-outline",
      badge: "Healthy",
      clickable: false,
    },
    {
      id: "low",
      label: "Low In Stock",
      value: categorySearchFilteredRows.filter((row) => row.stockLevel === "Low")
        .length,
      color: "bg-amber-400",
      badgeColor: "amber",
      icon: "mdi:alert-outline",
      badge: "Reorder",
      clickable: true,
    },
    {
      id: "expired",
      label: "Expired",
      value: categorySearchFilteredRows.filter(isExpiredRow).length,
      color: "bg-red-400",
      badgeColor: "red",
      icon: "mdi:clock-alert-outline",
      badge: "Shelf-Life",
      clickable: true,
    },
    {
      id: "critical",
      label: "Critical",
      value: categorySearchFilteredRows.filter(
        (row) => row.stockLevel === "Critical",
      ).length,
      color: "bg-red-600",
      badgeColor: "red",
      icon: "mdi:alert-octagon-outline",
      badge: "Shortage",
      clickable: true,
    },
  ];

  const filteredRequisitions = useMemo(() => {
    if (!requisitionsData) return [];
    if (requisitionUnitId === "") return requisitionsData;
    return requisitionsData.filter(
      (r) =>
        r.requesting_unit_id === requisitionUnitId ||
        r.requesting_unit?.id === requisitionUnitId,
    );
  }, [requisitionsData, requisitionUnitId]);

  const requisitionStats = useMemo(() => {
    const initial = {
      total: 0,
      approved: 0,
      underReview: 0,
      rejected: 0,
      received: 0,
    };

    if (!filteredRequisitions || filteredRequisitions.length === 0) return initial;

    return filteredRequisitions.reduce((acc, requisition) => {
      acc.total++;
      const statusLabel = normalizeRequisitionStatus(requisition.status);
      if (statusLabel === "Approved") acc.approved++;
      else if (statusLabel === "Under Review") acc.underReview++;
      else if (statusLabel === "Rejected") acc.rejected++;
      else if (statusLabel === "Received") acc.received++;
      return acc;
    }, initial);
  }, [filteredRequisitions]);

  const selectedFilterCount =
    (unitFilter.all ? 0 : unitFilter.selected.length) +
    (storeFilterId === (generalStore?.id ?? "all") ? 0 : 1);

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val ?? 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const filteredStores = useMemo(() => {
    let result = storesData;
    if (storeTypeFilter === "system") {
      result = result.filter((s) => s.is_system);
    } else if (storeTypeFilter === "custom") {
      result = result.filter((s) => !s.is_system);
    }

    const q = storeSearchQuery.trim().toLowerCase();
    if (!q) return result;

    return result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.unit?.name?.toLowerCase().includes(q),
    );
  }, [storesData, storeTypeFilter, storeSearchQuery]);

  const handleExportStores = () => {
    const headers = [
      "Store Name",
      "Code",
      "Type",
      "Operating Base / Unit",
      "Items Count",
      "Total Stock",
      "Estimated Valuation ($)",
      "Description",
      "Created Date",
    ];
    const rows = filteredStores.map((s) => [
      s.name,
      s.code || "-",
      s.is_system ? "Core System Store (Protected)" : "Custom Store",
      s.unit?.name || "General Logistics",
      String(s.inventories_count ?? s.inventories?.length ?? 0),
      String(s.total_stock ?? 0),
      String(s.total_value ?? 0),
      s.description || "-",
      formatDateShort(s.created_at),
    ]);
    downloadCsv("inventory-stores.csv", [headers, ...rows]);
  };

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

  const handleOpenRfqDetails = (rfqId: number) => {
    navigate(`/dashboard/inventory/rfq/${rfqId}`, {
      state: { from: "/dashboard/inventory", fromLabel: "Inventory Procurement" },
    });
  };

  const handleExportStocks = () => {
    const headers = ["Item Description", "Part Number", "Unit", "Aircraft Type", "Category", "Store", "Stock Level", "Current Stock", "Reorder Level", "Last Updated"];
    const rows = filteredInventoryRows.map((r) => [
      r.description || r.partName,
      r.partNumber,
      r.unit,
      r.aircraftType,
      r.category,
      r.storeName || "Gen Store(HQ)",
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

  const handleExportSuppliers = () => {
    const headers = ["Supplier", "Phone Number", "Email", "Address", "Created"];
    const rows = suppliersData.map((s) => [
      s.name,
      s.contact || "-",
      s.email || "-",
      s.address || "-",
      formatDateShort(s.created_at),
    ]);
    downloadCsv("suppliers.csv", [headers, ...rows]);
  };

  const resetFilters = () => {
    setUnitFilter({ all: true, selected: [] });
    setStoreFilterId(generalStore?.id ?? "all");
    setOpenFilterMenu(null);
  };

  const handleOpenDetail = (id: number) => {
    navigate(`/dashboard/inventory/${id}`, {
      state: { from: "/dashboard/inventory", fromLabel: "Inventory" },
    });
    setOpenActionId(null);
  };

  const handleOpenEdit = (id: number) => {
    navigate(`/dashboard/inventory/${id}/edit`, {
      state: { from: "/dashboard/inventory", fromLabel: "Inventory" },
    });
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
    activeTab === "Stock"
      ? (filteredInventoryRows.find((row) => row.id === openActionId) ?? null)
      : null;

  const renderInventoryActionMenu = (row: InventoryRow) => (
    <div className="py-1">
      <button
        type="button"
        onClick={() => handleOpenDetail(row.id)}
        className={cn(
          "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
          isDark
            ? "text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Icon icon="mdi:eye" className="w-3.5 h-3.5 text-sky-500" />
        View Details
      </button>
      <button
        type="button"
        onClick={() => handleOpenEdit(row.id)}
        className={cn(
          "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
          isDark
            ? "text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Icon icon="mdi:pencil" className="w-3.5 h-3.5 text-amber-500" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          setUpdateStockRow(row);
          setOpenActionId(null);
        }}
        className={cn(
          "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
          isDark
            ? "text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Icon
          icon="mdi:database-edit"
          className="w-3.5 h-3.5 text-emerald-500"
        />
        Update Stock
      </button>
      <button
        type="button"
        className={cn(
          "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
          isDark
            ? "text-gray-200 hover:bg-[#0A4D66]/40 hover:text-white"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Icon icon="mdi:download" className="w-3.5 h-3.5 text-slate-400" />
        Download
      </button>
      <div className={cn("h-px my-1", isDark ? "bg-[#0A4D66]/40" : "bg-slate-200")} />
      <button
        type="button"
        onClick={() => handleDeleteInventory(row.id, row.partName)}
        className={cn(
          "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
          isDark
            ? "text-red-400 hover:bg-[#0A4D66]/40 hover:text-red-300"
            : "text-red-600 hover:bg-red-50 hover:text-red-700",
        )}
      >
        <Icon icon="mdi:delete" className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {location.state?.from && (
        <div className="flex items-center">
          <BackButton fallbackUrl="/dashboard" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8 border-b border-[#0A4D66]/40 w-full overflow-x-auto scrollbar-thin">
          {INVENTORY_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center space-x-2 pb-4 text-sm font-medium transition-colors relative whitespace-nowrap",
                  isActive
                    ? isDark
                      ? "text-[#7FD5FF] font-bold"
                      : "text-[#0369A1] font-bold"
                    : isDark
                      ? "text-gray-400 hover:text-gray-300"
                      : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon icon={tab.icon} className="w-5 h-5" />
                <span>{tab.label}</span>
                {isActive && (
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5",
                      isDark
                        ? "bg-[#0369A1] shadow-[0_0_8px_rgba(127,213,255,0.5)]"
                        : "bg-[#0369A1]",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {activeTab === "Stock" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              {/* Dedicated Top Row: Full Category Navigation Tabs (Where red line indicated) + Create Purchase Order */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#0A4D66]/30">
                <div className="overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
                  <div className={cn("inline-flex items-center space-x-1 p-1 rounded-lg border", isDark ? "bg-[#001825] border-[#0A4D66]/50" : "bg-slate-100 border-slate-200")}>
                    {stockSubTabs.map((subTab) => (
                      <button
                        key={subTab.id}
                        type="button"
                        onClick={() => setActiveSubTab(subTab.id)}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap",
                          activeSubTab === subTab.id
                            ? isDark
                              ? "bg-[#0A4D66] text-white font-semibold shadow-sm border border-[#7FD5FF]/40"
                              : "bg-[#0A4D66] text-white font-semibold shadow-sm"
                            : isDark
                              ? "text-gray-300 hover:text-white hover:bg-slate-800/40"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                        )}
                      >
                        {subTab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors shrink-0 self-end lg:self-auto"
                  onClick={() => navigate("/dashboard/inventory/purchase-orders/new")}
                >
                  <Icon icon="mdi:cart-plus" className="w-4 h-4 text-white" />
                  <span>Create Purchase Order</span>
                </button>
              </div>

              {/* Second Row: Search, View Mode Toggles & Filter Actions */}
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3 w-full lg:w-auto flex-1 max-w-xl">
                  <div className="relative flex-1">
                    <Icon
                      icon="mdi:magnify"
                      className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      placeholder="Search description, part number..."
                      className={cn(
                        "w-full rounded pl-9 pr-8 py-1.5 text-xs outline-none transition-colors border",
                        isDark
                          ? "bg-[#001825] border-[#0A4D66]/40 text-white placeholder:text-gray-500 focus:border-[#7FD5FF]"
                          : "bg-white border-slate-300 text-slate-800 placeholder:text-gray-400 focus:border-[#0369A1] shadow-sm",
                      )}
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

                  <div className={cn("flex items-center space-x-1 p-1 rounded-lg border shrink-0", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-100 border-slate-200")}>
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      title="Table view"
                      aria-label="Table view"
                      className={cn(
                        "p-1.5 rounded transition-all",
                        viewMode === "table"
                          ? isDark
                            ? "bg-[#0A4D66] text-white shadow-sm border border-[#7FD5FF]/40"
                            : "bg-white text-[#0A4D66] shadow-sm border border-slate-200 font-bold"
                          : isDark
                            ? "text-gray-300 hover:text-white"
                            : "text-slate-500 hover:text-slate-900",
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
                        "p-1.5 rounded transition-all",
                        viewMode === "grid"
                          ? isDark
                            ? "bg-[#0A4D66] text-white shadow-sm border border-[#7FD5FF]/40"
                            : "bg-white text-[#0A4D66] shadow-sm border border-slate-200 font-bold"
                          : isDark
                            ? "text-gray-300 hover:text-white"
                            : "text-slate-500 hover:text-slate-900",
                      )}
                    >
                      <Icon icon="mdi:view-grid" className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  className="flex flex-wrap items-center gap-2 max-w-full"
                  ref={filtersRef}
                >
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={selectedFilterCount === 0}
                    className={cn(
                      "text-xs whitespace-nowrap px-2.5 py-1 rounded-full border transition-colors",
                      selectedFilterCount === 0
                        ? isDark
                          ? "bg-[#001825]/50 border-[#0A4D66]/30 text-gray-500 cursor-not-allowed"
                          : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                        : isDark
                          ? "bg-[#001825] border-[#0A4D66]/60 text-[#7FD5FF] hover:underline cursor-pointer"
                          : "bg-white border-blue-200 text-blue-600 hover:underline cursor-pointer shadow-sm",
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
                        "rounded px-3 py-1.5 text-xs inline-flex items-center gap-1.5 whitespace-nowrap transition-colors border",
                        isDark
                          ? cn(
                              "bg-[#001825] border-[#0A4D66]/40 text-white focus:outline-none focus:border-[#7FD5FF]",
                              !unitFilter.all && "border-[#7FD5FF] text-[#7FD5FF]",
                            )
                          : cn(
                              "bg-white border-slate-300 text-slate-800 shadow-sm focus:outline-none focus:border-[#0369A1]",
                              !unitFilter.all && "border-blue-500 text-blue-600",
                            ),
                      )}
                    >
                      <span
                        className={cn(
                          isDark
                            ? unitFilter.all
                              ? "text-gray-200"
                              : "text-[#7FD5FF] font-medium"
                            : unitFilter.all
                              ? "text-slate-700 font-medium"
                              : "text-blue-600 font-medium",
                        )}
                      >
                        {unitFilter.all
                          ? "All Units"
                          : `${unitFilter.selected.length} Units`}
                      </span>
                      <Icon
                        icon="mdi:chevron-down"
                        className={cn(
                          "w-3.5 h-3.5",
                          isDark ? "text-gray-400" : "text-slate-500",
                        )}
                      />
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

                  {/* Store Filter Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFilterMenu(
                          openFilterMenu === "stores" ? null : "stores",
                        )
                      }
                      className={cn(
                        "rounded px-3 py-1.5 text-xs inline-flex items-center gap-1.5 whitespace-nowrap transition-colors border",
                        isDark
                          ? "bg-[#001825] border-[#0A4D66]/40 text-white focus:outline-none focus:border-[#7FD5FF]"
                          : "bg-white border-slate-300 text-slate-800 shadow-sm focus:outline-none focus:border-[#0369A1]",
                        storeFilterId !== "all" && "border-[#7FD5FF] text-[#7FD5FF] font-medium",
                      )}
                    >
                      <Icon icon="mdi:store-outline" className="w-3.5 h-3.5 text-sky-400" />
                      <span>
                        {storeFilterId === "all"
                          ? "All Stores"
                          : storesData.find((s) => s.id === storeFilterId)?.name ?? "Store Filter"}
                      </span>
                      <Icon
                        icon="mdi:chevron-down"
                        className={cn(
                          "w-3.5 h-3.5",
                          isDark ? "text-gray-400" : "text-slate-500",
                        )}
                      />
                    </button>
                    {openFilterMenu === "stores" && (
                      <div className="absolute top-full mt-1 left-0 z-40 w-64 bg-[#001219] border border-[#0A4D66]/40 rounded-md shadow-xl p-2 text-xs text-gray-200">
                        <div className="px-2 py-1 text-[10px] uppercase font-bold text-gray-400 border-b border-[#0A4D66]/30 mb-1">
                          Select Repository
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStoreFilterId("all");
                            setOpenFilterMenu(null);
                          }}
                          className={cn(
                            "w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between",
                            storeFilterId === "all"
                              ? "bg-[#0A4D66] text-white font-semibold"
                              : "hover:bg-[#0A4D66]/30 text-gray-300",
                          )}
                        >
                          <span>All Stores (Global Fleet)</span>
                          {storeFilterId === "all" && <Icon icon="mdi:check" className="w-3.5 h-3.5" />}
                        </button>
                        {storesData.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setStoreFilterId(s.id);
                              setOpenFilterMenu(null);
                            }}
                            className={cn(
                              "w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between",
                              storeFilterId === s.id
                                ? "bg-[#0A4D66] text-white font-semibold"
                                : "hover:bg-[#0A4D66]/30 text-gray-300",
                            )}
                          >
                            <div className="truncate pr-2">
                              <span>{s.name}</span>
                              {s.code && <span className="ml-1 text-[10px] text-gray-400 font-mono">({s.code})</span>}
                              {s.is_system && <span className="ml-1 text-[9px] text-amber-400 font-medium">★ System</span>}
                            </div>
                            {storeFilterId === s.id && <Icon icon="mdi:check" className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportStocks}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                >
                  <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                >
                  <Icon icon="mdi:upload" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">Import CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      storeFilterId !== "all"
                        ? `/dashboard/inventory/add?store_id=${storeFilterId}`
                        : generalStore
                          ? `/dashboard/inventory/add?store_id=${generalStore.id}`
                          : "/dashboard/inventory/add",
                    )
                  }
                  className="flex items-center space-x-2 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Inventory</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 border-t border-[#0A4D66]/40 pt-4">
                {stats.map((stat) => (
                  <MetricCard
                    key={stat.id}
                    label={stat.label}
                    value={stat.value}
                    icon={stat.icon}
                    badge={stat.badge}
                    badgeColor={stat.badgeColor}
                    isActive={stat.clickable && stockStatFilter === stat.id}
                    onClick={
                      stat.clickable
                        ? () =>
                            setStockStatFilter((current) =>
                              current === stat.id ? "all" : stat.id,
                            )
                        : undefined
                    }
                  />
                ))}
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
                    title="Click to view stock item details"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='button']")) {
                        return;
                      }
                      navigate(`/dashboard/inventory/${row.id}`, {
                        state: { from: "/dashboard/inventory", fromLabel: "Inventory" },
                      });
                    }}
                    className={cn(
                      "transition-colors cursor-pointer",
                      isDark
                        ? cn(
                            "hover:bg-[#0A4D66]/20",
                            idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )
                        : cn(
                            "hover:bg-sky-50/80",
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/60",
                          ),
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>
                        {row.description || row.partName}
                      </div>
                      <div className={cn("text-xs", isDark ? "text-gray-500" : "text-slate-500")}>
                        {row.partNumber}
                      </div>
                    </td>
                    <td className={cn("px-6 py-4", isDark ? "text-gray-400" : "text-slate-600")}>
                      {row.unit}
                    </td>
                    <td className={cn("px-6 py-4", isDark ? "text-gray-400" : "text-slate-600")}>
                      {row.aircraftType}
                    </td>
                    <td className={cn("px-6 py-4", isDark ? "text-gray-400" : "text-slate-600")}>
                      {row.category}
                    </td>
                    <td className={cn("px-6 py-4", isDark ? "text-gray-300" : "text-slate-600")}>
                      {row.storeName || "Gen Store(HQ)"}
                    </td>
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
                    <td className={cn("px-6 py-4 text-right font-mono font-bold", isDark ? "text-white" : "text-slate-900")}>
                      {row.currentStock}
                    </td>
                    <td className={cn("px-6 py-4", isDark ? "text-gray-300" : "text-slate-600")}>
                      <div>{formatDateShort(row.lastUpdated)}</div>
                      <div className={cn("text-xs", isDark ? "text-gray-500" : "text-slate-500")}>
                        {formatTimeShort(row.lastUpdated)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        ref={(node) => {
                          actionButtonRefs.current[row.id] = node;
                        }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActions(row.id);
                        }}
                        title="Open inventory actions"
                        aria-label="Open inventory actions"
                        className={cn(
                          "p-1.5 rounded transition-colors",
                          isDark
                            ? "text-gray-400 hover:text-white hover:bg-[#0A4D66]/40"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/80",
                        )}
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
                      tabIndex={0}
                      role="button"
                      title="Click to view inventory details"
                      onClick={(e) =>
                        onInteractiveRowClick(e, () =>
                          navigate(`/dashboard/inventory/${row.id}`, {
                            state: { from: "/dashboard/inventory", fromLabel: "Inventory" },
                          }),
                        )
                      }
                      className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-4 relative group hover:border-[#7FD5FF]/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/50"
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
                        <div className="col-span-2 pt-1 border-t border-[#0A4D66]/20 flex items-center justify-between">
                          <span className="text-gray-500">Store Repository:</span>
                          <span className={isDark ? "text-gray-300" : "text-slate-700"}>
                            {row.storeName || "Gen Store(HQ)"}
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
                <div className={cn("flex items-center space-x-1 p-1 rounded-lg border", isDark ? "bg-[#0A4D66] border-[#0A4D66]" : "bg-slate-100 border-slate-200")}>
                  <button
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-semibold shadow-sm border",
                      isDark
                        ? "bg-[#001825] text-white border-[#7FD5FF]/40"
                        : "bg-white text-[#0A4D66] border-slate-200",
                    )}
                  >
                    Requisitions
                  </button>
                </div>

                <div className={cn("flex items-center space-x-1 p-1 rounded-lg border", isDark ? "bg-[#0A4D66] border-[#0A4D66]" : "bg-slate-100 border-slate-200")}>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    title="Table view"
                    aria-label="Table view"
                    className={cn(
                      "p-1.5 rounded transition-all",
                      viewMode === "table"
                        ? isDark
                          ? "bg-[#001825] text-white shadow-sm border border-[#7FD5FF]/40"
                          : "bg-white text-[#0A4D66] shadow-sm border border-slate-200"
                        : isDark
                          ? "text-gray-300 hover:text-white"
                          : "text-slate-500 hover:text-slate-900",
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
                      "p-1.5 rounded transition-all",
                      viewMode === "grid"
                        ? isDark
                          ? "bg-[#001825] text-white shadow-sm border border-[#7FD5FF]/40"
                          : "bg-white text-[#0A4D66] shadow-sm border border-slate-200"
                        : isDark
                          ? "text-gray-300 hover:text-white"
                          : "text-slate-500 hover:text-slate-900",
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                >
                  <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">Export CSV</span>
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
              </div>
            </div>

            {viewMode === "table" ? (
              <div
                className={cn(
                  "rounded-xl border overflow-x-auto",
                  isDark
                    ? "bg-[#001219] border-[#0A4D66]/40"
                    : "bg-white border-slate-200 shadow-sm",
                )}
              >
                <table className="w-full text-left border-collapse min-w-250">
                  <thead>
                    <tr
                      className={cn(
                        "text-xs uppercase border-b",
                        isDark
                          ? "bg-[#001825] text-gray-400 border-[#0A4D66]/40"
                          : "bg-slate-50 text-slate-500 border-slate-200",
                      )}
                    >
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
                  <tbody
                    className={cn(
                      "divide-y text-sm",
                      isDark ? "divide-[#0A4D66]/20" : "divide-slate-100",
                    )}
                  >
                    {isRequisitionsLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          Loading requisitions...
                        </td>
                      </tr>
                    ) : (filteredRequisitions.length ?? 0) === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          No requisitions found.
                        </td>
                      </tr>
                    ) : (
                      filteredRequisitions.map((requisition, idx) => {
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
                            title="Click to view requisition details"
                            onClick={(e) =>
                              onInteractiveRowClick(e, () =>
                                navigate(
                                  `/dashboard/inventory/requisitions/${requisition.id}`,
                                  {
                                    state: { from: "/dashboard/inventory", fromLabel: "Inventory Requisitions" },
                                  },
                                ),
                              )
                            }
                            className={cn(
                              "transition-colors cursor-pointer",
                              isDark
                                ? cn(
                                    "hover:bg-[#0A4D66]/20",
                                    idx % 2 === 0
                                      ? "bg-[#001219]"
                                      : "bg-[#001825]",
                                  )
                                : cn(
                                    "hover:bg-sky-50/80",
                                    idx % 2 === 0
                                      ? "bg-white"
                                      : "bg-slate-50/60",
                                  ),
                            )}
                          >
                            <td
                              className={cn(
                                "px-6 py-4",
                                isDark ? "text-gray-300" : "text-slate-600",
                              )}
                            >
                              {formatDateShort(requisition.created_at)}
                            </td>
                            <td
                              className={cn(
                                "px-6 py-4",
                                isDark ? "text-gray-300" : "text-slate-600",
                              )}
                            >
                              {formatTimeShort(requisition.created_at)}
                            </td>
                            <td
                              className={cn(
                                "px-6 py-4 font-medium",
                                isDark ? "text-gray-200" : "text-slate-800",
                              )}
                            >
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
                            <td
                              className={cn(
                                "px-6 py-4",
                                isDark ? "text-gray-300" : "text-slate-600",
                              )}
                            >
                              {lastUpdatedBy}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/dashboard/inventory/requisitions/${requisition.id}`,
                                    {
                                      state: { from: "/dashboard/inventory", fromLabel: "Inventory Requisitions" },
                                    },
                                  );
                                }}
                                title="View requisition"
                                aria-label="View requisition"
                                className={cn(
                                  "inline-flex items-center justify-center p-1.5 rounded transition-colors",
                                  isDark
                                    ? "text-gray-400 hover:text-white hover:bg-[#0A4D66]/40"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/80",
                                )}
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
                            {
                              state: { from: "/dashboard/inventory", fromLabel: "Inventory Requisitions" },
                            },
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
        ) : activeTab === "Procurement" ? (
          <ProcurementSection
            activeSubTab={activeProcurementSubTab}
            onSelectSubTab={handleProcurementSubTabChange}
            onNavigateToRfq={handleOpenRfqDetails}
          />
        ) : activeTab === "Suppliers" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className={cn("flex items-center space-x-1 p-1 rounded-lg border", isDark ? "bg-[#0A4D66] border-[#0A4D66]" : "bg-slate-100 border-slate-200")}>
                  <button
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-semibold shadow-sm border",
                      isDark
                        ? "bg-[#001825] text-white border-[#7FD5FF]/40"
                        : "bg-white text-[#0A4D66] border-slate-200",
                    )}
                  >
                    Suppliers
                  </button>
                </div>

                <div className={cn("flex items-center space-x-1 p-1 rounded-lg border", isDark ? "bg-[#0A4D66] border-[#0A4D66]" : "bg-slate-100 border-slate-200")}>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "p-1.5 rounded transition-all",
                      viewMode === "table"
                        ? isDark
                          ? "bg-[#001825] text-white shadow-sm border border-[#7FD5FF]/40"
                          : "bg-white text-[#0A4D66] shadow-sm border border-slate-200"
                        : isDark
                          ? "text-gray-300 hover:text-white"
                          : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    <Icon icon="mdi:table" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded transition-all",
                      viewMode === "grid"
                        ? isDark
                          ? "bg-[#001825] text-white shadow-sm border border-[#7FD5FF]/40"
                          : "bg-white text-[#0A4D66] shadow-sm border border-slate-200"
                        : isDark
                          ? "text-gray-300 hover:text-white"
                          : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    <Icon icon="mdi:view-grid" className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={handleExportSuppliers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                >
                  <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                >
                  <Icon icon="mdi:upload" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">Import CSV</span>
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
                    label: "With Phone Number",
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
              <div
                className={cn(
                  "rounded-xl border overflow-x-auto",
                  isDark
                    ? "bg-[#001219] border-[#0A4D66]/40"
                    : "bg-white border-slate-200 shadow-sm",
                )}
              >
                <table className="w-full text-left border-collapse min-w-250">
                  <thead>
                    <tr
                      className={cn(
                        "text-xs uppercase border-b",
                        isDark
                          ? "bg-[#001825] text-gray-400 border-[#0A4D66]/40"
                          : "bg-slate-50 text-slate-500 border-slate-200",
                      )}
                    >
                      <th className="px-6 py-4 font-medium">Supplier</th>
                      <th className="px-6 py-4 font-medium">Phone Number</th>
                      <th className="px-6 py-4 font-medium">Email</th>
                      <th className="px-6 py-4 font-medium">Address</th>
                      <th className="px-6 py-4 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody
                    className={cn(
                      "divide-y text-sm",
                      isDark ? "divide-[#0A4D66]/20" : "divide-slate-100",
                    )}
                  >
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
                          title={`Supplier: ${supplier.name}`}
                          className={cn(
                            "transition-colors",
                            isDark
                              ? cn(
                                  "hover:bg-[#0A4D66]/20",
                                  idx % 2 === 0
                                    ? "bg-[#001219]"
                                    : "bg-[#001825]",
                                )
                              : cn(
                                  "hover:bg-sky-50/80",
                                  idx % 2 === 0
                                    ? "bg-white"
                                    : "bg-slate-50/60",
                                ),
                          )}
                        >
                          <td
                            className={cn(
                              "px-6 py-4 font-medium",
                              isDark ? "text-gray-200" : "text-slate-800",
                            )}
                          >
                            {supplier.name}
                          </td>
                          <td
                            className={cn(
                              "px-6 py-4",
                              isDark ? "text-gray-300" : "text-slate-600",
                            )}
                          >
                            {supplier.contact || "-"}
                          </td>
                          <td
                            className={cn(
                              "px-6 py-4",
                              isDark ? "text-gray-300" : "text-slate-600",
                            )}
                          >
                            {supplier.email || "-"}
                          </td>
                          <td
                            className={cn(
                              "px-6 py-4 max-w-90",
                              isDark ? "text-gray-300" : "text-slate-600",
                            )}
                          >
                            <span className="line-clamp-2">
                              {supplier.address || "-"}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "px-6 py-4",
                              isDark ? "text-gray-300" : "text-slate-600",
                            )}
                          >
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
                            Phone Number
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
        ) : activeTab === "Stores" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              {/* Stores Top Row: Search, Type filter tabs, and Actions */}
              <div className="flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3 w-full lg:w-auto flex-1 max-w-xl">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Icon
                      icon="mdi:magnify"
                      className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={storeSearchQuery}
                      onChange={(e) => setStoreSearchQuery(e.target.value)}
                      placeholder="Search store name, code, base location..."
                      className={cn(
                        "w-full rounded pl-9 pr-8 py-1.5 text-xs outline-none transition-colors border",
                        isDark
                          ? "bg-[#001825] border-[#0A4D66]/40 text-white placeholder:text-gray-500 focus:border-[#7FD5FF]"
                          : "bg-white border-slate-300 text-slate-800 placeholder:text-gray-400 focus:border-[#0369A1] shadow-sm",
                      )}
                    />
                    {storeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStoreSearchQuery("")}
                        title="Clear search"
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  <div className={cn("flex items-center space-x-1 p-1 rounded-lg border shrink-0", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-100 border-slate-200")}>
                    <button
                      type="button"
                      onClick={() => setStoreViewMode("grid")}
                      title="Grid view"
                      aria-label="Grid view"
                      className={cn(
                        "p-1.5 rounded transition-all",
                        storeViewMode === "grid"
                          ? isDark
                            ? "bg-[#0A4D66] text-white shadow-sm border border-[#7FD5FF]/40"
                            : "bg-white text-[#0A4D66] shadow-sm border border-slate-200 font-bold"
                          : isDark
                            ? "text-gray-300 hover:text-white"
                            : "text-slate-500 hover:text-slate-900",
                      )}
                    >
                      <Icon icon="mdi:view-grid" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoreViewMode("table")}
                      title="Table view"
                      aria-label="Table view"
                      className={cn(
                        "p-1.5 rounded transition-all",
                        storeViewMode === "table"
                          ? isDark
                            ? "bg-[#0A4D66] text-white shadow-sm border border-[#7FD5FF]/40"
                            : "bg-white text-[#0A4D66] shadow-sm border border-slate-200 font-bold"
                          : isDark
                            ? "text-gray-300 hover:text-white"
                            : "text-slate-500 hover:text-slate-900",
                      )}
                    >
                      <Icon icon="mdi:table" className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter Pills & Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className={cn("inline-flex items-center space-x-1 p-1 rounded-lg border", isDark ? "bg-[#001825] border-[#0A4D66]/50" : "bg-slate-100 border-slate-200")}>
                    <button
                      type="button"
                      onClick={() => setStoreTypeFilter("all")}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap",
                        storeTypeFilter === "all"
                          ? isDark
                            ? "bg-[#0A4D66] text-white font-semibold shadow-sm border border-[#7FD5FF]/40"
                            : "bg-[#0A4D66] text-white font-semibold shadow-sm"
                          : isDark
                            ? "text-gray-300 hover:text-white"
                            : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      All Stores ({storesData.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoreTypeFilter("system")}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1",
                        storeTypeFilter === "system"
                          ? isDark
                            ? "bg-[#0A4D66] text-white font-semibold shadow-sm border border-[#7FD5FF]/40"
                            : "bg-[#0A4D66] text-white font-semibold shadow-sm"
                          : isDark
                            ? "text-amber-400 hover:text-amber-300"
                            : "text-amber-600 hover:text-amber-700",
                      )}
                    >
                      <Icon icon="mdi:shield-lock-outline" className="w-3.5 h-3.5" />
                      <span>Core System ({storesData.filter((s) => s.is_system).length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoreTypeFilter("custom")}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap",
                        storeTypeFilter === "custom"
                          ? isDark
                            ? "bg-[#0A4D66] text-white font-semibold shadow-sm border border-[#7FD5FF]/40"
                            : "bg-[#0A4D66] text-white font-semibold shadow-sm"
                          : isDark
                            ? "text-gray-300 hover:text-white"
                            : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      Custom Repositories ({storesData.filter((s) => !s.is_system).length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportStores}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 shadow-sm transition-colors whitespace-nowrap"
                  >
                    <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddStoreOpen(true)}
                    className="flex items-center space-x-2 bg-[#0369A1] hover:bg-[#0369A1]/90 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                  >
                    <Icon icon="mdi:plus" className="w-4 h-4" />
                    <span>Add Store</span>
                  </button>
                </div>
              </div>

              {/* Stores KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 border-t border-[#0A4D66]/40 pt-4">
                <MetricCard
                  label="Total Repositories"
                  value={storesData.length}
                  icon="mdi:store-outline"
                />
                <MetricCard
                  label="Core System Stores"
                  value={storesData.filter((s) => s.is_system).length}
                  icon="mdi:shield-lock-outline"
                  badge="Protected"
                  badgeColor="sky"
                />
                <MetricCard
                  label="Custom Stores"
                  value={storesData.filter((s) => !s.is_system).length}
                  icon="mdi:store-check-outline"
                />
                <MetricCard
                  label="Total Stock In Stores"
                  value={storesData.reduce((acc, s) => acc + (s.total_stock || 0), 0)}
                  icon="mdi:cube-outline"
                  badge="Units"
                  badgeColor="sky"
                />
                <MetricCard
                  label="Fleet Stores Valuation"
                  value={formatCurrency(storesData.reduce((acc, s) => acc + (s.total_value || 0), 0))}
                  icon="mdi:currency-usd"
                  badge="Valuation"
                  badgeColor="emerald"
                />
              </div>
            </div>

            {/* Stores Content View (Grid or Table) */}
            {isStoresLoading ? (
              <div className="py-20 text-center text-xs text-gray-400 bg-[#001219] rounded-xl border border-[#0A4D66]/40">
                <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mx-auto mb-2 text-[#7FD5FF]" />
                <p>Loading inventory stores...</p>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="py-20 text-center text-xs text-gray-400 bg-[#001219] rounded-xl border border-[#0A4D66]/40">
                <Icon icon="mdi:store-outline" className="w-10 h-10 mx-auto mb-3 text-gray-500 opacity-60" />
                <p className="font-semibold text-gray-300">No stores found.</p>
                <p className="mt-1 text-gray-500">
                  {storeSearchQuery ? "Try refining your search filter." : "Click '+ Add Store' to create a custom inventory storage location."}
                </p>
              </div>
            ) : storeViewMode === "table" ? (
              <div className="rounded-xl border border-[#0A4D66]/40 overflow-hidden bg-[#001219]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#0A4D66]/40 bg-[#001825]/90 text-[11px] uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-4 font-semibold">Store Name &amp; Code</th>
                      <th className="px-6 py-4 font-semibold">Type &amp; Status</th>
                      <th className="px-6 py-4 font-semibold">Operating Base / Unit</th>
                      <th className="px-6 py-4 font-semibold text-right">Items Count</th>
                      <th className="px-6 py-4 font-semibold text-right">Total Units</th>
                      <th className="px-6 py-4 font-semibold text-right">Valuation</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A4D66]/20 text-gray-200">
                    {filteredStores.map((store) => (
                      <tr
                        key={store.id}
                        className="hover:bg-[#0A4D66]/15 transition-colors cursor-pointer"
                        onClick={() => setStoreForView(store)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Icon
                              icon={store.is_system ? "mdi:shield-home-outline" : "mdi:store-outline"}
                              className={cn(
                                "w-5 h-5 shrink-0",
                                store.is_system ? "text-amber-400" : "text-[#7FD5FF]",
                              )}
                            />
                            <div>
                              <div className="font-semibold text-white tracking-wide">
                                {store.name}
                              </div>
                              {store.code && (
                                <div className="text-[11px] font-mono text-sky-400">
                                  {store.code}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {store.is_system ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              <Icon icon="mdi:shield-lock-outline" className="w-3.5 h-3.5" />
                              <span>Core System Store (Protected)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                              <Icon icon="mdi:check-circle-outline" className="w-3.5 h-3.5" />
                              <span>Custom Repository</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {store.unit?.name ?? "General Logistics / All Units"}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-semibold text-white">
                          {store.inventories_count ?? store.inventories?.length ?? 0}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-semibold text-[#7FD5FF]">
                          {store.total_stock ?? 0}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(store.total_value)}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setStoreForView(store)}
                              title="View Items In Store"
                              className="p-1.5 rounded hover:bg-[#0A4D66]/40 text-[#7FD5FF] hover:text-white transition-colors"
                            >
                              <Icon icon="mdi:eye" className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/inventory/add?store_id=${store.id}`)}
                              title="Add Item To This Store"
                              className="p-1.5 rounded hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              <Icon icon="mdi:plus-circle" className="w-4 h-4" />
                            </button>
                            {store.is_system ? (
                              <span
                                title="System Store cannot be edited or deleted"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-500 bg-gray-900/40 border border-gray-700/40 cursor-not-allowed"
                              >
                                <Icon icon="mdi:lock" className="w-3 h-3 text-amber-500/60" />
                                <span>Locked</span>
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setStoreForEdit(store)}
                                  title="Edit Store"
                                  className="p-1.5 rounded hover:bg-amber-600/30 text-amber-400 hover:text-amber-300 transition-colors"
                                >
                                  <Icon icon="mdi:pencil" className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStoreForDelete(store)}
                                  title="Delete Store"
                                  className="p-1.5 rounded hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <Icon icon="mdi:delete" className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStores.map((store) => (
                  <div
                    key={store.id}
                    className="bg-[#001219] border border-[#0A4D66]/40 hover:border-[#7FD5FF]/50 rounded-xl p-5 flex flex-col justify-between gap-4 transition-all relative group shadow-sm cursor-pointer"
                    onClick={() => setStoreForView(store)}
                  >
                    <div className="space-y-3">
                      {/* Store Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center border",
                            store.is_system
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                              : "bg-[#0A4D66]/30 border-[#0A4D66]/60 text-[#7FD5FF]",
                          )}>
                            <Icon
                              icon={store.is_system ? "mdi:shield-home-outline" : "mdi:store-outline"}
                              className="w-6 h-6"
                            />
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-base group-hover:text-[#7FD5FF] transition-colors">
                              {store.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              {store.code && (
                                <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-semibold">
                                  {store.code}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                {store.unit?.name ?? "General Logistics"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {store.is_system ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            <Icon icon="mdi:shield-lock-outline" className="w-3 h-3" />
                            <span>System Protected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span>Custom</span>
                          </span>
                        )}
                      </div>

                      {store.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                          {store.description}
                        </p>
                      )}

                      {/* Store Metrics Inside Card */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#001825] border border-[#0A4D66]/30 text-center">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                            Items
                          </span>
                          <span className="text-sm font-bold text-white">
                            {store.inventories_count ?? store.inventories?.length ?? 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                            Units
                          </span>
                          <span className="text-sm font-bold text-[#7FD5FF]">
                            {store.total_stock ?? 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                            Valuation
                          </span>
                          <span className="text-sm font-bold text-emerald-400">
                            {formatCurrency(store.total_value)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div
                      className="flex items-center justify-between pt-3 border-t border-[#0A4D66]/30 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setStoreForView(store)}
                        className="inline-flex items-center gap-1 text-[#7FD5FF] hover:underline font-semibold"
                      >
                        <Icon icon="mdi:eye-outline" className="w-4 h-4" />
                        <span>View Items ({store.inventories_count ?? store.inventories?.length ?? 0})</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/inventory/add?store_id=${store.id}`)}
                          title="Add Item To Store"
                          className="p-1.5 rounded hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <Icon icon="mdi:plus-circle" className="w-4 h-4" />
                        </button>
                        {store.is_system ? (
                          <span
                            title="System stores cannot be edited or deleted"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-500 bg-gray-900/60 border border-gray-700/40 cursor-not-allowed"
                          >
                            <Icon icon="mdi:lock" className="w-3 h-3 text-amber-500/70" />
                            <span>Protected</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setStoreForEdit(store)}
                              title="Edit Store"
                              className="p-1.5 rounded hover:bg-amber-600/30 text-amber-400 hover:text-amber-300 transition-colors"
                            >
                              <Icon icon="mdi:pencil" className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setStoreForDelete(store)}
                              title="Delete Store"
                              className="p-1.5 rounded hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Icon icon="mdi:delete" className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* Stores Modals */}
      <StoreModal
        open={isAddStoreOpen || Boolean(storeForEdit)}
        onClose={() => {
          setIsAddStoreOpen(false);
          setStoreForEdit(null);
        }}
        initialData={storeForEdit}
        onSuccess={() => {
          refetchStores();
        }}
      />

      <StoreInventoryModal
        open={Boolean(storeForView)}
        onClose={() => setStoreForView(null)}
        storeId={storeForView?.id ?? null}
        onAddInventoryToStore={(sId) => {
          navigate(`/dashboard/inventory/add?store_id=${sId}`);
        }}
      />

      <DeleteStoreModal
        open={Boolean(storeForDelete)}
        onClose={() => setStoreForDelete(null)}
        store={storeForDelete}
        onSuccess={() => {
          refetchStores();
        }}
      />

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
