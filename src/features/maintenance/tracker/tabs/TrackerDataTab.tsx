import { useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCopyTrackerItemsMutation,
  useImportInstalledPartsMutation,
  useImportTrackerItemsMutation,
  type TrackerBasis,
  type TrackerCategory,
  type TrackerFleetRow,
  type TrackerItemFields,
  type TrackerSheet,
} from "../api";
import { apiError, downloadText, safeFileName, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { ConfirmDialog } from "../components/TrackerDialog";

const ITEM_KEYS: (keyof TrackerItemFields)[] = [
  "category",
  "system_group",
  "basis",
  "description",
  "part_number",
  "serial_number",
  "service_action",
  "life_limit",
  "counter_at_install",
  "value_at_install",
  "rin_multiplier",
  "landing_factor",
  "interval_days",
  "last_done_value",
  "last_done_date",
  "expiry_date",
  "phase_number",
  "notes",
  "sort_order",
];

/* The standalone HTML tracker's codes, for importing its JSON backups. */
const DOC_BASIS: Record<string, TrackerBasis> = {
  af: "airframe_hours",
  eng: "engine_hours",
  rin: "rin",
  cyc1: "starts",
  cycgp: "starts_landings",
  hrs: "interval_airframe_hours",
  hrs_e: "interval_engine_hours",
  phase: "phase",
  cal: "calendar",
  expiry: "expiry",
  cond: "on_condition",
  daily: "daily",
};
const DOC_CATEGORY: Record<string, TrackerCategory> = { Components: "component", Engine: "engine", Inspections: "inspection" };

type DocItem = { cat: string; grp?: string; basis: string; desc: string; pn?: string; sn?: string | number; act?: string; life?: number; at?: number; tsn?: number; mult?: number; days?: number; last?: number | string; year?: number; n?: number; note?: string };

const fromDocItem = (i: DocItem, index: number): Partial<TrackerItemFields> => {
  const dateLast = typeof i.last === "string";
  const basis = DOC_BASIS[i.basis] ?? "on_condition";
  return {
    category: DOC_CATEGORY[i.cat] ?? "component",
    system_group: i.grp ?? null,
    basis,
    description: i.desc || "Untitled",
    part_number: i.pn ?? null,
    serial_number: i.sn !== undefined && i.sn !== null ? String(i.sn) : null,
    service_action: i.act ?? null,
    life_limit: basis === "calendar" || basis === "expiry" ? null : basis === "phase" && i.life === 1050 ? 150 : (i.life ?? null),
    counter_at_install: i.at ?? null,
    value_at_install: i.tsn ?? null,
    rin_multiplier: i.mult ?? null,
    interval_days: i.days ?? null,
    last_done_value: !dateLast && typeof i.last === "number" ? i.last : null,
    last_done_date: dateLast ? (i.last as string) : null,
    expiry_date: i.year ? `${i.year}-12-31` : null,
    phase_number: i.n ?? null,
    notes: i.note ?? null,
    sort_order: index,
  };
};

/** Items from a file: this tracker's own export, or the standalone HTML tracker's backup. */
const parseItemsFile = (json: unknown): Partial<TrackerItemFields>[] | null => {
  const data = json as { items?: unknown[]; fleet?: { items: DocItem[] }[]; hdr?: unknown; act?: string };
  if (Array.isArray(data?.fleet)) {
    const active = (data.fleet as ({ id?: string; items: DocItem[] })[]).find((a) => a.id === data.act) ?? data.fleet[0];
    return active.items.map(fromDocItem);
  }
  if (Array.isArray(data?.items) && data.hdr) return (data.items as DocItem[]).map(fromDocItem);
  if (Array.isArray(data?.items)) {
    return (data.items as Record<string, unknown>[]).map((row) =>
      Object.fromEntries(ITEM_KEYS.filter((k) => k in row).map((k) => [k, row[k]])) as Partial<TrackerItemFields>,
    );
  }
  return null;
};

export const TrackerDataTab = ({ sheet, fleet }: { sheet: TrackerSheet; fleet: TrackerFleetRow[] }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const file = useRef<HTMLInputElement>(null);
  const [importItems, { isLoading: importing }] = useImportTrackerItemsMutation();
  const [copyItems, { isLoading: copying }] = useCopyTrackerItemsMutation();
  const [importInstalled, { isLoading: bringing }] = useImportInstalledPartsMutation();
  const [replace, setReplace] = useState(false);
  const [source, setSource] = useState("");
  const [pending, setPending] = useState<{ kind: "file"; items: Partial<TrackerItemFields>[] } | { kind: "copy" } | null>(null);
  const reg = sheet.asset.registration;

  const exportJson = () =>
    downloadText(
      `${safeFileName(reg)}-tracker-backup.json`,
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          aircraft: sheet.asset,
          counters: sheet.counters,
          items: sheet.items.map((i) => Object.fromEntries(ITEM_KEYS.map((k) => [k, i[k]]))),
        },
        null,
        1,
      ),
    );

  const readFile = async (f: File) => {
    try {
      const items = parseItemsFile(JSON.parse(await f.text()));
      if (!items?.length) throw new Error();
      setPending({ kind: "file", items });
    } catch {
      dispatch(showToast({ message: "That file isn’t a valid tracker backup.", type: "error" }));
    }
  };

  const confirm = async () => {
    const action = pending;
    setPending(null);
    try {
      if (action?.kind === "file") {
        const res = await importItems({ assetId: sheet.asset.id, items: action.items, replace }).unwrap();
        dispatch(showToast({ message: `Imported ${res.imported} item(s).`, type: "success" }));
      } else if (action?.kind === "copy") {
        const res = await copyItems({ assetId: sheet.asset.id, source_asset_id: Number(source), replace }).unwrap();
        dispatch(showToast({ message: `Copied ${res.copied} item(s). Update this aircraft's serial numbers and last-done values next.`, type: "success" }));
      }
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't import the items."), type: "error" }));
    }
  };

  const bringInstalled = async () => {
    try {
      const res = await importInstalled(sheet.asset.id).unwrap();
      dispatch(showToast({ message: res.imported ? `Brought in ${res.imported} item(s).` : "Nothing new to bring in.", type: res.imported ? "success" : "info" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't bring in the installed parts."), type: "error" }));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className={c.card}>
        <h2>Backup &amp; restore</h2>
        <p className={cn("mb-3 text-xs", c.muted)}>
          Data is saved on the server as you work. Export this aircraft's items as a JSON backup, or load items from a backup (this tracker's, or the standalone tracker's “fleet-tracker-backup.json”).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={exportJson}>
            Export JSON backup
          </Button>
          {perms.canEditItems && (
            <>
              <Button size="sm" variant="secondary" isLoading={importing} onClick={() => file.current?.click()}>
                Import JSON
              </Button>
              <input
                ref={file}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>

      {perms.canEditItems && (
        <div className={c.card}>
          <h2>
            Start from existing records
            <InfoTip title="Start from existing records">
              Copies items from another aircraft of the same type (same figures; update serials and last-done values afterwards), or brings in this aircraft's installed components, engines and avionics with life limits and its maintenance programme tasks. Installed parts already in the tracker are skipped.
            </InfoTip>
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className={cn(c.field, "w-auto")} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Copy items from…</option>
              {fleet
                .filter((a) => a.id !== sheet.asset.id && a.item_count > 0)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.registration} ({a.item_count} items)
                  </option>
                ))}
            </select>
            <Button size="sm" variant="secondary" disabled={!source} isLoading={copying} onClick={() => setPending({ kind: "copy" })}>
              Copy
            </Button>
          </div>
          <div className="mt-3">
            <Button size="sm" variant="secondary" isLoading={bringing} onClick={bringInstalled}>
              Bring in installed parts &amp; programme
            </Button>
          </div>
          <label className={cn("mt-3 flex items-center gap-1.5 text-xs", c.muted)}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace this aircraft's current items when importing or copying
          </label>
        </div>
      )}

      <div className={cn(c.card, "lg:col-span-2")}>
        <h2>How the figures are worked out</h2>
        <ul className={cn("list-disc space-y-1 pl-5 text-xs", c.muted)}>
          <li>Remaining life is always life − current time, where current time = the part's time at install + what its counter has run since install.</li>
          <li>RIN parts: RIN at install + (A/C T.T. − A/F hrs at install) × multiplier. The multiplier applies once, to the hours flown since fitting.</li>
          <li>Engine-hour items run on engine total time; cycle items on engine starts, or starts + landing factor × landings.</li>
          <li>Recurring tasks: due at last done + interval. Phases chain one after another and restart after the last phase.</li>
          <li>Counters come from the aircraft's baselines plus every flight logged (operations and the flight log).</li>
        </ul>
      </div>

      {pending && (
        <ConfirmDialog
          destructive={replace}
          confirmLabel={replace ? "Replace items" : "Add items"}
          message={
            pending.kind === "file"
              ? `${replace ? "Replace this aircraft's items with" : "Add"} ${pending.items.length} item(s) from the file?`
              : `${replace ? "Replace this aircraft's items with" : "Add"} the items of ${fleet.find((a) => String(a.id) === source)?.registration}?`
          }
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
};
