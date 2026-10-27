import { useMemo, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useUpdateTrackerCountersMutation, type TrackerFleetRow, type TrackerItem, type TrackerSheet, type TrackerStatus } from "../api";
import { COUNTER_HELP, STATUS_HELP, STATUS_LABEL, apiError, fmt, fmtDate, remainingText, today, useTrackerPermissions } from "../trackerHelpers";
import { StatusPill } from "../trackerUi";
import { TrackerItemModal } from "../components/TrackerItemModal";
import type { TrackerNav } from "../MaintenanceTracker";

const Card = ({ label, value, help, onClick, selected }: { label: React.ReactNode; value: React.ReactNode; help?: { title: string; text: string; formula?: string }; onClick?: () => void; selected?: boolean }) => {
  const inner = (
    <>
      <span className="k">
        {label}
        {help && (
          <InfoTip title={help.title} formula={help.formula}>
            {help.text}
          </InfoTip>
        )}
      </span>
      <b className="v">{value}</b>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cn("mt-card", selected && "sel")}>
      {inner}
    </button>
  ) : (
    <div className="mt-card">{inner}</div>
  );
};

const ItemList = ({
  title,
  help,
  items,
  empty,
  onOpen,
  onViewAll,
  viewAllText,
}: {
  title: string;
  help: string;
  items: TrackerItem[];
  empty: string;
  onOpen: (item: TrackerItem) => void;
  onViewAll?: () => void;
  viewAllText?: string;
}) => (
  <div className="mt-card">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <h2 style={{ margin: 0 }}>
        {title}
        <InfoTip title={title}>{help}</InfoTip>
      </h2>
      {onViewAll && (
        <button type="button" className="mt-link" style={{ fontSize: 12 }} onClick={onViewAll}>
          {viewAllText || "View in tracker →"}
        </button>
      )}
    </div>
    {items.length === 0 ? (
      <div className="mt-empty">{empty}</div>
    ) : (
      <ul className="mt-l">
        {items.map((item) => (
          <li key={item.id} tabIndex={0} role="button" onClick={() => onOpen(item)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(item))}>
            <span>
              {item.description.trim()}
              <br />
              <span className="mt-sub">{item.serial_number || item.part_number || item.system_group || ""}</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <StatusPill status={item.tracking.status} />
              <br />
              <span className="mt-sub">{remainingText(item.tracking)}</span>
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/**
 * "Update counters". Keyed by the counters, so it starts from the saved
 * readings and resets after a save.
 */
const CountersForm = ({ sheet, nav }: { sheet: TrackerSheet; nav: TrackerNav }) => {
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const [updateCounters, { isLoading: saving }] = useUpdateTrackerCountersMutation();
  const counters = sheet.counters;
  const [form, setForm] = useState({
    airframe_hours: String(counters.airframe_hours ?? ""),
    engine_hours: counters.engine_hours === null ? "" : String(counters.engine_hours),
    engine_starts: counters.engine_starts === null ? "" : String(counters.engine_starts),
    landings: String(counters.landings ?? ""),
    hobbs_hours: counters.hobbs_hours === null ? "" : String(counters.hobbs_hours),
    as_of: counters.as_of ?? today(),
  });

  const save = async () => {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    try {
      await updateCounters({
        assetId: sheet.asset.id,
        airframe_hours: num(form.airframe_hours) ?? 0,
        engine_hours: num(form.engine_hours),
        engine_starts: num(form.engine_starts),
        landings: num(form.landings) ?? 0,
        hobbs_hours: num(form.hobbs_hours),
        as_of: form.as_of || today(),
      }).unwrap();
      dispatch(showToast({ message: "Counters saved. Every remaining figure has been recalculated.", type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't save the counters."), type: "error" }));
    }
  };

  return (
    <div className="mt-card">
      <h2>
        Update counters
        <InfoTip title="Update counters">
          Type the readings from the aircraft's meters and logbook. The system keeps the flights already logged and works the baselines back from these readings, so later flights keep adding on top.
        </InfoTip>
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        {(
          [
            ["airframe_hours", "A/C total time", "0.1"],
            ["engine_hours", "Engine total time", "0.1"],
            ["engine_starts", "Engine starts", "1"],
            ["landings", "Landings", "1"],
            ["hobbs_hours", "Hobbs", "0.1"],
          ] as const
        ).map(([key, label, step]) => (
          <label key={key} className="mt-sub" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {label}
            <input
              type="number"
              step={step}
              min={0}
              disabled={!perms.canSetCounters}
              className="mt-input"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="mt-sub" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          As of
          <input type="date" disabled={!perms.canSetCounters} className="mt-input" value={form.as_of} onChange={(e) => setForm((f) => ({ ...f, as_of: e.target.value }))} />
        </label>
      </div>
      <div className="mt-bar" style={{ marginTop: 10, marginBottom: 0 }}>
        <Button onClick={save} isLoading={saving} disabled={!perms.canSetCounters}>
          Save counters
        </Button>
        <span className="mt-sub">
          Or log flights in the{" "}
          <button type="button" className="mt-link" onClick={() => nav.go("flights")}>
            Flight log
          </button>{" "}
          tab to add hours automatically.
        </span>
      </div>
    </div>
  );
};

export const TrackerDashboard = ({
  sheet,
  fleet,
  nav,
  onSelectAircraft,
}: {
  sheet: TrackerSheet;
  fleet: TrackerFleetRow[];
  nav: TrackerNav;
  onSelectAircraft: (id: number) => void;
}) => {
  const [openItem, setOpenItem] = useState<TrackerItem | null>(null);
  const counters = sheet.counters;

  const { attention, byHours, byCalendar } = useMemo(() => {
    const rank: Partial<Record<TrackerStatus, number>> = { overdue: 0, due_soon: 1, watch: 2 };
    const attention = sheet.items
      .filter((i) => rank[i.tracking.status] !== undefined)
      .sort((a, b) => (rank[a.tracking.status] ?? 9) - (rank[b.tracking.status] ?? 9) || (a.tracking.percent_remaining ?? 1) - (b.tracking.percent_remaining ?? 1))
      .slice(0, 14);
    const byHours = sheet.items
      .filter((i) => i.tracking.unit === "hours" && i.tracking.remaining !== null && i.tracking.remaining >= 0)
      .sort((a, b) => (a.tracking.remaining ?? 0) - (b.tracking.remaining ?? 0))
      .slice(0, 10);
    const byCalendar = sheet.items
      .filter((i) => i.tracking.unit === "days" && i.tracking.remaining !== null)
      .sort((a, b) => (a.tracking.remaining ?? 0) - (b.tracking.remaining ?? 0))
      .slice(0, 10);
    return { attention, byHours, byCalendar };
  }, [sheet.items]);

  return (
    <div>
      {fleet.length > 1 && (
        <>
          <h2>
            Fleet
            <InfoTip title="Fleet">Every aircraft with its total time and how many tracker items are overdue or due soon. Click one to open its tracker.</InfoTip>
          </h2>
          <div className="mt-cards">
            {fleet.map((a) => (
              <Card
                key={a.id}
                selected={a.id === sheet.asset.id}
                onClick={() => onSelectAircraft(a.id)}
                label={a.registration}
                value={
                  <>
                    {fmt(a.counters.airframe_hours)} hrs
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, fontSize: 12 }}>
                      <StatusPill status="overdue">{a.counts.overdue} overdue</StatusPill>
                      <StatusPill status="due_soon">{a.counts.due_soon} due soon</StatusPill>
                    </span>
                    <span className="mt-sub" style={{ display: "block", fontWeight: 400 }}>
                      {a.open_work_orders} open work orders
                    </span>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-cards">
        <Card label="A/C total time" value={fmt(counters.airframe_hours)} help={COUNTER_HELP.airframe_hours} />
        <Card label="Engine total time" value={fmt(counters.engine_hours)} help={COUNTER_HELP.engine_hours} />
        <Card label="Engine starts" value={fmt(counters.engine_starts, 0)} help={COUNTER_HELP.engine_starts} />
        <Card label="Landings" value={fmt(counters.landings, 0)} help={COUNTER_HELP.landings} />
        <Card label="Hobbs" value={fmt(counters.hobbs_hours)} help={COUNTER_HELP.hobbs_hours} />
        <Card label="Counters as of" value={fmtDate(counters.as_of)} help={COUNTER_HELP.as_of} />
        <Card
          label="Open work orders"
          value={sheet.open_work_orders}
          help={{ title: "Open work orders", text: "Work orders on this aircraft not closed yet." }}
          onClick={() => nav.go("work-orders")}
        />
      </div>

      <div className="mt-cards">
        {(["overdue", "due_soon", "watch", "ok", "no_data"] as TrackerStatus[]).map((s) => (
          <Card
            key={s}
            label={STATUS_LABEL[s]}
            value={<StatusPill status={s}>{sheet.counts[s] ?? 0}</StatusPill>}
            help={s === "overdue" ? STATUS_HELP : undefined}
            onClick={() => nav.go("component", { status: s })}
          />
        ))}
      </div>

      {/* Coming Due Filter Shortcuts */}
      <div className="mt-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px" }}>
          <span className="mt-sub" style={{ fontWeight: 600 }}>Quick filter components coming due:</span>
          <div className="mt-chips" style={{ margin: 0, alignItems: "center" }}>
            {[
              { id: "hrs_50", label: "≤ 50 hrs" },
              { id: "hrs_100", label: "≤ 100 hrs" },
              { id: "hrs_200", label: "≤ 200 hrs" },
              { id: "cal_1m", label: "≤ 1 month" },
              { id: "cal_2m", label: "≤ 2 months" },
              { id: "cal_3m", label: "≤ 3 months" },
              { id: "cal_6m", label: "≤ 6 months" },
              { id: "cal_1y", label: "≤ 1 year" },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="mt-pill soon"
                style={{ cursor: "pointer", border: "1px solid var(--so)", background: "var(--sob)", color: "var(--so)", padding: "3px 10px", fontSize: 12 }}
                onClick={() => nav.go("component", { due: chip.id })}
                title={`Filter components coming due in ${chip.label}`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-two">
        <ItemList
          title="Needs attention"
          help="Overdue, due soon and watch items, most urgent first."
          items={attention}
          empty="Nothing is due."
          onOpen={setOpenItem}
          onViewAll={() => nav.go("component", { status: "due_soon" })}
          viewAllText="View all due soon →"
        />
        <ItemList
          title="Next due by flight hours"
          help="Items running on hours (parts and inspections) with the least time left."
          items={byHours}
          empty="No hour-tracked items."
          onOpen={setOpenItem}
          onViewAll={() => nav.go("component", { due: "hrs_100" })}
          viewAllText="Filter ≤ 100 hrs →"
        />
        <ItemList
          title="Next due by calendar"
          help="Calendar and expiry items, soonest first, measured against the 'Calendar items as of' date."
          items={byCalendar}
          empty="No calendar items."
          onOpen={setOpenItem}
          onViewAll={() => nav.go("component", { due: "cal_1m" })}
          viewAllText="Filter ≤ 1 mo →"
        />
        <CountersForm key={`${sheet.asset.id}-${JSON.stringify(counters)}`} sheet={sheet} nav={nav} />
      </div>

      {openItem && (
        <TrackerItemModal
          sheet={sheet}
          item={sheet.items.find((i) => i.id === openItem.id) ?? openItem}
          category={openItem.category}
          onClose={() => setOpenItem(null)}
          nav={nav}
        />
      )}
    </div>
  );
};
