import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ApprovalPanel } from "@/features/approvals/components/ApprovalPanel";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { exportNaavnExcel } from "@/shared/documents/naavnExcel";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import { sanitizeDocumentFileName } from "@/shared/documents/naavnDocument";
import { printElement } from "@/shared/utils/printElement";
import { useTheme } from "@/context/ThemeContext";
import {
  useCreateGoodsReceivedNoteMutation,
  useGetPurchaseOrderByIdQuery,
  useGetPurchaseOrderShipmentsQuery,
  useGetSupplierQuotationsQuery,
  useSendPurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  type Shipment,
} from "../api";
import { BackButton } from "@/shared/ui/button";
import { PurchaseOrderPrintDocument } from "../components/PurchaseOrderPrintDocument";
import { ShipmentTrackerStepper } from "../components/ShipmentTrackerStepper";
import { CreateShipmentModal } from "../components/CreateShipmentModal";
import { UpdateShipmentStatusModal } from "../components/UpdateShipmentStatusModal";
import { buildPurchaseOrderDocument, personName } from "../procurementDocuments";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function PurchaseOrderDetailsPage() {
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const currentUser = useAppSelector((state) => state.auth.user);
  const printDocumentRef = useRef<HTMLDivElement | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [grnFormOpen, setGrnFormOpen] = useState(false);
  const [grnDate, setGrnDate] = useState(todayIso());
  const [grnNotes, setGrnNotes] = useState("");
  const [grnQtyMap, setGrnQtyMap] = useState<Record<number, string>>({});
  const [grnError, setGrnError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useGetPurchaseOrderByIdQuery(id || "", { skip: !id });

  const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
  const [isUpdateShipmentOpen, setIsUpdateShipmentOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  const {
    data: shipments = [],
    refetch: refetchShipments,
  } = useGetPurchaseOrderShipmentsQuery(id || "", { skip: !id });

  // The PO form's "QUOTE NO." comes from the supplier's quotation on the linked RFQ.
  const { data: rfqQuotations = [] } = useGetSupplierQuotationsQuery(
    { rfq_id: order?.rfq_id ?? undefined },
    { skip: !order?.rfq_id },
  );

  const [updatePurchaseOrder, { isLoading: isUpdatingStatus }] =
    useUpdatePurchaseOrderMutation();
  const [createGoodsReceivedNote, { isLoading: isCreatingGrn }] =
    useCreateGoodsReceivedNoteMutation();
  const [sendPurchaseOrder, { isLoading: isSendingToVendor }] =
    useSendPurchaseOrderMutation();

  const isSubmittingGrn = isUpdatingStatus || isCreatingGrn;
  const { isDark } = useTheme();

  // Seed qty map with order quantities when items load or form opens
  useEffect(() => {
    if (!order?.items) return;
    setGrnQtyMap((prev) => {
      const next = { ...prev };
      for (const item of order.items ?? []) {
        if (item.id !== undefined && !(item.id in next)) {
          next[item.id] = String(
            item.quantity_received ?? item.quantity_ordered ?? 0,
          );
        }
      }
      return next;
    });
  }, [order?.items]);

  const handleOpenGrnForm = () => {
    setGrnDate(todayIso());
    setGrnNotes("");
    setGrnError(null);
    setGrnFormOpen(true);
    setFeedback(null);
  };

  const handleSubmitGrn = async () => {
    if (!order?.id) return;
    setGrnError(null);

    const items = (order.items ?? [])
      .filter((item) => Number(item.inventory_id) > 0)
      .map((item) => ({
        purchase_order_item_id: item.id,
        inventory_id: Number(item.inventory_id),
        quantity_received: Number(grnQtyMap[item.id ?? -1] ?? 0),
      }))
      .filter((item) => item.quantity_received > 0);

    if (items.length === 0) {
      setGrnError("Enter a received quantity greater than 0 for at least one item.");
      return;
    }

    if (!grnDate) {
      setGrnError("Select a received date.");
      return;
    }

    try {
      await createGoodsReceivedNote({
        purchase_order_id: order.id,
        received_at: new Date(grnDate).toISOString(),
        notes: grnNotes.trim() || `Stock received against Purchase Order #${order.id}`,
        items,
      }).unwrap();

      await updatePurchaseOrder({
        id: order.id,
        body: { status: "received" },
      }).unwrap();

      setFeedback("Stock received recorded and purchase order marked as received.");
      setGrnFormOpen(false);
      refetch();
    } catch {
      setGrnError("Failed to record stock received. Please try again.");
    }
  };

  const buildDocument = () => {
    if (!order) return null;
    const supplierQuotations = rfqQuotations.filter(
      (quotation) => quotation.supplier_id === order.supplier_id,
    );
    const quotation =
      supplierQuotations.find((q) => (q.status ?? "").toLowerCase() === "approved") ??
      supplierQuotations[0];

    return buildPurchaseOrderDocument(order, {
      issuedBy: personName(currentUser) || currentUser?.name?.toUpperCase(),
      quoteNumber: quotation?.quotation_number,
    });
  };

  const documentFileName = () =>
    sanitizeDocumentFileName(
      `NAAVN PO ${order?.id ?? ""}${order?.supplier?.name ? ` ${order.supplier.name}` : ""}`,
    );

  const handlePrint = () => {
    if (!printDocumentRef.current || !order) return;
    printElement(printDocumentRef.current, `NAAVN-006_PO_${order.id}`);
  };

  const handleDownloadPdf = async () => {
    if (!printDocumentRef.current || !order || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: printDocumentRef.current,
        fileName: `NAAVN-006_Purchase_Order_${order.id}`,
        backgroundColor: "#ffffff",
      });
      dispatch(
        showToast({
          message: "Purchase Order PDF (NAAVN-006) downloaded",
          type: "success",
        }),
      );
    } catch {
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    const poDocument = buildDocument();
    if (!poDocument || isExportingExcel) return;

    setIsExportingExcel(true);
    try {
      await exportNaavnExcel([poDocument], documentFileName());
      dispatch(showToast({ message: "Excel downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download Excel", type: "error" }));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleSendToVendor = async () => {
    if (!order || isSendingToVendor) return;

    try {
      await sendPurchaseOrder(order.id).unwrap();
      dispatch(
        showToast({ message: "Purchase order sent to vendor", type: "success" }),
      );
      refetch();
    } catch {
      dispatch(
        showToast({ message: "Failed to send purchase order to vendor", type: "error" }),
      );
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        "border rounded-2xl p-12 flex flex-col items-center justify-center gap-3",
        isDark ? "bg-[#001219]/70 border-[#0A4D66]/40 text-slate-400" : "bg-white border-slate-200 text-slate-500 shadow-sm"
      )}>
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-sky-500" />
        <span className="text-sm font-semibold">Loading purchase order details...</span>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className={cn(
        "border rounded-2xl p-8 text-center",
        isDark ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-red-50 border-red-200 text-red-700 shadow-sm"
      )}>
        <Icon icon="mdi:alert-circle-outline" className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="font-semibold text-sm">Failed to load purchase order details.</p>
        <div className="mt-4">
          <BackButton
            fallbackUrl="/dashboard/inventory?tab=procurement&subtab=purchase-orders"
            label="Back to Purchase Orders"
          />
        </div>
      </div>
    );
  }

  const isReceived = (order.status ?? "").toLowerCase() === "received";
  const isSent = (order.status ?? "").toLowerCase() === "sent";

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={cn(
          "rounded-2xl p-4 text-sm flex items-start gap-3 border shadow-xs animate-in fade-in duration-300",
          isDark ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-800"
        )}>
          <Icon icon="mdi:check-circle-outline" className="w-5 h-5 mt-0.5 shrink-0 text-emerald-500" />
          <div className="flex-1 font-medium">{feedback}</div>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Modern Executive Header */}
      <div className={cn(
        "p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors",
        isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-lg shadow-black/20" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex items-center gap-4">
          <BackButton
            fallbackUrl="/dashboard/inventory?tab=procurement&subtab=purchase-orders"
            label="Back to Purchase Orders"
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Purchase Order #{order.id}
              </h1>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border",
                isReceived
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : isSent
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", isReceived ? "bg-emerald-500 animate-pulse" : isSent ? "bg-sky-500" : "bg-amber-500")} />
                {order.status || "Draft"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">{order.name || "Untitled Order"}</span>
              <span>•</span>
              <span>Raised on {formatDate(order.order_date)}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs",
              isDark
                ? "border-[#0A4D66]/60 bg-[#001825] text-slate-200 hover:bg-[#0A4D66]/40"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <Icon icon="mdi:file-document-outline" className="w-4 h-4 text-sky-500" />
            Preview Form
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs",
              isDark
                ? "border-sky-500/30 bg-[#001825] text-sky-400 hover:bg-slate-800"
                : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
            )}
            title="Print Purchase Order directly (NAAVN-006)"
          >
            <Icon icon="mdi:printer" className="w-4 h-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs disabled:opacity-60",
              isDark
                ? "border-[#0A4D66]/60 bg-[#001825] text-slate-200 hover:bg-[#0A4D66]/40"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <Icon
              icon={isExportingExcel ? "mdi:loading" : "mdi:file-excel-outline"}
              className={cn("w-4 h-4 text-emerald-500", isExportingExcel && "animate-spin")}
            />
            {isExportingExcel ? "Exporting..." : "Excel"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs disabled:opacity-60",
              isDark
                ? "border-[#0A4D66]/60 bg-[#001825] text-slate-200 hover:bg-[#0A4D66]/40"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:file-pdf-box"}
              className={cn("w-4 h-4 text-rose-500", isDownloadingPdf && "animate-spin")}
            />
            {isDownloadingPdf ? "Saving..." : "PDF"}
          </button>
          {order.supplier && (
            <button
              type="button"
              onClick={handleSendToVendor}
              disabled={isSendingToVendor || !order.supplier.email}
              title={order.supplier.email ? undefined : "Supplier has no email address on file"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-all disabled:opacity-60"
            >
              <Icon
                icon={isSendingToVendor ? "mdi:loading" : "mdi:email-send-outline"}
                className={cn("w-4 h-4", isSendingToVendor && "animate-spin")}
              />
              {isSendingToVendor ? "Sending..." : "Send to Vendor"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreateShipmentOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs",
              isDark
                ? "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
            )}
          >
            <Icon icon="mdi:truck-fast-outline" className="w-4 h-4 text-sky-500" />
            <span>{shipments.length > 0 ? "+ Consignment" : "Track Shipment"}</span>
          </button>
          {order.status !== "received" && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
              onClick={handleOpenGrnForm}
            >
              <Icon icon="mdi:clipboard-check-outline" className="w-4 h-4" />
              Receive Stock
            </button>
          )}
          {order.status === "received" && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400">
              <Icon icon="mdi:check-circle" className="w-4 h-4 text-emerald-500" />
              Already Received
            </span>
          )}
        </div>
      </div>

      {/* Approval: a PO must be approved before it can be sent to the supplier (when a workflow is active). */}
      <ApprovalPanel module="purchase-orders" recordId={order.id} onChanged={refetch} />

      {/* Modern KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Status */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Order Status</span>
            <div className={cn("p-2 rounded-xl", isReceived ? "bg-emerald-500/10 text-emerald-500" : isSent ? "bg-sky-500/10 text-sky-500" : "bg-amber-500/10 text-amber-500")}>
              <Icon icon={isReceived ? "mdi:check-decagram" : isSent ? "mdi:send-check" : "mdi:file-edit"} className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold capitalize text-slate-900 dark:text-white">
            {order.status || "Draft"}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {isReceived ? "All items verified & received" : isSent ? "Dispatched to vendor" : "Draft procurement order"}
          </p>
        </div>

        {/* Card 2: Dates */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Timeline</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Icon icon="mdi:calendar-range" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {formatDate(order.expected_date_of_delivery)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Expected Delivery • Ordered {formatDate(order.order_date)}
          </p>
        </div>

        {/* Card 3: Supplier */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Vendor / Supplier</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Icon icon="mdi:domain" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white truncate" title={order.supplier?.name}>
            {order.supplier?.name || "Direct Vendor"}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {order.supplier?.email || (order.supplier as any)?.phone || "No supplier contact registered"}
          </p>
        </div>

        {/* Card 4: Inventory Units */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Fulfillment</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
              <Icon icon="mdi:package-variant-closed" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {order.items?.reduce((sum, item) => sum + (Number(item.quantity_received) || 0), 0) ?? 0} / {order.items?.reduce((sum, item) => sum + (Number(item.quantity_ordered) || 0), 0) ?? 0} <span className="text-xs font-normal text-slate-500">Units</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {order.items?.length ?? 0} item line{(order.items?.length ?? 0) !== 1 ? "s" : ""} on this order
          </p>
        </div>
      </div>

      {/* GRN Form */}
      {grnFormOpen && (
        <div className={cn(
          "rounded-2xl border shadow-xl p-6 transition-all animate-in fade-in zoom-in-95 duration-200",
          isDark ? "border-sky-500/40 bg-[#001420]" : "border-sky-200 bg-sky-50/40"
        )}>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#0A4D66]/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Icon icon="mdi:clipboard-check-outline" className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Stock Received (Goods Received Note)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify arrived quantities and confirm stock entry into NAA inventory.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGrnFormOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <Icon icon="mdi:close" className="w-5 h-5" />
            </button>
          </div>

          <div className="pt-5 space-y-5">
            {/* Date + Notes row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Date Received <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={grnDate}
                  max={todayIso()}
                  onChange={(e) => setGrnDate(e.target.value)}
                  className={cn(
                    "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                    isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                  )}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  placeholder={`Stock received for PO #${order.id}`}
                  className={cn(
                    "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                    isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                  )}
                />
              </div>
            </div>

            {/* Per-item quantity table */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quantities Received
              </div>
              <div className={cn(
                "overflow-x-auto rounded-xl border",
                isDark ? "border-[#0A4D66]/40" : "border-slate-200 bg-white"
              )}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn(
                      "text-xs uppercase border-b font-semibold",
                      isDark ? "bg-[#001825] text-slate-400 border-[#0A4D66]/40" : "bg-slate-50 text-slate-600 border-slate-200"
                    )}>
                      <th className="px-4 py-3">Item ID</th>
                      <th className="px-4 py-3">Part No. / Description</th>
                      <th className="px-4 py-3 text-right">Ordered</th>
                      <th className="px-4 py-3 text-right w-44">
                        Qty Received <span className="text-red-500">*</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y text-sm", isDark ? "divide-[#0A4D66]/20" : "divide-slate-200")}>
                    {(order.items ?? []).map((item, idx) => {
                      const itemId = item.id ?? idx;
                      const qty = grnQtyMap[item.id ?? -1] ?? "";
                      return (
                        <tr
                          key={itemId}
                          className={cn(
                            "transition-colors",
                            isDark
                              ? (idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]/60")
                              : (idx % 2 === 0 ? "bg-white" : "bg-slate-50/60")
                          )}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-sky-600 dark:text-sky-400">
                            #{item.inventory_id}
                          </td>
                          <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                            {item.part_number || item.inventory?.part_number || "-"}
                            {item.inventory?.description && (
                              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                {item.inventory.description}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                            {item.quantity_ordered ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min={0}
                              max={item.quantity_ordered ?? undefined}
                              value={qty}
                              onChange={(e) =>
                                setGrnQtyMap((prev) => ({
                                  ...prev,
                                  [item.id ?? idx]: e.target.value,
                                }))
                              }
                              className={cn(
                                "w-28 rounded-lg px-3 py-1.5 text-sm font-semibold text-right transition-colors border focus:outline-none focus:ring-2 focus:ring-emerald-500",
                                isDark ? "border-[#0A4D66]/60 bg-[#001219] text-white" : "border-slate-300 bg-white text-slate-900"
                              )}
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {grnError && (
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-500">
                <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 shrink-0" />
                {grnError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#0A4D66]/40">
              <button
                type="button"
                onClick={() => setGrnFormOpen(false)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-colors border",
                  isDark
                    ? "border-[#0A4D66]/60 bg-[#001825] text-slate-300 hover:bg-[#0A4D66]/40"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitGrn}
                disabled={isSubmittingGrn}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 disabled:opacity-60 transition-all"
              >
                <Icon
                  icon={isSubmittingGrn ? "mdi:loading" : "mdi:check-bold"}
                  className={cn("w-4 h-4", isSubmittingGrn && "animate-spin")}
                />
                {isSubmittingGrn ? "Submitting..." : "Confirm Stock Received"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipment Status & Milestones Tracking Section */}
      <div className={cn(
        "p-6 rounded-2xl border transition-colors",
        isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Icon icon="mdi:truck-fast-outline" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Consignments & Shipment Milestones
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track AWB, dispatch, customs clearance, and delivery stages.
              </p>
            </div>
          </div>
          {shipments.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCreateShipmentOpen(true)}
              className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-500 font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/20 hover:border-sky-500/40 bg-sky-500/5 transition-all"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Add Consignment</span>
            </button>
          )}
        </div>

        {shipments.length === 0 ? (
          <div className={cn(
            "rounded-xl border border-dashed p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4",
            isDark ? "border-[#0A4D66]/60 bg-[#001825]/40" : "border-slate-300 bg-slate-50/70"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-500 border border-sky-500/20 shrink-0">
                <Icon icon="mdi:truck-delivery-outline" className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  No Shipment Tracking Attached
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Track the 4 procurement stages (Picked up &rarr; Customs clearance &rarr; In transit &rarr; Delivered) by entering an AWB or tracking number.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateShipmentOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all whitespace-nowrap self-start sm:self-auto"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Attach Tracking / AWB</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <ShipmentTrackerStepper
                key={shipment.id}
                shipment={shipment}
                onOpenUpdateModal={() => {
                  setSelectedShipment(shipment);
                  setIsUpdateShipmentOpen(true);
                }}
                onOpenGrnModal={handleOpenGrnForm}
                canReceiveStock={order.status !== "received"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Items Section */}
      <div className={cn(
        "rounded-2xl border overflow-hidden transition-colors",
        isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0A4D66]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Icon icon="mdi:format-list-bulleted-type" className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Purchase Order Line Items ({order.items?.length ?? 0})
            </h2>
          </div>
        </div>

        {order.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-175">
              <thead>
                <tr className={cn(
                  "text-xs uppercase font-semibold border-b",
                  isDark ? "bg-[#001825] text-slate-400 border-[#0A4D66]/40" : "bg-slate-50 text-slate-600 border-slate-200"
                )}>
                  <th className="px-6 py-3.5">Inventory</th>
                  <th className="px-6 py-3.5">Part Number</th>
                  <th className="px-6 py-3.5 text-right">Qty Ordered</th>
                  <th className="px-6 py-3.5 text-right">Qty Received</th>
                  <th className="px-6 py-3.5 text-right">Unit Price</th>
                  <th className="px-6 py-3.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y text-sm", isDark ? "divide-[#0A4D66]/20" : "divide-slate-200")}>
                {order.items.map((item, idx) => {
                  const qtyOrdered = Number(item.quantity_ordered) || 0;
                  const unitPrice = Number(item.unit_price) || 0;
                  const lineTotal = qtyOrdered * unitPrice;

                  return (
                    <tr
                      key={item.id ?? `${item.inventory_id}-${idx}`}
                      className={cn(
                        "transition-colors",
                        isDark
                          ? (idx % 2 === 0 ? "bg-[#001219]/60 hover:bg-[#0A4D66]/15" : "bg-[#001825]/40 hover:bg-[#0A4D66]/15")
                          : (idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/50 hover:bg-slate-100/70")
                      )}
                    >
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">
                        #{item.inventory_id}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {item.part_number || item.inventory?.part_number || "-"}
                        {item.inventory?.description && (
                          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 truncate max-w-sm mt-0.5">
                            {item.inventory.description}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {item.quantity_ordered ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold",
                          Number(item.quantity_received) >= Number(item.quantity_ordered)
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : Number(item.quantity_received) > 0
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                              : "bg-slate-500/10 text-slate-500"
                        )}>
                          {item.quantity_received ?? "0"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {item.unit_price ? Number(item.unit_price).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                        {lineTotal > 0 ? lineTotal.toLocaleString() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No items found on this purchase order.
          </div>
        )}
      </div>

      {/* Off-screen high-fidelity NAAVN-006 document element for PDF download */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "794px",
          pointerEvents: "none",
          zIndex: -999,
        }}
        aria-hidden="true"
      >
        <PurchaseOrderPrintDocument ref={printDocumentRef} order={order} />
      </div>

      {/* Document Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Icon icon="mdi:file-document-outline" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Purchase Order Document Preview
                  </h3>
                  <p className="text-xs text-slate-400">
                    Document Ref No.: NAAVN-006 • Nigerian Army Aviation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Icon icon="mdi:printer" className="h-4 w-4" />
                  Print Form
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0369A1]/90 disabled:opacity-60 transition-colors"
                >
                  <Icon
                    icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
                    className={cn("h-4 w-4", isDownloadingPdf && "animate-spin")}
                  />
                  {isDownloadingPdf ? "Downloading..." : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Icon icon="mdi:close" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-950/70 flex justify-center">
              <div className="shadow-2xl rounded-sm overflow-hidden bg-white">
                <PurchaseOrderPrintDocument order={order} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Consignment Tracking Modal */}
      {order && (
        <CreateShipmentModal
          isOpen={isCreateShipmentOpen}
          onClose={() => setIsCreateShipmentOpen(false)}
          purchaseOrderId={order.id}
          poName={order.name || undefined}
          defaultExpectedDate={order.expected_date_of_delivery}
          onSuccess={() => refetchShipments()}
        />
      )}

      {/* Manual Status Milestone Update Modal */}
      {selectedShipment && (
        <UpdateShipmentStatusModal
          isOpen={isUpdateShipmentOpen}
          onClose={() => {
            setIsUpdateShipmentOpen(false);
            setSelectedShipment(null);
          }}
          shipment={selectedShipment}
          onSuccess={() => refetchShipments()}
        />
      )}
    </div>
  );
}
