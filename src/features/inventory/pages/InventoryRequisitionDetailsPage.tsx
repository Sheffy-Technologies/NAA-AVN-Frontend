import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApprovalPanel } from "@/features/approvals/components/ApprovalPanel";
import { buildRequisitionDocument, personName } from "@/features/inventory/procurementDocuments";
import { exportNaavnPdf } from "@/shared/documents/naavnPdf";
import { sanitizeDocumentFileName } from "@/shared/documents/naavnDocument";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateStockMovementMutation,
  useCreateRfqMutation,
  useGetSuppliersQuery,
  useGetInventoryRequisitionByIdQuery,
  useUpdateInventoryRequisitionMutation,
} from "@/features/inventory/api";
import { useTheme } from "@/context/ThemeContext";
import { BackButton } from "@/shared/ui/button";

type StatusLabel =
  | "Approved"
  | "Under Review"
  | "Rejected"
  | "Received"
  | "Pending"
  | "Unknown";

const normalizeStatus = (status: string | null | undefined): StatusLabel => {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "approved") return "Approved";
  if (
    value === "under_review" ||
    value === "under review" ||
    value === "review"
  )
    return "Under Review";
  if (value === "rejected") return "Rejected";
  if (value === "received") return "Received";
  if (value === "pending") return "Pending";
  return "Unknown";
};

const statusDotColor: Record<StatusLabel, string> = {
  Approved: "bg-emerald-400",
  "Under Review": "bg-amber-400",
  Rejected: "bg-red-400",
  Received: "bg-sky-400",
  Pending: "bg-gray-400",
  Unknown: "bg-gray-500",
};

export type RequisitionItemRow = {
  id: number;
  inventoryId: number;
  partNumber: string;
  description: string;
  itemDescription: string;
  requested: { qty: number; unit: string | null };
  available: { qty: number; unit: string | null };
  approved: { qty: string; unit: string | null };
  newStockLevel: { qty: number; unit: string | null };
};

export const InventoryRequisitionDetailsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const { isDark } = useTheme();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const {
    data: detail,
    isLoading,
    isError,
    refetch,
  } = useGetInventoryRequisitionByIdQuery(id ?? "", { skip: !id });

  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [updateRequisition, { isLoading: isSaving }] =
    useUpdateInventoryRequisitionMutation();
  const [createStockMovement] = useCreateStockMovementMutation();
  const [createRfq] = useCreateRfqMutation();

  const [remark, setRemark] = useState("");
  const [hasEditedRemark, setHasEditedRemark] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusSelection, setStatusSelection] = useState<StatusLabel | null>(null);

  // RFQ Modal State
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [rfqTargetLine, setRfqTargetLine] = useState<{
    id: number;
    inventoryId: number;
    partNumber: string;
    description: string;
    shortfall: number;
  } | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [rfqNotes, setRfqNotes] = useState("");
  const [isSubmittingRfq, setIsSubmittingRfq] = useState(false);

  const [approvedEdits, setApprovedEdits] = useState<Record<number, string>>(
    {},
  );

  const requisitionItems: RequisitionItemRow[] = useMemo(() => {
    return (detail?.items ?? []).map((line) => {
      const fallbackApproved =
        line.approved_quantity !== null && line.approved_quantity !== undefined
          ? String(line.approved_quantity)
          : line.requested_quantity !== null &&
              line.requested_quantity !== undefined
            ? String(line.requested_quantity)
            : "";

      const approvedQtyRaw = approvedEdits[line.id] ?? fallbackApproved;
      const approvedQty = approvedQtyRaw.trim().length
        ? Number(approvedQtyRaw)
        : 0;
      const requestedQty = line.requested_quantity ?? 0;
      const availableQty =
        line.available_quantity ?? line.inventory?.current_stock ?? 0;
      const unit = line.inventory?.measurement_unit || null;
      const newStockLevel =
        availableQty - (Number.isNaN(approvedQty) ? 0 : approvedQty);
      const itemDescription =
        line.inventory?.description ||
        line.inventory?.part_name ||
        `Inventory #${line.inventory_id}`;

      return {
        id: line.id,
        inventoryId: line.inventory_id,
        partNumber: line.inventory?.part_number || String(line.inventory_id),
        description: itemDescription,
        itemDescription,
        requested: { qty: requestedQty, unit },
        available: { qty: availableQty, unit },
        approved: { qty: approvedQtyRaw, unit },
        newStockLevel: { qty: Math.max(0, newStockLevel), unit },
      };
    });
  }, [detail?.items, approvedEdits]);

  const header = useMemo(() => {
    const requestingLocation =
      detail?.requesting_unit?.name ??
      (detail?.requesting_unit_id ? `Unit #${detail.requesting_unit_id}` : "-");
    const requestingUnitDescription = detail?.requesting_unit?.description ?? null;
    const lastUpdatedBy =
      typeof detail?.last_updated_by === "string"
        ? detail.last_updated_by
        : (detail?.last_updated_by?.name ?? "Admin");
    const requester = detail?.requested_by;
    const requestedByName = requester
      ? [requester.firstname, requester.lastname].filter(Boolean).join(" ").trim() ||
        requester.username ||
        requester.email ||
        `User #${requester.id}`
      : detail?.user_id
        ? `User #${detail.user_id}`
        : "-";
    const status = normalizeStatus(detail?.status);
    const approvedByName = personName(detail?.approved_by) || null;
    const approvedAt = detail?.approved_at
      ? new Date(detail.approved_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : null;

    return {
      requestingLocation,
      requestingUnitDescription,
      requestedByName,
      lastUpdatedBy,
      approvedByName,
      approvedAt,
      status,
    };
  }, [detail]);

  const effectiveStatus = statusSelection ?? header.status;

  const handleExit = () => {
    navigate("/dashboard/inventory", {
      state: { inventoryTab: "Requisitions" },
    });
  };

  const handleChangeApproved = (lineId: number, value: string) => {
    setApprovedEdits((prev) => ({ ...prev, [lineId]: value }));
    setSubmitError(null);
  };

  const validate = () => {
    if (!detail) return false;
    if ((detail.items ?? []).length === 0) {
      setSubmitError("No items found for this request.");
      return false;
    }
    for (const line of detail.items ?? []) {
      const fallbackApproved =
        line.approved_quantity !== null && line.approved_quantity !== undefined
          ? String(line.approved_quantity)
          : line.requested_quantity !== null &&
              line.requested_quantity !== undefined
            ? String(line.requested_quantity)
            : "";
      const raw = (approvedEdits[line.id] ?? fallbackApproved).trim();
      const qty = Number(raw);
      if (raw.length === 0 || Number.isNaN(qty) || qty < 0) {
        setSubmitError("Enter valid approved quantities.");
        return false;
      }
    }
    return true;
  };

  const handleSaveAndExit = async (overrideStatus?: StatusLabel) => {
    if (!detail || !id) return;
    setSubmitError(null);
    if (!validate()) return;

    try {
      const effectiveRemark = hasEditedRemark
        ? remark.trim()
        : (detail.remark ?? "").trim();

      const chosenStatus: StatusLabel =
        overrideStatus ?? statusSelection ?? header.status;

      let backendStatus: string = chosenStatus.toLowerCase().replace(/\s+/g, "_");
      if (backendStatus === "unknown") {
        backendStatus = "pending";
      }

      // If user clicks "Save Changes" without explicitly picking a status,
      // and it was "Pending", but all items have approved quantities > 0,
      // auto-advance to "approved".
      if (!overrideStatus && !statusSelection && header.status === "Pending") {
        const allApproved = (detail.items ?? []).every((line) => {
          const fallbackApproved =
            line.approved_quantity !== null && line.approved_quantity !== undefined
              ? String(line.approved_quantity)
              : line.requested_quantity !== null &&
                  line.requested_quantity !== undefined
                ? String(line.requested_quantity)
                : "0";
          const raw = (approvedEdits[line.id] ?? fallbackApproved).trim();
          return Number(raw) > 0;
        });
        if (allApproved) {
          backendStatus = "approved";
        }
      }

      await updateRequisition({
        id,
        body: {
          status: backendStatus,
          remark: effectiveRemark || null,
          items: (detail.items ?? []).map((line) => {
            const fallbackApproved =
              line.approved_quantity !== null &&
              line.approved_quantity !== undefined
                ? String(line.approved_quantity)
                : line.requested_quantity !== null &&
                    line.requested_quantity !== undefined
                  ? String(line.requested_quantity)
                  : "0";
            const approvedRaw = approvedEdits[line.id] ?? fallbackApproved;
            return {
              id: line.id,
              inventory_id: line.inventory_id,
              approved_quantity: Number(approvedRaw),
            };
          }),
        },
      }).unwrap();

      dispatch(
        showToast({
          message: `Requisition saved successfully (${backendStatus.replace("_", " ").toUpperCase()})`,
          type: "success",
        }),
      );
      handleExit();
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setSubmitError(apiErr?.data?.message || "Failed to save request. Please try again.");
    }
  };

  /** The official NAAVN form, drawn as a vector PDF like the PO and RFQ (not a screenshot of the page). */
  const handleDownloadPdf = async () => {
    if (!detail || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await exportNaavnPdf([buildRequisitionDocument(detail)], sanitizeDocumentFileName(`Requisition ${detail.id}`));
      dispatch(showToast({ message: "PDF downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleOpenRfqModal = (row: RequisitionItemRow) => {
    const shortfall = Math.max(1, row.requested.qty - row.available.qty);
    setRfqTargetLine({
      id: row.id,
      inventoryId: row.inventoryId,
      partNumber: row.partNumber,
      description: row.description,
      shortfall,
    });
    setSelectedSupplierIds(suppliers.slice(0, 3).map((s) => s.id));
    setRfqNotes(`Solicitation for Part #${row.partNumber} - Shortfall quantity: ${shortfall}`);
    setIsRfqModalOpen(true);
  };

  const handleConfirmCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !rfqTargetLine || selectedSupplierIds.length === 0) return;
    setIsSubmittingRfq(true);

    try {
      const movement = await createStockMovement({
        movement_type: "issue",
        quantity: rfqTargetLine.shortfall,
        requesting_unit_id: detail.requesting_unit_id ?? null,
        notes: `Shortfall from Inventory Requisition #${detail.id}`,
        stocks: [
          {
            inventory_id: rfqTargetLine.inventoryId,
            quantity_requested: rfqTargetLine.shortfall,
            quantity_approved: 0,
          },
        ],
      }).unwrap();

      await createRfq({
        stock_movement_id: movement.id,
        supplier_ids: selectedSupplierIds,
        notes: rfqNotes.trim() || `RFQ for Requisition #${detail.id}`,
        status: "sent",
      }).unwrap();

      dispatch(
        showToast({
          message: "Request for Quotation (RFQ) created and sent to suppliers successfully!",
          type: "success",
        }),
      );
      setIsRfqModalOpen(false);
      setRfqTargetLine(null);
    } catch {
      dispatch(
        showToast({
          message: "Failed to create RFQ. Please check suppliers and try again.",
          type: "error",
        }),
      );
    } finally {
      setIsSubmittingRfq(false);
    }
  };

  if (!id) {
    return (
      <div className={cn(
        "border rounded-2xl p-8 text-center text-sm",
        isDark ? "bg-[#001219]/70 border-[#0A4D66]/40 text-slate-400" : "bg-white border-slate-200 text-slate-500 shadow-sm"
      )}>
        Invalid requisition request identifier.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn(
        "border rounded-2xl p-12 flex flex-col items-center justify-center gap-3",
        isDark ? "bg-[#001219]/70 border-[#0A4D66]/40 text-slate-400" : "bg-white border-slate-200 text-slate-500 shadow-sm"
      )}>
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-sky-500" />
        <span className="text-sm font-semibold">Loading parts requisition details...</span>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className={cn(
        "border rounded-2xl p-8 text-center",
        isDark ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-red-50 border-red-200 text-red-700 shadow-sm"
      )}>
        <Icon icon="mdi:alert-circle-outline" className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="font-semibold text-sm">Failed to load request details.</p>
        <div className="mt-4">
          <BackButton fallbackUrl="/dashboard/inventory" />
        </div>
      </div>
    );
  }

  const shortfallCount = requisitionItems.filter((item) => item.requested.qty > item.available.qty).length;

  return (
    <div className="space-y-6">
      {/* Modern Executive Header */}
      <div className={cn(
        "p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors",
        isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex items-center gap-4">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Parts Requisition #{detail.id}
              </h1>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border",
                effectiveStatus === "Approved"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : effectiveStatus === "Received"
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                    : effectiveStatus === "Rejected"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", statusDotColor[effectiveStatus])} />
                {effectiveStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span>Origin: {header.requestingLocation}</span>
              <span>•</span>
              <span>Requested by {header.requestedByName}</span>
              {header.approvedByName && (
                <>
                  <span>•</span>
                  <span>Approved by {header.approvedByName}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs disabled:opacity-60",
              isDark
                ? "border-[#0A4D66]/60 bg-[#001825] text-slate-200 hover:bg-[#0A4D66]/40"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
              className={cn("w-4 h-4 text-sky-500", isDownloadingPdf && "animate-spin")}
            />
            <span>{isDownloadingPdf ? "Generating..." : "Download PDF"}</span>
          </button>
          {effectiveStatus !== "Approved" && effectiveStatus !== "Received" && (
            <button
              type="button"
              onClick={() => handleSaveAndExit("Approved")}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-semibold text-xs transition-colors shadow-xs"
            >
              <Icon icon="mdi:check-circle-outline" className="w-4 h-4 text-emerald-500" />
              <span>Approve Request</span>
            </button>
          )}
          {effectiveStatus !== "Received" && (
            <button
              type="button"
              onClick={() => handleSaveAndExit("Received")}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 font-semibold text-xs transition-colors shadow-xs"
            >
              <Icon icon="mdi:package-variant-closed-check" className="w-4 h-4 text-sky-500" />
              <span>Mark Received</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSaveAndExit()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-all disabled:opacity-60"
          >
            {isSaving && <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Approval: only the approval workflow can approve a requisition while one is active. */}
      {id && <ApprovalPanel module="inventory-requisitions" recordId={Number(id)} onChanged={refetch} />}

      {/* Modern Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Requesting Unit */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Requesting Unit</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Icon icon="mdi:map-marker-radius-outline" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-white truncate">
            {header.requestingLocation}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {header.requestingUnitDescription || "Designated forward operational station"}
          </p>
        </div>

        {/* Card 2: Personnel */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Requisition Personnel</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Icon icon="mdi:account-badge-outline" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-white truncate">
            {header.requestedByName}
          </div>
          {header.approvedByName && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 truncate">
              Approved by {header.approvedByName}
              {header.approvedAt && ` · ${header.approvedAt}`}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            Updated by {header.lastUpdatedBy}
          </p>
        </div>

        {/* Card 3: Status Selector */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Requisition State</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Icon icon="mdi:tag-outline" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full shrink-0", statusDotColor[effectiveStatus])} />
            <select
              title="Requisition Status"
              aria-label="Requisition Status"
              value={effectiveStatus}
              onChange={(e) => setStatusSelection(e.target.value as StatusLabel)}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-bold uppercase transition-colors border focus:outline-none focus:ring-1 focus:ring-sky-500",
                isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            >
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Received">Received</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Current stage in replenishment cycle
          </p>
        </div>

        {/* Card 4: Inventory Assessment */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/70 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Inventory Stock</span>
            <div className={cn("p-2 rounded-xl", shortfallCount > 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>
              <Icon icon={shortfallCount > 0 ? "mdi:alert-octagon-outline" : "mdi:check-all"} className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-white">
            {requisitionItems.length} Line Items
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {shortfallCount > 0 ? `${shortfallCount} items require RFQ solicitation` : "All parts in stock and available"}
          </p>
        </div>
      </div>

      {/* Requisition Line Items Table */}
      <section
        className={cn(
          "rounded-2xl border overflow-hidden transition-colors",
          isDark ? "bg-[#001219]/80 border-[#0A4D66]/40 shadow-sm" : "bg-white border-slate-200 shadow-sm"
        )}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#0A4D66]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Icon icon="mdi:format-list-checks" className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Requested Inventory Items ({requisitionItems.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review available hangar stock, assign approved quantities, or raise RFQs for shortfalls.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className={cn(
            "rounded-xl border overflow-x-auto",
            isDark ? "border-[#0A4D66]/30" : "border-slate-200"
          )}>
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className={cn(
                  "text-xs uppercase font-semibold border-b",
                  isDark ? "bg-[#001825] text-slate-400 border-[#0A4D66]/40" : "bg-slate-50 text-slate-600 border-slate-200"
                )}>
                  <th className="px-5 py-3.5">Item Description / Part</th>
                  <th className="px-5 py-3.5">Requested Qty</th>
                  <th className="px-5 py-3.5">Current Stock</th>
                  <th className="px-5 py-3.5 w-48">Approved Qty</th>
                  <th className="px-5 py-3.5">Post-Issue Stock</th>
                  <th className="px-5 py-3.5 text-right">Procurement Action</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y text-sm", isDark ? "divide-[#0A4D66]/20" : "divide-slate-200")}>
                {requisitionItems.map((row, index) => {
                  const hasShortfall = row.requested.qty > row.available.qty;

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors",
                        isDark
                          ? (index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]/50")
                          : (index % 2 === 0 ? "bg-white" : "bg-slate-50/60")
                      )}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.itemDescription}
                        </div>
                        <div className="text-xs font-mono text-sky-600 dark:text-sky-400 mt-0.5">
                          Part #{row.partNumber}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {row.requested.qty}
                        </span>{" "}
                        <span className="text-xs text-slate-500">{row.requested.unit}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
                          row.available.qty >= row.requested.qty
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", row.available.qty >= row.requested.qty ? "bg-emerald-500" : "bg-rose-500")} />
                          {row.available.qty} {row.available.unit}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="w-full max-w-[140px]">
                          <input
                            type="number"
                            min={0}
                            value={row.approved.qty}
                            onChange={(e) => handleChangeApproved(row.id, e.target.value)}
                            className={cn(
                              "w-full rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                              isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                            )}
                          />
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {row.approved.unit}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {row.newStockLevel.qty}
                        </span>{" "}
                        <span className="text-xs text-slate-500">{row.newStockLevel.unit}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {hasShortfall ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRfqModal(row)}
                            title="Requested quantity exceeds available stock"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300 transition-all shadow-xs"
                          >
                            <Icon icon="mdi:email-fast-outline" className="w-4 h-4" />
                            <span>Raise RFQ</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <Icon icon="mdi:check" className="w-4 h-4" />
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Requisition Remark (Optional)
            </label>
            <input
              type="text"
              value={hasEditedRemark ? remark : (detail.remark ?? "")}
              onChange={(e) => {
                setHasEditedRemark(true);
                setRemark(e.target.value);
              }}
              className={cn(
                "w-full rounded-xl px-4 py-2.5 text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-sky-500",
                isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              )}
              placeholder="Provide reason for requisition or operational context..."
            />
          </div>

          {submitError && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-500 flex items-center gap-2">
              <Icon icon="mdi:alert-circle" className="w-4 h-4 shrink-0" />
              {submitError}
            </div>
          )}
        </div>
      </section>

      {/* Quick RFQ Solicitation Modal */}
      {isRfqModalOpen && rfqTargetLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={cn(
            "w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors",
            isDark ? "bg-[#001420] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900"
          )}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#0A4D66]/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                  <Icon icon="mdi:email-fast-outline" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Request for Quotation (RFQ)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Solicit quotations for shortfall inventory units.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRfqModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateRfq} className="p-6 space-y-4 text-xs">
              <div className={cn(
                "rounded-xl p-4 space-y-1 border",
                isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200"
              )}>
                <div className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">
                  Shortfall Item Specifications
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Part #{rfqTargetLine.partNumber} &mdash; {rfqTargetLine.description}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-300 font-semibold flex items-center gap-1 pt-1">
                  <Icon icon="mdi:alert-circle-outline" className="w-3.5 h-3.5" />
                  Shortfall to Solicit: {rfqTargetLine.shortfall} units
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                  Select Suppliers to Solicit * ({selectedSupplierIds.length} selected)
                </label>
                <div className={cn(
                  "max-h-40 overflow-y-auto rounded-xl border p-2 space-y-1",
                  isDark ? "border-[#0A4D66]/40 bg-[#001825]" : "border-slate-200 bg-slate-50/50"
                )}>
                  {suppliers.length === 0 ? (
                    <div className="py-3 text-center text-slate-500">No suppliers available</div>
                  ) : (
                    suppliers.map((s) => {
                      const isChecked = selectedSupplierIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                            isChecked
                              ? (isDark ? "bg-[#0A4D66]/30 text-white" : "bg-sky-50 text-sky-900")
                              : (isDark ? "hover:bg-[#0A4D66]/20 text-slate-300" : "hover:bg-slate-100 text-slate-700")
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setSelectedSupplierIds((prev) =>
                                e.target.checked
                                  ? [...prev, s.id]
                                  : prev.filter((id) => id !== s.id),
                              );
                            }}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span className="font-semibold">{s.name}</span>
                          {s.contact && (
                            <span className="text-[10px] text-slate-500">({s.contact})</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedSupplierIds.length === 0 && (
                  <p className="text-[10px] text-rose-500 mt-1 font-semibold">Please select at least one supplier.</p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  RFQ Notes &amp; Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide delivery requirements, quotation deadline, or terms..."
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                  className={cn(
                    "w-full rounded-xl px-3.5 py-2 border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500",
                    isDark ? "border-[#0A4D66]/60 bg-[#001825] text-white" : "border-slate-300 bg-white text-slate-900"
                  )}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#0A4D66]/30">
                <button
                  type="button"
                  disabled={isSubmittingRfq}
                  onClick={() => setIsRfqModalOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-xs font-semibold transition-colors",
                    isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRfq || selectedSupplierIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                >
                  {isSubmittingRfq && <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />}
                  <span>{isSubmittingRfq ? "Sending RFQ..." : "Send RFQ"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
