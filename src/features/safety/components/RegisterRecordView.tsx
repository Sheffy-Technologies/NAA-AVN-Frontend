import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetSqRecordQuery, type SqRecord } from "../api";
import { downloadRecordPdf, recordValues, type SqExportSpec } from "../sqExport";
import { RecordFormModal } from "./RecordFormModal";
import type { SqRegisterConfig } from "./RegisterSection";
import { useSqLookups } from "./useSqLookups";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus, SqTable } from "./sqUi";
import { formatDate, useSqPermissions } from "./sqHelpers";

const STATUS_KEYS = ["status", "effective_status", "risk_level", "severity"];

/** One register record: every field, linked records, edit, and NAAVN-format PDF. */
export const RegisterRecordView = ({ config, recordId }: { config: SqRegisterConfig; recordId: number }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { section } = useParams<{ section: string }>();
  const { has } = useSqPermissions();
  const lookups = useSqLookups(config.lookups);
  const { data: record, isLoading, isError } = useGetSqRecordQuery({ resource: config.resource, id: recordId });
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const back = () => navigate(`/dashboard/safety-quality/${section}`);

  if (isLoading) return <div className="py-10 text-center text-sm opacity-60">Loading…</div>;
  if (isError || !record) {
    return (
      <SqPanel>
        <p className="text-sm opacity-70 mb-3">This {config.singular.toLowerCase()} could not be found, or you don't have access to it.</p>
        <SecondaryButton icon="mdi:arrow-left" onClick={back}>
          Back to {config.title}
        </SecondaryButton>
      </SqPanel>
    );
  }

  const fields = config.fields(lookups, record);
  const spec: SqExportSpec = { formTitle: config.formTitle, singular: config.singular, fields, related: config.related };
  const values = recordValues(spec, record);
  const short = values.filter((v) => !v.long);
  const long = values.filter((v) => v.long);
  const statusKey = STATUS_KEYS.find((k) => typeof record[k] === "string" && record[k]);

  const pdf = async () => {
    setDownloading(true);
    try {
      await downloadRecordPdf(spec, record);
    } catch {
      dispatch(showToast({ type: "error", message: "The PDF could not be generated." }));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={back}
            aria-label={`Back to ${config.title}`}
            className={cn("mt-0.5 p-1.5 rounded-lg", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}
          >
            <Icon icon="mdi:arrow-left" className="w-5 h-5" />
          </button>
          <div>
            <div className={cn("text-[11px] font-mono", isDark ? "text-gray-400" : "text-slate-500")}>
              {config.singular}
              {record.reference ? ` · ${String(record.reference)}` : record.document_number ? ` · ${String(record.document_number)}` : ""}
            </div>
            <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>{String(record.title ?? `${config.singular} #${record.id}`)}</h2>
          </div>
          {statusKey && <SqStatus value={String(record[statusKey])} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton icon={downloading ? "mdi:loading" : "mdi:file-pdf-box"} onClick={pdf} disabled={downloading}>
            {downloading ? "Generating…" : "Download PDF"}
          </SecondaryButton>
          {(has(`${config.resource}.update`) || has(`${config.resource}.delete`)) && (
            <PrimaryButton icon="mdi:pencil-outline" onClick={() => setEditing(true)}>
              Edit
            </PrimaryButton>
          )}
        </div>
      </div>

      <SqPanel title="Details">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
          {short.map((v) => (
            <div key={v.label}>
              <dt className={cn(isDark ? "text-gray-400" : "text-slate-500")}>{v.label}</dt>
              <dd className="font-semibold break-words">{v.value || "-"}</dd>
            </div>
          ))}
        </dl>
      </SqPanel>

      {long.length > 0 && (
        <SqPanel title="Narrative">
          <div className="space-y-4 text-xs">
            {long.map((v) => (
              <div key={v.label}>
                <div className={cn("font-semibold mb-1", isDark ? "text-gray-400" : "text-slate-500")}>{v.label}</div>
                <p className="whitespace-pre-wrap">{v.value || <span className="opacity-50">Not recorded</span>}</p>
              </div>
            ))}
          </div>
        </SqPanel>
      )}

      {(config.related ?? []).map((rel) => (
        <SqPanel key={rel.heading} title={rel.heading}>
          <SqTable<SqRecord>
            rows={rel.rows(record)}
            rowKey={(r) => r.id}
            empty={rel.empty}
            columns={rel.columns.map((c) => ({ key: c.header, label: c.header, render: (r) => c.value(r) || "-" }))}
          />
        </SqPanel>
      ))}

      <p className={cn("text-[11px]", isDark ? "text-gray-500" : "text-slate-400")}>
        Recorded {formatDate(String(record.created_at ?? ""))}
        {record.updated_at && record.updated_at !== record.created_at ? ` · last updated ${formatDate(String(record.updated_at))}` : ""}. The PDF
        uses the official NAAVN form layout with signature boxes.
      </p>

      <RecordFormModal
        open={editing}
        onClose={() => setEditing(false)}
        resource={config.resource}
        title={`Edit ${config.singular}`}
        icon={config.icon}
        fields={fields}
        record={record}
        canDelete={has(`${config.resource}.delete`)}
        footerNote={config.footerNote}
        onDeleted={back}
      />
    </div>
  );
};
