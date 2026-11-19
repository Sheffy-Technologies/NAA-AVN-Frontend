import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import Modal from "@/shared/ui/modal/Modal";
import { StatusBadge } from "@/shared/ui/badge/StatusBadge";
import { downloadCsvFile } from "@/shared/utils/csv";
import { PrimaryButton, SecondaryButton, SqPanel, SqTable } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import { downloadSummaryPdf } from "@/features/safety/sqExport";
import {
  useDeleteOperationLocstatMutation,
  useGetOperationLocstatsQuery,
  useSaveOperationLocstatMutation,
  type LocstatEntry,
  type LocstatPayload,
  type LocstatStatus,
  type OperationAssignedAsset,
} from "../api";
import { formatMgrsSpaced, latLonToMgrs, parseAnyCoordinate } from "../utils/coordinates";
import {
  LOCSTAT_STATUS_COLOR,
  LOCSTAT_STATUS_LABEL,
  LOCSTAT_STATUS_VARIANT,
  formatLocalDateTime,
  locstatPosition,
  toDtg,
} from "../utils/locstat";

const getTileUrl = (relativePath: string) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (apiBase && (apiBase.startsWith("http://") || apiBase.startsWith("https://"))) {
    return `${apiBase.replace(/\/+$/, "")}/${relativePath.replace(/^\/?api\/?/, "")}`;
  }
  return relativePath;
};
const TILE_URL = getTileUrl("/api/map/tiles/dark/{z}/{x}/{y}.png?v=esri2");

/** Distinct track colours per aircraft. */
const TRACK_COLORS = ["#38BDF8", "#F59E0B", "#A78BFA", "#34D399", "#F472B6", "#FB923C"];

type AircraftOption = { id: number; label: string };

const aircraftOptions = (assets: OperationAssignedAsset[] | undefined): AircraftOption[] =>
  (assets ?? [])
    .map((a) => {
      const id = a.asset_id ?? a.asset?.id ?? a.id;
      const name = a.name ?? a.asset?.name ?? "Aircraft";
      const tail = a.tail_number ?? a.asset?.tail_number;
      return id ? { id: Number(id), label: tail && tail !== name ? `${name} (${tail})` : name } : null;
    })
    .filter((a): a is AircraftOption => a !== null);

const StatusPill = ({ entry }: { entry: LocstatEntry }) =>
  entry.source === "garmin" || !entry.status ? (
    <StatusBadge variant="info" label="Garmin fix" />
  ) : (
    <StatusBadge variant={LOCSTAT_STATUS_VARIANT[entry.status]} label={LOCSTAT_STATUS_LABEL[entry.status]} />
  );

const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 9);
    else map.fitBounds(latLngBounds(points), { padding: [30, 30], maxZoom: 11 });
    // Refit only when the set of points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
};

/**
 * LOCSTAT tab of an operation: location/status reports per aircraft, entered by
 * the ops room or crew, plus Garmin inReach fixes. Read with operations.view,
 * written with operations.update.
 */
export const LocstatTab = ({
  operationId,
  operationName,
  operationStatus,
  unitName,
  assets,
}: {
  operationId: number;
  operationName: string;
  operationStatus?: string | null;
  unitName?: string | null;
  assets?: OperationAssignedAsset[];
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const canWrite = has("operations.update");
  const { data, isLoading, isError, refetch } = useGetOperationLocstatsQuery(operationId, { pollingInterval: 60_000 });
  const [remove] = useDeleteOperationLocstatMutation();
  const [form, setForm] = useState<{ open: boolean; entry: LocstatEntry | null }>({ open: false, entry: null });
  const [aircraftFilter, setAircraftFilter] = useState<string>("");
  const [showGarmin, setShowGarmin] = useState(true);

  const aircraft = useMemo(() => aircraftOptions(assets), [assets]);
  const muted = isDark ? "text-gray-400" : "text-slate-500";

  const entries = useMemo(
    () =>
      (data?.data ?? []).filter(
        (e) => (showGarmin || e.source === "manual") && (!aircraftFilter || String(e.asset_id) === aircraftFilter),
      ),
    [data, showGarmin, aircraftFilter],
  );

  /** Chronological track per aircraft from every entry with a position. */
  const tracks = useMemo(() => {
    const byAsset = new Map<string, LocstatEntry[]>();
    [...entries].reverse().forEach((e) => {
      if (e.latitude === null || e.longitude === null) return;
      const k = String(e.asset_id ?? "none");
      byAsset.set(k, [...(byAsset.get(k) ?? []), e]);
    });
    return [...byAsset.entries()].map(([assetId, points], i) => ({ assetId, points, color: TRACK_COLORS[i % TRACK_COLORS.length] }));
  }, [entries]);

  const allPoints = tracks.flatMap((t) => t.points.map((p) => [p.latitude as number, p.longitude as number] as [number, number]));
  const latest = (data?.latest ?? []).filter((e) => !aircraftFilter || String(e.asset_id) === aircraftFilter);

  const onDelete = async (entry: LocstatEntry) => {
    if (!window.confirm(`Delete the LOCSTAT of ${entry.asset_name ?? "this aircraft"} at ${toDtg(entry.reported_at)}?`)) return;
    try {
      await remove({ operationId, id: entry.id }).unwrap();
      dispatch(showToast({ type: "success", message: "LOCSTAT deleted." }));
    } catch {
      dispatch(showToast({ type: "error", message: "Couldn't delete the LOCSTAT." }));
    }
  };

  const exportRows = () =>
    entries.map((e) => [
      toDtg(e.reported_at),
      [e.asset_name, e.tail_number && e.tail_number !== e.asset_name ? e.tail_number : null].filter(Boolean).join(" "),
      locstatPosition(e),
      e.source === "garmin" ? "Garmin fix" : (e.status_label ?? ""),
      e.altitude_ft !== null ? `${e.altitude_ft} ft` : "",
      [e.heading !== null ? `${String(e.heading).padStart(3, "0")}°` : null, e.ground_speed_kt !== null ? `${e.ground_speed_kt} kt` : null]
        .filter(Boolean)
        .join(" / "),
      e.fuel_state ?? "",
      e.persons_on_board !== null ? String(e.persons_on_board) : "",
      [e.next_location, e.eta ? `ETA ${toDtg(e.eta)}` : null].filter(Boolean).join(" · "),
      e.reported_by_name ?? "",
      e.remarks ?? "",
    ]);
  const HEADERS = ["DTG", "Aircraft", "Position", "Status", "Alt", "Hdg / GS", "Fuel", "POB", "Next / ETA", "Reported by", "Remarks"];

  const exportCsv = () => downloadCsvFile(`LOCSTAT ${operationName}.csv`, [HEADERS, ...exportRows()]);

  const exportPdf = () => {
    const times = entries.map((e) => e.reported_at).sort();
    downloadSummaryPdf({
      formTitle: "LOCSTAT LOG",
      title: `OPERATION ${operationName.toUpperCase()}`,
      fileName: `LOCSTAT ${operationName}`,
      fields: [
        ["Unit", unitName || "-"],
        ["Operation status", (operationStatus ?? "-").toUpperCase()],
        ["Aircraft", aircraftFilter ? (aircraft.find((a) => String(a.id) === aircraftFilter)?.label ?? "-") : aircraft.map((a) => a.label).join(", ") || "-"],
        ["Reports", String(entries.length)],
        ["First report", times.length ? toDtg(times[0]) : "-"],
        ["Last report", times.length ? toDtg(times[times.length - 1]) : "-"],
      ],
      tables: [
        {
          heading: "Location status reports",
          headers: HEADERS,
          widths: [1.05, 0.95, 1.5, 1.1, 0.75, 0.95, 0.75, 0.6, 1.15, 0.95, 1.2],
          rows: [...exportRows()].reverse(),
          empty: "No LOCSTAT reported",
        },
      ],
    }).catch(() => dispatch(showToast({ type: "error", message: "Couldn't create the PDF." })));
  };

  if (isLoading) {
    return (
      <div className={cn("py-16 text-center text-sm", muted)}>
        <Icon icon="mdi:loading" className="mr-2 inline h-4 w-4 animate-spin" />
        Loading LOCSTAT…
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("py-16 text-center text-sm", muted)}>
        Couldn't load LOCSTAT reports.{" "}
        <button type="button" className="underline" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Latest per aircraft */}
      <SqPanel
        title="Latest LOCSTAT"
        subtitle="Last reported position of each aircraft (refreshes every minute)"
        action={
          canWrite && aircraft.length ? (
            <PrimaryButton icon="mdi:map-marker-plus-outline" onClick={() => setForm({ open: true, entry: null })}>
              New LOCSTAT
            </PrimaryButton>
          ) : undefined
        }
      >
        {!aircraft.length ? (
          <p className={cn("text-xs", muted)}>Attach an aircraft to this operation to report its LOCSTAT.</p>
        ) : latest.length === 0 ? (
          <p className={cn("text-xs", muted)}>No position reported yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {latest.map((e) => (
              <div
                key={e.key}
                className={cn(
                  "rounded-lg border p-3 text-xs",
                  e.status === "emergency"
                    ? "border-red-500/60 bg-red-500/10"
                    : isDark
                      ? "border-[#0A4D66]/40 bg-[#001825]"
                      : "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm">{e.asset_name ?? "Aircraft"}</div>
                  <StatusPill entry={e} />
                </div>
                <div className="mt-1 font-mono">{locstatPosition(e)}</div>
                <div className={cn("mt-1", muted)}>
                  {toDtg(e.reported_at)} · {formatLocalDateTime(e.reported_at)}
                </div>
                <div className={cn("mt-1", muted)}>
                  {[
                    e.altitude_ft !== null ? `${e.altitude_ft} ft` : null,
                    e.heading !== null ? `HDG ${String(e.heading).padStart(3, "0")}` : null,
                    e.ground_speed_kt !== null ? `${e.ground_speed_kt} kt` : null,
                    e.fuel_state ? `Fuel ${e.fuel_state}` : null,
                    e.persons_on_board !== null ? `POB ${e.persons_on_board}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </SqPanel>

      {/* Map */}
      {allPoints.length > 0 && (
        <SqPanel title="Track" subtitle="Each aircraft's reported positions in time order; the large dot is the latest">
          <div className="h-[380px] overflow-hidden rounded-lg">
            <MapContainer center={allPoints[0]} zoom={8} className="h-full w-full" scrollWheelZoom>
              <TileLayer url={TILE_URL} attribution="NAA Tactical Night System" maxZoom={18} />
              <FitBounds points={allPoints} />
              {tracks.map((track) => (
                <div key={track.assetId}>
                  {track.points.length > 1 && (
                    <Polyline
                      positions={track.points.map((p) => [p.latitude as number, p.longitude as number])}
                      pathOptions={{ color: track.color, weight: 2.5, opacity: 0.8, dashArray: "6 6" }}
                    />
                  )}
                  {track.points.map((p, i) => {
                    const last = i === track.points.length - 1;
                    const color = p.status ? LOCSTAT_STATUS_COLOR[p.status] : track.color;
                    return (
                      <CircleMarker
                        key={p.key}
                        center={[p.latitude as number, p.longitude as number]}
                        radius={last ? 8 : 4}
                        pathOptions={{ color: last ? "#ffffff" : color, fillColor: color, fillOpacity: 0.9, weight: last ? 2 : 1 }}
                      >
                        <Tooltip direction="top">
                          <div className="text-xs">
                            <div className="font-bold">{p.asset_name ?? "Aircraft"} · {p.source === "garmin" ? "Garmin fix" : p.status_label}</div>
                            <div>{toDtg(p.reported_at)}</div>
                            <div className="font-mono">{locstatPosition(p)}</div>
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    );
                  })}
                </div>
              ))}
            </MapContainer>
          </div>
        </SqPanel>
      )}

      {/* Log */}
      <SqPanel
        title="LOCSTAT log"
        subtitle={`${entries.length} report${entries.length === 1 ? "" : "s"}, newest first`}
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon="mdi:file-delimited-outline" disabled={!entries.length} onClick={exportCsv}>
              Export CSV
            </SecondaryButton>
            <SecondaryButton icon="mdi:file-pdf-box" disabled={!entries.length} onClick={exportPdf}>
              Print PDF
            </SecondaryButton>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select value={aircraftFilter} onChange={(e) => setAircraftFilter(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All aircraft</option>
            {aircraft.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showGarmin} onChange={(e) => setShowGarmin(e.target.checked)} />
            Include Garmin inReach fixes
          </label>
        </div>
        <SqTable<LocstatEntry>
          rows={entries}
          rowKey={(e) => e.key}
          empty="No LOCSTAT reported yet."
          columns={[
            {
              key: "dtg",
              label: "DTG",
              render: (e) => (
                <div>
                  <div className="font-mono font-semibold">{toDtg(e.reported_at)}</div>
                  <div className={cn("text-[11px]", muted)}>{formatLocalDateTime(e.reported_at)}</div>
                </div>
              ),
            },
            { key: "aircraft", label: "Aircraft", render: (e) => e.asset_name ?? "—" },
            { key: "pos", label: "Position", render: (e) => <span className="font-mono">{locstatPosition(e)}</span> },
            { key: "status", label: "Status", render: (e) => <StatusPill entry={e} /> },
            {
              key: "flight",
              label: "Alt / Hdg / GS",
              render: (e) =>
                [
                  e.altitude_ft !== null ? `${e.altitude_ft} ft` : null,
                  e.heading !== null ? `${String(e.heading).padStart(3, "0")}°` : null,
                  e.ground_speed_kt !== null ? `${e.ground_speed_kt} kt` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—",
            },
            { key: "fuel", label: "Fuel / POB", render: (e) => [e.fuel_state, e.persons_on_board !== null ? `POB ${e.persons_on_board}` : null].filter(Boolean).join(" · ") || "—" },
            {
              key: "next",
              label: "Next / ETA",
              render: (e) => [e.next_location, e.eta ? `ETA ${toDtg(e.eta)}` : null].filter(Boolean).join(" · ") || "—",
            },
            {
              key: "by",
              label: "Reported by",
              render: (e) => (
                <div>
                  <div>{e.reported_by_name ?? "—"}</div>
                  {e.remarks && <div className={cn("text-[11px]", muted)}>{e.remarks}</div>}
                </div>
              ),
            },
            {
              key: "actions",
              label: "",
              align: "right",
              render: (e) =>
                canWrite && e.source === "manual" ? (
                  <div className="flex justify-end gap-1">
                    <button type="button" title="Edit" onClick={() => setForm({ open: true, entry: e })} className="rounded p-1 hover:bg-white/10">
                      <Icon icon="mdi:pencil-outline" className="h-4 w-4" />
                    </button>
                    <button type="button" title="Delete" onClick={() => void onDelete(e)} className="rounded p-1 text-red-400 hover:bg-red-500/10">
                      <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
                    </button>
                  </div>
                ) : null,
            },
          ]}
        />
      </SqPanel>

      {form.open && (
        <LocstatFormModal
          operationId={operationId}
          aircraft={aircraft}
          statuses={data?.statuses ?? []}
          entry={form.entry}
          defaultAssetId={aircraftFilter ? Number(aircraftFilter) : (aircraft[0]?.id ?? null)}
          onClose={() => setForm({ open: false, entry: null })}
        />
      )}
    </div>
  );
};

/** yyyy-MM-ddTHH:mm in the user's local time, for datetime-local inputs. */
const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const strOrNull = (v: string) => (v.trim() === "" ? null : v.trim());

const LocstatFormModal = ({
  operationId,
  aircraft,
  statuses,
  entry,
  defaultAssetId,
  onClose,
}: {
  operationId: number;
  aircraft: AircraftOption[];
  statuses: { value: LocstatStatus; label: string }[];
  entry: LocstatEntry | null;
  defaultAssetId: number | null;
  onClose: () => void;
}) => {
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const { isDark } = useTheme();
  const [save, { isLoading }] = useSaveOperationLocstatMutation();
  const [error, setError] = useState<string | null>(null);
  const initialPosition = entry?.mgrs ?? (entry?.latitude != null && entry.longitude != null ? `${entry.latitude}, ${entry.longitude}` : "");
  const [v, setV] = useState({
    asset_id: String(entry?.asset_id ?? defaultAssetId ?? ""),
    reported_at: toLocalInput(entry?.reported_at),
    position: initialPosition,
    location_name: entry?.location_name ?? "",
    status: (entry?.status ?? "airborne") as LocstatStatus,
    altitude_ft: entry?.altitude_ft != null ? String(entry.altitude_ft) : "",
    heading: entry?.heading != null ? String(entry.heading) : "",
    ground_speed_kt: entry?.ground_speed_kt != null ? String(entry.ground_speed_kt) : "",
    fuel_state: entry?.fuel_state ?? "",
    persons_on_board: entry?.persons_on_board != null ? String(entry.persons_on_board) : "",
    next_location: entry?.next_location ?? "",
    eta: entry?.eta ? toLocalInput(entry.eta) : "",
    reported_by_name: entry?.reported_by_name ?? "",
    remarks: entry?.remarks ?? "",
  });
  const set = (k: keyof typeof v, value: string) => setV((p) => ({ ...p, [k]: value }));
  const parsed = v.position.trim() ? parseAnyCoordinate(v.position) : null;
  const label = isDark ? "text-gray-400" : "text-slate-600";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (v.position.trim() && !parsed) return setError("The position isn't a valid grid reference or latitude, longitude.");
    if (!parsed && !v.location_name.trim()) return setError("Give a position or a location name.");
    const payload: LocstatPayload = {
      asset_id: Number(v.asset_id),
      reported_at: new Date(v.reported_at).toISOString(),
      latitude: parsed ? Number(parsed.latitude.toFixed(7)) : null,
      longitude: parsed ? Number(parsed.longitude.toFixed(7)) : null,
      mgrs: parsed ? formatMgrsSpaced(parsed.mgrs.replace(/\s+/g, "") || latLonToMgrs(parsed.latitude, parsed.longitude)) : null,
      location_name: strOrNull(v.location_name),
      status: v.status,
      altitude_ft: numOrNull(v.altitude_ft),
      heading: numOrNull(v.heading),
      ground_speed_kt: numOrNull(v.ground_speed_kt),
      fuel_state: strOrNull(v.fuel_state),
      persons_on_board: numOrNull(v.persons_on_board),
      next_location: strOrNull(v.next_location),
      eta: v.eta ? new Date(v.eta).toISOString() : null,
      reported_by_name: strOrNull(v.reported_by_name),
      remarks: strOrNull(v.remarks),
    };
    try {
      await save({ operationId, id: entry?.id, data: payload }).unwrap();
      dispatch(showToast({ type: payload.status === "emergency" ? "warning" : "success", message: entry ? "LOCSTAT updated." : "LOCSTAT logged." }));
      onClose();
    } catch (err) {
      const data = (err as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
      setError((data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Couldn't save the LOCSTAT.");
    }
  };

  const Field = ({ name, children, wide }: { name: string; children: React.ReactNode; wide?: boolean }) => (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className={cn("mb-1 block text-[11px] font-semibold uppercase", label)}>{name}</span>
      {children}
    </label>
  );

  return (
    <Modal open onClose={onClose} title={entry ? "Edit LOCSTAT" : "New LOCSTAT"} className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div className="grid gap-3 sm:grid-cols-2">
          {Field({
            name: "Aircraft *",
            children: (
              <select required value={v.asset_id} onChange={(e) => set("asset_id", e.target.value)} className={fieldClass}>
                {aircraft.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            ),
          })}
          {Field({
            name: "Date / time of report *",
            children: (
              <>
                <input type="datetime-local" required value={v.reported_at} onChange={(e) => set("reported_at", e.target.value)} className={fieldClass} />
                {v.reported_at && <span className={cn("mt-0.5 block text-[11px] font-mono", label)}>DTG {toDtg(new Date(v.reported_at).toISOString())}</span>}
              </>
            ),
          })}
          {Field({
            name: "Position (MGRS or lat, long)",
            children: (
              <>
                <input
                  value={v.position}
                  onChange={(e) => set("position", e.target.value)}
                  placeholder="e.g. 32P NM 12345 67890 or 9.0579, 7.4951"
                  className={cn(fieldClass, "font-mono")}
                />
                {v.position.trim() && (
                  <span className={cn("mt-0.5 block text-[11px] font-mono", parsed ? label : "text-red-500")}>
                    {parsed ? `${parsed.latitude.toFixed(5)}, ${parsed.longitude.toFixed(5)} · ${parsed.mgrs}` : "Not a recognised grid or coordinate"}
                  </span>
                )}
              </>
            ),
          })}
          {Field({
            name: "Location name",
            children: <input value={v.location_name} onChange={(e) => set("location_name", e.target.value)} placeholder="e.g. 10 NM north of Kaduna" className={fieldClass} />,
          })}
          {Field({
            name: "Status *",
            children: (
              <select value={v.status} onChange={(e) => set("status", e.target.value)} className={fieldClass}>
                {(statuses.length ? statuses : Object.entries(LOCSTAT_STATUS_LABEL).map(([value, l]) => ({ value: value as LocstatStatus, label: l }))).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            ),
          })}
          {Field({
            name: "Altitude (ft)",
            children: <input type="number" min={0} max={60000} value={v.altitude_ft} onChange={(e) => set("altitude_ft", e.target.value)} className={fieldClass} />,
          })}
          {Field({
            name: "Heading (°)",
            children: <input type="number" min={0} max={360} value={v.heading} onChange={(e) => set("heading", e.target.value)} className={fieldClass} />,
          })}
          {Field({
            name: "Ground speed (kt)",
            children: <input type="number" min={0} max={1000} value={v.ground_speed_kt} onChange={(e) => set("ground_speed_kt", e.target.value)} className={fieldClass} />,
          })}
          {Field({
            name: "Fuel state",
            children: <input value={v.fuel_state} onChange={(e) => set("fuel_state", e.target.value)} placeholder="e.g. 1+40 or 450 lb" className={fieldClass} />,
          })}
          {Field({
            name: "Persons on board",
            children: <input type="number" min={0} max={500} value={v.persons_on_board} onChange={(e) => set("persons_on_board", e.target.value)} className={fieldClass} />,
          })}
          {Field({
            name: "Next location",
            children: <input value={v.next_location} onChange={(e) => set("next_location", e.target.value)} className={fieldClass} />,
          })}
          {Field({
            name: "ETA",
            children: <input type="datetime-local" value={v.eta} onChange={(e) => set("eta", e.target.value)} className={fieldClass} />,
          })}
          {Field({
            name: "Reported by",
            children: <input value={v.reported_by_name} onChange={(e) => set("reported_by_name", e.target.value)} placeholder="Call sign or name" className={fieldClass} />,
          })}
          {Field({
            name: "Remarks",
            wide: true,
            children: <textarea rows={2} value={v.remarks} onChange={(e) => set("remarks", e.target.value)} className={fieldClass} />,
          })}
        </div>
        {v.status === "emergency" && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-400">
            An emergency LOCSTAT is raised as an alert in the notification feed.
          </p>
        )}
        {error && <p className="text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" icon="mdi:content-save-outline" disabled={isLoading}>
            {entry ? "Save" : "Log LOCSTAT"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
};
