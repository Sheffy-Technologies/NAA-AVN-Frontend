import React, { useMemo, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateRfqMutation,
  useGetRfqsQuery,
  useGetStockMovementsQuery,
  useGetSuppliersQuery,
} from "../api";
import { formatDateShort, formatTimeShort, downloadCsv, onInteractiveRowClick, onInteractiveRowKeyDown } from "../inventoryUtils";

interface ProcurementPartRequisitionsTabProps {
  onNavigateToRfq?: (rfqId: number) => void;
}

export const ProcurementPartRequisitionsTab: React.FC<ProcurementPartRequisitionsTabProps> = ({
  onNavigateToRfq,
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  // Queries & Mutations
  const {
    data: stockMovements = [],
    isLoading: isMovementsLoading,
    refetch: refetchStockMovements,
  } = useGetStockMovementsQuery();
  const {
    data: rfqs = [],
    isLoading: isRfqsLoading,
    refetch: refetchRfqs,
  } = useGetRfqsQuery();
  const { data: suppliers = [], isLoading: isSuppliersLoading } = useGetSuppliersQuery();
  const [createRfq, { isLoading: isCreatingRfq }] = useCreateRfqMutation();

  // Filter & Selection State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "rfq_created">("all");
  const [selectedPartRequisitionIds, setSelectedPartRequisitionIds] = useState<number[]>([]);
  const [selectedRfqSupplierIds, setSelectedRfqSupplierIds] = useState<number[]>([]);

  // Filter only movements with movement_type === 'issue' (parts requested by work orders)
  const partRequisitions = useMemo(() => {
    return stockMovements.filter((movement) => {
      return (movement.movement_type ?? "").toLowerCase() === "issue";
    });
  }, [stockMovements]);

  const existingRfqMovementIds = useMemo(() => {
    return new Set(rfqs.map((rfq) => rfq.stock_movement_id));
  }, [rfqs]);

  // Filtered rows based on search and status
  const filteredRows = useMemo(() => {
    return partRequisitions.filter((req) => {
      const hasRfq = existingRfqMovementIds.has(req.id);
      if (statusFilter === "pending" && hasRfq) return false;
      if (statusFilter === "rfq_created" && !hasRfq) return false;

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const reqMatch = `req #${req.id}`.toLowerCase().includes(query) || String(req.id).includes(query);
        const woMatch = req.work_order_id ? `wo #${req.work_order_id}`.toLowerCase().includes(query) : false;
        return reqMatch || woMatch;
      }
      return true;
    });
  }, [partRequisitions, existingRfqMovementIds, statusFilter, searchQuery]);

  // Handlers for selection
  const handleToggleRequisition = (id: number, checked: boolean) => {
    setSelectedPartRequisitionIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  };

  const handleSelectAllPending = (checked: boolean) => {
    if (checked) {
      const pendingIds = filteredRows
        .filter((req) => !existingRfqMovementIds.has(req.id))
        .map((req) => req.id);
      setSelectedPartRequisitionIds(pendingIds);
    } else {
      setSelectedPartRequisitionIds([]);
    }
  };

  const handleToggleSupplier = (supplierId: number) => {
    setSelectedRfqSupplierIds((prev) =>
      prev.includes(supplierId)
        ? prev.filter((id) => id !== supplierId)
        : [...prev, supplierId],
    );
  };

  // Bulk RFQ Request action
  const handleRequestRfq = async () => {
    if (selectedPartRequisitionIds.length === 0) {
      dispatch(
        showToast({
          message: "Select at least one part requisition to request an RFQ.",
          type: "error",
        }),
      );
      return;
    }

    if (selectedRfqSupplierIds.length === 0) {
      dispatch(
        showToast({
          message: "Select at least one supplier to send the RFQ to.",
          type: "error",
        }),
      );
      return;
    }

    const pendingIds = selectedPartRequisitionIds.filter(
      (id) => !existingRfqMovementIds.has(id),
    );

    if (pendingIds.length === 0) {
      dispatch(
        showToast({
          message: "All selected requisitions already have RFQs created.",
          type: "error",
        }),
      );
      return;
    }

    let successCount = 0;
    for (const stockMovementId of pendingIds) {
      try {
        await createRfq({
          stock_movement_id: stockMovementId,
          supplier_ids: selectedRfqSupplierIds,
          status: "sent",
          issued_at: new Date().toISOString(),
          notes: `Bulk RFQ requested for requisition #${stockMovementId} on ${new Date().toLocaleString()}`,
        }).unwrap();
        successCount += 1;
      } catch {
        // Continue loop
      }
    }

    if (successCount > 0) {
      dispatch(
        showToast({
          message: `RFQ successfully created and sent for ${successCount} requisition${successCount > 1 ? "s" : ""}.`,
          type: "success",
        }),
      );
      setSelectedPartRequisitionIds([]);
      refetchStockMovements();
      refetchRfqs();
    } else {
      dispatch(
        showToast({
          message: "Failed to create RFQ for selected requisitions.",
          type: "error",
        }),
      );
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Requisition ID",
      "Work Order",
      "Quantity Requested",
      "Created Date",
      "RFQ Status",
    ];
    const rows = filteredRows.map((r) => [
      `REQ #${r.id}`,
      r.work_order_id ? `WO #${r.work_order_id}` : "-",
      String(r.quantity),
      `${formatDateShort(r.created_at)} ${formatTimeShort(r.created_at)}`,
      existingRfqMovementIds.has(r.id) ? "RFQ Dispatched" : "Pending RFQ",
    ]);
    downloadCsv("part-requisitions.csv", [headers, ...rows]);
  };

  const allPendingSelected = useMemo(() => {
    const pending = filteredRows.filter((r) => !existingRfqMovementIds.has(r.id));
    return (
      pending.length > 0 &&
      pending.every((r) => selectedPartRequisitionIds.includes(r.id))
    );
  }, [filteredRows, existingRfqMovementIds, selectedPartRequisitionIds]);

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className={cn(
        "flex flex-col gap-4 p-4 rounded-xl border",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 p-1 rounded-lg border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)]">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                statusFilter === "all"
                  ? isDark
                    ? "bg-[#001825] text-white border border-[#7FD5FF]/40 shadow-xs"
                    : "bg-white text-[#0A4D66] border border-slate-200 shadow-xs"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
              )}
            >
              All Demands ({partRequisitions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                statusFilter === "pending"
                  ? isDark
                    ? "bg-[#001825] text-amber-300 border border-amber-500/40 shadow-xs"
                    : "bg-white text-amber-800 border border-slate-200 shadow-xs"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
              )}
            >
              Pending RFQ ({partRequisitions.filter((r) => !existingRfqMovementIds.has(r.id)).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("rfq_created")}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                statusFilter === "rfq_created"
                  ? isDark
                    ? "bg-[#001825] text-emerald-300 border border-emerald-500/40 shadow-xs"
                    : "bg-white text-emerald-800 border border-slate-200 shadow-xs"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
              )}
            >
              RFQ Dispatched ({partRequisitions.filter((r) => existingRfqMovementIds.has(r.id)).length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search REQ # or WO #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/40 text-white placeholder-gray-500 focus:border-[#7FD5FF]"
                  : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-sky-500",
              )}
            />
          </div>

          {/* Contextual CTAs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span className="text-slate-700 dark:text-slate-200 font-semibold">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleRequestRfq}
              disabled={
                isCreatingRfq ||
                selectedPartRequisitionIds.length === 0 ||
                selectedRfqSupplierIds.length === 0
              }
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon
                icon={isCreatingRfq ? "mdi:loading" : "mdi:send"}
                className={cn("w-4 h-4", isCreatingRfq && "animate-spin")}
              />
              <span>
                {isCreatingRfq
                  ? "Creating RFQs..."
                  : selectedPartRequisitionIds.length > 0
                    ? `Request RFQ (${selectedPartRequisitionIds.length})`
                    : "Request RFQ"}
              </span>
            </button>
          </div>
        </div>

        {/* Supplier Picker for RFQ Dispatch */}
        <div className="pt-3 border-t border-[#0A4D66]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
              Target Suppliers for RFQ Dispatch ({selectedRfqSupplierIds.length} selected)
            </span>
            <span className="text-[10px] text-[var(--theme-text-muted)]">
              Select vendors to invite to quote for the selected demands
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)] max-h-24 overflow-y-auto">
            {isSuppliersLoading ? (
              <span className="text-xs text-[var(--theme-text-muted)]">Loading suppliers...</span>
            ) : suppliers.length === 0 ? (
              <span className="text-xs text-[var(--theme-text-muted)]">No suppliers found. Add suppliers first.</span>
            ) : (
              suppliers.map((supplier) => {
                const isSelected = selectedRfqSupplierIds.includes(supplier.id);
                return (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => handleToggleSupplier(supplier.id)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors",
                      isSelected
                        ? "bg-[#0369A1] text-white font-semibold shadow-xs"
                        : isDark
                          ? "bg-[#0A4D66]/30 text-gray-200 hover:bg-[#0A4D66]/60"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300",
                    )}
                  >
                    <Icon
                      icon={isSelected ? "mdi:check-circle" : "mdi:plus-circle-outline"}
                      className="w-3.5 h-3.5"
                    />
                    <span>{supplier.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Requisitions Table */}
      <div className={cn(
        "rounded-xl border overflow-x-auto",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
              <th className="px-4 py-3 w-12 text-center">
                <input
                  type="checkbox"
                  checked={allPendingSelected}
                  onChange={(e) => handleSelectAllPending(e.target.checked)}
                  title="Select all pending requisitions"
                  className="rounded border-[#0A4D66] bg-[#001825] text-sky-400 focus:ring-0"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Demand / Ref</th>
              <th className="px-4 py-3 font-semibold">Work Order</th>
              <th className="px-4 py-3 font-semibold">Requested Qty</th>
              <th className="px-4 py-3 font-semibold">Logged Date</th>
              <th className="px-4 py-3 font-semibold">RFQ Status</th>
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
            {isMovementsLoading || isRfqsLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  Loading part requisitions...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  No part requisitions matching your filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((req) => {
                const hasRfq = existingRfqMovementIds.has(req.id);
                const isSelected = selectedPartRequisitionIds.includes(req.id);
                const linkedRfq = rfqs.find((r) => r.stock_movement_id === req.id);
                const handleRowAction = () => {
                  if (hasRfq && linkedRfq && onNavigateToRfq) {
                    onNavigateToRfq(linkedRfq.id);
                  } else if (!hasRfq) {
                    handleToggleRequisition(req.id, !isSelected);
                  }
                };

                return (
                  <tr
                    key={req.id}
                    tabIndex={0}
                    role="button"
                    title={
                      hasRfq && linkedRfq
                        ? "Click to view linked RFQ"
                        : "Click to select requisition for RFQ"
                    }
                    onClick={(e) => onInteractiveRowClick(e, handleRowAction)}
                    onKeyDown={(e) => onInteractiveRowKeyDown(e, handleRowAction)}
                    className={cn(
                      "cursor-pointer hover:bg-[#0A4D66]/20 transition-colors focus:outline-none focus:bg-[#0A4D66]/30",
                      isSelected && (isDark ? "bg-[#0A4D66]/25" : "bg-sky-50"),
                    )}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={hasRfq}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleToggleRequisition(req.id, e.target.checked)}
                        className="rounded border-[#0A4D66] bg-[#001825] text-sky-400 focus:ring-0 disabled:opacity-40"
                        title={hasRfq ? "RFQ already dispatched" : "Select requisition"}
                      />
                    </td>
                    <td className="px-4 py-3 font-bold text-[var(--theme-text-primary)]">
                      REQ #{req.id}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                      {req.work_order_id ? (
                        <span className="font-mono text-sky-400">WO #{req.work_order_id}</span>
                      ) : (
                        <span className="text-[var(--theme-text-muted)]">General</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--theme-text-primary)]">
                      {req.quantity}
                    </td>
                    <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                      {formatDateShort(req.created_at)} {formatTimeShort(req.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          hasRfq
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/30",
                        )}
                      >
                        {hasRfq ? "RFQ Dispatched" : "Pending RFQ"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasRfq && linkedRfq && onNavigateToRfq ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToRfq(linkedRfq.id);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-sky-400 text-[11px] font-semibold transition-colors"
                        >
                          <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
                          <span>View RFQ</span>
                        </button>
                      ) : !hasRfq ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPartRequisitionIds([req.id]);
                            if (selectedRfqSupplierIds.length === 0 && suppliers.length > 0) {
                              setSelectedRfqSupplierIds([suppliers[0].id]);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold transition-colors"
                        >
                          <Icon icon="mdi:checkbox-marked-outline" className="w-3.5 h-3.5" />
                          <span>Select</span>
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
