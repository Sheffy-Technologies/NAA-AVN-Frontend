import { useMemo, useState } from "react";
import { Button } from "./TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateTrackerItemMutation,
  useDeleteTrackerItemMutation,
  useRaiseTrackerWorkOrderMutation,
  useRecordTrackerComplianceMutation,
  useUpdateTrackerItemMutation,
  type TrackerBasis,
  type TrackerCategory,
  type TrackerItem,
  type TrackerItemFields,
  type TrackerSheet,
} from "../api";
import { BASIS_LABEL, FIELD_HELP, apiError, fmt, remainingText, today, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { FieldLabel, StatusPill } from "../trackerUi";
import { ConfirmDialog, TrackerDialog } from "./TrackerDialog";
import type { TrackerNav } from "../MaintenanceTracker";

type NumericField = "life_limit" | "counter_at_install" | "value_at_install" | "rin_multiplier" | "landing_factor" | "interval_days" | "last_done_value" | "phase_number";
type DateField = "last_done_date" | "expiry_date";
type BasisField = NumericField | DateField;

/** Which fields each basis uses (the backend's MaintenanceTrackingItem::BASES). */
const FIELDS: Record<TrackerBasis, BasisField[]> = {
  airframe_hours: ["life_limit", "counter_at_install", "value_at_install"],
  engine_hours: ["life_limit", "counter_at_install", "value_at_install"],
  rin: ["life_limit", "counter_at_install", "value_at_install", "rin_multiplier"],
  starts: ["life_limit", "counter_at_install", "value_at_install"],
  starts_landings: ["life_limit", "counter_at_install", "value_at_install", "landing_factor"],
  interval_airframe_hours: ["life_limit", "last_done_value"],
  interval_engine_hours: ["life_limit", "last_done_value"],
  phase: ["life_limit", "last_done_value", "phase_number"],
  calendar: ["interval_days", "last_done_date"],
  expiry: ["expiry_date", "last_done_date"],
  on_condition: [],
  daily: [],
};

const LIFE_BASES: TrackerBasis[] = ["airframe_hours", "engine_hours", "rin", "starts", "starts_landings"];
const DATE_BASES: TrackerBasis[] = ["calendar", "expiry"];
const UNTIMED_BASES: TrackerBasis[] = ["on_condition", "daily"];

const PART_BASES: TrackerBasis[] = [...LIFE_BASES, "calendar", "expiry", "on_condition"];
const INSPECTION_BASES: TrackerBasis[] = ["interval_airframe_hours", "interval_engine_hours", "phase", "calendar", "expiry", "on_condition", "daily"];

const fieldLabel = (basis: TrackerBasis, field: BasisField) => {
  const cycles = basis === "starts" || basis === "starts_landings";
  switch (field) {
    case "life_limit":
      return LIFE_BASES.includes(basis) ? (cycles ? "Life (cycles)" : basis === "rin" ? "Life (RIN)" : "Life (hrs)") : "Interval (hrs)";
    case "counter_at_install":
      return basis === "engine_hours" ? "Engine hrs at install" : cycles ? "Counter at install (blank = 0)" : "A/F hrs at install";
    case "value_at_install":
      return basis === "rin" ? "RIN at install" : "Part TSN/TSO/I at install";
    case "rin_multiplier":
      return "RIN multiplier";
    case "landing_factor":
      return "Landing factor";
    case "interval_days":
      return "Interval (days)";
    case "last_done_value":
      return basis === "interval_engine_hours" ? "Last done at (engine hrs)" : "Last done at (A/F hrs)";
    case "last_done_date":
      return basis === "expiry" ? "Installed / last checked" : "Last done (date)";
    case "expiry_date":
      return "Expiry date";
    case "phase_number":
      return "Phase number";
  }
};

const toInput = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));

export const TrackerItemModal = ({
  sheet,
  item,
  category,
  onClose,
  nav,
}: {
  sheet: TrackerSheet;
  item: TrackerItem | null;
  category: TrackerCategory;
  onClose: () => void;
  nav: TrackerNav;
}) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const isNew = !item;
  const isInspection = (item?.category ?? category) === "inspection";

  const [form, setForm] = useState(() => ({
    description: item?.description ?? "",
    part_number: item?.part_number ?? "",
    serial_number: item?.serial_number ?? "",
    system_group: item?.system_group ?? "",
    service_action: item?.service_action ?? "",
    notes: item?.notes ?? "",
    basis: (item?.basis ?? (isInspection ? "interval_airframe_hours" : category === "engine" ? "engine_hours" : "airframe_hours")) as TrackerBasis,
    life_limit: toInput(item?.life_limit),
    counter_at_install: toInput(item?.counter_at_install),
    value_at_install: toInput(item?.value_at_install),
    rin_multiplier: toInput(item?.rin_multiplier),
    landing_factor: toInput(item?.landing_factor),
    interval_days: toInput(item?.interval_days),
    last_done_value: toInput(item?.last_done_value),
    phase_number: toInput(item?.phase_number),
    last_done_date: item?.last_done_date ?? "",
    expiry_date: item?.expiry_date ?? "",
  }));
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const counterNow = item?.tracking.counter_value ?? null;
  const [record, setRecord] = useState(() => ({
    performed_value: toInput(counterNow),
    performed_date: today(),
    serial_number: item?.serial_number ?? "",
    value_at_install: "0",
    expiry_date: "",
    remarks: "",
  }));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [createItem, { isLoading: creating }] = useCreateTrackerItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateTrackerItemMutation();
  const [deleteItem] = useDeleteTrackerItemMutation();
  const [recordCompliance, { isLoading: recording }] = useRecordTrackerComplianceMutation();
  const [raiseWorkOrder, { isLoading: raising }] = useRaiseTrackerWorkOrderMutation();

  const groups = useMemo(() => [...new Set(sheet.items.filter((i) => i.category === (item?.category ?? category)).map((i) => i.system_group).filter(Boolean))] as string[], [sheet.items, item, category]);

  const payload = (): Partial<TrackerItemFields> => {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const data: Partial<TrackerItemFields> = {
      description: form.description.trim() || "Untitled",
      part_number: form.part_number.trim() || null,
      serial_number: form.serial_number.trim() || null,
      system_group: form.system_group.trim() || "Added",
      service_action: form.service_action.trim() || null,
      notes: form.notes.trim() || null,
      basis: form.basis,
    };
    // Fields the basis doesn't use are cleared, so a changed basis leaves no stale figures.
    (["life_limit", "counter_at_install", "value_at_install", "rin_multiplier", "landing_factor", "interval_days", "last_done_value", "phase_number"] as NumericField[]).forEach((f) => {
      data[f] = FIELDS[form.basis].includes(f) ? num(form[f]) : null;
    });
    (["last_done_date", "expiry_date"] as DateField[]).forEach((f) => {
      data[f] = FIELDS[form.basis].includes(f) ? form[f] || null : null;
    });
    return data;
  };

  const save = async () => {
    try {
      if (isNew) {
        await createItem({ ...payload(), asset_id: sheet.asset.id, category }).unwrap();
        dispatch(showToast({ message: "Item added.", type: "success" }));
      } else {
        await updateItem({ id: item.id, assetId: sheet.asset.id, data: payload() }).unwrap();
        dispatch(showToast({ message: "Item saved.", type: "success" }));
      }
      onClose();
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't save the item."), type: "error" }));
    }
  };

  const doRecord = async () => {
    if (!item) return;
    const basis = item.basis;
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const data = LIFE_BASES.includes(basis)
      ? { performed_value: num(record.performed_value), value_at_install: num(record.value_at_install) ?? 0, serial_number: record.serial_number.trim() || null }
      : DATE_BASES.includes(basis) || UNTIMED_BASES.includes(basis)
        ? { performed_date: record.performed_date || today(), expiry_date: basis === "expiry" && record.expiry_date ? record.expiry_date : null }
        : { performed_value: num(record.performed_value) };
    try {
      const res = await recordCompliance({ id: item.id, assetId: sheet.asset.id, data: { ...data, remarks: record.remarks.trim() || null } }).unwrap();
      dispatch(showToast({ message: res.log.entry, type: "success" }));
      onClose();
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't record compliance."), type: "error" }));
    }
  };

  const doRaise = async () => {
    if (!item) return;
    try {
      const wo = await raiseWorkOrder({ id: item.id, assetId: sheet.asset.id }).unwrap();
      onClose();
      nav.openWorkOrder(wo.id);
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't raise the work order."), type: "error" }));
    }
  };

  const doDelete = async () => {
    if (!item) return;
    try {
      await deleteItem({ id: item.id, assetId: sheet.asset.id }).unwrap();
      dispatch(showToast({ message: "Item deleted.", type: "success" }));
      onClose();
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't delete the item."), type: "error" }));
    }
  };

  const basisOptions = isInspection ? INSPECTION_BASES : PART_BASES;
  const isPartRecord = item && LIFE_BASES.includes(item.basis);
  const readOnly = !perms.canEditItems;

  return (
    <>
      <TrackerDialog
        title={isNew ? "Add item" : item.description.trim()}
        subtitle={
          !isNew && (
            <span className="flex flex-wrap items-center gap-2">
              {[item.part_number, item.serial_number].filter(Boolean).join(" · ")}
              <StatusPill status={item.tracking.status} />
              {remainingText(item.tracking)}
            </span>
          )
        }
        onClose={onClose}
        footer={
          <>
            {!readOnly && (
              <Button size="sm" onClick={save} isLoading={creating || updating}>
                Save
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onClose}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            <span className="flex-1" />
            {!isNew && perms.has("maintenance-tracking-items.delete") && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      >
        <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0 }}>
          <div>
            <FieldLabel label="Description" />
            <input className={c.field} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          {!isInspection && (
            <>
              <div>
                <FieldLabel label="Part number" />
                <input className={c.field} value={form.part_number} onChange={(e) => set("part_number", e.target.value)} />
              </div>
              <div>
                <FieldLabel label="Serial number" />
                <input className={c.field} value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
              </div>
            </>
          )}
          <div>
            <FieldLabel label="Group / system" help={FIELD_HELP.system_group} />
            <input className={c.field} list="tracker-groups" value={form.system_group} onChange={(e) => set("system_group", e.target.value)} />
            <datalist id="tracker-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabel label="Service action" help={FIELD_HELP.service_action} />
            <input className={c.field} placeholder="e.g. HRS/RET" value={form.service_action} onChange={(e) => set("service_action", e.target.value)} />
          </div>
          <div>
            <FieldLabel label="Tracking basis" help={FIELD_HELP.basis} />
            <select className={c.field} value={form.basis} onChange={(e) => set("basis", e.target.value)}>
              {basisOptions.map((b) => (
                <option key={b} value={b}>
                  {BASIS_LABEL[b]}
                </option>
              ))}
            </select>
          </div>
          {FIELDS[form.basis].map((field) => (
            <div key={field}>
              <FieldLabel label={fieldLabel(form.basis, field)} help={FIELD_HELP[field]} />
              <input
                className={c.field}
                type={field === "last_done_date" || field === "expiry_date" ? "date" : "number"}
                step="any"
                min={0}
                placeholder={field === "rin_multiplier" ? "20" : field === "landing_factor" ? "0.1" : undefined}
                value={form[field]}
                onChange={(e) => set(field, e.target.value)}
              />
            </div>
          ))}
          <div>
            <FieldLabel label="Notes" />
            <input className={c.field} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </fieldset>

        {!isNew && (
          <>
            {/* Work order / task card */}
            <div className="mt-box">
              <b>
                Work order / task card
                <InfoTip title="Work order">
                  Raises the NAAVN-005 maintenance workpack for this item, filled in from its status and the aircraft's counters. An item has at most one open work order; closing it records the compliance here.
                </InfoTip>
              </b>
              <div className="mt-row" style={{ display: "flex", marginTop: 8 }}>
                {item.open_work_order ? (
                  <Button size="sm" variant="secondary" onClick={() => (onClose(), nav.openWorkOrder(item.open_work_order!.id))}>
                    Open {item.open_work_order.work_order_number}
                  </Button>
                ) : (
                  <Button size="sm" onClick={doRaise} isLoading={raising} disabled={!perms.canRaiseWo}>
                    Raise work order
                  </Button>
                )}
              </div>
            </div>

            {/* Record compliance / replacement */}
            {perms.canRecord && (
              <div className="mt-box">
                <b>
                  {isPartRecord ? "Replace / overhaul" : "Record compliance"}
                  <InfoTip title={isPartRecord ? "Replace / overhaul" : "Record compliance"}>
                    {isPartRecord
                      ? "Records the part as replaced or overhauled at the counter reading below: its install point moves there and its own time restarts at the TSN/TSO given (0 for a new part). A new serial number can be fitted. The entry goes to History."
                      : "Records the task as done at the reading or date below; the next due point is worked out from it. Recording the last phase completes the phase cycle."}
                  </InfoTip>
                </b>
                <div>
                  {isPartRecord && (
                    <>
                      <div>
                        <FieldLabel label="Serial number fitted" />
                        <input className={c.field} value={record.serial_number} onChange={(e) => setRecord((r) => ({ ...r, serial_number: e.target.value }))} />
                      </div>
                      <div>
                        <FieldLabel label={item.basis === "rin" ? "RIN of the part fitted" : "Time since new / overhaul"} help={FIELD_HELP.value_at_install} />
                        <input className={c.field} type="number" step="any" min={0} value={record.value_at_install} onChange={(e) => setRecord((r) => ({ ...r, value_at_install: e.target.value }))} />
                      </div>
                    </>
                  )}
                  {DATE_BASES.includes(item.basis) || UNTIMED_BASES.includes(item.basis) ? (
                    <div>
                      <FieldLabel label="Date performed" />
                      <input className={c.field} type="date" value={record.performed_date} onChange={(e) => setRecord((r) => ({ ...r, performed_date: e.target.value }))} />
                    </div>
                  ) : (
                    <div>
                      <FieldLabel
                        label="Performed at (counter now, editable)"
                        help={{ title: "Performed at", text: `The counter reading the work was done at. Defaults to the reading now: ${fmt(counterNow)}.` }}
                      />
                      <input className={c.field} type="number" step="any" min={0} value={record.performed_value} onChange={(e) => setRecord((r) => ({ ...r, performed_value: e.target.value }))} />
                    </div>
                  )}
                  {item.basis === "expiry" && (
                    <div>
                      <FieldLabel label="New expiry date (optional)" />
                      <input className={c.field} type="date" value={record.expiry_date} onChange={(e) => setRecord((r) => ({ ...r, expiry_date: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <FieldLabel label="Remarks (optional)" />
                    <input className={c.field} value={record.remarks} onChange={(e) => setRecord((r) => ({ ...r, remarks: e.target.value }))} />
                  </div>
                </div>
                <Button size="sm" style={{ marginTop: 12 }} onClick={doRecord} isLoading={recording}>
                  {isPartRecord ? "Record replacement" : "Record compliance"}
                </Button>
              </div>
            )}
          </>
        )}
      </TrackerDialog>

      {confirmDelete && (
        <ConfirmDialog message="Delete this item?" destructive confirmLabel="Delete" onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />
      )}
    </>
  );
};
