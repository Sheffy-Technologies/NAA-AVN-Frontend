import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import Modal from "@/shared/ui/modal/Modal";
import { useGetStoreByIdQuery, type InventoryItem } from "../api";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/shared/utils/cn";

interface StoreInventoryModalProps {
  open: boolean;
  onClose: () => void;
  storeId: number | null;
  onAddInventoryToStore?: (storeId: number) => void;
}

export const StoreInventoryModal: React.FC<StoreInventoryModalProps> = ({
  open,
  onClose,
  storeId,
  onAddInventoryToStore,
}) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: store, isLoading } = useGetStoreByIdQuery(storeId ?? 0, {
    skip: !storeId || !open,
  });

  const items = useMemo(() => store?.inventories ?? [], [store]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.part_number?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.serial_number?.toLowerCase().includes(q) ||
        item.expense_category?.name?.toLowerCase().includes(q) ||
        item.nsn?.toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val ?? 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={store ? `Store: ${store.name}` : "Store Inventory"}
      className="max-w-4xl"
    >
      <div className="space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mr-2 text-[#7FD5FF]" />
            <span>Loading store inventory...</span>
          </div>
        ) : store ? (
          <>
            {/* Header / Metrics Strip */}
            <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A4D66]/30 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0A4D66]/30 border border-[#0A4D66]/60 text-[#7FD5FF]">
                    <Icon icon="mdi:store" className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-wide">
                        {store.name}
                      </h3>
                      {store.code && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-semibold">
                          {store.code}
                        </span>
                      )}
                      {store.is_system ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
                          <Icon icon="mdi:shield-lock-outline" className="w-3.5 h-3.5" />
                          System Protected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                          <Icon icon="mdi:store-check-outline" className="w-3.5 h-3.5" />
                          Custom Store
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {store.unit?.name ? `Base / Air Wing: ${store.unit.name}` : "General Logistics Depot"}
                    </p>
                  </div>
                </div>

                {onAddInventoryToStore && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddInventoryToStore(store.id);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Icon icon="mdi:plus" className="w-4 h-4" />
                    <span>Add Item To Store</span>
                  </button>
                )}
              </div>

              {store.description && (
                <p className="text-xs text-gray-300 leading-relaxed">
                  {store.description}
                </p>
              )}

              {/* KPI Badges */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-lg bg-[#001825] border border-[#0A4D66]/40 p-2.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                    Unique Items
                  </span>
                  <span className="text-lg font-bold text-white">
                    {store.inventories_count ?? items.length}
                  </span>
                </div>
                <div className="rounded-lg bg-[#001825] border border-[#0A4D66]/40 p-2.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                    Total Units In Stock
                  </span>
                  <span className="text-lg font-bold text-[#7FD5FF]">
                    {store.total_stock ?? items.reduce((acc, i) => acc + (i.current_stock || 0), 0)}
                  </span>
                </div>
                <div className="rounded-lg bg-[#001825] border border-[#0A4D66]/40 p-2.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                    Estimated Valuation
                  </span>
                  <span className="text-lg font-bold text-emerald-400">
                    {formatCurrency(
                      store.total_value ??
                        items.reduce((acc, i) => acc + (i.current_stock || 0) * Number(i.unit_cost || 0), 0),
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items by part number, description, category, or serial..."
                className={cn(
                  "w-full rounded-lg pl-9 pr-8 py-2 text-xs outline-none transition-colors border",
                  isDark
                    ? "bg-[#001219] border-[#0A4D66]/40 text-white placeholder:text-gray-500 focus:border-[#7FD5FF]"
                    : "bg-white border-slate-300 text-slate-800 placeholder:text-gray-400 focus:border-[#0369A1] shadow-sm",
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Inventory List Table */}
            <div className="rounded-xl border border-[#0A4D66]/40 overflow-hidden bg-[#001219]">
              <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    <Icon icon="mdi:cube-outline" className="w-8 h-8 mx-auto mb-2 text-gray-500 opacity-60" />
                    <p className="font-semibold text-gray-300">No inventory items in this store.</p>
                    <p className="mt-1 text-gray-500">
                      {searchQuery
                        ? "Try adjusting your search criteria."
                        : "Use '+ Add Item To Store' to allocate inventory to this repository."}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#0A4D66]/40 bg-[#001825]/90 text-[11px] uppercase tracking-wider text-gray-400 sticky top-0 z-10">
                        <th className="px-3.5 py-2.5 font-semibold">Part Number &amp; Description</th>
                        <th className="px-3.5 py-2.5 font-semibold">Category</th>
                        <th className="px-3.5 py-2.5 font-semibold text-right">Current Stock</th>
                        <th className="px-3.5 py-2.5 font-semibold text-right">Unit Cost</th>
                        <th className="px-3.5 py-2.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A4D66]/20 text-gray-200">
                      {filteredItems.map((item: InventoryItem) => (
                        <tr
                          key={item.id}
                          className="hover:bg-[#0A4D66]/15 transition-colors cursor-pointer"
                          onClick={() => {
                            onClose();
                            navigate(`/dashboard/inventory/${item.id}`);
                          }}
                        >
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-white tracking-wide">
                              {item.part_number}
                            </div>
                            <div className="text-[11px] text-gray-400 line-clamp-1">
                              {item.description || item.part_name || "-"}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-gray-300">
                            {item.expense_category?.name ?? "General"}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <span className="font-mono font-bold text-white">
                              {item.current_stock}
                            </span>
                            <span className="text-[10px] text-gray-400 ml-1">
                              {item.measurement_unit || "ea"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-emerald-400 font-semibold">
                            {formatCurrency(item.unit_cost)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                navigate(`/dashboard/inventory/${item.id}`);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] text-[#7FD5FF] hover:underline"
                            >
                              <span>View</span>
                              <Icon icon="mdi:arrow-right" className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-[#0A4D66]/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66]/30 border border-[#0A4D66]/60 text-gray-300 hover:text-white hover:bg-[#0A4D66]/60 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
