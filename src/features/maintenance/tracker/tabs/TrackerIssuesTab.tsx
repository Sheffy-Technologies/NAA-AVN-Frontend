import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateVoucherMutation,
  useDeleteStockEntryMutation,
  useDeleteVoucherMutation,
  useGetPartCatalogQuery,
  useGetSparesRequestsQuery,
  useGetStockEntriesQuery,
  useGetStockMatrixQuery,
  useGetVoucherQuery,
  useGetVouchersQuery,
  useUpdateVoucherMutation,
  useVoucherActionMutation,
  type Voucher,
  type VoucherStatus,
} from "../api";
import { apiError, fmtDate, safeFileName, today, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { HelpHeader, StatusPill } from "../trackerUi";
import { NaavnLogo, Paper } from "../components/NaavnPaper";
import { downloadPaperPdf, printPaper } from "../components/paperPrint";
import { ConfirmDialog, TrackerDialog } from "../components/TrackerDialog";
import type { TrackerNav } from "../MaintenanceTracker";

const VOUCHER_PILL: Record<VoucherStatus, { label: string; pill: "no_data" | "due_soon" | "ok" | "overdue" }> = {
  draft: { label: "Draft", pill: "no_data" },
  pending_approval: { label: "Awaiting approval", pill: "due_soon" },
  approved: { label: "Approved", pill: "ok" },
  rejected: { label: "Rejected", pill: "overdue" },
  issued: { label: "Issued", pill: "due_soon" },
  received: { label: "Received", pill: "ok" },
  cancelled: { label: "Cancelled", pill: "overdue" },
};

const REASON_LABEL = { opening_balance: "Opening balance", receipt: "Receipt", adjustment: "Adjustment" } as const;

const name = (p?: { firstname: string | null; lastname: string | null } | null) => (p ? [p.firstname, p.lastname].filter(Boolean).join(" ") : "");

export const VoucherPill = ({ status }: { status: VoucherStatus }) => <StatusPill status={VOUCHER_PILL[status].pill}>{VOUCHER_PILL[status].label}</StatusPill>;

export const TrackerIssuesTab = ({ nav, openId }: { nav: TrackerNav; openId: number | null }) => {
  const [params] = useSearchParams();
  if (params.get("voucher") === "new") return <VoucherView id={null} nav={nav} initialFrom={Number(params.get("from")) || null} initialPart={params.get("pn")} />;
  if (openId) return <VoucherView id={openId} nav={nav} />;
  return <IssueLists nav={nav} />;
};

const IssueLists = ({ nav }: { nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const { data: vouchers = [], isLoading } = useGetVouchersQuery();
  const { data: entries = [] } = useGetStockEntriesQuery();
  const [deleteEntry] = useDeleteStockEntryMutation();
  const [removing, setRemoving] = useState<number | null>(null);

  return (
    <div>
      <div className="mt-bar">
        <h2>
          Issue vouchers
          <InfoTip title="Issue vouchers">
            Stock moving between units. Issuing deducts it from the sending unit; the receiving unit then confirms receipt and it is added to their stock. Cancelling reverses both, unless the receiving unit has already issued it on.
          </InfoTip>
        </h2>
        <span className="flex-1" />
        {perms.has("stock-issues.create") && (
          <Button size="sm" onClick={() => nav.go("issues", { voucher: "new" })}>
            New issue voucher
          </Button>
        )}
      </div>
      <div className={c.tableWrap}>
        <table style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <HelpHeader label="Voucher" />
              <HelpHeader label="Date" />
              <HelpHeader label="From → To" />
              <HelpHeader label="Qty" align="right" />
              <HelpHeader label="Reference" />
              <HelpHeader label="Status" />
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
            {!isLoading && vouchers.length === 0 && (
              <tr>
                <td colSpan={6} className="mt-empty">
                  No vouchers yet. Issue stock from one unit to another to move it between them.
                </td>
              </tr>
            )}
            {vouchers.map((v) => (
              <tr
                key={v.id}
                tabIndex={0}
                className="click"
                onClick={(e) => onInteractiveRowClick(e, () => nav.openVoucher(v.id))}
                onKeyDown={(e) => onInteractiveRowKeyDown(e, () => nav.openVoucher(v.id))}
              >
                <td className={cn(c.td, "font-bold")}>{v.reference ?? `#${v.id}`}</td>
                <td>{fmtDate(v.issue_date)}</td>
                <td>
                  {v.unit?.name ?? "–"} → {v.receiving_unit?.name ?? "–"}
                </td>
                <td className="n">{v.quantity}</td>
                <td>{v.spares_request?.request_number ?? "–"}</td>
                <td>
                  <VoucherPill status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>
        Receipts &amp; adjustments
        <InfoTip title="Receipts & adjustments">The latest receipts, opening balances and stock adjustments. Deleting one is refused if it would leave the unit below zero.</InfoTip>
      </h2>
      <div className={c.tableWrap}>
        <table style={{ minWidth: 760 }}>
          <thead>
            <tr>
              {["Date", "Unit", "Type", "Part", "Qty", "Note", ""].map((h) => (
                <th key={h} className={cn(c.th, h === "Qty" && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="mt-empty">
                  No receipts yet.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} >
                <td>{fmtDate(e.date)}</td>
                <td>{e.unit_name}</td>
                <td>{REASON_LABEL[e.reason]}</td>
                <td>
                  <b>{e.part_number}</b>
                  <div className={c.muted}>{e.description}</div>
                </td>
                <td className="n">
                  {e.quantity > 0 ? "+" : ""}
                  {e.quantity}
                </td>
                <td>{e.note}</td>
                <td className={cn(c.td, "text-center")}>
                  {perms.has("inventory-stocks.delete") && (
                    <button type="button" className="mt-x" onClick={() => setRemoving(e.id)}>
                      ×
                    </button>
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
          message="Delete this stock entry?"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            deleteEntry(removing)
              .unwrap()
              .catch((err) => dispatch(showToast({ message: apiError(err, "Couldn't delete the entry."), type: "error" })));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
};

type Line = { inventory_id: number | null; part_number: string; description: string; quantity: number | "" };

const VoucherView = ({ id, nav, initialFrom, initialPart }: { id: number | null; nav: TrackerNav; initialFrom?: number | null; initialPart?: string | null }) => {
  const c = useTrackerClasses();
  const { data: voucher } = useGetVoucherQuery(id ?? 0, { skip: !id });
  if (id && !voucher) return <div className={cn("py-10 text-center text-sm", c.muted)}>Loading…</div>;
  // Remounts with fresh form state whenever the saved voucher changes.
  return <VoucherEditor key={voucher ? `${voucher.id}-${voucher.updated_at}` : "new"} voucher={voucher ?? null} nav={nav} initialFrom={initialFrom} initialPart={initialPart} />;
};

const formFromVoucher = (voucher: Voucher) => ({
  issue_date: voucher.issue_date?.slice(0, 10) ?? today(),
  unit_id: voucher.unit_id ? String(voucher.unit_id) : "",
  receiving_unit_id: String(voucher.receiving_unit_id),
  spares_request_id: voucher.spares_request_id ? String(voucher.spares_request_id) : "",
  remarks: voucher.remarks ?? "",
  lines: voucher.items.length
    ? voucher.items.map((i) => ({ inventory_id: i.inventory_id, part_number: i.part_number ?? "", description: i.description ?? "", quantity: i.quantity as number | "" }))
    : [{ inventory_id: null, part_number: voucher.part_number ?? "", description: voucher.description, quantity: voucher.quantity as number | "" }],
});

const VoucherEditor = ({ voucher, nav, initialFrom, initialPart }: { voucher: Voucher | null; nav: TrackerNav; initialFrom?: number | null; initialPart?: string | null }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const paperRef = useRef<HTMLDivElement>(null);
  const id = voucher?.id ?? null;
  const { data: matrix } = useGetStockMatrixQuery({ include_zero: false });
  const { data: catalog = [] } = useGetPartCatalogQuery();
  const { data: requests = [] } = useGetSparesRequestsQuery();
  const [createVoucher, { isLoading: creating }] = useCreateVoucherMutation();
  const [updateVoucher, { isLoading: saving }] = useUpdateVoucherMutation();
  const [deleteVoucher] = useDeleteVoucherMutation();
  const [action, { isLoading: acting }] = useVoucherActionMutation();
  const units = useMemo(() => matrix?.units ?? [], [matrix]);

  const [draft, setForm] = useState<{ issue_date: string; unit_id: string; receiving_unit_id: string; spares_request_id: string; remarks: string; lines: Line[] }>(() =>
    voucher
      ? formFromVoucher(voucher)
      : {
          issue_date: today(),
          unit_id: initialFrom ? String(initialFrom) : "",
          receiving_unit_id: "",
          spares_request_id: "",
          remarks: "",
          lines: [{ inventory_id: null, part_number: initialPart ?? "", description: "", quantity: 1 }],
        },
  );
  // A new voucher goes to the first other unit until one is chosen.
  const withDefaultUnit = (f: typeof draft) => (f.receiving_unit_id ? f : { ...f, receiving_unit_id: String(units.find((u) => String(u.id) !== f.unit_id)?.id ?? "") });
  const form = withDefaultUnit(draft);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!paperRef.current) return;
    setIsDownloadingPdf(true);
    try {
      await downloadPaperPdf(paperRef.current, safeFileName(voucher?.reference ?? "issue-voucher"));
      dispatch(showToast({ message: "PDF downloaded successfully.", type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Could not generate PDF. Please try again."), type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const available = useMemo(() => {
    const map = new Map<string, number>();
    matrix?.rows.forEach((r) => r.part_number && map.set(r.part_number.toLowerCase(), r.quantities[form.unit_id] ?? 0));
    return map;
  }, [matrix, form.unit_id]);

  const status: VoucherStatus = voucher?.status ?? "draft";
  const editable = !id || status === "draft" || status === "rejected";

  const setLine = (i: number, key: keyof Line, value: string) =>
    setForm((f) => ({
      ...withDefaultUnit(f),
      lines: f.lines.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, [key]: key === "quantity" ? (value === "" ? "" : Number(value)) : value };
        if (key === "part_number") {
          const hit = catalog.find((p) => p.part_number.toLowerCase() === value.trim().toLowerCase());
          if (hit) Object.assign(next, { part_number: hit.part_number, description: hit.description ?? next.description, inventory_id: null });
        }
        return next;
      }),
    }));

  const payload = () => ({
    issue_date: form.issue_date || today(),
    unit_id: form.unit_id ? Number(form.unit_id) : null,
    receiving_unit_id: Number(form.receiving_unit_id),
    spares_request_id: form.spares_request_id ? Number(form.spares_request_id) : null,
    remarks: form.remarks || null,
    items: form.lines
      .filter((l) => l.part_number.trim() && Number(l.quantity) > 0)
      .map((l) => ({
        inventory_id: matrix?.rows.find((r) => r.part_number?.toLowerCase() === l.part_number.trim().toLowerCase())?.inventory_ids[form.unit_id] ?? l.inventory_id,
        part_number: l.part_number.trim(),
        description: l.description || null,
        quantity: Number(l.quantity),
      })),
  });

  const validate = () => {
    const p = payload();
    if (!p.unit_id || !p.receiving_unit_id) return "Choose the issuing and the receiving unit.";
    if (p.unit_id === p.receiving_unit_id) return "Choose two different units.";
    if (!p.items.length) return "Add at least one line with a part number and quantity.";
    return null;
  };

  const save = async (): Promise<Voucher | null> => {
    const problem = validate();
    if (problem) {
      dispatch(showToast({ message: problem, type: "error" }));
      return null;
    }
    try {
      if (!id) {
        const created = await createVoucher(payload()).unwrap();
        nav.openVoucher(created.id);
        return created;
      }
      const updated = await updateVoucher({ id, data: payload() }).unwrap();
      dispatch(showToast({ message: "Voucher saved.", type: "success" }));
      return updated;
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't save the voucher."), type: "error" }));
      return null;
    }
  };

  const run = async (kind: "issue" | "receive" | "cancel", reason?: string) => {
    if (!id) return;
    try {
      if (kind === "issue") {
        const saved = await save();
        if (!saved) return;
      }
      await action({ id, action: kind, reason }).unwrap();
      dispatch(showToast({ message: kind === "issue" ? "Stock issued." : kind === "receive" ? "Receipt confirmed." : "Voucher cancelled and reversed.", type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e), type: "error" }));
    }
  };

  const unitName = (uid: string) => units.find((u) => String(u.id) === uid)?.name ?? voucher?.unit?.name ?? "–";
  const receivingName = (uid: string) => units.find((u) => String(u.id) === uid)?.name ?? voucher?.receiving_unit?.name ?? "–";
  const unitSelect = (key: "unit_id" | "receiving_unit_id") =>
    editable ? (
      <select value={form[key]} onChange={(e) => setForm((f) => ({ ...withDefaultUnit(f), [key]: e.target.value }))}>
        <option value="">Choose…</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    ) : key === "unit_id" ? (
      unitName(form.unit_id)
    ) : (
      receivingName(form.receiving_unit_id)
    );

  return (
    <div>
      <div className="mt-bar">
        <Button size="sm" variant="secondary" onClick={() => nav.go("issues")}>
          All vouchers
        </Button>
        <VoucherPill status={status} />
        <span className="flex-1" />
        {editable && (
          <select
            className={cn(c.field, "w-auto")}
            value=""
            onChange={(e) => {
              const sr = requests.find((r) => String(r.id) === e.target.value);
              if (!sr) return;
              setForm((f) => ({
                ...withDefaultUnit(f),
                spares_request_id: String(sr.id),
                lines: [
                  ...f.lines.filter((l) => l.part_number.trim()),
                  ...sr.lines.filter((l) => l.part_number).map((l) => ({ inventory_id: null, part_number: l.part_number ?? "", description: l.description ?? "", quantity: l.quantity ?? 1 })),
                ],
              }));
            }}
          >
            <option value="">Load lines from a request…</option>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.request_number}
              </option>
            ))}
          </select>
        )}
        {editable && (
          <Button size="sm" variant="secondary" onClick={() => setForm((f) => ({ ...withDefaultUnit(f), lines: [...f.lines, { inventory_id: null, part_number: "", description: "", quantity: 1 }] }))}>
            Add line
          </Button>
        )}
        {editable && (
          <Button size="sm" variant="secondary" onClick={() => save()} isLoading={creating || saving}>
            {id ? "Save" : "Create voucher"}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => printPaper(paperRef.current, voucher?.reference ?? "Issue voucher")}>
          Print
        </Button>
        <Button size="sm" variant="secondary" onClick={handleDownloadPdf} isLoading={isDownloadingPdf}>
          Download PDF
        </Button>
        {id && (status === "draft" || status === "approved") && perms.has("stock-issues.issue") && (
          <Button size="sm" onClick={() => run("issue")} isLoading={acting}>
            Issue stock
          </Button>
        )}
        {id && status === "issued" && perms.has("stock-issues.receive") && (
          <Button size="sm" onClick={() => run("receive")} isLoading={acting}>
            Confirm receipt
          </Button>
        )}
        {id && status !== "cancelled" && perms.has("stock-issues.cancel") && (
          <Button size="sm" variant="destructive" onClick={() => setCancelling(true)}>
            Cancel voucher
          </Button>
        )}
        {id && editable && perms.has("stock-issues.delete") && (
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      <datalist id="voucher-parts">
        {(matrix?.rows ?? [])
          .filter((r) => r.part_number && (r.quantities[form.unit_id] ?? 0) > 0)
          .map((r) => (
            <option key={r.part_number!} value={r.part_number!}>
              {r.description}
            </option>
          ))}
      </datalist>

      <Paper ref={paperRef}>
        <div className="c">RESTRICTED</div>
        <table className="hd">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col />
            <col style={{ width: "16%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td>
                <NaavnLogo side="left" />
              </td>
              <td className="h">
                <b style={{ fontSize: 16 }}>
                  NIGERIAN ARMY AVIATION
                  <br />
                  STORES ISSUE VOUCHER
                </b>
              </td>
              <td>
                <NaavnLogo side="right" />
              </td>
            </tr>
          </tbody>
        </table>
        <div className="gr">
          <table>
            <tbody>
              <tr>
                <td className="l" style={{ width: "42%" }}>
                  VOUCHER NO.:
                </td>
                <td>
                  <b>{voucher?.reference ?? "(on save)"}</b>
                </td>
              </tr>
              <tr>
                <td className="l">DATE:</td>
                <td>{editable ? <input type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...withDefaultUnit(f), issue_date: e.target.value }))} /> : fmtDate(form.issue_date)}</td>
              </tr>
              <tr>
                <td className="l">REFERENCE:</td>
                <td>{requests.find((r) => String(r.id) === form.spares_request_id)?.request_number ?? voucher?.spares_request?.request_number ?? "–"}</td>
              </tr>
            </tbody>
          </table>
          <table>
            <tbody>
              <tr>
                <td className="l" style={{ width: "34%" }}>
                  ISSUED FROM:
                </td>
                <td>{unitSelect("unit_id")}</td>
              </tr>
              <tr>
                <td className="l">ISSUED TO:</td>
                <td>{unitSelect("receiving_unit_id")}</td>
              </tr>
              <tr>
                <td className="l">STATUS:</td>
                <td>
                  <b>{VOUCHER_PILL[status].label.toUpperCase()}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <table className="sr">
          <colgroup>
            <col style={{ width: "7%" }} />
            <col style={{ width: "25%" }} />
            <col />
            <col style={{ width: "12%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>NO.</th>
              <th>PART NUMBER</th>
              <th>DESCRIPTION</th>
              <th>QTY</th>
              <th>{editable ? "AVAILABLE" : "RECEIVED"}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(form.lines.length, 10) }).map((_, i) => {
              const l = form.lines[i];
              if (!l)
                return (
                  <tr key={i}>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                );
              const received = voucher?.items[i]?.quantity_received;
              return (
                <tr key={i}>
                  <td className="h">
                    {i + 1}
                    {editable && (
                      <a className="x noprint" onClick={() => setForm((f) => ({ ...withDefaultUnit(f), lines: f.lines.filter((_, idx) => idx !== i) }))}>
                        ×
                      </a>
                    )}
                  </td>
                  <td>{editable ? <input list="voucher-parts" value={l.part_number} onChange={(e) => setLine(i, "part_number", e.target.value)} /> : l.part_number}</td>
                  <td>{editable ? <input value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} /> : l.description}</td>
                  <td>{editable ? <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} /> : l.quantity}</td>
                  <td className="h">{editable ? (l.part_number ? (available.get(l.part_number.trim().toLowerCase()) ?? 0) : "") : (received ?? "")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="gr">
          <table className="ap">
            <tbody>
              <tr>
                <td className="k">Issued by:</td>
                <td className="v">{name(voucher?.issuer)}</td>
              </tr>
              <tr>
                <td className="k">Date:</td>
                <td className="v">{voucher?.issued_at ? fmtDate(voucher.issued_at) : ""}</td>
              </tr>
            </tbody>
          </table>
          <table className="ap">
            <tbody>
              <tr>
                <td className="k">Received by:</td>
                <td className="v">{name(voucher?.receiver)}</td>
              </tr>
              <tr>
                <td className="k">Date:</td>
                <td className="v">{voucher?.received_at ? fmtDate(voucher.received_at) : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {voucher?.cancelled_at && (
          <div className="c" style={{ color: "#b42318", fontWeight: 700 }}>
            CANCELLED {fmtDate(voucher.cancelled_at)}
            {voucher.cancellation_reason ? ` — ${voucher.cancellation_reason}` : ""}
          </div>
        )}
        <div className="c">RESTRICTED</div>
      </Paper>
      <p className={cn("mt-3 text-center text-xs", c.muted)}>
        Issuing deducts the quantities from the issuing unit's stock; the receiving unit confirms receipt to add them to theirs. Cancelling a voucher reverses it.
      </p>

      {cancelling && (
        <TrackerDialog
          title="Cancel this voucher?"
          subtitle="Its stock movements are reversed."
          onClose={() => setCancelling(false)}
          width="max-w-md"
          footer={
            <>
              <Button size="sm" variant="destructive" onClick={() => (run("cancel", cancelReason.trim() || undefined), setCancelling(false))}>
                Cancel voucher
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setCancelling(false)}>
                Keep it
              </Button>
            </>
          }
        >
          <input className={c.field} placeholder="Reason (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </TrackerDialog>
      )}
      {confirmDelete && id && (
        <ConfirmDialog
          destructive
          confirmLabel="Delete"
          message={`Delete ${voucher?.reference ?? "this voucher"}?`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteVoucher(id)
              .unwrap()
              .then(() => nav.go("issues"))
              .catch((e) => dispatch(showToast({ message: apiError(e, "Couldn't delete the voucher."), type: "error" })));
            setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
};
