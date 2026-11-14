import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { Modal } from "@/shared/ui/modal";
import { SqTable } from "@/features/safety/components/sqUi";
import { useGetVmsVisitorQuery, vmsErrorMessage, type VmsVisitorDetails } from "../api";
import { BadgeStatusBadge, VisitStatusBadge } from "./VmsCharts";
import { formatMinutes, formatVmsDate, formatVmsDateTime, formatVmsTime, visitDurationMinutes } from "../vmsHelpers";

type Visit = VmsVisitorDetails["visits"][number];

/** A VMS visitor and every visit they have made. Opening one is recorded in the activity log. */
export const VisitorDetailsModal = ({ visitorId, onClose }: { visitorId: string | null; onClose: () => void }) => {
  const { isDark } = useTheme();
  const { data, isFetching, isError, error } = useGetVmsVisitorQuery(visitorId ?? "", { skip: !visitorId });
  const muted = isDark ? "text-gray-400" : "text-slate-500";

  const visits = [...(data?.visits ?? [])].sort((a, b) => (b.scheduled_date ?? "").localeCompare(a.scheduled_date ?? ""));

  return (
    <Modal open={!!visitorId} onClose={onClose} title="Visitor" className="max-w-4xl max-h-[85vh] overflow-y-auto">
      {isFetching && !data ? (
        <div className={cn("py-10 text-center text-xs", muted)}>
          <Icon icon="mdi:loading" className="mr-2 inline h-4 w-4 animate-spin" />
          Loading from the visitor management system…
        </div>
      ) : isError ? (
        <div className="py-10 text-center text-xs text-red-500">{vmsErrorMessage(error)}</div>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={data.full_name} />
            <Field label="Organisation" value={data.visitor_organization || "Not stated"} />
            <Field label="Registered" value={formatVmsDateTime(data.created_at)} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0A4D66] dark:text-[#7FD5FF]">
              Visits ({visits.length})
            </h3>
            <SqTable<Visit>
              rows={visits}
              rowKey={(v) => v.id}
              empty="No visits recorded for this visitor."
              columns={[
                { key: "date", label: "Scheduled", render: (v) => formatVmsDate(v.scheduled_date) },
                { key: "purpose", label: "Purpose", render: (v) => v.purpose || "—" },
                { key: "in", label: "In", render: (v) => formatVmsTime(v.check_in_time) },
                { key: "out", label: "Out", render: (v) => formatVmsTime(v.check_out_time) },
                {
                  key: "duration",
                  label: "Time on site",
                  render: (v) => formatMinutes(visitDurationMinutes(v.check_in_time, v.check_out_time)),
                },
                {
                  key: "badges",
                  label: "Badges",
                  render: (v) =>
                    v.badges.length ? (
                      <div className="flex flex-wrap gap-1">
                        {v.badges.map((b, i) => (
                          <BadgeStatusBadge key={`${b.badge_number}-${i}`} status={b.badge_status} number={b.badge_number} />
                        ))}
                      </div>
                    ) : (
                      "—"
                    ),
                },
                { key: "status", label: "Status", render: (v) => <VisitStatusBadge status={v.status} /> },
              ]}
            />
          </div>
          <p className={cn("text-[11px]", muted)}>
            Contact, identity-document and photo details stay in the visitor management system and are not shared with this system.
          </p>
        </div>
      ) : null}
    </Modal>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => {
  const { isDark } = useTheme();
  return (
    <div className={cn("rounded-lg border px-3 py-2", isDark ? "border-[#0A4D66]/40 bg-[#001219]" : "border-slate-200 bg-slate-50")}>
      <div className={cn("text-[10px] uppercase tracking-wide", isDark ? "text-gray-400" : "text-slate-500")}>{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>{value}</div>
    </div>
  );
};
