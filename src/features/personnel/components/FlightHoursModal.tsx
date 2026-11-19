import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import Modal from "@/shared/ui/modal/Modal";
import { AppTabs } from "@/shared/ui/tabs/AppTabs";
import { SecondaryButton, SqTable } from "@/features/safety/components/sqUi";
import { downloadCsvFile } from "@/shared/utils/csv";
import { downloadListPdf } from "@/shared/documents/listPdf";
import {
  useGetPersonnelFlightHoursQuery,
  type PersonnelExperienceRow,
  type PersonnelFlightRow,
} from "../api";
import { FlightStatusBadge } from "./FlightStatusBadge";

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const hrs = (n: number) => `${Number(n.toFixed(2))} h`;
const aircraftLabel = (name: string | null, tail: string | null) =>
  [name, tail && tail !== name ? `(${tail})` : null].filter(Boolean).join(" ") || "—";

/**
 * Every flight and prior-experience entry behind a person's total flight
 * hours. Operations and aircraft open their own pages.
 */
export const FlightHoursModal = ({
  personnelId,
  personName,
  open,
  onClose,
}: {
  personnelId: number | string;
  personName: string;
  open: boolean;
  onClose: () => void;
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"flights" | "experience">("flights");
  const { data, isLoading, isError, refetch } = useGetPersonnelFlightHoursQuery(personnelId, { skip: !open });
  const muted = isDark ? "text-gray-400" : "text-slate-500";
  const card = isDark ? "border-[#0A4D66]/40 bg-[#001219]" : "border-slate-200 bg-slate-50";

  const go = (path: string) => {
    onClose();
    navigate(path, { state: { from: `/dashboard/personnel/${personnelId}`, fromLabel: personName } });
  };

  const flightRows = (rows: PersonnelFlightRow[]) =>
    rows.map((f) => [
      f.date ?? "",
      f.operation_name + (f.operation_deleted ? " (deleted)" : ""),
      aircraftLabel(f.asset_name, f.tail_number),
      f.role === "pilot" ? "Pilot" : "Co-pilot",
      f.other_crew ?? "",
      String(f.hours),
      f.landings !== null ? String(f.landings) : "",
      f.logged_to_aircraft ? "Yes" : "No",
    ]);
  const FLIGHT_HEADERS = ["Date", "Operation", "Aircraft", "Role", "With", "Hours", "Landings", "Logged to aircraft"];

  const exportFile = (format: "csv" | "pdf") => {
    if (!data) return;
    const rows = flightRows(data.flights);
    const experience = data.experience.map((e) => [
      "",
      "Prior experience" + (e.notes ? `: ${e.notes}` : ""),
      aircraftLabel(e.asset_name, e.tail_number),
      "",
      "",
      String(e.hours),
      "",
      "",
    ]);
    const all = [...rows, ...experience, ["", "TOTAL", "", "", "", String(data.total_hours), "", ""]];
    const name = `Flight hours ${personName}`;
    if (format === "csv") downloadCsvFile(`${name}.csv`, [FLIGHT_HEADERS, ...all]);
    else
      void downloadListPdf({
        title: `Flight hours: ${personName}`,
        subtitle: `${hrs(data.flight_hours)} from operations + ${hrs(data.experience_hours)} prior experience = ${hrs(data.total_hours)}`,
        fileName: name,
        headers: FLIGHT_HEADERS,
        rows: all,
        widths: [1, 2.4, 1.6, 0.8, 1.5, 0.7, 0.7, 0.9],
      });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Flight hours · ${personName}`} className="max-w-5xl max-h-[90vh] overflow-y-auto">
      {isLoading ? (
        <div className={cn("py-10 text-center text-sm", muted)}>
          <Icon icon="mdi:loading" className="mr-2 inline h-4 w-4 animate-spin" />
          Loading flights…
        </div>
      ) : isError || !data ? (
        <div className={cn("py-10 text-center text-sm", muted)}>
          Couldn't load the flight record.{" "}
          <button type="button" className="underline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          {/* How the total is made up */}
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["From operations", hrs(data.flight_hours), `${data.flights.length} flight${data.flights.length === 1 ? "" : "s"}`],
              ["Prior experience", hrs(data.experience_hours), `${data.experience.length} entr${data.experience.length === 1 ? "y" : "ies"}`],
              ["Total flight hours", hrs(data.total_hours), "Operations + prior experience"],
            ].map(([label, value, sub]) => (
              <div key={label} className={cn("rounded-lg border p-3", card)}>
                <div className={cn("text-[10px] uppercase tracking-wide", muted)}>{label}</div>
                <div className="mt-0.5 text-lg font-bold">{value}</div>
                <div className={muted}>{sub}</div>
              </div>
            ))}
            <div className={cn("rounded-lg border p-3", card)}>
              <div className={cn("text-[10px] uppercase tracking-wide", muted)}>Flight status</div>
              <div className="mt-1">
                <FlightStatusBadge status={data.currency.flight_status} isPilot={data.currency.is_pilot} />
              </div>
              <div className={cn("mt-1", muted)}>
                {data.currency.next_flight_due_date ? `Fly by ${fmtDate(data.currency.next_flight_due_date)}` : "No flight logged yet"}
              </div>
            </div>
          </div>

          {data.by_aircraft.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.by_aircraft.map((a) => (
                <button
                  key={a.asset_id ?? "none"}
                  type="button"
                  disabled={!a.asset_id}
                  onClick={() => a.asset_id && go(`/dashboard/assets/${a.asset_id}`)}
                  className={cn("rounded-full border px-3 py-1 text-left transition-colors", card, a.asset_id && "hover:border-sky-500")}
                  title="Open the aircraft"
                >
                  <span className="font-semibold">{aircraftLabel(a.asset_name, a.tail_number)}</span>
                  <span className={cn("ml-2", muted)}>
                    {hrs(a.hours)} · {a.flights} flight{a.flights === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <AppTabs
              tabs={[
                { id: "flights" as const, label: `Operation flights (${data.flights.length})`, icon: "mdi:airplane" },
                { id: "experience" as const, label: `Prior experience (${data.experience.length})`, icon: "mdi:history" },
              ]}
              activeTab={tab}
              onChange={setTab}
              size="sm"
            />
            <div className="flex gap-2">
              <SecondaryButton icon="mdi:file-delimited-outline" onClick={() => exportFile("csv")}>
                Export CSV
              </SecondaryButton>
              <SecondaryButton icon="mdi:file-pdf-box" onClick={() => exportFile("pdf")}>
                Export PDF
              </SecondaryButton>
            </div>
          </div>

          {tab === "flights" ? (
            <SqTable<PersonnelFlightRow>
              rows={data.flights}
              rowKey={(f) => f.id}
              onRowClick={(f) => f.can_open && go(`/dashboard/operations/${f.operation_id}`)}
              empty="Not assigned as pilot or co-pilot on any operation yet."
              columns={[
                { key: "date", label: "Date", render: (f) => fmtDate(f.date) },
                {
                  key: "op",
                  label: "Operation",
                  render: (f) => (
                    <div>
                      <span className={cn("font-semibold", f.can_open && "text-sky-500 hover:underline")}>{f.operation_name}</span>
                      <div className={cn("text-[11px]", muted)}>
                        {[
                          f.operation_status,
                          f.operation_deleted ? "operation deleted" : null,
                          !f.can_open && !f.operation_deleted ? "outside your units" : null,
                          !f.is_flight ? "not marked as a flight" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "aircraft",
                  label: "Aircraft",
                  render: (f) =>
                    f.asset_id ? (
                      <button type="button" className="text-sky-500 hover:underline" onClick={() => go(`/dashboard/assets/${f.asset_id}`)}>
                        {aircraftLabel(f.asset_name, f.tail_number)}
                      </button>
                    ) : (
                      "—"
                    ),
                },
                { key: "role", label: "Role", render: (f) => (f.role === "pilot" ? "Pilot" : "Co-pilot") },
                { key: "with", label: "With", render: (f) => f.other_crew ?? "—" },
                {
                  key: "hours",
                  label: "Hours",
                  align: "right",
                  render: (f) => (
                    <div>
                      <div className="font-semibold">{hrs(f.hours)}</div>
                      {f.hours_source === "times" && <div className={cn("text-[11px]", muted)}>from takeoff/landing</div>}
                    </div>
                  ),
                },
                { key: "landings", label: "Landings", align: "right", render: (f) => (f.landings ?? "—") },
                {
                  key: "logged",
                  label: "Logged to aircraft",
                  render: (f) =>
                    f.logged_to_aircraft ? (
                      <span className="text-emerald-500">Yes</span>
                    ) : (
                      <span className={muted} title="The hours count toward the crew's total but not yet toward the aircraft's hours">
                        Not yet
                      </span>
                    ),
                },
              ]}
            />
          ) : (
            <SqTable<PersonnelExperienceRow>
              rows={data.experience}
              rowKey={(e) => e.id}
              empty="No prior flight experience recorded."
              columns={[
                {
                  key: "aircraft",
                  label: "Aircraft / platform",
                  render: (e) =>
                    e.asset_id ? (
                      <button type="button" className="text-sky-500 hover:underline" onClick={() => go(`/dashboard/assets/${e.asset_id}`)}>
                        {aircraftLabel(e.asset_name, e.tail_number)}
                      </button>
                    ) : (
                      aircraftLabel(e.asset_name, e.tail_number)
                    ),
                },
                { key: "op", label: "Operational", align: "right", render: (e) => (e.operational_hours !== null ? hrs(e.operational_hours) : "—") },
                { key: "tr", label: "Training", align: "right", render: (e) => (e.training_hours !== null ? hrs(e.training_hours) : "—") },
                { key: "hours", label: "Hours", align: "right", render: (e) => <span className="font-semibold">{hrs(e.hours)}</span> },
                { key: "notes", label: "Notes", render: (e) => e.notes ?? "—" },
                { key: "recorded", label: "Recorded", render: (e) => fmtDate(e.recorded_at) },
              ]}
            />
          )}

          <p className={cn("text-[11px]", muted)}>
            Hours from operations come from the crew assignments on each operation (the hours entered, or the takeoff and landing times on older
            records). Prior experience is the hours entered on the personnel record. Only operations marked as flights move the last-flight date
            used for flight status.
          </p>
        </div>
      )}
    </Modal>
  );
};
