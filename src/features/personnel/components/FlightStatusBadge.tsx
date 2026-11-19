import { StatusBadge, type BadgeVariant } from "@/shared/ui/badge/StatusBadge";
import type { FlightStatus } from "../api";

const LABEL: Record<FlightStatus, string> = {
  no_flights: "No flights logged",
  current: "Current",
  due_for_flight: "Due for flight",
  overdue: "Overdue for flight",
};

const VARIANT: Record<FlightStatus, BadgeVariant> = {
  no_flights: "neutral",
  current: "success",
  due_for_flight: "warning",
  overdue: "danger",
};

/**
 * Flight currency as the server computes it (Personnel::flight_status). The
 * server only tracks it for pilots, i.e. personnel with a call sign.
 */
export const FlightStatusBadge = ({ status, isPilot, className }: { status: FlightStatus | null | undefined; isPilot?: boolean; className?: string }) =>
  status ? (
    <StatusBadge variant={VARIANT[status]} label={LABEL[status]} className={className} />
  ) : (
    <StatusBadge variant="neutral" label={isPilot === false ? "Not tracked (no call sign)" : "Not tracked"} className={className} />
  );
