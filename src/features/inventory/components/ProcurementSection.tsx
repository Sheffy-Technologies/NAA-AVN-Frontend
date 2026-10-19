import React from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import {
  ProcurementOverviewTab,
  type ProcurementSubTabKey,
} from "./ProcurementOverviewTab";
import { ProcurementPartRequisitionsTab } from "./ProcurementPartRequisitionsTab";
import { ProcurementQuotationsTab } from "./ProcurementQuotationsTab";
import { ProcurementPurchaseOrdersTab } from "./ProcurementPurchaseOrdersTab";
import { ProcurementStockReceivedTab } from "./ProcurementStockReceivedTab";
import { ProcurementStockIssuedTab } from "./ProcurementStockIssuedTab";
import { ProcurementPipelineKanbanTab } from "./ProcurementPipelineKanbanTab";

export { type ProcurementSubTabKey };

export const PROCUREMENT_SUB_TABS = [
  {
    id: "overview" as const,
    label: "Overview",
    icon: "mdi:view-dashboard-outline",
  },
  {
    id: "pipeline" as const,
    label: "Pipeline",
    icon: "mdi:view-column-outline",
  },
  {
    id: "part-requisitions" as const,
    label: "Part Requisitions",
    icon: "mdi:wrench-clock",
  },
  {
    id: "quotations" as const,
    label: "Quotations",
    icon: "mdi:cash-multiple",
  },
  {
    id: "purchase-orders" as const,
    label: "Purchase Orders",
    icon: "mdi:cart-outline",
  },
  {
    id: "stock-received" as const,
    label: "Stock Received",
    icon: "mdi:package-check",
  },
  {
    id: "stock-issued" as const,
    label: "Stock Issued",
    icon: "mdi:arrow-top-right-bold-box-outline",
  },
] as const;

interface ProcurementSectionProps {
  activeSubTab: ProcurementSubTabKey;
  onSelectSubTab: (subTab: ProcurementSubTabKey) => void;
  onNavigateToRfq?: (rfqId: number) => void;
}

export const ProcurementSection: React.FC<ProcurementSectionProps> = ({
  activeSubTab,
  onSelectSubTab,
  onNavigateToRfq,
}) => {
  const { isDark } = useTheme();

  return (
    <div className="space-y-6">
      {/* Maintenance Hub Style Secondary Sub-Navigation Pill Bar */}
      <div className="flex items-center justify-between overflow-x-auto pb-1 scrollbar-thin">
        <div
          className={cn(
            "flex items-center space-x-1 p-1 rounded-xl border",
            isDark
              ? "bg-[#0A4D66] border-[#0A4D66]"
              : "bg-slate-200 border-slate-300",
          )}
        >
          {PROCUREMENT_SUB_TABS.map((subTab) => {
            const isActive = activeSubTab === subTab.id;
            return (
              <button
                key={subTab.id}
                type="button"
                onClick={() => onSelectSubTab(subTab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  isActive
                    ? isDark
                      ? "bg-[#001825] text-[#7FD5FF] font-bold shadow-md border border-[#7FD5FF]/50"
                      : "bg-white text-sky-700 font-bold shadow-md border border-slate-300"
                    : isDark
                      ? "text-gray-200 hover:text-white"
                      : "text-slate-600 hover:text-slate-900",
                )}
              >
                <Icon
                  icon={subTab.icon}
                  className={cn(
                    "w-4 h-4",
                    isActive
                      ? isDark
                        ? "text-[#7FD5FF]"
                        : "text-sky-700"
                      : isDark
                        ? "text-gray-300"
                        : "text-slate-500",
                  )}
                />
                <span>{subTab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtab Content Panels */}
      {activeSubTab === "overview" && (
        <ProcurementOverviewTab
          onNavigateSubTab={onSelectSubTab}
          onOpenCreateRfq={() => onSelectSubTab("quotations")}
        />
      )}

      {activeSubTab === "pipeline" && (
        <ProcurementPipelineKanbanTab onNavigateSubTab={onSelectSubTab} />
      )}

      {activeSubTab === "part-requisitions" && (
        <ProcurementPartRequisitionsTab onNavigateToRfq={onNavigateToRfq} />
      )}

      {activeSubTab === "quotations" && <ProcurementQuotationsTab />}

      {activeSubTab === "purchase-orders" && <ProcurementPurchaseOrdersTab />}

      {activeSubTab === "stock-received" && <ProcurementStockReceivedTab />}

      {activeSubTab === "stock-issued" && <ProcurementStockIssuedTab />}
    </div>
  );
};
