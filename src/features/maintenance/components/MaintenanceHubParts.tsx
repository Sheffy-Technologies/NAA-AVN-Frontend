import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { useHubPermissions } from "./hubPermissions";
import { showToast } from "@/shared/store/toastSlice";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import {
  useCreateSparesRequestMutation,
  useDrawFromHubMutation,
  useGetHubCatalogueQuery,
  useGetHubDrawsQuery,
  useGetSparesRequestsQuery,
  useGetTrackerWorkOrdersQuery,
  useIssueToHubMutation,
  useReturnHubDrawMutation,
  type HubDraw,
  type HubStockItem,
  type SparesRequest,
} from "@/features/maintenance/tracker/api";
import { apiError } from "@/features/maintenance/tracker/trackerHelpers";

/*
 * The Maintenance Hub's own store, as seen from Maintenance → Inventory:
 * request parts from the General Store (a NAAVN-007 spares request), see
 * those requests, draw Hub stock onto work orders and return what wasn't used.
 * Server side: MaintenanceStoreController.
 */

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  submitted: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  approved: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  issued: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const useOpenWorkOrders = () => {
  const { data: workOrders = [], isLoading } = useGetTrackerWorkOrdersQuery();
  const options = useMemo(
    () =>
      workOrders
        .filter((w) => w.status !== "completed")
        .map((w) => ({
          value: w.id,
          label: w.work_order_number || `Work order #${w.id}`,
          description: [w.asset?.tail_number || w.asset?.name, w.title].filter(Boolean).join(" · ") || undefined,
          assetId: w.asset_id,
        })),
    [workOrders],
  );
  return { options, isLoading };
};

const Modal = ({
  title,
  subtitle,
  onClose,
  footer,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) => {
  const { isDark } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full rounded-xl border p-5 shadow-2xl my-8 text-xs",
          wide ? "max-w-3xl" : "max-w-lg",
          isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-slate-200 dark:border-[#0A4D66]/50">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">{title}</h3>
            {subtitle && <p className="mt-1 opacity-70">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>
        {children}
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-[#0A4D66]/50">{footer}</div>
      </div>
    </div>
  );
};

const fieldClass =
  "w-full rounded-md border border-slate-300 dark:border-[#0A4D66]/50 bg-white dark:bg-[#001219] px-2.5 py-1.5 text-xs outline-none focus:border-[#0369A1] dark:focus:border-[#7FD5FF]";

const PrimaryButton = ({ busy, disabled, onClick, children }: { busy?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy || disabled}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] disabled:opacity-50"
  >
    {busy && <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

const SecondaryButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#0A4D66]/60 hover:bg-slate-100 dark:hover:bg-[#0A4D66]/30"
  >
    {children}
  </button>
);

type RequestLine = { key: number; part_number: string; description: string; quantity: string; available: number | null };

/**
 * Raises a NAAVN-007 spares request for the Hub. Lines come from the General
 * Store catalogue (part number, description, quantity available) or are typed
 * in for parts the store doesn't hold. The work order is optional.
 */
export const RequestPartsDialog = ({ onClose, onSubmitted, workOrderId }: { onClose: () => void; onSubmitted?: () => void; workOrderId?: number }) => {
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState("");
  const { data: catalogue = [], isFetching } = useGetHubCatalogueQuery();
  const { options: workOrders } = useOpenWorkOrders();
  const [create, { isLoading }] = useCreateSparesRequestMutation();
  const [workOrder, setWorkOrder] = useState<number | null>(workOrderId ?? null);
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<RequestLine[]>([]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogue
      .filter((c) => !q || [c.part_number, c.description, c.nsn].some((v) => v?.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [catalogue, search]);

  const addLine = (line: Omit<RequestLine, "key" | "quantity">) =>
    setLines((prev) =>
      prev.some((l) => l.part_number && l.part_number === line.part_number)
        ? prev
        : [...prev, { ...line, key: Date.now() + prev.length, quantity: "1" }],
    );
  const setLine = (key: number, patch: Partial<RequestLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async () => {
    const valid = lines.filter((l) => (l.part_number.trim() || l.description.trim()) && Number(l.quantity) > 0);
    if (!valid.length) return dispatch(showToast({ type: "error", message: "Add at least one part with a quantity." }));
    const assetId = workOrders.find((w) => w.value === workOrder)?.assetId ?? null;
    try {
      const saved = await create({
        status: "submitted",
        remarks: remarks.trim() || null,
        lines: valid.map((l) => ({
          part_number: l.part_number.trim() || null,
          description: l.description.trim() || null,
          quantity: Number(l.quantity),
          work_order_id: workOrder,
          asset_id: assetId,
        })),
      }).unwrap();
      dispatch(showToast({ type: "success", message: `Spares request ${saved.request_number} submitted to stores.` }));
      onClose();
      onSubmitted?.();
    } catch (err) {
      dispatch(showToast({ type: "error", message: apiError(err, "The request could not be raised.") }));
    }
  };

  return (
    <Modal
      wide
      title="Request parts for the Maintenance Hub"
      subtitle="Goes to stores as a NAAVN-007 spares request. Once approved and issued, the parts arrive in Hub stock."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton busy={isLoading} disabled={!lines.length} onClick={() => void submit()}>
            Submit request
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className="block font-semibold">General Store stock</span>
          <input className={fieldClass} placeholder="Search part number, description or NSN…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-[#0A4D66]/40 divide-y divide-slate-100 dark:divide-[#0A4D66]/20">
            {isFetching && !catalogue.length ? (
              <p className="p-3 opacity-60">Loading…</p>
            ) : shown.length === 0 ? (
              <p className="p-3 opacity-60">Nothing matches. Add the part by hand below.</p>
            ) : (
              shown.map((c) => (
                <button
                  key={`${c.part_number}-${c.description}`}
                  type="button"
                  onClick={() => addLine({ part_number: c.part_number ?? "", description: c.description ?? "", available: c.available })}
                  className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{c.part_number || "—"}</span>
                    <span className="block opacity-70 truncate">{c.description}</span>
                  </span>
                  <span className={cn("shrink-0 font-semibold", c.available > 0 ? "text-emerald-500" : "text-red-400")}>
                    {c.available} {c.measurement_unit ?? ""}
                  </span>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => addLine({ part_number: "", description: "", available: null })}
            className="inline-flex items-center gap-1 font-semibold text-[#0369A1] dark:text-[#7FD5FF] hover:underline"
          >
            <Icon icon="mdi:plus" className="w-4 h-4" /> Add a part by hand
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="block font-semibold mb-1">For work order (optional)</span>
            <SearchableSelect
              size="sm"
              placeholder="No work order"
              options={workOrders}
              value={workOrder}
              onChange={(v) => setWorkOrder(v === null ? null : Number(v))}
              clearable
            />
          </label>
          <div>
            <span className="block font-semibold mb-1">Parts requested ({lines.length})</span>
            {lines.length === 0 ? (
              <p className="opacity-60">Pick parts from the General Store list.</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li key={l.key} className="grid grid-cols-[1fr_1.4fr_60px_auto] gap-1.5 items-center">
                    <input className={fieldClass} placeholder="P/N" value={l.part_number} onChange={(e) => setLine(l.key, { part_number: e.target.value })} />
                    <input className={fieldClass} placeholder="Description" value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} />
                    <input
                      className={fieldClass}
                      type="number"
                      min={1}
                      aria-label="Quantity"
                      value={l.quantity}
                      onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                      title={l.available !== null ? `${l.available} in the General Store` : undefined}
                    />
                    <button type="button" aria-label="Remove" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} className="p-1 text-red-400 hover:bg-red-500/10 rounded">
                      <Icon icon="mdi:close" className="w-4 h-4" />
                    </button>
                    {l.available !== null && Number(l.quantity) > l.available && (
                      <span className="col-span-4 text-amber-500">Only {l.available} in the General Store; stores may need to procure the rest.</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="block">
            <span className="block font-semibold mb-1">Remarks</span>
            <textarea className={fieldClass} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
};

/** Takes Hub stock for a work order. */
export const DrawToWorkOrderDialog = ({ item, onClose }: { item: HubStockItem; onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const { options: workOrders } = useOpenWorkOrders();
  const [draw, { isLoading }] = useDrawFromHubMutation();
  const [workOrder, setWorkOrder] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const submit = async () => {
    const qty = Number(quantity);
    if (!workOrder) return dispatch(showToast({ type: "error", message: "Choose the work order." }));
    if (!(qty > 0)) return dispatch(showToast({ type: "error", message: "Enter a quantity." }));
    try {
      await draw({ inventory_id: item.id, work_order_id: workOrder, quantity: qty, note: note.trim() || null }).unwrap();
      dispatch(showToast({ type: "success", message: `${qty} × ${item.part_number || item.description} drawn onto the work order.` }));
      onClose();
    } catch (err) {
      dispatch(showToast({ type: "error", message: apiError(err, "The parts could not be drawn.") }));
    }
  };

  return (
    <Modal
      title="Use on a work order"
      subtitle={`${item.part_number ?? ""} ${item.description} · ${item.current_stock} ${item.measurement_unit ?? ""} in the Hub`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton busy={isLoading} onClick={() => void submit()}>
            Draw from Hub
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="block font-semibold mb-1">Work order *</span>
          <SearchableSelect size="sm" placeholder="Choose an open work order" options={workOrders} value={workOrder} onChange={(v) => setWorkOrder(v === null ? null : Number(v))} />
        </label>
        <label className="block">
          <span className="block font-semibold mb-1">Quantity *</span>
          <input className={fieldClass} type="number" min={1} max={item.current_stock} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="block">
          <span className="block font-semibold mb-1">Note</span>
          <input className={fieldClass} placeholder="e.g. fitted at #2 M/R grip" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
};

/** Stores moves an approved request's parts from the General Store into the Hub. */
const IssueToHubDialog = ({ request, onClose }: { request: SparesRequest; onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const [issue, { isLoading }] = useIssueToHubMutation();
  const left = (l: SparesRequest["lines"][number]) => (l.quantity ?? 0) - (l.issued_quantity ?? 0);
  const outstanding = request.lines.filter((l) => l.id && left(l) > 0);
  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    Object.fromEntries(outstanding.map((l) => [l.id!, String(left(l))])),
  );

  const submit = async () => {
    const lines = outstanding
      .map((l) => ({ line_id: l.id!, quantity: Number(quantities[l.id!] || 0) }))
      .filter((l) => l.quantity > 0);
    if (!lines.length) return dispatch(showToast({ type: "error", message: "Enter at least one quantity." }));
    try {
      const saved = await issue({ id: request.id, lines }).unwrap();
      dispatch(
        showToast({
          type: "success",
          message: saved.status === "issued" ? `${request.request_number} fully issued to the Maintenance Hub.` : `Issued to the Maintenance Hub; ${request.request_number} still has parts outstanding.`,
        }),
      );
      onClose();
    } catch (err) {
      dispatch(showToast({ type: "error", message: apiError(err, "The parts could not be issued.") }));
    }
  };

  return (
    <Modal
      wide
      title={`Issue ${request.request_number} to the Maintenance Hub`}
      subtitle="Takes the quantities from General Store stock for each part and adds them to the Hub. Partial issues are fine."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton busy={isLoading} disabled={!outstanding.length} onClick={() => void submit()}>
            Issue to Hub
          </PrimaryButton>
        </>
      }
    >
      {outstanding.length === 0 ? (
        <p className="opacity-70">Every line has been issued.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left uppercase opacity-60">
              <th className="py-1.5 pr-2">Part</th>
              <th className="py-1.5 pr-2">Work order</th>
              <th className="py-1.5 pr-2">Requested</th>
              <th className="py-1.5 pr-2">Issued</th>
              <th className="py-1.5">Issue now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#0A4D66]/20">
            {outstanding.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5 pr-2">
                  <div className="font-semibold">{l.part_number || "—"}</div>
                  <div className="opacity-70">{l.description}</div>
                </td>
                <td className="py-1.5 pr-2">{l.work_order?.work_order_number ?? "-"}</td>
                <td className="py-1.5 pr-2">{l.quantity}</td>
                <td className="py-1.5 pr-2">{l.issued_quantity ?? 0}</td>
                <td className="py-1.5 w-24">
                  <input
                    className={fieldClass}
                    type="number"
                    min={0}
                    max={left(l)}
                    aria-label={`Quantity to issue for ${l.part_number || l.description}`}
                    value={quantities[l.id!] ?? ""}
                    onChange={(e) => setQuantities((q) => ({ ...q, [l.id!]: e.target.value }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
};

/** The Hub's spares requests: what's been asked for and how much has arrived. */
export const HubRequestsPanel = ({ search }: { search: string }) => {
  const navigate = useNavigate();
  const { canIssue } = useHubPermissions();
  const { data: requests = [], isLoading } = useGetSparesRequestsQuery();
  const [issuing, setIssuing] = useState<SparesRequest | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(
      (r) =>
        !q ||
        r.request_number.toLowerCase().includes(q) ||
        r.status.includes(q) ||
        r.lines.some((l) => [l.part_number, l.description, l.work_order?.work_order_number].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [requests, search]);

  if (isLoading) return <p className="text-xs py-10 text-center opacity-60">Loading spares requests…</p>;
  if (!rows.length) return <p className="text-xs py-10 text-center opacity-60">No spares requests yet. Use “Request parts” to ask stores for parts.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left border-b font-semibold uppercase tracking-wider opacity-70 border-slate-200 dark:border-[#0A4D66]/40">
            <th className="py-2.5 px-3">Request</th>
            <th className="py-2.5 px-3">Date</th>
            <th className="py-2.5 px-3">Parts</th>
            <th className="py-2.5 px-3">Work orders</th>
            <th className="py-2.5 px-3">Received in Hub</th>
            <th className="py-2.5 px-3">Status</th>
            <th className="py-2.5 px-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#0A4D66]/20">
          {rows.map((r) => {
            const requested = r.lines.reduce((s, l) => s + (l.quantity || 0), 0);
            const issued = r.lines.reduce((s, l) => s + (l.issued_quantity ?? 0), 0);
            const workOrders = [...new Set(r.lines.map((l) => l.work_order?.work_order_number).filter(Boolean))];
            return (
              <tr key={r.id}>
                <td className="py-2.5 px-3 font-semibold text-[#0A4D66] dark:text-[#7FD5FF]">{r.request_number}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{fmtDate(r.request_date)}</td>
                <td className="py-2.5 px-3">
                  {r.lines
                    .slice(0, 2)
                    .map((l) => `${l.quantity} × ${l.part_number || l.description}`)
                    .join(", ")}
                  {r.lines.length > 2 && ` +${r.lines.length - 2} more`}
                </td>
                <td className="py-2.5 px-3">{workOrders.join(", ") || "-"}</td>
                <td className="py-2.5 px-3">
                  {issued} / {requested}
                </td>
                <td className="py-2.5 px-3">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize", STATUS_CLASS[r.status])}>{r.status}</span>
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-3">
                  {canIssue && r.status === "approved" && (
                    <button type="button" onClick={() => setIssuing(r)} className="font-semibold text-emerald-500 hover:underline">
                      Issue to Hub
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/maintenance/tracking?view=spares-requests&sr=${r.id}`)}
                    className="font-semibold text-[#0A4D66] dark:text-[#7FD5FF] hover:underline"
                  >
                    Open
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {issuing && <IssueToHubDialog request={issuing} onClose={() => setIssuing(null)} />}
    </div>
  );
};

/** Hub stock drawn onto work orders, with returns of unused parts. */
export const HubDrawsPanel = ({ search }: { search: string }) => {
  const dispatch = useAppDispatch();
  const { canUse } = useHubPermissions();
  const { data: draws = [], isLoading } = useGetHubDrawsQuery();
  const [returnDraw, { isLoading: returning }] = useReturnHubDrawMutation();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return draws.filter((d) => !q || [d.part_number, d.description, d.work_order_number, d.drawn_by].some((v) => v?.toLowerCase().includes(q)));
  }, [draws, search]);

  const doReturn = async (d: HubDraw) => {
    const open = d.quantity - d.returned_quantity;
    const answer = window.prompt(`Return how many unused ${d.part_number || d.description} to the Hub? (up to ${open})`, String(open));
    const qty = Number(answer);
    if (!answer || !(qty > 0)) return;
    try {
      await returnDraw({ id: d.id, quantity: qty }).unwrap();
      dispatch(showToast({ type: "success", message: `${qty} returned to Hub stock.` }));
    } catch (err) {
      dispatch(showToast({ type: "error", message: apiError(err, "The parts could not be returned.") }));
    }
  };

  if (isLoading) return <p className="text-xs py-10 text-center opacity-60">Loading…</p>;
  if (!rows.length) return <p className="text-xs py-10 text-center opacity-60">No Hub stock has been drawn onto a work order yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left border-b font-semibold uppercase tracking-wider opacity-70 border-slate-200 dark:border-[#0A4D66]/40">
            <th className="py-2.5 px-3">Date</th>
            <th className="py-2.5 px-3">Part</th>
            <th className="py-2.5 px-3">Work order</th>
            <th className="py-2.5 px-3">Drawn</th>
            <th className="py-2.5 px-3">Returned</th>
            <th className="py-2.5 px-3">By</th>
            <th className="py-2.5 px-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#0A4D66]/20">
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="py-2.5 px-3 whitespace-nowrap">{fmtDate(d.movement_date ?? d.created_at)}</td>
              <td className="py-2.5 px-3">
                <div className="font-semibold">{d.part_number || "—"}</div>
                <div className="opacity-70">{d.description}</div>
                {d.note && <div className="opacity-60 italic">{d.note}</div>}
              </td>
              <td className="py-2.5 px-3">{d.work_order_number ?? "-"}</td>
              <td className="py-2.5 px-3 font-semibold">
                {d.quantity} {d.measurement_unit ?? ""}
              </td>
              <td className="py-2.5 px-3">{d.returned_quantity || "-"}</td>
              <td className="py-2.5 px-3">{d.drawn_by ?? "-"}</td>
              <td className="py-2.5 px-3 text-right">
                {canUse && d.quantity > d.returned_quantity && (
                  <button type="button" disabled={returning} onClick={() => void doReturn(d)} className="font-semibold text-[#0A4D66] dark:text-[#7FD5FF] hover:underline disabled:opacity-50">
                    Return unused
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
