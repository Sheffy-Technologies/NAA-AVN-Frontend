import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./components/TButton";
import { InfoTip } from "@/shared/ui/tooltip/InfoTip";
import { useGetTrackerFleetQuery, useGetTrackerSheetQuery } from "./api";
import { CATEGORY_TABS, today, useTrackerClasses } from "./trackerHelpers";
import { TRACKER_CSS } from "./trackerTheme";
import { TrackerDashboard } from "./tabs/TrackerDashboard";
import { TrackerItemsTab } from "./tabs/TrackerItemsTab";
import { TrackerWorkOrdersTab } from "./tabs/TrackerWorkOrdersTab";
import { TrackerSparesRequestsTab } from "./tabs/TrackerSparesRequestsTab";
import { TrackerCatalogTab } from "./tabs/TrackerCatalogTab";
import { TrackerInventoryTab } from "./tabs/TrackerInventoryTab";
import { TrackerIssuesTab } from "./tabs/TrackerIssuesTab";
import { TrackerFlightLogTab } from "./tabs/TrackerFlightLogTab";
import { TrackerHistoryTab } from "./tabs/TrackerHistoryTab";
import { TrackerDataTab } from "./tabs/TrackerDataTab";
import { TrackerDocumentsTab } from "./tabs/TrackerDocumentsTab";

/*
 * The maintenance tracker, as laid out in aircraft_maintenance_tracker_2.html:
 * one aircraft at a time (picked in the header), with its dashboard, the
 * three tracking registers, NAAVN-005 work orders, NAAVN-007 spares requests,
 * the spares catalog, unit inventory and issue vouchers, the flight log,
 * history, data tools and the maintenance document library.
 *
 * State lives in the URL (?aircraft=…&view=…&wo=…), so a work order or a
 * request can be linked to directly.
 */

export type TrackerView =
  | "dashboard"
  | "component"
  | "engine"
  | "inspection"
  | "work-orders"
  | "spares-requests"
  | "catalog"
  | "inventory"
  | "issues"
  | "flights"
  | "history"
  | "data"
  | "documents";

const VIEWS: { id: TrackerView; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "mdi:view-dashboard-outline" },
  ...CATEGORY_TABS.map((t) => ({
    id: t.category as TrackerView,
    label: t.label,
    icon: t.category === "component" ? "mdi:cog-outline" : t.category === "engine" ? "mdi:engine-outline" : "mdi:clipboard-check-outline",
  })),
  { id: "work-orders", label: "Work orders", icon: "mdi:file-document-edit-outline" },
  { id: "spares-requests", label: "Spares requests", icon: "mdi:clipboard-list-outline" },
  { id: "catalog", label: "Spares catalog", icon: "mdi:book-open-variant" },
  { id: "inventory", label: "Inventory", icon: "mdi:package-variant-closed" },
  { id: "issues", label: "Issues & movements", icon: "mdi:swap-horizontal" },
  { id: "flights", label: "Flight log", icon: "mdi:airplane-takeoff" },
  { id: "history", label: "History", icon: "mdi:history" },
  { id: "data", label: "Data", icon: "mdi:database-cog-outline" },
  { id: "documents", label: "Document", icon: "mdi:folder-file-outline" },
];

export type TrackerNav = {
  go: (view: TrackerView, extra?: Record<string, string | number | null>) => void;
  openWorkOrder: (id: number) => void;
  openSparesRequest: (id: number) => void;
  openVoucher: (id: number) => void;
};

/** Why the aircraft list failed, instead of a misleading "No aircraft". */
const fleetErrorMessage = (error: unknown) => {
  const { status, data } = (error ?? {}) as { status?: number; data?: { message?: string } };
  if (status === 403) return "You don't have permission to view the maintenance tracker (maintenance-tracking.view).";
  if (status === 404) return "The server doesn't have the maintenance tracker yet. Deploy the latest backend.";
  return `Couldn't load the aircraft list${status ? ` (error ${status})` : ""}${data?.message ? `: ${data.message}` : "."}`;
};

export const MaintenanceTracker = () => {
  const c = useTrackerClasses();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [asOf, setAsOf] = useState(today());

  const { data: fleet = [], isLoading: fleetLoading, isError: fleetFailed, error: fleetError } = useGetTrackerFleetQuery();
  const view = (params.get("view") as TrackerView) || "dashboard";
  const aircraftParam = Number(params.get("aircraft")) || null;
  const assetId = aircraftParam ?? fleet[0]?.id ?? null;

  // Settle on the first aircraft once the fleet has loaded.
  useEffect(() => {
    if (!aircraftParam && fleet[0]) {
      const next = new URLSearchParams(params);
      next.set("aircraft", String(fleet[0].id));
      setParams(next, { replace: true });
    }
  }, [aircraftParam, fleet, params, setParams]);

  const sheetQuery = useGetTrackerSheetQuery({ assetId: assetId ?? 0, asOf: asOf === today() ? undefined : asOf }, { skip: !assetId });
  const sheet = sheetQuery.data;

  const nav: TrackerNav = useMemo(() => {
    const go = (next: TrackerView, extra: Record<string, string | number | null> = {}) => {
      const p = new URLSearchParams();
      if (assetId) p.set("aircraft", String(assetId));
      if (next !== "dashboard") p.set("view", next);
      Object.entries(extra).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
      });
      setParams(p);
    };
    return {
      go,
      openWorkOrder: (id) => go("work-orders", { wo: id }),
      openSparesRequest: (id) => go("spares-requests", { sr: id }),
      openVoucher: (id) => go("issues", { voucher: id }),
    };
  }, [assetId, setParams]);

  const selectAircraft = (id: number) => {
    const p = new URLSearchParams(params);
    p.set("aircraft", String(id));
    ["wo", "sr", "voucher"].forEach((k) => p.delete(k));
    setParams(p);
  };

  const asset = sheet?.asset;
  const needsAircraft = !["catalog", "inventory", "issues", "spares-requests", "documents"].includes(view);

  return (
    <div className="mt" data-theme={c.isDark ? "dark" : "light"}>
      <style>{TRACKER_CSS}</style>
      {/* Header: aircraft, its identity, and the calendar reference date */}
      <header className="mt-header">
        <div>
          <h1>{asset ? `${asset.registration}${asset.type ? ` · ${asset.type}` : ""}` : fleetLoading ? "…" : "Maintenance Tracking"}</h1>
          {asset && (
            <small>
              S/N {asset.serial_number || "–"}
              {asset.engine_model || asset.engine_serial_number ? ` · ${asset.engine_model ?? "Engine"} S/N ${asset.engine_serial_number ?? "–"}` : ""}
            </small>
          )}
        </div>
        <select aria-label="Aircraft" title="Aircraft" className="mt-input" style={{ width: "auto" }} value={assetId ?? ""} onChange={(e) => selectAircraft(Number(e.target.value))}>
          {fleet.length === 0 && <option value="">{fleetFailed ? "Couldn't load aircraft" : "No aircraft"}</option>}
          {fleet.map((a) => (
            <option key={a.id} value={a.id}>
              {a.registration}
            </option>
          ))}
        </select>
        <Button size="xs" variant="secondary" onClick={() => navigate("/dashboard/assets/add")}>
          + Aircraft
        </Button>
        {assetId && (
          <Button size="xs" variant="secondary" onClick={() => navigate(`/dashboard/assets/${assetId}/edit`)}>
            Edit aircraft
          </Button>
        )}
        <div className="mt-sp" />
        <label className="mt-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Calendar items as of
          <InfoTip title="Calendar items as of">
            The date calendar and expiry items are measured against. Defaults to today; set a future date to see what will be due by then. Counters (hours, starts, landings) are always the current readings.
          </InfoTip>
          <input type="date" className="mt-input" style={{ width: "auto" }} value={asOf} onChange={(e) => setAsOf(e.target.value || today())} />
        </label>
        <span className="mt-sub">{sheetQuery.isFetching ? "Updating…" : "Saved on the server"}</span>
      </header>

      <nav className="mt-nav">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={view === v.id ? "on" : undefined} onClick={() => nav.go(v.id)}>
            {v.label}
          </button>
        ))}
      </nav>

      <main className="mt-main">
        {needsAircraft && fleetFailed ? (
          <div className="mt-empty" style={{ color: "var(--ov)" }}>
            {fleetErrorMessage(fleetError)}
          </div>
        ) : needsAircraft && !assetId && !fleetLoading ? (
          <div className="mt-empty">
            No aircraft yet. Add one with <b>+ Aircraft</b>; its tracker starts empty.
          </div>
        ) : needsAircraft && sheetQuery.isError ? (
          <div className="mt-empty" style={{ color: "var(--ov)" }}>
            Couldn't load this aircraft's tracker.
          </div>
        ) : needsAircraft && !sheet ? (
          <div className="mt-empty">Loading tracker…</div>
        ) : (
          <>
            {view === "dashboard" && sheet && <TrackerDashboard sheet={sheet} nav={nav} />}
            {(view === "component" || view === "engine" || view === "inspection") && sheet && (
              <TrackerItemsTab key={view} category={view} sheet={sheet} nav={nav} />
            )}
            {view === "work-orders" && sheet && <TrackerWorkOrdersTab sheet={sheet} nav={nav} openId={Number(params.get("wo")) || null} />}
            {view === "spares-requests" && <TrackerSparesRequestsTab nav={nav} openId={Number(params.get("sr")) || null} />}
            {view === "catalog" && <TrackerCatalogTab />}
            {view === "inventory" && <TrackerInventoryTab nav={nav} />}
            {view === "issues" && <TrackerIssuesTab nav={nav} openId={Number(params.get("voucher")) || null} />}
            {view === "flights" && sheet && <TrackerFlightLogTab sheet={sheet} />}
            {view === "history" && <TrackerHistoryTab assetId={assetId} />}
            {view === "data" && sheet && <TrackerDataTab sheet={sheet} fleet={fleet} />}
            {view === "documents" && <TrackerDocumentsTab assetId={assetId} fleet={fleet} />}
          </>
        )}
      </main>
    </div>
  );
};
