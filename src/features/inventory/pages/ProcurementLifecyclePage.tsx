import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useApproveSupplierQuotationMutation,
  useCreateGoodsReceivedNoteMutation,
  useCreateInventoryMutation,
  useCreatePurchaseOrderMutation,
  useCreateRfqMutation,
  useCreateStockMovementMutation,
  useCreateSupplierQuotationMutation,
  useGetGoodsReceivedNotesQuery,
  useGetExpenseCategoriesQuery,
  useGetInventoriesQuery,
  useGetPurchaseOrdersQuery,
  useGetRfqsQuery,
  useGetStockMovementsQuery,
  useGetSupplierQuotationsQuery,
  useGetSuppliersQuery,
  useIssueStockMovementMutation,
  type PurchaseOrder,
  type Rfq,
  type StockMovement,
} from "@/features/inventory/api";
import { NewInventoryItemFields } from "@/features/inventory/components/NewInventoryItemFields";
import {
  emptyNewInventoryDraft,
  toCreateInventoryPayload,
  toNewInventoryPayload,
  type NewInventoryDraft,
  type NewInventoryPayload,
} from "@/features/inventory/newInventoryItem";
import {
  describeRequisitionItems,
  inventoryLabel,
  issueStatus,
  lineIssued,
  lineOutstanding,
  requisitionOrigin,
  requisitionUnit,
  toInventoryOptions,
} from "@/features/inventory/inventoryOptions";
import { useGetWorkOrdersQuery } from "@/features/maintenance/api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import { MultiSelect } from "@/shared/ui/multi-select/MultiSelect";
import { cn } from "@/shared/utils/cn";

const cardClass =
  "rounded-xl border border-[var(--theme-border-em)] bg-[var(--theme-bg-card)] p-4 sm:p-6";

const fieldClass =
  "w-full bg-[var(--theme-bg-input)] border border-[var(--theme-border-em)] rounded px-3 py-2 text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)]";

const textareaClass = `mt-3 ${fieldClass}`;

const labelClass = "block text-xs mb-1 text-[var(--theme-text-muted)]";

const sectionTitleClass = "text-lg font-semibold text-[var(--theme-accent)]";

const sectionHintClass = "text-sm mt-1 mb-5 text-[var(--theme-text-muted)]";

const ghostButtonClass =
  "rounded border border-[var(--theme-border-em)] px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-panel)] disabled:opacity-50";

// --theme-accent-dark is a deep blue in both themes, so white text stays readable.
const accentButtonClass =
  "rounded bg-[var(--theme-accent-dark)] text-white text-sm font-semibold px-3 py-2 hover:opacity-90 disabled:opacity-60";

const tableHeadClass = "bg-[var(--theme-bg-panel)] text-[var(--theme-text-muted)] uppercase text-xs";

const STAGES = [
  { hash: "requisition-section", label: "Parts Requisition", icon: "mdi:clipboard-list-outline" },
  { hash: "rfq-section", label: "RFQ", icon: "mdi:email-fast-outline" },
  { hash: "quotation-section", label: "Quotations", icon: "mdi:file-document-check-outline" },
  { hash: "po-section", label: "Purchase Order", icon: "mdi:cart-outline" },
  { hash: "grn-section", label: "Stock Received", icon: "mdi:package-check" },
  { hash: "issue-section", label: "Stock Issue", icon: "mdi:truck-delivery-outline" },
  { hash: "snapshot-section", label: "Summary", icon: "mdi:chart-timeline-variant" },
] as const;

type StageHash = (typeof STAGES)[number]["hash"];

type ToastState = { type: "success" | "error"; message: string } | null;

const toId = (value: string | number | null) => (value === null ? "" : String(value));

const emptyPoForm = () => ({
  rfq_id: "",
  supplier_id: "",
  inventory_id: "",
  quantity_ordered: "1",
  unit_price: "",
  name: "",
  order_date: "",
  expected_date_of_delivery: "",
});

const emptyRequisitionForm = () => ({
  work_order_id: "",
  requesting_unit_id: "",
  inventory_id: "",
  quantity_requested: "1",
  notes: "",
});

const emptyQuotationForm = () => ({
  rfq_id: "",
  supplier_id: "",
  quotation_number: "",
  total_amount: "",
  valid_until: "",
  notes: "",
});

export const ProcurementLifecyclePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState<ToastState>(null);

  const stageIndex = Math.max(
    0,
    STAGES.findIndex((stage) => `#${stage.hash}` === location.hash),
  );
  const stage = STAGES[stageIndex];

  const { data: workOrders = [] } = useGetWorkOrdersQuery();
  const { data: inventories = [], refetch: refetchInventories } = useGetInventoriesQuery();
  const { data: units = [] } = useGetUnitsQuery();
  const { data: expenseCategories = [] } = useGetExpenseCategoriesQuery();
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
  const [createInventory, { isLoading: isCreatingInventory }] = useCreateInventoryMutation();
  const [issueStockMovement, { isLoading: isIssuing }] = useIssueStockMovementMutation();

  const [requisitionForm, setRequisitionForm] = useState(emptyRequisitionForm);
  const [reqItemMode, setReqItemMode] = useState<"existing" | "new">("existing");
  const [reqNewInventory, setReqNewInventory] =
    useState<NewInventoryDraft>(emptyNewInventoryDraft);

  // Preselect the requisition when arriving from a "Start RFQ" shortcut
  // (e.g. an out-of-stock item on an Inventory Requisition's details page).
  const [rfqForm, setRfqForm] = useState(() => ({
    stock_movement_id:
      new URLSearchParams(location.search).get("stock_movement_id") ?? "",
    supplier_ids: [] as number[],
    notes: "",
  }));

  const [quotationForm, setQuotationForm] = useState(emptyQuotationForm);

  const [poForm, setPoForm] = useState(emptyPoForm);
  const [poItemMode, setPoItemMode] = useState<"existing" | "new">("existing");
  const [poNewInventory, setPoNewInventory] = useState<NewInventoryDraft>(emptyNewInventoryDraft);

  const [grnForm, setGrnForm] = useState({
    purchase_order_id: "",
    notes: "",
    items: [] as Array<{ purchase_order_item_id?: number; inventory_id: number; quantity_received: number }>,
  });

  // Quantities to issue now, keyed by the requisition line's index.
  const [issueForm, setIssueForm] = useState({
    stock_movement_id: "",
    quantities: {} as Record<number, string>,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stageIndex]);

  const goToStage = (hash: StageHash) => {
    setToast(null);
    navigate({ search: location.search, hash }, { replace: true });
  };

  const requisitions = useMemo(
    () => stockMovements.filter((m) => m.movement_type === "issue").sort((a, b) => b.id - a.id),
    [stockMovements],
  );

  const requisitionById = useMemo(
    () => new Map(requisitions.map((req) => [Number(req.id), req])),
    [requisitions],
  );

  const inventoryById = useMemo(
    () => new Map(inventories.map((item) => [Number(item.id), item])),
    [inventories],
  );

  const rfqRequisitionIds = useMemo(
    () => new Set(rfqs.map((rfq) => Number(rfq.stock_movement_id))),
    [rfqs],
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

  // The RFQ payload embeds its requisition, but fall back to the requisitions
  // list in case an older response doesn't include it.
  const rfqRequisition = (rfq: Rfq): StockMovement | undefined =>
    rfq.stock_movement ?? requisitionById.get(Number(rfq.stock_movement_id));

  const rfqById = useMemo(() => new Map(rfqs.map((rfq) => [Number(rfq.id), rfq])), [rfqs]);

  const lifecycleRows = useMemo(() => {
    return requisitions.map((req) => {
      const rfq = rfqs.find((item) => Number(item.stock_movement_id) === Number(req.id));
      const approvedQuotation = rfq ? approvedQuotationByRfq.get(Number(rfq.id)) : undefined;
      const po = rfq
        ? purchaseOrders.find((item) => Number(item.rfq_id) === Number(rfq.id))
        : undefined;
      const grn = po
        ? goodsReceivedNotes.find((item) => Number(item.purchase_order_id) === Number(po.id))
        : undefined;

      return { req, rfq, approvedQuotation, po, grn };
    });
  }, [approvedQuotationByRfq, goodsReceivedNotes, purchaseOrders, requisitions, rfqs]);

  // --- Dropdown options -----------------------------------------------------

  const inventoryOptions = useMemo(() => toInventoryOptions(inventories), [inventories]);

  const workOrderOptions: SearchableSelectOption[] = useMemo(
    () =>
      workOrders.map((wo) => ({
        value: wo.id,
        label: `WO #${wo.id} - ${wo.title || "Work Order"}`,
        description: wo.asset?.name ?? undefined,
      })),
    [workOrders],
  );

  const unitOptions: SearchableSelectOption[] = useMemo(
    () => units.map((unit) => ({ value: unit.id, label: unit.name })),
    [units],
  );

  const supplierOptions: SearchableSelectOption[] = useMemo(
    () =>
      suppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
        description: supplier.email || supplier.contact || undefined,
      })),
    [suppliers],
  );

  const requisitionOptions: SearchableSelectOption[] = useMemo(
    () =>
      requisitions.map((req) => ({
        value: req.id,
        label: `REQ #${req.id} - ${describeRequisitionItems(req)}`,
        description: `${requisitionOrigin(req)}${rfqRequisitionIds.has(Number(req.id)) ? " · RFQ already issued" : ""}`,
      })),
    [requisitions, rfqRequisitionIds],
  );

  // Requisitions that still have stock waiting to be issued out to their unit.
  const issueRequisitionOptions: SearchableSelectOption[] = useMemo(
    () =>
      requisitions
        .filter((req) => issueStatus(req) !== "full")
        .map((req) => ({
          value: req.id,
          label: `REQ #${req.id} - ${describeRequisitionItems(req)}`,
          description: [
            `To ${requisitionUnit(req)}`,
            requisitionOrigin(req),
            issueStatus(req) === "partial" ? "Partially issued" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    [requisitions],
  );

  const issueRequisition = issueForm.stock_movement_id
    ? requisitionById.get(Number(issueForm.stock_movement_id))
    : undefined;

  const toRfqOption = (rfq: Rfq): SearchableSelectOption => {
    const req = rfqRequisition(rfq);
    return {
      value: rfq.id,
      label: `${rfq.rfq_number || `RFQ #${rfq.id}`} - ${describeRequisitionItems(req)}`,
      description: [
        `REQ #${rfq.stock_movement_id}`,
        req ? requisitionOrigin(req) : null,
        approvedQuotationByRfq.has(Number(rfq.id)) ? "Quotation approved" : rfq.status,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  };

  const rfqOptions = rfqs.map(toRfqOption);
  const approvedRfqOptions = rfqs
    .filter((rfq) => approvedQuotationByRfq.has(Number(rfq.id)))
    .map(toRfqOption);

  // Restrict quotation suppliers to the ones the selected RFQ was sent to.
  const quotationRfq = rfqById.get(Number(quotationForm.rfq_id));
  const quotationSupplierOptions = quotationRfq?.suppliers?.length
    ? supplierOptions.filter((option) =>
        quotationRfq.suppliers?.some((supplier) => supplier.id === option.value),
      )
    : supplierOptions;

  const purchaseOrderOptions: SearchableSelectOption[] = useMemo(
    () =>
      [...purchaseOrders]
        .sort((a, b) => b.id - a.id)
        .map((po) => ({
          value: po.id,
          label: `PO #${po.id} - ${po.name || "Untitled"}`,
          description: [
            po.supplier?.name,
            po.items
              ?.map((item) => {
                const inv = item.inventory_id ? inventoryById.get(Number(item.inventory_id)) : undefined;
                return inv ? inventoryLabel(inv) : null;
              })
              .filter(Boolean)
              .join(", "),
            po.status,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    [inventoryById, purchaseOrders],
  );

  const visibleQuotations = quotationForm.rfq_id
    ? quotations.filter((q) => Number(q.rfq_id) === Number(quotationForm.rfq_id))
    : quotations;

  const selectedPo: PurchaseOrder | undefined = purchaseOrders.find(
    (po) => Number(po.id) === Number(grnForm.purchase_order_id),
  );

  const setError = (message: string) => setToast({ type: "error", message });
  const setSuccess = (message: string) => setToast({ type: "success", message });

  // --- Handlers -------------------------------------------------------------

  const handleOpenRfq = (rfqId?: number) => {
    if (!rfqId) {
      setError("No RFQ linked to this requisition yet.");
      return;
    }

    setQuotationForm((prev) => ({ ...prev, rfq_id: String(rfqId), supplier_id: "" }));
    goToStage("quotation-section");
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
      setError("No purchase order available to receive stock against.");
      return;
    }

    setGrnForm((prev) => ({ ...prev, purchase_order_id: String(purchaseOrderId), items: [] }));
    goToStage("grn-section");
  };

  const handleOpenIssue = (requisitionId: number) => {
    setIssueForm({ stock_movement_id: String(requisitionId), quantities: {} });
    goToStage("issue-section");
  };

  const handleCreateRequisition = async () => {
    const workOrderId = requisitionForm.work_order_id ? Number(requisitionForm.work_order_id) : null;
    const unitId = requisitionForm.requesting_unit_id
      ? Number(requisitionForm.requesting_unit_id)
      : null;
    let inventoryId = Number(requisitionForm.inventory_id);
    const quantityRequested = Number(requisitionForm.quantity_requested);

    if (!Number.isInteger(quantityRequested) || quantityRequested < 1) {
      setError("Provide a valid quantity.");
      return;
    }

    let newItem: NewInventoryPayload | null = null;
    if (reqItemMode === "new") {
      const result = toNewInventoryPayload(reqNewInventory);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      newItem = result.payload;
    } else if (!inventoryId) {
      setError("Select an inventory item, or add a new one.");
      return;
    }

    if (newItem) {
      try {
        inventoryId = (await createInventory(toCreateInventoryPayload(newItem)).unwrap()).id;
        refetchInventories();
      } catch (err: unknown) {
        const responseError = err as { data?: { message?: string } };
        setError(responseError?.data?.message || "Failed to add the new inventory item.");
        return;
      }
    }

    try {
      await createStockMovement({
        movement_type: "issue",
        quantity: quantityRequested,
        work_order_id: workOrderId,
        requesting_unit_id: unitId,
        notes: requisitionForm.notes || null,
        stocks: [
          {
            inventory_id: inventoryId,
            quantity_requested: quantityRequested,
            quantity_approved: 0,
          },
        ],
      }).unwrap();

      setRequisitionForm(emptyRequisitionForm());
      setReqItemMode("existing");
      setReqNewInventory(emptyNewInventoryDraft());
      setSuccess(
        workOrderId
          ? `Parts requisition created for work order #${workOrderId}.`
          : "Direct parts requisition created.",
      );
      refetchStockMovements();
    } catch {
      setError(
        newItem
          ? `${newItem.part_number} was added to inventory, but the requisition failed. Select it from the list and retry.`
          : "Failed to create requisition.",
      );
      if (newItem) {
        setReqItemMode("existing");
        setRequisitionForm((s) => ({ ...s, inventory_id: String(inventoryId) }));
      }
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

      // Keep the RFQ selected so further quotations for it can be entered quickly.
      setQuotationForm((prev) => ({ ...emptyQuotationForm(), rfq_id: prev.rfq_id }));
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

  const handleSelectPoRfq = (value: string | number | null) => {
    const rfq = value === null ? undefined : rfqById.get(Number(value));
    const approved = rfq ? approvedQuotationByRfq.get(Number(rfq.id)) : undefined;
    // Prefill the line from the requisition behind the RFQ.
    const firstLine = rfq ? rfqRequisition(rfq)?.stocks?.find((line) => line.inventory_id) : undefined;

    setPoForm((s) => ({
      ...s,
      rfq_id: toId(value),
      supplier_id: approved?.supplier_id ? String(approved.supplier_id) : s.supplier_id,
      inventory_id: firstLine?.inventory_id ? String(firstLine.inventory_id) : s.inventory_id,
      quantity_ordered: firstLine ? String(firstLine.quantity_requested) : s.quantity_ordered,
    }));
    if (firstLine?.inventory_id) setPoItemMode("existing");
  };

  const handleCreatePo = async () => {
    const rfqId = Number(poForm.rfq_id);
    const supplierId = Number(poForm.supplier_id);
    const inventoryId = Number(poForm.inventory_id);
    const quantityOrdered = Number(poForm.quantity_ordered);
    const unitPrice = poForm.unit_price ? Number(poForm.unit_price) : undefined;

    if (!rfqId || !supplierId || !Number.isInteger(quantityOrdered) || quantityOrdered < 1) {
      setError("Provide RFQ, supplier and a valid quantity for PO.");
      return;
    }

    let poItem: { inventory_id?: number; new_inventory?: NewInventoryPayload; unit_price?: number };
    if (poItemMode === "new") {
      const result = toNewInventoryPayload(poNewInventory);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      poItem = { new_inventory: result.payload };
      if (unitPrice !== undefined) poItem.unit_price = unitPrice;
      else if (result.payload.unit_cost != null) poItem.unit_price = result.payload.unit_cost;
    } else {
      if (!inventoryId) {
        setError("Select an inventory item, or add a new one.");
        return;
      }
      poItem = { inventory_id: inventoryId };
      if (unitPrice !== undefined) poItem.unit_price = unitPrice;
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
            ...poItem,
            quantity_ordered: quantityOrdered,
            quantity_received: 0,
          },
        ],
      }).unwrap();

      setPoForm(emptyPoForm());
      setPoItemMode("existing");
      setPoNewInventory(emptyNewInventoryDraft());
      setSuccess("Purchase order created from approved RFQ.");
      refetchPurchaseOrders();
    } catch (err: unknown) {
      const responseError = err as { data?: { message?: string } };
      setError(responseError?.data?.message || "Failed to create purchase order.");
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
      setError("Select a PO and prepare at least one line of stock received.");
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
      setSuccess(
        "Stock received posted to the store in daily batches. Issue it out to the requesting unit next.",
      );
      refetchPurchaseOrders();
      refetchGoodsReceivedNotes();
      refetchInventories();
    } catch {
      setError("Failed to post stock received.");
    }
  };

  const handleIssueStock = async () => {
    const req = issueRequisition;
    if (!req?.stocks?.length) {
      setError("Select a requisition to issue stock against.");
      return;
    }

    const toIssue: Array<{ lineId: number; quantity: number }> = [];
    for (const [index, line] of req.stocks.entries()) {
      const raw = issueForm.quantities[index];
      if (!raw || !line.inventory_id || !line.id) continue;
      const quantity = Number(raw);
      const label = line.inventory ? inventoryLabel(line.inventory) : `line ${index + 1}`;
      const inStore = Number(inventoryById.get(Number(line.inventory_id))?.current_stock ?? 0);
      if (!Number.isInteger(quantity) || quantity < 0) {
        setError(`Enter a valid quantity for ${label}.`);
        return;
      }
      if (quantity > lineOutstanding(line)) {
        setError(`Cannot issue more than the ${lineOutstanding(line)} outstanding for ${label}.`);
        return;
      }
      if (quantity > inStore) {
        setError(`Only ${inStore} of ${label} in store.`);
        return;
      }
      if (quantity > 0) toIssue.push({ lineId: line.id, quantity });
    }

    if (toIssue.length === 0) {
      setError("Enter a quantity to issue on at least one line.");
      return;
    }

    try {
      await issueStockMovement({
        id: req.id,
        items: toIssue.map((item) => ({
          stock_movement_stock_id: item.lineId,
          quantity: item.quantity,
        })),
      }).unwrap();
      setIssueForm({ stock_movement_id: "", quantities: {} });
      setSuccess(`Stock issued out to ${requisitionUnit(req)} for REQ #${req.id}.`);
    } catch (err: unknown) {
      const responseError = err as { data?: { message?: string } };
      setError(responseError?.data?.message || "Failed to issue stock.");
    }
    refetchInventories();
    refetchStockMovements();
  };

  const stageCounts: Record<StageHash, number | null> = {
    "requisition-section": requisitions.length,
    "rfq-section": rfqs.length,
    "quotation-section": quotations.length,
    "po-section": purchaseOrders.length,
    "grn-section": goodsReceivedNotes.length,
    "issue-section": requisitions.filter((req) => issueStatus(req) !== "none").length,
    "snapshot-section": null,
  };

  // --- Stage content --------------------------------------------------------

  const renderRequisitionStage = () => (
    <>
      <h2 className={sectionTitleClass}>1. Parts Requisition</h2>
      <p className={sectionHintClass}>
        Request parts directly, or link the requisition to an engineering work order. Parts not yet in
        inventory can be added here.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-3">
          <span className={labelClass}>Inventory item *</span>
          <div className="flex gap-2">
            <SearchableSelect
              className="flex-1 min-w-0"
              buttonClassName="py-2"
              placeholder="Select inventory item"
              searchPlaceholder="Search by part number or description..."
              options={inventoryOptions}
              value={requisitionForm.inventory_id ? Number(requisitionForm.inventory_id) : null}
              onChange={(value) => setRequisitionForm((s) => ({ ...s, inventory_id: toId(value) }))}
              disabled={reqItemMode === "new"}
            />
            <button
              type="button"
              onClick={() => setReqItemMode((m) => (m === "new" ? "existing" : "new"))}
              className="shrink-0 rounded border border-[var(--theme-border-em)] px-3 text-xs text-[var(--theme-accent)] hover:bg-[var(--theme-bg-panel)]"
            >
              {reqItemMode === "new" ? "Pick from list" : "Not in list?"}
            </button>
          </div>
        </div>
        <div>
          <span className={labelClass}>Quantity *</span>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={requisitionForm.quantity_requested}
            onChange={(e) => setRequisitionForm((s) => ({ ...s, quantity_requested: e.target.value }))}
            placeholder="Requested quantity"
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Work order (optional)</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder="None (direct requisition)"
            searchPlaceholder="Search work orders..."
            options={workOrderOptions}
            value={requisitionForm.work_order_id ? Number(requisitionForm.work_order_id) : null}
            onChange={(value) => setRequisitionForm((s) => ({ ...s, work_order_id: toId(value) }))}
          />
        </div>
        {reqItemMode === "new" && (
          <div className="md:col-span-6">
            <NewInventoryItemFields
              draft={reqNewInventory}
              onChange={setReqNewInventory}
              expenseCategories={expenseCategories}
              inputClassName={fieldClass}
            />
          </div>
        )}
        <div className="md:col-span-3">
          <span className={labelClass}>Requesting unit (stock is issued out to)</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder="Select unit"
            searchPlaceholder="Search units..."
            options={unitOptions}
            value={requisitionForm.requesting_unit_id ? Number(requisitionForm.requesting_unit_id) : null}
            onChange={(value) => setRequisitionForm((s) => ({ ...s, requesting_unit_id: toId(value) }))}
          />
        </div>
      </div>
      <textarea
        className={textareaClass}
        value={requisitionForm.notes}
        onChange={(e) => setRequisitionForm((s) => ({ ...s, notes: e.target.value }))}
        placeholder="Requisition notes / justification"
        rows={2}
      />
      <button
        className={`mt-3 ${accentButtonClass}`}
        onClick={handleCreateRequisition}
        disabled={isCreatingRequisition || isCreatingInventory}
        type="button"
      >
        {isCreatingInventory
          ? "Adding item..."
          : isCreatingRequisition
            ? "Creating..."
            : "Create Requisition"}
      </button>

      <h3 className="mt-8 mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">
        Recent requisitions ({requisitions.length})
      </h3>
      <div className="overflow-x-auto rounded border border-[var(--theme-divider)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className={tableHeadClass}>
            <tr>
              <th className="px-3 py-2 text-left">Requisition</th>
              <th className="px-3 py-2 text-left">Origin</th>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-left">Items</th>
              <th className="px-3 py-2 text-left">RFQ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--theme-divider)] text-[var(--theme-text-secondary)]">
            {requisitions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--theme-text-muted)]">
                  No requisitions yet.
                </td>
              </tr>
            ) : (
              requisitions.slice(0, 10).map((req) => {
                const hasRfq = rfqRequisitionIds.has(Number(req.id));
                return (
                  <tr key={req.id}>
                    <td className="px-3 py-2 text-[var(--theme-text-primary)]">REQ #{req.id}</td>
                    <td className="px-3 py-2">{requisitionOrigin(req)}</td>
                    <td className="px-3 py-2">{requisitionUnit(req)}</td>
                    <td className="px-3 py-2">{describeRequisitionItems(req)}</td>
                    <td className="px-3 py-2">
                      {hasRfq ? (
                        <span className="text-xs text-emerald-400">RFQ issued</span>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-[var(--theme-accent)] hover:underline"
                          onClick={() => {
                            setRfqForm((s) => ({ ...s, stock_movement_id: String(req.id) }));
                            goToStage("rfq-section");
                          }}
                        >
                          Start RFQ →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderRfqStage = () => (
    <>
      <h2 className={sectionTitleClass}>2. Request for Quotation (RFQ)</h2>
      <p className={sectionHintClass}>Send a requisition to one or more suppliers for pricing.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className={labelClass}>Requisition *</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder="Select requisition"
            searchPlaceholder="Search by REQ #, part number or description..."
            options={requisitionOptions}
            value={rfqForm.stock_movement_id ? Number(rfqForm.stock_movement_id) : null}
            onChange={(value) => setRfqForm((s) => ({ ...s, stock_movement_id: toId(value) }))}
          />
        </div>
        <MultiSelect
          label="Suppliers *"
          placeholder="Select suppliers"
          searchable
          searchPlaceholder="Search suppliers..."
          options={supplierOptions}
          selectedValues={rfqForm.supplier_ids}
          onChange={(selected) =>
            setRfqForm((s) => ({ ...s, supplier_ids: selected.map((value) => Number(value)) }))
          }
          className="[&_label]:text-xs [&_label]:font-normal [&_label]:text-[var(--theme-text-muted)] [&_button]:py-2"
        />
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

      <h3 className="mt-8 mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">
        Issued RFQs ({rfqs.length})
      </h3>
      <div className="overflow-x-auto rounded border border-[var(--theme-divider)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className={tableHeadClass}>
            <tr>
              <th className="px-3 py-2 text-left">RFQ</th>
              <th className="px-3 py-2 text-left">Items</th>
              <th className="px-3 py-2 text-left">Suppliers</th>
              <th className="px-3 py-2 text-left">Quotations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--theme-divider)] text-[var(--theme-text-secondary)]">
            {rfqs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--theme-text-muted)]">
                  No RFQs yet.
                </td>
              </tr>
            ) : (
              [...rfqs]
                .sort((a, b) => b.id - a.id)
                .slice(0, 10)
                .map((rfq) => (
                  <tr key={rfq.id}>
                    <td className="px-3 py-2 text-[var(--theme-text-primary)]">
                      {rfq.rfq_number || `RFQ #${rfq.id}`}
                    </td>
                    <td className="px-3 py-2">{describeRequisitionItems(rfqRequisition(rfq))}</td>
                    <td className="px-3 py-2">
                      {rfq.suppliers?.map((supplier) => supplier.name).join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-[var(--theme-accent)] hover:underline"
                        onClick={() => handleOpenRfq(rfq.id)}
                      >
                        {quotations.filter((q) => Number(q.rfq_id) === Number(rfq.id)).length} received →
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderQuotationStage = () => (
    <>
      <h2 className={sectionTitleClass}>3. Supplier Quotations and Approval</h2>
      <p className={sectionHintClass}>
        Record the quotations suppliers send back, then approve one per RFQ.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-3">
          <span className={labelClass}>RFQ *</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder="Select RFQ"
            searchPlaceholder="Search by RFQ #, part number or description..."
            options={rfqOptions}
            value={quotationForm.rfq_id ? Number(quotationForm.rfq_id) : null}
            onChange={(value) =>
              setQuotationForm((s) => ({ ...s, rfq_id: toId(value), supplier_id: "" }))
            }
          />
        </div>
        <div className="md:col-span-3">
          <span className={labelClass}>Supplier *</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder="Select supplier"
            searchPlaceholder="Search suppliers..."
            options={quotationSupplierOptions}
            value={quotationForm.supplier_id ? Number(quotationForm.supplier_id) : null}
            onChange={(value) => setQuotationForm((s) => ({ ...s, supplier_id: toId(value) }))}
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Quotation #</span>
          <input
            className={fieldClass}
            value={quotationForm.quotation_number}
            onChange={(e) => setQuotationForm((s) => ({ ...s, quotation_number: e.target.value }))}
            placeholder="Supplier's reference"
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Total amount</span>
          <input
            type="number"
            min={0}
            className={fieldClass}
            value={quotationForm.total_amount}
            onChange={(e) => setQuotationForm((s) => ({ ...s, total_amount: e.target.value }))}
            placeholder="0.00"
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Valid until</span>
          <input
            type="date"
            className={fieldClass}
            value={quotationForm.valid_until}
            onChange={(e) => setQuotationForm((s) => ({ ...s, valid_until: e.target.value }))}
            aria-label="Valid until"
          />
        </div>
      </div>
      <textarea
        className={textareaClass}
        value={quotationForm.notes}
        onChange={(e) => setQuotationForm((s) => ({ ...s, notes: e.target.value }))}
        placeholder="Quotation notes"
        rows={2}
      />
      <button
        type="button"
        className={`mt-3 ${accentButtonClass}`}
        onClick={handleCreateQuotation}
        disabled={isCreatingQuotation}
      >
        {isCreatingQuotation ? "Saving..." : "Receive Quotation"}
      </button>

      <h3 className="mt-8 mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">
        {quotationRfq
          ? `Quotations for ${quotationRfq.rfq_number || `RFQ #${quotationRfq.id}`} (${visibleQuotations.length})`
          : `All quotations (${visibleQuotations.length})`}
      </h3>
      <div className="space-y-2">
        {visibleQuotations.length === 0 ? (
          <p className="text-sm text-[var(--theme-text-muted)]">No quotations yet.</p>
        ) : (
          visibleQuotations.map((q) => {
            const rfq = rfqById.get(Number(q.rfq_id));
            const isApproved = q.status === "approved";
            return (
              <div
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--theme-divider)] px-3 py-2"
              >
                <div className="text-sm text-[var(--theme-text-secondary)]">
                  <span className="text-[var(--theme-text-primary)]">
                    {rfq?.rfq_number || `RFQ #${q.rfq_id}`}
                  </span>{" "}
                  | {q.supplier?.name || `Supplier #${q.supplier_id}`} | {q.total_amount || "-"}{" "}
                  {q.currency || "NGN"}
                  {rfq && (
                    <div className="text-xs text-[var(--theme-text-muted)]">
                      {describeRequisitionItems(rfqRequisition(rfq))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs uppercase",
                      isApproved
                        ? "text-emerald-400"
                        : q.status === "rejected"
                          ? "text-red-400"
                          : "text-[var(--theme-text-muted)]",
                    )}
                  >
                    {q.status}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-emerald-500/50 px-2 py-1 text-xs text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50"
                    disabled={isApprovingQuotation || isApproved}
                    onClick={() => handleApproveQuotation(q.id)}
                  >
                    {isApproved ? "Approved" : "Approve"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  const renderPoStage = () => (
    <>
      <h2 className={sectionTitleClass}>4. Purchase Order</h2>
      <p className={sectionHintClass}>
        Raise a purchase order against an RFQ with an approved quotation. The supplier and item are
        filled in from the RFQ.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <span className={labelClass}>Approved RFQ *</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder={approvedRfqOptions.length ? "Select approved RFQ" : "No approved RFQs yet"}
            searchPlaceholder="Search by RFQ #, part number or description..."
            options={approvedRfqOptions}
            value={poForm.rfq_id ? Number(poForm.rfq_id) : null}
            onChange={handleSelectPoRfq}
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Supplier *</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder="Select supplier"
            searchPlaceholder="Search suppliers..."
            options={supplierOptions}
            value={poForm.supplier_id ? Number(poForm.supplier_id) : null}
            onChange={(value) => setPoForm((s) => ({ ...s, supplier_id: toId(value) }))}
          />
        </div>
        <div className="md:col-span-4">
          <span className={labelClass}>Item *</span>
          <div className="flex gap-2">
            <SearchableSelect
              className="flex-1 min-w-0"
              buttonClassName="py-2"
              placeholder="Select inventory item"
              searchPlaceholder="Search by part number or description..."
              options={inventoryOptions}
              value={poForm.inventory_id ? Number(poForm.inventory_id) : null}
              onChange={(value) => setPoForm((s) => ({ ...s, inventory_id: toId(value) }))}
              disabled={poItemMode === "new"}
            />
            <button
              type="button"
              onClick={() => setPoItemMode((m) => (m === "new" ? "existing" : "new"))}
              className="shrink-0 rounded border border-[var(--theme-border-em)] px-3 text-xs text-[var(--theme-accent)] hover:bg-[var(--theme-bg-panel)]"
            >
              {poItemMode === "new" ? "Pick from stock" : "Not in stock?"}
            </button>
          </div>
        </div>
        {poItemMode === "new" && (
          <div className="md:col-span-4">
            <NewInventoryItemFields
              draft={poNewInventory}
              onChange={setPoNewInventory}
              expenseCategories={expenseCategories}
              inputClassName={fieldClass}
            />
          </div>
        )}
        <div>
          <span className={labelClass}>Quantity ordered *</span>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={poForm.quantity_ordered}
            onChange={(e) => setPoForm((s) => ({ ...s, quantity_ordered: e.target.value }))}
            placeholder="Qty ordered"
          />
        </div>
        <div>
          <span className={labelClass}>Unit price</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={fieldClass}
            value={poForm.unit_price}
            onChange={(e) => setPoForm((s) => ({ ...s, unit_price: e.target.value }))}
            placeholder="0.00"
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>PO name</span>
          <input
            className={fieldClass}
            value={poForm.name}
            onChange={(e) => setPoForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="PO Name"
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Order date</span>
          <input
            type="date"
            className={fieldClass}
            value={poForm.order_date}
            onChange={(e) => setPoForm((s) => ({ ...s, order_date: e.target.value }))}
            aria-label="Order date"
          />
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Expected delivery</span>
          <input
            type="date"
            className={fieldClass}
            value={poForm.expected_date_of_delivery}
            onChange={(e) => setPoForm((s) => ({ ...s, expected_date_of_delivery: e.target.value }))}
            aria-label="Expected delivery date"
          />
        </div>
      </div>
      <button
        type="button"
        className={`mt-4 ${accentButtonClass}`}
        onClick={handleCreatePo}
        disabled={isCreatingPo}
      >
        {isCreatingPo ? "Creating PO..." : "Create Purchase Order"}
      </button>
    </>
  );

  const renderGrnStage = () => (
    <>
      <h2 className={sectionTitleClass}>5. Stock Received</h2>
      <p className={sectionHintClass}>
        Record stock received against a purchase order. Posting adds it to store stock in daily batches,
        where it stays until it is issued out to the requesting unit in the next step.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <span className={labelClass}>Purchase order *</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder="Select purchase order"
            searchPlaceholder="Search by PO #, name, supplier or item..."
            options={purchaseOrderOptions}
            value={grnForm.purchase_order_id ? Number(grnForm.purchase_order_id) : null}
            onChange={(value) =>
              setGrnForm((s) => ({ ...s, purchase_order_id: toId(value), items: [] }))
            }
          />
        </div>
        <button
          type="button"
          className={ghostButtonClass}
          onClick={handlePrepareGrnItems}
          disabled={!grnForm.purchase_order_id}
        >
          Prepare Lines from PO
        </button>
        <button
          type="button"
          className={accentButtonClass}
          onClick={handleCreateGrn}
          disabled={isCreatingGrn}
        >
          {isCreatingGrn ? "Posting..." : "Post Stock Received"}
        </button>
      </div>

      <textarea
        className={textareaClass}
        value={grnForm.notes}
        onChange={(e) => setGrnForm((s) => ({ ...s, notes: e.target.value }))}
        placeholder="Stock received notes / acknowledgement"
        rows={2}
      />

      {grnForm.items.length > 0 && (
        <div className="mt-3 rounded border border-[var(--theme-divider)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="text-left px-3 py-2">Inventory</th>
                <th className="text-right px-3 py-2">Qty Received</th>
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
                            className="inline-flex items-center gap-1 rounded border border-[var(--theme-border-em)] px-2 py-1 text-xs text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white hover:bg-[var(--theme-bg-panel)] transition-colors"
                            onClick={() => handleOpenRfq(row.rfq?.id)}
                          >
                            <Icon icon="mdi:file-document-edit-outline" className="h-3.5 w-3.5" />
                            Open RFQ
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                            onClick={() => handleOpenPo(row.po?.id)}
                          >
                            <Icon icon="mdi:cart-outline" className="h-3.5 w-3.5" />
                            Open PO
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-xs text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 transition-colors"
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
      )}
    </>
  );

  const renderIssueStage = () => (
    <>
      <h2 className={sectionTitleClass}>6. Stock Issue</h2>
      <p className={sectionHintClass}>
        Issue stock out of the store to the unit that requested it. Issuing deducts it from store stock
        and records it against the requisition. Partial issues are allowed.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className={labelClass}>Requisition *</span>
          <SearchableSelect
            buttonClassName="py-2"
            placeholder={issueRequisitionOptions.length ? "Select requisition" : "Nothing left to issue"}
            searchPlaceholder="Search by REQ #, unit, part number or description..."
            options={issueRequisitionOptions}
            value={issueForm.stock_movement_id ? Number(issueForm.stock_movement_id) : null}
            onChange={(value) => setIssueForm({ stock_movement_id: toId(value), quantities: {} })}
          />
        </div>
        {issueRequisition && (
          <div className="text-sm text-[var(--theme-text-secondary)] md:pt-5">
            Issuing to{" "}
            <span className="font-semibold text-[var(--theme-text-primary)]">
              {requisitionUnit(issueRequisition)}
            </span>{" "}
            · {requisitionOrigin(issueRequisition)}
          </div>
        )}
      </div>

      {issueRequisition && (
        <>
          <div className="mt-4 overflow-x-auto rounded border border-[var(--theme-divider)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Requested</th>
                  <th className="px-3 py-2 text-right">Issued</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-right">In store</th>
                  <th className="px-3 py-2 text-right">Issue now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-divider)] text-[var(--theme-text-secondary)]">
                {(issueRequisition.stocks ?? []).map((line, index) => {
                  const inv = line.inventory_id ? inventoryById.get(Number(line.inventory_id)) : undefined;
                  const inStore = Number(inv?.current_stock ?? 0);
                  const outstanding = lineOutstanding(line);
                  const canIssue = !!line.inventory_id && outstanding > 0 && inStore > 0;
                  return (
                    <tr key={`${line.inventory_id ?? line.spare_id}-${index}`}>
                      <td className="px-3 py-2 text-[var(--theme-text-primary)]">
                        {line.inventory
                          ? inventoryLabel(line.inventory)
                          : inv
                            ? inventoryLabel(inv)
                            : `Spare #${line.spare_id}`}
                      </td>
                      <td className="px-3 py-2 text-right">{line.quantity_requested}</td>
                      <td className="px-3 py-2 text-right">{lineIssued(line)}</td>
                      <td className="px-3 py-2 text-right">{outstanding}</td>
                      <td className={cn("px-3 py-2 text-right", inStore < outstanding && "text-amber-400")}>
                        {inStore}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={Math.min(outstanding, inStore)}
                          aria-label="Quantity to issue"
                          className={`${fieldClass} w-24 text-right`}
                          placeholder={canIssue ? String(Math.min(outstanding, inStore)) : "-"}
                          disabled={!canIssue}
                          value={issueForm.quantities[index] ?? ""}
                          onChange={(e) =>
                            setIssueForm((s) => ({
                              ...s,
                              quantities: { ...s.quantities, [index]: e.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() =>
                setIssueForm((s) => ({
                  ...s,
                  quantities: Object.fromEntries(
                    (issueRequisition.stocks ?? []).map((line, index) => {
                      const inStore = Number(
                        inventoryById.get(Number(line.inventory_id))?.current_stock ?? 0,
                      );
                      const qty = line.inventory_id ? Math.min(lineOutstanding(line), inStore) : 0;
                      return [index, qty > 0 ? String(qty) : ""];
                    }),
                  ),
                }))
              }
            >
              Fill available
            </button>
            <button
              type="button"
              className={accentButtonClass}
              onClick={handleIssueStock}
              disabled={isIssuing}
            >
              {isIssuing ? "Issuing..." : `Issue to ${requisitionUnit(issueRequisition)}`}
            </button>
          </div>
        </>
      )}

      <h3 className="mt-8 mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">
        Issue status
      </h3>
      <div className="overflow-x-auto rounded border border-[var(--theme-divider)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className={tableHeadClass}>
            <tr>
              <th className="px-3 py-2 text-left">Requisition</th>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-left">Issued</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--theme-divider)] text-[var(--theme-text-secondary)]">
            {requisitions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--theme-text-muted)]">
                  No requisitions yet.
                </td>
              </tr>
            ) : (
              requisitions.slice(0, 10).map((req) => {
                const status = issueStatus(req);
                const lines = req.stocks ?? [];
                return (
                  <tr key={req.id}>
                    <td className="px-3 py-2">
                      <span className="text-[var(--theme-text-primary)]">REQ #{req.id}</span>
                      <div className="text-xs text-[var(--theme-text-muted)]">
                        {describeRequisitionItems(req)}
                      </div>
                    </td>
                    <td className="px-3 py-2">{requisitionUnit(req)}</td>
                    <td className="px-3 py-2">
                      {lines.reduce((sum, line) => sum + lineIssued(line), 0)} /{" "}
                      {lines.reduce((sum, line) => sum + Number(line.quantity_requested), 0)}
                    </td>
                    <td className="px-3 py-2">
                      {status === "full" ? (
                        <span className="text-xs text-emerald-400">Fully issued</span>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-[var(--theme-accent)] hover:underline"
                          onClick={() => handleOpenIssue(req.id)}
                        >
                          {status === "partial" ? "Partially issued · Issue rest →" : "Issue →"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderSummaryStage = () => (
    <>
      <h2 className={`${sectionTitleClass} mb-4`}>Lifecycle Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
        {[
          { label: "Requisitions", value: requisitions.length },
          { label: "RFQs", value: rfqs.length },
          { label: "Quotations", value: quotations.length },
          { label: "Purchase Orders", value: purchaseOrders.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded bg-[var(--theme-bg-panel)] p-3">
            <p className="text-xs text-[var(--theme-text-muted)]">{stat.label}</p>
            <p className="text-2xl font-bold text-[var(--theme-text-primary)]">{stat.value}</p>
          </div>
        ))}
        <div className="rounded bg-[var(--theme-bg-panel)] p-3">
          <p className="text-xs text-[var(--theme-text-muted)]">Approved Quotes</p>
          <p className="text-2xl font-bold text-emerald-500">{approvedQuotationByRfq.size}</p>
        </div>
        <div className="rounded bg-[var(--theme-bg-panel)] p-3">
          <p className="text-xs text-[var(--theme-text-muted)]">Fully Issued</p>
          <p className="text-2xl font-bold text-emerald-500">
            {requisitions.filter((req) => issueStatus(req) === "full").length}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded border border-[var(--theme-divider)]">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className={tableHeadClass}>
            <tr>
              <th className="px-3 py-2 text-left">Requisition</th>
              <th className="px-3 py-2 text-left">RFQ</th>
              <th className="px-3 py-2 text-left">Approved Quotation</th>
              <th className="px-3 py-2 text-left">Purchase Order</th>
              <th className="px-3 py-2 text-left">Stock Received</th>
              <th className="px-3 py-2 text-left">Issued To</th>
              <th className="px-3 py-2 text-left">Current Stage</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--theme-divider)]">
            {lifecycleRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[var(--theme-text-muted)]">
                  No lifecycle records yet.
                </td>
              </tr>
            ) : (
              lifecycleRows.map((row) => {
                const issued = issueStatus(row.req);
                // Requisitions for parts already in store can be issued without
                // going through procurement, so issue status takes precedence.
                const currentStage =
                  issued === "full"
                    ? "Completed (Issued)"
                    : issued === "partial"
                      ? "Partially Issued"
                      : row.grn
                        ? "Stock Received"
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
                      <span className="text-[var(--theme-text-primary)]">REQ #{row.req.id}</span>
                      <div className="text-xs text-[var(--theme-text-muted)]">
                        {requisitionOrigin(row.req)} · {describeRequisitionItems(row.req)}
                      </div>
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
                      {issued === "none" ? "-" : requisitionUnit(row.req)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)] px-2 py-1 text-xs text-[var(--theme-accent)]">
                        {currentStage}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-[var(--theme-border-em)] px-2 py-1 text-xs text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-panel)]"
                          onClick={() => handleOpenRfq(row.rfq?.id)}
                        >
                          <Icon icon="mdi:file-document-edit-outline" className="h-3.5 w-3.5" />
                          Open RFQ
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-xs text-[var(--theme-text-primary)] hover:bg-emerald-500/10"
                          onClick={() => handleOpenPo(row.po?.id)}
                        >
                          <Icon icon="mdi:cart-outline" className="h-3.5 w-3.5" />
                          Open PO
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-xs text-[var(--theme-text-primary)] hover:bg-amber-500/10"
                          onClick={() => handleOpenGrn(row.po?.id)}
                        >
                          <Icon icon="mdi:package-check" className="h-3.5 w-3.5" />
                          Receive Stock
                        </button>
                        {issued !== "full" && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-sky-500/40 px-2 py-1 text-xs text-[var(--theme-text-primary)] hover:bg-sky-500/10"
                            onClick={() => handleOpenIssue(row.req.id)}
                          >
                            <Icon icon="mdi:truck-delivery-outline" className="h-3.5 w-3.5" />
                            Issue Stock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const stageRenderers: Record<StageHash, () => React.ReactNode> = {
    "requisition-section": renderRequisitionStage,
    "rfq-section": renderRfqStage,
    "quotation-section": renderQuotationStage,
    "po-section": renderPoStage,
    "grn-section": renderGrnStage,
    "issue-section": renderIssueStage,
    "snapshot-section": renderSummaryStage,
  };

  const previousStage = STAGES[stageIndex - 1];
  const nextStage = STAGES[stageIndex + 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--theme-text-primary)]">Procurement Inventory Life Cycle</h1>
        <p className="text-sm mt-1 text-[var(--theme-text-muted)]">
          Requisition, RFQ, quotation approval, purchase order, stock received and issue to units, one
          stage at a time.
        </p>
      </div>

      <nav aria-label="Procurement stages" className="overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {STAGES.map((item, index) => {
            const isActive = index === stageIndex;
            const isPast = index < stageIndex;
            const count = stageCounts[item.hash];
            return (
              <li key={item.hash} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToStage(item.hash)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-[var(--theme-accent)] bg-[var(--theme-bg-card)] text-[var(--theme-accent)] font-semibold"
                      : "border-[var(--theme-border-em)] text-[var(--theme-text-secondary)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-text-primary)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isActive
                        ? "bg-[var(--theme-accent-dark)] text-white"
                        : isPast
                          ? "bg-emerald-600 text-white"
                          : "bg-[var(--theme-bg-panel)] text-[var(--theme-text-muted)]",
                    )}
                  >
                    {index < STAGES.length - 1 ? index + 1 : <Icon icon={item.icon} className="h-3.5 w-3.5" />}
                  </span>
                  <span>{item.label}</span>
                  {count !== null && (
                    <span className="rounded-full bg-[var(--theme-bg-panel)] px-1.5 text-xs text-[var(--theme-text-muted)]">
                      {count}
                    </span>
                  )}
                </button>
                {index < STAGES.length - 1 && (
                  <Icon icon="mdi:chevron-right" className="h-4 w-4 text-[var(--theme-text-muted)]" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.type === "success"
              ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-400"
              : "border-red-500/40 bg-red-900/20 text-red-400"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section id={stage.hash} className={cn(cardClass, "min-h-[50vh]")}>
        {stageRenderers[stage.hash]()}
      </section>

      <div className="flex items-center justify-between gap-3">
        {previousStage ? (
          <button type="button" className={ghostButtonClass} onClick={() => goToStage(previousStage.hash)}>
            <span className="inline-flex items-center gap-1">
              <Icon icon="mdi:arrow-left" className="h-4 w-4" />
              {previousStage.label}
            </span>
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs text-[var(--theme-text-muted)]">
          Step {stageIndex + 1} of {STAGES.length}
        </span>
        {nextStage ? (
          <button type="button" className={accentButtonClass} onClick={() => goToStage(nextStage.hash)}>
            <span className="inline-flex items-center gap-1">
              Next: {nextStage.label}
              <Icon icon="mdi:arrow-right" className="h-4 w-4" />
            </span>
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
};
