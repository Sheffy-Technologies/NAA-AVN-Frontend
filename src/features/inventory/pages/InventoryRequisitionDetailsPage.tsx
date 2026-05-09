import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import {
  useGetInventoryRequisitionByIdQuery,
  useUpdateInventoryRequisitionMutation,
} from "@/features/inventory/api";

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

const formatNaira = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "₦0";
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/[₦,]/g, ""));
  if (Number.isNaN(numeric)) return String(value);
  return `₦${numeric.toLocaleString()}`;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value).replace(/[,]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
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

  const [updateRequisition, { isLoading: isSaving }] =
    useUpdateInventoryRequisitionMutation();

  const [remark, setRemark] = useState("");
  const [hasEditedRemark, setHasEditedRemark] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [approvedEdits, setApprovedEdits] = useState<Record<number, string>>(
    {},
  );

  const derived = useMemo(() => {
    const items = (detail?.items ?? []).map((line) => {
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
      const unit = line.inventory?.measurement_unit || "Litres";
      const unitCost = toNumber(line.unit_cost ?? line.inventory?.unit_cost);
      const approvedCost =
        line.approved_cost !== null && line.approved_cost !== undefined
          ? toNumber(line.approved_cost)
          : unitCost * (Number.isNaN(approvedQty) ? 0 : approvedQty);
      const newStockLevel =
        availableQty - (Number.isNaN(approvedQty) ? 0 : approvedQty);
      const itemDescription =
        line.inventory?.description ||
        line.inventory?.part_name ||
        `Inventory #${line.inventory_id}`;

      return {
        id: line.id,
        inventoryId: line.inventory_id,
        itemDescription,
        requested: { qty: requestedQty, unit },
        available: { qty: availableQty, unit },
        approved: { qty: approvedQtyRaw, unit },
        approvedCost,
        newStockLevel: { qty: Math.max(0, newStockLevel), unit },
      };
    });

    const totalApprovedCost = items.reduce(
      (sum, item) => sum + item.approvedCost,
      0,
    );

    return { items, totalApprovedCost };
  }, [detail?.items, approvedEdits]);

  const header = useMemo(() => {
    const requestingLocation =
      detail?.requesting_unit?.name ??
      (detail?.requesting_unit_id
        ? "Inventory Location"
        : "Inventory Location");
    const lastUpdatedBy =
      typeof detail?.last_updated_by === "string"
        ? detail.last_updated_by
        : (detail?.last_updated_by?.name ?? "Admin");
    const status = normalizeStatus(detail?.status);

    return { requestingLocation, lastUpdatedBy, status };
  }, [detail]);

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

  const handleSaveAndExit = async () => {
    if (!detail || !id) return;
    setSubmitError(null);
    if (!validate()) return;

    try {
      const effectiveRemark = hasEditedRemark
        ? remark.trim()
        : (detail.remark ?? "").trim();
      await updateRequisition({
        id,
        body: {
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

      handleExit();
    } catch {
      setSubmitError("Failed to save request. Please try again.");
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
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-base sm:text-lg font-semibold text-white uppercase tracking-wide">
          REQUEST DETAILS
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-300 hover:text-white disabled:opacity-70"
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
              className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
            />
            <span>{isDownloadingPdf ? "Downloading..." : "Download"}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAndExit}
            className={cn(
              "inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-300 hover:text-white",
              isSaving && "opacity-70 cursor-not-allowed",
            )}
            disabled={isSaving}
          >
            <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
            <span>Save &amp; Exit</span>
          </button>
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
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#7FD5FF]">Last Updated By:</span>
              <span className="text-white font-semibold">
                {header.lastUpdatedBy}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#7FD5FF]">Status:</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    statusDotColor[header.status],
                  )}
                />
                <span className="text-white font-semibold uppercase">
                  {header.status}
                </span>
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
                  <th className="px-4 py-3 font-medium">Approved Cost</th>
                  <th className="px-4 py-3 font-medium">New Stock Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A4D66]/20 text-sm">
                {derived.items.map((row, index) => (
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
                    <td className="px-4 py-3 text-white font-semibold">
                      {formatNaira(row.approvedCost)}
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      <span className="font-semibold text-white">
                        {row.newStockLevel.qty}
                      </span>{" "}
                      {row.newStockLevel.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-end justify-end">
            <div className="text-right">
              <div className="text-[11px] text-gray-400">
                Total Approved Cost
              </div>
              <div className="mt-1 text-white font-bold text-xl">
                {formatNaira(derived.totalApprovedCost)}
              </div>
            </div>
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
    </div>
  );
};
