import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetInventoryByIdQuery } from "@/features/inventory/api";

const mapStockLevelColor = (level: string) => {
  const normalized = level.toLowerCase();

  if (normalized === "high") return "text-emerald-400";
  if (normalized === "medium") return "text-amber-300";
  if (normalized === "low") return "text-red-400";

  return "text-gray-300";
};

export const InventoryInfoPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const {
    data: inventory,
    isLoading,
    isError,
  } = useGetInventoryByIdQuery(id ?? "", {
    skip: !id,
  });

  const stockLevelColor = useMemo(
    () => (inventory ? mapStockLevelColor(inventory.stock_level) : "text-gray-300"),
    [inventory],
  );

  const handleBack = () => {
    navigate("/dashboard/inventory");
  };

  const handleEdit = () => {
    if (!id) return;
    navigate(`/dashboard/inventory/${id}/edit`);
  };

  if (!id || isError) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
          <div className="p-6 text-center text-gray-400">
            Failed to load inventory.
          </div>
        </section>
      </div>
    );
  }

  if (isLoading || !inventory) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Stock Info
            </span>
          </div>
          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
              <div className="h-64 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
              <div className="h-64 bg-[#001825] border border-[#0A4D66]/40 rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-semibold tracking-wide text-white uppercase">
                Stock Info
              </span>
              <span className="text-[11px] text-gray-400">
                Inventory ID{inventory.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7FD5FF] text-black text-xs sm:text-sm font-medium hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
            <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] uppercase text-gray-400">
                    Inventory Info
                  </div>
                  <div className="mt-1 text-sm sm:text-base font-semibold text-white">
                    {inventory.part_name}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Part No. {inventory.part_number}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-[11px] text-gray-300">
                  <span>{inventory.unit?.name}</span>
                  <span className="text-gray-400">Category</span>
                  <span>{inventory.expense_category?.name}</span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">NSN:</span>
                    <span className="font-semibold">
                      {inventory.nsn_number || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">ATA Chapter:</span>
                    <span className="font-semibold">
                      {inventory.ata_chapter || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Measurement Unit:</span>
                    <span className="font-semibold">
                      {inventory.measurement_unit || "-"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Expiry Date:</span>
                    <span className="font-semibold">
                      {inventory.expiry_date || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Created At:</span>
                    <span className="font-semibold">
                      {inventory.created_at.split("T")[0]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Updated At:</span>
                    <span className="font-semibold">
                      {inventory.updated_at.split("T")[0]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
              <div className="text-[11px] uppercase text-gray-400 mb-3">
                Stock Summary
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">Re-Order Level:</span>
                  <span className="text-base font-semibold text-gray-100">
                    {inventory.re_order_level}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">Quantity in-stock:</span>
                  <span className="text-base font-semibold text-gray-100">
                    {inventory.current_stock}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">Stock Level:</span>
                  <span className={cn("text-base font-semibold", stockLevelColor)}>
                    {inventory.stock_level}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

