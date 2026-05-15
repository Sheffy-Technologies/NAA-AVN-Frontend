import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import {
  useCreateGoodsReceivedNoteMutation,
  useGetPurchaseOrderByIdQuery,
  useUpdatePurchaseOrderMutation,
} from "../api";

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

export default function PurchaseOrderDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [feedback, setFeedback] = useState<string | null>(null);

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useGetPurchaseOrderByIdQuery(id || "", { skip: !id });

  const [updatePurchaseOrder, { isLoading: isUpdatingStatus }] =
    useUpdatePurchaseOrderMutation();
  const [createGoodsReceivedNote, { isLoading: isCreatingGrn }] =
    useCreateGoodsReceivedNoteMutation();

  const isMarkingReceived = isUpdatingStatus || isCreatingGrn;

  const grnRows = useMemo(() => {
    const rows = order?.items ?? [];
    return rows
      .filter((item) => Number(item.inventory_id) > 0)
      .map((item) => ({
        purchase_order_item_id: item.id,
        inventory_id: Number(item.inventory_id),
        quantity_received: Number(item.quantity_received ?? item.quantity_ordered ?? 0),
      }))
      .filter((item) => item.quantity_received > 0);
  }, [order]);

  const handleCreateGrnAndMarkReceived = async () => {
    if (!order?.id) return;

    if (grnRows.length === 0) {
      setFeedback("No receivable line items available to create GRN.");
      return;
    }

    setFeedback(null);

    await createGoodsReceivedNote({
      purchase_order_id: order.id,
      received_at: new Date().toISOString(),
      notes: `GRN posted from Purchase Order #${order.id}`,
      items: grnRows,
    }).unwrap();

    await updatePurchaseOrder({
      id: order.id,
      body: { status: "received" },
    }).unwrap();

    setFeedback("Goods Received Note created and purchase order marked as received.");

    refetch();
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
        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 text-sm text-gray-200">
          {feedback}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Purchase Order #{order.id}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {order.name || "Untitled Purchase Order"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[#0A4D66]/50 text-gray-200 hover:bg-[#0A4D66]/20 transition-colors"
            onClick={() => navigate(-1)}
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-black text-xs font-semibold shadow hover:bg-emerald-600 transition-colors disabled:opacity-60"
            onClick={handleCreateGrnAndMarkReceived}
            disabled={isMarkingReceived || order.status === "received"}
            title={
              order.status === "received"
                ? "Purchase order already received"
                : "Create goods received note and mark purchase order as received"
            }
          >
            <Icon
              icon={isMarkingReceived ? "mdi:loading" : "mdi:check-bold"}
              className={isMarkingReceived ? "w-4 h-4 animate-spin" : "w-4 h-4"}
            />
            {isMarkingReceived
              ? "Updating..."
              : order.status === "received"
                ? "Already Received"
                : "Create GRN + Mark Received"}
          </button>
        </div>
      </div>

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
  );
}
