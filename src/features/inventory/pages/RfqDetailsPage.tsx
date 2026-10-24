import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import { useTheme } from "@/context/ThemeContext";
import { BackButton } from "@/shared/ui/button/BackButton";
import {
  useGetRfqsQuery,
  useGetSupplierQuotationsQuery,
  useGetSuppliersQuery,
  useCreateSupplierQuotationMutation,
  useApproveSupplierQuotationMutation,
} from "@/features/inventory/api";
import { RfqPrintDocument } from "../components/RfqPrintDocument";
import { buildRfqDocument } from "../procurementDocuments";
import { exportNaavnExcel } from "@/shared/documents/naavnExcel";
import { sanitizeDocumentFileName } from "@/shared/documents/naavnDocument";

const ALL_SUPPLIERS = "all";

const formatDateShort = (isoString: string | null | undefined) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTimeShort = (isoString: string | null | undefined) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatNaira = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/[₦,]/g, ""));
  if (Number.isNaN(numeric)) return String(value);
  return `₦${numeric.toLocaleString()}`;
};

export function RfqDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();

  const { data: rfqsData = [], isLoading: isRfqLoading } = useGetRfqsQuery();
  const rfq = useMemo(
    () => rfqsData.find((r) => String(r.id) === String(id)) ?? null,
    [rfqsData, id],
  );

  const { data: quotationsData = [], refetch: refetchQuotations } =
    useGetSupplierQuotationsQuery(id ? { rfq_id: Number(id) } : undefined);

  const { data: suppliersData = [] } = useGetSuppliersQuery();

  const [createSupplierQuotation, { isLoading: isCreatingQuotation }] =
    useCreateSupplierQuotationMutation();
  const [approveSupplierQuotation, { isLoading: isApprovingQuotation }] =
    useApproveSupplierQuotationMutation();

  // Quotation form state
  const [quotationSupplierId, setQuotationSupplierId] = useState<number | "">("");
  const [quotationNumber, setQuotationNumber] = useState("");
  const [quotationAmount, setQuotationAmount] = useState("");
  const [quotationCurrency, setQuotationCurrency] = useState("NGN");
  const [quotationValidUntil, setQuotationValidUntil] = useState("");
  const [quotationNotes, setQuotationNotes] = useState("");
  const [quotationFormError, setQuotationFormError] = useState<string | null>(null);

  // Which invited supplier the exported RFQ form is addressed to ("" = first supplier).
  const [exportSupplierId, setExportSupplierId] = useState<string>("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const sortedQuotations = useMemo(
    () =>
      [...quotationsData].sort((a, b) => {
        const aApproved = (a.status ?? "").toLowerCase() === "approved";
        const bApproved = (b.status ?? "").toLowerCase() === "approved";
        if (aApproved && !bApproved) return -1;
        if (!aApproved && bApproved) return 1;
        return b.id - a.id;
      }),
    [quotationsData],
  );

  const approvedQuotation = useMemo(
    () => sortedQuotations.find((q) => (q.status ?? "").toLowerCase() === "approved") ?? null,
    [sortedQuotations],
  );

  const selectableSuppliers = rfq?.suppliers?.length ? rfq.suppliers : suppliersData;

  const resetQuotationForm = () => {
    setQuotationSupplierId("");
    setQuotationNumber("");
    setQuotationAmount("");
    setQuotationCurrency("NGN");
    setQuotationValidUntil("");
    setQuotationNotes("");
    setQuotationFormError(null);
  };

  const handleSubmitQuotation = async () => {
    setQuotationFormError(null);

    const supplierId = Number(quotationSupplierId);
    if (!supplierId || Number.isNaN(supplierId)) {
      setQuotationFormError("Select a supplier for this quotation.");
      return;
    }

    const parsedAmount = Number(quotationAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setQuotationFormError("Enter a valid quotation amount greater than zero.");
      return;
    }

    try {
      await createSupplierQuotation({
        rfq_id: Number(id),
        supplier_id: supplierId,
        quotation_number: quotationNumber.trim() || null,
        total_amount: parsedAmount,
        currency: quotationCurrency.trim() || "NGN",
        valid_until: quotationValidUntil || null,
        status: "submitted",
        notes: quotationNotes.trim() || null,
        quoted_at: new Date().toISOString(),
      }).unwrap();

      dispatch(showToast({ message: "Supplier quotation submitted.", type: "success" }));
      resetQuotationForm();
      refetchQuotations();
    } catch {
      setQuotationFormError("Failed to submit supplier quotation.");
    }
  };

  const handleApproveQuotation = async (quotationId: number) => {
    try {
      await approveSupplierQuotation(quotationId).unwrap();
      dispatch(showToast({ message: "Quotation approved.", type: "success" }));
      refetchQuotations();
    } catch {
      dispatch(showToast({ message: "Failed to approve quotation.", type: "error" }));
    }
  };

  const handleExportExcel = async () => {
    if (!rfq || isExportingExcel) return;

    const invited = rfq.suppliers ?? [];
    const selected =
      invited.find((supplier) => String(supplier.id) === exportSupplierId) ?? invited[0] ?? null;
    const addressees = exportSupplierId === ALL_SUPPLIERS && invited.length > 0 ? invited : [selected];
    const documents = addressees.map((supplier) => buildRfqDocument(rfq, supplier));
    const fileName = sanitizeDocumentFileName(
      `RFQ ${rfq.rfq_number || rfq.id}${addressees.length === 1 && addressees[0] ? ` ${addressees[0].name}` : ""}`,
    );

    setIsExportingExcel(true);
    try {
      await exportNaavnExcel(documents, fileName);
      dispatch(showToast({ message: "Excel downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download Excel", type: "error" }));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleCreatePO = () => {
    const params = new URLSearchParams();
    if (id) params.set("rfq_id", id);
    if (approvedQuotation) params.set("bid_id", String(approvedQuotation.id));
    navigate(`/dashboard/inventory/purchase-orders/new?${params.toString()}`);
  };

  const printDocumentRef = useRef<HTMLDivElement | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!printDocumentRef.current || !rfq || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: printDocumentRef.current,
        fileName: `NAAVN-005_RFQ_${rfq.rfq_number || rfq.id}`,
        backgroundColor: "#ffffff",
      });
      dispatch(
        showToast({
          message: "RFQ Document (NAAVN-005) downloaded successfully",
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({ message: "Failed to download RFQ PDF", type: "error" }),
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isRfqLoading) {
    return (
      <div className={cn("flex items-center justify-center py-24", isDark ? "text-slate-400" : "text-slate-500")}>
        <div className="animate-spin h-7 w-7 border-2 border-sky-500 border-t-transparent rounded-full mr-3" />
        <span className="text-sm font-medium">Loading RFQ specifications...</span>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-24 gap-4", isDark ? "text-slate-400" : "text-slate-500")}>
        <div className={cn("p-4 rounded-2xl border", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-slate-500" : "bg-white border-slate-200 text-slate-400")}>
          <Icon icon="mdi:file-question-outline" className="w-12 h-12" />
        </div>
        <p className={cn("text-lg font-semibold", isDark ? "text-white" : "text-slate-900")}>RFQ Record Not Found</p>
        <Link
          to="/dashboard/inventory"
          state={{ inventoryTab: "Parts Requisitions" }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-sky-500 hover:text-sky-400 transition-colors"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          Return to Inventory Management
        </Link>
      </div>
    );
  }

  const isRfqClosed = rfq.status === "closed";
  const isRfqCancelled = rfq.status === "cancelled";

  return (
    <div className="space-y-6">
      {/* Executive Command Header */}
      <div className={cn(
        "p-6 rounded-2xl border transition-all duration-200 shadow-sm",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <BackButton fallbackUrl="/dashboard/inventory" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  Procurement RFQ • NAAVN-005
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                  isRfqClosed
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : isRfqCancelled
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isRfqClosed ? "bg-emerald-400" : isRfqCancelled ? "bg-red-400" : "bg-amber-400 animate-pulse"
                  )} />
                  {rfq.status ?? "open"}
                </span>
              </div>
              <h1 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                {rfq.rfq_number || `RFQ #${rfq.id}`}
              </h1>
              <p className={cn("text-xs mt-1 flex flex-wrap items-center gap-3", isDark ? "text-slate-400" : "text-slate-500")}>
                <span>Requisition Ref: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>REQ #{rfq.stock_movement_id}</strong></span>
                <span>•</span>
                <span>Issued: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{formatDateShort(rfq.issued_at)} {formatTimeShort(rfq.issued_at)}</strong></span>
                <span>•</span>
                <span>Submissions: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{sortedQuotations.length} quotes</strong></span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm",
                isDark 
                  ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200" 
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
              )}
            >
              <Icon icon="mdi:file-document-outline" className="w-4 h-4 text-sky-500" />
              Preview Document
            </button>

            {(rfq.suppliers?.length ?? 0) > 1 && (
              <select
                value={exportSupplierId}
                onChange={(e) => setExportSupplierId(e.target.value)}
                title="Supplier the exported RFQ spreadsheet is addressed to"
                className={cn(
                  "px-3 py-2 rounded-xl border text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-slate-200"
                    : "bg-white border-slate-300 text-slate-700"
                )}
              >
                {rfq.suppliers?.map((supplier, index) => (
                  <option key={supplier.id} value={index === 0 ? "" : String(supplier.id)}>
                    Attn: {supplier.name}
                  </option>
                ))}
                <option value={ALL_SUPPLIERS}>All suppliers (one sheet each)</option>
              </select>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm disabled:opacity-50",
                isDark
                  ? "bg-[#001825] hover:bg-slate-800 border-emerald-500/30 text-emerald-400"
                  : "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700"
              )}
            >
              <Icon
                icon={isExportingExcel ? "mdi:loading" : "mdi:file-excel-outline"}
                className={cn("w-4 h-4", isExportingExcel && "animate-spin")}
              />
              {isExportingExcel ? "Exporting..." : "Excel"}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm disabled:opacity-50",
                isDark
                  ? "bg-[#001825] hover:bg-slate-800 border-red-500/30 text-red-400"
                  : "bg-red-50 hover:bg-red-100 border-red-300 text-red-700"
              )}
            >
              <Icon
                icon={isDownloadingPdf ? "mdi:loading" : "mdi:file-pdf-box"}
                className={cn("w-4 h-4", isDownloadingPdf && "animate-spin")}
              />
              {isDownloadingPdf ? "Generating..." : "PDF"}
            </button>

            <button
              type="button"
              onClick={handleCreatePO}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-900/30 transition-all"
            >
              <Icon icon="mdi:cart-plus" className="w-4 h-4" />
              Create Purchase Order
            </button>
          </div>
        </div>
      </div>

      {/* 4-Column Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RFQ Status */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-medium uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Procurement Status
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Icon icon="mdi:clipboard-text-clock-outline" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn("text-lg font-bold capitalize", isDark ? "text-white" : "text-slate-900")}>
              {rfq.status ?? "open"}
            </span>
            <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
              REQ #{rfq.stock_movement_id}
            </span>
          </div>
        </div>

        {/* Issuance Date */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-medium uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Issuance Date
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Icon icon="mdi:calendar-clock" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>
              {formatDateShort(rfq.issued_at)}
            </span>
            <div className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
              {formatTimeShort(rfq.issued_at)}
            </div>
          </div>
        </div>

        {/* Invited Suppliers */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-medium uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Invited Vendors
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Icon icon="mdi:domain" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>
              {rfq.suppliers?.length ?? 0}
            </span>
            <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
              Suppliers Solicited
            </span>
          </div>
        </div>

        {/* Approved Bid Summary */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          approvedQuotation 
            ? (isDark ? "bg-emerald-950/20 border-emerald-500/30" : "bg-emerald-50/70 border-emerald-200")
            : (isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200")
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-medium uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Approved Quotation
            </span>
            <div className={cn("p-2 rounded-xl", approvedQuotation ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>
              <Icon icon={approvedQuotation ? "mdi:check-decagram" : "mdi:timer-sand"} className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            {approvedQuotation ? (
              <>
                <span className="text-lg font-bold text-emerald-500">
                  {formatNaira(approvedQuotation.total_amount)}
                </span>
                <div className={cn("text-xs truncate font-medium", isDark ? "text-emerald-300" : "text-emerald-700")}>
                  {approvedQuotation.supplier?.name}
                </div>
              </>
            ) : (
              <>
                <span className={cn("text-sm font-semibold", isDark ? "text-amber-400" : "text-amber-600")}>
                  Pending Approval
                </span>
                <div className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {sortedQuotations.length} quote(s) awaiting review
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invited Suppliers Chip Bar */}
      {(rfq.suppliers?.length ?? 0) > 0 && (
        <div className={cn(
          "p-5 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="mdi:truck-delivery-outline" className="w-4 h-4 text-sky-500" />
            <h3 className={cn("text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-300" : "text-slate-700")}>
              Invited Suppliers ({rfq.suppliers?.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {rfq.suppliers?.map((supplier) => (
              <span
                key={supplier.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-xs transition-colors",
                  isDark
                    ? "border-[#0A4D66]/60 bg-[#001825] text-slate-200"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                )}
              >
                <Icon icon="mdi:domain" className="w-3.5 h-3.5 text-sky-500" />
                {supplier.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Approved quotation notice banner */}
      {approvedQuotation && (
        <div className={cn(
          "rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all shadow-sm",
          isDark 
            ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 to-slate-900/60" 
            : "border-emerald-200 bg-gradient-to-r from-emerald-50 to-slate-50"
        )}>
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
              <Icon icon="mdi:check-circle-outline" className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", isDark ? "text-emerald-300" : "text-emerald-800")}>
                  Winning Quotation Selected
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Approved
                </span>
              </div>
              <div className={cn("text-xs mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                Vendor: <strong className={isDark ? "text-white" : "text-slate-900"}>{approvedQuotation.supplier?.name || `Supplier #${approvedQuotation.supplier_id}`}</strong>
                {" • "}Bid Amount: <strong className="text-emerald-500">{formatNaira(approvedQuotation.total_amount)} {approvedQuotation.currency || ""}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreatePO}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-all whitespace-nowrap shrink-0"
          >
            <Icon icon="mdi:cart-arrow-right" className="w-4 h-4" />
            Create PO from this RFQ
          </button>
        </div>
      )}

      {/* 2-Column Section: Quotations List + Submit Quotation Form */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quotations list */}
        <div className={cn(
          "rounded-2xl border p-5 transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:format-list-bulleted" className="w-4 h-4 text-sky-500" />
              <h3 className={cn("text-sm font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Submitted Quotations
              </h3>
            </div>
            <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-semibold border", isDark ? "bg-[#001825] border-[#0A4D66]/50 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600")}>
              {sortedQuotations.length} total
            </span>
          </div>

          {sortedQuotations.length === 0 ? (
            <div className={cn(
              "rounded-xl border border-dashed p-8 text-center text-sm",
              isDark ? "border-[#0A4D66]/40 text-slate-400" : "border-slate-300 text-slate-500"
            )}>
              <Icon icon="mdi:clipboard-outline" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No quotations submitted for this RFQ yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedQuotations.map((quotation) => {
                const isApproved = (quotation.status ?? "").toLowerCase() === "approved";
                const canApprove = !isApproved && (approvedQuotation === null || approvedQuotation.id === quotation.id);

                return (
                  <div
                    key={quotation.id}
                    className={cn(
                      "rounded-xl border p-4 transition-all shadow-xs",
                      isApproved
                        ? (isDark ? "border-emerald-500/40 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50/50")
                        : (isDark ? "border-[#0A4D66]/40 bg-[#001825]/80 hover:border-[#0A4D66]/70" : "border-slate-200 bg-slate-50/70 hover:border-slate-300")
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={cn("text-sm font-semibold truncate", isDark ? "text-white" : "text-slate-900")}>
                          {quotation.supplier?.name || `Supplier #${quotation.supplier_id}`}
                        </div>
                        <div className={cn("mt-0.5 text-xs font-mono", isDark ? "text-slate-400" : "text-slate-500")}>
                          {quotation.quotation_number || `Quotation #${quotation.id}`}
                        </div>
                        <div className={cn("mt-1.5 text-base font-bold", isApproved ? "text-emerald-500" : (isDark ? "text-white" : "text-slate-900"))}>
                          {formatNaira(quotation.total_amount)}{" "}
                          <span className={cn("text-xs font-normal", isDark ? "text-slate-400" : "text-slate-500")}>
                            {quotation.currency || "NGN"}
                          </span>
                        </div>
                        <div className={cn("mt-1 text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>
                          Valid until: <strong className={isDark ? "text-slate-300" : "text-slate-700"}>{formatDateShort(quotation.valid_until)}</strong>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                            isApproved
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-400",
                          )}
                        >
                          {isApproved ? "Approved" : "Under Review"}
                        </span>
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleApproveQuotation(quotation.id)}
                            disabled={!canApprove || isApprovingQuotation}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                          >
                            {isApprovingQuotation ? "Approving..." : "Approve Bid"}
                          </button>
                        )}
                      </div>
                    </div>
                    {quotation.notes && (
                      <div className={cn("mt-3 border-t pt-2.5 text-xs italic", isDark ? "border-[#0A4D66]/30 text-slate-300" : "border-slate-200 text-slate-600")}>
                        "{quotation.notes}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit quotation form */}
        <div className={cn(
          "rounded-2xl border p-5 transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="mb-4 flex items-center gap-2">
            <Icon icon="mdi:plus-circle-outline" className="w-4 h-4 text-sky-500" />
            <h3 className={cn("text-sm font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              Record Supplier Quotation
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className={cn("mb-1.5 block text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                Supplier / Vendor
              </label>
              <select
                value={quotationSupplierId}
                onChange={(e) => setQuotationSupplierId(e.target.value ? Number(e.target.value) : "")}
                className={cn(
                  "w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-800"
                )}
              >
                <option value="">Select supplier</option>
                {selectableSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cn("mb-1.5 block text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Quotation Ref #
                </label>
                <input
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2 text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="e.g. QT-2026-001"
                />
              </div>
              <div>
                <label className={cn("mb-1.5 block text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Valid Until
                </label>
                <input
                  type="date"
                  value={quotationValidUntil}
                  onChange={(e) => setQuotationValidUntil(e.target.value)}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                      : "bg-slate-50 border-slate-300 text-slate-800"
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cn("mb-1.5 block text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Total Amount
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={quotationAmount}
                  onChange={(e) => setQuotationAmount(e.target.value)}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={cn("mb-1.5 block text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Currency
                </label>
                <input
                  type="text"
                  value={quotationCurrency}
                  onChange={(e) => setQuotationCurrency(e.target.value.toUpperCase())}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="NGN"
                />
              </div>
            </div>

            <div>
              <label className={cn("mb-1.5 block text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                Notes & Terms (Optional)
              </label>
              <textarea
                value={quotationNotes}
                onChange={(e) => setQuotationNotes(e.target.value)}
                rows={3}
                className={cn(
                  "w-full rounded-xl border px-3.5 py-2 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                    : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                )}
                placeholder="Payment terms, delivery timeline, or warranty specifics..."
              />
            </div>

            {quotationFormError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                {quotationFormError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmitQuotation}
              disabled={isCreatingQuotation}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60 transition-all"
            >
              <Icon icon={isCreatingQuotation ? "mdi:loading" : "mdi:check"} className={cn("w-4 h-4", isCreatingQuotation && "animate-spin")} />
              {isCreatingQuotation ? "Submitting Quotation..." : "Submit Quotation"}
            </button>
          </div>
        </div>
      </div>

      {/* Requested Parts Specification Table */}
      {rfq.stock_movement?.stocks && rfq.stock_movement.stocks.length > 0 && (
        <div className={cn(
          "rounded-2xl border overflow-hidden transition-all shadow-sm",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className={cn("border-b px-6 py-4 flex items-center justify-between", isDark ? "border-[#0A4D66]/30 bg-[#001825]/50" : "border-slate-200 bg-slate-50/50")}>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:cog-transfer-outline" className="w-4 h-4 text-sky-500" />
              <h3 className={cn("text-sm font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                Requested Line Items
              </h3>
            </div>
            <span className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
              {rfq.stock_movement.stocks.length} parts on requisition
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={cn("text-[11px] uppercase tracking-wider font-semibold border-b", isDark ? "bg-[#001825] text-slate-400 border-[#0A4D66]/30" : "bg-slate-100 text-slate-600 border-slate-200")}>
                  <th className="px-6 py-3.5">Part / Description</th>
                  <th className="px-6 py-3.5">Part Number</th>
                  <th className="px-6 py-3.5 text-right">Qty Requested</th>
                  <th className="px-6 py-3.5 text-right">Qty Approved</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y text-xs", isDark ? "divide-[#0A4D66]/20" : "divide-slate-200")}>
                {rfq.stock_movement.stocks.map((line, idx) => (
                  <tr
                    key={line.id ?? idx}
                    className={cn(
                      "transition-colors",
                      isDark
                        ? (idx % 2 === 0 ? "bg-[#001219]/60 hover:bg-[#0A4D66]/10" : "bg-[#001825]/40 hover:bg-[#0A4D66]/15")
                        : (idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/50 hover:bg-slate-100/70")
                    )}
                  >
                    <td className="px-6 py-3.5 font-medium">
                      <div className={isDark ? "text-slate-200" : "text-slate-900"}>
                        {line.inventory?.description || line.inventory?.part_name || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs">
                      <span className={cn("px-2 py-0.5 rounded border text-[11px]", isDark ? "bg-[#001825] border-[#0A4D66]/40 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-700")}>
                        {line.inventory?.part_number || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs", isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700")}>
                        {line.quantity_requested}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold",
                        line.quantity_approved 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : (isDark ? "text-slate-500" : "text-slate-400")
                      )}>
                        {line.quantity_approved ?? "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Off-screen high-fidelity NAAVN-005 document element for PDF download */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "794px",
          pointerEvents: "none",
          zIndex: -999,
        }}
        aria-hidden="true"
      >
        <RfqPrintDocument
          ref={printDocumentRef}
          rfq={rfq}
          approvedQuotation={approvedQuotation}
        />
      </div>

      {/* Document Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Icon icon="mdi:file-document-outline" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Request For Quotation (RFQ) Document Preview
                  </h3>
                  <p className="text-xs text-slate-400">
                    Document Ref No.: NAAVN-005 • Nigerian Army Aviation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Icon icon="mdi:printer" className="h-4 w-4" />
                  Print Form
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0369A1]/90 disabled:opacity-60 transition-colors"
                >
                  <Icon
                    icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
                    className={cn("h-4 w-4", isDownloadingPdf && "animate-spin")}
                  />
                  {isDownloadingPdf ? "Downloading..." : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Icon icon="mdi:close" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-950/70 flex justify-center">
              <div className="shadow-2xl rounded-sm overflow-hidden bg-white">
                <RfqPrintDocument
                  rfq={rfq}
                  approvedQuotation={approvedQuotation}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
