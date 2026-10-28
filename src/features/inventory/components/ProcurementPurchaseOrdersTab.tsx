import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateGoodsReceivedNoteMutation,
  useGetPurchaseOrdersQuery,
  useSendPurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  type PurchaseOrder,
} from "../api";
import { formatDateShort, downloadCsv, onInteractiveRowClick } from "../inventoryUtils";

interface ProcurementPurchaseOrdersTabProps {
  onOpenCreatePo?: () => void;
}

export const ProcurementPurchaseOrdersTab: React.FC<ProcurementPurchaseOrdersTabProps> = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Queries & Mutations
  const {
    data: purchaseOrders = [],
    isLoading: isOrdersLoading,
    refetch: refetchPurchaseOrders,
  } = useGetPurchaseOrdersQuery();

  const [createGoodsReceivedNote, { isLoading: isPostingGrn }] =
    useCreateGoodsReceivedNoteMutation();
  const [updatePurchaseOrder, { isLoading: isUpdatingPo }] =
    useUpdatePurchaseOrderMutation();
  const [sendPurchaseOrder, { isLoading: isSendingPo }] =
    useSendPurchaseOrderMutation();

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "sent" | "received"
  >("all");
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  // Quick GRN Modal state
  const [grnTargetPo, setGrnTargetPo] = useState<PurchaseOrder | null>(null);
  const [grnNotes, setGrnNotes] = useState("");
  const [grnItemQtys, setGrnItemQtys] = useState<Record<number, number>>({});

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const status = (order.status ?? "").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (order.name ?? "").toLowerCase().includes(query);
        const idMatch = `po #${order.id}`.toLowerCase().includes(query) || String(order.id).includes(query);
        const supplierMatch = (order.supplier?.name ?? "").toLowerCase().includes(query);
        return nameMatch || idMatch || supplierMatch;
      }
      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Open Quick GRN Modal
  const handleOpenGrnModal = (order: PurchaseOrder) => {
    setGrnTargetPo(order);
    setGrnNotes(`GRN for PO #${order.id} - ${order.name || ""}`);
    const initialQtys: Record<number, number> = {};
    for (const item of order.items || []) {
      const remaining = Math.max(
        0,
        (Number(item.quantity_ordered) || 0) - (Number(item.quantity_received) || 0),
      );
      initialQtys[item.id] = remaining > 0 ? remaining : Number(item.quantity_ordered) || 1;
    }
    setGrnItemQtys(initialQtys);
  };

  // Submit Quick GRN
  const handleConfirmGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnTargetPo) return;

    const items = (grnTargetPo.items || [])
      .filter((item) => Number(item.inventory_id) > 0)
      .map((item) => ({
        purchase_order_item_id: item.id,
        inventory_id: Number(item.inventory_id),
        quantity_received: grnItemQtys[item.id] ?? Number(item.quantity_ordered ?? 1),
      }))
      .filter((item) => item.quantity_received > 0);

    if (items.length === 0) {
      dispatch(showToast({ message: "No receivable line items found.", type: "error" }));
      return;
    }

    setActiveOrderId(grnTargetPo.id);
    try {
      await createGoodsReceivedNote({
        purchase_order_id: grnTargetPo.id,
        received_at: new Date().toISOString(),
        notes: grnNotes || `GRN posted for PO #${grnTargetPo.id}`,
        items,
      }).unwrap();

      await updatePurchaseOrder({
        id: grnTargetPo.id,
        body: { status: "received" },
      }).unwrap();

      dispatch(
        showToast({
          message: `PO #${grnTargetPo.id}: GRN successfully posted and status updated to received.`,
          type: "success",
        }),
      );
      setGrnTargetPo(null);
      refetchPurchaseOrders();
    } catch {
      dispatch(showToast({ message: "Failed to post GRN.", type: "error" }));
    } finally {
      setActiveOrderId(null);
    }
  };

  // Dispatch Send Email
  const handleSendPo = async (orderId: number) => {
    setActiveOrderId(orderId);
    try {
      await sendPurchaseOrder(orderId).unwrap();
      dispatch(showToast({ message: `PO #${orderId} sent to supplier.`, type: "success" }));
      refetchPurchaseOrders();
    } catch {
      dispatch(showToast({ message: `Failed to dispatch PO #${orderId}.`, type: "error" }));
    } finally {
      setActiveOrderId(null);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "PO Reference",
      "Supplier",
      "Status",
      "Order Date",
      "Expected Delivery",
      "Items Count",
    ];
    const rows = filteredOrders.map((o) => [
      o.name || `PO #${o.id}`,
      o.supplier?.name || `Supplier #${o.supplier_id}`,
      o.status || "Draft",
      formatDateShort(o.order_date),
      formatDateShort(o.expected_date_of_delivery),
      String(o.items?.length ?? 0),
    ]);
    downloadCsv("purchase-orders.csv", [headers, ...rows]);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Contextual CTA Bar */}
      <div className={cn(
        "flex flex-col gap-4 p-4 rounded-xl border",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-1 p-1 rounded-lg border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)]">
            {[
              { id: "all" as const, label: `All Orders (${purchaseOrders.length})` },
              {
                id: "sent" as const,
                label: `Sent (${purchaseOrders.filter((o) => (o.status ?? "").toLowerCase() === "sent").length})`,
              },
              {
                id: "draft" as const,
                label: `Draft (${purchaseOrders.filter((o) => (o.status ?? "").toLowerCase() === "draft").length})`,
              },
              {
                id: "received" as const,
                label: `Received (${purchaseOrders.filter((o) => (o.status ?? "").toLowerCase() === "received").length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap",
                  statusFilter === tab.id
                    ? isDark
                      ? "bg-[#001825] text-white border border-[#7FD5FF]/40 shadow-xs"
                      : "bg-white text-[#0A4D66] border border-slate-200 shadow-xs"
                    : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search PO #, name, or supplier..."
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

            <Link
              to="/dashboard/inventory/purchase-orders/new"
              state={{
                from: "/dashboard/inventory?tab=procurement&subtab=purchase-orders",
                fromLabel: "Purchase Orders",
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#0369A1]/90 text-white shadow-sm transition-colors whitespace-nowrap"
            >
              <Icon icon="mdi:cart-plus" className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className={cn(
        "rounded-xl border overflow-x-auto",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
              <th className="px-4 py-3 font-semibold">PO Reference</th>
              <th className="px-4 py-3 font-semibold">Supplier / Vendor</th>
              <th className="px-4 py-3 font-semibold">Order Date</th>
              <th className="px-4 py-3 font-semibold">Expected Delivery</th>
              <th className="px-4 py-3 font-semibold">Line Items</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
            {isOrdersLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  Loading purchase orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  No purchase orders found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const status = (order.status ?? "draft").toLowerCase();
                const isReceived = status === "received";
                const isSent = status === "sent";
                const isDraft = status === "draft";
                const isBusy =
                  activeOrderId === order.id &&
                  (isPostingGrn || isUpdatingPo || isSendingPo);

                return (
                  <tr
                    key={order.id}
                    title="Click to view purchase order details"
                    onClick={(e) =>
                      onInteractiveRowClick(e, () =>
                        navigate(`/dashboard/inventory/purchase-orders/${order.id}`, {
                          state: { from: "/dashboard/inventory?tab=procurement&subtab=purchase-orders", fromLabel: "Purchase Orders" },
                        }),
                      )
                    }
                    className="hover:bg-[#0A4D66]/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-[var(--theme-text-primary)]">
                      <Link
                        to={`/dashboard/inventory/purchase-orders/${order.id}`}
                        state={{ from: "/dashboard/inventory?tab=procurement&subtab=purchase-orders", fromLabel: "Purchase Orders" }}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-sky-400 hover:underline"
                      >
                        {order.name || `PO #${order.id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                      <div className="font-semibold text-[var(--theme-text-primary)]">
                        {order.supplier?.name || `Vendor #${order.supplier_id || "-"}`}
                      </div>
                      {order.supplier?.contact && (
                        <div className="text-[10px] text-[var(--theme-text-muted)]">
                          {order.supplier.contact}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                      {formatDateShort(order.order_date)}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                      {formatDateShort(order.expected_date_of_delivery)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--theme-text-primary)]">
                      {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize",
                          isReceived
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : isSent
                              ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                              : isDraft
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : "bg-slate-500/15 text-slate-300 border-slate-500/30",
                        )}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isDraft && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendPo(order.id);
                            }}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[11px] font-semibold transition-colors disabled:opacity-50"
                          >
                            <Icon icon="mdi:send" className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </button>
                        )}

                        {!isReceived && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenGrnModal(order);
                            }}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold transition-colors disabled:opacity-50"
                          >
                            <Icon icon="mdi:package-check" className="w-3.5 h-3.5" />
                            <span>Post GRN</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/inventory/purchase-orders/${order.id}`, {
                              state: { from: "/dashboard/inventory?tab=procurement&subtab=purchase-orders", fromLabel: "Purchase Orders" },
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-sky-400 text-[11px] font-semibold transition-colors"
                        >
                          <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
                          <span>View</span>
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

      {/* QUICK POST GRN MODAL */}
      {grnTargetPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={cn(
            "w-full max-w-lg rounded-xl border p-6 shadow-xl space-y-4",
            isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-800",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:package-check" className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-[var(--theme-text-primary)]">
                  Post Goods Received Note (GRN) — PO #{grnTargetPo.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGrnTargetPo(null)}
                className="text-[var(--theme-text-muted)] hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmGrn} className="space-y-4 text-xs">
              <div className="p-3 rounded-lg border border-[#0A4D66]/30 bg-[#001825]/50">
                <div className="font-bold text-[var(--theme-text-primary)]">
                  {grnTargetPo.name || `PO #${grnTargetPo.id}`}
                </div>
                <div className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
                  Vendor: {grnTargetPo.supplier?.name || "N/A"}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-2 text-[var(--theme-text-secondary)]">
                  Receivable Items & Delivered Quantities *
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(grnTargetPo.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--theme-text-primary)] truncate">
                          {item.part_number || item.inventory?.description || `Item #${item.inventory_id}`}
                        </div>
                        <div className="text-[10px] text-[var(--theme-text-muted)]">
                          Ordered: {item.quantity_ordered ?? 0} | Previously received: {item.quantity_received ?? 0}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--theme-text-muted)]">Received:</span>
                        <input
                          type="number"
                          min="1"
                          max={Number(item.quantity_ordered ?? 999)}
                          value={grnItemQtys[item.id] ?? 1}
                          onChange={(e) =>
                            setGrnItemQtys((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          className={cn(
                            "w-16 rounded px-2 py-1 text-center font-bold border",
                            isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-300 text-slate-800",
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Receiving Inspection Notes / Serial Checks
                </label>
                <textarea
                  rows={2}
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  placeholder="Notes on packing slip, certificate of conformity, condition..."
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#0A4D66]/20">
                <button
                  type="button"
                  onClick={() => setGrnTargetPo(null)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--theme-border-em)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPostingGrn}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {isPostingGrn ? "Posting GRN..." : "Confirm & Post GRN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
