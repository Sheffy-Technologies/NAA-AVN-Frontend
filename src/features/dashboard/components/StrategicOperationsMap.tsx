import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { latLngBounds, type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import {
  type StrategicOperation,
  type StrategicOperationStatus,
  type StrategicUnit,
} from "../api";
import {
  latLonToMgrs,
  formatMgrsSpaced,
  decimalToDms,
} from "@/features/operations/utils/coordinates";

type MapView = "ongoing" | "planned" | "completed";

export type MapLayerMode = "night" | "imagery" | "topo" | "osm";

interface MapLayerConfig {
  label: string;
  icon: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

const MAP_LAYERS: Record<MapLayerMode, MapLayerConfig> = {
  night: {
    label: "Tactical Night",
    icon: "mdi:weather-night",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CartoDB & OpenStreetMap contributors",
    maxZoom: 19,
  },
  imagery: {
    label: "Satellite Imagery",
    icon: "mdi:satellite-variant",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri World Imagery",
    maxZoom: 18,
  },
  topo: {
    label: "Topographic Relief",
    icon: "mdi:image-filter-hdr",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap",
    maxZoom: 17,
  },
  osm: {
    label: "OpenStreetMap",
    icon: "mdi:map-outline",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
};

const WEATHER_RADAR_URL = "https://tilecache.rainviewer.com/v2/radar/nowcast_latest/256/{z}/{x}/{y}/2/1_1.png";

const THEATRE_SECTORS = [
  {
    id: "all",
    label: "All Theatre (ECOWAS)",
    icon: "mdi:earth",
    description: "Regional bounds covering Guinea-Bissau, Nigeria, Lake Chad & Cameroon",
  },
  {
    id: "nigeria",
    label: "Nigeria National C2",
    icon: "mdi:shield-airplane",
    center: [9.08, 8.0] as [number, number],
    zoom: 6,
  },
  {
    id: "lake_chad",
    label: "Lake Chad Sector",
    icon: "mdi:target",
    center: [12.6, 13.9] as [number, number],
    zoom: 8,
  },
  {
    id: "guinea_bissau",
    label: "Guinea-Bissau Sector",
    icon: "mdi:anchor",
    center: [11.86, -15.60] as [number, number],
    zoom: 8,
  },
];

const STATUS_ROUTE_COLORS: Record<StrategicOperationStatus, { primary: string; glow: string }> = {
  ongoing: { primary: "#22C55E", glow: "rgba(34, 197, 94, 0.4)" },
  planned: { primary: "#00F0FF", glow: "rgba(0, 240, 255, 0.4)" },
  completed: { primary: "#94A3B8", glow: "rgba(148, 163, 184, 0.25)" },
  aborted: { primary: "#EF4444", glow: "rgba(239, 68, 68, 0.4)" },
};

function haversineDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function calculateOperationDistanceNm(operation: StrategicOperation): number {
  const pts: [number, number][] = [];
  if (operation.departure) pts.push([operation.departure.lat, operation.departure.lng]);
  operation.waypoints.forEach((wp) => pts.push([wp.lat, wp.lng]));
  if (operation.arrival) pts.push([operation.arrival.lat, operation.arrival.lng]);

  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += haversineDistanceNm(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
  return total;
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// Map controller component for bounds and view adjustments
function MapViewController({
  bounds,
  flyToTarget,
}: {
  bounds: LatLngBoundsExpression | null;
  flyToTarget: { center: [number, number]; zoom: number; key: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (flyToTarget) {
      map.flyTo(flyToTarget.center, flyToTarget.zoom, { duration: 1.2 });
      return;
    }
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }, [map, bounds, flyToTarget]);

  return null;
}

// Tactical cursor position tracker
function CursorTracker({
  onCursorMove,
}: {
  onCursorMove: (coords: { lat: number; lng: number } | null) => void;
}) {
  useMapEvents({
    mousemove: (e) => {
      onCursorMove({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    mouseout: () => {
      onCursorMove(null);
    },
  });
  return null;
}

interface StrategicOperationsMapProps {
  operations: StrategicOperation[];
  units: StrategicUnit[];
  mapView: MapView;
  onMapViewChange: (view: MapView) => void;
  showUnits: boolean;
  onToggleUnits: (show: boolean) => void;
  viewCounts: Record<MapView, number>;
}

export const StrategicOperationsMap = ({
  operations,
  units,
  mapView,
  onMapViewChange,
  showUnits,
  onToggleUnits,
  viewCounts,
}: StrategicOperationsMapProps) => {
  const navigate = useNavigate();
  const mapWrapperRef = useRef<HTMLDivElement>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerMode>("night");
  const [showWeather, setShowWeather] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);

  const [selectedOperation, setSelectedOperation] = useState<StrategicOperation | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [flyToTarget, setFlyToTarget] = useState<{ center: [number, number]; zoom: number; key: number } | null>(null);

  // Compute overall theatre bounds to auto-fit
  const theatreBounds = useMemo(() => {
    const coords: [number, number][] = [];

    operations.forEach((op) => {
      if (op.departure) coords.push([op.departure.lat, op.departure.lng]);
      if (op.arrival) coords.push([op.arrival.lat, op.arrival.lng]);
      op.waypoints.forEach((wp) => coords.push([wp.lat, wp.lng]));
    });

    if (showUnits) {
      units.forEach((u) => coords.push([u.lat, u.lng]));
    }

    if (coords.length === 0) {
      return latLngBounds([[4.0, 2.0], [14.0, 15.0]]);
    }

    return latLngBounds(coords);
  }, [operations, units, showUnits]);

  // Sector jump handler
  const handleSelectSector = (sector: (typeof THEATRE_SECTORS)[number]) => {
    if (sector.id === "all") {
      setFlyToTarget(null);
      return;
    }
    if (sector.center && sector.zoom) {
      setFlyToTarget({
        center: sector.center,
        zoom: sector.zoom,
        key: Date.now(),
      });
    }
  };

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!mapWrapperRef.current) return;
    if (!document.fullscreenElement) {
      mapWrapperRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Filter roster
  const filteredOperations = useMemo(() => {
    if (!rosterSearch.trim()) return operations;
    const q = rosterSearch.toLowerCase();
    return operations.filter(
      (op) =>
        op.name.toLowerCase().includes(q) ||
        (op.unit && op.unit.toLowerCase().includes(q)) ||
        (op.type && op.type.toLowerCase().includes(q)) ||
        op.assets.some((a) => a.toLowerCase().includes(q))
    );
  }, [operations, rosterSearch]);

  // Center on specific operation
  const handleFocusOperation = useCallback((op: StrategicOperation) => {
    setSelectedOperation(op);
    const pts: [number, number][] = [];
    if (op.departure) pts.push([op.departure.lat, op.departure.lng]);
    op.waypoints.forEach((wp) => pts.push([wp.lat, wp.lng]));
    if (op.arrival) pts.push([op.arrival.lat, op.arrival.lng]);

    if (pts.length > 0) {
      if (pts.length === 1) {
        setFlyToTarget({ center: pts[0], zoom: 9, key: Date.now() });
      } else {
        const bounds = latLngBounds(pts);
        const center = bounds.getCenter();
        setFlyToTarget({ center: [center.lat, center.lng], zoom: 7.5, key: Date.now() });
      }
    }
  }, []);

  return (
    <div
      ref={mapWrapperRef}
      className={cn(
        "relative flex flex-col rounded-xl border border-[#0A4D66]/50 bg-[#001219] overflow-hidden shadow-2xl transition-all",
        isFullscreen ? "h-screen w-screen p-0 rounded-none border-0" : "w-full"
      )}
    >
      {/* Tactical C2 Map Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A4D66]/50 bg-[#001825]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00F0FF]/40 bg-[#001825] text-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.2)]">
            <Icon icon="mdi:radar" className="h-5 w-5 animate-pulse text-[#00F0FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Theatre &amp; Strategic Operations Map
              </h2>
              <span className="rounded bg-[#0369A1]/30 border border-[#00F0FF]/30 px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#7FD5FF]">
                AIR THEATRE C2
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Joint Task Force operations across Guinea-Bissau, Nigeria &amp; regional airspace
            </p>
          </div>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#0A4D66]/60 bg-[#001219] p-0.5">
            {(
              [
                { id: "ongoing", label: "Ongoing", icon: "mdi:airplane" },
                { id: "planned", label: "Planned", icon: "mdi:calendar-clock-outline" },
                { id: "completed", label: "Completed", icon: "mdi:check-circle-outline" },
              ] as const
            ).map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => onMapViewChange(view.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  mapView === view.id
                    ? "bg-[#0369A1] text-white shadow-[0_0_8px_rgba(3,105,161,0.5)]"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                <Icon icon={view.icon} className="h-3.5 w-3.5" />
                {view.label}
                <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] font-mono text-gray-300">
                  {viewCounts[view.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Toggle Unit Positions */}
          <button
            type="button"
            onClick={() => onToggleUnits(!showUnits)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              showUnits
                ? "border-[#00F0FF]/40 bg-[#00F0FF]/10 text-[#00F0FF]"
                : "border-[#0A4D66]/40 text-gray-400 hover:text-white"
            )}
            title="Toggle military unit headquarters & airbase locations"
          >
            <Icon icon="mdi:shield-home-outline" className="h-3.5 w-3.5" />
            Units ({units.length})
          </button>

          {/* Mission Roster Toggle */}
          <button
            type="button"
            onClick={() => setShowRoster((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              showRoster
                ? "border-[#00F0FF] bg-[#00F0FF]/20 text-white"
                : "border-[#0A4D66]/50 text-gray-300 hover:bg-[#0A4D66]/30"
            )}
          >
            <Icon icon="mdi:clipboard-list-outline" className="h-3.5 w-3.5" />
            Missions ({operations.length})
          </button>
        </div>
      </div>

      {/* Theatre Sector Quick Jumps & Layer Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A4D66]/40 bg-[#001520] px-4 py-2 text-xs">
        {/* Sector Jumps */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1 mr-1">
            <Icon icon="mdi:crosshairs-gps" className="w-3.5 h-3.5 text-[#00F0FF]" />
            Theatre Sector:
          </span>
          {THEATRE_SECTORS.map((sector) => (
            <button
              key={sector.id}
              type="button"
              onClick={() => handleSelectSector(sector)}
              className="rounded-md border border-[#0A4D66]/40 bg-[#001825] px-2 py-1 text-[11px] text-gray-300 transition hover:border-[#00F0FF]/60 hover:text-white"
            >
              <Icon icon={sector.icon} className="mr-1 inline h-3 w-3 text-[#7FD5FF]" />
              {sector.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setFlyToTarget(null);
            }}
            className="rounded-md border border-[#00F0FF]/40 bg-[#0369A1]/20 px-2 py-1 text-[11px] font-medium text-[#7FD5FF] hover:bg-[#0369A1]/40"
            title="Auto-fit bounds to all active missions & airbases"
          >
            <Icon icon="mdi:fit-to-screen-outline" className="mr-1 inline h-3 w-3" />
            Auto-Fit Theatre
          </button>
        </div>

        {/* Map Layers & Tools */}
        <div className="flex items-center gap-2">
          {/* Base Layer Switcher */}
          <div className="flex items-center rounded-lg border border-[#0A4D66]/50 bg-[#001825] p-0.5">
            {(Object.keys(MAP_LAYERS) as MapLayerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveLayer(mode)}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-all",
                  activeLayer === mode
                    ? "bg-[#0369A1] text-white shadow-[0_0_6px_rgba(3,105,161,0.6)]"
                    : "text-gray-400 hover:text-gray-200"
                )}
                title={MAP_LAYERS[mode].label}
              >
                <Icon icon={MAP_LAYERS[mode].icon} className="h-3 w-3" />
                <span className="hidden sm:inline">{MAP_LAYERS[mode].label}</span>
              </button>
            ))}
          </div>

          {/* Weather Radar Toggle */}
          <button
            type="button"
            onClick={() => setShowWeather((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all",
              showWeather
                ? "border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                : "border-[#0A4D66]/50 bg-[#001825] text-gray-400 hover:text-white"
            )}
            title="Toggle Live RainViewer Weather Radar Overlay"
          >
            <Icon icon="mdi:weather-partly-rainy" className="h-3.5 w-3.5 text-amber-400" />
            <span>Radar</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#0A4D66]/50 bg-[#001825] text-gray-300 hover:border-[#00F0FF]/50 hover:text-white"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <Icon icon={isFullscreen ? "mdi:fullscreen-exit" : "mdi:fullscreen"} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className={cn("relative w-full", isFullscreen ? "flex-1" : "h-[540px]")}>
        {/* Map Container */}
        <MapContainer
          center={[9.08, 8.0]}
          zoom={6}
          scrollWheelZoom
          className="h-full w-full bg-[#000d14]"
        >
          {/* Active Military Base Layer */}
          <TileLayer
            key={activeLayer}
            attribution={MAP_LAYERS[activeLayer].attribution}
            url={MAP_LAYERS[activeLayer].url}
            maxZoom={MAP_LAYERS[activeLayer].maxZoom}
          />

          {/* Optional Weather Radar Overlay */}
          {showWeather && (
            <TileLayer
              key="rainviewer-radar"
              url={WEATHER_RADAR_URL}
              opacity={0.65}
              maxZoom={18}
            />
          )}

          {/* Dynamic Map Controller */}
          <MapViewController bounds={theatreBounds} flyToTarget={flyToTarget} />

          {/* Tactical Cursor Position Tracker */}
          <CursorTracker onCursorMove={setCursorPos} />

          {/* Operational Flight Routes */}
          {operations.map((operation) => {
            const isSelected = selectedOperation?.id === operation.id;
            const points: [number, number][] = [
              operation.departure ? ([operation.departure.lat, operation.departure.lng] as [number, number]) : null,
              ...operation.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
              operation.arrival ? ([operation.arrival.lat, operation.arrival.lng] as [number, number]) : null,
            ].filter((pt): pt is [number, number] => pt !== null);

            const colors = STATUS_ROUTE_COLORS[operation.status] || STATUS_ROUTE_COLORS.completed;
            const totalDistance = calculateOperationDistanceNm(operation);

            return (
              <div key={`op-group-${operation.id}`}>
                {/* Glowing Outer Polyline when selected */}
                {isSelected && points.length >= 2 && (
                  <Polyline
                    positions={points}
                    pathOptions={{
                      color: "#00F0FF",
                      weight: 8,
                      opacity: 0.45,
                      lineCap: "round",
                    }}
                  />
                )}

                {/* Primary Route Polyline */}
                {points.length >= 2 && (
                  <Polyline
                    positions={points}
                    eventHandlers={{
                      click: () => handleFocusOperation(operation),
                    }}
                    pathOptions={{
                      color: isSelected ? "#00F0FF" : colors.primary,
                      weight: isSelected ? 4 : 2.5,
                      opacity: isSelected ? 1 : 0.8,
                      dashArray: operation.status === "planned" ? "6, 8" : undefined,
                    }}
                  >
                    <Tooltip direction="top" sticky>
                      <div className="space-y-0.5 text-xs font-sans">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Icon icon="mdi:airplane" className="w-3.5 h-3.5 text-[#00F0FF]" />
                          {operation.name}
                        </div>
                        <div className="text-[11px] text-gray-300">
                          {operation.unit || "Joint Air Command"} · {operation.type || "Flight Mission"}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {operation.departure && operation.arrival
                            ? `${operation.departure.lat.toFixed(2)}°, ${operation.departure.lng.toFixed(2)}° → ${operation.arrival.lat.toFixed(2)}°, ${operation.arrival.lng.toFixed(2)}°`
                            : "Enroute"}
                          {totalDistance > 0 && ` (${totalDistance} NM)`}
                        </div>
                        <div className="text-[10px] text-[#7FD5FF] font-medium pt-0.5">
                          Click to open Mission Details
                        </div>
                      </div>
                    </Tooltip>
                  </Polyline>
                )}

                {/* Departure Aerodrome Pin */}
                {operation.departure && (
                  <CircleMarker
                    center={[operation.departure.lat, operation.departure.lng]}
                    radius={isSelected ? 8 : 6}
                    pathOptions={{
                      color: "#FFFFFF",
                      fillColor: "#22C55E",
                      fillOpacity: 1,
                      weight: isSelected ? 2.5 : 1.5,
                    }}
                    eventHandlers={{
                      click: () => handleFocusOperation(operation),
                    }}
                  >
                    <Tooltip direction="top">
                      <div className="text-xs">
                        <div className="font-bold text-emerald-400 flex items-center gap-1">
                          <Icon icon="mdi:airplane-takeoff" className="w-3.5 h-3.5" />
                          Departure: {operation.name}
                        </div>
                        <div className="text-gray-300 text-[11px]">{operation.unit}</div>
                        <div className="font-mono text-[10px] text-gray-400">
                          {operation.departure.lat.toFixed(4)}°, {operation.departure.lng.toFixed(4)}°
                        </div>
                        <div className="font-mono text-[10px] text-emerald-300">
                          MGRS: {formatMgrsSpaced(latLonToMgrs(operation.departure.lat, operation.departure.lng))}
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )}

                {/* Destination Aerodrome Pin */}
                {operation.arrival && (
                  <CircleMarker
                    center={[operation.arrival.lat, operation.arrival.lng]}
                    radius={isSelected ? 8 : 6}
                    pathOptions={{
                      color: "#FFFFFF",
                      fillColor: "#EF4444",
                      fillOpacity: 1,
                      weight: isSelected ? 2.5 : 1.5,
                    }}
                    eventHandlers={{
                      click: () => handleFocusOperation(operation),
                    }}
                  >
                    <Tooltip direction="top">
                      <div className="text-xs">
                        <div className="font-bold text-red-400 flex items-center gap-1">
                          <Icon icon="mdi:airplane-landing" className="w-3.5 h-3.5" />
                          Destination: {operation.name}
                        </div>
                        <div className="text-gray-300 text-[11px]">{operation.unit}</div>
                        <div className="font-mono text-[10px] text-gray-400">
                          {operation.arrival.lat.toFixed(4)}°, {operation.arrival.lng.toFixed(4)}°
                        </div>
                        <div className="font-mono text-[10px] text-red-300">
                          MGRS: {formatMgrsSpaced(latLonToMgrs(operation.arrival.lat, operation.arrival.lng))}
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )}

                {/* Enroute Waypoints */}
                {operation.waypoints.map((wp, idx) => (
                  <CircleMarker
                    key={`wp-${operation.id}-${idx}`}
                    center={[wp.lat, wp.lng]}
                    radius={isSelected ? 5 : 3.5}
                    pathOptions={{
                      color: "#FFFFFF",
                      fillColor: "#F59E0B",
                      fillOpacity: 0.95,
                      weight: 1,
                    }}
                    eventHandlers={{
                      click: () => handleFocusOperation(operation),
                    }}
                  >
                    <Tooltip direction="top">
                      <div className="text-xs">
                        <div className="font-semibold text-amber-300">
                          {wp.name || `Waypoint CP-${idx + 1}`}
                        </div>
                        <div className="text-[10px] text-gray-400">{operation.name}</div>
                        <div className="font-mono text-[10px] text-gray-300">
                          {wp.lat.toFixed(4)}°, {wp.lng.toFixed(4)}°
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </div>
            );
          })}

          {/* Unit Command Headquarters & Airbases */}
          {showUnits &&
            units.map((unit) => (
              <CircleMarker
                key={`unit-hq-${unit.id}`}
                center={[unit.lat, unit.lng]}
                radius={8}
                pathOptions={{
                  color: "#0284C7",
                  fillColor: "#0284C7",
                  fillOpacity: 0.35,
                  weight: 2,
                }}
              >
                <Tooltip direction="top">
                  <div className="text-xs font-sans">
                    <div className="font-bold text-sky-400 flex items-center gap-1">
                      <Icon icon="mdi:shield-outline" className="w-3.5 h-3.5" />
                      {unit.name}
                    </div>
                    <div className="text-gray-300 text-[11px]">
                      {unit.personnel_count} Personnel · {unit.asset_count} Aircraft · {unit.operation_count} Missions
                    </div>
                    <div className="font-mono text-[10px] text-gray-400 mt-0.5">
                      {unit.lat.toFixed(4)}°, {unit.lng.toFixed(4)}° · MGRS:{" "}
                      {formatMgrsSpaced(latLonToMgrs(unit.lat, unit.lng))}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
        </MapContainer>

        {/* Floating Slide-Out: Mission Roster Panel */}
        {showRoster && (
          <div className="absolute top-3 right-3 z-[1000] flex max-h-[88%] w-80 flex-col rounded-xl border border-[#0A4D66] bg-[#001825]/95 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 p-3">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:airplane-search" className="h-4 w-4 text-[#00F0FF]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Theatre Missions ({filteredOperations.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRoster(false)}
                className="rounded p-1 text-gray-400 hover:text-white"
                title="Close roster"
              >
                <Icon icon="mdi:close" className="h-4 w-4" />
              </button>
            </div>

            {/* Search input */}
            <div className="border-b border-white/10 p-2.5">
              <div className="relative">
                <Icon
                  icon="mdi:magnify"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4"
                />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Search missions, unit, asset..."
                  className="w-full rounded-md border border-[#0A4D66]/50 bg-[#001219] py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:border-[#00F0FF] focus:outline-none"
                />
              </div>
            </div>

            {/* Roster List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-96">
              {filteredOperations.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  No {mapView} missions match your search query.
                </div>
              ) : (
                filteredOperations.map((op) => {
                  const isSelected = selectedOperation?.id === op.id;
                  const distance = calculateOperationDistanceNm(op);
                  return (
                    <div
                      key={`roster-${op.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleFocusOperation(op)}
                      className={cn(
                        "group cursor-pointer rounded-lg border p-2.5 text-xs transition-all",
                        isSelected
                          ? "border-[#00F0FF] bg-[#0369A1]/30 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
                          : "border-white/5 bg-[#001219]/60 hover:border-[#0A4D66] hover:bg-[#001219]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="font-semibold text-white group-hover:text-[#00F0FF]">
                          {op.name}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            op.status === "ongoing"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : op.status === "planned"
                              ? "bg-sky-500/20 text-sky-300"
                              : "bg-gray-700/40 text-gray-300"
                          )}
                        >
                          {op.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                        <span className="truncate">{op.unit || "Regional Command"}</span>
                        {distance > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-gray-300">{distance} NM</span>
                          </>
                        )}
                      </div>
                      {op.assets.length > 0 && (
                        <div className="mt-1 text-[10px] text-gray-500 truncate">
                          Aircraft: {op.assets.join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Floating Slide-Out: Mission Tactical Dossier Detail Card */}
        {selectedOperation && (
          <div className="absolute bottom-4 left-4 z-[1000] w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-[#00F0FF]/40 bg-[#001825]/98 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200 text-xs text-gray-200">
            <div className="flex items-start justify-between border-b border-white/10 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-[#00F0FF] animate-ping" />
                  <h3 className="font-bold text-white text-sm">
                    {selectedOperation.name}
                  </h3>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {selectedOperation.unit || "Joint Air Force Command"} · {selectedOperation.type || "Flight Mission"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOperation(null)}
                className="rounded p-1 text-gray-400 hover:text-white"
                title="Close dossier"
              >
                <Icon icon="mdi:close" className="h-4 w-4" />
              </button>
            </div>

            {/* Tactical Badges */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  selectedOperation.status === "ongoing"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : selectedOperation.status === "planned"
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                    : "bg-gray-700/40 text-gray-300 border border-gray-600/40"
                )}
              >
                Status: {selectedOperation.status}
              </span>
              {selectedOperation.priority && (
                <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Priority: {selectedOperation.priority}
                </span>
              )}
              {selectedOperation.category && (
                <span className="rounded bg-[#0369A1]/30 border border-[#0A4D66] px-2 py-0.5 text-[10px] text-[#7FD5FF]">
                  {selectedOperation.category}
                </span>
              )}
            </div>

            {/* Mission Corridor Details */}
            <div className="mt-3 space-y-2 rounded-lg border border-[#0A4D66]/40 bg-[#001219]/80 p-2.5 font-mono text-[11px]">
              {selectedOperation.departure && (
                <div className="flex items-start justify-between">
                  <span className="text-emerald-400 font-sans font-medium flex items-center gap-1">
                    <Icon icon="mdi:airplane-takeoff" className="w-3.5 h-3.5" /> Departure:
                  </span>
                  <div className="text-right">
                    <div>{selectedOperation.departure.lat.toFixed(4)}°, {selectedOperation.departure.lng.toFixed(4)}°</div>
                    <div className="text-[10px] text-gray-400">
                      MGRS: {formatMgrsSpaced(latLonToMgrs(selectedOperation.departure.lat, selectedOperation.departure.lng))}
                    </div>
                  </div>
                </div>
              )}

              {selectedOperation.arrival && (
                <div className="flex items-start justify-between border-t border-white/5 pt-1.5">
                  <span className="text-red-400 font-sans font-medium flex items-center gap-1">
                    <Icon icon="mdi:airplane-landing" className="w-3.5 h-3.5" /> Destination:
                  </span>
                  <div className="text-right">
                    <div>{selectedOperation.arrival.lat.toFixed(4)}°, {selectedOperation.arrival.lng.toFixed(4)}°</div>
                    <div className="text-[10px] text-gray-400">
                      MGRS: {formatMgrsSpaced(latLonToMgrs(selectedOperation.arrival.lat, selectedOperation.arrival.lng))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/5 pt-1.5 text-gray-300 font-sans text-xs">
                <span>Flight Distance:</span>
                <span className="font-mono font-bold text-[#00F0FF]">
                  {calculateOperationDistanceNm(selectedOperation)} NM ({Math.round(calculateOperationDistanceNm(selectedOperation) * 1.852)} KM)
                </span>
              </div>

              {selectedOperation.waypoints.length > 0 && (
                <div className="border-t border-white/5 pt-1.5 font-sans text-[11px]">
                  <span className="text-amber-400 font-medium">
                    Waypoints ({selectedOperation.waypoints.length}):
                  </span>{" "}
                  <span className="text-gray-300">
                    {selectedOperation.waypoints.map((w, i) => w.name || `CP-${i + 1}`).join(" → ")}
                  </span>
                </div>
              )}
            </div>

            {/* Timeline & Assets */}
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded bg-[#001219]/60 p-2 border border-white/5">
                <div className="text-[10px] text-gray-400 uppercase">Start Schedule</div>
                <div className="font-medium text-white">
                  {formatDateTime(selectedOperation.start_date_time)}
                </div>
              </div>
              <div className="rounded bg-[#001219]/60 p-2 border border-white/5">
                <div className="text-[10px] text-gray-400 uppercase">Duration / End</div>
                <div className="font-medium text-white">
                  {selectedOperation.duration_label || formatDateTime(selectedOperation.end_date_time)}
                </div>
              </div>
            </div>

            {selectedOperation.assets.length > 0 && (
              <div className="mt-2 text-[11px] text-gray-300">
                <span className="text-gray-400">Assigned Aircraft:</span>{" "}
                <span className="font-semibold text-white">
                  {selectedOperation.assets.join(", ")}
                </span>
              </div>
            )}

            {selectedOperation.description && (
              <p className="mt-2 text-[11px] text-gray-400 line-clamp-2 italic">
                "{selectedOperation.description}"
              </p>
            )}

            {/* Dossier Action Buttons */}
            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() =>
                  navigate(`/dashboard/operations/${selectedOperation.id}`, {
                    state: {
                      from: "/dashboard/strategic",
                      fromLabel: "Strategic Dashboard",
                    },
                  })
                }
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] px-3 py-1.5 text-xs font-semibold text-white shadow transition"
              >
                <Icon icon="mdi:folder-open-outline" className="w-4 h-4" />
                View Full Mission Dossier
              </button>
              <button
                type="button"
                onClick={() => handleFocusOperation(selectedOperation)}
                className="flex items-center justify-center rounded-lg border border-[#0A4D66] bg-[#001219] p-1.5 text-[#00F0FF] hover:bg-[#0A4D66]/40 transition"
                title="Re-center Corridor on Map"
              >
                <Icon icon="mdi:crosshairs-gps" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Live Military HUD Cursor Coordinates Footbar */}
        <div className="absolute bottom-2 right-2 z-[999] hidden sm:flex items-center gap-3 rounded-lg border border-[#0A4D66]/70 bg-[#001825]/90 px-3 py-1 font-mono text-[10px] text-gray-300 shadow-xl backdrop-blur-md">
          {cursorPos ? (
            <>
              <div className="flex items-center gap-1">
                <Icon icon="mdi:crosshairs" className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>{decimalToDms(cursorPos.lat, true)}, {decimalToDms(cursorPos.lng, false)}</span>
              </div>
              <span className="text-gray-600">|</span>
              <div className="text-[#00F0FF]">
                MGRS: {formatMgrsSpaced(latLonToMgrs(cursorPos.lat, cursorPos.lng))}
              </div>
            </>
          ) : (
            <span className="text-gray-500">Hover over map for tactical coordinates &amp; MGRS grid</span>
          )}
        </div>
      </div>

      {/* Map Tactical Color Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0A4D66]/40 bg-[#001825] px-4 py-2.5 text-[11px] text-gray-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E] shadow-[0_0_6px_#22C55E]" /> Departure Aerodrome
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444] shadow-[0_0_6px_#EF4444]" /> Destination Target
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> Enroute Checkpoint
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" /> Unit HQ / Airbase
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-[#22C55E]" /> Ongoing Mission
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-[#00F0FF]" /> Planned Corridor
          </span>
        </div>

        <div className="text-[10px] text-gray-500">
          Click any flight corridor or marker to inspect full mission details
        </div>
      </div>
    </div>
  );
};
