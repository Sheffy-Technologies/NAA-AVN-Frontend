import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useGetSqRecordsQuery, type SqRecord, type SqResource } from "../api";
import { RecordFormModal, type SqField, type SqFieldOption } from "./RecordFormModal";
import { useSqLookups, type SqLookupKey, type SqLookups } from "./useSqLookups";
import { PrimaryButton, SecondaryButton, SqPanel, SqTable, type SqColumn } from "./sqUi";
import { RegisterRecordView } from "./RegisterRecordView";
import { exportRecordsCsv, type SqRelated } from "../sqExport";
import { useFieldClass, useSqPermissions } from "./sqHelpers";

export type SqRegisterConfig = {
  resource: SqResource;
  title: string;
  subtitle: string;
  singular: string;
  icon: string;
  createLabel: string;
  lookups: SqLookupKey[];
  columns: SqColumn<SqRecord>[];
  fields: (lookups: SqLookups, record: SqRecord | null) => SqField[];
  filters?: Array<{ name: string; label: string; options: SqFieldOption[] | ((lookups: SqLookups) => SqFieldOption[]) }>;
  /** Stat tiles above the table, computed from the loaded records. */
  stats?: (records: SqRecord[]) => React.ReactNode;
  footerNote?: string;
  /** Title of the printed NAAVN form, e.g. "SAFETY REPORT". */
  formTitle: string;
  /** Linked records listed on the record page and its PDF. */
  related?: SqRelated[];
};

/** A register's list, or one record's page when `recordId` is set (/safety-quality/:section/:recordId). */
export const RegisterSection = ({ config, recordId }: { config: SqRegisterConfig; recordId?: number }) => {
  if (recordId) return <RegisterRecordView config={config} recordId={recordId} />;
  return <RegisterList config={config} />;
};

const RegisterList = ({ config }: { config: SqRegisterConfig }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { section } = useParams<{ section: string }>();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const lookups = useSqLookups(config.lookups);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = v;
    });
    if (search.trim()) p.q = search.trim();
    return p;
  }, [filters, search]);

  const { data: records = [], isLoading, isFetching } = useGetSqRecordsQuery({ resource: config.resource, params });
  const { data: allRecords = [] } = useGetSqRecordsQuery({ resource: config.resource });

  const canCreate = has(`${config.resource}.create`);
  const canUpdate = has(`${config.resource}.update`);
  const canDelete = has(`${config.resource}.delete`);
  const exportCsv = () =>
    exportRecordsCsv(
      { formTitle: config.formTitle, singular: config.singular, fields: config.fields(lookups, { id: 0 }), related: config.related },
      records,
      config.resource,
    );

  return (
    <div className="space-y-4">
      {config.stats && config.stats(allRecords)}

      <SqPanel
        title={config.title}
        subtitle={config.subtitle}
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon="mdi:file-delimited-outline" onClick={exportCsv} disabled={!records.length}>
              Export CSV
            </SecondaryButton>
            {canCreate && <PrimaryButton onClick={() => setCreating(true)}>{config.createLabel}</PrimaryButton>}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, title…"
            className={cn(fieldClass, "flex-1 min-w-[200px]")}
          />
          {(config.filters ?? []).map((f) => {
            const options = typeof f.options === "function" ? f.options(lookups) : f.options;
            return (
              <select
                key={f.name}
                value={filters[f.name] ?? ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, [f.name]: e.target.value }))}
                className={cn(fieldClass, "w-auto min-w-[160px]")}
              >
                <option value="">{f.label}</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          })}
        </div>

        <SqTable
          rows={records}
          columns={config.columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(row) => navigate(`/dashboard/safety-quality/${section}/${row.id}`)}
          empty={isFetching ? "Loading…" : `No ${config.singular.toLowerCase()} records match these filters.`}
        />
        <p className={cn("text-[11px] mt-3", isDark ? "text-gray-500" : "text-slate-400")}>
          Click a record to open it and download it as a PDF.{!canUpdate && !canDelete ? " You have read-only access to this register." : ""} Export CSV
          downloads the records listed above, with filters applied.
        </p>
      </SqPanel>

      <RecordFormModal
        open={creating}
        onClose={() => setCreating(false)}
        resource={config.resource}
        title={config.createLabel}
        icon={config.icon}
        fields={config.fields(lookups, null)}
        record={null}
        canDelete={false}
        footerNote={config.footerNote}
      />
    </div>
  );
};
