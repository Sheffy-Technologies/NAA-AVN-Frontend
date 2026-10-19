import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { exportNaavnExcel } from "@/shared/documents/naavnExcel";
import { exportNaavnPdf } from "@/shared/documents/naavnPdf";
import { sanitizeDocumentFileName } from "@/shared/documents/naavnDocument";
import {
  useCreateGoodsReceivedNoteMutation,
  useGetPurchaseOrderByIdQuery,
  useGetSupplierQuotationsQuery,
  useSendPurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
} from "../api";
import { BackButton } from "@/shared/ui/button";
import { PurchaseOrderPrintDocument } from "../components/PurchaseOrderPrintDocument";

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
  const contentRef = useRef<HTMLDivElement | null>(null);
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
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 text-gray-400">
        Loading purchase order...
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="bg-[#001219] border border-red-500/40 rounded-xl p-6 text-red-300">
        Failed to load purchase order details.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4 text-sm text-emerald-300 flex items-start gap-2">
          <Icon icon="mdi:check-circle-outline" className="w-4 h-4 mt-0.5 shrink-0" />
          {feedback}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Purchase Order #{order.id}
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              {order.name || "Untitled Purchase Order"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-semibold text-xs transition-colors shadow-sm"
          >
            <Icon icon="mdi:file-document-outline" className="w-4 h-4 text-sky-500" />
            Preview Document
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-semibold text-xs transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icon
              icon={isExportingExcel ? "mdi:loading" : "mdi:file-excel-outline"}
              className={cn("w-4 h-4 text-emerald-600 dark:text-emerald-400", isExportingExcel && "animate-spin")}
            />
            {isExportingExcel ? "Exporting..." : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-semibold text-xs transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:file-pdf-box"}
              className={cn("w-4 h-4 text-red-600 dark:text-red-400", isDownloadingPdf && "animate-spin")}
            />
            {isDownloadingPdf ? "Downloading..." : "Export PDF"}
          </button>
          {order.supplier && (
            <button
              type="button"
              onClick={handleSendToVendor}
              disabled={isSendingToVendor || !order.supplier.email}
              title={
                order.supplier.email
                  ? undefined
                  : "Supplier has no email address on file"
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0369A1] text-white text-xs font-semibold shadow hover:bg-[#0369A1]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Icon
                icon={isSendingToVendor ? "mdi:loading" : "mdi:email-send-outline"}
                className={cn("w-4 h-4", isSendingToVendor && "animate-spin")}
              />
              {isSendingToVendor ? "Sending..." : "Send to Vendor"}
            </button>
          )}
          {order.status !== "received" && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 text-white text-xs font-semibold shadow hover:bg-emerald-700 transition-colors"
              onClick={handleOpenGrnForm}
            >
              <Icon icon="mdi:clipboard-check-outline" className="w-4 h-4" />
              Receive Stock
            </button>
          )}
          {order.status === "received" && (
            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
              <Icon icon="mdi:check-circle" className="w-4 h-4" />
              Already Received
            </span>
          )}
        </div>
      </div>

      {/* GRN Form */}
      {grnFormOpen && (
        <div className="rounded-xl border border-[#7FD5FF]/30 bg-[#001219] shadow-lg">
          <div className="flex items-center justify-between border-b border-[#0A4D66]/40 px-5 py-4">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:clipboard-check-outline" className="w-5 h-5 text-[#7FD5FF]" />
              <span className="text-sm font-semibold text-white">
                Stock Received
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGrnFormOpen(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-[#0A4D66]/40 hover:text-white transition-colors"
            >
              <Icon icon="mdi:close" className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Date + Notes row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Date Received <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={grnDate}
                  max={todayIso()}
                  onChange={(e) => setGrnDate(e.target.value)}
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  placeholder={`Stock received for PO #${order.id}`}
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                />
              </div>
            </div>

            {/* Per-item quantity table */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                Quantities Received
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#0A4D66]/40">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Part No.</th>
                      <th className="px-4 py-3 font-medium text-right">Ordered</th>
                      <th className="px-4 py-3 font-medium text-right w-36">
                        Qty Received <span className="text-red-400">*</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                    {(order.items ?? []).map((item, idx) => {
                      const itemId = item.id ?? idx;
                      const qty = grnQtyMap[item.id ?? -1] ?? "";
                      return (
                        <tr
                          key={itemId}
                          className={cn(
                            "transition-colors",
                            idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-4 py-3 text-gray-200">
                            #{item.inventory_id}
                          </td>
                          <td className="px-4 py-3 text-white font-mono text-xs">
                            {item.part_number || item.inventory?.part_number || "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">
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
                              className="w-24 rounded border border-[#0A4D66]/50 bg-[#001219] px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-[#7FD5FF]"
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
              <div className="flex items-center gap-2 text-xs text-red-400">
                <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 shrink-0" />
                {grnError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-[#0A4D66]/40 pt-4">
              <button
                type="button"
                onClick={() => setGrnFormOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-[#0A4D66]/60 bg-white dark:bg-[#001825] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitGrn}
                disabled={isSubmittingGrn}
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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

      <div className="space-y-6">
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Status</p>
            <p className="text-white font-medium capitalize">{order.status || "-"}</p>
          </div>
          <div>
            <p className="text-gray-400">Order Date</p>
            <p className="text-white font-medium">{formatDate(order.order_date)}</p>
          </div>
          <div>
            <p className="text-gray-400">Expected Delivery</p>
            <p className="text-white font-medium">
              {formatDate(order.expected_date_of_delivery)}
            </p>
          </div>
        </div>

        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <h2 className="text-sm font-bold text-[#7FD5FF] uppercase mb-3">Items</h2>
          {order.items?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-175">
                <thead>
                  <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                    <th className="px-4 py-3 font-medium">Inventory</th>
                    <th className="px-4 py-3 font-medium">Part Number</th>
                    <th className="px-4 py-3 font-medium text-right">Qty Ordered</th>
                    <th className="px-4 py-3 font-medium text-right">Qty Received</th>
                    <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                  {order.items.map((item, idx) => (
                    <tr
                      key={item.id ?? `${item.inventory_id}-${idx}`}
                      className={idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]"}
                    >
                      <td className="px-4 py-3 text-gray-200">#{item.inventory_id}</td>
                      <td className="px-4 py-3 text-white">
                        {item.part_number || item.inventory?.part_number || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-200">
                        {item.quantity_ordered ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-200">
                        {item.quantity_received ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-200">
                        {item.unit_price ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No items found.</p>
          )}
        </div>
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
                  onClick={() => window.print()}
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
    </div>
  );
}
