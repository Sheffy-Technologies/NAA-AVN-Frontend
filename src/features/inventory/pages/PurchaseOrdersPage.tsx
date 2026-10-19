import { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { Link } from "react-router-dom";
import {
  useCreateGoodsReceivedNoteMutation,
  useGetPurchaseOrdersQuery,
  useUpdatePurchaseOrderMutation,
} from "../api";

export default function PurchaseOrdersPage() {
  const { data: purchaseOrders = [], isLoading, isError } = useGetPurchaseOrdersQuery();
  const [createGoodsReceivedNote, { isLoading: isPostingGrn }] =
    useCreateGoodsReceivedNoteMutation();
  const [updatePurchaseOrder, { isLoading: isUpdatingStatus }] =
    useUpdatePurchaseOrderMutation();
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handlePostGrn = async (order: (typeof purchaseOrders)[number]) => {
    if (!order?.id) return;

    const items = (order.items || [])
      .filter((item) => Number(item.inventory_id) > 0)
      .map((item) => ({
        purchase_order_item_id: item.id,
        inventory_id: Number(item.inventory_id),
        quantity_received: Number(item.quantity_received ?? item.quantity_ordered ?? 0),
      }))
      .filter((item) => item.quantity_received > 0);

    if (items.length === 0) {
      setMessage(`PO #${order.id}: no receivable line items found.`);
      return;
    }

    setMessage(null);
    setActiveOrderId(order.id);
    try {
      await createGoodsReceivedNote({
        purchase_order_id: order.id,
        received_at: new Date().toISOString(),
        notes: `Stock received from Purchase Orders page for PO #${order.id}`,
        items,
      }).unwrap();

      await updatePurchaseOrder({
        id: order.id,
        body: { status: "received" },
      }).unwrap();

      setMessage(`PO #${order.id}: stock received and status updated to received.`);
    } catch {
      setMessage(`PO #${order.id}: failed to post stock received.`);
    } finally {
      setActiveOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
        <Link
          to="/dashboard/inventory/purchase-orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 text-white text-xs font-semibold shadow hover:bg-emerald-700 transition-colors"
        >
          <Icon icon="mdi:cart-plus" className="w-4 h-4" />
          Create Purchase Order
        </Link>
      </div>
      {message && (
        <div className="rounded border border-[#0A4D66]/40 bg-[#001219] px-4 py-3 text-sm text-gray-200">
          {message}
        </div>
      )}
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        {isLoading ? (
          <div className="text-gray-400 text-center py-12">Loading...</div>
        ) : isError ? (
          <div className="text-red-400 text-center py-12">Failed to load purchase orders.</div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-gray-400 text-center py-12">No purchase orders found.</div>
        ) : (
          <ul className="space-y-2">
            {purchaseOrders.map((order) => (
              <li key={order.id}>
                <div className="flex items-center gap-3 rounded border border-[#0A4D66]/40 px-4 py-3 hover:bg-[#0A4D66]/20 transition-colors">
                  <Link
                    to={`/dashboard/inventory/purchase-orders/${order.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between"
                  >
                    <span className="truncate text-white">{order.name || `PO #${order.id}`}</span>
                    <span className="ml-3 text-xs text-gray-400 capitalize">{order.status || "-"}</span>
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-xs text-white hover:bg-emerald-500/10 disabled:opacity-60"
                    disabled={
                      order.status === "received" ||
                      (activeOrderId === order.id && (isPostingGrn || isUpdatingStatus))
                    }
                    onClick={() => handlePostGrn(order)}
                  >
                    <Icon
                      icon={
                        activeOrderId === order.id && (isPostingGrn || isUpdatingStatus)
                          ? "mdi:loading"
                          : "mdi:package-check"
                      }
                      className={`h-3.5 w-3.5 ${
                        activeOrderId === order.id && (isPostingGrn || isUpdatingStatus)
                          ? "animate-spin"
                          : ""
                      }`}
                    />
                    {order.status === "received"
                      ? "Received"
                      : activeOrderId === order.id && (isPostingGrn || isUpdatingStatus)
                        ? "Posting..."
                        : "Receive Stock"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
