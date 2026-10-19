import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useApproveSupplierQuotationMutation,
  useCreateGoodsReceivedNoteMutation,
  useCreateRfqMutation,
  useCreateSupplierQuotationMutation,
  useGetGoodsReceivedNotesQuery,
  useGetPurchaseOrdersQuery,
  useGetRfqsQuery,
  useGetStockMovementsQuery,
  useGetSupplierQuotationsQuery,
  useGetSuppliersQuery,
  useUpdatePurchaseOrderMutation,
  type PurchaseOrder,
  type Rfq,
  type StockMovement,
  type SupplierQuotation,
} from "../api";
import type { ProcurementSubTabKey } from "./ProcurementSection";

type StageKey =
  | "part-demands"
  | "rfqs-issued"
  | "quotes-bids"
  | "purchase-orders"
  | "goods-received"
  | "stock-issued";

interface StageConfig {
  key: StageKey;
  step: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  accentBar: string;
}

const STAGES: StageConfig[] = [
  {
    key: "part-demands",
    step: "01",
    title: "Part Demands",
    subtitle: "Requisitions & Work Orders",
    icon: "mdi:wrench-clock",
    color: "text-amber-500 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    accentBar: "bg-amber-500",
  },
  {
    key: "rfqs-issued",
    step: "02",
    title: "RFQs Issued",
    subtitle: "Vendor Inquiries",
    icon: "mdi:file-document-edit-outline",
    color: "text-sky-500 dark:text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    accentBar: "bg-sky-500",
  },
  {
    key: "quotes-bids",
    step: "03",
    title: "Quotes & Bids",
    subtitle: "Supplier Submissions",
    icon: "mdi:cash-multiple",
    color: "text-purple-500 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    accentBar: "bg-purple-500",
  },
  {
    key: "purchase-orders",
    step: "04",
    title: "Purchase Orders",
    subtitle: "Approved Orders",
    icon: "mdi:cart-outline",
    color: "text-emerald-500 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    accentBar: "bg-emerald-500",
  },
  {
    key: "goods-received",
    step: "05",
    title: "Goods Received",
    subtitle: "GRN & Incoming Stock",
    icon: "mdi:package-check",
    color: "text-teal-500 dark:text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/30",
    accentBar: "bg-teal-500",
  },
  {
    key: "stock-issued",
    step: "06",
    title: "Stock Issued",
    subtitle: "Dispatched to Hangar",
    icon: "mdi:arrow-top-right-bold-box-outline",
    color: "text-indigo-500 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
    accentBar: "bg-indigo-500",
  },
];

const getSubTabForStage = (key: StageKey): ProcurementSubTabKey => {
  switch (key) {
    case "part-demands":
      return "part-requisitions";
    case "rfqs-issued":
    case "quotes-bids":
      return "quotations";
    case "purchase-orders":
      return "purchase-orders";
    case "goods-received":
      return "stock-received";
    case "stock-issued":
      return "stock-issued";
  }
};

interface ProcurementPipelineKanbanTabProps {
  onNavigateSubTab?: (subTab: ProcurementSubTabKey) => void;
}

export const ProcurementPipelineKanbanTab: React.FC<
  ProcurementPipelineKanbanTabProps
> = ({ onNavigateSubTab }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedItem, setDraggedItem] = useState<{
    stage: StageKey;
    data: any;
  } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StageKey | null>(null);

  // Queries
  const {
    data: stockMovements = [],
    isLoading: isMovementsLoading,
    refetch: refetchMovements,
  } = useGetStockMovementsQuery();
  const {
    data: rfqs = [],
    isLoading: isRfqsLoading,
    refetch: refetchRfqs,
  } = useGetRfqsQuery();
  const {
    data: quotations = [],
    isLoading: isQuotesLoading,
    refetch: refetchQuotations,
  } = useGetSupplierQuotationsQuery();
  const {
    data: purchaseOrders = [],
    isLoading: isPosLoading,
    refetch: refetchPurchaseOrders,
  } = useGetPurchaseOrdersQuery();
  const {
    data: goodsReceivedNotes = [],
    isLoading: isGrnLoading,
    refetch: refetchGrn,
  } = useGetGoodsReceivedNotesQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();

  // Mutations
  const [createRfq, { isLoading: isSubmittingRfq }] = useCreateRfqMutation();
  const [createSupplierQuotation, { isLoading: isSubmittingQuote }] =
    useCreateSupplierQuotationMutation();
  const [approveSupplierQuotation] = useApproveSupplierQuotationMutation();
  const [createGoodsReceivedNote, { isLoading: isSubmittingGrn }] =
    useCreateGoodsReceivedNoteMutation();
  const [updatePurchaseOrder] = useUpdatePurchaseOrderMutation();

  // Modal Action States
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [targetDemandForRfq, setTargetDemandForRfq] =
    useState<StockMovement | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [rfqNotes, setRfqNotes] = useState("");

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [targetRfqForQuote, setTargetRfqForQuote] = useState<Rfq | null>(null);
  const [quoteSupplierId, setQuoteSupplierId] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteTotalAmount, setQuoteTotalAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");

  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [targetPoForGrn, setTargetPoForGrn] = useState<PurchaseOrder | null>(
    null,
  );
  const [grnReceivedAt, setGrnReceivedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [grnNotes, setGrnNotes] = useState("");
  const [grnLineItems, setGrnLineItems] = useState<
    Array<{
      purchase_order_item_id: number;
      inventory_id: number;
      part_name: string;
      quantity_ordered: number;
      quantity_received: number;
      batch_number: string;
    }>
  >([]);

  // ── Stage 01: Part Demands ──────────────────────────────────────────
  const partDemands = useMemo(() => {
    return stockMovements.filter(
      (m) => (m.movement_type ?? "").toLowerCase() === "issue",
    );
  }, [stockMovements]);

  // ── Stage 06: Stock Issued ───────────────────────────────────────────
  const stockIssued = useMemo(() => {
    return stockMovements.filter(
      (m) =>
        (m.movement_type ?? "").toLowerCase() === "issue" &&
        (m.stocks?.length ?? 0) > 0,
    );
  }, [stockMovements]);

  // ── Filter by search query ───────────────────────────────────────────
  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  const filteredPartDemands = useMemo(() => {
    return partDemands.filter((item) => {
      const partDesc =
        item.stocks?.[0]?.inventory?.description ||
        item.stocks?.[0]?.inventory?.part_name ||
        "Part Demand";
      const partNo = item.stocks?.[0]?.inventory?.part_number || "";
      const unit = item.requesting_unit?.name || "";
      const searchBlob = `${item.id} ${partDesc} ${partNo} ${unit} ${item.notes ?? ""}`;
      return matchesSearch(searchBlob);
    });
  }, [partDemands, searchQuery]);

  const filteredRfqs = useMemo(() => {
    return rfqs.filter((item) => {
      const num = item.rfq_number || `#${item.id}`;
      const searchBlob = `${num} ${item.status ?? ""} ${item.notes ?? ""} demand-${item.stock_movement_id}`;
      return matchesSearch(searchBlob);
    });
  }, [rfqs, searchQuery]);

  const filteredQuotes = useMemo(() => {
    return quotations.filter((item) => {
      const num = item.quotation_number || `#${item.id}`;
      const supplierName = item.supplier?.name || "";
      const searchBlob = `${num} ${supplierName} ${item.status ?? ""} ${item.total_amount}`;
      return matchesSearch(searchBlob);
    });
  }, [quotations, searchQuery]);

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((item) => {
      const num = item.name || `PO #${item.id}`;
      const supplierName = item.supplier?.name || "";
      const searchBlob = `${num} ${supplierName} ${item.status ?? ""} ${item.items?.map((i) => i.part_number).join(" ")}`;
      return matchesSearch(searchBlob);
    });
  }, [purchaseOrders, searchQuery]);

  const filteredGrn = useMemo(() => {
    return goodsReceivedNotes.filter((item) => {
      const num = item.grn_number || `GRN #${item.id}`;
      const searchBlob = `${num} ${item.notes ?? ""} po-${item.purchase_order_id}`;
      return matchesSearch(searchBlob);
    });
  }, [goodsReceivedNotes, searchQuery]);

  const filteredStockIssued = useMemo(() => {
    return stockIssued.filter((item) => {
      const partDesc =
        item.stocks?.[0]?.inventory?.description ||
        item.stocks?.[0]?.inventory?.part_number ||
        "Dispatched";
      const unit = item.requesting_unit?.name || "";
      const searchBlob = `${item.id} ${partDesc} ${unit}`;
      return matchesSearch(searchBlob);
    });
  }, [stockIssued, searchQuery]);

  // ── Drag & Drop Handlers ─────────────────────────────────────────────
  const handleDragStart = (
    e: React.DragEvent,
    stage: StageKey,
    itemData: any,
  ) => {
    setDraggedItem({ stage, data: itemData });
    e.dataTransfer.setData("application/json", JSON.stringify({ stage }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetStage: StageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== targetStage) {
      setDragOverStage(targetStage);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: StageKey) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedItem) return;

    const { stage: sourceStage, data: itemData } = draggedItem;

    // Transition 1: Part Demands (01) -> RFQs (02)
    if (sourceStage === "part-demands" && targetStage === "rfqs-issued") {
      setTargetDemandForRfq(itemData);
      setSelectedSupplierIds([]);
      setRfqNotes(`RFQ created from Part Demand #${itemData.id}`);
      setIsRfqModalOpen(true);
      return;
    }

    // Transition 2: RFQs (02) -> Quotes & Bids (03)
    if (sourceStage === "rfqs-issued" && targetStage === "quotes-bids") {
      setTargetRfqForQuote(itemData);
      setQuoteSupplierId(String(itemData.suppliers?.[0]?.id ?? ""));
      setQuoteNumber(
        `QTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      );
      setQuoteTotalAmount("");
      setQuoteCurrency("USD");
      setQuoteValidUntil(
        new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      );
      setQuoteNotes("");
      setIsQuoteModalOpen(true);
      return;
    }

    // Transition 3: Quotes & Bids (03) -> Purchase Orders (04)
    if (sourceStage === "quotes-bids" && targetStage === "purchase-orders") {
      const quote = itemData as SupplierQuotation;
      if (quote.status !== "approved") {
        try {
          await approveSupplierQuotation(quote.id).unwrap();
          dispatch(
            showToast({
              message: `Quotation #${quote.quotation_number || quote.id} approved! Navigating to Purchase Order form.`,
              type: "success",
            }),
          );
          refetchQuotations();
          navigate(
            `/dashboard/inventory/purchase-orders/new?rfq_id=${quote.rfq_id}&supplier_id=${quote.supplier_id}`,
          );
        } catch {
          dispatch(
            showToast({
              message: "Failed to approve quotation",
              type: "error",
            }),
          );
        }
      } else {
        navigate(
          `/dashboard/inventory/purchase-orders/new?rfq_id=${quote.rfq_id}&supplier_id=${quote.supplier_id}`,
        );
      }
      return;
    }

    // Transition 4: Purchase Orders (04) -> Goods Received (05)
    if (sourceStage === "purchase-orders" && targetStage === "goods-received") {
      const po = itemData as PurchaseOrder;
      setTargetPoForGrn(po);
      setGrnReceivedAt(new Date().toISOString().slice(0, 10));
      setGrnNotes(`Received from Purchase Order #${po.id}`);
      setGrnLineItems(
        (po.items ?? []).map((item) => ({
          purchase_order_item_id: item.id,
          inventory_id: Number(item.inventory_id),
          part_name:
            item.part_number ||
            item.inventory?.description ||
            `Part #${item.inventory_id}`,
          quantity_ordered: Number(item.quantity_ordered ?? 1),
          quantity_received: Number(
            item.quantity_ordered ?? item.quantity_received ?? 1,
          ),
          batch_number: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
        })),
      );
      setIsGrnModalOpen(true);
      return;
    }

    // Transition 5: Goods Received (05) -> Stock Issued (06)
    if (sourceStage === "goods-received" && targetStage === "stock-issued") {
      dispatch(
        showToast({
          message: `Stock for GRN #${itemData.grn_number || itemData.id} is available for issue in Hangar Stores.`,
          type: "info",
        }),
      );
      return;
    }

    // If same column or no predefined direct transition
    if (sourceStage === targetStage) return;

    dispatch(
      showToast({
        message: `Direct transition from ${sourceStage} to ${targetStage} requires sequential workflow completion.`,
        type: "info",
      }),
    );
  };

  // ── Submit Handlers for Modals ───────────────────────────────────────
  const handleSubmitRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDemandForRfq) return;
    if (selectedSupplierIds.length === 0) {
      dispatch(
        showToast({
          message: "Please select at least one supplier.",
          type: "error",
        }),
      );
      return;
    }

    try {
      await createRfq({
        stock_movement_id: targetDemandForRfq.id,
        supplier_ids: selectedSupplierIds,
        notes: rfqNotes,
      }).unwrap();

      dispatch(
        showToast({
          message: "RFQ successfully dispatched to suppliers!",
          type: "success",
        }),
      );
      setIsRfqModalOpen(false);
      refetchRfqs();
    } catch {
      dispatch(
        showToast({ message: "Failed to dispatch RFQ", type: "error" }),
      );
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRfqForQuote) return;
    if (!quoteSupplierId) {
      dispatch(
        showToast({ message: "Please select a supplier.", type: "error" }),
      );
      return;
    }
    if (!quoteTotalAmount || Number(quoteTotalAmount) <= 0) {
      dispatch(
        showToast({ message: "Please enter a valid amount.", type: "error" }),
      );
      return;
    }

    try {
      await createSupplierQuotation({
        rfq_id: targetRfqForQuote.id,
        supplier_id: Number(quoteSupplierId),
        quotation_number: quoteNumber.trim(),
        total_amount: Number(quoteTotalAmount),
        currency: quoteCurrency,
        valid_until: quoteValidUntil || undefined,
        notes: quoteNotes,
        status: "submitted",
      }).unwrap();

      dispatch(
        showToast({
          message: "Supplier quotation successfully recorded!",
          type: "success",
        }),
      );
      setIsQuoteModalOpen(false);
      refetchQuotations();
    } catch {
      dispatch(
        showToast({ message: "Failed to record quotation", type: "error" }),
      );
    }
  };

  const handleSubmitGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPoForGrn) return;
    if (grnLineItems.length === 0) {
      dispatch(
        showToast({ message: "No items to receive on this PO.", type: "error" }),
      );
      return;
    }

    try {
      await createGoodsReceivedNote({
        purchase_order_id: targetPoForGrn.id,
        received_at: new Date(grnReceivedAt).toISOString(),
        notes: grnNotes.trim() || `GRN for PO #${targetPoForGrn.id}`,
        items: grnLineItems.map((l) => ({
          purchase_order_item_id: l.purchase_order_item_id,
          inventory_id: l.inventory_id,
          quantity_received: l.quantity_received,
          batch_number: l.batch_number,
        })),
      }).unwrap();

      await updatePurchaseOrder({
        id: targetPoForGrn.id,
        body: { status: "received" },
      }).unwrap();

      dispatch(
        showToast({
          message: "Goods Received Note posted and inventory updated!",
          type: "success",
        }),
      );
      setIsGrnModalOpen(false);
      refetchGrn();
      refetchPurchaseOrders();
    } catch {
      dispatch(
        showToast({ message: "Failed to post GRN", type: "error" }),
      );
    }
  };

  const handleAddForStage = (stageKey: StageKey) => {
    switch (stageKey) {
      case "part-demands":
        navigate("/dashboard/inventory/requisitions/add");
        break;

      case "rfqs-issued":
        if (partDemands.length > 0) {
          setTargetDemandForRfq(partDemands[0]);
          setSelectedSupplierIds(suppliers.slice(0, 3).map((s) => s.id));
          setRfqNotes(`RFQ for Demand #${partDemands[0].id}`);
          setIsRfqModalOpen(true);
        } else {
          dispatch(
            showToast({
              message: "Please create a requisition/part demand first before issuing an RFQ.",
              type: "info",
            }),
          );
          navigate("/dashboard/inventory/requisitions/add");
        }
        break;

      case "quotes-bids":
        if (rfqs.length > 0) {
          const firstRfq = rfqs[0];
          setTargetRfqForQuote(firstRfq);
          setQuoteSupplierId(
            firstRfq.suppliers?.[0]?.id
              ? String(firstRfq.suppliers[0].id)
              : suppliers[0]?.id
                ? String(suppliers[0].id)
                : "",
          );
          setQuoteNumber(`QT-${Date.now().toString().slice(-6)}`);
          setQuoteTotalAmount("");
          setQuoteCurrency("USD");
          setQuoteValidUntil("");
          setQuoteNotes("");
          setIsQuoteModalOpen(true);
        } else {
          dispatch(
            showToast({
              message: "No active RFQs available to record a quote against. Please issue an RFQ first.",
              type: "info",
            }),
          );
        }
        break;

      case "purchase-orders":
        navigate("/dashboard/inventory/purchase-orders/new");
        break;

      case "goods-received":
        if (purchaseOrders.length > 0) {
          const po = purchaseOrders[0];
          setTargetPoForGrn(po);
          setGrnReceivedAt(new Date().toISOString().slice(0, 10));
          setGrnNotes(`GRN for PO #${po.id}`);
          setGrnLineItems(
            (po.items ?? []).map((item) => ({
              purchase_order_item_id: item.id,
              inventory_id: Number(item.inventory_id),
              part_name:
                item.part_number ||
                item.inventory?.description ||
                `Part #${item.inventory_id}`,
              quantity_ordered: Number(item.quantity_ordered ?? 1),
              quantity_received: Number(
                item.quantity_ordered ?? item.quantity_received ?? 1,
              ),
              batch_number: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
            })),
          );
          setIsGrnModalOpen(true);
        } else {
          dispatch(
            showToast({
              message: "No purchase orders available to receive goods against.",
              type: "info",
            }),
          );
          navigate("/dashboard/inventory/purchase-orders/new");
        }
        break;

      case "stock-issued":
        if (onNavigateSubTab) {
          onNavigateSubTab("stock-issued");
        } else {
          navigate("/dashboard/inventory", {
            state: { inventoryTab: "Stock" },
          });
        }
        break;
    }
  };

  const isAnyLoading =
    isMovementsLoading ||
    isRfqsLoading ||
    isQuotesLoading ||
    isPosLoading ||
    isGrnLoading;

  return (
    <div className="space-y-5">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Procurement Pipeline
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#0369A1]/10 text-[#0369A1] dark:bg-sky-500/10 dark:text-sky-300 border border-[#0369A1]/20">
              Interactive Kanban
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Drag cards forward across stages to advance requisition demands, RFQs, quotations, purchase orders, and stock receipts.
          </p>
        </div>

        {/* Global Pipeline Search and Action */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards, parts, POs..."
              className={cn(
                "w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border outline-none transition-all",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/40 text-white placeholder-gray-500 focus:border-[#7FD5FF]"
                  : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#0369A1]",
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Icon icon="mdi:close-circle" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              refetchMovements();
              refetchRfqs();
              refetchQuotations();
              refetchPurchaseOrders();
              refetchGrn();
            }}
            title="Refresh Pipeline"
            className="p-2 rounded-lg border border-slate-300 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001825] text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Icon
              icon="mdi:refresh"
              className={cn("w-4 h-4", isAnyLoading && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll Container */}
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-4 min-w-[1480px]">
          {STAGES.map((stage) => {
            const isDropTarget = dragOverStage === stage.key;

            let stageItemsCount = 0;
            if (stage.key === "part-demands")
              stageItemsCount = filteredPartDemands.length;
            if (stage.key === "rfqs-issued")
              stageItemsCount = filteredRfqs.length;
            if (stage.key === "quotes-bids")
              stageItemsCount = filteredQuotes.length;
            if (stage.key === "purchase-orders")
              stageItemsCount = filteredPurchaseOrders.length;
            if (stage.key === "goods-received")
              stageItemsCount = filteredGrn.length;
            if (stage.key === "stock-issued")
              stageItemsCount = filteredStockIssued.length;

            return (
              <div
                key={stage.key}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.key)}
                className={cn(
                  "w-[260px] flex-shrink-0 flex flex-col rounded-xl border transition-all duration-200",
                  isDark ? "bg-[#001219]" : "bg-slate-100/90",
                  isDropTarget
                    ? "border-sky-400 bg-sky-500/10 shadow-lg ring-2 ring-sky-400/30 scale-[1.01]"
                    : isDark
                      ? "border-[#0A4D66]/30 shadow-sm"
                      : "border-slate-200 shadow-xs",
                )}
              >
                {/* Stage Header */}
                <div className="p-3 border-b border-inherit">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                          stage.bgColor,
                        )}
                      >
                        <Icon
                          icon={stage.icon}
                          className={cn("w-4 h-4", stage.color)}
                        />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                        {stage.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title={`Add new ${stage.title}`}
                        onClick={() => handleAddForStage(stage.key)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 dark:hover:bg-[#0A4D66]/50 transition-colors"
                      >
                        <Icon icon="mdi:plus" className="w-4 h-4 text-slate-300 dark:text-gray-300 hover:text-white" />
                      </button>

                      {onNavigateSubTab && (
                        <button
                          type="button"
                          title={`Open ${stage.title} in full table view`}
                          onClick={() =>
                            onNavigateSubTab(getSubTabForStage(stage.key))
                          }
                          className="p-1 rounded text-slate-400 hover:text-sky-500 hover:bg-sky-500/10 transition-colors"
                        >
                          <Icon icon="mdi:open-in-new" className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <span
                        className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-full",
                          stage.bgColor,
                          stage.color,
                        )}
                      >
                        {stageItemsCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Drop Zone / Card List */}
                <div className="p-2 flex-1 flex flex-col gap-2.5 min-h-[480px] max-h-[720px] overflow-y-auto custom-scrollbar">
                  {/* Stage 01: Part Demands Cards */}
                  {stage.key === "part-demands" &&
                    filteredPartDemands.map((demand) => {
                      const partDesc =
                        demand.stocks?.[0]?.inventory?.description ||
                        demand.stocks?.[0]?.inventory?.part_name ||
                        "Requisition Demand";
                      const partNo =
                        demand.stocks?.[0]?.inventory?.part_number || "-";
                      const unitName =
                        demand.requesting_unit?.name ||
                        (demand.work_order_id
                          ? `WO #${demand.work_order_id}`
                          : "Hangar Requisition");

                      return (
                        <div
                          key={demand.id}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, "part-demands", demand)
                          }
                          className={cn(
                            "group relative p-3 rounded-xl border bg-white dark:bg-[#001825] transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md",
                            isDark
                              ? "border-[#0A4D66]/40 hover:border-[#7FD5FF]"
                              : "border-slate-200 hover:border-[#0369A1]",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold font-mono text-amber-500">
                              #DEMAND-{demand.id}
                            </span>
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold uppercase">
                              Needs RFQ
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                            {partDesc}
                          </h4>

                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                            <span className="font-mono text-[10px]">
                              P/N: {partNo}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-gray-200">
                              x {demand.quantity} EA
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 truncate max-w-[120px]">
                              {unitName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetDemandForRfq(demand);
                                setSelectedSupplierIds([]);
                                setRfqNotes(
                                  `RFQ created from Part Demand #${demand.id}`,
                                );
                                setIsRfqModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold hover:underline"
                            >
                              <Icon icon="mdi:arrow-right" className="w-3 h-3" />
                              <span>Dispatch</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* Stage 02: RFQs Issued Cards */}
                  {stage.key === "rfqs-issued" &&
                    filteredRfqs.map((rfq) => {
                      const rfqRef = rfq.rfq_number || `RFQ-${rfq.id}`;
                      const suppliersCount = rfq.suppliers?.length ?? 0;

                      return (
                        <div
                          key={rfq.id}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, "rfqs-issued", rfq)
                          }
                          className={cn(
                            "group relative p-3 rounded-xl border bg-white dark:bg-[#001825] transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md",
                            isDark
                              ? "border-[#0A4D66]/40 hover:border-[#7FD5FF]"
                              : "border-slate-200 hover:border-[#0369A1]",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold font-mono text-sky-500">
                              {rfqRef}
                            </span>
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 font-semibold uppercase">
                              {rfq.status || "Sent"}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-slate-800 dark:text-gray-200 line-clamp-2">
                            {rfq.notes || `Inquiry for Demand #${rfq.stock_movement_id}`}
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Icon
                                icon="mdi:account-group-outline"
                                className="w-3.5 h-3.5 text-sky-400"
                              />
                              <span>{suppliersCount} Vendors</span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Req #{rfq.stock_movement_id}
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/dashboard/inventory/rfq/${rfq.id}`)
                              }
                              className="text-slate-400 hover:text-slate-200 underline"
                            >
                              Inspect RFQ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetRfqForQuote(rfq);
                                setQuoteSupplierId(
                                  String(rfq.suppliers?.[0]?.id ?? ""),
                                );
                                setQuoteNumber(
                                  `QTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                                );
                                setQuoteTotalAmount("");
                                setQuoteCurrency("USD");
                                setQuoteValidUntil(
                                  new Date(Date.now() + 30 * 86400000)
                                    .toISOString()
                                    .slice(0, 10),
                                );
                                setQuoteNotes("");
                                setIsQuoteModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold hover:underline"
                            >
                              <Icon icon="mdi:plus" className="w-3 h-3" />
                              <span>Log Quote</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* Stage 03: Quotes & Bids Cards */}
                  {stage.key === "quotes-bids" &&
                    filteredQuotes.map((quote) => {
                      const quoteRef =
                        quote.quotation_number || `Quote #${quote.id}`;
                      const isApproved =
                        (quote.status ?? "").toLowerCase() === "approved";

                      return (
                        <div
                          key={quote.id}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, "quotes-bids", quote)
                          }
                          className={cn(
                            "group relative p-3 rounded-xl border bg-white dark:bg-[#001825] transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md",
                            isApproved
                              ? "border-emerald-500/50 bg-emerald-500/5"
                              : isDark
                                ? "border-[#0A4D66]/40 hover:border-[#7FD5FF]"
                                : "border-slate-200 hover:border-[#0369A1]",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold font-mono text-purple-500">
                              {quoteRef}
                            </span>
                            <span
                              className={cn(
                                "text-[9.5px] px-1.5 py-0.5 rounded font-semibold uppercase",
                                isApproved
                                  ? "bg-emerald-500/10 text-emerald-500 font-bold"
                                  : "bg-purple-500/10 text-purple-400",
                              )}
                            >
                              {quote.status || "Submitted"}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {quote.supplier?.name || "Supplier"}
                          </h4>

                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                              {quote.currency || "$"}{" "}
                              {Number(quote.total_amount).toLocaleString(
                                undefined,
                                { minimumFractionDigits: 2 },
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              RFQ #{quote.rfq_id}
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                            {!isApproved ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await approveSupplierQuotation(
                                      quote.id,
                                    ).unwrap();
                                    dispatch(
                                      showToast({
                                        message: "Quotation approved!",
                                        type: "success",
                                      }),
                                    );
                                    refetchQuotations();
                                  } catch {
                                    dispatch(
                                      showToast({
                                        message: "Failed to approve quotation",
                                        type: "error",
                                      }),
                                    );
                                  }
                                }}
                                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                              >
                                Approve Bid
                              </button>
                            ) : (
                              <span className="text-emerald-500 font-medium text-[9px] flex items-center gap-1">
                                <Icon icon="mdi:check" className="w-3 h-3" />
                                Ready for PO
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/dashboard/inventory/purchase-orders/new?rfq_id=${quote.rfq_id}&supplier_id=${quote.supplier_id}`,
                                )
                              }
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                            >
                              <span>Generate PO</span>
                              <Icon icon="mdi:arrow-right" className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* Stage 04: Purchase Orders Cards */}
                  {stage.key === "purchase-orders" &&
                    filteredPurchaseOrders.map((po) => {
                      const poRef = `PO #${po.id}`;
                      const isReceived = po.status === "received";

                      return (
                        <div
                          key={po.id}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, "purchase-orders", po)
                          }
                          className={cn(
                            "group relative p-3 rounded-xl border bg-white dark:bg-[#001825] transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md",
                            isReceived
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : isDark
                                ? "border-[#0A4D66]/40 hover:border-[#7FD5FF]"
                                : "border-slate-200 hover:border-[#0369A1]",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold font-mono text-emerald-500">
                              {poRef}
                            </span>
                            <span
                              className={cn(
                                "text-[9.5px] px-1.5 py-0.5 rounded font-semibold uppercase",
                                isReceived
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-amber-500/10 text-amber-500",
                              )}
                            >
                              {po.status || "Draft"}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {po.supplier?.name || "Dakota Parts"}
                          </h4>

                          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                            {po.items?.length ?? 0} item line
                            {(po.items?.length ?? 0) === 1 ? "" : "s"} ordered
                          </p>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/dashboard/inventory/purchase-orders/${po.id}`,
                                )
                              }
                              className="text-slate-400 hover:text-slate-200 underline"
                            >
                              View PO
                            </button>

                            {!isReceived ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetPoForGrn(po);
                                  setGrnReceivedAt(
                                    new Date().toISOString().slice(0, 10),
                                  );
                                  setGrnNotes(`Received for PO #${po.id}`);
                                  setGrnLineItems(
                                    (po.items ?? []).map((item) => ({
                                      purchase_order_item_id: item.id,
                                      inventory_id: Number(item.inventory_id),
                                      part_name:
                                        item.part_number ||
                                        item.inventory?.description ||
                                        `Part #${item.inventory_id}`,
                                      quantity_ordered: Number(
                                        item.quantity_ordered ?? 1,
                                      ),
                                      quantity_received: Number(
                                        item.quantity_ordered ??
                                          item.quantity_received ??
                                          1,
                                      ),
                                      batch_number: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
                                    })),
                                  );
                                  setIsGrnModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold hover:underline"
                              >
                                <Icon
                                  icon="mdi:package-check"
                                  className="w-3.5 h-3.5"
                                />
                                <span>Receive GRN</span>
                              </button>
                            ) : (
                              <span className="text-emerald-500 font-medium text-[9px] flex items-center gap-1">
                                <Icon icon="mdi:check" className="w-3 h-3" />
                                Goods Logged
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {/* Stage 05: Goods Received (GRN) Cards */}
                  {stage.key === "goods-received" &&
                    filteredGrn.map((grn) => {
                      const grnRef = grn.grn_number || `GRN #${grn.id}`;

                      return (
                        <div
                          key={grn.id}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, "goods-received", grn)
                          }
                          className={cn(
                            "group relative p-3 rounded-xl border bg-white dark:bg-[#001825] transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md",
                            isDark
                              ? "border-[#0A4D66]/40 hover:border-[#7FD5FF]"
                              : "border-slate-200 hover:border-[#0369A1]",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold font-mono text-teal-500">
                              {grnRef}
                            </span>
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500 font-semibold uppercase">
                              Stocked
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            PO #{grn.purchase_order_id} Receipt
                          </h4>

                          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 truncate">
                            {grn.items?.length ?? 1} item(s) checked into inventory
                          </p>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 text-[10px]">
                              {grn.receiver?.name || "Warehouse"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                dispatch(
                                  showToast({
                                    message: `GRN #${grnRef} is available for issue in Hangar Stores.`,
                                    type: "info",
                                  }),
                                );
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                            >
                              Ready to Issue →
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* Stage 06: Stock Issued Cards */}
                  {stage.key === "stock-issued" &&
                    filteredStockIssued.map((issue) => {
                      const desc =
                        issue.stocks?.[0]?.inventory?.description ||
                        issue.stocks?.[0]?.inventory?.part_number ||
                        "Part Dispatched";

                      return (
                        <div
                          key={issue.id}
                          className={cn(
                            "group relative p-3 rounded-xl border bg-white dark:bg-[#001825] transition-all duration-150",
                            isDark
                              ? "border-[#0A4D66]/30"
                              : "border-slate-200 shadow-xs",
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold font-mono text-indigo-500">
                              #ISSUE-{issue.id}
                            </span>
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-semibold uppercase">
                              In Service
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                            {desc}
                          </h4>

                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                            <span>x {issue.quantity} EA</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {issue.requesting_unit?.name || "Aircraft Hangar"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  {stageItemsCount === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-lg">
                      <Icon
                        icon={stage.icon}
                        className="w-8 h-8 opacity-20 mb-2"
                      />
                      <p className="text-xs font-semibold">No records in this stage</p>
                      <p className="text-[10px] opacity-75 mt-0.5">
                        Drag cards here to advance
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal: Dispatch RFQ (Drag 01 -> 02) ────────────────────────── */}
      {isRfqModalOpen && targetDemandForRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sky-400">
                <Icon icon="mdi:file-document-edit-outline" className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">
                  Dispatch Request for Quotation (RFQ)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRfqModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRfq} className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-400 uppercase font-mono text-[10px]">
                    Originating Demand Ref: #{targetDemandForRfq.id}
                  </p>
                  {partDemands.length > 1 && (
                    <select
                      value={targetDemandForRfq.id}
                      onChange={(e) => {
                        const d = partDemands.find((item) => item.id === Number(e.target.value));
                        if (d) setTargetDemandForRfq(d);
                      }}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-sky-400 outline-none"
                    >
                      {partDemands.map((d) => (
                        <option key={d.id} value={d.id}>
                          Demand #{d.id} ({d.stocks?.[0]?.inventory?.part_number || "Item"})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="font-semibold text-white">
                  {targetDemandForRfq.stocks?.[0]?.inventory?.description ||
                    "Part Demand"}
                </p>
                <p className="text-slate-400 font-mono text-[11px]">
                  Part No:{" "}
                  {targetDemandForRfq.stocks?.[0]?.inventory?.part_number || "-"} •
                  Qty: {targetDemandForRfq.quantity} EA
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Suppliers to Invite for Quotes *
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-700 rounded-lg p-2.5 bg-slate-950/60">
                  {suppliers.map((sup) => {
                    const isChecked = selectedSupplierIds.includes(sup.id);
                    return (
                      <label
                        key={sup.id}
                        className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer hover:bg-slate-800/40 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSupplierIds((prev) => [
                                ...prev,
                                sup.id,
                              ]);
                            } else {
                              setSelectedSupplierIds((prev) =>
                                prev.filter((id) => id !== sup.id),
                              );
                            }
                          }}
                          className="rounded border-slate-700 text-sky-500 focus:ring-sky-400"
                        />
                        <span className="font-medium">{sup.name}</span>
                        {sup.contact && (
                          <span className="text-[10px] text-slate-400 ml-auto font-mono">
                            {sup.contact}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  RFQ Inquiries & Notes
                </label>
                <textarea
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 p-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-400 outline-none"
                  placeholder="e.g. Please provide formal quote with unit pricing, condition, lead time, and validity."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRfqModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRfq || selectedSupplierIds.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#0369A1]/90 text-white disabled:opacity-50"
                >
                  <Icon
                    icon={isSubmittingRfq ? "mdi:loading" : "mdi:send"}
                    className={cn("w-4 h-4", isSubmittingRfq && "animate-spin")}
                  />
                  <span>Dispatch RFQ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Record Quotation (Drag 02 -> 03) ────────────────────── */}
      {isQuoteModalOpen && targetRfqForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Icon icon="mdi:cash-multiple" className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">
                  Log Received Supplier Quotation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuote} className="mt-4 space-y-3.5">
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 font-mono text-[10px] block">
                    Target RFQ:
                  </span>
                  {rfqs.length > 1 && (
                    <select
                      value={targetRfqForQuote.id}
                      onChange={(e) => {
                        const r = rfqs.find((item) => item.id === Number(e.target.value));
                        if (r) {
                          setTargetRfqForQuote(r);
                          if (r.suppliers?.[0]?.id) {
                            setQuoteSupplierId(String(r.suppliers[0].id));
                          }
                        }
                      }}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-purple-400 outline-none"
                    >
                      {rfqs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.rfq_number || `RFQ #${r.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <span className="font-bold text-white text-sm">
                  {targetRfqForQuote.rfq_number ||
                    `RFQ #${targetRfqForQuote.id}`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supplier / Vendor *
                </label>
                <select
                  value={quoteSupplierId}
                  onChange={(e) => setQuoteSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:border-purple-400 outline-none"
                  required
                >
                  <option value="">Select Supplier</option>
                  {(targetRfqForQuote.suppliers?.length
                    ? targetRfqForQuote.suppliers
                    : suppliers
                  ).map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quotation Ref # *
                  </label>
                  <input
                    type="text"
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-mono focus:border-purple-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:border-purple-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={quoteCurrency}
                    onChange={(e) => setQuoteCurrency(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:border-purple-400 outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="NGN">NGN (₦)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Total Quoted Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quoteTotalAmount}
                    onChange={(e) => setQuoteTotalAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-mono font-bold focus:border-purple-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes & Lead Time
                </label>
                <textarea
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white focus:border-purple-400 outline-none"
                  placeholder="e.g. Lead time 14 days, OEM factory warranty included."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuote}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  <Icon
                    icon={isSubmittingQuote ? "mdi:loading" : "mdi:check-bold"}
                    className={cn(
                      "w-4 h-4",
                      isSubmittingQuote && "animate-spin",
                    )}
                  />
                  <span>Record Quotation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Post GRN (Drag 04 -> 05) ────────────────────────────── */}
      {isGrnModalOpen && targetPoForGrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-teal-400">
                <Icon icon="mdi:package-check" className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">
                  Goods Received Note (GRN) Receipt
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGrnModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGrn} className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <span className="text-slate-400 font-mono text-[10px] block">
                    Source Purchase Order:
                  </span>
                  <span className="font-bold text-white text-sm">
                    {targetPoForGrn.name || `PO #${targetPoForGrn.id}`}
                  </span>
                </div>
                {purchaseOrders.length > 1 && (
                  <select
                    value={targetPoForGrn.id}
                    onChange={(e) => {
                      const po = purchaseOrders.find((item) => item.id === Number(e.target.value));
                      if (po) {
                        setTargetPoForGrn(po);
                        setGrnNotes(`GRN for PO #${po.id}`);
                        setGrnLineItems(
                          (po.items ?? []).map((item) => ({
                            purchase_order_item_id: item.id,
                            inventory_id: Number(item.inventory_id),
                            part_name:
                              item.part_number ||
                              item.inventory?.description ||
                              `Part #${item.inventory_id}`,
                            quantity_ordered: Number(item.quantity_ordered ?? 1),
                            quantity_received: Number(
                              item.quantity_ordered ?? item.quantity_received ?? 1,
                            ),
                            batch_number: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
                          })),
                        );
                      }
                    }}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-teal-400 outline-none"
                  >
                    {purchaseOrders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || `PO #${p.id}`}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-slate-300 font-semibold text-xs shrink-0">
                  Supplier: {targetPoForGrn.supplier?.name || "Supplier"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date Received *
                  </label>
                  <input
                    type="date"
                    value={grnReceivedAt}
                    onChange={(e) => setGrnReceivedAt(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:border-teal-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GRN Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={grnNotes}
                    onChange={(e) => setGrnNotes(e.target.value)}
                    placeholder="e.g. Inspected and verified in good condition."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:border-teal-400 outline-none"
                  />
                </div>
              </div>

              {/* Items to receive */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Line Items to Stock
                </label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 divide-y divide-slate-800">
                  {grnLineItems.map((item, idx) => (
                    <div
                      key={item.purchase_order_item_id || idx}
                      className="p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-white truncate">
                          {item.part_name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Batch: {item.batch_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          Ordered: {item.quantity_ordered}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-teal-400">
                            Recv:
                          </span>
                          <input
                            type="number"
                            min="1"
                            max={item.quantity_ordered}
                            value={item.quantity_received}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setGrnLineItems((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, quantity_received: val }
                                    : l,
                                ),
                              );
                            }}
                            className="w-16 rounded border border-slate-700 bg-slate-900 p-1 text-center font-mono font-bold text-white focus:border-teal-400 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGrn}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                >
                  <Icon
                    icon={isSubmittingGrn ? "mdi:loading" : "mdi:check-bold"}
                    className={cn(
                      "w-4 h-4",
                      isSubmittingGrn && "animate-spin",
                    )}
                  />
                  <span>Confirm GRN & Receive Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
