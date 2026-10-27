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
  useGetExpenseCategoriesQuery,
} from "../api";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { BackButton } from "@/shared/ui/button";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { NewInventoryItemFields } from "../components/NewInventoryItemFields";
import {
  emptyNewInventoryDraft,
  toNewInventoryPayload,
  type NewInventoryDraft,
  type NewInventoryPayload,
} from "../newInventoryItem";

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
  inventory_id?: number;
  new_inventory?: NewInventoryPayload;
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
  const { data: expenseCategories = [] } = useGetExpenseCategoriesQuery();
  const { data: budgets = [] } = useGetBudgetsQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();
  const { data: rfqs = [] } = useGetRfqsQuery();
  const { data: quotations = [] } = useGetSupplierQuotationsQuery();
  const [createPurchaseOrder, { isLoading }] = useCreatePurchaseOrderMutation();

  // Skip approved quotations whose RFQ no longer exists: picking one would send an
  // rfq_id the API rejects ("The selected rfq id is invalid.").
  const approvedBids = useMemo(() => {
    const rfqIds = new Set(rfqs.map((rfq) => Number(rfq.id)));
    return quotations.filter(
      (quote) =>
        String(quote.status).toLowerCase() === "approved" && rfqIds.has(Number(quote.rfq_id)),
    );
  }, [quotations, rfqs]);

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
  const [itemMode, setItemMode] = useState<"existing" | "new">("existing");
  const [newInventory, setNewInventory] = useState<NewInventoryDraft>(emptyNewInventoryDraft);
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
    setError(null);

    const quantityOrdered = Number(itemDraft.quantity_ordered);
    if (Number.isNaN(quantityOrdered) || quantityOrdered < 1) return;

    let payloadItem: PurchaseOrderItemPayload;

    if (itemMode === "new") {
      const result = toNewInventoryPayload(newInventory);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      payloadItem = {
        new_inventory: result.payload,
        quantity_ordered: quantityOrdered,
        part_number: result.payload.part_number,
      };
      if (result.payload.unit_cost !== null && result.payload.unit_cost !== undefined) {
        payloadItem.unit_price = result.payload.unit_cost;
      }
    } else {
      if (!itemDraft.inventory_id) return;

      const selectedInventory = inventories.find(
        (inv) => Number(inv.id) === Number(itemDraft.inventory_id),
      );

      payloadItem = {
        inventory_id: Number(itemDraft.inventory_id),
        quantity_ordered: quantityOrdered,
      };

      const partNumber = itemDraft.part_number.trim() || selectedInventory?.part_number;
      if (partNumber) payloadItem.part_number = partNumber;
    }

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
    if (itemMode === "new") {
      setNewInventory(emptyNewInventoryDraft());
      setItemMode("existing");
    }
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

    if (form.rfq_id.trim() !== "" && rfqs.length > 0 && !rfqById.has(Number(form.rfq_id))) {
      setError(
        `RFQ #${form.rfq_id} no longer exists. Clear the approved bid, or start again from an existing RFQ.`,
      );
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
      navigate("/dashboard/inventory?tab=procurement&subtab=purchase-orders");
    } catch (err: unknown) {
      const responseError = err as { data?: { message?: string } };
      setError(responseError?.data?.message || "Failed to create purchase order.");
    }
  };

  const { isDark } = useTheme();

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* Modern Page Header */}
      <div className={cn(
        "p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
        isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex items-center gap-3">
          <BackButton
            fallbackUrl={
              initialRfqId
                ? `/dashboard/inventory/rfq/${initialRfqId}`
                : "/dashboard/inventory?tab=procurement&subtab=purchase-orders"
            }
            label={initialRfqId ? "Back to RFQ" : "Back to Purchase Orders"}
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create Purchase Order
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Draft and issue official procurement purchase order to registered suppliers.
            </p>
          </div>
        </div>
        {initialRfqId && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-300">
            <Icon icon="mdi:link-variant" className="w-3.5 h-3.5" />
            Linked to {rfqNumberById.get(Number(initialRfqId)) || `RFQ #${initialRfqId}`}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Vendor & Quotation Selection */}
        <div className={cn(
          "p-6 rounded-2xl border space-y-5 transition-colors",
          isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-[#0A4D66]/40">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Icon icon="mdi:domain" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Supplier & Financial Allocation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Link to approved quotation, supplier vendor profile, and budget allocation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="po-approved-bid" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Approved Quotation (Optional)
              </label>
              <select
                id="po-approved-bid"
                title="Approved Bid"
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
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
              <label htmlFor="po-supplier" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Supplier Vendor <span className="text-red-500">*</span>
              </label>
              <select
                id="po-supplier"
                title="Supplier"
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              >
                <option value="">Select supplier vendor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {form.rfq_id && (
                <p className="mt-1 text-xs text-sky-600 dark:text-sky-400 font-medium">
                  Linked RFQ: {rfqNumberById.get(Number(form.rfq_id)) || `RFQ #${form.rfq_id}`}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="po-budget" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Procurement Budget
              </label>
              <select
                id="po-budget"
                title="Budget"
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
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
                <option value="">Select budget source</option>
                {(budgets as ProcurementBudget[]).map((budget) => (
                  <option key={budget.id} value={budget.id}>{budget.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="po-currency" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Currency
              </label>
              <select
                id="po-currency"
                title="Currency"
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
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
          </div>
        </div>

        {/* Section 2: Order Metadata & Schedule */}
        <div className={cn(
          "p-6 rounded-2xl border space-y-5 transition-colors",
          isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-[#0A4D66]/40">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Icon icon="mdi:calendar-clock" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Order Schedule & Description
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Identify the order and specify fulfillment deadlines.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Purchase Order Title / Description
              </label>
              <input
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Avionics Spares & Rotor Assemblies Procurement"
              />
            </div>

            <div>
              <label htmlFor="po-order-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Order Date
              </label>
              <input
                id="po-order-date"
                title="Order Date"
                type="date"
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
                value={form.order_date}
                onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="po-expected-delivery" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Expected Delivery Date
              </label>
              <input
                id="po-expected-delivery"
                title="Expected Delivery"
                type="date"
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
                value={form.expected_date_of_delivery}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expected_date_of_delivery: e.target.value }))
                }
              />
            </div>

            <div>
              <label htmlFor="po-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Initial Order Status
              </label>
              <select
                id="po-status"
                title="Status"
                className={cn(
                  "w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as PurchaseOrderStatus,
                  }))
                }
              >
                <option value="draft">Draft (Review Stage)</option>
                <option value="sent">Sent to Supplier</option>
                <option value="received">Received into Stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Line Items Builder */}
        <div className={cn(
          "p-6 rounded-2xl border space-y-5 transition-colors",
          isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#0A4D66]/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                <Icon icon="mdi:package-variant" className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Order Line Items ({items.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select catalogue parts or specify custom procurement line items.
                </p>
              </div>
            </div>
          </div>

          {rfqItemsSynced && form.rfq_id && items.length > 0 && (
            <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2 font-medium">
              <Icon icon="mdi:information-outline" className="w-4 h-4 shrink-0 text-sky-500" />
              Preselected from the parts requisition linked to{" "}
              {rfqNumberById.get(Number(form.rfq_id)) || `RFQ #${form.rfq_id}`}. Review
              quantities and prices before submitting.
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setItemMode("existing")}
              className={cn(
                "rounded-xl px-4 py-2 font-semibold transition-all border",
                itemMode === "existing"
                  ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                  : isDark
                    ? "border-[#0A4D66]/60 bg-[#001825] text-slate-300 hover:bg-[#0A4D66]/30"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              Existing Catalogue Item
            </button>
            <button
              type="button"
              onClick={() => setItemMode("new")}
              className={cn(
                "rounded-xl px-4 py-2 font-semibold transition-all border",
                itemMode === "new"
                  ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                  : isDark
                    ? "border-[#0A4D66]/60 bg-[#001825] text-slate-300 hover:bg-[#0A4D66]/30"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              Non-Catalogue Item (Register New)
            </button>
          </div>

          {itemMode === "new" && (
            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5">
              <NewInventoryItemFields
                draft={newInventory}
                onChange={setNewInventory}
                expenseCategories={expenseCategories}
              />
            </div>
          )}

          {/* Draft Item Input Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {itemMode === "existing" && (
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catalogue Part
                </label>
                <SearchableSelect
                  className="w-full"
                  placeholder="Select inventory item"
                  searchPlaceholder="Search by part number or description..."
                  options={inventories.map((inv) => ({
                    value: inv.id,
                    label: `${inv.part_number} - ${inv.description}`,
                  }))}
                  value={itemDraft.inventory_id ? Number(itemDraft.inventory_id) : null}
                  onChange={(value) =>
                    setItemDraft((d) => ({
                      ...d,
                      inventory_id: value === null ? "" : String(value),
                    }))
                  }
                />
              </div>
            )}
            {itemMode === "existing" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Part No. (Opt)
                </label>
                <input
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                    isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                  )}
                  placeholder="Part #"
                  value={itemDraft.part_number}
                  onChange={(e) =>
                    setItemDraft((d) => ({ ...d, part_number: e.target.value }))
                  }
                />
              </div>
            )}
            <div className={itemMode === "existing" ? "sm:col-span-2" : "sm:col-span-4"}>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Qty Ordered
              </label>
              <input
                type="number"
                min={1}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-sm text-right transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
                placeholder="1"
                value={itemDraft.quantity_ordered}
                onChange={(e) =>
                  setItemDraft((d) => ({ ...d, quantity_ordered: e.target.value }))
                }
              />
            </div>
            <div className={itemMode === "existing" ? "sm:col-span-2" : "sm:col-span-4"}>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit Price
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-sm text-right transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                  isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                )}
                placeholder="0.00"
                value={itemDraft.unit_price}
                onChange={(e) =>
                  setItemDraft((d) => ({ ...d, unit_price: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="button"
                title="Add Item"
                aria-label="Add Item"
                className="w-full flex items-center justify-center p-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition-all"
                onClick={handleAddItem}
              >
                <Icon icon="mdi:plus" className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Staged Items List */}
          {items.length > 0 ? (
            <div className={cn(
              "rounded-xl border overflow-hidden",
              isDark ? "border-[#0A4D66]/40" : "border-slate-200"
            )}>
              <ul className={cn("divide-y text-sm", isDark ? "divide-[#0A4D66]/30" : "divide-slate-200")}>
                {items.map((item, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 transition-colors",
                      isDark
                        ? (idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]/60")
                        : (idx % 2 === 0 ? "bg-white" : "bg-slate-50/70")
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {item.inventory_id
                          ? `Part #${item.inventory_id} ${item.part_number ? `• ${item.part_number}` : ""}`
                          : `NEW: ${item.new_inventory?.part_number ?? "Custom"} - ${item.new_inventory?.description ?? ""}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        Qty: {item.quantity_ordered ?? "-"}
                      </span>
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300">
                        Price: {item.unit_price ? Number(item.unit_price).toLocaleString() : "-"}
                      </span>
                      <button
                        type="button"
                        title="Remove Item"
                        aria-label="Remove Item"
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={cn(
              "p-6 rounded-xl border border-dashed text-center text-xs text-slate-500 dark:text-slate-400",
              isDark ? "border-[#0A4D66]/40" : "border-slate-300"
            )}>
              No line items added yet. Choose a catalogue part above and click + to add.
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-500 flex items-center gap-2">
            <Icon icon="mdi:alert-circle" className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-60 transition-all"
            disabled={isLoading}
          >
            <Icon
              icon={isLoading ? "mdi:loading" : "mdi:check-bold"}
              className={cn("w-4 h-4", isLoading && "animate-spin")}
            />
            {isLoading ? "Creating..." : "Create Purchase Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
