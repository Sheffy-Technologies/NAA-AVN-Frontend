import { useMemo, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Button } from "../components/TButton";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useCreateCatalogItemMutation,
  useDeleteCatalogItemMutation,
  useGetPartCatalogQuery,
  useImportCatalogMutation,
  useUpdateCatalogItemMutation,
  type CatalogItem,
} from "../api";
import { apiError, downloadCsv, useTrackerClasses, useTrackerPermissions } from "../trackerHelpers";
import { HelpHeader } from "../trackerUi";
import { ConfirmDialog } from "../components/TrackerDialog";

const SHOWN = 200;
const HEADERS = ["Part Number", "Alternate P/N", "Description", "Type", "MM Reference"];

/**
 * Finds the header row (the first with a "Part Number"-like cell) and maps
 * the columns by name, so sheets with title rows or columns in any order
 * still import. Without a header, columns are read as P/N, description,
 * alternate P/N.
 */
const parseCatalogRows = (rows: unknown[][]): Partial<CatalogItem>[] | null => {
  const isPn = (v: unknown) => /part\s*(n|no|num)|p\/n|^pn$/i.test(String(v ?? "").trim());
  const headerIndex = rows.findIndex((r) => r.some(isPn));
  const header = headerIndex >= 0 ? rows[headerIndex].map((h) => String(h ?? "").trim()) : [];
  const find = (test: (h: string) => boolean) => header.findIndex(test);
  const col =
    headerIndex >= 0
      ? {
          pn: find((h) => isPn(h) && !/alt/i.test(h)),
          alt: find((h) => /alt/i.test(h)),
          desc: find((h) => /desc|nomen|name/i.test(h)),
          type: find((h) => /type|categ|class/i.test(h)),
          mm: find((h) => /mm|manual|ref/i.test(h)),
        }
      : { pn: 0, desc: 1, alt: 2, type: -1, mm: -1 };
  if (col.pn < 0) return null;
  const get = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  return rows
    .slice(headerIndex + 1)
    .map((r) => ({
      part_number: get(r, col.pn),
      alternate_part_number: get(r, col.alt) || null,
      description: get(r, col.desc) || null,
      item_type: (/hard/i.test(get(r, col.type)) ? "hardware" : "spare") as CatalogItem["item_type"],
      mm_reference: get(r, col.mm) || null,
    }))
    .filter((r) => r.part_number);
};

export const TrackerCatalogTab = () => {
  const c = useTrackerClasses();
  const perms = useTrackerPermissions();
  const dispatch = useAppDispatch();
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: catalog = [], isLoading } = useGetPartCatalogQuery();
  const [createItem] = useCreateCatalogItemMutation();
  const [updateItem] = useUpdateCatalogItemMutation();
  const [deleteItem] = useDeleteCatalogItemMutation();
  const [importCatalog, { isLoading: importing }] = useImportCatalogMutation();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<Partial<CatalogItem> | null>(null);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const canEdit = perms.has("part-catalog.update");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? catalog.filter((p) => [p.part_number, p.alternate_part_number, p.description, p.item_type, p.mm_reference].join(" ").toLowerCase().includes(needle)) : catalog;
  }, [catalog, q]);

  const saveField = async (item: CatalogItem, key: keyof CatalogItem, value: string) => {
    if ((item[key] ?? "") === value) return;
    try {
      await updateItem({ id: item.id, data: { [key]: key === "item_type" ? value : value || null } }).unwrap();
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't save the catalog entry."), type: "error" }));
    }
  };

  const add = async () => {
    if (!adding?.part_number?.trim()) {
      dispatch(showToast({ message: "Enter a part number.", type: "error" }));
      return;
    }
    try {
      await createItem({ ...adding, part_number: adding.part_number.trim() }).unwrap();
      setAdding(null);
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "Couldn't add the part."), type: "error" }));
    }
  };

  const upload = async (file: File) => {
    try {
      let rows: unknown[][];
      if (/\.csv$/i.test(file.name)) {
        const { parseCsv } = await import("@/shared/utils/csv");
        rows = parseCsv(await file.text());
      } else {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer());
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: "" }) as unknown[][];
      }
      const parsed = parseCatalogRows(rows);
      if (!parsed) {
        dispatch(showToast({ message: "No “Part Number” column found in the first sheet.", type: "error" }));
        return;
      }
      if (!parsed.length) {
        dispatch(showToast({ message: "The sheet has no part numbers.", type: "error" }));
        return;
      }
      const res = await importCatalog(parsed).unwrap();
      dispatch(showToast({ message: `Imported ${res.rows} rows: ${res.created} new, ${res.updated} updated.`, type: "success" }));
    } catch (e) {
      dispatch(showToast({ message: apiError(e, "That file could not be read."), type: "error" }));
    }
  };

  const cell = (item: CatalogItem, key: "part_number" | "alternate_part_number" | "description" | "mm_reference") => (
    <input className={c.field} disabled={!canEdit} defaultValue={item[key] ?? ""} onBlur={(e) => saveField(item, key, e.target.value.trim())} />
  );

  return (
    <div>
      <div className="mt-bar">
        <input type="search" className={cn(c.field, "w-auto min-w-[220px]")} placeholder="Search catalog…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className={cn("text-xs", c.muted)}>
          {catalog.length} items{filtered.length > SHOWN ? ` · showing first ${SHOWN}, refine the search` : ""}
        </span>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
         
          onClick={() => downloadCsv("spares-catalog-template.csv", [HEADERS, ["86425-4", "", "Fuel Pressure Gauge", "Spare", ""]])}
        >
          Template
        </Button>
        <Button
          size="sm"
          variant="excel"
         
          onClick={() => downloadCsv("spares-catalog.csv", [HEADERS, ...catalog.map((p) => [p.part_number, p.alternate_part_number, p.description, p.item_type === "hardware" ? "Hardware" : "Spare", p.mm_reference])])}
        >
          Export CSV
        </Button>
        {perms.has("part-catalog.create") && (
          <>
            <Button size="sm" variant="secondary" isLoading={importing} onClick={() => fileInput.current?.click()}>
              Upload Excel / CSV
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={() => setAdding({ item_type: "spare" })}>
              Add item
            </Button>
          </>
        )}
      </div>

      <div className={c.tableWrap}>
        <table style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <HelpHeader label="Part number" help={{ title: "Part number", text: "The manufacturer's part number. Each one appears once; uploading a sheet updates existing part numbers." }} />
              <HelpHeader label="Alternate P/N" help={{ title: "Alternate P/N", text: "An interchangeable part number that may be supplied instead." }} />
              <HelpHeader label="Description" />
              <HelpHeader label="Type" help={{ title: "Type", text: "Spare (a part fitted to the aircraft) or Hardware (bolts, nuts, washers and other standard parts)." }} />
              <HelpHeader label="MM reference" help={{ title: "MM reference", text: "Where the part is called up in the maintenance manual (chapter / figure / item)." }} />
              <th className={c.th} />
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr >
                {(["part_number", "alternate_part_number", "description"] as const).map((k) => (
                  <td key={k} className="p-1">
                    <input className={c.field} autoFocus={k === "part_number"} placeholder={k === "part_number" ? "Part number *" : ""} value={adding[k] ?? ""} onChange={(e) => setAdding((a) => ({ ...a, [k]: e.target.value }))} />
                  </td>
                ))}
                <td className="p-1">
                  <select className={c.field} value={adding.item_type ?? "spare"} onChange={(e) => setAdding((a) => ({ ...a, item_type: e.target.value as CatalogItem["item_type"] }))}>
                    <option value="spare">Spare</option>
                    <option value="hardware">Hardware</option>
                  </select>
                </td>
                <td className="p-1">
                  <input className={c.field} value={adding.mm_reference ?? ""} onChange={(e) => setAdding((a) => ({ ...a, mm_reference: e.target.value }))} />
                </td>
                <td className="whitespace-nowrap p-1">
                  <Button size="xs" onClick={add}>
                    Add
                  </Button>{" "}
                  <Button size="xs" variant="ghost" onClick={() => setAdding(null)}>
                    Cancel
                  </Button>
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="mt-empty">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && catalog.length === 0 && !adding && (
              <tr>
                <td colSpan={6} className="mt-empty">
                  The catalog is empty. Upload an Excel or CSV file (columns: Part Number, Alternate P/N, Description, Type, MM Reference) or add items by hand. They then appear as a drop-down list on every work order and spares request.
                </td>
              </tr>
            )}
            {filtered.slice(0, SHOWN).map((p) => (
              <tr key={p.id} >
                <td className="p-1">{cell(p, "part_number")}</td>
                <td className="p-1">{cell(p, "alternate_part_number")}</td>
                <td className="p-1">{cell(p, "description")}</td>
                <td className="p-1">
                  <select className={c.field} disabled={!canEdit} value={p.item_type} onChange={(e) => saveField(p, "item_type", e.target.value)}>
                    <option value="spare">Spare</option>
                    <option value="hardware">Hardware</option>
                  </select>
                </td>
                <td className="p-1">{cell(p, "mm_reference")}</td>
                <td className="p-1 text-center">
                  {perms.has("part-catalog.delete") && (
                    <button type="button" className="mt-x" title="Remove from the catalog" onClick={() => setRemoving(p)}>
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
          confirmLabel="Remove"
          message={`Remove ${removing.part_number} from the catalog?`}
          onConfirm={() => {
            deleteItem(removing.id)
              .unwrap()
              .catch((e) => dispatch(showToast({ message: apiError(e, "Couldn't remove it."), type: "error" })));
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
};
