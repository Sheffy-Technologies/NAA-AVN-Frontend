import React, { useMemo, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetAssetsQuery } from "@/features/assets/api";
import {
  useGetUnserviceableSparesQuery,
  useUpdateUnserviceableSpareMutation,
  useDeleteUnserviceableSpareMutation,
  type UnserviceableSpare,
  type UnserviceableSpareDisposition,
} from "../api";
import { LogUnserviceableSpareModal } from "./LogUnserviceableSpareModal";

const DISPOSITION_BADGES: Record<UnserviceableSpareDisposition, { label: string; badgeClass: string; icon: string }> = {
  quarantine: { label: "Quarantine Inspection", badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: "mdi:shield-alert" },
  awaiting_mro: { label: "Awaiting MRO Dispatch", badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", icon: "mdi:truck-fast" },
  in_house_repair: { label: "In-House Workshop", badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30", icon: "mdi:wrench" },
  ber_scrap: { label: "BER / Condemned Scrap", badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30", icon: "mdi:close-octagon" },
  serviceable_reclaimed: { label: "Serviceable Re-certified", badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: "mdi:check-circle" },
};

export const UnserviceableSparesRegister: React.FC = () => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<string>("all");
  const [selectedDispositionFilter, setSelectedDispositionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit / Disposition Modal
  const [selectedSpare, setSelectedSpare] = useState<UnserviceableSpare | null>(null);
  const [editDisposition, setEditDisposition] = useState<UnserviceableSpareDisposition>("quarantine");
  const [editRemarks, setEditRemarks] = useState("");
  const [editStorage, setEditStorage] = useState("");

  const { data: aircraftAssets = [] } = useGetAssetsQuery({ type: "aircraft" });
  const { data: spares = [], isLoading, refetch } = useGetUnserviceableSparesQuery();
  const [updateSpare, { isLoading: isUpdating }] = useUpdateUnserviceableSpareMutation();
  const [deleteSpare] = useDeleteUnserviceableSpareMutation();

  const filteredSpares = useMemo(() => {
    return spares.filter((item) => {
      if (selectedAssetFilter !== "all" && String(item.asset_id) !== selectedAssetFilter) {
        return false;
      }
      if (selectedDispositionFilter !== "all" && item.disposition_status !== selectedDispositionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (item.part_name || "").toLowerCase().includes(q);
        const pNum = (item.part_number || "").toLowerCase().includes(q);
        const sNum = (item.serial_number || "").toLowerCase().includes(q);
        const reason = (item.reason_for_removal || "").toLowerCase().includes(q);
        const tail = (item.asset?.tail_number || item.asset?.name || "").toLowerCase().includes(q);
        return pName || pNum || sNum || reason || tail;
      }
      return true;
    });
  }, [spares, selectedAssetFilter, selectedDispositionFilter, searchQuery]);

  // KPI Metrics
  const kpis = useMemo(() => {
    const na010 = spares.filter((s) => (s.asset?.tail_number || s.asset?.name || "").includes("010")).length;
    const na011 = spares.filter((s) => (s.asset?.tail_number || s.asset?.name || "").includes("011")).length;
    const quarantine = spares.filter((s) => s.disposition_status === "quarantine").length;
    const awaitingMro = spares.filter((s) => s.disposition_status === "awaiting_mro").length;
    return {
      total: spares.length,
      na010,
      na011,
      quarantine,
      awaitingMro,
    };
  }, [spares]);

  const handleOpenEdit = (spare: UnserviceableSpare) => {
    setSelectedSpare(spare);
    setEditDisposition(spare.disposition_status);
    setEditRemarks(spare.removal_remarks || "");
    setEditStorage(spare.storage_location || "");
  };

  const handleSaveDisposition = async () => {
    if (!selectedSpare) return;
    try {
      await updateSpare({
        id: selectedSpare.id,
        data: {
          disposition_status: editDisposition,
          removal_remarks: editRemarks.trim() || null,
          storage_location: editStorage.trim() || null,
        },
      }).unwrap();
      dispatch(showToast({ message: "Component disposition updated.", type: "success" }));
      setSelectedSpare(null);
    } catch {
      dispatch(showToast({ message: "Failed to update disposition.", type: "error" }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Remove this unserviceable component record from the register?")) return;
    try {
      await deleteSpare(id).unwrap();
      dispatch(showToast({ message: "Record removed.", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to delete record.", type: "error" }));
    }
  };

  const handleExportCsv = () => {
    if (!filteredSpares.length) return;
    const headers = [
      "ID",
      "Aircraft",
      "Part Name",
      "Part Number",
      "Serial Number",
      "TSN (Hrs)",
      "TSO (Hrs)",
      "TSI (Hrs)",
      "CSN (Cycles)",
      "CSO (Cycles)",
      "Date Removed",
      "Reason for Removal",
      "Disposition Status",
      "Storage Location",
    ];

    const rows = filteredSpares.map((s) => [
      s.id,
      `"${s.asset?.tail_number || s.asset?.name || `Asset #${s.asset_id}`}"`,
      `"${(s.part_name || "").replace(/"/g, '""')}"`,
      `"${s.part_number}"`,
      `"${s.serial_number || "N/A"}"`,
      s.tsn_hours ?? "",
      s.tso_hours ?? "",
      s.tsi_hours ?? "",
      s.csn_cycles ?? "",
      s.cso_cycles ?? "",
      s.date_removed,
      `"${(s.reason_for_removal || "").replace(/"/g, '""')}"`,
      s.disposition_status,
      `"${(s.storage_location || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `unserviceable_spares_register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-4">
      {/* Top Action & KPI Bar */}
      <div
        className={cn(
          "p-5 rounded-2xl border shadow-sm",
          isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Icon icon="mdi:archive-alert-outline" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Unserviceable Spares &amp; Removed Components Register
              </h2>
              <p className={cn("text-xs", isDark ? "text-gray-400" : "text-slate-500")}>
                Official airworthiness holding register for components removed from active airframes (NA 010 &amp; NA 011)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#0A4D66]/40 hover:bg-[#0A4D66]/20 transition-all text-gray-300"
            >
              <Icon icon="mdi:download" className="w-4 h-4 text-sky-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setIsLogModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95"
            >
              <Icon icon="mdi:plus-circle" className="w-4 h-4 text-white" />
              <span>+ Log Removed Component</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#0A4D66]/20">
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">Total Unserviceable</span>
            <span className="text-xl font-black text-rose-400 mt-0.5 block">{kpis.total}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">NA 010 Removals</span>
            <span className="text-xl font-black text-sky-400 mt-0.5 block">{kpis.na010}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">NA 011 Removals</span>
            <span className="text-xl font-black text-indigo-400 mt-0.5 block">{kpis.na011}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">In Quarantine</span>
            <span className="text-xl font-black text-amber-400 mt-0.5 block">{kpis.quarantine}</span>
          </div>
          <div className={cn("p-3 rounded-xl border", isDark ? "bg-[#001825] border-[#0A4D66]/40" : "bg-slate-50 border-slate-200")}>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">Awaiting MRO Dispatch</span>
            <span className="text-xl font-black text-teal-400 mt-0.5 block">{kpis.awaitingMro}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Airframe:</span>
          <button
            type="button"
            onClick={() => setSelectedAssetFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              selectedAssetFilter === "all" ? "bg-rose-600 text-white" : "bg-[#001825] border border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30",
            )}
          >
            All Airframes
          </button>
          {aircraftAssets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedAssetFilter(String(a.id))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1",
                selectedAssetFilter === String(a.id) ? "bg-rose-600 text-white" : "bg-[#001825] border border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30",
              )}
            >
              <Icon icon="mdi:airplane" className="w-3.5 h-3.5" />
              <span>{a.tail_number || a.name}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search part #, serial, description, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border border-[#0A4D66]/40 bg-[#001825] text-white placeholder:text-gray-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Register Data Table */}
      <div
        className={cn(
          "rounded-2xl border overflow-hidden shadow-sm",
          isDark ? "bg-[#001219] border-[#0A4D66]/40 text-white" : "bg-white border-slate-200 text-slate-800",
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px] text-xs">
            <thead>
              <tr
                className={cn(
                  "border-b uppercase tracking-wider text-[11px] font-semibold",
                  isDark ? "bg-[#001825] text-gray-400 border-[#0A4D66]/30" : "bg-slate-50 text-slate-500 border-slate-200",
                )}
              >
                <th className="px-4 py-3">Airframe</th>
                <th className="px-4 py-3">Part Name &amp; Reason</th>
                <th className="px-4 py-3">Part # &amp; Serial #</th>
                <th className="px-4 py-3">Life Counters at Removal</th>
                <th className="px-4 py-3">Removal Date &amp; Bay</th>
                <th className="px-4 py-3">Disposition</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    Loading unserviceable spares ledger...
                  </td>
                </tr>
              ) : filteredSpares.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <Icon icon="mdi:archive-outline" className="w-8 h-8 mx-auto mb-2 opacity-40 text-rose-400" />
                    <p className="font-semibold text-sm text-gray-300">No unserviceable components matching criteria</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Click &ldquo;+ Log Removed Component&rdquo; to register an aircraft component removed from service.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSpares.map((spare) => {
                  const disp = DISPOSITION_BADGES[spare.disposition_status] || DISPOSITION_BADGES.quarantine;
                  return (
                    <tr key={spare.id} className="hover:bg-white/5 transition-colors">
                      {/* Airframe */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                          <Icon icon="mdi:airplane" className="w-3 h-3" />
                          <span>{spare.asset?.tail_number || spare.asset?.name || `NA-${spare.asset_id}`}</span>
                        </span>
                      </td>

                      {/* Part Name & Reason */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{spare.part_name}</span>
                          <span className="text-[11px] text-rose-400/90 flex items-center gap-1 mt-0.5">
                            <Icon icon="mdi:alert-rhombus-outline" className="w-3 h-3 shrink-0" />
                            <span>{spare.reason_for_removal}</span>
                          </span>
                        </div>
                      </td>

                      {/* Part # & Serial # */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col font-mono">
                          <span className="text-sky-400 font-bold text-xs">{spare.part_number}</span>
                          <span className="text-[11px] text-gray-400">
                            {spare.serial_number ? `S/N: ${spare.serial_number}` : "Non-Serialized"}
                          </span>
                        </div>
                      </td>

                      {/* Counters: TSN, TSO, TSI, CSN, CSO */}
                      <td className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] text-gray-300">
                          <span>TSN: <strong>{spare.tsn_hours ?? "—"}h</strong></span>
                          <span>TSO: <strong>{spare.tso_hours ?? "—"}h</strong></span>
                          <span>TSI: <strong>{spare.tsi_hours ?? "—"}h</strong></span>
                          <span>CSN: <strong>{spare.csn_cycles ?? "—"}c</strong></span>
                        </div>
                      </td>

                      {/* Date & Location */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-[11px]">
                          <span className="text-gray-300">{formatDate(spare.date_removed)}</span>
                          <span className="text-gray-500 truncate max-w-36">{spare.storage_location || "Quarantine Bay"}</span>
                        </div>
                      </td>

                      {/* Disposition */}
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", disp.badgeClass)}>
                          <Icon icon={disp.icon} className="w-3 h-3" />
                          <span>{disp.label}</span>
                        </span>
                        {spare.shipment && (
                          <div className="mt-1 text-[10px] font-mono text-indigo-400">
                            AWB: {spare.shipment.tracking_number}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(spare)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                            title="Update Disposition / Status"
                          >
                            <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(spare.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                            title="Delete Record"
                          >
                            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
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
      </div>

      {/* Log Modal */}
      {isLogModalOpen && (
        <LogUnserviceableSpareModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          onSuccess={() => {
            setIsLogModalOpen(false);
            refetch();
          }}
        />
      )}

      {/* Edit Disposition Modal */}
      {selectedSpare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#0A4D66]/60 bg-[#001219] p-5 shadow-2xl text-xs text-white space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#0A4D66]/30">
              <h3 className="font-bold uppercase tracking-wider text-sm text-sky-400">
                Update Disposition &middot; {selectedSpare.part_number}
              </h3>
              <button type="button" onClick={() => setSelectedSpare(null)} className="text-gray-400 hover:text-white">
                <Icon icon="mdi:close" className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Disposition Status</label>
                <select
                  value={editDisposition}
                  onChange={(e) => setEditDisposition(e.target.value as UnserviceableSpareDisposition)}
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="quarantine">Quarantine Inspection (Pending Quality Review)</option>
                  <option value="awaiting_mro">Awaiting MRO / External Overhaul Dispatch</option>
                  <option value="in_house_repair">In-House Workshop Maintenance</option>
                  <option value="ber_scrap">Beyond Economical Repair (BER) / Scrap</option>
                  <option value="serviceable_reclaimed">Re-certified Serviceable / Recalibrated</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Storage Location / Quarantine Bay</label>
                <input
                  type="text"
                  value={editStorage}
                  onChange={(e) => setEditStorage(e.target.value)}
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Quality &amp; Handling Remarks</label>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full rounded-lg border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0A4D66]/30">
              <button
                type="button"
                onClick={() => setSelectedSpare(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDisposition}
                disabled={isUpdating}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-500 disabled:opacity-50"
              >
                {isUpdating ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

