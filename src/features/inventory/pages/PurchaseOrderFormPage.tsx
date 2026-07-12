import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  type ProcurementBudget,
  type ProcurementCurrency,
  type CreatePurchaseOrderPayload,
  useGetBudgetsQuery,
  useGetCurrenciesQuery,
  useGetRfqsQuery,
  useGetSuppliersQuery,
  useGetSupplierQuotationsQuery,
  useCreatePurchaseOrderMutation,
  useGetInventoriesQuery,
} from "../api";
import { Icon } from "@/shared/icons/Icon";

type PurchaseOrderStatus = "draft" | "sent" | "received";

type PurchaseOrderFormState = {
  approved_bid_id: string;
  rfq_id: string;
  supplier_id: string;
  budget_id: string;
  currency_id: string;
  name: string;
  order_date: string;
  expected_date_of_delivery: string;
  status: PurchaseOrderStatus;
};

type ItemDraft = {
  inventory_id: string;
  part_number: string;
  quantity_ordered: string;
  quantity_received: string;
  unit_price: string;
};

type PurchaseOrderItemPayload = {
  inventory_id: number;
  part_number?: string | null;
  quantity_ordered?: number;
  quantity_received?: number | null;
  unit_price?: number | null;
};

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRfqId = searchParams.get("rfq_id") ?? "";
  const initialBidId = searchParams.get("bid_id") ?? "";

  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: inventories = [] } = useGetInventoriesQuery();
  const { data: budgets = [] } = useGetBudgetsQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: rfqs = [] } = useGetRfqsQuery();
  const { data: quotations = [] } = useGetSupplierQuotationsQuery();
  const [createPurchaseOrder, { isLoading }] = useCreatePurchaseOrderMutation();

  const approvedBids = useMemo(
    () => quotations.filter((quote) => String(quote.status).toLowerCase() === "approved"),
    [quotations],
  );

  const rfqNumberById = useMemo(() => {
    const map = new Map<number, string>();
    rfqs.forEach((rfq) => {
      map.set(rfq.id, rfq.rfq_number || `RFQ #${rfq.id}`);
    });
    return map;
  }, [rfqs]);

  const rfqById = useMemo(() => {
    const map = new Map<number, (typeof rfqs)[number]>();
    rfqs.forEach((rfq) => {
      map.set(rfq.id, rfq);
    });
    return map;
  }, [rfqs]);

  const approvedBidById = useMemo(() => {
    const map = new Map<number, (typeof approvedBids)[number]>();
    approvedBids.forEach((quote) => {
      map.set(quote.id, quote);
    });
    return map;
  }, [approvedBids]);


  const [form, setForm] = useState<PurchaseOrderFormState>(() => ({
    approved_bid_id: initialBidId,
    rfq_id: initialRfqId,
    supplier_id: "",
    budget_id: "",
    currency_id: "",
    name: "",
    order_date: "",
    expected_date_of_delivery: "",
    status: "draft",
  }));

  // Sync form with pre-filled bid once quotations have loaded
  const [bidSynced, setBidSynced] = useState(false);
  if (!bidSynced && initialBidId && approvedBids.length > 0) {
    const bid = approvedBidById.get(Number(initialBidId));
    if (bid) {
      setBidSynced(true);
      const supplierIdFromBid = bid.supplier_id ? String(bid.supplier_id) : "";
      setForm((prev) => ({
        ...prev,
        approved_bid_id: String(bid.id),
        rfq_id: String(bid.rfq_id),
        supplier_id: supplierIdFromBid || prev.supplier_id,
      }));
    }
  }
  const [items, setItems] = useState<PurchaseOrderItemPayload[]>([]);
  const [itemDraft, setItemDraft] = useState<ItemDraft>({
    inventory_id: "",
    part_number: "",
    quantity_ordered: "1",
    quantity_received: "",
    unit_price: "",
  });
  const [error, setError] = useState<string | null>(null);

  // Preselect items from the parts requisition (stock movement) the RFQ was raised
  // from, since the RFQ/quotation/PO chain all trace back to the same requisition.
  const [rfqItemsSynced, setRfqItemsSynced] = useState(false);
  if (!rfqItemsSynced && form.rfq_id && items.length === 0 && rfqs.length > 0) {
    const linkedRfq = rfqById.get(Number(form.rfq_id));
    if (linkedRfq) {
      const requisitionLines = (linkedRfq.stock_movement?.stocks ?? []).filter(
        (line) => typeof line.inventory_id === "number",
      );

      if (requisitionLines.length > 0) {
        setRfqItemsSynced(true);
        setItems(
          requisitionLines.map((line) => {
            const quantity = line.quantity_approved || line.quantity_requested || 1;
            const item: PurchaseOrderItemPayload = {
              inventory_id: line.inventory_id as number,
              quantity_ordered: quantity,
            };

            const partNumber = line.inventory?.part_number;
            if (partNumber) item.part_number = partNumber;

            const unitCost = Number(line.inventory?.unit_cost);
            if (!Number.isNaN(unitCost) && unitCost > 0) item.unit_price = unitCost;

            return item;
          }),
        );
      } else {
        setRfqItemsSynced(true);
      }
    }
  }

  const handleAddItem = () => {
    if (!itemDraft.inventory_id) return;

    const quantityOrdered = Number(itemDraft.quantity_ordered);
    if (Number.isNaN(quantityOrdered) || quantityOrdered < 1) return;

    const selectedInventory = inventories.find(
      (inv) => Number(inv.id) === Number(itemDraft.inventory_id),
    );

    const payloadItem: PurchaseOrderItemPayload = {
      inventory_id: Number(itemDraft.inventory_id),
      quantity_ordered: quantityOrdered,
    };

    const partNumber = itemDraft.part_number.trim() || selectedInventory?.part_number;
    if (partNumber) payloadItem.part_number = partNumber;

    if (itemDraft.quantity_received.trim() !== "") {
      const quantityReceived = Number(itemDraft.quantity_received);
      if (!Number.isNaN(quantityReceived) && quantityReceived >= 0) {
        payloadItem.quantity_received = quantityReceived;
      }
    }

    if (itemDraft.unit_price.trim() !== "") {
      const unitPrice = Number(itemDraft.unit_price);
      if (!Number.isNaN(unitPrice) && unitPrice >= 0) {
        payloadItem.unit_price = unitPrice;
      }
    }

    setItems((prev) => [...prev, payloadItem]);
    setItemDraft({
      inventory_id: "",
      part_number: "",
      quantity_ordered: "1",
      quantity_received: "",
      unit_price: "",
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (items.length === 0) {
      setError("At least one item is required.");
      return;
    }

    if (!form.budget_id.trim()) {
      setError("Select a budget.");
      return;
    }

    if (!form.currency_id.trim()) {
      setError("Select a currency.");
      return;
    }

    const selectedBudget = budgets.find(
      (budget) => Number(budget.id) === Number(form.budget_id),
    );

    if (
      selectedBudget?.currency_id &&
      Number(selectedBudget.currency_id) !== Number(form.currency_id)
    ) {
      setError("Selected currency does not match budget currency.");
      return;
    }

    const payload: CreatePurchaseOrderPayload = {
      items,
    };

    if (form.supplier_id.trim() !== "") payload.supplier_id = Number(form.supplier_id);
    if (form.budget_id.trim() !== "") payload.budget_id = Number(form.budget_id);
    if (form.currency_id.trim() !== "") payload.currency_id = Number(form.currency_id);
    if (form.rfq_id.trim() !== "") payload.rfq_id = Number(form.rfq_id);
    if (form.name.trim() !== "") payload.name = form.name.trim();
    if (form.order_date.trim() !== "") payload.order_date = form.order_date;
    if (form.expected_date_of_delivery.trim() !== "") {
      payload.expected_date_of_delivery = form.expected_date_of_delivery;
    }
    if (form.status) payload.status = form.status;

    try {
      await createPurchaseOrder(payload).unwrap();
      navigate("/dashboard/inventory/purchase-orders");
    } catch {
      setError("Failed to create purchase order.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-6">
        {initialRfqId ? (
          <button
            type="button"
            onClick={() => navigate(`/dashboard/inventory/rfq/${initialRfqId}`)}
            className="inline-flex items-center justify-center p-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-400 hover:text-white transition-colors"
            title="Back to RFQ"
          >
            <Icon icon="mdi:arrow-left" className="w-5 h-5" />
          </button>
        ) : null}
        <h2 className="text-xl font-bold text-white">Create Purchase Order</h2>
        {initialRfqId && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#7FD5FF]/30 bg-[#0369A1]/10 px-3 py-1 text-xs text-[#7FD5FF]">
            <Icon icon="mdi:link-variant" className="w-3.5 h-3.5" />
            Linked to {rfqNumberById.get(Number(initialRfqId)) || `RFQ #${initialRfqId}`}
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-6 bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="po-approved-bid" className="block text-xs text-gray-400 mb-1">Approved Bid</label>
            <select
              id="po-approved-bid"
              title="Approved Bid"
              className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={form.approved_bid_id}
              onChange={(e) => {
                const bidId = e.target.value;
                const bid = approvedBidById.get(Number(bidId));
                const currencyFromBid = bid?.currency
                  ? currencies.find(
                      (currency) =>
                        currency.code.toLowerCase() === bid.currency?.toLowerCase(),
                    )
                  : undefined;
                setForm((prev) => ({
                  ...prev,
                  approved_bid_id: bidId,
                  rfq_id: bid ? String(bid.rfq_id) : "",
                  supplier_id:
                    bid && bid.supplier_id
                      ? String(bid.supplier_id)
                      : prev.supplier_id,
                  currency_id: currencyFromBid
                    ? String(currencyFromBid.id)
                    : prev.currency_id,
                }));
              }}
            >
              <option value="">Select approved quotation (optional)</option>
              {approvedBids.map((bid) => {
                const rfqNumber = rfqNumberById.get(bid.rfq_id) || `RFQ #${bid.rfq_id}`;
                const supplierName = bid.supplier?.name || `Supplier #${bid.supplier_id}`;
                const quoteNumber = bid.quotation_number || `QT-${bid.id}`;
                return (
                  <option key={bid.id} value={bid.id}>
                    {quoteNumber} | {rfqNumber} | {supplierName}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor="po-supplier" className="block text-xs text-gray-400 mb-1">Supplier</label>
            <select
              id="po-supplier"
              title="Supplier"
              className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {form.rfq_id && (
              <p className="mt-1 text-xs text-[#7FD5FF]">
                Linked RFQ: {rfqNumberById.get(Number(form.rfq_id)) || `RFQ #${form.rfq_id}`}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="po-budget" className="block text-xs text-gray-400 mb-1">Budget</label>
            <select
              id="po-budget"
              title="Budget"
              className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={form.budget_id}
              onChange={(e) => {
                const budgetId = e.target.value;
                const selectedBudget = (budgets as ProcurementBudget[]).find(
                  (budget) => Number(budget.id) === Number(budgetId),
                );

                setForm((prev) => ({
                  ...prev,
                  budget_id: budgetId,
                  currency_id: selectedBudget?.currency_id
                    ? String(selectedBudget.currency_id)
                    : prev.currency_id,
                }));
              }}
            >
              <option value="">Select budget</option>
              {(budgets as ProcurementBudget[]).map((budget) => (
                <option key={budget.id} value={budget.id}>{budget.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="po-currency" className="block text-xs text-gray-400 mb-1">Currency</label>
            <select
              id="po-currency"
              title="Currency"
              className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={form.currency_id}
              onChange={(e) => setForm((f) => ({ ...f, currency_id: e.target.value }))}
            >
              <option value="">Select currency</option>
              {(currencies as ProcurementCurrency[]).map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Order Name</label>
            <input
              className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="po-order-date" className="block text-xs text-gray-400 mb-1">Order Date</label>
            <input
              id="po-order-date"
              title="Order Date"
              type="date"
              className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={form.order_date}
              onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="po-expected-delivery" className="block text-xs text-gray-400 mb-1">Expected Delivery</label>
            <input
              id="po-expected-delivery"
              title="Expected Delivery"
              type="date"
              className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={form.expected_date_of_delivery}
              onChange={(e) =>
                setForm((f) => ({ ...f, expected_date_of_delivery: e.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <label htmlFor="po-status" className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            id="po-status"
            title="Status"
            className="w-full rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as PurchaseOrderStatus,
              }))
            }
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
          </select>
        </div>
        <div className="border-t border-[#0A4D66]/40 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-white">Items</span>
          </div>
          {rfqItemsSynced && form.rfq_id && items.length > 0 && (
            <p className="mb-2 text-xs text-[#7FD5FF] flex items-center gap-1.5">
              <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
              Preselected from the parts requisition linked to{" "}
              {rfqNumberById.get(Number(form.rfq_id)) || `RFQ #${form.rfq_id}`}. Review
              quantities and prices before submitting.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-2">
            <select
              title="Inventory Item"
              className="sm:col-span-2 rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              value={itemDraft.inventory_id}
              onChange={(e) =>
                setItemDraft((d) => ({
                  ...d,
                  inventory_id: e.target.value,
                }))
              }
            >
              <option value="">Select inventory item</option>
              {inventories.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.part_number} - {inv.description}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              placeholder="Part No (optional)"
              value={itemDraft.part_number}
              onChange={(e) =>
                setItemDraft((d) => ({ ...d, part_number: e.target.value }))
              }
            />
            <input
              type="number"
              min={1}
              className="rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              placeholder="Qty Ordered"
              value={itemDraft.quantity_ordered}
              onChange={(e) =>
                setItemDraft((d) => ({ ...d, quantity_ordered: e.target.value }))
              }
            />
            <input
              type="number"
              min={0}
              className="rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              placeholder="Qty Received"
              value={itemDraft.quantity_received}
              onChange={(e) =>
                setItemDraft((d) => ({ ...d, quantity_received: e.target.value }))
              }
            />
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
              placeholder="Unit Price"
              value={itemDraft.unit_price}
              onChange={(e) =>
                setItemDraft((d) => ({ ...d, unit_price: e.target.value }))
              }
            />
            <button
              type="button"
              title="Add Item"
              aria-label="Add Item"
              className="px-3 py-2 rounded bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-600"
              onClick={handleAddItem}
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
            </button>
          </div>
          <ul className="divide-y divide-[#0A4D66]/40">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2 py-2">
                <span className="flex-1 text-white">
                  Inv #{item.inventory_id} {item.part_number ? `- ${item.part_number}` : ""}
                </span>
                <span className="w-20 text-center text-gray-200">QO: {item.quantity_ordered ?? "-"}</span>
                <span className="w-20 text-center text-gray-200">QR: {item.quantity_received ?? "-"}</span>
                <span className="w-24 text-center text-gray-200">UP: {item.unit_price ?? "-"}</span>
                <button
                  type="button"
                  title="Remove Item"
                  aria-label="Remove Item"
                  className="text-red-400 hover:text-red-600"
                  onClick={() => handleRemoveItem(idx)}
                >
                  <Icon icon="mdi:delete" className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 rounded bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Purchase Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
