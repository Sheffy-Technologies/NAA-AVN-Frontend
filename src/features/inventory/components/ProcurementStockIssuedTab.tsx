import React, { useMemo, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateStockMovementMutation,
  useGetInventoriesQuery,
  useGetStockMovementsQuery,
  useUpdateInventoryStockMutation,
  type StockMovement,
} from "../api";
import { formatDateShort, formatTimeShort, downloadCsv, onInteractiveRowClick } from "../inventoryUtils";

interface ProcurementStockIssuedTabProps {
  onOpenIssueModal?: () => void;
}

export const ProcurementStockIssuedTab: React.FC<ProcurementStockIssuedTabProps> = () => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  // Queries & Mutations
  const {
    data: stockMovements = [],
    isLoading: isMovementsLoading,
    refetch: refetchStockMovements,
  } = useGetStockMovementsQuery();
  const {
    data: inventories = [],
    refetch: refetchInventories,
  } = useGetInventoriesQuery();

  const [createStockMovement, { isLoading: isIssuingMovement }] =
    useCreateStockMovementMutation();
  const [updateInventoryStock, { isLoading: isUpdatingStock }] =
    useUpdateInventoryStockMutation();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedMovementForDetails, setSelectedMovementForDetails] =
    useState<StockMovement | null>(null);

  // Issue Stock Form State
  const [issueForm, setIssueForm] = useState({
    inventory_id: "",
    quantity: "1",
    work_order_id: "",
    notes: "",
  });

  // Filter movements for movement_type === 'issue'
  const issuedMovements = useMemo(() => {
    return stockMovements.filter(
      (m) => (m.movement_type ?? "").toLowerCase() === "issue",
    );
  }, [stockMovements]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return issuedMovements.filter((m) => {
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const idMatch = `issue #${m.id}`.toLowerCase().includes(query) || String(m.id).includes(query);
        const woMatch = m.work_order_id ? `wo #${m.work_order_id}`.toLowerCase().includes(query) : false;
        const notesMatch = (m.notes ?? "").toLowerCase().includes(query);
        return idMatch || woMatch || notesMatch;
      }
      return true;
    });
  }, [issuedMovements, searchQuery]);

  // Handle Submit Issue Stock
  const handleIssueStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const invId = Number(issueForm.inventory_id);
    const qty = Number(issueForm.quantity);
    const woId = issueForm.work_order_id ? Number(issueForm.work_order_id) : null;

    if (!invId) {
      dispatch(showToast({ message: "Select an inventory item to issue.", type: "error" }));
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      dispatch(showToast({ message: "Enter a valid positive quantity to issue.", type: "error" }));
      return;
    }

    const item = inventories.find((i) => i.id === invId);
    if (item && (Number(item.current_stock) || 0) < qty) {
      dispatch(
        showToast({
          message: `Cannot issue ${qty}. Current available stock is ${item.current_stock}.`,
          type: "error",
        }),
      );
      return;
    }

    try {
      // 1. Deduct stock in InventoryStock
      await updateInventoryStock({
        inventory_id: invId,
        stock_type: "out_of_stock",
        quantity: qty,
      }).unwrap();

      // 2. Log stock movement record
      await createStockMovement({
        quantity: qty,
        movement_type: "issue",
        work_order_id: woId,
        notes: issueForm.notes || `Issued to WO #${woId ?? "General"} on ${new Date().toLocaleDateString()}`,
        stocks: [
          {
            inventory_id: invId,
            quantity_requested: qty,
            quantity_approved: qty,
          },
        ],
      }).unwrap();

      dispatch(
        showToast({
          message: `Successfully issued ${qty} units of ${item?.part_number || "item"}. Inventory updated.`,
          type: "success",
        }),
      );

      setIsIssueModalOpen(false);
      setIssueForm({ inventory_id: "", quantity: "1", work_order_id: "", notes: "" });
      refetchStockMovements();
      refetchInventories();
    } catch {
      dispatch(showToast({ message: "Failed to issue stock.", type: "error" }));
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Issue Reference",
      "Work Order",
      "Quantity Issued",
      "Date Issued",
      "Notes",
    ];
    const rows = filteredRows.map((m) => [
      `ISSUE #${m.id}`,
      m.work_order_id ? `WO #${m.work_order_id}` : "General",
      String(m.quantity),
      `${formatDateShort(m.created_at)} ${formatTimeShort(m.created_at)}`,
      m.notes || "-",
    ]);
    downloadCsv("stock-issued.csv", [headers, ...rows]);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Contextual CTA Bar */}
      <div className={cn(
        "flex flex-col gap-4 p-4 rounded-xl border",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
              Stock Issued (Dispatches to Maintenance & Units)
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
              Audit log of parts and consumables deducted from store and issued to work orders, aircraft, and squadrons.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search ISSUE # or WO #..."
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
              onClick={() => setIsIssueModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors whitespace-nowrap"
            >
              <Icon icon="mdi:arrow-top-right-bold-box-outline" className="w-4 h-4" />
              <span>Issue Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={cn(
        "rounded-xl border overflow-x-auto",
        isDark ? "bg-[#001219] border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
      )}>
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-[#0A4D66]/30 text-[11px] uppercase tracking-wider text-[var(--theme-text-muted)] bg-[var(--theme-bg-panel)]">
              <th className="px-4 py-3 font-semibold">Issue Ref</th>
              <th className="px-4 py-3 font-semibold">Work Order / Destination</th>
              <th className="px-4 py-3 font-semibold">Quantity Issued</th>
              <th className="px-4 py-3 font-semibold">Date Dispatched</th>
              <th className="px-4 py-3 font-semibold">Purpose / Notes</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0A4D66]/20 text-xs">
            {isMovementsLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  Loading stock issuance records...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--theme-text-muted)]">
                  No stock issuance records found. Click "Issue Stock" to dispatch items.
                </td>
              </tr>
            ) : (
              filteredRows.map((movement) => (
                <tr
                  key={movement.id}
                  title="Click to inspect stock issuance details"
                  onClick={(e) =>
                    onInteractiveRowClick(e, () =>
                      setSelectedMovementForDetails(movement),
                    )
                  }
                  className="hover:bg-[#0A4D66]/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-indigo-400 font-mono">
                    ISSUE #{movement.id}
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                    {movement.work_order_id ? (
                      <span className="font-mono text-sky-400">WO #{movement.work_order_id}</span>
                    ) : (
                      <span className="text-[var(--theme-text-muted)]">General Store Dispatch</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-[var(--theme-text-primary)]">
                    {movement.quantity}
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-text-secondary)]">
                    {formatDateShort(movement.created_at)} {formatTimeShort(movement.created_at)}
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-text-secondary)] max-w-xs truncate">
                    {movement.notes || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
                      Dispatched to Maintenance
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMovementForDetails(movement);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 text-indigo-300 text-[11px] font-semibold transition-colors"
                    >
                      <Icon icon="mdi:eye" className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: ISSUE STOCK */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={cn(
            "w-full max-w-lg rounded-xl border p-6 shadow-xl space-y-4",
            isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-800",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:arrow-top-right-bold-box-outline" className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-[var(--theme-text-primary)]">
                  Issue Stock to Aircraft / Work Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="text-[var(--theme-text-muted)] hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueStock} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Select Stock Item *
                </label>
                <select
                  value={issueForm.inventory_id}
                  onChange={(e) =>
                    setIssueForm((prev) => ({ ...prev, inventory_id: e.target.value }))
                  }
                  required
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                >
                  <option value="">-- Choose Stock Item to Issue --</option>
                  {inventories.map((i) => (
                    <option key={i.id} value={i.id} disabled={Number(i.current_stock || 0) <= 0}>
                      {i.part_number || i.description || `Item #${i.id}`} — Available: {i.current_stock ?? 0} ({i.measurement_unit || "pcs"}) {Number(i.current_stock || 0) <= 0 ? "(Out of stock)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                    Quantity to Issue *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={issueForm.quantity}
                    onChange={(e) =>
                      setIssueForm((prev) => ({ ...prev, quantity: e.target.value }))
                    }
                    required
                    className={cn(
                      "w-full rounded-lg px-3 py-2 border focus:outline-none font-bold",
                      isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                    )}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                    Work Order # (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 104"
                    value={issueForm.work_order_id}
                    onChange={(e) =>
                      setIssueForm((prev) => ({ ...prev, work_order_id: e.target.value }))
                    }
                    className={cn(
                      "w-full rounded-lg px-3 py-2 border focus:outline-none font-mono",
                      isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[var(--theme-text-secondary)]">
                  Dispatched To / Aircraft Tail / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dispatched to Sgt. Yusuf for tail NAF-541 100hr phase check..."
                  value={issueForm.notes}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 border focus:outline-none",
                    isDark ? "bg-[#001825] border-[#0A4D66]/60 text-white" : "bg-slate-50 border-slate-300 text-slate-800",
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#0A4D66]/20">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--theme-border-em)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-panel)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIssuingMovement || isUpdatingStock}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {isIssuingMovement || isUpdatingStock ? "Deducting Stock..." : "Confirm & Issue Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INSPECT ISSUE DETAILS */}
      {selectedMovementForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={cn(
            "w-full max-w-md rounded-xl border p-6 shadow-xl space-y-4",
            isDark ? "bg-[#001219] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-800",
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/30">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:arrow-top-right-bold-box-outline" className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-[var(--theme-text-primary)]">
                  Stock Issue Details — ISSUE #{selectedMovementForDetails.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMovementForDetails(null)}
                className="text-[var(--theme-text-muted)] hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-[#0A4D66]/30 bg-[#001825]/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Work Order:</span>
                  <span className="font-mono font-bold text-sky-400">
                    {selectedMovementForDetails.work_order_id ? `WO #${selectedMovementForDetails.work_order_id}` : "General Dispatch"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Quantity Issued:</span>
                  <span className="font-bold text-emerald-400">{selectedMovementForDetails.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Date & Time:</span>
                  <span className="text-[var(--theme-text-secondary)]">
                    {formatDateShort(selectedMovementForDetails.created_at)} {formatTimeShort(selectedMovementForDetails.created_at)}
                  </span>
                </div>
              </div>

              {selectedMovementForDetails.notes && (
                <div>
                  <span className="text-[var(--theme-text-muted)] block font-semibold mb-1">Issue Purpose / Remarks:</span>
                  <p className="p-2.5 rounded border border-[var(--theme-border-em)] bg-[var(--theme-bg-panel)] text-[var(--theme-text-secondary)]">
                    {selectedMovementForDetails.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#0A4D66]/20">
                <button
                  type="button"
                  onClick={() => setSelectedMovementForDetails(null)}
                  className="px-4 py-1.5 rounded-lg bg-[#0369A1] text-white font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
