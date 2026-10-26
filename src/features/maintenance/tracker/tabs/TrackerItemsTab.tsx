import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useRaiseTrackerWorkOrderMutation, type TrackerCategory, type TrackerItem, type TrackerSheet, type TrackerStatus } from "../api";
import { BASIS_LABEL, ITEM_COLUMNS, STATUS_HELP, STATUS_LABEL, UNIT_LABEL, apiError, downloadCsv, dueText, fmt, fmtDate, itemSearchText, remainingText, safeFileName, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { HelpHeader, LifeMeter, StatusPill } from "../trackerUi";
import { TrackerItemModal } from "../components/TrackerItemModal";
import type { TrackerNav } from "../MaintenanceTracker";

const lastDoneText = (item: TrackerItem) =>
  item.basis === "calendar" || item.basis === "expiry"
    ? fmtDate(item.last_done_date)
    : item.last_done_value !== null
      ? `${fmt(item.last_done_value)} ${item.basis === "interval_engine_hours" ? "eng hrs" : "hrs"}`
      : "–";

const intervalText = (item: TrackerItem) =>
  item.basis === "calendar"
    ? `${fmt(item.interval_days, 0)} d`
    : item.basis === "expiry"
      ? "expires"
      : item.basis === "daily"
        ? "daily"
        : item.basis === "on_condition"
          ? "on condition"
          : item.life_limit !== null
            ? `${fmt(item.life_limit, 0)} hrs`
            : "–";

export const PhaseBanner = ({ sheet }: { sheet: TrackerSheet }) => {
  const phase = sheet.phase;
  if (!phase.count) return null;
  return (
    <div className="mt-card" style={{ marginBottom: 10 }}>
      <b style={{ fontSize: 15 }}>Phase cycle {phase.current_cycle}</b>{" "}
      <InfoTip title="Phase inspections">
        Phases run in order, each one interval after the previous phase was done (or was due). Recording the last phase completes the cycle: the cycle is kept in history, every phase is cleared, and Phase 1 falls due one interval after it.
      </InfoTip>{" "}
      <span className="mt-sub">Phases 1 to {phase.count}, then the cycle restarts.</span>{" "}
      {phase.next && phase.next.due_value !== null && (
        <>
          Next: <b>{phase.next.description}</b> due at {fmt(phase.next.due_value)} hrs ({fmt(phase.next.remaining)} hrs remaining).
        </>
      )}
      {phase.history.length > 0 && (
        <div className="mt-sub">Completed cycles: {phase.history.map((h) => `#${h.cycle_number} ended at ${fmt(h.ended_at_hours)} hrs`).join(", ")}</div>
      )}
    </div>
  );
};

export const TrackerItemsTab = ({ category, sheet, nav }: { category: TrackerCategory; sheet: TrackerSheet; nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TrackerStatus | "all">((params.get("status") as TrackerStatus) || "all");
  const [sort, setSort] = useState<"group" | "urgency">("group");
  const [open, setOpen] = useState<TrackerItem | null | "new">(null);
  const [raiseWorkOrder] = useRaiseTrackerWorkOrderMutation();
  const isInspection = category === "inspection";

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = sheet.items.filter(
      (i) => i.category === category && (status === "all" || i.tracking.status === status) && (!needle || itemSearchText(i).includes(needle)),
    );
    const ordered = sort === "urgency" ? [...list].sort((a, b) => (a.tracking.percent_remaining ?? 9) - (b.tracking.percent_remaining ?? 9)) : list;
    // A group header goes above the first row of each system when grouped.
    return ordered.map((item, i) => ({ item, startsGroup: sort === "group" && (i === 0 || ordered[i - 1].system_group !== item.system_group) }));
  }, [sheet.items, category, status, q, sort]);

  const exportCsv = () => {
    downloadCsv(`${safeFileName(sheet.asset.registration)}-maintenance-status.csv`, [
      ["Category", "Group", "Description", "P/N", "S/N", "Basis", "Current", "Life/Interval", "Due", "Remaining", "Unit", "Status"],
      ...sheet.items.map((i) => [
        i.category,
        i.system_group,
        i.description,
        i.part_number,
        i.serial_number,
        BASIS_LABEL[i.basis],
        i.tracking.current_value,
        i.life_limit ?? i.interval_days,
        i.tracking.due_value ?? i.tracking.due_date,
        i.tracking.remaining,
        UNIT_LABEL[i.tracking.unit],
        STATUS_LABEL[i.tracking.status],
      ]),
    ]);
  };

  const raise = async (item: TrackerItem) => {
    try {
      const wo = await raiseWorkOrder({ id: item.id, assetId: sheet.asset.id }).unwrap();
      nav.openWorkOrder(wo.id);
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't raise the work order."), type: "error" }));
    }
  };

  const woTag = (item: TrackerItem) =>
    item.open_work_order ? (
      <button
        type="button"
        onClick={() => nav.openWorkOrder(item.open_work_order!.id)}
        title={`Open work order ${item.open_work_order.work_order_number}`}
        className="mt-pill wob"
        style={{ marginLeft: 4 }}
      >
        {(item.open_work_order.work_order_number ?? `WO ${item.open_work_order.id}`).split("/").slice(-2).join("/")}
      </button>
    ) : item.tracking.status === "overdue" && perms.canRaiseWo ? (
      <Button size="xs" variant="secondary" style={{ marginLeft: 4 }} onClick={() => raise(item)}>
        Raise WO
      </Button>
    ) : null;

  return (
    <div>
      {isInspection && <PhaseBanner sheet={sheet} />}

      <div className="mt-bar">
        <input type="search" className="mt-input" style={{ width: "auto", minWidth: 240 }} placeholder="Search part, S/N, description…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="mt-input" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value as TrackerStatus | "all")}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as TrackerStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="mt-input" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as "group" | "urgency")}>
          <option value="group">Group by system</option>
          <option value="urgency">Sort by urgency</option>
        </select>
        <span className="mt-sp" />
        <Button variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
        {perms.canEditItems && <Button onClick={() => setOpen("new")}>+ Add item</Button>}
      </div>

      <div className={c.tableWrap}>
        <table style={{ minWidth: 860 }}>
          <thead>
            <tr>
              {isInspection ? (
                <>
                  <HelpHeader label="Description" help={{ title: "Description", text: "The inspection, AD/ASB or retorque task." }} />
                  <HelpHeader label="Last done" help={ITEM_COLUMNS.lastDone} />
                  <HelpHeader label="Interval" help={ITEM_COLUMNS.interval} align="right" />
                  <HelpHeader label="Due" help={ITEM_COLUMNS.due} align="right" />
                </>
              ) : (
                <>
                  <HelpHeader label="Description / P/N / S/N" help={ITEM_COLUMNS.part} />
                  <HelpHeader label="Action" help={ITEM_COLUMNS.action} />
                  <HelpHeader label="Current" help={ITEM_COLUMNS.current} align="right" />
                  <HelpHeader label="Life" help={ITEM_COLUMNS.life} align="right" />
                </>
              )}
              <HelpHeader label="Remaining" help={ITEM_COLUMNS.remaining} align="right" />
              <HelpHeader label="" help={ITEM_COLUMNS.meter} />
              <HelpHeader label="Status" help={STATUS_HELP} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="mt-empty">
                  {sheet.items.some((i) => i.category === category) ? "No items match." : "No items yet. Add one, or bring in installed parts from the Data tab."}
                </td>
              </tr>
            )}
            {rows.map(({ item, startsGroup }) => {
              const header = startsGroup ? (
                  <tr key={`g-${item.id}`} className={c.groupRow}>
                    <td colSpan={7}>
                      {item.system_group || "Ungrouped"}
                    </td>
                  </tr>
                ) : null;
              const t = item.tracking;
              return [
                header,
                <tr
                  key={item.id}
                  tabIndex={0}
                  className="click"
                  onClick={(e) => onInteractiveRowClick(e, () => setOpen(item))}
                  onKeyDown={(e) => onInteractiveRowKeyDown(e, () => setOpen(item))}
                >
                  {isInspection ? (
                    <>
                      <td>{item.description}</td>
                      <td>{lastDoneText(item)}</td>
                      <td className="n">{intervalText(item)}</td>
                      <td className="n">{item.basis === "expiry" ? fmtDate(item.expiry_date) : dueText(t)}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        <b>{item.description.trim()}</b>
                        <div className="mt-sub">
                          {[item.part_number, item.serial_number].filter(Boolean).join(" · ")}
                          {item.notes ? ` · ${item.notes}` : ""}
                        </div>
                      </td>
                      <td>{item.service_action ?? ""}</td>
                      <td className="n">{t.current_value === null ? "–" : `${fmt(t.current_value)} ${UNIT_LABEL[t.unit]}`}</td>
                      <td className="n">
                        {item.life_limit !== null ? fmt(item.life_limit, 0) : item.basis === "calendar" ? `${fmt(item.interval_days, 0)} d` : "–"}
                      </td>
                    </>
                  )}
                  <td className="n">{remainingText(t)}</td>
                  <td style={{ width: 90 }}>
                    <LifeMeter tracking={t} />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <StatusPill status={t.status} />
                    {woTag(item)}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <TrackerItemModal
          sheet={sheet}
          item={open === "new" ? null : (sheet.items.find((i) => i.id === open.id) ?? open)}
          category={category}
          onClose={() => setOpen(null)}
          nav={nav}
        />
      )}
    </div>
  );
};
