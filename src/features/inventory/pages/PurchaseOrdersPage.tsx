import { Icon } from "@/shared/icons/Icon";
import { Link } from "react-router-dom";
import { useGetPurchaseOrdersQuery } from "../api";

export default function PurchaseOrdersPage() {
  const { data: purchaseOrders = [], isLoading, isError } = useGetPurchaseOrdersQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
        <Link
          to="/dashboard/inventory/purchase-orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-black text-xs font-semibold shadow hover:bg-emerald-600 transition-colors"
        >
          <Icon icon="mdi:cart-plus" className="w-4 h-4" />
          Create Purchase Order
        </Link>
      </div>
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
                <Link
                  to={`/dashboard/inventory/purchase-orders/${order.id}`}
                  className="flex items-center justify-between rounded border border-[#0A4D66]/40 px-4 py-3 hover:bg-[#0A4D66]/20 transition-colors"
                >
                  <span className="text-white">{order.name || `PO #${order.id}`}</span>
                  <span className="text-xs text-gray-400 capitalize">{order.status || "-"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
