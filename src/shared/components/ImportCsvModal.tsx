import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { downloadCsvFile, parseCsv } from "@/shared/utils/csv";

export type ImportCsvField = {
  key: string;
  label: string;
  required?: boolean;
  example: string;
};

type RowResult = { row: number; message: string };

type ImportCsvModalProps = {
  open: boolean;
  onClose: (result: { successCount: number } | null) => void;
  title: string;
  fields: ImportCsvField[];
  sampleFileName: string;
  onImportRow: (values: Record<string, string>) => Promise<void>;
};

export const ImportCsvModal = ({
  open,
  onClose,
  title,
  fields,
  sampleFileName,
  onImportRow,
}: ImportCsvModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    successCount: number;
    errors: RowResult[];
  } | null>(null);

  if (!open) return null;

  const handleDownloadSample = () => {
    const headers = fields.map((f) => f.label);
    const example = fields.map((f) => f.example);
    downloadCsvFile(sampleFileName, [headers, example]);
  };

  const resetState = () => {
    setFileName(null);
    setRows(null);
    setParseError(null);
    setResults(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResults(null);

    if (!file) {
      setFileName(null);
      setRows(null);
      return;
    }

    setFileName(file.name);
    setParseError(null);

    try {
      const text = await file.text();
      const table = parseCsv(text);

      if (table.length === 0) {
        setParseError("The file is empty.");
        setRows(null);
        return;
      }

      const headerRow = table[0].map((h) => h.trim().toLowerCase());
      const fieldByHeader = new Map<string, string>();
      fields.forEach((f) => {
        fieldByHeader.set(f.label.trim().toLowerCase(), f.key);
        fieldByHeader.set(f.key.trim().toLowerCase(), f.key);
      });

      const columnKeys = headerRow.map((h) => fieldByHeader.get(h) ?? null);

      const missingRequired = fields.filter(
        (f) => f.required && !columnKeys.includes(f.key),
      );
      if (missingRequired.length > 0) {
        setParseError(
          `Missing required column${missingRequired.length > 1 ? "s" : ""}: ${missingRequired
            .map((f) => f.label)
            .join(", ")}`,
        );
        setRows(null);
        return;
      }

      const dataRows = table
        .slice(1)
        .filter((r) => r.some((cell) => cell.trim() !== ""));

      const parsedRows = dataRows.map((cells) => {
        const record: Record<string, string> = {};
        columnKeys.forEach((key, idx) => {
          if (key) record[key] = (cells[idx] ?? "").trim();
        });
        return record;
      });

      if (parsedRows.length === 0) {
        setParseError("No data rows found in the file.");
        setRows(null);
        return;
      }

      setRows(parsedRows);
    } catch {
      setParseError("Failed to read the file. Make sure it is a valid CSV.");
      setRows(null);
    }
  };

  const handleImport = async () => {
    if (!rows) return;

    setIsImporting(true);
    setProgress(0);
    const errors: RowResult[] = [];
    let successCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const missing = fields.filter(
        (f) => f.required && !(row[f.key] ?? "").trim(),
      );

      if (missing.length > 0) {
        errors.push({
          row: i + 2,
          message: `Missing ${missing.map((f) => f.label).join(", ")}`,
        });
        setProgress(i + 1);
        continue;
      }

      try {
        await onImportRow(row);
        successCount += 1;
      } catch (error) {
        errors.push({
          row: i + 2,
          message: error instanceof Error ? error.message : "Import failed",
        });
      }

      setProgress(i + 1);
    }

    setResults({ successCount, errors });
    setIsImporting(false);
  };

  const handleClose = () => {
    const successCount = results?.successCount ?? 0;
    resetState();
    onClose(successCount > 0 ? { successCount } : null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg bg-[#001219] border border-[#0A4D66]/60 rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#0A4D66]/40">
          <div className="flex items-center gap-2">
            <Icon
              icon="mdi:file-upload-outline"
              className="w-4 h-4 text-[#7FD5FF]"
            />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white uppercase">
              {title}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Close import dialog"
            aria-label="Close import dialog"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
          >
            <Icon icon="mdi:close" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4 text-xs sm:text-sm text-gray-200 overflow-y-auto">
          <div className="rounded-lg border border-[#0A4D66]/40 bg-[#001825] p-3 space-y-2">
            <p className="text-gray-300">
              Download the sample file to see the expected columns, fill it
              in, then upload it below.
            </p>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 text-[#7FD5FF] hover:underline"
            >
              <Icon icon="mdi:download" className="w-4 h-4" />
              Download Sample CSV
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase text-gray-400">CSV File</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleFileChange(event)}
              title="Choose CSV file"
              aria-label="Choose CSV file"
              className="block w-full text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-[#0369A1] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-[#0369A1]/90"
            />
            {fileName && !parseError && rows && (
              <p className="text-[11px] text-emerald-400">
                {fileName} — {rows.length} row{rows.length > 1 ? "s" : ""}{" "}
                ready to import.
              </p>
            )}
            {parseError && (
              <p className="text-[11px] text-red-400">{parseError}</p>
            )}
          </div>

          {isImporting && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0A4D66]/30">
                <div
                  className="h-full rounded-full bg-[#0369A1] transition-[width] duration-150"
                  style={{
                    width: `${rows ? (progress / rows.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-gray-400">
                Importing {progress} of {rows?.length ?? 0}...
              </p>
            </div>
          )}

          {results && (
            <div className="space-y-2">
              <p
                className={cn(
                  "text-xs font-medium",
                  results.errors.length === 0
                    ? "text-emerald-400"
                    : "text-amber-400",
                )}
              >
                Imported {results.successCount} of{" "}
                {results.successCount + results.errors.length} row(s)
                successfully.
              </p>
              {results.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border border-[#0A4D66]/40 divide-y divide-[#0A4D66]/30">
                  {results.errors.map((error) => (
                    <div
                      key={error.row}
                      className="px-3 py-2 text-[11px] text-red-400"
                    >
                      Row {error.row}: {error.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-[#0A4D66]/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-3 py-1.5 text-xs text-gray-300 hover:bg-[#0A4D66]/30"
          >
            {results ? "Done" : "Cancel"}
          </button>
          {!results && (
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={!rows || isImporting || !!parseError}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0369A1]/90",
                (!rows || isImporting || !!parseError) &&
                  "opacity-60 cursor-not-allowed",
              )}
            >
              <Icon icon="mdi:upload" className="w-3.5 h-3.5" />
              {isImporting ? "Importing..." : "Start Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
