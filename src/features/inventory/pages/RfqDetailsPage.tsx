import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { exportNaavnExcel } from "@/shared/documents/naavnExcel";
import { exportNaavnPdf } from "@/shared/documents/naavnPdf";
import { sanitizeDocumentFileName } from "@/shared/documents/naavnDocument";
import {
  useGetRfqsQuery,
  useGetSupplierQuotationsQuery,
  useGetSuppliersQuery,
  useCreateSupplierQuotationMutation,
  useApproveSupplierQuotationMutation,
} from "@/features/inventory/api";
import { buildRfqDocument } from "@/features/inventory/procurementDocuments";

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
  const [exportingFormat, setExportingFormat] = useState<"excel" | "pdf" | null>(null);

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

  const handleExport = async (format: "excel" | "pdf") => {
    if (!rfq || exportingFormat) return;

    const invited = rfq.suppliers ?? [];
    const selected =
      invited.find((supplier) => String(supplier.id) === exportSupplierId) ?? invited[0] ?? null;
    const addressees = exportSupplierId === ALL_SUPPLIERS && invited.length > 0 ? invited : [selected];
    const documents = addressees.map((supplier) => buildRfqDocument(rfq, supplier));
    const fileName = sanitizeDocumentFileName(
      `RFQ ${rfq.rfq_number || rfq.id}${addressees.length === 1 && addressees[0] ? ` ${addressees[0].name}` : ""}`,
    );

    setExportingFormat(format);
    try {
      if (format === "excel") {
        await exportNaavnExcel(documents, fileName);
      } else {
        await exportNaavnPdf(documents, fileName);
      }
      dispatch(
        showToast({
          message: format === "excel" ? "Excel downloaded" : "PDF downloaded",
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({
          message: format === "excel" ? "Failed to download Excel" : "Failed to download PDF",
          type: "error",
        }),
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const handleCreatePO = () => {
    const params = new URLSearchParams();
    if (id) params.set("rfq_id", id);
    if (approvedQuotation) params.set("bid_id", String(approvedQuotation.id));
    navigate(`/dashboard/inventory/purchase-orders/new?${params.toString()}`);
  };

  if (isRfqLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="animate-spin h-6 w-6 border-2 border-[#7FD5FF] border-t-transparent rounded-full mr-3" />
        Loading RFQ...
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
        <Icon icon="mdi:file-question-outline" className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">RFQ not found</p>
        <Link
          to="/dashboard/inventory"
          state={{ inventoryTab: "Parts Requisitions" }}
          className="text-[#7FD5FF] hover:underline text-sm"
        >
          Back to Inventory
        </Link>
      </div>
    );
  }

  const rfqStatusColor =
    rfq.status === "sent"
      ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
      : rfq.status === "closed"
        ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
        : rfq.status === "cancelled"
          ? "text-red-300 border-red-500/40 bg-red-500/10"
          : "text-gray-300 border-gray-500/40 bg-gray-500/10";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              navigate("/dashboard/inventory", {
                state: { inventoryTab: "Parts Requisitions" },
              })
            }
            className="inline-flex items-center justify-center p-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-400 hover:text-white transition-colors"
            title="Back to Inventory"
          >
            <Icon icon="mdi:arrow-left" className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs uppercase tracking-wide text-[#7FD5FF] mb-0.5">
              RFQ Details
            </div>
            <h1 className="text-xl font-bold text-white">
              {rfq.rfq_number || `RFQ #${rfq.id}`}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span>Requisition: REQ #{rfq.stock_movement_id}</span>
              <span>•</span>
              <span>
                Issued: {formatDateShort(rfq.issued_at)}{" "}
                {formatTimeShort(rfq.issued_at)}
              </span>
              <span>•</span>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                  rfqStatusColor,
                )}
              >
                {rfq.status ?? "draft"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {(rfq.suppliers?.length ?? 0) > 1 && (
            <select
              value={exportSupplierId}
              onChange={(e) => setExportSupplierId(e.target.value)}
              title="Supplier the exported RFQ is addressed to"
              className="rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
            >
              {rfq.suppliers?.map((supplier, index) => (
                <option key={supplier.id} value={index === 0 ? "" : String(supplier.id)}>
                  Attn: {supplier.name}
                </option>
              ))}
              <option value={ALL_SUPPLIERS}>All suppliers (one form each)</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => handleExport("excel")}
            disabled={exportingFormat !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[#0A4D66]/50 text-sm text-gray-200 hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Icon
              icon={exportingFormat === "excel" ? "mdi:loading" : "mdi:file-excel-outline"}
              className={cn("w-4 h-4", exportingFormat === "excel" && "animate-spin")}
            />
            {exportingFormat === "excel" ? "Exporting..." : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exportingFormat !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[#0A4D66]/50 text-sm text-gray-200 hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Icon
              icon={exportingFormat === "pdf" ? "mdi:loading" : "mdi:file-pdf-box"}
              className={cn("w-4 h-4", exportingFormat === "pdf" && "animate-spin")}
            />
            {exportingFormat === "pdf" ? "Downloading..." : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={handleCreatePO}
            className="inline-flex items-center gap-2 rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-emerald-600 transition-colors whitespace-nowrap"
          >
            <Icon icon="mdi:cart-plus" className="w-4 h-4" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* Suppliers */}
      {(rfq.suppliers?.length ?? 0) > 0 && (
        <div className="bg-[#001219] rounded-xl border border-[#0A4D66]/40 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">
            Invited Suppliers
          </div>
          <div className="flex flex-wrap gap-2">
            {rfq.suppliers?.map((supplier) => (
              <span
                key={supplier.id}
                className="rounded-full border border-[#0A4D66]/60 bg-[#001825] px-3 py-1 text-xs text-gray-200"
              >
                {supplier.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Approved quotation notice + Create PO prompt */}
      {approvedQuotation && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <Icon
              icon="mdi:check-circle-outline"
              className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0"
            />
            <div>
              <div className="text-sm font-semibold text-emerald-300">
                Approved quotation available
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {approvedQuotation.supplier?.name ||
                  `Supplier #${approvedQuotation.supplier_id}`}{" "}
                — {formatNaira(approvedQuotation.total_amount)}{" "}
                {approvedQuotation.currency || ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreatePO}
            className="inline-flex items-center gap-2 rounded bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-emerald-600 transition-colors whitespace-nowrap"
          >
            <Icon icon="mdi:cart-arrow-right" className="w-4 h-4" />
            Create PO from this RFQ
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quotations list */}
        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">
              Supplier Quotations
            </div>
            <span className="text-xs text-gray-400">
              {sortedQuotations.length} submitted
            </span>
          </div>

          {sortedQuotations.length === 0 ? (
            <div className="rounded border border-dashed border-[#0A4D66]/50 p-6 text-center text-sm text-gray-400">
              No quotations submitted for this RFQ yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedQuotations.map((quotation) => {
                const isApproved =
                  (quotation.status ?? "").toLowerCase() === "approved";
                const canApprove =
                  !isApproved &&
                  (approvedQuotation === null ||
                    approvedQuotation.id === quotation.id);

                return (
                  <div
                    key={quotation.id}
                    className={cn(
                      "rounded-lg border p-3",
                      isApproved
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-[#0A4D66]/40 bg-[#001825]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {quotation.supplier?.name ||
                            `Supplier #${quotation.supplier_id}`}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          {quotation.quotation_number ||
                            `Quotation #${quotation.id}`}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {formatNaira(quotation.total_amount)}{" "}
                          <span className="text-xs font-normal text-gray-400">
                            {quotation.currency || ""}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          Valid until:{" "}
                          {formatDateShort(quotation.valid_until)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px]",
                            isApproved
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                          )}
                        >
                          {isApproved ? "Approved" : "Submitted"}
                        </span>
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() =>
                              handleApproveQuotation(quotation.id)
                            }
                            disabled={!canApprove || isApprovingQuotation}
                            className="rounded bg-emerald-400 px-3 py-1 text-xs font-semibold text-black hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                          >
                            {isApprovingQuotation ? "Approving..." : "Approve"}
                          </button>
                        )}
                      </div>
                    </div>
                    {quotation.notes && (
                      <div className="mt-2 border-t border-[#0A4D66]/30 pt-2 text-xs text-gray-300">
                        {quotation.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit quotation form */}
        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4">
          <div className="mb-4 text-sm font-semibold text-white">
            Submit Supplier Quotation
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Supplier
              </label>
              <select
                value={quotationSupplierId}
                onChange={(e) =>
                  setQuotationSupplierId(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
                className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
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
                <label className="mb-1 block text-xs text-gray-400">
                  Quotation Number
                </label>
                <input
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                  placeholder="QT-001"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={quotationValidUntil}
                  onChange={(e) => setQuotationValidUntil(e.target.value)}
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Amount
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={quotationAmount}
                  onChange={(e) => setQuotationAmount(e.target.value)}
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Currency
                </label>
                <input
                  type="text"
                  value={quotationCurrency}
                  onChange={(e) =>
                    setQuotationCurrency(e.target.value.toUpperCase())
                  }
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                  placeholder="NGN"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Notes (optional)
              </label>
              <textarea
                value={quotationNotes}
                onChange={(e) => setQuotationNotes(e.target.value)}
                className="min-h-20 w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Add quotation notes"
              />
            </div>

            {quotationFormError && (
              <div className="text-xs text-red-400">{quotationFormError}</div>
            )}

            <button
              type="button"
              onClick={handleSubmitQuotation}
              disabled={isCreatingQuotation}
              className="w-full rounded bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1]/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {isCreatingQuotation ? "Submitting..." : "Submit Quotation"}
            </button>
          </div>
        </div>
      </div>

      {/* RFQ items from stock movement */}
      {rfq.stock_movement?.stocks && rfq.stock_movement.stocks.length > 0 && (
        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] overflow-hidden">
          <div className="border-b border-[#0A4D66]/40 px-5 py-3">
            <div className="text-sm font-semibold text-white">
              Requested Parts
            </div>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40">
                <th className="px-5 py-3 font-medium">Part / Description</th>
                <th className="px-5 py-3 font-medium">Part Number</th>
                <th className="px-5 py-3 font-medium text-right">
                  Qty Requested
                </th>
                <th className="px-5 py-3 font-medium text-right">
                  Qty Approved
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
              {rfq.stock_movement.stocks.map((line, idx) => (
                <tr
                  key={line.id ?? idx}
                  className={cn(
                    "hover:bg-[#0A4D66]/10 transition-colors",
                    idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                  )}
                >
                  <td className="px-5 py-3 text-gray-200">
                    {line.inventory?.description ||
                      line.inventory?.part_name ||
                      "-"}
                  </td>
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">
                    {line.inventory?.part_number || "-"}
                  </td>
                  <td className="px-5 py-3 text-right text-white font-medium">
                    {line.quantity_requested}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">
                    {line.quantity_approved ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
