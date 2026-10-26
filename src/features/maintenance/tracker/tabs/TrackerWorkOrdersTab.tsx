import { useMemo, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCloseWorkpackMutation,
  useDeleteWorkpackMutation,
  useFileSparesRequestMutation,
  useGetPartCatalogQuery,
  useGetSparesRequestsQuery,
  useGetTrackerOptionsQuery,
  useGetTrackerWorkOrdersQuery,
  useGetWorkpackQuery,
  useRaiseOverdueWorkOrdersMutation,
  useSetAutoRaiseWorkOrdersMutation,
  useUpdateWorkpackMutation,
  type SpareLine,
  type TrackerSheet,
  type Workpack,
  type WorkpackComponentRow,
  type WorkpackUpdate,
} from "../api";
import { apiError, fmtDate, safeFileName, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { HelpHeader, StatusPill } from "../trackerUi";
import { NaavnLogo, Paper } from "../components/NaavnPaper";
import { downloadPaperPdf, printPaper } from "../components/paperPrint";
import { SignField } from "../components/SignField";
import { ConfirmDialog } from "../components/TrackerDialog";
import type { TrackerNav } from "../MaintenanceTracker";

const SR_STATUS_PILL = { draft: "no_data", submitted: "due_soon", approved: "ok", issued: "ok" } as const;

const blankComponent = (): WorkpackComponentRow => ({ description: "", part_number_off: "", serial_number_off: "", part_number_on: "", serial_number_on: "" });
const blankSpare = (): SpareLine => ({ part_number: "", alternate_part_number: "", description: "", quantity: 1, mm_reference: "" });

export const TrackerWorkOrdersTab = ({ sheet, nav, openId }: { sheet: TrackerSheet; nav: TrackerNav; openId: number | null }) => {
  if (openId) return <WorkpackView id={openId} sheet={sheet} nav={nav} />;
  return <WorkOrderList sheet={sheet} nav={nav} />;
};

const WorkOrderList = ({ sheet, nav }: { sheet: TrackerSheet; nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const { data: workOrders = [], isLoading } = useGetTrackerWorkOrdersQuery({ asset_id: sheet.asset.id });
  const { data: requests = [] } = useGetSparesRequestsQuery({ asset_id: sheet.asset.id });
  const { data: options } = useGetTrackerOptionsQuery();
  const [raiseOverdue, { isLoading: raising }] = useRaiseOverdueWorkOrdersMutation();
  const [setAutoRaise] = useSetAutoRaiseWorkOrdersMutation();

  const missing = sheet.items.filter((i) => i.tracking.status === "overdue" && !i.open_work_order).length;
  const itemsById = useMemo(() => new Map(sheet.items.map((i) => [i.id, i])), [sheet.items]);
  const rows = useMemo(() => [...workOrders].sort((a, b) => (b.work_order_number ?? "").localeCompare(a.work_order_number ?? "") || b.id - a.id), [workOrders]);

  const raiseAll = async () => {
    try {
      const res = await raiseOverdue(sheet.asset.id).unwrap();
      dispatch(showToast({ message: `Raised ${res.raised} work order(s).`, type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't raise the work orders."), type: "error" }));
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className={cn("flex items-center gap-2 text-xs", !perms.isSuperAdmin && "opacity-70")}>
          <input
            type="checkbox"
            checked={Boolean(options?.auto_raise_work_orders)}
            disabled={!perms.isSuperAdmin}
            onChange={(e) =>
              setAutoRaise(e.target.checked)
                .unwrap()
                .catch((err) => dispatch(showToast({ message: apiError(err, "Couldn't change the setting."), type: "error" })))
            }
          />
          Auto-raise a work order for every overdue component and inspection
          <InfoTip title="Auto-raise work orders">
            When on, the daily maintenance check raises a NAAVN-005 work order for every overdue tracker item, on every aircraft, that has none open. It is a system setting, so only a super-admin can change it.
          </InfoTip>
        </label>
        <span className="flex-1" />
        {perms.canRaiseWo && (
          <Button size="sm" onClick={raiseAll} disabled={!missing} isLoading={raising}>
            Raise {missing} missing
          </Button>
        )}
      </div>

      <div className={c.tableWrap}>
        <table style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <HelpHeader label="Work order" help={{ title: "Work order number", text: "NAAVN/WO/year/number, numbered from 1 each year." }} />
              <HelpHeader label="Date" />
              <HelpHeader label="Task" />
              <HelpHeader label="Item status" help={{ title: "Item status", text: "The tracker status of the item the work order was raised for, now." }} />
              <HelpHeader label="WO status" />
              <HelpHeader label="Spares request" />
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
                  No work orders yet. Raise one from an overdue item.
                </td>
              </tr>
            )}
            {rows.map((wo) => {
              const item = wo.maintenance_tracking_item_id ? itemsById.get(wo.maintenance_tracking_item_id) : undefined;
              const closed = wo.status === "completed";
              const filed = requests.filter((r) => r.lines.some((l) => l.work_order_id === wo.id));
              return (
                <tr
                  key={wo.id}
                  tabIndex={0}
                  className="click"
                  onClick={(e) => onInteractiveRowClick(e, () => nav.openWorkOrder(wo.id))}
                  onKeyDown={(e) => onInteractiveRowKeyDown(e, () => nav.openWorkOrder(wo.id))}
                >
                  <td className={cn(c.td, "font-bold")}>{wo.work_order_number ?? `#${wo.id}`}</td>
                  <td>{fmtDate(wo.work_date ?? wo.created_at)}</td>
                  <td>
                    {item?.description.trim() ?? wo.title}
                    <div className={c.muted}>{item ? [item.part_number, item.serial_number].filter(Boolean).join(" · ") : ""}</div>
                  </td>
                  <td>{!closed && item ? <StatusPill status={item.tracking.status} /> : null}</td>
                  <td>
                    <StatusPill status={closed ? "ok" : "due_soon"}>{closed ? "Closed" : "Open"}</StatusPill>
                  </td>
                  <td>
                    {filed.map((r) => (
                      <button key={r.id} type="button" className="mr-1 whitespace-nowrap" onClick={() => nav.openSparesRequest(r.id)}>
                        <StatusPill status={SR_STATUS_PILL[r.status]}>{r.request_number.split("/").slice(-2).join("/")}</StatusPill>
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

type FormState = {
  title: string;
  location: string;
  work_date: string;
  airframe_total_time: string;
  engine_total_time: string;
  task_defect: string;
  action_taken: string;
  engineer_name: string;
  engineer_licence_number: string;
  certifying_engineer_name: string;
  certifying_engineer_licence_number: string;
  components: WorkpackComponentRow[];
  spares: SpareLine[];
};

const toForm = (wo: Workpack): FormState => ({
  title: wo.title ?? "",
  location: wo.location ?? "",
  work_date: wo.work_date ?? wo.created_at?.slice(0, 10) ?? "",
  airframe_total_time: wo.airframe_total_time === null ? "" : String(wo.airframe_total_time),
  engine_total_time: wo.engine_total_time === null ? "" : String(wo.engine_total_time),
  task_defect: wo.task_defect ?? "",
  action_taken: wo.action_taken ?? "",
  engineer_name: wo.engineer_name ?? "",
  engineer_licence_number: wo.engineer_licence_number ?? "",
  certifying_engineer_name: wo.certifying_engineer_name ?? "",
  certifying_engineer_licence_number: wo.certifying_engineer_licence_number ?? "",
  components: [0, 1].map((i) => ({ ...blankComponent(), ...(wo.components?.[i] ?? {}) })),
  spares: wo.pending_spares ?? [],
});

const WorkpackView = ({ id, sheet, nav }: { id: number; sheet: TrackerSheet; nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const { data: wo, isLoading, isError } = useGetWorkpackQuery(id);
  if (isLoading || !wo) return <div className={cn("py-10 text-center text-sm", c.muted)}>{isError ? "Couldn't load the work order." : "Loading…"}</div>;
  // Remounts with fresh form state whenever the saved work order changes.
  return <WorkpackEditor key={`${wo.id}-${wo.updated_at}`} wo={wo} sheet={sheet} nav={nav} />;
};

const WorkpackEditor = ({ wo, sheet, nav }: { wo: Workpack; sheet: TrackerSheet; nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const paperRef = useRef<HTMLDivElement>(null);
  const { data: catalog = [] } = useGetPartCatalogQuery();
  const { data: requests = [] } = useGetSparesRequestsQuery();
  const [updateWorkpack, { isLoading: saving }] = useUpdateWorkpackMutation();
  const [closeWorkpack, { isLoading: closing }] = useCloseWorkpackMutation();
  const [deleteWorkpack] = useDeleteWorkpackMutation();
  const [fileRequest, { isLoading: filing }] = useFileSparesRequestMutation();
  const [form, setForm] = useState<FormState>(() => toForm(wo));
  const [signatures, setSignatures] = useState<{ engineer: string | null; certifying: string | null }>({ engineer: null, certifying: null });
  const [dirty, setDirty] = useState(false);
  const [target, setTarget] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const closed = wo.status === "completed";
  const locked = closed || !perms.canEditWo;
  const item = sheet.items.find((i) => i.id === wo.maintenance_tracking_item_id);
  const filed = requests.filter((r) => r.lines.some((l) => l.work_order_id === wo.id));
  const drafts = requests.filter((r) => r.status === "draft");

  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const payload = (): WorkpackUpdate => {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    return {
      title: form.title,
      location: form.location || null,
      work_date: form.work_date || null,
      airframe_total_time: num(form.airframe_total_time),
      engine_total_time: num(form.engine_total_time),
      task_defect: form.task_defect,
      action_taken: form.action_taken,
      engineer_name: form.engineer_name || null,
      engineer_licence_number: form.engineer_licence_number || null,
      certifying_engineer_name: form.certifying_engineer_name || null,
      certifying_engineer_licence_number: form.certifying_engineer_licence_number || null,
      components: form.components,
      pending_spares: form.spares.filter((l) => l.part_number || l.description),
      ...(signatures.engineer !== null ? { engineer_signature: signatures.engineer } : {}),
      ...(signatures.certifying !== null ? { certifying_engineer_signature: signatures.certifying } : {}),
    };
  };

  const save = async () => {
    try {
      await updateWorkpack({ id: wo.id, data: payload() }).unwrap();
      setDirty(false);
      dispatch(showToast({ message: "Work order saved.", type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't save the work order."), type: "error" }));
    }
  };

  const close = async () => {
    if (!form.engineer_name.trim() || !form.certifying_engineer_name.trim()) {
      dispatch(showToast({ message: "Enter the engineer and the certifying engineer before closing.", type: "error" }));
      return;
    }
    try {
      await closeWorkpack({ id: wo.id, assetId: wo.asset_id, data: payload() }).unwrap();
      dispatch(showToast({ message: `${wo.work_order_number} closed. The tracker has been updated.`, type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't close the work order."), type: "error" }));
    }
  };

  const remove = async () => {
    try {
      await deleteWorkpack({ id: wo.id, assetId: wo.asset_id }).unwrap();
      nav.go("work-orders");
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't delete the work order."), type: "error" }));
    }
  };

  const file = async () => {
    const lines = form.spares.filter((l) => l.part_number || l.description);
    try {
      const sr = await fileRequest({ workOrderId: wo.id, target_request_id: target ? Number(target) : null, ...(lines.length ? { lines } : {}) }).unwrap();
      update({ spares: [] });
      setDirty(false);
      nav.openSparesRequest(sr.id);
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't file the spares request."), type: "error" }));
    }
  };

  const setComponent = (i: number, key: keyof WorkpackComponentRow, value: string) =>
    update({ components: form.components.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)) });

  const setSpare = (i: number, key: keyof SpareLine, value: string) => {
    const spares = form.spares.map((line, idx) => {
      if (idx !== i) return line;
      const next = { ...line, [key]: key === "quantity" ? Number(value) || null : value };
      if (key === "part_number") {
        const hit = catalog.find((p) => p.part_number.toLowerCase() === value.trim().toLowerCase());
        if (hit) Object.assign(next, { part_number: hit.part_number, description: hit.description ?? next.description, alternate_part_number: hit.alternate_part_number ?? next.alternate_part_number, mm_reference: next.mm_reference || hit.mm_reference });
      }
      return next;
    });
    update({ spares });
  };

  const field = (key: keyof FormState, type = "text") => (
    <input type={type} step={type === "number" ? "0.1" : undefined} disabled={locked} value={form[key] as string} onChange={(e) => update({ [key]: e.target.value } as Partial<FormState>)} />
  );

  const componentTable = (i: number) => (
    <table key={i}>
      <colgroup>
        <col style={{ width: "30%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "23%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "23%" }} />
      </colgroup>
      <tbody>
        <tr>
          <td className="l">COMPONENT DESCRIPTION:</td>
          <td colSpan={4}>
            <input disabled={locked} value={form.components[i].description ?? ""} onChange={(e) => setComponent(i, "description", e.target.value)} />
          </td>
        </tr>
        {(["off", "on"] as const).map((side) => (
          <tr key={side}>
            <td className="nb" />
            <td className="l">P/N {side.toUpperCase()}:</td>
            <td>
              <input disabled={locked} value={(form.components[i][`part_number_${side}`] as string) ?? ""} onChange={(e) => setComponent(i, `part_number_${side}`, e.target.value)} />
            </td>
            <td className="l">S/N {side.toUpperCase()}:</td>
            <td>
              <input disabled={locked} value={(form.components[i][`serial_number_${side}`] as string) ?? ""} onChange={(e) => setComponent(i, `serial_number_${side}`, e.target.value)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const signer = (title: string, nameKey: "engineer_name" | "certifying_engineer_name", licenceKey: "engineer_licence_number" | "certifying_engineer_licence_number", role: "engineer" | "certifying") => (
    <table>
      <tbody>
        <tr>
          <td className="l" style={{ width: "40%" }}>
            {title}:
          </td>
          <td>
            <input disabled={locked} placeholder="RANK INITIAL AND SURNAME" value={form[nameKey]} onChange={(e) => update({ [nameKey]: e.target.value } as Partial<FormState>)} />
          </td>
        </tr>
        <tr>
          <td className="l">LICENSE NUMBER:</td>
          <td>{field(licenceKey)}</td>
        </tr>
        <tr>
          <td className="l" style={{ height: 60 }}>
            SIGNATURE:
          </td>
          <td>
            <SignField
              storedPath={(role === "engineer" ? wo.has_engineer_signature : wo.has_certifying_engineer_signature) ? `/work-orders/${wo.id}/signature/${role === "engineer" ? "engineer" : "certifying_engineer"}` : null}
              pending={signatures[role]}
              disabled={locked}
              onChange={(v) => {
                setSignatures((s) => ({ ...s, [role]: v }));
                setDirty(true);
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div>
      <div className="mt-bar">
        <Button size="sm" variant="secondary" onClick={() => nav.go("work-orders")}>
          All work orders
        </Button>
        <StatusPill status={closed ? "ok" : "due_soon"}>{closed ? `Closed ${fmtDate(wo.closed_at)}` : "Open"}</StatusPill>
        {!closed && item && <StatusPill status={item.tracking.status} />}
        <span className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => printPaper(paperRef.current, wo.work_order_number ?? "Work order")}>
          Print
        </Button>
        <Button size="sm" variant="secondary" onClick={() => downloadPaperPdf(paperRef.current, safeFileName(wo.work_order_number ?? `work-order-${wo.id}`))}>
          Download PDF
        </Button>
        {!locked && (
          <>
            <Button size="sm" variant="secondary" onClick={save} isLoading={saving} disabled={!dirty}>
              Save
            </Button>
            <Button size="sm" onClick={close} isLoading={closing}>
              Close work order
            </Button>
          </>
        )}
        {!closed && perms.has("work-orders.delete") && (
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      <Paper ref={paperRef}>
        <div className="c">RESTRICTED</div>
        <table className="hd">
          <colgroup>
            <col style={{ width: "18%" }} />
            <col />
            <col style={{ width: "24%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td>
                <NaavnLogo side="right" />
              </td>
              <td className="tt">
                NIGERIAN ARMY AVIATION
                <br />
                MAINTENANCE WORKPACK
              </td>
              <td className="h">
                DOCUMENT REF No.:
                <br />
                <b>NAAVN-005</b>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="gr">
          <table>
            <tbody>
              <tr>
                <td className="l" style={{ width: "48%" }}>
                  AIRCRAFT REGISTRATION:
                </td>
                <td>{wo.asset?.tail_number ?? sheet.asset.registration}</td>
              </tr>
              <tr>
                <td className="l">LOCATION:</td>
                <td>{field("location")}</td>
              </tr>
            </tbody>
          </table>
          <table>
            <tbody>
              <tr>
                <td className="l" style={{ width: "40%" }}>
                  WORK ORDER NO.:
                </td>
                <td>
                  <b>{wo.work_order_number}</b>
                </td>
              </tr>
              <tr>
                <td className="l">DATE:</td>
                <td>{field("work_date", "date")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="gr">
          <table>
            <tbody>
              <tr>
                <td className="l" style={{ width: "48%" }}>
                  AIRFRAME TOTAL TIME:
                </td>
                <td>{field("airframe_total_time", "number")}</td>
              </tr>
            </tbody>
          </table>
          <table>
            <tbody>
              <tr>
                <td className="l" style={{ width: "48%" }}>
                  ENGINE TOTAL TIME:
                </td>
                <td>{field("engine_total_time", "number")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <table>
          <tbody>
            <tr>
              <td className="l h">TASK DEFECT</td>
            </tr>
            <tr>
              <td>
                <textarea disabled={locked} value={form.task_defect} onChange={(e) => update({ task_defect: e.target.value })} />
              </td>
            </tr>
          </tbody>
        </table>
        <table>
          <tbody>
            <tr>
              <td className="l h">ACTION TAKEN</td>
            </tr>
            <tr>
              <td>
                <textarea disabled={locked} value={form.action_taken} onChange={(e) => update({ action_taken: e.target.value })} />
              </td>
            </tr>
          </tbody>
        </table>
        {[0, 1].map(componentTable)}
        <div className="c" style={{ fontWeight: 700, margin: "0 0 4px" }}>
          I hereby certify that all maintenance has been carried out IAW the relevant Maintenance Manual
        </div>
        <div className="gr">
          {signer("ENGINEER", "engineer_name", "engineer_licence_number", "engineer")}
          {signer("CERT. ENGINEER", "certifying_engineer_name", "certifying_engineer_licence_number", "certifying")}
        </div>
        <table>
          <tbody>
            <tr>
              <td className="h">Revision No.: 01</td>
              <td className="h">Revision Date: 20 December 2025</td>
              <td className="h">Page 1 of 1</td>
            </tr>
          </tbody>
        </table>
        <div className="c">RESTRICTED</div>
      </Paper>

      {/* Spares & hardware for this work order */}
      <div className={cn(c.card, "mx-auto mt-4 max-w-[820px]")}>
        <h2>
          Spares &amp; hardware for this work order
          <InfoTip title="Spares & hardware">
            Lines picked from the spares catalog take its description, alternate P/N and MM reference. Filing sends them to a new NAAVN-007 spares request, or adds them to a draft one; with no lines, the component on the form is requested.
          </InfoTip>
        </h2>
        {filed.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
            Filed:
            {filed.map((r) => (
              <button key={r.id} type="button" onClick={() => nav.openSparesRequest(r.id)}>
                <StatusPill status={SR_STATUS_PILL[r.status]}>
                  {r.request_number} · {r.status}
                </StatusPill>
              </button>
            ))}
          </div>
        )}
        <datalist id="tracker-catalog">
          {catalog.map((p) => (
            <option key={p.id} value={p.part_number}>
              {p.description}
            </option>
          ))}
        </datalist>
        {form.spares.length > 0 ? (
          <div className="mt-tw">
            <table style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  {["Part number", "Alternate P/N", "Description", "Qty", "MM reference", ""].map((h) => (
                    <th key={h} className={c.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.spares.map((line, i) => (
                  <tr key={i}>
                    <td className="p-1">
                      <input className={c.field} list="tracker-catalog" disabled={locked} value={line.part_number ?? ""} onChange={(e) => setSpare(i, "part_number", e.target.value)} />
                    </td>
                    <td className="p-1">
                      <input className={c.field} disabled={locked} value={line.alternate_part_number ?? ""} onChange={(e) => setSpare(i, "alternate_part_number", e.target.value)} />
                    </td>
                    <td className="p-1">
                      <input className={c.field} disabled={locked} value={line.description ?? ""} onChange={(e) => setSpare(i, "description", e.target.value)} />
                    </td>
                    <td className="w-20 p-1">
                      <input className={c.field} type="number" min={1} disabled={locked} value={line.quantity ?? ""} onChange={(e) => setSpare(i, "quantity", e.target.value)} />
                    </td>
                    <td className="p-1">
                      <input className={c.field} disabled={locked} value={line.mm_reference ?? ""} onChange={(e) => setSpare(i, "mm_reference", e.target.value)} />
                    </td>
                    <td className="p-1 text-center">
                      {!locked && (
                        <button type="button" className="mt-x" onClick={() => update({ spares: form.spares.filter((_, idx) => idx !== i) })}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={cn("text-xs", c.muted)}>No lines yet. Pick from the catalog, type one in, or add the component being replaced.</div>
        )}
        {!locked && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="xs" variant="secondary" onClick={() => update({ spares: [...form.spares, blankSpare()] })}>
              Add line
            </Button>
            <Button
              size="xs"
              variant="secondary"
             
              onClick={() =>
                update({
                  spares: [
                    ...form.spares,
                    { ...blankSpare(), part_number: form.components[0].part_number_off || item?.part_number || "", description: form.components[0].description || item?.description.trim() || "" },
                  ],
                })
              }
            >
              Component being replaced
            </Button>
            <span className="flex-1" />
            <select className={cn(c.field, "w-auto")} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">New request</option>
              {drafts.map((r) => (
                <option key={r.id} value={r.id}>
                  Add to {r.request_number}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={file} isLoading={filing} disabled={!perms.has("spares-requests.create")}>
              File spares request
            </Button>
          </div>
        )}
      </div>

      <p className={cn("mx-auto mt-3 max-w-[820px] text-center text-xs", c.muted)}>
        Closing needs the engineer and the certifying engineer. It then updates the tracker: an inspection is marked done at the airframe or engine time on the form, and a component with a P/N or S/N ON is recorded as replaced with its time since new reset to 0.
      </p>

      {confirmDelete && (
        <ConfirmDialog
          destructive
          confirmLabel="Delete"
          message={`Delete ${wo.work_order_number}? If auto-raise is on and the item is still overdue, a new work order will be raised.`}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
};
