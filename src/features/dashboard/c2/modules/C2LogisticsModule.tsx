import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import {
  useGetInventoriesQuery,
  useGetShipmentsQuery,
  useGetPurchaseOrdersQuery,
} from "@/features/inventory/api";
import { useGetUnserviceableSparesQuery } from "@/features/maintenance/api";

export const C2LogisticsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "unserviceable" | "shipments">("overview");

  const { data: inventoryData, isLoading: loadingInventory } = useGetInventoriesQuery({ per_page: 50 });
  const { data: shipmentsData, isLoading: loadingShipments } = useGetShipmentsQuery({ per_page: 10 });
  const { data: unserviceableData, isLoading: loadingUnserviceable } = useGetUnserviceableSparesQuery();
  const { data: poData } = useGetPurchaseOrdersQuery({ per_page: 20 });

  const inventoryItems = inventoryData?.data || [];
  const shipments = shipmentsData?.data || [];
  const unserviceableSpares = unserviceableData?.data || [];
  const purchaseOrders = poData?.data || [];

  // Metrics
  const lowStockItems = inventoryItems.filter(
    (i: any) => i.current_stock !== undefined && i.reorder_level !== undefined && i.current_stock <= i.reorder_level
  );
  const activeShipments = shipments.filter(
    (s: any) => s.status === "in_transit" || s.status === "customs_clearance" || s.status === "picked_up"
  );
  const unserviceableCount = unserviceableSpares.length;
  const inOverhaulCount = unserviceableSpares.filter((s: any) => s.disposition === "sent_for_overhaul" || s.disposition === "sent_for_repair").length;
  const pendingPOs = purchaseOrders.filter((po: any) => po.status === "pending" || po.status === "approved");

  return (
    <div className="h-full flex flex-col space-y-3 p-3 overflow-y-auto text-xs">
      {/* KPI Ribbon */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 rounded-xl border border-teal-500/30 bg-teal-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Serviceable Stock</span>
          <span className="text-lg font-black text-teal-300 mt-0.5 block">
            {loadingInventory ? "..." : inventoryItems.length}
          </span>
          <span className="text-[10px] text-teal-400">Available line items</span>
        </div>

        <div className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Unserviceable</span>
          <span className="text-lg font-black text-rose-400 mt-0.5 block">
            {loadingUnserviceable ? "..." : unserviceableCount}
          </span>
          <span className="text-[10px] text-rose-300">{inOverhaulCount} at external MRO</span>
        </div>

        <div className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Active AWBs</span>
          <span className="text-lg font-black text-sky-400 mt-0.5 block">
            {loadingShipments ? "..." : activeShipments.length}
          </span>
          <span className="text-[10px] text-sky-300">In transit &middot; consignments</span>
        </div>

        <div className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Critical / Low Stock</span>
          <span className="text-lg font-black text-amber-300 mt-0.5 block">
            {lowStockItems.length}
          </span>
          <span className="text-[10px] text-amber-400">Reorder trigger hit</span>
        </div>
      </div>

      {/* Internal Navigation Filter */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-[#0A4D66]/30">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
            activeTab === "overview"
              ? "bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm"
              : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
          )}
        >
          Critical Spares &amp; POs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("unserviceable")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1",
            activeTab === "unserviceable"
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm"
              : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
          )}
        >
          <span>Unserviceable Register</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/30 text-rose-200">
            {unserviceableCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("shipments")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1",
            activeTab === "shipments"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm"
              : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white"
          )}
        >
          <span>Active Air Waybills</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500/30 text-sky-200">
            {activeShipments.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Critical Spares & POs */}
      {activeTab === "overview" && (
        <div className="space-y-2 flex-1">
          {/* Critical Inventory Alert Box */}
          <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-amber-300 flex items-center gap-1 text-[11px]">
                <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 text-amber-400" />
                Critical Low-Stock Spares
              </span>
              <span className="text-[10px] text-gray-400">{lowStockItems.length} require requisition</span>
            </div>
            {lowStockItems.length === 0 ? (
              <p className="text-[11px] text-emerald-400 font-medium">All strategic spares meet standard threshold levels.</p>
            ) : (
              <div className="space-y-1 mt-1 max-h-28 overflow-y-auto pr-1">
                {lowStockItems.slice(0, 4).map((item: any) => (
                  <div key={item.id} className="p-1.5 rounded-lg bg-[#001825]/80 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-semibold text-white">{item.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono ml-1.5">P/N: {item.part_number || "N/A"}</span>
                    </div>
                    <span className="text-rose-400 font-mono font-bold">
                      {item.current_stock ?? 0} left (Min: {item.reorder_level ?? 1})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Purchase Orders */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
              Pending Procurement Purchase Orders ({pendingPOs.length})
            </span>
            {pendingPOs.length === 0 ? (
              <div className="p-3 text-center text-gray-500 border border-dashed border-[#0A4D66]/30 rounded-xl">
                No open purchase orders currently pending
              </div>
            ) : (
              pendingPOs.slice(0, 3).map((po: any) => (
                <div key={po.id} className="p-2 rounded-xl border border-[#0A4D66]/40 bg-[#001825] flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-white font-mono">{po.po_number || `PO-${po.id}`}</span>
                    <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{po.supplier?.name || "Aviation OEM Supplier"}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {po.status || "Pending"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Unserviceable Register */}
      {activeTab === "unserviceable" && (
        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {loadingUnserviceable ? (
            <div className="text-center text-gray-500 py-4">Loading unserviceable spares...</div>
          ) : unserviceableSpares.length === 0 ? (
            <div className="p-4 text-center text-gray-400 border border-dashed border-[#0A4D66]/30 rounded-xl">
              No unserviceable components currently logged
            </div>
          ) : (
            unserviceableSpares.slice(0, 5).map((spare: any) => (
              <div
                key={spare.id}
                className="p-2 rounded-xl border border-rose-500/30 bg-[#001825] flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-[11px]">{spare.part_name}</span>
                    <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-[#0A4D66]/40 text-sky-300 border border-[#0A4D66]/50">
                      {spare.aircraft_registration}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-400">
                    P/N: {spare.part_number} &middot; S/N: {spare.serial_number}
                  </div>
                  <div className="text-[9px] text-gray-400">
                    TSN: <span className="text-gray-200">{spare.tsn_hours ?? 0}h</span> &middot; TSO:{" "}
                    <span className="text-gray-200">{spare.tso_hours ?? 0}h</span> &middot; Reason:{" "}
                    <span className="text-rose-300">{spare.reason_for_removal}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase border block",
                      spare.disposition === "sent_for_overhaul" || spare.disposition === "sent_for_repair"
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                        : spare.disposition === "scrapped"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    )}
                  >
                    {spare.disposition?.replace(/_/g, " ") || "In Stores"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Active Air Waybills & Cargo Manifest */}
      {activeTab === "shipments" && (
        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {loadingShipments ? (
            <div className="text-center text-gray-500 py-4">Loading active shipments...</div>
          ) : shipments.length === 0 ? (
            <div className="p-4 text-center text-gray-400 border border-dashed border-[#0A4D66]/30 rounded-xl">
              No shipments found
            </div>
          ) : (
            shipments.slice(0, 5).map((shp: any) => {
              const cargoItems: any[] = Array.isArray(shp.cargo_manifest) ? shp.cargo_manifest : [];
              return (
                <div
                  key={shp.id}
                  className="p-2 rounded-xl border border-sky-500/30 bg-[#001825] flex flex-col space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon icon="mdi:truck-delivery-outline" className="w-4 h-4 text-sky-400" />
                      <span className="font-bold text-white font-mono text-[11px]">{shp.tracking_number}</span>
                      <span className="text-[10px] text-gray-400">({shp.carrier_name || "DHL Express"})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/40">
                      {shp.status?.replace(/_/g, " ") || "In Transit"}
                    </span>
                  </div>

                  <div className="text-[10px] text-gray-300 flex items-center justify-between">
                    <span>
                      {shp.origin || "Supplier Hub"} &rarr; {shp.destination || "HQ NA AVN GIRI"}
                    </span>
                    {shp.estimated_delivery && (
                      <span className="text-gray-400">ETA: {new Date(shp.estimated_delivery).toLocaleDateString()}</span>
                    )}
                  </div>

                  {/* Cargo Manifest preview */}
                  {cargoItems.length > 0 && (
                    <div className="pt-1 border-t border-[#0A4D66]/30 flex flex-wrap gap-1">
                      {cargoItems.slice(0, 3).map((item, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-1.5 py-0.2 rounded text-[9px] bg-sky-500/10 text-sky-200 border border-sky-500/20"
                        >
                          {item.part_name || item.name} ({item.quantity ?? 1}x)
                        </span>
                      ))}
                      {cargoItems.length > 3 && (
                        <span className="text-[9px] text-gray-400">+{cargoItems.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

