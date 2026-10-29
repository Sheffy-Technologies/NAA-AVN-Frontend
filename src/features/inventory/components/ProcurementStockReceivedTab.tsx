import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateGoodsReceivedNoteMutation,
  useGetGoodsReceivedNotesQuery,
  useGetPurchaseOrdersQuery,
  useUpdatePurchaseOrderMutation,
  type GoodsReceivedNote,
} from "../api";
import { formatDateShort, formatTimeShort, downloadCsv, onInteractiveRowClick } from "../inventoryUtils";

export const ProcurementStockReceivedTab: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Queries & Mutations
  const {
    data: goodsReceivedNotes = [],
    isLoading: isGrnLoading,
    refetch: refetchGoodsReceivedNotes,
  } = useGetGoodsReceivedNotesQuery();
  const {
    data: purchaseOrders = [],
    refetch: refetchPurchaseOrders,
  } = useGetPurchaseOrdersQuery();

  const [createGoodsReceivedNote, { isLoading: isPostingGrn }] =
    useCreateGoodsReceivedNoteMutation();
  const [updatePurchaseOrder] = useUpdatePurchaseOrderMutation();

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [isNewGrnModalOpen, setIsNewGrnModalOpen] = useState(false);
  const [selectedGrnForDetails, setSelectedGrnForDetails] = useState<GoodsReceivedNote | null>(null);

  // New GRN Form State
  const [selectedPoId, setSelectedPoId] = useState<string>("");
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

  // Selected PO for GRN creation
  const selectedPo = useMemo(() => {
    return purchaseOrders.find((po) => po.id === Number(selectedPoId));
  }, [purchaseOrders, selectedPoId]);

  // When PO changes in form, populate lines
  const handleSelectPo = (poId: string) => {
    setSelectedPoId(poId);
    const po = purchaseOrders.find((p) => p.id === Number(poId));
    if (!po?.items?.length) {
      setGrnLineItems([]);
      return;
    }
    setGrnLineItems(
      po.items
        .filter((item) => Number(item.inventory_id) > 0)
        .map((item) => ({
          purchase_order_item_id: item.id,
          inventory_id: Number(item.inventory_id),
          part_name: item.part_number || item.inventory?.description || `Item #${item.inventory_id}`,
          quantity_ordered: Number(item.quantity_ordered ?? 1),
          quantity_received: Number(item.quantity_ordered ?? 1),
          batch_number: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
        })),
    );
  };

  // Submit New GRN
  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    const poId = Number(selectedPoId);
    if (!poId) {
      dispatch(showToast({ message: "Select a Purchase Order.", type: "error" }));
      return;
    }

    const validLines = grnLineItems.filter((line) => line.quantity_received > 0);
    if (validLines.length === 0) {
      dispatch(showToast({ message: "Specify at least one item quantity received.", type: "error" }));
      return;
    }

    try {
      await createGoodsReceivedNote({
        purchase_order_id: poId,
        received_at: new Date().toISOString(),
        notes: grnNotes || `GRN received for PO #${poId}`,
        items: validLines.map((line) => ({
          purchase_order_item_id: line.purchase_order_item_id,
          inventory_id: line.inventory_id,
          quantity_received: line.quantity_received,
          batch_number: line.batch_number || null,
        })),
      }).unwrap();

      // Update PO status to received
      await updatePurchaseOrder({
        id: poId,
        body: { status: "received" },
      }).unwrap();

      dispatch(
        showToast({
          message: "Goods Received Note posted successfully. Stock inventory has been updated.",
          type: "success",
        }),
      );
      setIsNewGrnModalOpen(false);
      setSelectedPoId("");
      setGrnNotes("");
      setGrnLineItems([]);
      refetchGoodsReceivedNotes();
      refetchPurchaseOrders();
    } catch {
      dispatch(showToast({ message: "Failed to post Goods Received Note.", type: "error" }));
    }
  };

  // Filtered GRNs
  const filteredGrns = useMemo(() => {
    return goodsReceivedNotes.filter((grn) => {
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const numMatch = (grn.grn_number ?? "").toLowerCase().includes(query);
        const poMatch = `po #${grn.purchase_order_id}`.toLowerCase().includes(query);
        const notesMatch = (grn.notes ?? "").toLowerCase().includes(query);
        return numMatch || poMatch || notesMatch;
      }
      return true;
    });
  }, [goodsReceivedNotes, searchQuery]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "GRN Reference",
      "Linked PO",
      "Date Received",
      "Items Count",
      "Receiving Notes",
    ];
    const rows = filteredGrns.map((g) => [
      g.grn_number || `GRN #${g.id}`,
      `PO #${g.purchase_order_id}`,
      `${formatDateShort(g.received_at)} ${formatTimeShort(g.received_at)}`,
      String(g.items?.length ?? 0),
      g.notes || "-",
    ]);
    downloadCsv("goods-received-notes.csv", [headers, ...rows]);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Contextual CTA Bar */}
      <div className={cn(
        "flex flex-col gap-4 p-4 rounded-xl border",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
              Stock Received (Goods Received Notes)
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
              Verified deliveries from vendors. Posting a GRN increments store inventory with inspection traceability.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search GRN # or PO #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/40 text-white placeholder-gray-500 focus:border-[#7FD5FF]"
                  : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-sky-500",
              )}
            />
          </div>

          {/* Contextual CTAs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span className="text-slate-700 dark:text-slate-200 font-semibold">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewGrnModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors whitespace-nowrap"
            >
              <Icon icon="mdi:package-check" className="w-4 h-4" />
              <span>Receive Stock (GRN)</span>
            </button>
          </div>
        </div>
      </div>

      {/* GRN Table */}
      <div className={cn(
        "rounded-xl border overflow-x-auto",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
              <th className="px-4 py-3 font-semibold">GRN Reference</th>
              <th className="px-4 py-3 font-semibold">Linked Purchase Order</th>
              <th className="px-4 py-3 font-semibold">Date Received</th>
              <th className="px-4 py-3 font-semibold">Items Count</th>
              <th className="px-4 py-3 font-semibold">Receiving Notes</th>
              <th className="px-4 py-3 font-semibold">Stock Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
            {isGrnLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  Loading Goods Received Notes...
                </td>
              </tr>
            ) : filteredGrns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  No stock receipts found. Click "Receive Stock (GRN)" to post delivery from a Purchase Order.
                </td>
              </tr>
            ) : (
              filteredGrns.map((grn) => {
                const po = purchaseOrders.find((p) => p.id === grn.purchase_order_id);
                return (
                  <tr
                    key={grn.id}
                    title="Click to inspect Goods Received Note"
                    onClick={(e) =>
                      onInteractiveRowClick(e, () => setSelectedGrnForDetails(grn))
                    }
                    className="hover:bg-[#0A4D66]/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-teal-400 font-mono">
                      {grn.grn_number || `GRN #${grn.id}`}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                      <Link
                        to={`/dashboard/inventory/purchase-orders/${grn.purchase_order_id}`}
                        state={{
                          from: "/dashboard/inventory?tab=procurement&subtab=stock-received",
                          fromLabel: "Stock Received",
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-sky-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>PO #{grn.purchase_order_id}</span>
                        {po?.name && (
                          <span className="text-[10px] text-[var(--theme-text-muted)]">({po.name})</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                      {formatDateShort(grn.received_at)} {formatTimeShort(grn.received_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--theme-text-primary)]">
                      {grn.items?.length ?? 0} item{(grn.items?.length ?? 0) === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)] max-w-xs truncate">
                      {grn.notes || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                        Credited to Stock
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGrnForDetails(grn);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-teal-300 text-[11px] font-semibold transition-colors"
                        >
                          <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/inventory/purchase-orders/${grn.purchase_order_id}`, {
                              state: {
                                from: "/dashboard/inventory?tab=procurement&subtab=stock-received",
                                fromLabel: "Stock Received",
                              },
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-sky-400 text-[11px] font-semibold transition-colors"
                          title="View Linked PO"
                        >
                          <Icon icon="mdi:cart-outline" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: RECEIVE STOCK (NEW GRN) */}
      {isNewGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={cn(
            "w-full max-w-2xl rounded-2xl border p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95",
            isDark ? "bg-[#001219] border-[#0A4D66]/60 text-white" : "bg-white border-slate-200 text-slate-800",
          )}>
            <div className="flex items-center justify-between pb-3.5 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <Icon icon="mdi:package-variant-closed-check" className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[var(--theme-text-primary)] uppercase tracking-wider">
                      Receive Stock — Goods Received Note (GRN)
                    </h3>
                    <span className="rounded bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                      Aviation Stores
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
                    Log receipt of procured spares into NA AVN inventory with batch and inspection records.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewGrnModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-white/5 transition-colors"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Purchase Order Reference <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPoId}
                  onChange={(e) => handleSelectPo(e.target.value)}
                  required
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none transition-colors",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                >
                  <option value="">-- Choose Purchase Order --</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      PO #{po.id} - {po.name || "Untitled Order"} (Supplier: {po.supplier?.name || "N/A"}) - Status: {po.status}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPo && (
                <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Vendor / Supplier</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedPo.supplier?.name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Window</span>
                    <span className="text-slate-700 dark:text-gray-300 font-mono">
                      {formatDateShort(selectedPo.order_date)} → {formatDateShort(selectedPo.expected_date_of_delivery)}
                    </span>
                  </div>
                </div>
              )}

              {grnLineItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold uppercase tracking-wider text-[11px] text-[var(--theme-text-secondary)]">
                      Delivered Items &amp; Batch Traceability
                    </label>
                    <span className="text-[10px] text-slate-400">{grnLineItems.length} items to receive</span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {grnLineItems.map((line, idx) => (
                      <div
                        key={line.purchase_order_item_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-[#0A4D66]/40 bg-slate-50/70 dark:bg-[#001825]/80"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {line.part_name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                            Quantity Ordered: <span className="font-semibold text-sky-600 dark:text-sky-400">{line.quantity_ordered}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">Qty Received</span>
                            <input
                              type="number"
                              min="1"
                              max={line.quantity_ordered}
                              value={line.quantity_received}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setGrnLineItems((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, quantity_received: val } : item,
                                  ),
                                );
                              }}
                              className={cn(
                                "w-20 rounded-lg px-2.5 py-1.5 text-center font-bold text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500",
                                isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-300 text-slate-800",
                              )}
                            />
                          </div>

                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1">Batch / Lot #</span>
                            <input
                              type="text"
                              value={line.batch_number}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGrnLineItems((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, batch_number: val } : item,
                                  ),
                                );
                              }}
                              className={cn(
                                "w-32 rounded-lg px-2.5 py-1.5 text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-sky-500",
                                isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-300 text-slate-800",
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Delivery Inspection &amp; Acceptance Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Record delivery waybill, packing slip number, certificate of conformance (CoC), condition on delivery..."
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none transition-colors",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white placeholder-gray-500" : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400",
                  )}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#0A4D66]/20">
                <button
                  type="button"
                  onClick={() => setIsNewGrnModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--theme-border-em)] text-xs font-semibold text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPostingGrn || !selectedPoId || grnLineItems.length === 0}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#025682] text-white shadow-sm transition-colors",
                    (isPostingGrn || !selectedPoId || grnLineItems.length === 0) && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {isPostingGrn ? (
                    <>
                      <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                      <span>Posting GRN...</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:check-all" className="w-4 h-4" />
                      <span>Confirm Stock Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL 2: INSPECT GRN DETAILS */}
      {selectedGrnForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={cn(
            "w-full max-w-lg rounded-xl border p-6 shadow-xl space-y-4",
            isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-800",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:package-check" className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-sm text-[var(--theme-text-primary)]">
                  GRN Details — {selectedGrnForDetails.grn_number || `GRN #${selectedGrnForDetails.id}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGrnForDetails(null)}
                className="text-[var(--theme-text-muted)] hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[#0A4D66]/30 bg-[#001825]/50">
                <div>
                  <span className="text-[var(--theme-text-muted)] block">Linked PO:</span>
                  <span className="font-bold text-sky-400">PO #{selectedGrnForDetails.purchase_order_id}</span>
                </div>
                <div>
                  <span className="text-[var(--theme-text-muted)] block">Date Received:</span>
                  <span className="font-semibold text-[var(--theme-text-primary)]">
                    {formatDateShort(selectedGrnForDetails.received_at)} {formatTimeShort(selectedGrnForDetails.received_at)}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-[var(--theme-text-muted)] mb-2">
                  Line Items Received into Stock
                </h4>
                <div className="rounded-lg border border-[var(--theme-border-em)] overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--theme-bg-panel)] text-[10px] uppercase text-[var(--theme-text-muted)]">
                      <tr>
                        <th className="px-3 py-2">Item ID</th>
                        <th className="px-3 py-2">Qty Received</th>
                        <th className="px-3 py-2">Batch #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-divider)]">
                      {(selectedGrnForDetails.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#0A4D66]/10">
                          <td className="px-3 py-2 font-mono text-[var(--theme-text-primary)]">
                            #{item.inventory_id}
                          </td>
                          <td className="px-3 py-2 font-bold text-emerald-400">
                            {item.quantity_received}
                          </td>
                          <td className="px-3 py-2 font-mono text-[var(--theme-text-muted)]">
                            {item.batch_number || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedGrnForDetails.notes && (
                <div>
                  <span className="text-[var(--theme-text-muted)] block font-semibold mb-1">Inspector Notes:</span>
                  <p className="p-2.5 rounded border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)] text-[var(--theme-text-secondary)]">
                    {selectedGrnForDetails.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#0A4D66]/20">
                <button
                  type="button"
                  onClick={() => setSelectedGrnForDetails(null)}
                  className="px-4 py-1.5 rounded-lg bg-[#0369A1] text-white font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
