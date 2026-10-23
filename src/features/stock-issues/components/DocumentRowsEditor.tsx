import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useFieldClass } from "@/features/safety/components/sqHelpers";
import { SecondaryButton } from "@/features/safety/components/sqUi";
import { DOCUMENT_TYPES, newDocumentRow, type DocumentRow } from "../stockIssueHelpers";
import type { IssueDocumentType } from "../api";

/** Any number of named uploads: voucher photo, AFG/1033, or anything else. */
export const DocumentRowsEditor = ({ rows, onChange }: { rows: DocumentRow[]; onChange: (rows: DocumentRow[]) => void }) => {
  const fieldClass = useFieldClass();
  const update = (key: string, patch: Partial<DocumentRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <input
            value={row.name}
            onChange={(e) => update(row.key, { name: e.target.value })}
            placeholder="Document name, e.g. Issue voucher photo"
            className={cn(fieldClass, "sm:col-span-4")}
          />
          <select
            value={row.document_type}
            onChange={(e) => update(row.key, { document_type: e.target.value as IssueDocumentType })}
            className={cn(fieldClass, "sm:col-span-3")}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            capture={row.document_type === "voucher_photo" ? "environment" : undefined}
            onChange={(e) => update(row.key, { file: e.target.files?.[0] ?? null })}
            className={cn(fieldClass, "sm:col-span-4")}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            aria-label="Remove document"
            className="sm:col-span-1 justify-self-start p-1.5 text-red-500 hover:bg-red-500/10 rounded"
          >
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
          </button>
        </div>
      ))}
      <SecondaryButton icon="mdi:paperclip-plus" onClick={() => onChange([...rows, newDocumentRow()])} disabled={rows.length >= 10}>
        Add document
      </SecondaryButton>
      <p className="text-[11px] opacity-60">Images (take a photo on mobile), PDF or Word, up to 20 MB each. Rows without a file are ignored.</p>
    </div>
  );
};
