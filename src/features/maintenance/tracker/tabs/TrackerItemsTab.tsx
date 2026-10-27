import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { cn } from "@/shared/utils/cn";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useRaiseTrackerWorkOrderMutation, type TrackerCategory, type TrackerItem, type TrackerSheet, type TrackerStatus } from "../api";
import {
  BASIS_LABEL,
  ITEM_COLUMNS,
  STATUS_HELP,
  STATUS_LABEL,
  UNIT_LABEL,
  apiError,
  downloadCsv,
  dueText,
  fmt,
  fmtDate,
  itemSearchText,
  remainingText,
  safeFileName,
  useTrackerClasses,
  useTrackerPermissions,
  type DueHorizon,
  matchesDueHorizon,
} from "../trackerHelpers";
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
  const [dueHorizon, setDueHorizon] = useState<DueHorizon>((params.get("due") as DueHorizon) || "all");
  const [customHours, setCustomHours] = useState<string>(params.get("custom_hrs") || "50");
  const [customDays, setCustomDays] = useState<string>(params.get("custom_days") || "30");
  const [systemFilter, setSystemFilter] = useState<string>("all");
  const [open, setOpen] = useState<TrackerItem | null | "new">(null);
  const [raiseWorkOrder] = useRaiseTrackerWorkOrderMutation();
  const isInspection = category === "inspection";

  const parsedCustomHours = Number(customHours) || 50;
  const parsedCustomDays = Number(customDays) || 30;

  const totalCategoryItems = useMemo(
    () => sheet.items.filter((i) => i.category === category).length,
    [sheet.items, category],
  );

  const systemGroups = useMemo(() => {
    const set = new Set<string>();
    sheet.items.forEach((i) => {
      if (i.category === category && i.system_group) {
        set.add(i.system_group.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sheet.items, category]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = sheet.items.filter((i) => {
      if (i.category !== category) return false;
      if (status !== "all" && i.tracking.status !== status) return false;
      if (needle && !itemSearchText(i).includes(needle)) return false;
      if (systemFilter !== "all") {
        if (systemFilter === "ungrouped") {
          if (i.system_group && i.system_group.trim() !== "") return false;
        } else if (i.system_group !== systemFilter) {
          return false;
        }
      }
      if (!matchesDueHorizon(i, dueHorizon, parsedCustomHours, parsedCustomDays, sheet.counters.as_of ?? undefined)) {
        return false;
      }
      return true;
    });

    const ordered =
      sort === "urgency"
        ? [...list].sort((a, b) => (a.tracking.percent_remaining ?? 9) - (b.tracking.percent_remaining ?? 9))
        : list;

    // A group header goes above the first row of each system when grouped.
    return ordered.map((item, i) => ({
      item,
      startsGroup: sort === "group" && (i === 0 || ordered[i - 1].system_group !== item.system_group),
    }));
  }, [
    sheet.items,
    sheet.counters.as_of,
    category,
    status,
    q,
    sort,
    systemFilter,
    dueHorizon,
    parsedCustomHours,
    parsedCustomDays,
  ]);

  const hasFilters = q.trim() !== "" || status !== "all" || dueHorizon !== "all" || systemFilter !== "all";

  const resetFilters = () => {
    setQ("");
    setStatus("all");
    setDueHorizon("all");
    setSystemFilter("all");
  };

  const exportCsv = () => {
    downloadCsv(`${safeFileName(sheet.asset.registration)}-${category}-maintenance-status.csv`, [
      ["Category", "Group", "Description", "P/N", "S/N", "Basis", "Current", "Life/Interval", "Due", "Remaining", "Unit", "Status"],
      ...rows.map(({ item: i }) => [
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

      {/* Quick Due Horizon Chips */}
      <div className="mt-chips" style={{ alignItems: "center", marginBottom: 10, marginTop: 2 }}>
        <span className="mt-sub" style={{ fontWeight: 600, marginRight: 2 }}>
          Coming due:
        </span>
        {[
          { id: "all", label: "All" },
          { id: "hrs_50", label: "≤ 50 hrs" },
          { id: "hrs_100", label: "≤ 100 hrs" },
          { id: "hrs_200", label: "≤ 200 hrs" },
          { id: "cal_1m", label: "≤ 1 mo (30d)" },
          { id: "cal_2m", label: "≤ 2 mos (60d)" },
          { id: "cal_3m", label: "≤ 3 mos (90d)" },
          { id: "cal_6m", label: "≤ 6 mos (180d)" },
          { id: "cal_1y", label: "≤ 1 yr (365d)" },
        ].map((chip) => {
          const isSelected = dueHorizon === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className={cn("mt-pill", isSelected ? "soon" : undefined)}
              style={{
                cursor: "pointer",
                border: isSelected ? "1px solid var(--so)" : "1px solid var(--bd)",
                background: isSelected ? "var(--sob)" : "var(--sf)",
                color: isSelected ? "var(--so)" : "var(--tx)",
                padding: "3px 10px",
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
              }}
              onClick={() => setDueHorizon(chip.id as DueHorizon)}
            >
              {chip.label}
            </button>
          );
        })}
        {hasFilters && (
          <button
            type="button"
            className="mt-link"
            style={{ marginLeft: 8, fontSize: 12 }}
            onClick={resetFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-bar">
        <input
          type="search"
          className="mt-input"
          style={{ width: "auto", minWidth: 220 }}
          placeholder="Search part, S/N, description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {/* Due Horizon Dropdown */}
        <select
          className="mt-input"
          style={{ width: "auto" }}
          value={dueHorizon}
          onChange={(e) => setDueHorizon(e.target.value as DueHorizon)}
          title="Filter by hours or calendar remaining"
        >
          <option value="all">Due horizon: All</option>
          <optgroup label="Operating Hours Remaining">
            <option value="hrs_50">Due in ≤ 50 hours</option>
            <option value="hrs_100">Due in ≤ 100 hours</option>
            <option value="hrs_200">Due in ≤ 200 hours</option>
            <option value="hrs_500">Due in ≤ 500 hours</option>
            <option value="custom_hrs">Custom hours…</option>
          </optgroup>
          <optgroup label="Calendar Time Remaining">
            <option value="cal_1m">Due in ≤ 1 month (30 days)</option>
            <option value="cal_2m">Due in ≤ 2 months (60 days)</option>
            <option value="cal_3m">Due in ≤ 3 months (90 days)</option>
            <option value="cal_6m">Due in ≤ 6 months (180 days)</option>
            <option value="cal_1y">Due in ≤ 1 year (365 days)</option>
            <option value="custom_days">Custom days…</option>
          </optgroup>
          <optgroup label="Combined (Hours or Calendar)">
            <option value="combo_50h_1m">Due in ≤ 50 hrs OR ≤ 1 mo</option>
            <option value="combo_100h_2m">Due in ≤ 100 hrs OR ≤ 2 mos</option>
            <option value="combo_200h_3m">Due in ≤ 200 hrs OR ≤ 3 mos</option>
          </optgroup>
        </select>

        {dueHorizon === "custom_hrs" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <input
              type="number"
              min="1"
              step="5"
              className="mt-input"
              style={{ width: 80 }}
              value={customHours}
              onChange={(e) => setCustomHours(e.target.value)}
              placeholder="50"
            />
            <span className="mt-sub">hrs</span>
          </div>
        )}

        {dueHorizon === "custom_days" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <input
              type="number"
              min="1"
              step="5"
              className="mt-input"
              style={{ width: 80 }}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="30"
            />
            <span className="mt-sub">days</span>
          </div>
        )}

        {/* System / Group Filter */}
        {systemGroups.length > 0 && (
          <select
            className="mt-input"
            style={{ width: "auto" }}
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            title="Filter by System / Group"
          >
            <option value="all">All systems / groups</option>
            {systemGroups.map((g) => (
              <option key={g} value={g}>
                System: {g}
              </option>
            ))}
            {sheet.items.some((i) => i.category === category && !i.system_group) && (
              <option value="ungrouped">Ungrouped</option>
            )}
          </select>
        )}

        {/* Status Filter */}
        <select
          className="mt-input"
          style={{ width: "auto" }}
          value={status}
          onChange={(e) => setStatus(e.target.value as TrackerStatus | "all")}
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as TrackerStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        {/* Sort Filter */}
        <select
          className="mt-input"
          style={{ width: "auto" }}
          value={sort}
          onChange={(e) => setSort(e.target.value as "group" | "urgency")}
        >
          <option value="group">Group by system</option>
          <option value="urgency">Sort by urgency</option>
        </select>

        <span className="mt-sp" />

        <Button variant="secondary" onClick={exportCsv}>
          Export CSV ({rows.length})
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
                  {totalCategoryItems === 0 ? (
                    "No items yet. Add one, or bring in installed parts from the Data tab."
                  ) : hasFilters ? (
                    <div>
                      <div>No components or systems match the current filters.</div>
                      <button
                        type="button"
                        className="mt-link"
                        style={{ marginTop: 8, fontSize: 13, textDecoration: "underline" }}
                        onClick={resetFilters}
                      >
                        Reset filters to view all {totalCategoryItems} items
                      </button>
                    </div>
                  ) : (
                    "No items match."
                  )}
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
