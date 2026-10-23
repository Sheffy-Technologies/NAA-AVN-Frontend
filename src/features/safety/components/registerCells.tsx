import type { SqRecord } from "../api";

const str = (r: SqRecord, key: string) => (r[key] === null || r[key] === undefined ? "" : String(r[key]));

export const RefCell = ({ r, sub }: { r: SqRecord; sub?: string }) => (
  <div>
    <div className="font-semibold">{str(r, "title") || "-"}</div>
    <div className="text-[11px] opacity-70 font-mono">
      {str(r, "reference")}
      {sub ? ` · ${sub}` : ""}
    </div>
  </div>
);

export const StatGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
);

export const FileBadge = ({ type }: { type: string }) => {
  const tone =
    type === "DOCX" || type === "DOC"
      ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
      : type === "XLSX" || type === "XLS"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return (
    <div className={`w-9 h-10 rounded-md grid place-items-center text-[9px] font-extrabold shrink-0 ${tone}`}>{type || "—"}</div>
  );
};
