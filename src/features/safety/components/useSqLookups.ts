import { useMemo } from "react";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useGetAssetTypesQuery, useGetAssetsQuery } from "@/features/assets/api";
import { useGetSqRecordsQuery, type SqRecord } from "../api";
import type { SqFieldOption } from "./RecordFormModal";

export type SqLookupKey =
  | "units"
  | "personnel"
  | "pilots"
  | "assetTypes"
  | "aircraft"
  | "safetyReports"
  | "qualityAudits"
  | "qualityFindings"
  | "investigations"
  | "documents";

export type SqLookups = Record<SqLookupKey, SqFieldOption[]>;

const refLabel = (r: SqRecord) => [r.reference, r.title].filter(Boolean).map(String).join(" · ");

const ALL_PERSONNEL = { branches: [], units: [], ranks: [], corps: [], specialties: [], status: [] };

/** Option lists for form selects; only the lists a section needs are fetched. */
export const useSqLookups = (needs: SqLookupKey[]): SqLookups => {
  const need = (k: SqLookupKey) => needs.includes(k);

  const { data: units = [] } = useGetUnitsQuery(undefined, { skip: !need("units") });
  const { data: personnel = [] } = useGetPersonnelQuery(ALL_PERSONNEL, { skip: !need("personnel") && !need("pilots") });
  const { data: assetTypes = [] } = useGetAssetTypesQuery(undefined, { skip: !need("assetTypes") });
  const { data: aircraft = [] } = useGetAssetsQuery({ type: "aircraft" }, { skip: !need("aircraft") });
  const { data: safetyReports = [] } = useGetSqRecordsQuery({ resource: "safety-reports" }, { skip: !need("safetyReports") });
  const { data: qualityAudits = [] } = useGetSqRecordsQuery({ resource: "quality-audits" }, { skip: !need("qualityAudits") });
  const { data: qualityFindings = [] } = useGetSqRecordsQuery({ resource: "quality-findings" }, { skip: !need("qualityFindings") });
  const { data: investigations = [] } = useGetSqRecordsQuery(
    { resource: "safety-investigations" },
    { skip: !need("investigations") },
  );
  const { data: documents = [] } = useGetSqRecordsQuery({ resource: "controlled-documents" }, { skip: !need("documents") });

  return useMemo(() => {
    const personLabel = (p: (typeof personnel)[number]) =>
      `${p.firstname} ${p.lastname}${p.service_number ? ` (${p.service_number})` : ""}`;

    return {
      units: units.map((u) => ({ value: u.id, label: u.name })),
      personnel: personnel.map((p) => ({ value: p.id, label: personLabel(p) })),
      pilots: personnel
        // is_pilot comes from the API and ignores placeholder call signs like "N/A".
        .filter((p) => p.is_pilot)
        .map((p) => ({ value: p.id, label: `${personLabel(p)} · ${p.call_sign}` })),
      assetTypes: assetTypes.map((t) => ({ value: t.id, label: t.name })),
      aircraft: aircraft.map((a) => ({ value: a.id, label: `${a.name}${a.tail_number ? ` (${a.tail_number})` : ""}` })),
      safetyReports: safetyReports.map((r) => ({ value: r.id, label: refLabel(r) })),
      qualityAudits: qualityAudits.map((r) => ({ value: r.id, label: refLabel(r) })),
      qualityFindings: qualityFindings.map((r) => ({ value: r.id, label: refLabel(r) })),
      investigations: investigations.map((r) => ({ value: r.id, label: refLabel(r) })),
      documents: documents.map((d) => ({ value: d.id, label: `${String(d.document_number)} · ${String(d.title)}` })),
    };
  }, [units, personnel, assetTypes, aircraft, safetyReports, qualityAudits, qualityFindings, investigations, documents]);
};
