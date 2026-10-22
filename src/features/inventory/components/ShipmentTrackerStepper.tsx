import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type Shipment,
  type ShipmentStatus,
  useSyncShipmentLiveMutation,
} from "../api";

interface ShipmentTrackerStepperProps {
  shipment: Shipment;
  onOpenUpdateModal?: () => void;
  onOpenGrnModal?: () => void;
  canReceiveStock?: boolean;
}

const STAGES: {
  key: ShipmentStatus;
  step: string;
  label: string;
  subtext: string;
  icon: string;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
}[] = [
  {
    key: "picked_up",
    step: "01",
    label: "Picked Up",
    subtext: "Collected by Carrier",
    icon: "mdi:package-variant-closed",
    activeColor: "text-sky-400",
    activeBg: "bg-sky-500/20",
    activeBorder: "border-sky-500/50",
  },
  {
    key: "customs_clearance",
    step: "02",
    label: "Customs Clearance",
    subtext: "Port & Duty Clearance",
    icon: "mdi:shield-check-outline",
    activeColor: "text-amber-400",
    activeBg: "bg-amber-500/20",
    activeBorder: "border-amber-500/50",
  },
  {
    key: "in_transit",
    step: "03",
    label: "In Transit",
    subtext: "En Route to Air Wing",
    icon: "mdi:truck-fast-outline",
    activeColor: "text-indigo-400",
    activeBg: "bg-indigo-500/20",
    activeBorder: "border-indigo-500/50",
  },
  {
    key: "delivered",
    step: "04",
    label: "Delivered",
    subtext: "Arrived at QM Stores",
    icon: "mdi:check-decagram-outline",
    activeColor: "text-emerald-400",
    activeBg: "bg-emerald-500/20",
    activeBorder: "border-emerald-500/50",
  },
];

const STAGE_ORDER: Record<ShipmentStatus, number> = {
  picked_up: 1,
  customs_clearance: 2,
  in_transit: 3,
  delivered: 4,
};

export const ShipmentTrackerStepper: React.FC<ShipmentTrackerStepperProps> = ({
  shipment,
  onOpenUpdateModal,
  onOpenGrnModal,
  canReceiveStock = true,
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const [showHistory, setShowHistory] = useState(false);

  const [syncShipmentLive, { isLoading: isSyncing }] =
    useSyncShipmentLiveMutation();

  const currentLevel = STAGE_ORDER[shipment.status] || 1;

  const handleSyncLive = async () => {
    try {
      await syncShipmentLive(shipment.id).unwrap();
      dispatch(
        showToast({
          message: "Shipment status refreshed from carrier tracking.",
          type: "success",
        }),
      );
    } catch {
      dispatch(
        showToast({
          message: "Could not sync live carrier tracking.",
          type: "error",
        }),
      );
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-5 shadow-sm transition-all",
        isDark
          ? "bg-[#001219] border-[#0A4D66]/40"
          : "bg-white border-slate-200",
      )}
    >
      {/* Header with Tracking Info, Carrier, and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#0A4D66]/20">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#0A4D66]/20 border border-[#7FD5FF]/30 text-[#7FD5FF] shrink-0">
            <Icon icon="mdi:airplane-takeoff" className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-[var(--theme-text-muted)]">
                Shipment Tracking
              </span>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                AWB: {shipment.tracking_number}
              </span>
              {shipment.carrier_name && (
                <span className="text-xs px-2 py-0.5 rounded bg-[#0A4D66]/20 text-[#7FD5FF] border border-[#0A4D66]/40">
                  {shipment.carrier_name}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-[var(--theme-text-primary)] mt-0.5">
              {shipment.origin || "Supplier Facility"} &rarr;{" "}
              {shipment.destination || "NAA Aviation Base"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleSyncLive}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-[#7FD5FF]/40 text-[#7FD5FF] hover:bg-[#0A4D66]/30 disabled:opacity-50 transition-colors"
            title="Query TrackingMore live carrier tracking"
          >
            <Icon
              icon={isSyncing ? "mdi:loading" : "mdi:refresh"}
              className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")}
            />
            <span>{isSyncing ? "Syncing..." : "Live Sync"}</span>
          </button>

          {onOpenUpdateModal && (
            <button
              type="button"
              onClick={onOpenUpdateModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-[#0A4D66]/30 text-white hover:bg-[#0A4D66]/50 transition-colors"
            >
              <Icon icon="mdi:square-edit-outline" className="w-3.5 h-3.5" />
              <span>Update Status</span>
            </button>
          )}

          {shipment.status === "delivered" && canReceiveStock && onOpenGrnModal && (
            <button
              type="button"
              onClick={onOpenGrnModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors animate-pulse"
            >
              <Icon icon="mdi:package-check" className="w-4 h-4" />
              <span>Receive Stock (GRN)</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Milestone Interactive Visual Stepper */}
      <div className="pt-6 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {STAGES.map((stage) => {
            const stageLevel = STAGE_ORDER[stage.key];
            const isCompleted = currentLevel > stageLevel;
            const isCurrent = currentLevel === stageLevel;

            return (
              <div
                key={stage.key}
                className={cn(
                  "relative p-3.5 rounded-xl border transition-all flex flex-col justify-between",
                  isCurrent
                    ? `${stage.activeBg} ${stage.activeBorder} shadow-sm ring-1 ring-sky-400/30`
                    : isCompleted
                    ? isDark
                      ? "bg-emerald-500/5 border-emerald-500/30"
                      : "bg-emerald-50 border-emerald-200"
                    : isDark
                    ? "bg-[#001825]/60 border-[#0A4D66]/20 opacity-70"
                    : "bg-slate-50 border-slate-200 opacity-70",
                )}
              >
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold",
                        isCompleted
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-[#7FD5FF] text-black font-extrabold animate-pulse"
                          : "bg-gray-700 text-gray-300",
                      )}
                    >
                      {isCompleted ? (
                        <Icon icon="mdi:check" className="w-4 h-4" />
                      ) : (
                        stage.step
                      )}
                    </span>
                    <Icon
                      icon={stage.icon}
                      className={cn(
                        "w-4 h-4",
                        isCurrent
                          ? stage.activeColor
                          : isCompleted
                          ? "text-emerald-400"
                          : "text-gray-400",
                      )}
                    />
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      isCurrent
                        ? `${stage.activeBg} ${stage.activeColor} ${stage.activeBorder}`
                        : isCompleted
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-gray-800 text-gray-400 border-gray-700",
                    )}
                  >
                    {isCurrent ? "Current" : isCompleted ? "Cleared" : "Pending"}
                  </span>
                </div>

                <div>
                  <h4
                    className={cn(
                      "text-xs font-bold",
                      isCurrent
                        ? "text-white"
                        : isCompleted
                        ? "text-emerald-300"
                        : "text-[var(--theme-text-muted)]",
                    )}
                  >
                    {stage.label}
                  </h4>
                  <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
                    {stage.subtext}
                  </p>
                </div>

                {/* Specific Stage Details (Customs reference, date, etc.) */}
                <div className="mt-3 pt-2 border-t border-[#0A4D66]/20 text-[11px]">
                  {stage.key === "picked_up" && (
                    <span className="text-[var(--theme-text-secondary)]">
                      {shipment.picked_up_at
                        ? formatDate(shipment.picked_up_at)
                        : "Awaiting Carrier"}
                    </span>
                  )}
                  {stage.key === "customs_clearance" && (
                    <div>
                      <span className="text-[var(--theme-text-secondary)]">
                        {shipment.customs_cleared_at
                          ? formatDate(shipment.customs_cleared_at)
                          : "Border Processing"}
                      </span>
                      {shipment.customs_reference && (
                        <p className="font-mono text-[10px] text-amber-400 truncate">
                          Ref: {shipment.customs_reference}
                        </p>
                      )}
                    </div>
                  )}
                  {stage.key === "in_transit" && (
                    <span className="text-[var(--theme-text-secondary)]">
                      {shipment.in_transit_at
                        ? formatDate(shipment.in_transit_at)
                        : "En Route"}
                    </span>
                  )}
                  {stage.key === "delivered" && (
                    <span className="text-[var(--theme-text-secondary)]">
                      {shipment.delivered_at
                        ? formatDate(shipment.delivered_at)
                        : `Est: ${formatDate(shipment.estimated_delivery_date)}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Latest Event Banner & History Toggle */}
      <div className="mt-4 pt-3 border-t border-[#0A4D66]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[var(--theme-text-secondary)]">
          <Icon icon="mdi:information-outline" className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-medium truncate max-w-xl">
            Latest:{" "}
            <span className="text-[var(--theme-text-primary)]">
              {shipment.latest_event_description ||
                "Tracking registered. Awaiting carrier checkpoint scans."}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((prev) => !prev)}
          className="text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <span>
            {showHistory ? "Hide Scans" : `Checkpoint Scans (${shipment.checkpoints?.length || 0})`}
          </span>
          <Icon
            icon={showHistory ? "mdi:chevron-up" : "mdi:chevron-down"}
            className="w-4 h-4"
          />
        </button>
      </div>

      {/* Checkpoints Timeline Drawer */}
      {showHistory && (
        <div className="mt-4 pt-4 border-t border-[#0A4D66]/20 space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-muted)] mb-3">
            Carrier Checkpoint Timeline
          </h5>
          {!shipment.checkpoints || shipment.checkpoints.length === 0 ? (
            <p className="text-xs text-[var(--theme-text-muted)] italic">
              No detailed checkpoint records logged yet.
            </p>
          ) : (
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#0A4D66]/40">
              {shipment.checkpoints.map((cp) => (
                <div key={cp.id} className="relative pl-7 text-xs">
                  <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-sky-400 ring-4 ring-[#001219]" />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold text-[var(--theme-text-primary)]">
                      {formatDate(cp.checkpoint_time)}
                    </span>
                    {cp.location && (
                      <span className="text-sky-400 font-semibold">
                        • {cp.location}
                      </span>
                    )}
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#0A4D66]/30 text-[#7FD5FF]">
                      {cp.status_stage.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[var(--theme-text-secondary)] mt-0.5">
                    {cp.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
