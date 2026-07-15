import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useApproveSupplierQuotationMutation,
  useCreateGoodsReceivedNoteMutation,
  useCreatePurchaseOrderMutation,
  useCreateRfqMutation,
  useCreateStockMovementMutation,
  useCreateSupplierQuotationMutation,
  useGetGoodsReceivedNotesQuery,
  useGetInventoriesQuery,
  useGetPurchaseOrdersQuery,
  useGetRfqsQuery,
  useGetStockMovementsQuery,
  useGetSupplierQuotationsQuery,
  useGetSuppliersQuery,
  type PurchaseOrder,
} from "@/features/inventory/api";
import { useGetWorkOrdersQuery } from "@/features/maintenance/api";

const cardClass =
  "rounded-xl border border-[var(--theme-border-em)] bg-[var(--theme-bg-card)] p-4 sm:p-6";

const fieldClass =
  "bg-[var(--theme-bg-input)] border border-[var(--theme-border-em)] rounded px-3 py-2 text-sm text-[var(--theme-text-primary)]";

const textareaClass =
  "mt-3 w-full bg-[var(--theme-bg-input)] border border-[var(--theme-border-em)] rounded px-3 py-2 text-sm text-[var(--theme-text-primary)]";

const sectionTitleClass = "text-lg font-semibold text-[var(--theme-accent)] mb-4";

const ghostButtonClass =
  "rounded border border-[var(--theme-border-em)] px-3 py-2 text-sm text-white hover:bg-[var(--theme-bg-panel)]";

const accentButtonClass =
  "rounded bg-[var(--theme-accent)] text-white text-sm font-semibold px-3 py-2 hover:opacity-90 disabled:opacity-60";

type ToastState = { type: "success" | "error"; message: string } | null;

export const ProcurementLifecyclePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState<ToastState>(null);

  const { data: workOrders = [] } = useGetWorkOrdersQuery();
  const { data: inventories = [] } = useGetInventoriesQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: stockMovements = [], refetch: refetchStockMovements } =
    useGetStockMovementsQuery();
  const { data: rfqs = [], refetch: refetchRfqs } = useGetRfqsQuery();
  const { data: quotations = [], refetch: refetchQuotations } =
    useGetSupplierQuotationsQuery();
  const { data: purchaseOrders = [], refetch: refetchPurchaseOrders } =
    useGetPurchaseOrdersQuery();
  const { data: goodsReceivedNotes = [], refetch: refetchGoodsReceivedNotes } =
    useGetGoodsReceivedNotesQuery();

  const [createStockMovement, { isLoading: isCreatingRequisition }] =
    useCreateStockMovementMutation();
  const [createRfq, { isLoading: isCreatingRfq }] = useCreateRfqMutation();
  const [createSupplierQuotation, { isLoading: isCreatingQuotation }] =
    useCreateSupplierQuotationMutation();
  const [approveSupplierQuotation, { isLoading: isApprovingQuotation }] =
    useApproveSupplierQuotationMutation();
  const [createPurchaseOrder, { isLoading: isCreatingPo }] =
    useCreatePurchaseOrderMutation();
  const [createGoodsReceivedNote, { isLoading: isCreatingGrn }] =
    useCreateGoodsReceivedNoteMutation();

  const [requisitionForm, setRequisitionForm] = useState({
    work_order_id: "",
    inventory_id: "",
    quantity_requested: "1",
    notes: "",
  });

  // Preselect the requisition when arriving from a "Start RFQ" shortcut
  // (e.g. an out-of-stock item on an Inventory Requisition's details page).
  const [rfqForm, setRfqForm] = useState(() => ({
    stock_movement_id:
      new URLSearchParams(location.search).get("stock_movement_id") ?? "",
    supplier_ids: [] as number[],
    notes: "",
  }));

  const [quotationForm, setQuotationForm] = useState({
    rfq_id: "",
    supplier_id: "",
    quotation_number: "",
    total_amount: "",
    valid_until: "",
    notes: "",
  });

  const [poForm, setPoForm] = useState({
    rfq_id: "",
    supplier_id: "",
    inventory_id: "",
    quantity_ordered: "1",
    unit_price: "",
    name: "",
    order_date: "",
    expected_date_of_delivery: "",
  });

  const [grnForm, setGrnForm] = useState({
    purchase_order_id: "",
    notes: "",
    items: [] as Array<{ purchase_order_item_id?: number; inventory_id: number; quantity_received: number }>,
  });

  const requisitions = useMemo(
    () => stockMovements.filter((m) => m.movement_type === "issue"),
    [stockMovements],
  );

  const approvedQuotationByRfq = useMemo(() => {
    const map = new Map<number, (typeof quotations)[number]>();
    quotations.forEach((quotation) => {
      if (quotation.status === "approved") {
        map.set(quotation.rfq_id, quotation);
      }
    });
    return map;
  }, [quotations]);

  const lifecycleRows = useMemo(() => {
    return [...requisitions]
      .sort((a, b) => b.id - a.id)
      .map((req) => {
        const rfq = rfqs.find((item) => Number(item.stock_movement_id) === Number(req.id));
        const approvedQuotation = rfq
          ? approvedQuotationByRfq.get(Number(rfq.id))
          : undefined;
        const po = rfq
          ? purchaseOrders.find((item) => Number(item.rfq_id) === Number(rfq.id))
          : undefined;
        const grn = po
          ? goodsReceivedNotes.find((item) => Number(item.purchase_order_id) === Number(po.id))
          : undefined;

        return {
          req,
          rfq,
          approvedQuotation,
          po,
          grn,
        };
      });
  }, [approvedQuotationByRfq, goodsReceivedNotes, purchaseOrders, requisitions, rfqs]);

  const selectedPo: PurchaseOrder | undefined = purchaseOrders.find(
    (po) => Number(po.id) === Number(grnForm.purchase_order_id),
  );

  const setError = (message: string) => setToast({ type: "error", message });
  const setSuccess = (message: string) => setToast({ type: "success", message });

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    if (!location.hash) return;
    const sectionId = location.hash.replace("#", "");
    const timer = window.setTimeout(() => {
      scrollToSection(sectionId);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const handleOpenRfq = (rfqId?: number) => {
    if (!rfqId) {
      setError("No RFQ linked to this requisition yet.");
      return;
    }

    setQuotationForm((prev) => ({
      ...prev,
      rfq_id: String(rfqId),
    }));
    scrollToSection("rfq-section");
  };

  const handleOpenPo = (purchaseOrderId?: number) => {
    if (!purchaseOrderId) {
      setError("No purchase order linked yet.");
      return;
    }

    navigate(`/dashboard/inventory/purchase-orders/${purchaseOrderId}`);
  };

  const handleOpenGrn = (purchaseOrderId?: number) => {
    if (!purchaseOrderId) {
      setError("No purchase order available to post GRN.");
      return;
    }

    setGrnForm((prev) => ({
      ...prev,
      purchase_order_id: String(purchaseOrderId),
      items: [],
    }));
    scrollToSection("grn-section");
  };

  const handleCreateRequisition = async () => {
    const workOrderId = Number(requisitionForm.work_order_id);
    const inventoryId = Number(requisitionForm.inventory_id);
    const quantityRequested = Number(requisitionForm.quantity_requested);

    if (!workOrderId || !inventoryId || !Number.isInteger(quantityRequested) || quantityRequested < 1) {
      setError("Provide work order, inventory item, and a valid quantity.");
      return;
    }

    try {
      await createStockMovement({
        movement_type: "issue",
        quantity: quantityRequested,
        work_order_id: workOrderId,
        notes: requisitionForm.notes || null,
        stocks: [
          {
            inventory_id: inventoryId,
            quantity_requested: quantityRequested,
            quantity_approved: 0,
          },
        ],
      }).unwrap();

      setRequisitionForm({ work_order_id: "", inventory_id: "", quantity_requested: "1", notes: "" });
      setSuccess("Parts requisition created from engineering work order.");
      refetchStockMovements();
    } catch {
      setError("Failed to create requisition.");
    }
  };

  const handleCreateRfq = async () => {
    const stockMovementId = Number(rfqForm.stock_movement_id);
    if (!stockMovementId || rfqForm.supplier_ids.length === 0) {
      setError("Select a requisition and at least one supplier for RFQ.");
      return;
    }

    try {
      await createRfq({
        stock_movement_id: stockMovementId,
        supplier_ids: rfqForm.supplier_ids,
        status: "sent",
        issued_at: new Date().toISOString(),
        notes: rfqForm.notes || null,
      }).unwrap();

      setRfqForm({ stock_movement_id: "", supplier_ids: [], notes: "" });
      setSuccess("RFQ generated and sent to selected suppliers.");
      refetchRfqs();
    } catch {
      setError("Failed to generate RFQ.");
    }
  };

  const handleCreateQuotation = async () => {
    const rfqId = Number(quotationForm.rfq_id);
    const supplierId = Number(quotationForm.supplier_id);

    if (!rfqId || !supplierId) {
      setError("Select RFQ and supplier for quotation.");
      return;
    }

    try {
      await createSupplierQuotation({
        rfq_id: rfqId,
        supplier_id: supplierId,
        quotation_number: quotationForm.quotation_number || null,
        total_amount: quotationForm.total_amount ? Number(quotationForm.total_amount) : null,
        valid_until: quotationForm.valid_until || null,
        notes: quotationForm.notes || null,
        status: "submitted",
        quoted_at: new Date().toISOString(),
      }).unwrap();

      setQuotationForm({
        rfq_id: "",
        supplier_id: "",
        quotation_number: "",
        total_amount: "",
        valid_until: "",
        notes: "",
      });
      setSuccess("Supplier quotation received.");
      refetchQuotations();
    } catch {
      setError("Failed to save quotation.");
    }
  };

  const handleApproveQuotation = async (quotationId: number) => {
    try {
      await approveSupplierQuotation(quotationId).unwrap();
      setSuccess("Quotation approved. Other quotations on RFQ marked rejected.");
      refetchQuotations();
      refetchRfqs();
    } catch {
      setError("Failed to approve quotation.");
    }
  };

  const handleCreatePo = async () => {
    const rfqId = Number(poForm.rfq_id);
    const supplierId = Number(poForm.supplier_id);
    const inventoryId = Number(poForm.inventory_id);
    const quantityOrdered = Number(poForm.quantity_ordered);
    const unitPrice = poForm.unit_price ? Number(poForm.unit_price) : undefined;

    if (!rfqId || !supplierId || !inventoryId || !Number.isInteger(quantityOrdered) || quantityOrdered < 1) {
      setError("Provide RFQ, supplier, inventory, and valid quantity for PO.");
      return;
    }

    try {
      await createPurchaseOrder({
        rfq_id: rfqId,
        supplier_id: supplierId,
        name: poForm.name || null,
        order_date: poForm.order_date || null,
        expected_date_of_delivery: poForm.expected_date_of_delivery || null,
        status: "sent",
        items: [
          {
            inventory_id: inventoryId,
            quantity_ordered: quantityOrdered,
            quantity_received: 0,
            unit_price: unitPrice,
          },
        ],
      }).unwrap();

      setPoForm({
        rfq_id: "",
        supplier_id: "",
        inventory_id: "",
        quantity_ordered: "1",
        unit_price: "",
        name: "",
        order_date: "",
        expected_date_of_delivery: "",
      });
      setSuccess("Purchase order created from approved RFQ.");
      refetchPurchaseOrders();
    } catch {
      setError("Failed to create purchase order.");
    }
  };

  const handlePrepareGrnItems = () => {
    if (!selectedPo?.items?.length) {
      setError("Selected PO has no line items.");
      return;
    }

    setGrnForm((prev) => ({
      ...prev,
      items: selectedPo.items
        ?.filter((item) => !!item.inventory_id)
        .map((item) => ({
          purchase_order_item_id: item.id,
          inventory_id: Number(item.inventory_id),
          quantity_received: Number(item.quantity_ordered ?? 0),
        })) ?? [],
    }));
  };

  const handleCreateGrn = async () => {
    const purchaseOrderId = Number(grnForm.purchase_order_id);
    if (!purchaseOrderId || grnForm.items.length === 0) {
      setError("Select a PO and prepare at least one GRN line.");
      return;
    }

    try {
      await createGoodsReceivedNote({
        purchase_order_id: purchaseOrderId,
        received_at: new Date().toISOString(),
        notes: grnForm.notes || null,
        items: grnForm.items,
      }).unwrap();

      setGrnForm({ purchase_order_id: "", notes: "", items: [] });
      setSuccess("GRN posted. Inventory stocks updated with daily batches.");
      refetchPurchaseOrders();
      refetchGoodsReceivedNotes();
    } catch {
      setError("Failed to post GRN.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--theme-text-primary)]">Procurement Inventory Life Cycle</h1>
        <p className="text-sm mt-1 text-[var(--theme-text-muted)]">
          Requisition from engineering work orders, RFQ/quotation approval, PO creation, GRN, and batched stock updates.
        </p>
      </div>

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.type === "success"
              ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-200"
              : "border-red-500/40 bg-red-900/20 text-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section id="requisition-section" className={cardClass}>
        <h2 className={sectionTitleClass}>1. Parts Requisition (Stock Movements from Work Orders)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className={fieldClass}
            value={requisitionForm.work_order_id}
            onChange={(e) => setRequisitionForm((s) => ({ ...s, work_order_id: e.target.value }))}
            title="Work Order"
          >
            <option value="">Select work order</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                #{wo.id} - {wo.title || "Work Order"}
              </option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={requisitionForm.inventory_id}
            onChange={(e) => setRequisitionForm((s) => ({ ...s, inventory_id: e.target.value }))}
            title="Inventory"
          >
            <option value="">Select inventory item</option>
            {inventories.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.part_number} - {inv.description}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={requisitionForm.quantity_requested}
            onChange={(e) => setRequisitionForm((s) => ({ ...s, quantity_requested: e.target.value }))}
            placeholder="Requested quantity"
          />
          <button
            className={accentButtonClass}
            onClick={handleCreateRequisition}
            disabled={isCreatingRequisition}
            type="button"
          >
            {isCreatingRequisition ? "Creating..." : "Create Requisition"}
          </button>
        </div>
        <textarea
          className={textareaClass}
          value={requisitionForm.notes}
          onChange={(e) => setRequisitionForm((s) => ({ ...s, notes: e.target.value }))}
          placeholder="Requisition notes"
          rows={2}
        />
        <p className="text-xs mt-3 text-[var(--theme-text-muted)]">Existing requisitions: {requisitions.length}</p>
      </section>

      <section id="rfq-section" className={cardClass}>
        <h2 className={sectionTitleClass}>2. RFQ to Multiple Suppliers and Quotation Approval</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            className={fieldClass}
            value={rfqForm.stock_movement_id}
            onChange={(e) => setRfqForm((s) => ({ ...s, stock_movement_id: e.target.value }))}
            title="Requisition"
          >
            <option value="">Select requisition</option>
            {requisitions.map((req) => (
              <option key={req.id} value={req.id}>
                REQ #{req.id} - WO #{req.work_order_id || "-"}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 rounded border border-[var(--theme-border-em)] bg-[var(--theme-bg-input)] p-2">
            {suppliers.map((supplier) => {
              const selected = rfqForm.supplier_ids.includes(supplier.id);
              return (
                <button
                  type="button"
                  key={supplier.id}
                  className={`rounded px-2 py-1 text-xs ${
                    selected
                      ? "bg-[var(--theme-accent)] text-white"
                      : "bg-[var(--theme-bg-panel)] text-white"
                  }`}
                  onClick={() =>
                    setRfqForm((state) => ({
                      ...state,
                      supplier_ids: selected
                        ? state.supplier_ids.filter((id) => id !== supplier.id)
                        : [...state.supplier_ids, supplier.id],
                    }))
                  }
                >
                  {supplier.name}
                </button>
              );
            })}
          </div>
        </div>
        <textarea
          className={textareaClass}
          value={rfqForm.notes}
          onChange={(e) => setRfqForm((s) => ({ ...s, notes: e.target.value }))}
          placeholder="RFQ notes"
          rows={2}
        />
        <button
          type="button"
          className={`mt-3 ${accentButtonClass}`}
          onClick={handleCreateRfq}
          disabled={isCreatingRfq}
        >
          {isCreatingRfq ? "Generating RFQ..." : "Generate RFQ"}
        </button>

        <div className="mt-5 border-t border-[var(--theme-divider)] pt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            className={`md:col-span-2 ${fieldClass}`}
            value={quotationForm.rfq_id}
            onChange={(e) => setQuotationForm((s) => ({ ...s, rfq_id: e.target.value }))}
            title="RFQ"
          >
            <option value="">RFQ</option>
            {rfqs.map((rfq) => (
              <option key={rfq.id} value={rfq.id}>{rfq.rfq_number}</option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={quotationForm.supplier_id}
            onChange={(e) => setQuotationForm((s) => ({ ...s, supplier_id: e.target.value }))}
            title="Supplier"
          >
            <option value="">Supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <input
            className={fieldClass}
            value={quotationForm.quotation_number}
            onChange={(e) => setQuotationForm((s) => ({ ...s, quotation_number: e.target.value }))}
            placeholder="Quotation #"
          />
          <input
            type="number"
            min={0}
            className={fieldClass}
            value={quotationForm.total_amount}
            onChange={(e) => setQuotationForm((s) => ({ ...s, total_amount: e.target.value }))}
            placeholder="Total amount"
          />
          <button
            type="button"
            className={accentButtonClass}
            onClick={handleCreateQuotation}
            disabled={isCreatingQuotation}
          >
            {isCreatingQuotation ? "Saving..." : "Receive Quotation"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {quotations.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded border border-[var(--theme-divider)] px-3 py-2">
              <div className="text-sm text-[var(--theme-text-secondary)]">
                RFQ #{q.rfq_id} | {q.supplier?.name || `Supplier #${q.supplier_id}`} | {q.total_amount || "-"} {q.currency || "NGN"}
                <span className="ml-2 text-xs text-[var(--theme-text-muted)] uppercase">{q.status}</span>
              </div>
              <button
                type="button"
                className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-white hover:bg-emerald-500/10 disabled:opacity-50"
                disabled={isApprovingQuotation || q.status === "approved"}
                onClick={() => handleApproveQuotation(q.id)}
              >
                Approve
              </button>
            </div>
          ))}
        </div>
      </section>

      <section id="po-section" className={cardClass}>
        <h2 className={sectionTitleClass}>3. Create Purchase Order from Approved RFQ</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className={fieldClass}
            value={poForm.rfq_id}
            onChange={(e) => {
              const rfqId = Number(e.target.value);
              const approved = approvedQuotationByRfq.get(rfqId);
              setPoForm((s) => ({
                ...s,
                rfq_id: e.target.value,
                supplier_id: approved?.supplier_id ? String(approved.supplier_id) : s.supplier_id,
              }));
            }}
            title="Approved RFQ"
          >
            <option value="">Approved RFQ</option>
            {rfqs
              .filter((rfq) => approvedQuotationByRfq.has(rfq.id))
              .map((rfq) => (
                <option key={rfq.id} value={rfq.id}>{rfq.rfq_number}</option>
              ))}
          </select>
          <select
            className={fieldClass}
            value={poForm.supplier_id}
            onChange={(e) => setPoForm((s) => ({ ...s, supplier_id: e.target.value }))}
            title="Supplier"
          >
            <option value="">Supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={poForm.inventory_id}
            onChange={(e) => setPoForm((s) => ({ ...s, inventory_id: e.target.value }))}
            title="Inventory"
          >
            <option value="">Inventory item</option>
            {inventories.map((inv) => (
              <option key={inv.id} value={inv.id}>{inv.part_number} - {inv.description}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={poForm.quantity_ordered}
            onChange={(e) => setPoForm((s) => ({ ...s, quantity_ordered: e.target.value }))}
            placeholder="Qty ordered"
          />
          <input
            className={fieldClass}
            value={poForm.name}
            onChange={(e) => setPoForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="PO Name"
          />
          <input
            type="date"
            className={fieldClass}
            value={poForm.order_date}
            onChange={(e) => setPoForm((s) => ({ ...s, order_date: e.target.value }))}
            title="Order date"
            aria-label="Order date"
          />
          <input
            type="date"
            className={fieldClass}
            value={poForm.expected_date_of_delivery}
            onChange={(e) => setPoForm((s) => ({ ...s, expected_date_of_delivery: e.target.value }))}
            title="Expected delivery date"
            aria-label="Expected delivery date"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            className={fieldClass}
            value={poForm.unit_price}
            onChange={(e) => setPoForm((s) => ({ ...s, unit_price: e.target.value }))}
            placeholder="Unit price"
          />
        </div>
        <button
          type="button"
          className={`mt-3 ${accentButtonClass}`}
          onClick={handleCreatePo}
          disabled={isCreatingPo}
        >
          {isCreatingPo ? "Creating PO..." : "Create Purchase Order"}
        </button>
      </section>

      <section id="grn-section" className={cardClass}>
        <h2 className={sectionTitleClass}>4. Goods Received Note and Inventory Batch Posting</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            className={fieldClass}
            value={grnForm.purchase_order_id}
            onChange={(e) => setGrnForm((s) => ({ ...s, purchase_order_id: e.target.value, items: [] }))}
            title="Purchase Order"
          >
            <option value="">Select purchase order</option>
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>
                PO #{po.id} - {po.name || "Untitled"}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={ghostButtonClass}
            onClick={handlePrepareGrnItems}
          >
            Prepare GRN Lines from PO
          </button>
          <button
            type="button"
            className={accentButtonClass}
            onClick={handleCreateGrn}
            disabled={isCreatingGrn}
          >
            {isCreatingGrn ? "Posting GRN..." : "Post GRN and Update Stock"}
          </button>
        </div>

        <textarea
          className={textareaClass}
          value={grnForm.notes}
          onChange={(e) => setGrnForm((s) => ({ ...s, notes: e.target.value }))}
          placeholder="GRN notes / acknowledgement"
          rows={2}
        />

        {grnForm.items.length > 0 && (
          <div className="mt-3 rounded border border-[var(--theme-divider)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--theme-bg-panel)] text-[var(--theme-text-muted)]">
                <tr>
                  <th className="text-left px-3 py-2">Inventory</th>
                  <th className="text-right px-3 py-2">Qty Received</th>
                </tr>
              </thead>
              <tbody>
                {grnForm.items.map((item, idx) => (
                  <tr key={`${item.inventory_id}-${idx}`} className="border-t border-[var(--theme-divider)] text-[var(--theme-text-secondary)]">
                    <td className="px-3 py-2">#{item.inventory_id}</td>
                    <td className="px-3 py-2 text-right">{item.quantity_received}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="snapshot-section" className={cardClass}>
        <h2 className={sectionTitleClass}>Lifecycle Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          <div className="rounded bg-[var(--theme-bg-panel)] p-3">
            <p className="text-xs text-[var(--theme-text-muted)]">Requisitions</p>
            <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{requisitions.length}</p>
          </div>
          <div className="rounded bg-[var(--theme-bg-panel)] p-3">
            <p className="text-xs text-[var(--theme-text-muted)]">RFQs</p>
            <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{rfqs.length}</p>
          </div>
          <div className="rounded bg-[var(--theme-bg-panel)] p-3">
            <p className="text-xs text-[var(--theme-text-muted)]">Quotations</p>
            <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{quotations.length}</p>
          </div>
          <div className="rounded bg-[var(--theme-bg-panel)] p-3">
            <p className="text-xs text-[var(--theme-text-muted)]">Purchase Orders</p>
            <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{purchaseOrders.length}</p>
          </div>
          <div className="rounded bg-[var(--theme-bg-panel)] p-3">
            <p className="text-xs text-[var(--theme-text-muted)]">Approved Quotes</p>
            <p className="text-2xl font-bold text-emerald-300">{Array.from(approvedQuotationByRfq.keys()).length}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded border border-[var(--theme-divider)]">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-[var(--theme-bg-panel)] text-[var(--theme-text-muted)] uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Requisition</th>
                <th className="px-3 py-2 text-left">RFQ</th>
                <th className="px-3 py-2 text-left">Approved Quotation</th>
                <th className="px-3 py-2 text-left">Purchase Order</th>
                <th className="px-3 py-2 text-left">GRN</th>
                <th className="px-3 py-2 text-left">Current Stage</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-divider)]">
              {lifecycleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--theme-text-muted)]">
                    No lifecycle records yet.
                  </td>
                </tr>
              ) : (
                lifecycleRows.map((row) => {
                  const stage = row.grn
                    ? "Completed (GRN Posted)"
                    : row.po
                      ? "Purchase Order Created"
                      : row.approvedQuotation
                        ? "Quotation Approved"
                        : row.rfq
                          ? "RFQ Issued"
                          : "Requisition Created";

                  return (
                    <tr key={row.req.id} className="text-[var(--theme-text-secondary)]">
                      <td className="px-3 py-2">
                        REQ #{row.req.id}
                        <div className="text-xs text-[var(--theme-text-muted)]">WO #{row.req.work_order_id || "-"}</div>
                      </td>
                      <td className="px-3 py-2">{row.rfq ? row.rfq.rfq_number : "-"}</td>
                      <td className="px-3 py-2">
                        {row.approvedQuotation
                          ? `${row.approvedQuotation.quotation_number || `QT-${row.approvedQuotation.id}`} (${row.approvedQuotation.supplier?.name || `Supplier #${row.approvedQuotation.supplier_id}`})`
                          : "-"}
                      </td>
                      <td className="px-3 py-2">{row.po ? `PO #${row.po.id}` : "-"}</td>
                      <td className="px-3 py-2">{row.grn ? row.grn.grn_number : "-"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)] px-2 py-1 text-xs text-[var(--theme-accent)]">
                          {stage}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-[var(--theme-border-em)] px-2 py-1 text-xs text-black hover:bg-[var(--theme-bg-panel)]"
                            onClick={() => handleOpenRfq(row.rfq?.id)}
                          >
                            <Icon icon="mdi:file-document-edit-outline" className="h-3.5 w-3.5" />
                            Open RFQ
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-xs text-black hover:bg-emerald-500/10"
                            onClick={() => handleOpenPo(row.po?.id)}
                          >
                            <Icon icon="mdi:cart-outline" className="h-3.5 w-3.5" />
                            Open PO
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-xs text-black hover:bg-amber-500/10"
                            onClick={() => handleOpenGrn(row.po?.id)}
                          >
                            <Icon icon="mdi:package-check" className="h-3.5 w-3.5" />
                            Open GRN
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
      </section>
    </div>
  );
};
