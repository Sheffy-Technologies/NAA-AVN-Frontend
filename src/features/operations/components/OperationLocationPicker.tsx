import { useEffect, useState, useMemo } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import { circleMarker, divIcon, type LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@iconify/react";
import {
  decimalToDms,
  latLonToMgrs,
  formatMgrsSpaced,
  getUtmZoneInfo,
  parseAnyCoordinate,
} from "../utils/coordinates";

type LocationTarget = "departure" | "arrival" | "waypoint";

type CoordinateValue = {
  latitude: string;
  longitude: string;
};

export type WaypointMarker = {
  name?: string | null;
  latitude: number | string;
  longitude: number | string;
};

type OperationLocationPickerProps = {
  activeTarget?: LocationTarget;
  departure: CoordinateValue;
  arrival: CoordinateValue;
  waypoints?: WaypointMarker[];
  onCoordinateSelect?: (
    target: LocationTarget,
    latitude: number,
    longitude: number,
  ) => void;
  onWaypointMove?: (index: number, latitude: number, longitude: number) => void;
  onDepartureMove?: (latitude: number, longitude: number) => void;
  onArrivalMove?: (latitude: number, longitude: number) => void;
  readOnly?: boolean;
  className?: string;
  heightClassName?: string;
};

const cefoCenter: [number, number] = [10.311875, 9.825];
const defaultZoom = 6;

const createTacticalPinIcon = (
  type: "departure" | "arrival" | "waypoint",
  isDraggable: boolean = true
) => {
  const isDep = type === "departure";
  const isArr = type === "arrival";

  const color = isDep ? "#22C55E" : isArr ? "#EF4444" : "#F59E0B";
  const glow = isDep
    ? "rgba(34, 197, 94, 0.7)"
    : isArr
    ? "rgba(239, 68, 68, 0.7)"
    : "rgba(245, 158, 11, 0.7)";

  return divIcon({
    className: "!bg-transparent !border-0",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="
        position: relative;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: ${isDraggable ? "grab" : "default"};
      ">
        <div style="
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #FFFFFF;
          box-shadow: 0 0 10px ${glow}, 0 2px 4px rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: #001219;
          "></div>
        </div>
      </div>
    `,
  });
};

const parseCoordinatePair = (coordinate: CoordinateValue): [number, number] | null => {
  const latitude = Number(coordinate.latitude);
  const longitude = Number(coordinate.longitude);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return [latitude, longitude];
};

const MapInteractionHandler = ({
  activeTarget,
  onCoordinateSelect,
  onCursorMove,
}: {
  activeTarget: LocationTarget;
  onCoordinateSelect?: OperationLocationPickerProps["onCoordinateSelect"];
  onCursorMove?: (lat: number, lng: number) => void;
}) => {
  useMapEvents({
    click: (event) => {
      if (onCoordinateSelect) {
        onCoordinateSelect(activeTarget, event.latlng.lat, event.latlng.lng);
      }
    },
    mousemove: (event) => {
      if (onCursorMove) {
        onCursorMove(event.latlng.lat, event.latlng.lng);
      }
    },
  });

  return null;
};

export const OperationLocationPicker = ({
  activeTarget = "departure",
  departure,
  arrival,
  waypoints = [],
  onCoordinateSelect,
  onWaypointMove,
  onDepartureMove,
  onArrivalMove,
  readOnly = false,
  className,
  heightClassName = "h-105",
}: OperationLocationPickerProps) => {
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [quickJumpInput, setQuickJumpInput] = useState("");
  const [quickJumpError, setQuickJumpError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadGeoJson = async () => {
      try {
        const response = await fetch("/map/cefo_aero1.geojson");
        if (!response.ok) {
          throw new Error("Failed to load GeoJSON data");
        }

        const data = (await response.json()) as GeoJSON.GeoJsonObject;
        if (isMounted) {
          setGeoJsonData(data);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadGeoJson();

    return () => {
      isMounted = false;
    };
  }, []);

  const departurePoint = parseCoordinatePair(departure);
  const arrivalPoint = parseCoordinatePair(arrival);

  const validWaypoints = useMemo(() => {
    type ValidWaypoint = {
      index: number;
      point: [number, number];
      name?: string | null;
    };

    const results: ValidWaypoint[] = [];
    waypoints.forEach((waypoint, index) => {
      const lat = Number(waypoint.latitude);
      const lng = Number(waypoint.longitude);
      if (
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        waypoint.latitude !== "" &&
        waypoint.longitude !== ""
      ) {
        results.push({
          index,
          point: [lat, lng],
          name: waypoint.name,
        });
      }
    });
    return results;
  }, [waypoints]);

  const routePoints = [
    departurePoint,
    ...validWaypoints.map((w) => w.point),
    arrivalPoint,
  ].filter((point): point is [number, number] => point !== null);

  const handleFacilityClick = (event: LeafletMouseEvent) => {
    if (!onCoordinateSelect || readOnly) return;
    onCoordinateSelect(activeTarget, event.latlng.lat, event.latlng.lng);
  };

  const handleQuickJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickJumpInput.trim() || !onCoordinateSelect) return;

    const parsed = parseAnyCoordinate(quickJumpInput);
    if (parsed) {
      onCoordinateSelect(activeTarget, parsed.latitude, parsed.longitude);
      setQuickJumpInput("");
      setQuickJumpError("");
    } else {
      setQuickJumpError(
        "Invalid format. Enter MGRS (e.g. 33PVP1676608542), DMS (e.g. 11°50'12\"N, 013°09'07\"E), or Lat/Lon.",
      );
    }
  };

  const cursorUtm = cursorPos ? getUtmZoneInfo(cursorPos.lat, cursorPos.lng) : null;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#0A4D66]/40 bg-[#001219] flex flex-col ${className ?? ""}`.trim()}
    >
      {/* Top Banner / Quick Jump */}
      <div className="border-b border-[#0A4D66]/40 bg-[#001825] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-300">
        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? (
            <>
              Operation route view. Departure is{" "}
              <span className="font-semibold text-[#22C55E]">green</span>, waypoints are{" "}
              <span className="font-semibold text-[#F59E0B]">amber</span>, and destination is{" "}
              <span className="font-semibold text-[#EF4444]">red</span>.
            </>
          ) : (
            <>
              <span>
                Click map or aerodrome to plot active target:{" "}
                <span className="font-bold uppercase text-[#7FD5FF]">{activeTarget}</span>
              </span>
              {activeTarget === "waypoint" && (
                <span className="text-gray-400">
                  (Click map to insert sequential enroute checkpoints)
                </span>
              )}
              {Boolean(onWaypointMove || onDepartureMove || onArrivalMove) && (
                <span className="inline-flex items-center gap-1 rounded bg-[#0A4D66]/30 px-2 py-0.5 text-[11px] text-amber-300 border border-amber-500/30">
                  <Icon icon="mdi:cursor-move" className="w-3.5 h-3.5" />
                  <span>Drag waypoints directly on map to adjust flight corridor</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Quick Coordinate Jump / Paste Box */}
        {!readOnly && onCoordinateSelect && (
          <form
            onSubmit={handleQuickJumpSubmit}
            className="flex items-center gap-1.5 w-full sm:w-auto"
          >
            <div className="relative">
              <input
                type="text"
                value={quickJumpInput}
                onChange={(e) => {
                  setQuickJumpInput(e.target.value);
                  if (quickJumpError) setQuickJumpError("");
                }}
                placeholder="Paste MGRS / DMS / DD..."
                className="rounded border border-[#0A4D66]/60 bg-[#001219] px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#7FD5FF] w-48 sm:w-60 font-mono"
              />
              {quickJumpError && (
                <div className="absolute right-0 top-full mt-1 z-50 rounded bg-red-950 border border-red-500 p-2 text-[10px] text-red-200 shadow-xl max-w-xs">
                  {quickJumpError}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded bg-[#0A4D66] hover:bg-[#0369A1] px-2.5 py-1 text-xs font-semibold text-white transition-colors"
              title="Plot pasted coordinates to active target"
            >
              <Icon icon="mdi:target" className="w-3.5 h-3.5" />
              <span>Plot</span>
            </button>
          </form>
        )}
      </div>

      {/* Map Container */}
      <MapContainer
        center={cefoCenter}
        zoom={defaultZoom}
        className={`${heightClassName} w-full`}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapInteractionHandler
          activeTarget={activeTarget}
          onCoordinateSelect={!readOnly ? onCoordinateSelect : undefined}
          onCursorMove={(lat, lng) => setCursorPos({ lat, lng })}
        />

        {geoJsonData ? (
          <GeoJSON
            data={geoJsonData}
            pointToLayer={(_feature, latlng) =>
              circleMarker(latlng, {
                radius: 5,
                color: "#7FD5FF",
                fillColor: "#7FD5FF",
                fillOpacity: 0.8,
                weight: 1,
              })
            }
            onEachFeature={(feature, layer) => {
              const props = feature.properties ?? {};
              const facility =
                typeof props.Facility === "string" ? props.Facility : "Unknown Facility";
              const category = typeof props.Category === "string" ? props.Category : "-";
              const stateOrArea =
                typeof props.State_or_Area === "string" ? props.State_or_Area : "-";
              const geom = feature.geometry as { coordinates?: [number, number] };
              const lon = geom?.coordinates?.[0] ?? 0;
              const lat = geom?.coordinates?.[1] ?? 0;

              const mgrsStr = formatMgrsSpaced(latLonToMgrs(lat, lon));
              const dmsStr = `${decimalToDms(lat, true)}, ${decimalToDms(lon, false)}`;

              layer.bindPopup(
                `<div style="font-family: system-ui, sans-serif; min-width: 210px; color:#111;">
                  <strong style="font-size:13px; color:#0A4D66;">${facility}</strong><br />
                  <span style="font-size:11px; color:#555;">${category} • ${stateOrArea}</span><br />
                  <div style="margin: 6px 0; font-family: monospace; font-size:11px; background:#f0f9ff; padding:4px 6px; border-radius:4px; border:1px solid #bae6fd;">
                    <strong>MGRS:</strong> ${mgrsStr}<br/>
                    <strong>DMS:</strong> ${dmsStr}
                  </div>
                  ${!readOnly ? `<span style="display:block; margin-top:6px; font-weight:600; color:#0284c7; cursor:pointer;">Click to assign as ${activeTarget}</span>` : ""}
                </div>`
              );
              layer.on("click", handleFacilityClick);
            }}
          />
        ) : null}

        {routePoints.length >= 2 ? (
          <Polyline positions={routePoints} pathOptions={{ color: "#F59E0B", weight: 3 }} />
        ) : null}

        {validWaypoints.map(({ index, point, name }) => {
          const label = name?.trim();
          const mgrs = formatMgrsSpaced(latLonToMgrs(point[0], point[1]));
          const dmsLat = decimalToDms(point[0], true);
          const dmsLng = decimalToDms(point[1], false);
          const isDraggable = !readOnly && Boolean(onWaypointMove);

          return (
            <Marker
              key={`waypoint-${index}`}
              position={point}
              draggable={isDraggable}
              icon={createTacticalPinIcon("waypoint", isDraggable)}
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target;
                  const latlng = marker.getLatLng();
                  if (latlng && onWaypointMove) {
                    onWaypointMove(index, latlng.lat, latlng.lng);
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} permanent>
                <div className="text-[11px] font-sans leading-tight pointer-events-none select-none">
                  <div className="flex items-center gap-1.5 font-bold text-[#F59E0B]">
                    <span>{label ? `${label} ` : ""}CP-{index + 1}</span>
                    {isDraggable && (
                      <span className="text-[9px] font-medium tracking-tight text-amber-300 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-500/40">
                        Drag to move
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-white">
                    {dmsLat}, {dmsLng}
                  </div>
                  <div className="font-mono text-[#7FD5FF]">MGRS: {mgrs}</div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {departurePoint ? (
          <Marker
            position={departurePoint}
            draggable={!readOnly && Boolean(onDepartureMove)}
            icon={createTacticalPinIcon("departure", !readOnly && Boolean(onDepartureMove))}
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target;
                const latlng = marker.getLatLng();
                if (latlng && onDepartureMove) {
                  onDepartureMove(latlng.lat, latlng.lng);
                }
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} permanent>
              <div className="text-[11px] font-sans leading-tight pointer-events-none select-none">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <span>Departure Aerodrome</span>
                  {!readOnly && onDepartureMove && (
                    <span className="text-[9px] font-medium tracking-tight text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40">
                      Drag to move
                    </span>
                  )}
                </div>
                <div className="font-mono text-white">
                  {decimalToDms(departurePoint[0], true)}, {decimalToDms(departurePoint[1], false)}
                </div>
                <div className="font-mono text-[#7FD5FF]">
                  MGRS: {formatMgrsSpaced(latLonToMgrs(departurePoint[0], departurePoint[1]))}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ) : null}

        {arrivalPoint ? (
          <Marker
            position={arrivalPoint}
            draggable={!readOnly && Boolean(onArrivalMove)}
            icon={createTacticalPinIcon("arrival", !readOnly && Boolean(onArrivalMove))}
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target;
                const latlng = marker.getLatLng();
                if (latlng && onArrivalMove) {
                  onArrivalMove(latlng.lat, latlng.lng);
                }
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} permanent>
              <div className="text-[11px] font-sans leading-tight pointer-events-none select-none">
                <div className="flex items-center gap-1.5 font-bold text-red-400">
                  <span>Destination Aerodrome</span>
                  {!readOnly && onArrivalMove && (
                    <span className="text-[9px] font-medium tracking-tight text-red-300 bg-red-950/80 px-1 py-0.5 rounded border border-red-500/40">
                      Drag to move
                    </span>
                  )}
                </div>
                <div className="font-mono text-white">
                  {decimalToDms(arrivalPoint[0], true)}, {decimalToDms(arrivalPoint[1], false)}
                </div>
                <div className="font-mono text-[#7FD5FF]">
                  MGRS: {formatMgrsSpaced(latLonToMgrs(arrivalPoint[0], arrivalPoint[1]))}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ) : null}
      </MapContainer>

      {/* Real-Time Live Cursor Tactical HUD */}
      {cursorPos ? (
        <div className="border-t border-[#0A4D66]/40 bg-[#001825] px-4 py-2 flex flex-wrap items-center justify-between text-[11px] font-mono text-gray-300 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#7FD5FF] font-bold uppercase tracking-wider">Map HUD:</span>
            <span className="text-white">
              {decimalToDms(cursorPos.lat, true)}, {decimalToDms(cursorPos.lng, false)}
            </span>
            <span className="text-gray-400">
              ({cursorPos.lat.toFixed(6)}°, {cursorPos.lng.toFixed(6)}°)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[#F59E0B] font-bold">
              MGRS: {formatMgrsSpaced(latLonToMgrs(cursorPos.lat, cursorPos.lng))}
            </span>
            <span className="rounded bg-[#0A4D66]/40 border border-[#0A4D66] px-2 py-0.5 text-[10px] text-[#7FD5FF]">
              {cursorUtm?.theaterName || "WGS84"}
            </span>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#0A4D66]/40 bg-[#001825] px-4 py-2 text-[11px] text-gray-400 font-mono text-center">
          Move pointer across map for live MGRS, DMS, and UTM Zone telemetry
        </div>
      )}
    </div>
  );
};