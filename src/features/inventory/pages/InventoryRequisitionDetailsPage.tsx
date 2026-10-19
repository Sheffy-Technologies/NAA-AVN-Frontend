import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import {
  useCreateStockMovementMutation,
  useCreateRfqMutation,
  useGetSuppliersQuery,
  useGetInventoryRequisitionByIdQuery,
  useUpdateInventoryRequisitionMutation,
} from "@/features/inventory/api";
import { BackButton, Button } from "@/shared/ui/button";

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
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const {
    data: detail,
    isLoading,
    isError,
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

    return {
      requestingLocation,
      requestingUnitDescription,
      requestedByName,
      lastUpdatedBy,
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

  const handleDownloadPdf = async () => {
    if (!contentRef.current || !detail || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `inventory-requisition-${detail.id}`,
        backgroundColor: "#001219",
      });
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
      <div className="p-6 text-center text-gray-400">Invalid request.</div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-center text-gray-400">Loading...</div>;
  }

  if (isError || !detail) {
    return (
      <div className="p-6 text-center text-gray-400">
        Failed to load request details.
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            REQUEST DETAILS
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-semibold text-xs transition-colors shadow-sm disabled:opacity-70"
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
              className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
            />
            <span>{isDownloadingPdf ? "Downloading..." : "Download"}</span>
          </button>
          {effectiveStatus !== "Approved" && effectiveStatus !== "Received" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSaveAndExit("Approved")}
              isLoading={isSaving}
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 font-semibold text-xs shadow-sm"
            >
              <Icon icon="mdi:check-circle-outline" className="w-4 h-4 mr-1 text-emerald-400" />
              <span>Approve Request</span>
            </Button>
          )}
          {effectiveStatus !== "Received" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSaveAndExit("Received")}
              isLoading={isSaving}
              className="border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 font-semibold text-xs shadow-sm"
            >
              <Icon icon="mdi:package-variant-closed-check" className="w-4 h-4 mr-1 text-sky-400" />
              <span>Mark Received</span>
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleSaveAndExit()}
            isLoading={isSaving}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <section
        ref={contentRef}
        className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-3 bg-[#001219] border-b border-[#0A4D66]/40">
          <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#7FD5FF]">Requesting Location:</span>
              <span className="text-white font-semibold">
                {header.requestingLocation}
              </span>
              {header.requestingUnitDescription && (
                <span className="text-gray-400">
                  ({header.requestingUnitDescription})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#7FD5FF]">Requested By:</span>
              <span className="text-white font-semibold">
                {header.requestedByName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#7FD5FF]">Last Updated By:</span>
              <span className="text-white font-semibold">
                {header.lastUpdatedBy}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#7FD5FF]">Status:</span>
              <div className="inline-flex items-center gap-2 bg-[#001825] border border-[#0A4D66]/60 rounded-md px-2.5 py-1">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    statusDotColor[effectiveStatus],
                  )}
                />
                <select
                  title="Requisition Status"
                  aria-label="Requisition Status"
                  value={effectiveStatus}
                  onChange={(e) => setStatusSelection(e.target.value as StatusLabel)}
                  className="bg-transparent text-white font-semibold uppercase text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="Pending" className="bg-[#001825] text-white">Pending</option>
                  <option value="Under Review" className="bg-[#001825] text-white">Under Review</option>
                  <option value="Approved" className="bg-[#001825] text-white">Approved</option>
                  <option value="Received" className="bg-[#001825] text-white">Received</option>
                  <option value="Rejected" className="bg-[#001825] text-white">Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#001825] border border-[#0A4D66]/20 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="text-xs uppercase text-gray-400 border-b border-[#0A4D66]/30">
                  <th className="px-4 py-3 font-medium">Item Description</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium">Available</th>
                  <th className="px-4 py-3 font-medium">Approved</th>
                  <th className="px-4 py-3 font-medium">New Stock Level</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                {requisitionItems.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      index % 2 === 0 ? "bg-[#001825]" : "bg-[#001219]",
                    )}
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {row.itemDescription}
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      <span className="font-semibold text-white">
                        {row.requested.qty}
                      </span>{" "}
                      {row.requested.unit}
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      <span className="font-semibold text-white">
                        {row.available.qty}
                      </span>{" "}
                      {row.available.unit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full max-w-[160px]">
                        <input
                          type="number"
                          min={0}
                          value={row.approved.qty}
                          onChange={(e) =>
                            handleChangeApproved(row.id, e.target.value)
                          }
                          className="w-full bg-[#001219] border border-[#0A4D66]/40 focus:border-[#7FD5FF] rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none"
                        />
                        <div className="mt-1 text-[11px] text-gray-400">
                          {row.approved.unit}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      <span className="font-semibold text-white">
                        {row.newStockLevel.qty}
                      </span>{" "}
                      {row.newStockLevel.unit}
                    </td>
                    <td className="px-4 py-3">
                      {row.requested.qty > row.available.qty && (
                        <button
                          type="button"
                          onClick={() => handleOpenRfqModal(row)}
                          title="Requested quantity exceeds available stock"
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer",
                          )}
                        >
                          <Icon
                            icon="mdi:email-fast-outline"
                            className="w-3.5 h-3.5"
                          />
                          <span>Request for Quotation</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-2">
            <div className="text-[11px] text-gray-400">Remark(optional)</div>
            <input
              type="text"
              value={hasEditedRemark ? remark : (detail.remark ?? "")}
              onChange={(e) => {
                setHasEditedRemark(true);
                setRemark(e.target.value);
              }}
              className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-3 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]"
              placeholder="Enter Reason"
            />
          </div>

          {submitError && (
            <div className="mt-3 text-[11px] text-red-400">{submitError}</div>
          )}
        </div>
      </section>

      {/* Quick RFQ Solicitation Modal */}
      {isRfqModalOpen && rfqTargetLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#001219] border border-[#0A4D66] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#0A4D66]/40 bg-[#001825]">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:email-fast-outline" className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm text-white">
                  Request for Quotation (RFQ)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRfqModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateRfq} className="p-6 space-y-4 text-xs">
              <div className="bg-[#001825] border border-[#0A4D66]/30 rounded-lg p-3 space-y-1">
                <div className="text-[11px] uppercase text-gray-400 font-semibold">
                  Part Details
                </div>
                <div className="text-sm font-semibold text-white">
                  Part #{rfqTargetLine.partNumber} &mdash; {rfqTargetLine.description}
                </div>
                <div className="text-xs text-amber-300">
                  Shortfall to Solicit: <span className="font-bold">{rfqTargetLine.shortfall} units</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1.5 text-gray-300">
                  Select Suppliers to Solicit * ({selectedSupplierIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[#0A4D66]/40 p-2 space-y-1 bg-[#001825]">
                  {suppliers.length === 0 ? (
                    <div className="py-3 text-center text-gray-500">No suppliers available</div>
                  ) : (
                    suppliers.map((s) => {
                      const isChecked = selectedSupplierIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2.5 p-2 rounded hover:bg-[#0A4D66]/20 cursor-pointer transition-colors"
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
                            className="rounded border-[#0A4D66] bg-[#001825] text-sky-400 focus:ring-0"
                          />
                          <span className="font-medium text-white">{s.name}</span>
                          {s.contact && (
                            <span className="text-[10px] text-gray-400">({s.contact})</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedSupplierIds.length === 0 && (
                  <p className="text-[10px] text-red-400 mt-1">Please select at least one supplier.</p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-300">
                  RFQ Notes &amp; Specifications
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide delivery requirements, quotation deadline, or terms..."
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 border border-[#0A4D66]/60 bg-[#001825] text-white focus:outline-none focus:border-sky-400 transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#0A4D66]/30">
                <button
                  type="button"
                  disabled={isSubmittingRfq}
                  onClick={() => setIsRfqModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-gray-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRfq || selectedSupplierIds.length === 0}
                  className="px-4 py-2 rounded-lg bg-[#0369A1] hover:bg-[#0369A1]/90 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
