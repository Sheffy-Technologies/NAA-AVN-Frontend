import { cn } from "@/shared/utils/cn";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import type { TrackerComputed, TrackerStatus } from "./api";
import { STATUS_LABEL, type Help } from "./trackerHelpers";

/* The tracker's small shared components, styled by trackerTheme.ts: status pill, life meter, column header and field label with their ⓘ. */

/** Status ⇒ the HTML tracker's pill class. */
const PILL: Record<TrackerStatus, string> = {
  overdue: "over",
  due_soon: "soon",
  watch: "watch",
  ok: "ok",
  no_data: "nodata",
  completed: "done",
  on_condition: "cond",
  daily: "daily",
};

export const StatusPill = ({ status, children, className }: { status: TrackerStatus; children?: React.ReactNode; className?: string }) => (
  <span className={cn("mt-pill", PILL[status], className)}>{children ?? STATUS_LABEL[status]}</span>
);

/** How much of the life or interval is left, as a bar. */
export const LifeMeter = ({ tracking }: { tracking: TrackerComputed }) => {
  if (tracking.percent_remaining === null) return null;
  const pct = Math.round(tracking.percent_remaining * 100);
  const tone = { overdue: "over", due_soon: "soon", watch: "watch", ok: "ok" }[tracking.status as string] ?? "ok";
  return (
    <div className={cn("mt-meter", `m-${tone}`)} title={`${pct}% left`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
};

/** A column header with its ⓘ. */
export const HelpHeader = ({ label, help, align, className }: { label: string; help?: Help; align?: "right"; className?: string }) => (
  <th className={cn(align === "right" && "n", className)}>
    {label}
    {help && (
      <InfoTip title={help.title} formula={help.formula}>
        {help.text}
      </InfoTip>
    )}
  </th>
);

export const FieldLabel = ({ label, help }: { label: string; help?: Help }) => (
  <label className="mt-label">
    {label}
    {help && (
      <InfoTip title={help.title} formula={help.formula}>
        {help.text}
      </InfoTip>
    )}
  </label>
);
