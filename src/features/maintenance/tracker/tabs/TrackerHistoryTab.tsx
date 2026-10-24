import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { useGetTrackerLogsQuery } from "../api";
import { useTrackerClasses } from "../trackerHelpers";
import { HelpHeader } from "../trackerUi";

const ACTION_LABEL: Record<string, string> = {
  compliance: "Compliance",
  replacement: "Replacement",
  phase_cycle: "Phase cycle",
  work_order: "Work order",
  counters: "Counters",
  voucher: "Voucher",
  other: "Other",
};

export const TrackerHistoryTab = ({ assetId }: { assetId: number | null }) => {
  const c = useTrackerClasses();
  const [allAircraft, setAllAircraft] = useState(false);
  const { data: logs = [], isLoading } = useGetTrackerLogsQuery(allAircraft || !assetId ? undefined : { asset_id: assetId });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className={cn("flex items-center gap-1.5 text-xs", c.muted)}>
          <input type="checkbox" checked={allAircraft} onChange={(e) => setAllAircraft(e.target.checked)} /> All aircraft
        </label>
      </div>
      <div className={c.tableWrap}>
        <table style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <HelpHeader label="When" />
              <HelpHeader label="Aircraft" />
              <HelpHeader label="Type" />
              <HelpHeader label="Item" />
              <HelpHeader
                label="Entry"
                help={{ title: "Entry", text: "What was recorded: a replacement (S/N off → on), compliance at a reading or date, a completed phase cycle, a closed work order, or a counter update." }}
              />
              <HelpHeader label="By" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="mt-empty">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="mt-empty">
                  Compliance and replacement records will appear here.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} >
                <td className={cn(c.td, "whitespace-nowrap")}>{l.created_at.slice(0, 16).replace("T", " ")}</td>
                <td>{l.asset?.tail_number ?? l.asset?.name ?? "–"}</td>
                <td>{ACTION_LABEL[l.action] ?? l.action}</td>
                <td>{l.item_label}</td>
                <td>{l.entry}</td>
                <td>{l.user ? [l.user.firstname, l.user.lastname].filter(Boolean).join(" ") : "System"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
