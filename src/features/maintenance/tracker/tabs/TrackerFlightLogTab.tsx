import { useMemo, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useDeleteTrackerFlightMutation, useGetTrackerFlightsQuery, useLogTrackerFlightMutation, type TrackerSheet } from "../api";
import { apiError, fmt, fmtDate, today, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { HelpHeader } from "../trackerUi";
import { ConfirmDialog } from "../components/TrackerDialog";

export const TrackerFlightLogTab = ({ sheet }: { sheet: TrackerSheet }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const assetId = sheet.asset.id;
  const { data: flights = [], isLoading } = useGetTrackerFlightsQuery(assetId);
  const [logFlight, { isLoading: saving }] = useLogTrackerFlightMutation();
  const [deleteFlight] = useDeleteTrackerFlightMutation();
  const [form, setForm] = useState({ flight_date: today(), hours: "", landings: "1", starts: "1", remarks: "" });
  const [removing, setRemoving] = useState<number | null>(null);

  const rows = useMemo(() => [...flights].sort((a, b) => b.flight_date.localeCompare(a.flight_date) || b.id - a.id), [flights]);

  const add = async () => {
    const hours = parseFloat(form.hours);
    if (!form.flight_date || !(hours > 0)) {
      dispatch(showToast({ message: "Enter a date and flight hours.", type: "error" }));
      return;
    }
    const landings = parseInt(form.landings, 10) || 0;
    try {
      await logFlight({
        asset_id: assetId,
        flight_date: form.flight_date,
        hours_flown: hours,
        landings,
        cycles: landings,
        engine_starts: parseInt(form.starts, 10) || 0,
        remarks: form.remarks.trim() || null,
      }).unwrap();
      setForm((f) => ({ ...f, hours: "", remarks: "" }));
      dispatch(showToast({ message: "Flight logged. Every remaining figure has been recalculated.", type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't log the flight."), type: "error" }));
    }
  };

  const canLog = perms.has("flight-logs.create");

  return (
    <div>
      {canLog && (
        <div className={cn(c.card, "mb-4")}>
          <h2>
            Log a flight
            <InfoTip title="Log a flight">
              Adds the hours to A/C total time, engine total time and Hobbs, and the landings and engine starts to their counters, so every remaining figure recalculates. These are the same flight-log entries as on the aircraft's engineering page.
            </InfoTip>
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className={cn("flex flex-col gap-1 text-[11px]", c.muted)}>
              Date
              <input type="date" className={c.field} value={form.flight_date} onChange={(e) => setForm((f) => ({ ...f, flight_date: e.target.value }))} />
            </label>
            <label className={cn("flex w-24 flex-col gap-1 text-[11px]", c.muted)}>
              Hours
              <input type="number" step="0.1" min={0} className={c.field} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} />
            </label>
            <label className={cn("flex w-24 flex-col gap-1 text-[11px]", c.muted)}>
              Landings
              <input type="number" min={0} className={c.field} value={form.landings} onChange={(e) => setForm((f) => ({ ...f, landings: e.target.value }))} />
            </label>
            <label className={cn("flex w-24 flex-col gap-1 text-[11px]", c.muted)}>
              Engine starts
              <input type="number" min={0} className={c.field} value={form.starts} onChange={(e) => setForm((f) => ({ ...f, starts: e.target.value }))} />
            </label>
            <label className={cn("flex min-w-[200px] flex-1 flex-col gap-1 text-[11px]", c.muted)}>
              Notes
              <input className={c.field} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </label>
            <Button size="sm" onClick={add} isLoading={saving}>
              Add flight
            </Button>
          </div>
        </div>
      )}

      <div className={c.tableWrap}>
        <table style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <HelpHeader label="Date" />
              <HelpHeader label="Hours" align="right" />
              <HelpHeader label="Landings" align="right" />
              <HelpHeader label="Starts" align="right" />
              <HelpHeader label="Notes" />
              <th className={c.th} />
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
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="mt-empty">
                  No flights logged yet.
                </td>
              </tr>
            )}
            {rows.map((f) => (
              <tr key={f.id} >
                <td>{fmtDate(f.flight_date)}</td>
                <td className="n">{fmt(f.hours_flown)}</td>
                <td className="n">{f.landings}</td>
                <td className="n">{f.engine_starts ?? 0}</td>
                <td>
                  {f.remarks}
                  {f.operation_id ? <span className={c.muted}> (from an operation)</span> : null}
                </td>
                <td className={cn(c.td, "text-right")}>
                  {perms.has("flight-logs.delete") && (
                    <Button size="xs" variant="secondary" onClick={() => setRemoving(f.id)}>
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {removing && (
        <ConfirmDialog
          destructive
          confirmLabel="Delete"
          message="Delete this flight and subtract its hours?"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            deleteFlight({ id: removing, assetId })
              .unwrap()
              .catch((e) => dispatch(showToast({ message: apiError(e, "Couldn't delete the flight."), type: "error" })));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
};
