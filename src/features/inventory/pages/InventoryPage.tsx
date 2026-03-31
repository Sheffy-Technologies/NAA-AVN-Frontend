import { useMemo, useState, type ChangeEvent, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetInventoriesQuery,
  useUpdateInventoryStockMutation,
  useGetInventoryRequisitionsQuery,
} from "@/features/inventory/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetAssetsQuery } from "@/features/assets/api";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { FloatingActionMenu } from "@/shared/ui/menu/FloatingActionMenu";
import { DataTable } from "@/shared/ui/table/DataTable";

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
  { id: "Stock History", label: "Stock History", icon: "mdi:history" },
] as const;

const STOCK_SUB_TABS = [
  { id: "all", label: "All" },
  { id: "aircraft_spares", label: "Aircraft spares" },
  { id: "consumables", label: "Consumables" },
  { id: "ground_support", label: "Ground support" },
  { id: "general", label: "General(Qm Stores)" },
] as const;

const STOCK_TABLE_COLUMNS = [
  { key: "description", header: "Item Description", className: "px-6 py-4" },
  { key: "serial", header: "Serial No", className: "px-6 py-4" },
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

type StockSubTabId = (typeof STOCK_SUB_TABS)[number]["id"];

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

const formatNaira = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/[₦,]/g, ""));
  if (Number.isNaN(numeric)) return String(value);
  return `₦${numeric.toLocaleString()}`;
};

const normalizeInventoryType = (value: string | null | undefined) => {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "aircraft_spares" || normalized === "aircraft") {
    return "aircraft_spares";
  }
  if (normalized === "ground_support") return "ground_support";
  if (
    normalized === "oem" ||
    normalized === "consumable" ||
    normalized === "consumables"
  ) {
    return "consumables";
  }
  if (
    normalized === "general" ||
    normalized === "others" ||
    normalized === "other"
  ) {
    return "general";
  }
  return normalized;
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
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-gray-100 outline-none placeholder:text-gray-500"
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
  const [activeSubTab, setActiveSubTab] = useState<StockSubTabId>("all");
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

  const navigate = useNavigate();

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
        type: item.type,
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

  const filteredInventoryRows = useMemo(() => {
    if (activeSubTab === "all") return inventoryRows;
    return inventoryRows.filter(
      (row) => normalizeInventoryType(row.type) === activeSubTab,
    );
  }, [inventoryRows, activeSubTab]);

  const stats = [
    {
      label: "Total Items",
      value: filteredInventoryRows.length,
      color: "bg-[#7FD5FF]",
    },
    {
      label: "Total In Stock",
      value: filteredInventoryRows.reduce(
        (total, row) => total + row.currentStock,
        0,
      ),
      color: "bg-emerald-400",
    },
    {
      label: "Low In Stock",
      value: filteredInventoryRows.filter((row) => row.stockLevel === "Low")
        .length,
      color: "bg-amber-400",
    },
    {
      label: "Expired",
      value: filteredInventoryRows.filter((row) => {
        if (!row.expiryDate) return false;
        const expiryDate = new Date(row.expiryDate);
        return !Number.isNaN(expiryDate.getTime()) && expiryDate < new Date();
      }).length,
      color: "bg-red-400",
    },
    {
      label: "Critical",
      value: filteredInventoryRows.filter(
        (row) => row.stockLevel === "Critical",
      ).length,
      color: "bg-red-600",
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
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7FD5FF] shadow-[0_0_8px_rgba(127,213,255,0.5)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {activeTab === "Stocks" ? (
          <>
            <div className="flex flex-col gap-4 bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
                  {STOCK_SUB_TABS.map((subTab) => (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={() => setActiveSubTab(subTab.id)}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        activeSubTab === subTab.id
                          ? "bg-[#0A4D66] text-white"
                          : "text-gray-400 hover:text-white",
                      )}
                    >
                      {subTab.label}
                    </button>
                  ))}
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

                <Link
                  to="/dashboard/inventory/add"
                  className="flex items-center space-x-2 bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 text-[#00090D] px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Stock</span>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm border-t border-[#0A4D66]/40 pt-4 overflow-x-auto">
                {stats.map((stat) => (
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
                      {row.serialNumber}
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
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center space-x-1 bg-[#001825] p-1 rounded-lg border border-[#0A4D66]/40">
                  <button className="px-3 py-1.5 bg-[#0A4D66] text-white rounded text-xs font-medium">
                    Requisitions
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

                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  <select
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

                <Link
                  to="/dashboard/inventory/requisitions/add"
                  className="flex items-center space-x-2 bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 text-[#00090D] px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Request</span>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm border-t border-[#0A4D66]/40 pt-4 overflow-x-auto">
                {[
                  {
                    label: "Total Requests",
                    value: requisitionStats.total,
                    color: "bg-[#7FD5FF]",
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

            {viewMode === "table" ? (
              <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Time</th>
                      <th className="px-6 py-4 font-medium">
                        Requesting Location
                      </th>
                      <th className="px-6 py-4 font-medium text-right">
                        Total Cost
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
                          colSpan={7}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          Loading requisitions...
                        </td>
                      </tr>
                    ) : (requisitionsData?.length ?? 0) === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
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
                            <td className="px-6 py-4 text-right font-mono text-white">
                              {formatNaira(requisition.total_cost)}
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

                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs bg-[#001825] p-3 rounded-lg border border-[#0A4D66]/20">
                          <div>
                            <span className="text-gray-500 block mb-1">
                              Location
                            </span>
                            <span className="text-white font-medium">
                              {requestingLocation}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 block mb-1">
                              Total Cost
                            </span>
                            <span className="text-white font-medium font-mono">
                              {formatNaira(requisition.total_cost)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
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
    </div>
  );
};
