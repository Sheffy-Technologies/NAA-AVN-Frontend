import { useMemo, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { onInteractiveRowClick, onInteractiveRowKeyDown } from "@/shared/utils/onInteractiveRowClick";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetUnitsQuery } from "@/shared/api/units";
import {
  useCreateSparesRequestMutation,
  useDeleteSparesRequestMutation,
  useGetPartCatalogQuery,
  useGetSparesRequestQuery,
  useGetSparesRequestsQuery,
  useGetTrackerFleetQuery,
  useIssueVoucherFromRequestMutation,
  useUpdateSparesRequestMutation,
  type SparesRequest,
  type SparesRequestLine,
  type SparesRequestStatus,
} from "../api";
import { apiError, fmtDate, safeFileName, today, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { HelpHeader, StatusPill } from "../trackerUi";
import { NaavnLogo, Paper } from "../components/NaavnPaper";
import { downloadPaperPdf, printPaper } from "../components/paperPrint";
import { SignField } from "../components/SignField";
import { ConfirmDialog } from "../components/TrackerDialog";
import type { TrackerNav } from "../MaintenanceTracker";

const STATUS: Record<SparesRequestStatus, { label: string; pill: "no_data" | "due_soon" | "ok" }> = {
  draft: { label: "Draft", pill: "no_data" },
  submitted: { label: "Submitted", pill: "due_soon" },
  approved: { label: "Approved", pill: "ok" },
  issued: { label: "Issued", pill: "ok" },
};

const MAX_LINES = 50;
const PRINTED_ROWS = 30;

export const SrStatusPill = ({ status }: { status: SparesRequestStatus }) => <StatusPill status={STATUS[status].pill}>{STATUS[status].label}</StatusPill>;

export const TrackerSparesRequestsTab = ({ nav, openId }: { nav: TrackerNav; openId: number | null }) => {
  if (openId) return <SparesRequestView id={openId} nav={nav} />;
  return <SparesRequestList nav={nav} />;
};

const SparesRequestList = ({ nav }: { nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const { data: requests = [], isLoading } = useGetSparesRequestsQuery();
  const [createRequest, { isLoading: creating }] = useCreateSparesRequestMutation();

  const start = async () => {
    try {
      const sr = await createRequest({ request_date: today(), lines: [] }).unwrap();
      nav.openSparesRequest(sr.id);
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't start a request."), type: "error" }));
    }
  };

  return (
    <div>
      <div className="mt-bar">
        <span className={cn("text-xs", c.muted)}>Requests are filed from a work order, or start a blank one here.</span>
        <span className="flex-1" />
        {perms.has("spares-requests.create") && (
          <Button size="sm" onClick={start} isLoading={creating}>
            New request
          </Button>
        )}
      </div>
      <div className={c.tableWrap}>
        <table style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <HelpHeader label="Request" help={{ title: "Request number", text: "NAAVN/SR/year/number, numbered from 1 each year." }} />
              <HelpHeader label="Date" />
              <HelpHeader label="Aircraft" />
              <HelpHeader label="Lines" align="right" />
              <HelpHeader label="Work order(s)" />
              <HelpHeader
                label="Status"
                help={{ title: "Status", text: "Draft → Submitted → Approved → Issued. A request becomes Issued when an issue voucher raised from it is issued." }}
              />
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
            {!isLoading && requests.length === 0 && (
              <tr>
                <td colSpan={6} className="mt-empty">
                  No spares requests yet.
                </td>
              </tr>
            )}
            {requests.map((r) => {
              const regs = [...new Set(r.lines.map((l) => l.aircraft_registration).filter(Boolean))].join(", ");
              const wos = [...new Set(r.lines.map((l) => l.work_order?.work_order_number).filter(Boolean))].join(", ");
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  className="click"
                  onClick={(e) => onInteractiveRowClick(e, () => nav.openSparesRequest(r.id))}
                  onKeyDown={(e) => onInteractiveRowKeyDown(e, () => nav.openSparesRequest(r.id))}
                >
                  <td className={cn(c.td, "font-bold")}>{r.request_number}</td>
                  <td>{fmtDate(r.request_date)}</td>
                  <td>{regs || "–"}</td>
                  <td className="n">{r.lines_count ?? r.lines.length}</td>
                  <td>{wos || "–"}</td>
                  <td>
                    <SrStatusPill status={r.status} />
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

type LineForm = Required<Pick<SparesRequestLine, "aircraft_registration" | "part_number" | "alternate_part_number" | "description" | "mm_reference">> & {
  quantity: number | null;
  asset_id: number | null;
  work_order_id: number | null;
  work_order_number?: string | null;
};

const toLines = (r: SparesRequest): LineForm[] =>
  r.lines.map((l) => ({
    asset_id: l.asset_id,
    aircraft_registration: l.aircraft_registration ?? "",
    part_number: l.part_number ?? "",
    alternate_part_number: l.alternate_part_number ?? "",
    description: l.description ?? "",
    quantity: l.quantity ?? 1,
    mm_reference: l.mm_reference ?? "",
    work_order_id: l.work_order_id,
    work_order_number: l.work_order?.work_order_number,
  }));

const SparesRequestView = ({ id, nav }: { id: number; nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const { data: request, isLoading } = useGetSparesRequestQuery(id);
  if (isLoading || !request) return <div className={cn("py-10 text-center text-sm", c.muted)}>Loading…</div>;
  // Remounts with fresh form state whenever the saved request changes.
  return <SparesRequestEditor key={`${request.id}-${request.updated_at}`} request={request} nav={nav} />;
};

const SparesRequestEditor = ({ request, nav }: { request: SparesRequest; nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const paperRef = useRef<HTMLDivElement>(null);
  const { data: catalog = [] } = useGetPartCatalogQuery();
  const { data: fleet = [] } = useGetTrackerFleetQuery();
  const { data: units = [] } = useGetUnitsQuery();
  const [updateRequest, { isLoading: saving }] = useUpdateSparesRequestMutation();
  const [deleteRequest] = useDeleteSparesRequestMutation();
  const [issueVoucher, { isLoading: issuing }] = useIssueVoucherFromRequestMutation();

  const [lines, setLines] = useState<LineForm[]>(() => toLines(request));
  const [head, setHead] = useState(() => ({
    request_date: request.request_date ?? "",
    contract_engineer_name: request.contract_engineer_name ?? "",
    contract_engineer_date: request.contract_engineer_date ?? "",
    aviation_engineer_name: request.aviation_engineer_name ?? "",
    aviation_engineer_date: request.aviation_engineer_date ?? "",
  }));
  const [sigs, setSigs] = useState<{ contract: string | null; aviation: string | null }>({ contract: null, aviation: null });
  const [dirty, setDirty] = useState(false);
  const [fromUnit, setFromUnit] = useState("");
  const [toUnit, setToUnit] = useState(request.unit_id ? String(request.unit_id) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const workOrders = useMemo(() => [...new Set(lines.map((l) => l.work_order_number).filter(Boolean))].join(", ") || "–", [lines]);

  const issued = request.status === "issued";
  const locked = issued || !perms.has("spares-requests.update");

  const setLine = (i: number, key: keyof LineForm, value: string) => {
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;
        const next: LineForm = { ...l, [key]: key === "quantity" ? Number(value) || null : value };
        if (key === "part_number") {
          const hit = catalog.find((p) => p.part_number.toLowerCase() === value.trim().toLowerCase());
          if (hit) Object.assign(next, { part_number: hit.part_number, description: hit.description ?? next.description, alternate_part_number: hit.alternate_part_number || next.alternate_part_number, mm_reference: next.mm_reference || hit.mm_reference || "" });
        }
        if (key === "aircraft_registration") {
          const asset = fleet.find((a) => a.registration.toLowerCase() === value.trim().toLowerCase());
          next.asset_id = asset?.id ?? null;
        }
        return next;
      }),
    );
    setDirty(true);
  };

  const save = async (status?: SparesRequestStatus) => {
    try {
      await updateRequest({
        id: request.id,
        data: {
          ...head,
          request_date: head.request_date || today(),
          contract_engineer_date: head.contract_engineer_date || null,
          aviation_engineer_date: head.aviation_engineer_date || null,
          ...(status ? { status } : {}),
          ...(locked
            ? {}
            : {
                lines: lines.map((l) => ({
                  asset_id: l.asset_id,
                  aircraft_registration: l.aircraft_registration,
                  part_number: l.part_number,
                  alternate_part_number: l.alternate_part_number,
                  description: l.description,
                  quantity: l.quantity,
                  mm_reference: l.mm_reference,
                  work_order_id: l.work_order_id,
                })),
              }),
          ...(sigs.contract !== null ? { contract_engineer_signature: sigs.contract } : {}),
          ...(sigs.aviation !== null ? { aviation_engineer_signature: sigs.aviation } : {}),
        },
      }).unwrap();
      setDirty(false);
      dispatch(showToast({ message: status ? `Request marked ${STATUS[status].label.toLowerCase()}.` : "Request saved.", type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't save the request."), type: "error" }));
    }
  };

  const issue = async () => {
    if (!fromUnit || !toUnit) {
      dispatch(showToast({ message: "Choose the unit issuing the stock and the unit receiving it.", type: "error" }));
      return;
    }
    try {
      if (dirty) await save();
      const voucher = await issueVoucher({ id: request.id, unit_id: Number(fromUnit), receiving_unit_id: Number(toUnit) }).unwrap();
      nav.openVoucher(voucher.id);
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't raise the issue voucher."), type: "error" }));
    }
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!paperRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await downloadPaperPdf(paperRef.current, safeFileName(request.request_number));
      dispatch(showToast({ message: "PDF downloaded successfully.", type: "success" }));
    } catch (e) {
      console.error("PDF download error:", e);
      dispatch(showToast({ message: "Failed to download PDF. Please try again.", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const remove = async () => {
    try {
      await deleteRequest(request.id).unwrap();
      nav.go("spares-requests");
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't delete the request."), type: "error" }));
    }
  };

  const columns: (keyof LineForm)[] = ["aircraft_registration", "part_number", "alternate_part_number", "description", "quantity", "mm_reference"];
  const headers = [
    ["ITEM NO.", "a"],
    ["AIRCRAFT REG", "b"],
    ["PART NUMBER", "c"],
    ["ALTERNATE P/N", "d"],
    ["DESCRIPTION", "e"],
    ["QUANTITY", "f"],
    ["MM REFERENCE", "g"],
  ];

  const approval = (title: string, nameKey: "contract_engineer_name" | "aviation_engineer_name", dateKey: "contract_engineer_date" | "aviation_engineer_date", sig: "contract" | "aviation") => (
    <table className="ap">
      <tbody>
        <tr>
          <td className="k">{title}:</td>
          <td className="v">
            <input disabled={locked} value={head[nameKey]} onChange={(e) => (setHead((h) => ({ ...h, [nameKey]: e.target.value })), setDirty(true))} />
          </td>
        </tr>
        <tr>
          <td className="k">Signature:</td>
          <td className="v">
            <SignField
              storedPath={(sig === "contract" ? request.has_contract_engineer_signature : request.has_aviation_engineer_signature) ? `/spares-requests/${request.id}/signature/${sig === "contract" ? "contract_engineer" : "aviation_engineer"}` : null}
              pending={sigs[sig]}
              disabled={locked}
              onChange={(v) => (setSigs((s) => ({ ...s, [sig]: v })), setDirty(true))}
            />
          </td>
        </tr>
        <tr>
          <td className="k">Date:</td>
          <td className="v">
            <input type="date" disabled={locked} value={head[dateKey]} onChange={(e) => (setHead((h) => ({ ...h, [dateKey]: e.target.value })), setDirty(true))} />
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div>
      <div className="mt-bar">
        <Button size="sm" variant="secondary" onClick={() => nav.go("spares-requests")}>
          All requests
        </Button>
        <label className={cn("flex items-center gap-1.5 text-xs", c.muted)}>
          Status
          <select className={cn(c.field, "w-auto")} value={request.status} disabled={!perms.has("spares-requests.update")} onChange={(e) => save(e.target.value as SparesRequestStatus)}>
            {(Object.keys(STATUS) as SparesRequestStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
        </label>
        {request.stock_issues?.map((v) => (
          <button key={v.id} type="button" onClick={() => nav.openVoucher(v.id)}>
            <StatusPill status={v.status === "cancelled" ? "overdue" : "ok"}>
              {v.reference} · {v.status}
            </StatusPill>
          </button>
        ))}
        <span className="flex-1" />
        {perms.has("stock-issues.create") && (
          <>
            <select className={cn(c.field, "w-auto")} value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} aria-label="Issue from unit">
              <option value="">Issue from…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select className={cn(c.field, "w-auto")} value={toUnit} onChange={(e) => setToUnit(e.target.value)} aria-label="Issue to unit">
              <option value="">Issue to…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={issue} isLoading={issuing}>
              Issue from stock
            </Button>
            <InfoTip title="Issue from stock">
              Raises a draft issue voucher with this request's lines, from the unit holding the stock (e.g. HQ) to the requesting unit. Issuing the voucher deducts the stock and marks this request Issued.
            </InfoTip>
          </>
        )}
        {!locked && lines.length < MAX_LINES && (
          <Button
            size="sm"
            variant="secondary"
           
            onClick={() => (setLines((ls) => [...ls, { asset_id: null, aircraft_registration: "", part_number: "", alternate_part_number: "", description: "", quantity: 1, mm_reference: "", work_order_id: null }]), setDirty(true))}
          >
            Add line
          </Button>
        )}
        {!locked && (
          <Button size="sm" onClick={() => save()} isLoading={saving} disabled={!dirty}>
            Save
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => printPaper(paperRef.current, request.request_number)}>
          Print
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownloadPdf}
          isLoading={isDownloadingPdf}
        >
          Download PDF
        </Button>
        {perms.has("spares-requests.delete") && (
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      <datalist id="sr-catalog">
        {catalog.map((p) => (
          <option key={p.id} value={p.part_number}>
            {p.description}
          </option>
        ))}
      </datalist>
      <datalist id="sr-aircraft">
        {fleet.map((a) => (
          <option key={a.id} value={a.registration} />
        ))}
      </datalist>

      <Paper ref={paperRef}>
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
                <div style={{ fontSize: 9 }}>RESTRICTED</div>
                <b style={{ fontSize: 15 }}>
                  NIGERIAN ARMY AVIATION
                  <br />
                  SPARE PARTS REQUEST
                </b>
                <div style={{ fontSize: 9 }}>
                  DOCUMENT REF No.: <b>NAAVN-007</b>
                </div>
              </td>
              <td>
                <NaavnLogo side="right" />
              </td>
            </tr>
          </tbody>
        </table>
        <div className="c" style={{ marginBottom: 8 }}>
          <b>REQUEST NO.:</b> {request.request_number} &nbsp;·&nbsp; <b>DATE:</b>{" "}
          <input type="date" disabled={locked} style={{ width: 140, display: "inline-block" }} value={head.request_date} onChange={(e) => (setHead((h) => ({ ...h, request_date: e.target.value })), setDirty(true))} />{" "}
          &nbsp;·&nbsp; <b>WORK ORDER(S):</b> {workOrders}
        </div>
        <table className="sr">
          <colgroup>
            <col style={{ width: "7%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "19%" }} />
          </colgroup>
          <thead>
            <tr>
              {headers.map(([h, k]) => (
                <th key={h}>
                  {h}
                  <div style={{ fontWeight: 400, fontSize: 9 }}>({k})</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(lines.length, PRINTED_ROWS) }).map((_, i) => {
              const l = lines[i];
              if (!l)
                return (
                  <tr key={i}>
                    {headers.map(([h]) => (
                      <td key={h} />
                    ))}
                  </tr>
                );
              return (
                <tr key={i}>
                  <td className="h">
                    {i + 1}
                    {!locked && (
                      <a className="x noprint" title="Remove line" onClick={() => (setLines((ls) => ls.filter((_, idx) => idx !== i)), setDirty(true))}>
                        ×
                      </a>
                    )}
                  </td>
                  {columns.map((k) => (
                    <td key={k}>
                      <input
                        disabled={locked}
                        type={k === "quantity" ? "number" : "text"}
                        min={k === "quantity" ? 1 : undefined}
                        list={k === "part_number" ? "sr-catalog" : k === "aircraft_registration" ? "sr-aircraft" : undefined}
                        value={(l[k] as string | number | null) ?? ""}
                        onChange={(e) => setLine(i, k, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="c" style={{ fontWeight: 700, margin: "12px 0 4px" }}>
          REQUEST APPROVAL
        </div>
        <div className="gr">
          {approval("Contract Engineer", "contract_engineer_name", "contract_engineer_date", "contract")}
          {approval("Army Aviation Engineer", "aviation_engineer_name", "aviation_engineer_date", "aviation")}
        </div>
        <table className="hd" style={{ marginTop: 14 }}>
          <tbody>
            <tr>
              <td style={{ fontSize: 10 }}>Revision No.: 00</td>
              <td className="h" style={{ fontSize: 10 }}>
                Revision Date: 17 February 2026
              </td>
              <td style={{ fontSize: 10, textAlign: "right" }}>Page 1 of 1</td>
            </tr>
          </tbody>
        </table>
      </Paper>
      <p className={cn("mt-3 text-center text-xs", c.muted)}>
        Pick a part number from the catalog to fill in the description, alternate P/N and MM reference, or type any entry by hand. Up to {MAX_LINES} lines.
      </p>

      {confirmDelete && <ConfirmDialog destructive confirmLabel="Delete" message={`Delete ${request.request_number}?`} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />}
    </div>
  );
};
