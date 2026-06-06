import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
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

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function PurchaseOrderDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [grnFormOpen, setGrnFormOpen] = useState(false);
  const [grnDate, setGrnDate] = useState(todayIso());
  const [grnNotes, setGrnNotes] = useState("");
  const [grnQtyMap, setGrnQtyMap] = useState<Record<number, string>>({});
  const [grnError, setGrnError] = useState<string | null>(null);

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
        notes: grnNotes.trim() || `GRN posted from Purchase Order #${order.id}`,
        items,
      }).unwrap();

      await updatePurchaseOrder({
        id: order.id,
        body: { status: "received" },
      }).unwrap();

      setFeedback("Goods Received Note created and purchase order marked as received.");
      setGrnFormOpen(false);
      refetch();
    } catch {
      setGrnError("Failed to create GRN. Please try again.");
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
          {order.status !== "received" && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-black text-xs font-semibold shadow hover:bg-emerald-600 transition-colors"
              onClick={handleOpenGrnForm}
            >
              <Icon icon="mdi:clipboard-check-outline" className="w-4 h-4" />
              Create GRN
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
                Goods Received Note
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
                  placeholder={`GRN for PO #${order.id}`}
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
                className="rounded border border-[#0A4D66]/50 px-4 py-2 text-sm text-gray-300 hover:bg-[#0A4D66]/20 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitGrn}
                disabled={isSubmittingGrn}
                className="inline-flex items-center gap-2 rounded bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <Icon
                  icon={isSubmittingGrn ? "mdi:loading" : "mdi:check-bold"}
                  className={cn("w-4 h-4", isSubmittingGrn && "animate-spin")}
                />
                {isSubmittingGrn ? "Submitting..." : "Confirm GRN + Mark Received"}
              </button>
            </div>
          </div>
        </div>
      )}

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
