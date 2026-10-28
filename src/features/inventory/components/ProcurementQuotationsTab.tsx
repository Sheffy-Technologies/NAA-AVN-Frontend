import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useApproveSupplierQuotationMutation,
  useCreateRfqMutation,
  useCreateSupplierQuotationMutation,
  useGetRfqsQuery,
  useGetStockMovementsQuery,
  useGetSupplierQuotationsQuery,
  useGetSuppliersQuery,
  type SupplierQuotation,
} from "../api";
import { formatDateShort, formatTimeShort, downloadCsv, onInteractiveRowClick } from "../inventoryUtils";

export const ProcurementQuotationsTab: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Active view: either RFQs or Quotations (default RFQs first)
  const [viewSection, setViewSection] = useState<"rfqs" | "quotations">("rfqs");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");

  // Modal States
  const [isCreateRfqOpen, setIsCreateRfqOpen] = useState(false);
  const [isRecordQuoteOpen, setIsRecordQuoteOpen] = useState(false);

  // Queries
  const {
    data: quotations = [],
    isLoading: isQuotesLoading,
    refetch: refetchQuotations,
  } = useGetSupplierQuotationsQuery();
  const {
    data: rfqs = [],
    isLoading: isRfqsLoading,
    refetch: refetchRfqs,
  } = useGetRfqsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: stockMovements = [] } = useGetStockMovementsQuery();

  // Mutations
  const [approveQuotation, { isLoading: isApprovingQuote }] =
    useApproveSupplierQuotationMutation();
  const [createRfq, { isLoading: isSubmittingRfq }] = useCreateRfqMutation();
  const [createSupplierQuotation, { isLoading: isSubmittingQuote }] =
    useCreateSupplierQuotationMutation();

  // Create RFQ Form State
  const [rfqForm, setRfqForm] = useState({
    stock_movement_id: "",
    supplier_ids: [] as number[],
    notes: "",
  });

  // Record Quotation Form State
  const [quoteForm, setQuoteForm] = useState({
    rfq_id: "",
    supplier_id: "",
    quotation_number: "",
    total_amount: "",
    currency: "NGN",
    valid_until: "",
    notes: "",
  });

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const status = (q.status ?? "").toLowerCase();
      if (statusFilter === "pending" && status === "approved") return false;
      if (statusFilter === "approved" && status !== "approved") return false;

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const quoteNumMatch = (q.quotation_number ?? "").toLowerCase().includes(query);
        const supplierMatch = (q.supplier?.name ?? "").toLowerCase().includes(query);
        const rfqMatch = `rfq #${q.rfq_id}`.toLowerCase().includes(query);
        return quoteNumMatch || supplierMatch || rfqMatch;
      }
      return true;
    });
  }, [quotations, statusFilter, searchQuery]);

  // Filtered RFQs
  const filteredRfqs = useMemo(() => {
    return rfqs.filter((r) => {
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const numMatch = (r.rfq_number ?? "").toLowerCase().includes(query);
        const reqMatch = `req #${r.stock_movement_id}`.toLowerCase().includes(query);
        return numMatch || reqMatch;
      }
      return true;
    });
  }, [rfqs, searchQuery]);

  // Handle Approve Quotation
  const handleApproveQuote = async (quote: SupplierQuotation) => {
    if (!window.confirm(`Approve quotation ${quote.quotation_number || `#${quote.id}`} from ${quote.supplier?.name || "supplier"}?`)) {
      return;
    }
    try {
      await approveQuotation(quote.id).unwrap();
      dispatch(
        showToast({
          message: "Quotation approved successfully. You may now create a Purchase Order.",
          type: "success",
        }),
      );
      refetchQuotations();
      refetchRfqs();
    } catch {
      dispatch(showToast({ message: "Failed to approve quotation.", type: "error" }));
    }
  };

  // Handle Submit New RFQ
  const handleSubmitRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    const movementId = Number(rfqForm.stock_movement_id);
    if (!movementId) {
      dispatch(showToast({ message: "Select a part demand requisition.", type: "error" }));
      return;
    }
    if (rfqForm.supplier_ids.length === 0) {
      dispatch(showToast({ message: "Select at least one supplier.", type: "error" }));
      return;
    }

    try {
      await createRfq({
        stock_movement_id: movementId,
        supplier_ids: rfqForm.supplier_ids,
        status: "sent",
        issued_at: new Date().toISOString(),
        notes: rfqForm.notes || null,
      }).unwrap();

      dispatch(showToast({ message: "RFQ created and dispatched successfully.", type: "success" }));
      setIsCreateRfqOpen(false);
      setRfqForm({ stock_movement_id: "", supplier_ids: [], notes: "" });
      refetchRfqs();
    } catch {
      dispatch(showToast({ message: "Failed to create RFQ.", type: "error" }));
    }
  };

  // Handle Submit Record Quotation
  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const rfqId = Number(quoteForm.rfq_id);
    const supplierId = Number(quoteForm.supplier_id);
    const amount = Number(quoteForm.total_amount);

    if (!rfqId) {
      dispatch(showToast({ message: "Select a linked RFQ.", type: "error" }));
      return;
    }
    if (!supplierId) {
      dispatch(showToast({ message: "Select the supplier submitting the quotation.", type: "error" }));
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      dispatch(showToast({ message: "Enter a valid positive quotation amount.", type: "error" }));
      return;
    }

    try {
      await createSupplierQuotation({
        rfq_id: rfqId,
        supplier_id: supplierId,
        quotation_number: quoteForm.quotation_number || `QT-${Date.now().toString().slice(-6)}`,
        total_amount: amount,
        currency: quoteForm.currency || "NGN",
        valid_until: quoteForm.valid_until || null,
        notes: quoteForm.notes || null,
      }).unwrap();

      dispatch(showToast({ message: "Supplier quotation recorded successfully.", type: "success" }));
      setIsRecordQuoteOpen(false);
      setQuoteForm({
        rfq_id: "",
        supplier_id: "",
        quotation_number: "",
        total_amount: "",
        currency: "NGN",
        valid_until: "",
        notes: "",
      });
      refetchQuotations();
      refetchRfqs();
    } catch {
      dispatch(showToast({ message: "Failed to record quotation.", type: "error" }));
    }
  };

  // CSV Exports
  const handleExportQuotationsCsv = () => {
    const headers = ["Quote #", "Supplier", "Linked RFQ", "Amount", "Currency", "Valid Until", "Status"];
    const rows = filteredQuotations.map((q) => [
      q.quotation_number || `QT-${q.id}`,
      q.supplier?.name || `Supplier #${q.supplier_id}`,
      `RFQ #${q.rfq_id}`,
      String(q.total_amount ?? 0),
      q.currency || "NGN",
      formatDateShort(q.valid_until),
      q.status || "Submitted",
    ]);
    downloadCsv("supplier-quotations.csv", [headers, ...rows]);
  };

  const handleExportRfqsCsv = () => {
    const headers = ["RFQ #", "Requisition Ref", "Date Issued", "Suppliers Invited", "Status"];
    const rows = filteredRfqs.map((r) => [
      r.rfq_number || `RFQ #${r.id}`,
      `REQ #${r.stock_movement_id}`,
      `${formatDateShort(r.issued_at)} ${formatTimeShort(r.issued_at)}`,
      String(r.suppliers?.length ?? 0),
      r.status || "Sent",
    ]);
    downloadCsv("rfqs.csv", [headers, ...rows]);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Contextual CTA Bar */}
      <div className={cn(
        "flex flex-col gap-4 p-4 rounded-xl border",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* View Toggle: RFQs vs Quotations (RFQs first) */}
          <div className="flex items-center space-x-1 p-1 rounded-lg border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)]">
            <button
              type="button"
              onClick={() => setViewSection("rfqs")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition-all",
                viewSection === "rfqs"
                  ? isDark
                    ? "bg-[#001825] text-sky-300 border border-sky-500/40 shadow-xs"
                    : "bg-white text-sky-800 border border-slate-200 shadow-xs"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
              )}
            >
              <Icon icon="mdi:file-document-edit-outline" className="w-4 h-4" />
              <span>Requests for Quotations ({rfqs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewSection("quotations")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition-all",
                viewSection === "quotations"
                  ? isDark
                    ? "bg-[#001825] text-purple-300 border border-purple-500/40 shadow-xs"
                    : "bg-white text-purple-800 border border-slate-200 shadow-xs"
                  : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
              )}
            >
              <Icon icon="mdi:cash-multiple" className="w-4 h-4" />
              <span>Supplier Quotations ({quotations.length})</span>
            </button>
          </div>

          {/* Status Filter for Quotations */}
          {viewSection === "quotations" && (
            <div className="flex items-center space-x-1 p-1 rounded-lg border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)]">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-semibold transition-all",
                  statusFilter === "all"
                    ? isDark
                      ? "bg-[#001825] text-white border border-[#7FD5FF]/40 shadow-xs"
                      : "bg-white text-[#0A4D66] border border-slate-200 shadow-xs"
                    : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
                )}
              >
                All ({quotations.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-semibold transition-all",
                  statusFilter === "pending"
                    ? isDark
                      ? "bg-[#001825] text-amber-300 border border-amber-500/40 shadow-xs"
                      : "bg-white text-amber-800 border border-slate-200 shadow-xs"
                    : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
                )}
              >
                To Review ({quotations.filter((q) => (q.status ?? "").toLowerCase() !== "approved").length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("approved")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-semibold transition-all",
                  statusFilter === "approved"
                    ? isDark
                      ? "bg-[#001825] text-emerald-300 border border-emerald-500/40 shadow-xs"
                      : "bg-white text-emerald-800 border border-slate-200 shadow-xs"
                    : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]",
                )}
              >
                Approved ({quotations.filter((q) => (q.status ?? "").toLowerCase() === "approved").length})
              </button>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-muted)]"
            />
            <input
              type="text"
              placeholder={
                viewSection === "quotations"
                  ? "Search Quote # or Supplier..."
                  : "Search RFQ # or REQ #..."
              }
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
              onClick={viewSection === "quotations" ? handleExportQuotationsCsv : handleExportRfqsCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <Icon icon="mdi:download" className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span className="text-slate-700 dark:text-slate-200 font-semibold">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateRfqOpen(true)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                viewSection === "rfqs"
                  ? "bg-[#0369A1] hover:bg-[#0369A1]/90 text-white font-bold shadow-sm"
                  : "border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300",
              )}
            >
              <Icon icon="mdi:email-fast-outline" className="w-4 h-4" />
              <span>Create RFQ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuoteForm((prev) => ({ ...prev, rfq_id: "" }));
                setIsRecordQuoteOpen(true);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                viewSection === "quotations"
                  ? "bg-[#0369A1] hover:bg-[#0369A1]/90 text-white font-bold shadow-sm"
                  : "border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300",
              )}
            >
              <Icon icon="mdi:receipt-text-plus" className="w-4 h-4" />
              <span>Record Quotation</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: SUPPLIER QUOTATIONS TABLE */}
      {viewSection === "quotations" && (
        <div className={cn(
          "rounded-xl border overflow-x-auto",
          isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
        )}>
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
                <th className="px-4 py-3 font-semibold">Quotation Ref</th>
                <th className="px-4 py-3 font-semibold">Supplier / Vendor</th>
                <th className="px-4 py-3 font-semibold">Linked RFQ</th>
                <th className="px-4 py-3 font-semibold">Total Amount</th>
                <th className="px-4 py-3 font-semibold">Valid Until</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
              {isQuotesLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                    Loading supplier quotations...
                  </td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                    No supplier quotations recorded yet. Click "Record Quotation" to enter an incoming bid.
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quote) => {
                  const isApproved = (quote.status ?? "").toLowerCase() === "approved";
                  return (
                    <tr
                      key={quote.id}
                      title="Click to view linked RFQ and bids"
                      onClick={(e) =>
                        onInteractiveRowClick(e, () =>
                          navigate(`/dashboard/inventory/rfq/${quote.rfq_id}`, {
                            state: { from: "/dashboard/inventory?tab=procurement&subtab=quotations", fromLabel: "Quotations" },
                          }),
                        )
                      }
                      className="hover:bg-[#0A4D66]/20 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-[var(--theme-text-primary)]">
                        {quote.quotation_number || `QT-${quote.id}`}
                      </td>
                      <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                        <div className="font-semibold text-[var(--theme-text-primary)]">
                          {quote.supplier?.name || `Vendor #${quote.supplier_id}`}
                        </div>
                        {quote.supplier?.contact && (
                          <div className="text-[11px] text-[var(--theme-text-muted)]">
                            {quote.supplier.contact}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/inventory/rfq/${quote.rfq_id}`, {
                              state: { from: "/dashboard/inventory?tab=procurement&subtab=quotations", fromLabel: "Quotations" },
                            });
                          }}
                          className="font-mono text-sky-400 hover:underline"
                        >
                          RFQ #{quote.rfq_id}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--theme-text-primary)]">
                        {quote.currency || "NGN"} {Number(quote.total_amount ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                        {formatDateShort(quote.valid_until)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            isApproved
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-purple-500/15 text-purple-300 border-purple-500/30",
                          )}
                        >
                          {isApproved ? "Approved" : "Awaiting Review"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isApproved ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveQuote(quote);
                              }}
                              disabled={isApprovingQuote}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold transition-colors disabled:opacity-50"
                            >
                              <Icon icon="mdi:check-circle" className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const params = new URLSearchParams({
                                  rfq_id: String(quote.rfq_id),
                                  bid_id: String(quote.id),
                                  supplier_id: String(quote.supplier_id),
                                  unit_price: String(quote.total_amount ?? ""),
                                });
                                navigate(`/dashboard/inventory/purchase-orders/new?${params.toString()}`, {
                                  state: {
                                    from: "/dashboard/inventory?tab=procurement&subtab=quotations",
                                    fromLabel: "Quotations",
                                  },
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0369A1] hover:bg-[#0369A1]/90 text-white text-[11px] font-bold shadow-xs transition-colors"
                            >
                              <Icon icon="mdi:cart-plus" className="w-3.5 h-3.5" />
                              <span>Create PO</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/inventory/rfq/${quote.rfq_id}`, {
                                state: { from: "/dashboard/inventory?tab=procurement&subtab=quotations", fromLabel: "Quotations" },
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-sky-400 text-[11px] font-semibold transition-colors"
                            title="View RFQ details"
                          >
                            <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
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

      {/* SECTION 2: REQUESTS FOR QUOTATION (RFQS) TABLE */}
      {viewSection === "rfqs" && (
        <div className={cn(
          "rounded-xl border overflow-x-auto",
          isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
        )}>
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
                <th className="px-4 py-3 font-semibold">RFQ Reference</th>
                <th className="px-4 py-3 font-semibold">Demand / Work Order</th>
                <th className="px-4 py-3 font-semibold">Issued Date</th>
                <th className="px-4 py-3 font-semibold">Invited Vendors</th>
                <th className="px-4 py-3 font-semibold">Quotes Received</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
              {isRfqsLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                    Loading RFQs...
                  </td>
                </tr>
              ) : filteredRfqs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                    No RFQs found. Click "Create RFQ" to solicit vendor quotes.
                  </td>
                </tr>
              ) : (
                filteredRfqs.map((rfq) => {
                  const quoteCount = quotations.filter((q) => q.rfq_id === rfq.id).length;
                  const hasApprovedQuote = quotations.some(
                    (q) => q.rfq_id === rfq.id && (q.status ?? "").toLowerCase() === "approved",
                  );

                  return (
                    <tr
                      key={rfq.id}
                      title="Click to view RFQ details"
                      onClick={(e) =>
                        onInteractiveRowClick(e, () =>
                          navigate(`/dashboard/inventory/rfq/${rfq.id}`, {
                            state: { from: "/dashboard/inventory?tab=procurement&subtab=quotations", fromLabel: "Quotations" },
                          }),
                        )
                      }
                      className="hover:bg-[#0A4D66]/20 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-sky-400 font-mono">
                        {rfq.rfq_number || `RFQ #${rfq.id}`}
                      </td>
                      <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                        <span className="font-mono text-[var(--theme-text-primary)]">
                          REQ #{rfq.stock_movement_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                        {formatDateShort(rfq.issued_at)} {formatTimeShort(rfq.issued_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--theme-text-primary)]">
                        {rfq.suppliers?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--theme-text-primary)]">
                        <span className="text-purple-400">{quoteCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            hasApprovedQuote
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-sky-500/15 text-sky-300 border-sky-500/30",
                          )}
                        >
                          {hasApprovedQuote ? "Quotation Approved" : "Awaiting Quotations"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuoteForm((prev) => ({ ...prev, rfq_id: String(rfq.id) }));
                              setIsRecordQuoteOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-semibold transition-colors"
                          >
                            <Icon icon="mdi:plus" className="w-3.5 h-3.5" />
                            <span>Add Quote</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/inventory/rfq/${rfq.id}`, {
                                state: { from: "/dashboard/inventory?tab=procurement&subtab=quotations", fromLabel: "Quotations" },
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-sky-400 text-[11px] font-semibold transition-colors"
                          >
                            <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
                            <span>Details</span>
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

      {/* MODAL 1: CREATE RFQ */}
      {isCreateRfqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={cn(
            "w-full max-w-lg rounded-xl border p-6 shadow-xl space-y-4",
            isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-800",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:email-fast-outline" className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm text-[var(--theme-text-primary)]">
                  Create Request for Quotation (RFQ)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateRfqOpen(false)}
                className="text-[var(--theme-text-muted)] hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRfq} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Select Part Demand Requisition *
                </label>
                <select
                  value={rfqForm.stock_movement_id}
                  onChange={(e) =>
                    setRfqForm((prev) => ({ ...prev, stock_movement_id: e.target.value }))
                  }
                  required
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                >
                  <option value="">-- Choose Part Requisition --</option>
                  {stockMovements
                    .filter((m) => (m.movement_type ?? "").toLowerCase() === "issue")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        REQ #{m.id} {m.work_order_id ? `(WO #${m.work_order_id})` : ""} - Qty: {m.quantity}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Select Suppliers to Solicit * ({rfqForm.supplier_ids.length} selected)
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#0A4D66]/40 p-2 space-y-1 bg-[#001825]/50">
                  {suppliers.map((s) => {
                    const isChecked = rfqForm.supplier_ids.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-[#0A4D66]/20 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setRfqForm((prev) => ({
                              ...prev,
                              supplier_ids: e.target.checked
                                ? [...prev.supplier_ids, s.id]
                                : prev.supplier_ids.filter((id) => id !== s.id),
                            }));
                          }}
                          className="rounded border-[#0A4D66] bg-[#001825] text-sky-400 focus:ring-0"
                        />
                        <span className="text-[var(--theme-text-primary)] font-medium">{s.name}</span>
                        {s.contact && (
                          <span className="text-[10px] text-[var(--theme-text-muted)]">({s.contact})</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  RFQ Notes / Specification
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide delivery requirements or terms..."
                  value={rfqForm.notes}
                  onChange={(e) => setRfqForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#0A4D66]/20">
                <button
                  type="button"
                  onClick={() => setIsCreateRfqOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--theme-border-em)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRfq}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmittingRfq ? "Creating RFQ..." : "Dispatch RFQ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD SUPPLIER QUOTATION */}
      {isRecordQuoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={cn(
            "w-full max-w-lg rounded-xl border p-6 shadow-xl space-y-4",
            isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-800",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:receipt-text-plus" className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm text-[var(--theme-text-primary)]">
                  Record Incoming Supplier Quotation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordQuoteOpen(false)}
                className="text-[var(--theme-text-muted)] hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuotation} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                    Linked RFQ *
                  </label>
                  <select
                    value={quoteForm.rfq_id}
                    onChange={(e) =>
                      setQuoteForm((prev) => ({ ...prev, rfq_id: e.target.value }))
                    }
                    required
                    className={cn(
                      "w-full rounded-lg px-3 py-2 border focus:outline-none",
                      isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                    )}
                  >
                    <option value="">-- Choose RFQ --</option>
                    {rfqs.map((rfq) => (
                      <option key={rfq.id} value={rfq.id}>
                        {rfq.rfq_number || `RFQ #${rfq.id}`} (REQ #{rfq.stock_movement_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                    Supplier / Vendor *
                  </label>
                  <select
                    value={quoteForm.supplier_id}
                    onChange={(e) =>
                      setQuoteForm((prev) => ({ ...prev, supplier_id: e.target.value }))
                    }
                    required
                    className={cn(
                      "w-full rounded-lg px-3 py-2 border focus:outline-none",
                      isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                    )}
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                    Quotation Number / Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. QT-2026-0081"
                    value={quoteForm.quotation_number}
                    onChange={(e) =>
                      setQuoteForm((prev) => ({ ...prev, quotation_number: e.target.value }))
                    }
                    className={cn(
                      "w-full rounded-lg px-3 py-2 border focus:outline-none",
                      isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                    )}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                    Total Quoted Amount *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={quoteForm.total_amount}
                      onChange={(e) =>
                        setQuoteForm((prev) => ({ ...prev, total_amount: e.target.value }))
                      }
                      required
                      className={cn(
                        "flex-1 rounded-lg px-3 py-2 border focus:outline-none font-mono",
                        isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                      )}
                    />
                    <select
                      value={quoteForm.currency}
                      onChange={(e) =>
                        setQuoteForm((prev) => ({ ...prev, currency: e.target.value }))
                      }
                      className={cn(
                        "w-20 rounded-lg px-2 py-2 border focus:outline-none font-semibold",
                        isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                      )}
                    >
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Quotation Valid Until
                </label>
                <input
                  type="date"
                  value={quoteForm.valid_until}
                  onChange={(e) =>
                    setQuoteForm((prev) => ({ ...prev, valid_until: e.target.value }))
                  }
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Notes / Payment Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 50% advance, delivery within 14 days..."
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#0A4D66]/20">
                <button
                  type="button"
                  onClick={() => setIsRecordQuoteOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--theme-border-em)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuote}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmittingQuote ? "Saving..." : "Record Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
