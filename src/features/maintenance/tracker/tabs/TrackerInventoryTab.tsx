import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useCreateStockEntryMutation, useGetPartCatalogQuery, useGetStockMatrixQuery, type StockEntryPayload } from "../api";
import { apiError, downloadCsv, today, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { FieldLabel, HelpHeader } from "../trackerUi";
import { TrackerDialog } from "../components/TrackerDialog";
import type { TrackerNav } from "../MaintenanceTracker";

const SHOWN = 300;

export const ReceiveStockDialog = ({
  initial,
  units,
  onClose,
}: {
  initial: Partial<StockEntryPayload>;
  units: { id: number; name: string }[];
  onClose: () => void;
}) => {
  const c = useTrackerClasses();
  const dispatch = useAppDispatch();
  const { data: catalog = [] } = useGetPartCatalogQuery();
  const [createEntry, { isLoading }] = useCreateStockEntryMutation();
  const [form, setForm] = useState({
    unit_id: String(initial.unit_id ?? units[0]?.id ?? ""),
    reason: initial.reason ?? "receipt",
    part_number: initial.part_number ?? "",
    description: initial.description ?? catalog.find((p) => p.part_number === initial.part_number)?.description ?? "",
    item_type: initial.item_type ?? "spare",
    quantity: "",
    movement_date: today(),
    note: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const quantity = parseInt(form.quantity, 10);
    if (!form.part_number.trim()) return dispatch(showToast({ message: "Enter a part number.", type: "error" }));
    if (!quantity) return dispatch(showToast({ message: "Enter a quantity.", type: "error" }));
    if (quantity < 0 && form.reason !== "adjustment") return dispatch(showToast({ message: "Only an adjustment can be negative.", type: "error" }));
    try {
      await createEntry({
        unit_id: Number(form.unit_id),
        reason: form.reason as StockEntryPayload["reason"],
        part_number: form.part_number.trim(),
        description: form.description.trim() || null,
        item_type: form.item_type as "spare" | "hardware",
        quantity,
        movement_date: form.movement_date || today(),
        note: form.note.trim() || null,
      }).unwrap();
      dispatch(showToast({ message: "Stock entry saved.", type: "success" }));
      onClose();
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't save the stock entry."), type: "error" }));
    }
  };

  return (
    <TrackerDialog
      title={form.reason === "adjustment" ? "Adjust stock" : "Receive stock"}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" onClick={save} isLoading={isLoading}>
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <datalist id="stock-catalog">
        {catalog.map((p) => (
          <option key={p.id} value={p.part_number}>
            {p.description}
          </option>
        ))}
      </datalist>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel label="Unit" />
          <select className={c.field} value={form.unit_id} onChange={(e) => set("unit_id", e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel
            label="Entry type"
            help={{ title: "Entry type", text: "Receipt: stock received. Opening balance: what a unit already holds when it starts using the system. Adjustment: a correction after a count (may be negative)." }}
          />
          <select className={c.field} value={form.reason} onChange={(e) => set("reason", e.target.value)}>
            <option value="receipt">Receipt</option>
            <option value="opening_balance">Opening balance</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        <div>
          <FieldLabel label="Part number (pick from the catalog or type a new one)" />
          <input
            className={c.field}
            list="stock-catalog"
            value={form.part_number}
            onChange={(e) => {
              const hit = catalog.find((p) => p.part_number.toLowerCase() === e.target.value.trim().toLowerCase());
              setForm((f) => ({ ...f, part_number: e.target.value, ...(hit ? { description: hit.description ?? f.description, item_type: hit.item_type } : {}) }));
            }}
          />
        </div>
        <div>
          <FieldLabel label="Description" />
          <input className={c.field} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <FieldLabel label="Item type" />
          <select className={c.field} value={form.item_type} onChange={(e) => set("item_type", e.target.value)}>
            <option value="spare">Spare</option>
            <option value="hardware">Hardware</option>
          </select>
        </div>
        <div>
          <FieldLabel label="Quantity" help={{ title: "Quantity", text: "A negative number is allowed for adjustments, but stock can't go below zero." }} />
          <input className={c.field} type="number" step={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
        </div>
        <div>
          <FieldLabel label="Date" />
          <input className={c.field} type="date" value={form.movement_date} onChange={(e) => set("movement_date", e.target.value)} />
        </div>
        <div>
          <FieldLabel label="Source / note" />
          <input className={c.field} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </div>
      </div>
    </TrackerDialog>
  );
};

export const TrackerInventoryTab = ({ nav }: { nav: TrackerNav }) => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const navigate = useNavigate();
  const [includeZero, setIncludeZero] = useState(false);
  const { data, isLoading } = useGetStockMatrixQuery({ include_zero: includeZero });
  const [unit, setUnit] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [receiving, setReceiving] = useState<Partial<StockEntryPayload> | null>(null);
  const units = data?.units ?? [];

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (!includeZero && unit !== "all" && !(r.quantities[unit] ?? 0)) return false;
      return !needle || [r.part_number, r.alternate_part_number, r.description, r.item_type].join(" ").toLowerCase().includes(needle);
    });
  }, [data, q, unit, includeZero]);

  const qty = (r: (typeof rows)[number], id: number) => r.quantities[id] ?? 0;
  const one = unit !== "all";
  const home = one ? unit : units[0]?.id;

  const exportCsv = () =>
    downloadCsv("inventory.csv", [
      ["Part number", "Description", "Type", ...units.map((u) => u.name), "Total"],
      ...(data?.rows ?? []).filter((r) => r.total !== 0).map((r) => [r.part_number, r.description, r.item_type, ...units.map((u) => qty(r, u.id)), r.total]),
    ]);

  const issueLine = (fromUnit: number, partNumber: string | null) => nav.go("issues", { voucher: "new", from: fromUnit, pn: partNumber });

  return (
    <div>
      <div className="mt-cards">
        {units.map((u) => (
          <button key={u.id} type="button" onClick={() => setUnit(u.id)} className={cn("mt-card", unit === u.id && "sel")}>
            <span className="k">{u.name}</span>
            <b className="v">{data?.unit_totals[u.id]?.quantity ?? 0}</b>
            <span className="k">{data?.unit_totals[u.id]?.lines ?? 0} lines</span>
          </button>
        ))}
      </div>

      <div className="mt-chips">
        {[{ id: "all" as const, name: "All units" }, ...units].map((u) => (
          <Button key={u.id} variant={unit === u.id ? "primary" : "secondary"} onClick={() => setUnit(u.id)}>
            {u.name}
          </Button>
        ))}
        <Button variant="secondary" onClick={() => navigate("/dashboard/units")}>
          Manage units
        </Button>
      </div>

      <div className="mt-bar">
        <input type="search" className="mt-input" style={{ width: "auto", minWidth: 260 }} placeholder="Search part number, description, type…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="mt-sub" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} /> Include catalog items with no stock
        </label>
        <span className="mt-sp" />
        <Button size="sm" variant="excel" onClick={exportCsv}>
          Export CSV
        </Button>
        {perms.has("stock-issues.create") && home && (
          <Button size="sm" variant="secondary" onClick={() => issueLine(home, null)}>
            New issue voucher
          </Button>
        )}
        {perms.has("inventory-stocks.create") && (
          <Button size="sm" onClick={() => setReceiving({ unit_id: home })}>
            Receive / adjust stock
          </Button>
        )}
      </div>

      <div className={c.tableWrap}>
        <table style={{ minWidth: one ? 640 : 760 }}>
          <thead>
            <tr>
              <HelpHeader label="Part number" />
              <HelpHeader label="Description" />
              <HelpHeader label="Type" />
              {one ? (
                <HelpHeader label="Qty" align="right" help={{ title: "Quantity", text: "What the unit holds: opening balance + receipts + adjustments + stock issued to it − stock it issued." }} />
              ) : (
                <>
                  {units.map((u) => (
                    <th key={u.id} className={cn(c.th, "text-right")}>
                      {u.name}
                    </th>
                  ))}
                  <HelpHeader label="Total" align="right" />
                </>
              )}
              <th className={c.th} />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={units.length + 5} className="mt-empty">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={units.length + 5} className="mt-empty">
                  Nothing matches. Receive stock to put items into a unit, or upload a catalog in Spares catalog first.
                </td>
              </tr>
            )}
            {rows.slice(0, SHOWN).map((r) => (
              <tr key={`${r.part_number}-${r.description}`} >
                <td>
                  <b>{r.part_number}</b>
                  {r.alternate_part_number && <div className={c.muted}>alt {r.alternate_part_number}</div>}
                </td>
                <td>{r.description}</td>
                <td>{r.item_type === "hardware" ? "Hardware" : "Spare"}</td>
                {one ? (
                  <td className={cn(c.td, "text-right font-bold tabular-nums", !qty(r, unit) && c.muted)}>{qty(r, unit)}</td>
                ) : (
                  <>
                    {units.map((u) => (
                      <td key={u.id} className={cn(c.td, "text-right tabular-nums", !qty(r, u.id) && c.muted)}>
                        {qty(r, u.id)}
                      </td>
                    ))}
                    <td className={cn("n font-bold")}>{r.total}</td>
                  </>
                )}
                <td className={cn(c.td, "whitespace-nowrap text-right")}>
                  {one && qty(r, unit) > 0 && perms.has("stock-issues.create") && (
                    <Button size="xs" variant="secondary" onClick={() => issueLine(unit, r.part_number)}>
                      Issue
                    </Button>
                  )}{" "}
                  {one && perms.has("inventory-stocks.create") && (
                    <Button size="xs" variant="secondary" onClick={() => setReceiving({ unit_id: unit, part_number: r.part_number ?? "", description: r.description, reason: "adjustment" })}>
                      Adjust
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > SHOWN && <p className={cn("mt-2 text-xs", c.muted)}>Showing first {SHOWN}. Refine the search.</p>}
      <p className={cn("mt-2 text-xs", c.muted)}>
        Stock is kept per unit on the inventory records.
        <InfoTip title="Inventory">
          Each unit's holding of a part number is its inventory line in the Inventory module. Receipts, opening balances and adjustments add to it; issue vouchers move stock between units when issued and received.
        </InfoTip>
      </p>

      {receiving && <ReceiveStockDialog initial={receiving} units={units} onClose={() => setReceiving(null)} />}
    </div>
  );
};
