import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { MetricCard } from "@/shared/ui/metric/MetricCard";
import {
  type Shipment,
  useGetGoodsReceivedNotesQuery,
  useGetInventoriesQuery,
  useGetPurchaseOrdersQuery,
  useGetRfqsQuery,
  useGetShipmentsQuery,
  useGetStockMovementsQuery,
  useGetSupplierQuotationsQuery,
  useGetSuppliersQuery,
} from "../api";
import { onInteractiveRowClick } from "../inventoryUtils";
import { CreateShipmentModal } from "./CreateShipmentModal";
import { ShipmentDetailsModal } from "./ShipmentDetailsModal";

export type ProcurementSubTabKey =
  | "overview"
  | "pipeline"
  | "part-requisitions"
  | "quotations"
  | "purchase-orders"
  | "shipments"
  | "stock-received"
  | "stock-issued";

interface ProcurementOverviewTabProps {
  onNavigateSubTab: (subTab: ProcurementSubTabKey) => void;
  onOpenCreateRfq?: () => void;
}

export const ProcurementOverviewTab: React.FC<ProcurementOverviewTabProps> = ({
  onNavigateSubTab,
  onOpenCreateRfq,
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
  const [selectedShipmentModal, setSelectedShipmentModal] = useState<Shipment | null>(null);

  // Queries
  const { data: stockMovements = [], isLoading: isMovementsLoading } =
    useGetStockMovementsQuery();
  const { data: rfqs = [], isLoading: isRfqsLoading } = useGetRfqsQuery();
  const { data: quotations = [], isLoading: isQuotesLoading } =
    useGetSupplierQuotationsQuery();
  const { data: purchaseOrders = [], isLoading: isPosLoading } =
    useGetPurchaseOrdersQuery();
  const { data: goodsReceivedNotes = [], isLoading: isGrnLoading } =
    useGetGoodsReceivedNotesQuery();
  const { data: shipments = [] } = useGetShipmentsQuery();
  const { data: inventories = [] } = useGetInventoriesQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();

  const activeShipments = useMemo(() => {
    return shipments.filter((s) => s.status !== "delivered");
  }, [shipments]);

  // Metric Calculations
  const partRequisitions = useMemo(() => {
    return stockMovements.filter(
      (m) => (m.movement_type ?? "").toLowerCase() === "issue",
    );
  }, [stockMovements]);

  const stockIssuedCount = useMemo(() => {
    return partRequisitions.reduce((acc, m) => acc + (Number(m.quantity) || 1), 0);
  }, [partRequisitions]);

  const pendingPartRequisitions = useMemo(() => {
    // Requisitions that do not yet have an RFQ linked
    const linkedMovementIds = new Set(rfqs.map((r) => r.stock_movement_id));
    return partRequisitions.filter((r) => !linkedMovementIds.has(r.id));
  }, [partRequisitions, rfqs]);

  const quotationsPendingReview = useMemo(() => {
    return quotations.filter(
      (q) => (q.status ?? "").toLowerCase() === "submitted" || (q.status ?? "").toLowerCase() === "pending",
    );
  }, [quotations]);

  const approvedQuotations = useMemo(() => {
    return quotations.filter((q) => (q.status ?? "").toLowerCase() === "approved");
  }, [quotations]);

  const openPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(
      (po) =>
        (po.status ?? "").toLowerCase() !== "received" &&
        (po.status ?? "").toLowerCase() !== "delivered" &&
        (po.status ?? "").toLowerCase() !== "cancelled",
    );
  }, [purchaseOrders]);

  const receivedPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(
      (po) =>
        (po.status ?? "").toLowerCase() === "received" ||
        (po.status ?? "").toLowerCase() === "delivered",
    );
  }, [purchaseOrders]);

  // Combined Procurement Pipeline Snapshot Rows
  const pipelineRows = useMemo(() => {
    const rfqMap = new Map(rfqs.map((r) => [r.stock_movement_id, r]));
    const approvedQuotationByRfq = new Map<number, (typeof quotations)[0]>();
    for (const quote of quotations) {
      if ((quote.status ?? "").toLowerCase() === "approved") {
        approvedQuotationByRfq.set(quote.rfq_id, quote);
      }
    }
    const poByRfq = new Map(
      purchaseOrders
        .filter((p) => p.rfq_id)
        .map((p) => [Number(p.rfq_id), p]),
    );
    const grnByPo = new Map(
      goodsReceivedNotes.map((g) => [Number(g.purchase_order_id), g]),
    );

    return partRequisitions.slice(0, 10).map((req) => {
      const rfq = rfqMap.get(req.id);
      const approvedQuote = rfq ? approvedQuotationByRfq.get(rfq.id) : undefined;
      const po = rfq ? poByRfq.get(rfq.id) : undefined;
      const grn = po ? grnByPo.get(po.id) : undefined;

      let stageLabel = "Requisition Logged";
      let stageColor = "sky";
      if (grn) {
        stageLabel = "Stock Received (GRN Posted)";
        stageColor = "emerald";
      } else if (po) {
        stageLabel = `PO Issued (${po.status ?? "Sent"})`;
        stageColor = "teal";
      } else if (approvedQuote) {
        stageLabel = "Quotation Approved";
        stageColor = "indigo";
      } else if (rfq) {
        stageLabel = "RFQ Dispatched";
        stageColor = "amber";
      }

      return {
        req,
        rfq,
        approvedQuote,
        po,
        grn,
        stageLabel,
        stageColor,
      };
    });
  }, [partRequisitions, rfqs, quotations, purchaseOrders, goodsReceivedNotes]);

  // Critical Low Stock Alerts
  const criticalSpares = useMemo(() => {
    return inventories
      .filter((i) => {
        const cur = Number(i.current_stock) || 0;
        const reorder = Number(i.re_order_level) || 0;
        const level = (i.stock_level ?? "").toLowerCase();
        return level === "critical" || level === "out of stock" || cur <= 0 || (reorder > 0 && cur <= reorder);
      })
      .slice(0, 4);
  }, [inventories]);

  const isLoadingAny =
    isMovementsLoading || isRfqsLoading || isQuotesLoading || isPosLoading || isGrnLoading;

  return (
    <div className="space-y-6">
      {/* Header with Title and Contextual CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--theme-text-primary)]">
            Procurement Overview
          </h2>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1">
            Executive pipeline tracking: work order part demands, RFQs, vendor quotations, orders, and stock receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenCreateRfq && (
            <button
              type="button"
              onClick={onOpenCreateRfq}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--theme-border-em)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)] transition-colors"
            >
              <Icon icon="mdi:file-document-edit-outline" className="w-4 h-4 text-sky-400" />
              <span>Create RFQ</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              navigate("/dashboard/inventory/purchase-orders/new", {
                state: {
                  from: "/dashboard/inventory?tab=procurement&subtab=overview",
                  fromLabel: "Procurement Overview",
                },
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#0369A1]/90 text-white shadow-sm transition-colors"
          >
            <Icon icon="mdi:cart-plus" className="w-4 h-4" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Primary Procurement Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <MetricCard
          id="metric-part-demands"
          label="Part Demands"
          value={partRequisitions.length}
          badge={`${pendingPartRequisitions.length} pending`}
          badgeColor={pendingPartRequisitions.length > 0 ? "amber" : "neutral"}
          subtext="Demanded from Work Orders"
          icon="mdi:wrench-clock"
          onClick={() => onNavigateSubTab("part-requisitions")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-active-rfqs"
          label="Active RFQs"
          value={rfqs.length}
          badge="Sent"
          badgeColor="sky"
          subtext="Vendor inquiries"
          icon="mdi:email-fast-outline"
          onClick={() => onNavigateSubTab("quotations")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-quotes"
          label="Quotations"
          value={quotations.length}
          badge={`${quotationsPendingReview.length} to review`}
          badgeColor={quotationsPendingReview.length > 0 ? "indigo" : "neutral"}
          subtext={`${approvedQuotations.length} approved`}
          icon="mdi:cash-multiple"
          onClick={() => onNavigateSubTab("quotations")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-orders"
          label="Purchase Orders"
          value={purchaseOrders.length}
          badge={`${openPurchaseOrders.length} active`}
          badgeColor={openPurchaseOrders.length > 0 ? "emerald" : "neutral"}
          subtext={`${receivedPurchaseOrders.length} received`}
          icon="mdi:cart-outline"
          onClick={() => onNavigateSubTab("purchase-orders")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-shipments"
          label="Shipments"
          value={shipments.length}
          badge={`${activeShipments.length} active`}
          badgeColor={activeShipments.length > 0 ? "sky" : "neutral"}
          subtext="TrackingMore & AWB"
          icon="mdi:truck-fast-outline"
          onClick={() => onNavigateSubTab("shipments")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-grn"
          label="Stock Received"
          value={goodsReceivedNotes.length}
          badge="GRN Posted"
          badgeColor="teal"
          subtext="Batched into inventory"
          icon="mdi:package-check"
          onClick={() => onNavigateSubTab("stock-received")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />

        <MetricCard
          id="metric-stock-issued"
          label="Stock Issued"
          value={stockIssuedCount}
          badge="Dispatched"
          badgeColor="indigo"
          subtext="Dispatched to assets"
          icon="mdi:arrow-top-right-bold-box-outline"
          onClick={() => onNavigateSubTab("stock-issued")}
          className="cursor-pointer hover:border-[var(--theme-accent)] transition-all"
        />
      </div>


      {/* Two Column Layout: Critical Stock Attention Stream & Recent Procurement Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Actionable Alerts & Critical Items */}
        <div className="space-y-4">
          <div className={cn(
            "rounded-xl border p-4 sm:p-5",
            isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/20">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-primary)]">
                  Critical Spares Attention
                </h3>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {criticalSpares.length} Items
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {criticalSpares.length === 0 ? (
                <p className="text-xs text-[var(--theme-text-muted)] py-4 text-center">
                  All critical inventory items are stocked above reorder thresholds.
                </p>
              ) : (
                criticalSpares.map((item) => (
                  <div
                    key={item.id}
                    title="Click to view inventory item details"
                    onClick={(e) =>
                      onInteractiveRowClick(e, () =>
                        navigate(`/dashboard/inventory/${item.id}`),
                      )
                    }
                    className={cn(
                      "p-3 rounded-lg border flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors",
                      isDark ? "bg-[#001825] border-[#0A4D66]/40 hover:border-[#7FD5FF]/40 hover:bg-[#0A4D66]/20" : "bg-slate-50 border-slate-200 hover:border-sky-300 hover:bg-sky-50/60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--theme-text-primary)] truncate">
                        {item.part_number || item.description || `Item #${item.id}`}
                      </div>
                      <div className="text-[11px] text-[var(--theme-text-muted)] truncate mt-0.5">
                        Stock: <span className="font-bold text-red-400">{item.current_stock ?? 0}</span> / Min: {item.re_order_level ?? 0}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateSubTab("part-requisitions");
                      }}
                      className="px-2.5 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11px] font-semibold whitespace-nowrap"
                    >
                      Requisition
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vendors & Suppliers Snapshot */}
          <div className={cn(
            "rounded-xl border p-4 sm:p-5",
            isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/20">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:truck-delivery-outline" className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-primary)]">
                  Suppliers & Vendors
                </h3>
              </div>
              <span className="text-xs font-bold text-[var(--theme-text-primary)]">{suppliers.length} Registered</span>
            </div>

            <p className="text-xs text-[var(--theme-text-muted)] mt-3">
              Maintain qualified defence and aviation parts suppliers for RFQ dispatches, quotations, and verified order fulfillments.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard/inventory/suppliers/add")}
                className="flex-1 py-1.5 px-3 rounded text-xs font-semibold border border-[var(--theme-border-em)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)] text-center transition-colors"
              >
                + Add Supplier
              </button>
              <button
                type="button"
                onClick={() => onNavigateSubTab("quotations")}
                className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-[#0A4D66]/40 hover:bg-[#0A4D66]/60 text-[#7FD5FF] text-center transition-colors"
              >
                View RFQs
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (2 Spans): Recent Procurement Activity Pipeline */}
        <div className={cn(
          "lg:col-span-2 rounded-xl border p-4 sm:p-5 flex flex-col",
          isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#0A4D66]/20">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">
                Recent Procurement Pipeline Activity
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                End-to-end trace: Work Order Demand &rarr; RFQ &rarr; Quotation &rarr; PO &rarr; GRN
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSubTab("part-requisitions")}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View All Demands</span>
              <Icon icon="mdi:arrow-right" className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
                  <th className="px-3 py-2.5 font-semibold">Demand / Ref</th>
                  <th className="px-3 py-2.5 font-semibold">RFQ</th>
                  <th className="px-3 py-2.5 font-semibold">Quotation</th>
                  <th className="px-3 py-2.5 font-semibold">Purchase Order</th>
                  <th className="px-3 py-2.5 font-semibold">Current Stage</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
                {isLoadingAny ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                      Loading procurement pipeline records...
                    </td>
                  </tr>
                ) : pipelineRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                      No active procurement pipeline records found.
                    </td>
                  </tr>
                ) : (
                  pipelineRows.map((row) => (
                    <tr
                      key={row.req.id}
                      title="Click to view stage details"
                      onClick={(e) =>
                        onInteractiveRowClick(e, () => {
                          if (row.po) {
                            navigate(`/dashboard/inventory/purchase-orders/${row.po.id}`, {
                              state: {
                                from: "/dashboard/inventory?tab=procurement&subtab=overview",
                                fromLabel: "Procurement Overview",
                              },
                            });
                          } else if (row.rfq) {
                            navigate(`/dashboard/inventory/rfq/${row.rfq.id}`, {
                              state: {
                                from: "/dashboard/inventory?tab=procurement&subtab=overview",
                                fromLabel: "Procurement Overview",
                              },
                            });
                          } else {
                            onNavigateSubTab("part-requisitions");
                          }
                        })
                      }
                      className="hover:bg-[#0A4D66]/20 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 font-medium text-[var(--theme-text-primary)]">
                        <div>DEMAND #{row.req.id}</div>
                        {row.req.work_order_id && (
                          <div className="text-[11px] text-[var(--theme-text-muted)] font-mono">
                            WO #{row.req.work_order_id}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[var(--theme-text-secondary)]">
                        {row.rfq ? (
                          <span className="font-mono text-sky-400">
                            {row.rfq.rfq_number || `RFQ #${row.rfq.id}`}
                          </span>
                        ) : (
                          <span className="text-[var(--theme-text-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[var(--theme-text-secondary)]">
                        {row.approvedQuote ? (
                          <div>
                            <span className="font-medium text-purple-400">
                              {row.approvedQuote.quotation_number || `QT-${row.approvedQuote.id}`}
                            </span>
                            <div className="text-[10px] text-[var(--theme-text-muted)] truncate max-w-[120px]">
                              {row.approvedQuote.supplier?.name || `Vendor #${row.approvedQuote.supplier_id}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--theme-text-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[var(--theme-text-secondary)]">
                        {row.po ? (
                          <div>
                            <span className="font-mono text-emerald-400">
                              {row.po.name || `PO #${row.po.id}`}
                            </span>
                            <div className="text-[10px] text-[var(--theme-text-muted)] capitalize">
                              {row.po.status ?? "draft"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--theme-text-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          row.grn
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : row.po
                              ? "bg-teal-500/15 text-teal-300 border-teal-500/30"
                              : row.approvedQuote
                                ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                : row.rfq
                                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  : "bg-sky-500/15 text-sky-300 border-sky-500/30",
                        )}>
                          {row.stageLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.po ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/inventory/purchase-orders/${row.po?.id}`, {
                                state: {
                                  from: "/dashboard/inventory?tab=procurement&subtab=overview",
                                  fromLabel: "Procurement Overview",
                                },
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-sky-400 text-[11px] font-semibold transition-colors"
                          >
                            <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
                            <span>View PO</span>
                          </button>
                        ) : row.rfq ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/inventory/rfq/${row.rfq?.id}`, {
                                state: {
                                  from: "/dashboard/inventory?tab=procurement&subtab=overview",
                                  fromLabel: "Procurement Overview",
                                },
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-amber-400 text-[11px] font-semibold transition-colors"
                          >
                            <Icon icon="mdi:file-document-outline" className="w-3.5 h-3.5" />
                            <span>View RFQ</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateSubTab("part-requisitions");
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-sky-500/40 bg-sky-500/10 text-sky-300 text-[11px] font-semibold transition-colors"
                          >
                            <Icon icon="mdi:plus" className="w-3.5 h-3.5" />
                            <span>RFQ</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inbound Consignments Live Tracking Radar */}
      <div
        className={cn(
          "rounded-xl border p-4 sm:p-5 flex flex-col shadow-sm",
          isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200",
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#0A4D66]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-400 border border-sky-500/30">
              <Icon icon="mdi:truck-fast-outline" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">
                Inbound Consignments Live Tracking Radar
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                4-Stage Milestones: 1. Picked up &rarr; 2. Customs clearance &rarr; 3. In transit &rarr; 4. Delivered
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsCreateShipmentOpen(true)}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-3.5 h-3.5" />
              <span>Add Tracking</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateSubTab("shipments")}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1"
            >
              <span>View All ({shipments.length})</span>
              <Icon icon="mdi:arrow-right" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          {shipments.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Icon icon="mdi:truck-outline" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">No active shipments currently registered.</p>
              <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
                Register live carrier tracking with or without a purchase order (AWB, MRO core repairs, inter-base transfers).
              </p>
              <button
                type="button"
                onClick={() => setIsCreateShipmentOpen(true)}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                <span>Add Standalone Tracking (No PO)</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {shipments.slice(0, 6).map((shipment) => {
                const stageColors = {
                  picked_up: "bg-sky-500/15 text-sky-400 border-sky-500/30",
                  customs_clearance: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                  in_transit: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
                  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                };

                const isStandalone = !shipment.purchase_order_id;

                return (
                  <div
                    key={shipment.id}
                    onClick={() => {
                      if (shipment.purchase_order_id) {
                        navigate(`/dashboard/inventory/purchase-orders/${shipment.purchase_order_id}`, {
                          state: {
                            from: "/dashboard/inventory?tab=procurement&subtab=overview",
                            fromLabel: "Procurement Overview",
                          },
                        });
                      } else {
                        setSelectedShipmentModal(shipment);
                      }
                    }}
                    className={cn(
                      "p-3.5 rounded-lg border cursor-pointer hover:border-[#7FD5FF]/60 transition-all flex flex-col justify-between",
                      isDark ? "bg-[#001825] border-[#0A4D66]/30" : "bg-slate-50 border-slate-200",
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-[#0A4D66]/20">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-sky-400">
                            {shipment.tracking_number}
                          </span>
                          {isStandalone && (
                            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Standalone
                            </span>
                          )}
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", stageColors[shipment.status])}>
                          {shipment.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--theme-text-primary)] mt-2">
                        {shipment.purchase_order_id ? `PO #${shipment.purchase_order_id} • ` : "Consignment • "}
                        {shipment.title || shipment.carrier_name || "Air Freight"}
                      </p>
                      <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5 truncate">
                        {shipment.origin || "Origin"} &rarr; {shipment.destination || "Base"}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#0A4D66]/20 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">
                        {shipment.estimated_delivery_date ? `Est: ${shipment.estimated_delivery_date}` : "In Transit"}
                      </span>
                      <span className="text-sky-400 font-medium inline-flex items-center gap-0.5">
                        Track <Icon icon="mdi:chevron-right" className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Standalone / PO Shipment Creation Modal */}
      <CreateShipmentModal
        isOpen={isCreateShipmentOpen}
        initialStandalone={true}
        onClose={() => setIsCreateShipmentOpen(false)}
      />

      {/* Shipment Details & Timeline Modal */}
      <ShipmentDetailsModal
        isOpen={!!selectedShipmentModal}
        shipment={selectedShipmentModal}
        onClose={() => setSelectedShipmentModal(null)}
      />
    </div>
  );
};
