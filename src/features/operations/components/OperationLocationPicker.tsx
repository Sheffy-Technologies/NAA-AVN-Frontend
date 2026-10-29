import { useEffect, useState, useMemo } from "react";
import {
  Circle,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { circleMarker, divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@iconify/react";
import {
  decimalToDms,
  latLonToMgrs,
  formatMgrsSpaced,
  getUtmZoneInfo,
  parseAnyCoordinate,
} from "../utils/coordinates";
import {
  NIGERIA_AERONAUTICAL_DATABASE,
  type AeronauticalPointType,
} from "../utils/navigationEngine";

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
  onTargetChange?: (target: LocationTarget) => void;
  departure: CoordinateValue;
  arrival: CoordinateValue;
  waypoints?: WaypointMarker[];
  onCoordinateSelect?: (
    target: LocationTarget,
    latitude: number,
    longitude: number,
  ) => void;
  onWaypointMove?: (index: number, latitude: number, longitude: number) => void;
  onWaypointDelete?: (index: number) => void;
  onWaypointRename?: (index: number, name: string) => void;
  onDepartureMove?: (latitude: number, longitude: number) => void;
  onArrivalMove?: (latitude: number, longitude: number) => void;
  onDepartureClear?: () => void;
  onArrivalClear?: () => void;
  telemetryTracks?: Array<{
    latitude: number;
    longitude: number;
    altitude?: number | null;
    recorded_at?: string;
  }>;
  liveAircraftPositions?: Array<{
    asset_id?: number;
    asset_name?: string;
    call_sign?: string;
    imei?: string;
    latitude: number;
    longitude: number;
    altitude?: number | null;
    speed?: number | null;
    course?: number | null;
    battery_level?: number | null;
    recorded_at?: string;
    is_sos?: boolean;
  }>;
  readOnly?: boolean;
  className?: string;
  heightClassName?: string;
};

export type MapLayerMode = "night" | "osm" | "topo" | "imagery";

const getTileUrl = (relativePath: string) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (apiBase && (apiBase.startsWith("http://") || apiBase.startsWith("https://"))) {
    const trimmedBase = apiBase.replace(/\/+$/, "");
    const cleanPath = relativePath.replace(/^\/?api\/?/, "");
    return `${trimmedBase}/${cleanPath}`;
  }
  return relativePath;
};

export const MAP_LAYERS: Record<
  MapLayerMode,
  {
    label: string;
    shortLabel: string;
    icon: string;
    url: string;
    maxZoom: number;
    description: string;
  }
> = {
  night: {
    label: "Tactical Night",
    shortLabel: "Night",
    icon: "mdi:weather-night",
    url: getTileUrl("/api/map/tiles/dark/{z}/{x}/{y}.png?v=esri2"),
    maxZoom: 18,
    description: "High-contrast dark mode for cockpit & command C2 ops",
  },
  osm: {
    label: "OpenStreetMap",
    shortLabel: "OSM",
    icon: "mdi:map-outline",
    url: getTileUrl("/api/map/tiles/osm/{z}/{x}/{y}.png"),
    maxZoom: 19,
    description: "Standard road networks, civil boundaries, & infrastructure",
  },
  topo: {
    label: "Topographic Relief",
    shortLabel: "Topo",
    icon: "mdi:image-filter-hdr",
    url: getTileUrl("/api/map/tiles/topo/{z}/{x}/{y}.png"),
    maxZoom: 17,
    description: "Elevation contour relief, mountain ridges, & terrain safety",
  },
  imagery: {
    label: "Satellite Imagery",
    shortLabel: "Imagery",
    icon: "mdi:satellite-variant",
    url: getTileUrl("/api/map/tiles/imagery/{z}/{x}/{y}.png"),
    maxZoom: 18,
    description: "High-resolution satellite view of terrain & runways",
  },
};

const WEATHER_RADAR_URL = getTileUrl("/api/map/tiles/weather/{z}/{x}/{y}.png");

const cefoCenter: [number, number] = [10.311875, 9.825];
const defaultZoom = 6;

const createTacticalAircraftIcon = (course?: number | null, isSos?: boolean) => {
  const rotation = course !== null && course !== undefined ? Math.round(course) : 0;
  const primaryColor = isSos ? "#EF4444" : "#00F0FF";
  const glow = isSos ? "rgba(239, 68, 68, 0.8)" : "rgba(0, 240, 255, 0.75)";
  const pulseClass = isSos ? "animate-ping" : "";

  return divIcon({
    className: "!bg-transparent !border-0",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          position: absolute;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1.5px solid ${primaryColor};
          background: rgba(0, 240, 255, 0.15);
          box-shadow: 0 0 12px ${glow};
        " class="${pulseClass}"></div>
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #001219;
          border: 2px solid ${primaryColor};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 5px rgba(0,0,0,0.8);
          transform: rotate(${rotation}deg);
        ">
          <svg style="width: 14px; height: 14px; fill: ${primaryColor};" viewBox="0 0 24 24">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
      </div>
    `,
  });
};

const createTacticalPinIcon = (type: "departure" | "arrival" | "waypoint") => {
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
        cursor: pointer;
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

const createLiveGpsIcon = () => {
  return divIcon({
    className: "!bg-transparent !border-0",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(6, 182, 212, 0.4);
          box-shadow: 0 0 10px #06B6D4;
          animation: pulse 2s infinite ease-in-out;
        "></div>
        <div style="
          position: relative;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #06B6D4;
          border: 2.5px solid #FFFFFF;
          box-shadow: 0 0 10px #06B6D4, 0 2px 4px rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 4px; height: 4px; border-radius: 50%; background: #FFFFFF;"></div>
        </div>
      </div>
    `,
  });
};

const createAeroFixIcon = (type: AeronauticalPointType, ident: string) => {
  const isMil = type === "military_base" || type === "fob";
  const isVor = type === "vor";
  const isLz = type === "tactical_lz";
  const color = isMil ? "#EF4444" : isVor ? "#A855F7" : isLz ? "#10B981" : "#0284C7";

  return divIcon({
    className: "!bg-transparent !border-0",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `
      <div style="
        position: relative;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      " title="${ident}">
        <div style="
          width: 14px;
          height: 14px;
          border-radius: ${isVor ? "3px" : "50%"};
          background: ${color};
          border: 1.5px solid #FFFFFF;
          box-shadow: 0 0 6px ${color};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 3px; height: 3px; border-radius: 50%; background: #FFFFFF;"></div>
        </div>
      </div>
    `,
  });
};

const parseCoordinatePair = (coordinate?: CoordinateValue | null): [number, number] | null => {
  if (!coordinate) return null;

  const latStr = String(coordinate.latitude ?? "").trim();
  const lngStr = String(coordinate.longitude ?? "").trim();

  // If either coordinate is empty string or unset, don't plot phantom markers
  if (!latStr || !lngStr) {
    return null;
  }

  const latitude = Number(latStr);
  const longitude = Number(lngStr);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  // Treat (0, 0) as unset / uninitialized coordinates (Null Island)
  if (latitude === 0 && longitude === 0) {
    return null;
  }

  return [latitude, longitude];
};

const MapInteractionHandler = ({
  activeTarget,
  onCoordinateSelect,
  onCursorMove,
  onMapContextMenu,
}: {
  activeTarget: LocationTarget;
  onCoordinateSelect?: OperationLocationPickerProps["onCoordinateSelect"];
  onCursorMove?: (lat: number, lng: number) => void;
  onMapContextMenu?: (lat: number, lng: number, clientX: number, clientY: number) => void;
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
    contextmenu: (event) => {
      if (onMapContextMenu) {
        onMapContextMenu(
          event.latlng.lat,
          event.latlng.lng,
          event.originalEvent.clientX,
          event.originalEvent.clientY
        );
      }
    },
  });

  return null;
};

const MapResizeHandler = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    const container = map.getContainer();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver?.disconnect();
    };
  }, [map]);

  return null;
};

const MapFlyController = ({
  targetCenter,
}: {
  targetCenter: { lat: number; lng: number; zoom?: number; timestamp: number } | null;
}) => {
  const map = useMap();
  useEffect(() => {
    if (targetCenter) {
      map.flyTo([targetCenter.lat, targetCenter.lng], targetCenter.zoom || 13, {
        duration: 1.2,
      });
    }
  }, [targetCenter, map]);
  return null;
};

type ContextMenuState = {
  type: "waypoint" | "departure" | "arrival" | "map";
  index?: number;
  name?: string | null;
  lat: number;
  lng: number;
  x: number;
  y: number;
} | null;

type LiveGpsPosition = {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
};

export const OperationLocationPicker = ({
  activeTarget = "departure",
  onTargetChange,
  departure,
  arrival,
  waypoints = [],
  onCoordinateSelect,
  onWaypointMove: _onWaypointMove,
  onWaypointDelete,
  onWaypointRename,
  onDepartureMove,
  onArrivalMove,
  onDepartureClear,
  onArrivalClear,
  telemetryTracks = [],
  liveAircraftPositions = [],
  readOnly = false,
  className,
  heightClassName = "h-105",
}: OperationLocationPickerProps) => {
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [quickJumpInput, setQuickJumpInput] = useState("");
  const [quickJumpError, setQuickJumpError] = useState("");
  const [showAeroFixes, setShowAeroFixes] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // All-in-One Map Layer & Weather Overlay State (OSM, TOPO, IMAGERY, NIGHT, WEATHER)
  const [activeBaseLayer, setActiveBaseLayer] = useState<MapLayerMode>(() => {
    try {
      const saved = localStorage.getItem("naa_tactical_map_layer") as MapLayerMode | null;
      return saved && MAP_LAYERS[saved] ? saved : "night";
    } catch {
      return "night";
    }
  });
  const [showWeatherOverlay, setShowWeatherOverlay] = useState<boolean>(() => {
    try {
      return localStorage.getItem("naa_tactical_weather_overlay") === "true";
    } catch {
      return false;
    }
  });
  const weatherOpacity = 0.65;
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);

  // Geo-Sensing Live Location state
  const [geoState, setGeoState] = useState<"idle" | "acquiring" | "active" | "error">("idle");
  const [liveGps, setLiveGps] = useState<LiveGpsPosition | null>(null);
  const [targetCenter, setTargetCenter] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    timestamp: number;
  } | null>(null);

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

  // Close context menu and layer dropdown on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
      if (showLayerMenu) {
        setShowLayerMenu(false);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, [contextMenu, showLayerMenu]);

  const handleSelectLayer = (layer: MapLayerMode) => {
    setActiveBaseLayer(layer);
    setShowLayerMenu(false);
    try {
      localStorage.setItem("naa_tactical_map_layer", layer);
    } catch {}
    showToast(`Switched map layout to ${MAP_LAYERS[layer].label}`);
  };

  const handleToggleWeather = () => {
    setShowWeatherOverlay((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("naa_tactical_weather_overlay", String(next));
      } catch {}
      showToast(next ? "Weather Radar & Cloud Overlay active" : "Weather Overlay disabled");
      return next;
    });
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Geo-sensing: Pick live location
  const handlePickLiveLocation = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser");
      setGeoState("error");
      return;
    }

    setGeoState("acquiring");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const altitude = position.coords.altitude;

        const newFix: LiveGpsPosition = {
          lat,
          lng,
          accuracy,
          altitude,
          timestamp: Date.now(),
        };

        setLiveGps(newFix);
        setGeoState("active");
        setTargetCenter({ lat, lng, zoom: 13, timestamp: Date.now() });
        showToast(`Live GPS Acquired: ±${Math.round(accuracy)}m accuracy`);
      },
      (error) => {
        setGeoState("error");
        let msg = "Failed to acquire GPS position";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission denied";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "GPS position unavailable";
        } else if (error.code === error.TIMEOUT) {
          msg = "Location request timed out";
        }
        showToast(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard`);
    } catch {
      showToast("Failed to copy coordinates");
    }
    setContextMenu(null);
  };

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
      const latStr = String(waypoint.latitude ?? "").trim();
      const lngStr = String(waypoint.longitude ?? "").trim();
      if (!latStr || !lngStr) return;

      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        !(lat === 0 && lng === 0)
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

  const nearbyTarget = useMemo(() => {
    if (!contextMenu) return null;
    const thresholdDegSq = 0.08 * 0.08;

    if (departurePoint) {
      const dLat = contextMenu.lat - departurePoint[0];
      const dLng = contextMenu.lng - departurePoint[1];
      if (dLat * dLat + dLng * dLng < thresholdDegSq) {
        return { type: "departure" as const };
      }
    }
    if (arrivalPoint) {
      const dLat = contextMenu.lat - arrivalPoint[0];
      const dLng = contextMenu.lng - arrivalPoint[1];
      if (dLat * dLat + dLng * dLng < thresholdDegSq) {
        return { type: "arrival" as const };
      }
    }
    for (const wp of validWaypoints) {
      const dLat = contextMenu.lat - wp.point[0];
      const dLng = contextMenu.lng - wp.point[1];
      if (dLat * dLat + dLng * dLng < thresholdDegSq) {
        return { type: "waypoint" as const, index: wp.index, name: wp.name };
      }
    }
    return null;
  }, [contextMenu, departurePoint, arrivalPoint, validWaypoints]);

  const handleQuickJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickJumpInput.trim() || !onCoordinateSelect) return;

    const parsed = parseAnyCoordinate(quickJumpInput);
    if (parsed) {
      onCoordinateSelect(activeTarget, parsed.latitude, parsed.longitude);
      setTargetCenter({ lat: parsed.latitude, lng: parsed.longitude, zoom: 12, timestamp: Date.now() });
      setQuickJumpInput("");
      setQuickJumpError("");
      showToast(`Plotted to ${activeTarget.toUpperCase()}`);
    } else {
      setQuickJumpError(
        "Invalid format. Enter MGRS (e.g. 33PVP1676608542), DMS (e.g. 11°50'12\"N, 013°09'07\"E), or Lat/Lon."
      );
    }
  };

  const cursorUtm = cursorPos ? getUtmZoneInfo(cursorPos.lat, cursorPos.lng) : null;

  return (
    <div
      className={`relative rounded-xl border border-[#0A4D66]/40 bg-[#001219] flex flex-col ${className ?? ""}`.trim()}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[2000] rounded-md bg-[#001825]/95 border border-[#7FD5FF] px-3.5 py-1.5 text-xs text-[#7FD5FF] font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Icon icon="mdi:check-circle" className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Tactical Map Toolbar */}
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
            <div className="flex flex-wrap items-center gap-1 bg-[#001219] p-1 rounded-lg border border-[#0A4D66]/60">
              <span className="text-[10px] uppercase font-bold text-gray-400 px-1 hidden sm:inline">Plot Target:</span>
              <button
                type="button"
                onClick={() => onTargetChange?.("departure")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  activeTarget === "departure"
                    ? "bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)] ring-1 ring-white/20"
                    : "text-gray-300 hover:text-white hover:bg-[#0A4D66]/40"
                }`}
                title="Plot or change Departure Aerodrome"
              >
                <span className={`w-2 h-2 rounded-full ${departurePoint ? "bg-white" : "bg-emerald-400 animate-pulse"}`} />
                <span>1. Departure</span>
                {departurePoint && <Icon icon="mdi:check" className="w-3.5 h-3.5 text-white" />}
              </button>

              <button
                type="button"
                onClick={() => onTargetChange?.("waypoint")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  activeTarget === "waypoint"
                    ? "bg-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.5)] ring-1 ring-white/20"
                    : "text-gray-300 hover:text-white hover:bg-[#0A4D66]/40"
                }`}
                title="Plot enroute Waypoints / Checkpoints on the map"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>2. Waypoints {validWaypoints.length > 0 ? `(${validWaypoints.length})` : ""}</span>
              </button>

              <button
                type="button"
                onClick={() => onTargetChange?.("arrival")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  activeTarget === "arrival"
                    ? "bg-red-600 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)] ring-1 ring-white/20"
                    : "text-gray-300 hover:text-white hover:bg-[#0A4D66]/40"
                }`}
                title="Plot or change Destination Aerodrome"
              >
                <span className={`w-2 h-2 rounded-full ${arrivalPoint ? "bg-white" : "bg-red-400 animate-pulse"}`} />
                <span>3. Destination</span>
                {arrivalPoint && <Icon icon="mdi:check" className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Geo-Sensing Live Location Button */}
          {!readOnly && (
            <button
              type="button"
              onClick={handlePickLiveLocation}
              disabled={geoState === "acquiring"}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold border transition-all ${
                geoState === "active"
                  ? "bg-cyan-900/80 text-cyan-200 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                  : geoState === "acquiring"
                  ? "bg-cyan-950 text-cyan-300 border-cyan-500 animate-pulse"
                  : "bg-[#001219] text-gray-300 border-[#0A4D66]/40 hover:text-white hover:border-[#7FD5FF]"
              }`}
              title="Pick current device GPS live location (Geo-Sensing)"
            >
              <Icon
                icon={geoState === "acquiring" ? "mdi:loading" : "mdi:crosshairs-gps"}
                className={`w-3.5 h-3.5 ${geoState === "acquiring" ? "animate-spin" : "text-cyan-400"}`}
              />
              <span>
                {geoState === "active"
                  ? "Live GPS Fixed"
                  : geoState === "acquiring"
                  ? "Acquiring Fix..."
                  : "Live GPS"}
              </span>
            </button>
          )}

          {/* All-in-One Map Layer Switcher (Night, OSM, Topo, Imagery) */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowLayerMenu((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold border transition-all ${
                showLayerMenu
                  ? "bg-[#0369A1] text-white border-[#7FD5FF] shadow-[0_0_8px_rgba(3,105,161,0.5)]"
                  : "bg-[#001219] text-gray-300 border-[#0A4D66]/60 hover:text-white hover:border-[#7FD5FF]"
              }`}
              title="Select map base layer (Night, OSM, Topo, Imagery)"
            >
              <Icon icon={MAP_LAYERS[activeBaseLayer].icon} className="w-3.5 h-3.5 text-[#7FD5FF]" />
              <span>{MAP_LAYERS[activeBaseLayer].shortLabel}</span>
              <Icon icon="mdi:chevron-down" className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* Layer Selection Dropdown Menu */}
            {showLayerMenu && (
              <div
                className="absolute left-0 top-full mt-1.5 z-[2500] w-64 rounded-xl border border-[#0A4D66] bg-[#001825]/98 p-2 shadow-2xl backdrop-blur-md text-xs font-sans text-gray-200 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-[#7FD5FF] border-b border-white/10 flex items-center justify-between">
                  <span>Base Map Layer</span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Offline Cached
                  </span>
                </div>

                {(["night", "osm", "topo", "imagery"] as MapLayerMode[]).map((mode) => {
                  const item = MAP_LAYERS[mode];
                  const isSelected = activeBaseLayer === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSelectLayer(mode)}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? "bg-[#0369A1]/40 border border-[#7FD5FF]/50 text-white"
                          : "hover:bg-[#0A4D66]/30 text-gray-300 hover:text-white"
                      }`}
                    >
                      <Icon
                        icon={item.icon}
                        className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-[#7FD5FF]" : "text-gray-400"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">{item.label}</span>
                          {isSelected && (
                            <Icon icon="mdi:check" className="w-3.5 h-3.5 text-[#7FD5FF]" />
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meteorological Radar & Weather Overlay Toggle */}
          <button
            type="button"
            onClick={handleToggleWeather}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold border transition-all ${
              showWeatherOverlay
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
                : "bg-[#001219] text-gray-400 border-[#0A4D66]/40 hover:text-white hover:border-[#7FD5FF]"
            }`}
            title="Toggle Weather Radar & Cloud Precipitation Overlay"
          >
            <Icon
              icon={showWeatherOverlay ? "mdi:weather-pouring" : "mdi:weather-partly-rainy"}
              className={`w-3.5 h-3.5 ${showWeatherOverlay ? "text-amber-400 animate-pulse" : ""}`}
            />
            <span>Weather Radar</span>
            {showWeatherOverlay && (
              <span className="text-[10px] px-1 py-0.2 bg-amber-500/30 text-amber-200 rounded font-mono">
                ON
              </span>
            )}
          </button>

          {/* Color Legend Card Toggle Button */}
          <button
            type="button"
            onClick={() => setShowLegend((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold border transition-colors ${
              showLegend
                ? "bg-[#0369A1] text-white border-[#7FD5FF]"
                : "bg-[#001219] text-gray-400 border-[#0A4D66]/40 hover:text-white"
            }`}
            title="Toggle Map Color Legend & Symbology"
          >
            <Icon icon="mdi:palette-swatch-outline" className="w-3.5 h-3.5" />
            <span>Color Legend</span>
          </button>

          {/* AIP Navaids / Bases Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAeroFixes((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold border transition-colors ${
              showAeroFixes
                ? "bg-[#0369A1] text-white border-[#7FD5FF]"
                : "bg-[#001219] text-gray-400 border-[#0A4D66]/40 hover:text-white"
            }`}
            title="Toggle Nigerian Military & AIP Aeronautical Database on map"
          >
            <Icon icon="mdi:radar" className="w-3.5 h-3.5" />
            <span>AIP Navaids / Bases</span>
          </button>

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
                  className="rounded border border-[#0A4D66]/60 bg-[#001219] px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#7FD5FF] w-48 sm:w-56 font-mono"
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
      </div>

      {/* Relative container holding Leaflet Map, Floating Legend, and Right-Click Context Menu */}
      <div className="relative w-full overflow-hidden rounded-b-xl">
        {/* Tactical Map Color Legend Floating Card */}
        {showLegend && (
          <div className="absolute top-3 left-14 z-[1000] bg-[#001825]/95 border border-[#0A4D66] rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs text-gray-200 w-64 space-y-2 animate-in fade-in duration-200 select-none">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-white tracking-wide uppercase text-[11px]">
                <Icon icon="mdi:compass-rose" className="w-4 h-4 text-[#7FD5FF]" />
                <span>Map Color Legend</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                className="text-gray-400 hover:text-white transition-colors p-0.5 rounded"
                title="Hide Legend"
              >
                <Icon icon="mdi:close" className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#22C55E] border border-white shadow-[0_0_6px_#22C55E] shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-emerald-400">Departure Aerodrome</span>
                  <span className="text-[10px] text-gray-400">Flight Origin / Base</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#EF4444] border border-white shadow-[0_0_6px_#EF4444] shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-red-400">Destination Aerodrome</span>
                  <span className="text-[10px] text-gray-400">Arrival Target / Final Airbase</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] border border-white shadow-[0_0_6px_#F59E0B] shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-amber-400">Enroute Waypoint (CP)</span>
                  <span className="text-[10px] text-gray-400">Checkpoints & Flight Corridor</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#EF4444] border border-white shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-red-300">Military Base / FOB</span>
                  <span className="text-[10px] text-gray-400">Forward Operating Base</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded bg-[#A855F7] border border-white shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-purple-300">VOR / Navaid</span>
                  <span className="text-[10px] text-gray-400">VHF Omnidirectional Range</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#10B981] border border-white shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-emerald-300">Tactical LZ</span>
                  <span className="text-[10px] text-gray-400">Helicopter / Assault Landing Site</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#0284C7] border border-white shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-sky-400">Civil Aerodrome</span>
                  <span className="text-[10px] text-gray-400">Commercial / General Aviation</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1 border-t border-white/5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#06B6D4] border-2 border-white shadow-[0_0_8px_#06B6D4] shrink-0 animate-pulse" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-cyan-300">Live GPS Location</span>
                  <span className="text-[10px] text-gray-400">Geo-Sensing device position</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#001219] border-2 border-[#00F0FF] shadow-[0_0_8px_#00F0FF] shrink-0 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 fill-[#00F0FF]" viewBox="0 0 24 24">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                  </svg>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-[#00F0FF]">inReach Aircraft</span>
                  <span className="text-[10px] text-gray-400">Iridium satellite live fix</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-5 h-0.5 border-t-2 border-dashed border-[#00F0FF] shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-[#00F0FF]">Flown Satellite Track</span>
                  <span className="text-[10px] text-gray-400">Recorded telemetry breadcrumbs</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right-Click Tactical Context Menu */}
        {contextMenu && !readOnly && (
          <div
            className="fixed z-[3000] w-64 rounded-lg border border-[#0A4D66] bg-[#001825]/98 p-1.5 shadow-2xl backdrop-blur-md text-xs font-sans text-gray-200 space-y-1 animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 280),
              left: Math.min(contextMenu.x, window.innerWidth - 270),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#7FD5FF] border-b border-white/10 flex items-center justify-between">
              <span>
                {contextMenu.type === "waypoint"
                  ? `${contextMenu.name || `CP-${(contextMenu.index ?? 0) + 1}`}`
                  : contextMenu.type === "departure"
                  ? "Departure Aerodrome"
                  : contextMenu.type === "arrival"
                  ? "Destination Aerodrome"
                  : "Map Coordinates"}
              </span>
              <span className="font-mono text-gray-400 font-normal">
                {contextMenu.lat.toFixed(3)}°, {contextMenu.lng.toFixed(3)}°
              </span>
            </div>

            {/* Departure specific options */}
            {contextMenu.type === "departure" && (
              <>
                {onDepartureClear && (
                  <button
                    type="button"
                    onClick={() => {
                      onDepartureClear();
                      setContextMenu(null);
                      showToast("Cleared Departure Aerodrome");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-950/60 hover:text-red-200 transition-colors text-left font-semibold"
                  >
                    <Icon icon="mdi:trash-can-outline" className="w-4 h-4 shrink-0 text-red-400" />
                    <span>Delete Departure Aerodrome</span>
                  </button>
                )}

                {onCoordinateSelect && (
                  <button
                    type="button"
                    onClick={() => {
                      onCoordinateSelect("waypoint", contextMenu.lat, contextMenu.lng);
                      onDepartureClear?.();
                      setContextMenu(null);
                      showToast("Converted Departure to Enroute Waypoint");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                  >
                    <Icon icon="mdi:map-marker-plus" className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Convert to Enroute Waypoint</span>
                  </button>
                )}

                {onArrivalMove && (
                  <button
                    type="button"
                    onClick={() => {
                      onArrivalMove(contextMenu.lat, contextMenu.lng);
                      onDepartureClear?.();
                      setContextMenu(null);
                      showToast("Moved to Destination Aerodrome");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                  >
                    <Icon icon="mdi:airplane-landing" className="w-4 h-4 shrink-0 text-red-400" />
                    <span>Switch to Destination</span>
                  </button>
                )}
              </>
            )}

            {/* Arrival / Destination specific options */}
            {contextMenu.type === "arrival" && (
              <>
                {onArrivalClear && (
                  <button
                    type="button"
                    onClick={() => {
                      onArrivalClear();
                      setContextMenu(null);
                      showToast("Cleared Destination Aerodrome");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-950/60 hover:text-red-200 transition-colors text-left font-semibold"
                  >
                    <Icon icon="mdi:trash-can-outline" className="w-4 h-4 shrink-0 text-red-400" />
                    <span>Delete Destination Aerodrome</span>
                  </button>
                )}

                {onCoordinateSelect && (
                  <button
                    type="button"
                    onClick={() => {
                      onCoordinateSelect("waypoint", contextMenu.lat, contextMenu.lng);
                      onArrivalClear?.();
                      setContextMenu(null);
                      showToast("Converted Destination to Enroute Waypoint");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                  >
                    <Icon icon="mdi:map-marker-plus" className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Convert to Enroute Waypoint</span>
                  </button>
                )}

                {onDepartureMove && (
                  <button
                    type="button"
                    onClick={() => {
                      onDepartureMove(contextMenu.lat, contextMenu.lng);
                      onArrivalClear?.();
                      setContextMenu(null);
                      showToast("Moved to Departure Aerodrome");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                  >
                    <Icon icon="mdi:airplane-takeoff" className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Switch to Departure</span>
                  </button>
                )}
              </>
            )}

            {/* Waypoint specific options */}
            {contextMenu.type === "waypoint" && (
              <>
                {onWaypointDelete && contextMenu.index !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      onWaypointDelete(contextMenu.index!);
                      setContextMenu(null);
                      showToast(`Deleted Checkpoint CP-${contextMenu.index! + 1}`);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-950/60 hover:text-red-200 transition-colors text-left font-semibold"
                  >
                    <Icon icon="mdi:trash-can-outline" className="w-4 h-4 shrink-0 text-red-400" />
                    <span>Delete Waypoint</span>
                  </button>
                )}

                {onWaypointRename && contextMenu.index !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      const newName = window.prompt(
                        "Enter new checkpoint name / identifier:",
                        contextMenu.name || `CP-${contextMenu.index! + 1}`
                      );
                      if (newName !== null) {
                        onWaypointRename(contextMenu.index!, newName.trim());
                        showToast("Checkpoint renamed");
                      }
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                  >
                    <Icon icon="mdi:rename-box" className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Rename Checkpoint</span>
                  </button>
                )}

                {onDepartureMove && (
                  <button
                    type="button"
                    onClick={() => {
                      onDepartureMove(contextMenu.lat, contextMenu.lng);
                      if (contextMenu.index !== undefined && onWaypointDelete) {
                        onWaypointDelete(contextMenu.index);
                      }
                      setContextMenu(null);
                      showToast("Promoted Waypoint to Departure");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                  >
                    <Icon icon="mdi:airplane-takeoff" className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Promote to Departure</span>
                  </button>
                )}

                {onArrivalMove && (
                  <button
                    type="button"
                    onClick={() => {
                      onArrivalMove(contextMenu.lat, contextMenu.lng);
                      if (contextMenu.index !== undefined && onWaypointDelete) {
                        onWaypointDelete(contextMenu.index);
                      }
                      setContextMenu(null);
                      showToast("Promoted Waypoint to Destination");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                  >
                    <Icon icon="mdi:airplane-landing" className="w-4 h-4 shrink-0 text-red-400" />
                    <span>Promote to Destination</span>
                  </button>
                )}
              </>
            )}

            {/* Map Canvas right-click options */}
            {contextMenu.type === "map" && (
              <>
                {/* Proximity detected actions if clicked near an existing fix */}
                {nearbyTarget && (
                  <div className="pb-1 mb-1 border-b border-white/10 space-y-1">
                    {nearbyTarget.type === "departure" && onDepartureClear && (
                      <button
                        type="button"
                        onClick={() => {
                          onDepartureClear();
                          setContextMenu(null);
                          showToast("Cleared Departure Aerodrome");
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-950/60 hover:text-red-200 transition-colors text-left font-semibold"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-4 h-4 shrink-0 text-red-400" />
                        <span>Delete Departure Point</span>
                      </button>
                    )}
                    {nearbyTarget.type === "arrival" && onArrivalClear && (
                      <button
                        type="button"
                        onClick={() => {
                          onArrivalClear();
                          setContextMenu(null);
                          showToast("Cleared Destination Aerodrome");
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-950/60 hover:text-red-200 transition-colors text-left font-semibold"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-4 h-4 shrink-0 text-red-400" />
                        <span>Delete Destination Point</span>
                      </button>
                    )}
                    {nearbyTarget.type === "waypoint" && onWaypointDelete && nearbyTarget.index !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          onWaypointDelete(nearbyTarget.index!);
                          setContextMenu(null);
                          showToast(`Deleted Checkpoint CP-${nearbyTarget.index! + 1}`);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-950/60 hover:text-red-200 transition-colors text-left font-semibold"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-4 h-4 shrink-0 text-red-400" />
                        <span>Delete Waypoint ({nearbyTarget.name || `CP-${nearbyTarget.index + 1}`})</span>
                      </button>
                    )}
                  </div>
                )}

                {onCoordinateSelect && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onCoordinateSelect("waypoint", contextMenu.lat, contextMenu.lng);
                        setContextMenu(null);
                        showToast("Added as Enroute Waypoint");
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                    >
                      <Icon icon="mdi:map-marker-plus" className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>Add Waypoint Here</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onCoordinateSelect("departure", contextMenu.lat, contextMenu.lng);
                        setContextMenu(null);
                        showToast("Set as Departure Aerodrome");
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                    >
                      <Icon icon="mdi:airplane-takeoff" className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>Set Departure Here</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onCoordinateSelect("arrival", contextMenu.lat, contextMenu.lng);
                        setContextMenu(null);
                        showToast("Set as Destination Aerodrome");
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#0A4D66]/40 text-gray-200 hover:text-white transition-colors text-left"
                    >
                      <Icon icon="mdi:airplane-landing" className="w-4 h-4 shrink-0 text-red-400" />
                      <span>Set Destination Here</span>
                    </button>
                  </>
                )}
              </>
            )}

            <div className="border-t border-white/10 pt-1 space-y-0.5">
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    formatMgrsSpaced(latLonToMgrs(contextMenu.lat, contextMenu.lng)),
                    "MGRS"
                  )
                }
                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-[#0A4D66]/30 text-gray-300 hover:text-white transition-colors text-left text-[11px]"
              >
                <Icon icon="mdi:content-copy" className="w-3.5 h-3.5 shrink-0 text-[#7FD5FF]" />
                <span>Copy MGRS</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `${decimalToDms(contextMenu.lat, true)}, ${decimalToDms(contextMenu.lng, false)}`,
                    "DMS Coordinates"
                  )
                }
                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-[#0A4D66]/30 text-gray-300 hover:text-white transition-colors text-left text-[11px]"
              >
                <Icon icon="mdi:content-copy" className="w-3.5 h-3.5 shrink-0 text-[#7FD5FF]" />
                <span>Copy DMS</span>
              </button>
            </div>
          </div>
        )}

        {/* Map Container */}
        <MapContainer
          center={cefoCenter}
          zoom={defaultZoom}
          className={`${heightClassName} w-full`}
          scrollWheelZoom
        >
          {/* Active All-in-One Base Map Layer (Night, OSM, Topo, Imagery) */}
          <TileLayer
            key={activeBaseLayer}
            attribution="NAA Tactical Map System"
            url={MAP_LAYERS[activeBaseLayer].url}
            maxZoom={MAP_LAYERS[activeBaseLayer].maxZoom}
          />

          {/* Meteorological Radar & Cloud Weather Overlay */}
          {showWeatherOverlay && (
            <TileLayer
              key="weather-radar-overlay"
              url={WEATHER_RADAR_URL}
              opacity={weatherOpacity}
              zIndex={400}
              maxZoom={12}
            />
          )}

          <MapResizeHandler />
          <MapFlyController targetCenter={targetCenter} />

          <MapInteractionHandler
            activeTarget={activeTarget}
            onCoordinateSelect={!readOnly ? onCoordinateSelect : undefined}
            onCursorMove={(lat, lng) => setCursorPos({ lat, lng })}
            onMapContextMenu={
              !readOnly
                ? (lat, lng, clientX, clientY) =>
                    setContextMenu({
                      type: "map",
                      lat,
                      lng,
                      x: clientX,
                      y: clientY,
                    })
                : undefined
            }
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
                layer.on("click", (e) => {
                  e.originalEvent?.stopPropagation?.();
                  if (!onCoordinateSelect || readOnly) return;
                  onCoordinateSelect(activeTarget, lat, lon);
                  showToast(`Selected ${facility} as ${activeTarget.toUpperCase()}`);
                });
              }}
            />
          ) : null}

          {/* Nigerian AIP & Military Aeronautical Fixes Layer */}
          {showAeroFixes &&
            NIGERIA_AERONAUTICAL_DATABASE.map((fix) => (
              <Marker
                key={fix.id}
                position={[fix.latitude, fix.longitude]}
                icon={createAeroFixIcon(fix.type, fix.ident)}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent?.stopPropagation?.();
                    if (!onCoordinateSelect || readOnly) return;
                    onCoordinateSelect(activeTarget, fix.latitude, fix.longitude);
                    showToast(`Selected ${fix.ident} (${fix.name}) as ${activeTarget.toUpperCase()}`);
                  },
                  contextmenu: (e) => {
                    e.originalEvent?.preventDefault?.();
                    e.originalEvent?.stopPropagation?.();
                    setContextMenu({
                      type: "map",
                      lat: fix.latitude,
                      lng: fix.longitude,
                      x: e.originalEvent.clientX,
                      y: e.originalEvent.clientY,
                    });
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-[11px] font-sans">
                    <strong className="text-[#0369A1]">{fix.ident}</strong> - {fix.name}
                    {fix.frequency && <span className="block text-purple-600 font-mono">{fix.frequency}</span>}
                  </div>
                </Tooltip>
                {!readOnly && onCoordinateSelect && (
                  <Popup>
                    <div className="text-xs p-1 space-y-1.5 min-w-[210px] text-gray-900 font-sans">
                      <div className="font-bold text-sm text-[#0A4D66] flex items-center justify-between">
                        <span>{fix.ident}</span>
                        <span className="text-[10px] font-normal uppercase text-gray-500">
                          {fix.type.replace("_", " ")}
                        </span>
                      </div>
                      <div className="font-medium text-gray-800">{fix.name}</div>
                      {fix.notes && <div className="text-[11px] text-gray-500">{fix.notes}</div>}
                      <div className="font-mono text-[10px] bg-slate-100 p-1 rounded text-gray-700">
                        {fix.latitude.toFixed(4)}°, {fix.longitude.toFixed(4)}° • Elev: {fix.elevationFt} ft
                      </div>
                      <div className="flex flex-col gap-1 pt-1 font-sans">
                        <button
                          type="button"
                          onClick={() => onCoordinateSelect("departure", fix.latitude, fix.longitude)}
                          className="w-full text-left px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Set as Departure Fix
                        </button>
                        <button
                          type="button"
                          onClick={() => onCoordinateSelect("arrival", fix.latitude, fix.longitude)}
                          className="w-full text-left px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Set as Arrival Fix
                        </button>
                        <button
                          type="button"
                          onClick={() => onCoordinateSelect("waypoint", fix.latitude, fix.longitude)}
                          className="w-full text-left px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Add as Waypoint Checkpoint
                        </button>
                      </div>
                    </div>
                  </Popup>
                )}
              </Marker>
            ))}

          {routePoints.length >= 2 ? (
            <Polyline positions={routePoints} pathOptions={{ color: "#F59E0B", weight: 3 }} />
          ) : null}

          {/* Waypoints Markers - No Drag To Move badge, draggable=false */}
          {validWaypoints.map(({ index, point, name }) => {
            const label = name?.trim();
            const mgrs = formatMgrsSpaced(latLonToMgrs(point[0], point[1]));
            const dmsLat = decimalToDms(point[0], true);
            const dmsLng = decimalToDms(point[1], false);

            return (
              <Marker
                key={`waypoint-${index}`}
                position={point}
                draggable={false}
                icon={createTacticalPinIcon("waypoint")}
                eventHandlers={{
                  contextmenu: (e) => {
                    e.originalEvent.preventDefault();
                    e.originalEvent.stopPropagation();
                    setContextMenu({
                      type: "waypoint",
                      index,
                      name,
                      lat: point[0],
                      lng: point[1],
                      x: e.originalEvent.clientX,
                      y: e.originalEvent.clientY,
                    });
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -12]} permanent>
                  <div className="text-[11px] font-sans leading-tight pointer-events-none select-none">
                    <div className="flex items-center gap-1.5 font-bold text-[#F59E0B]">
                      <span>{label ? `${label} ` : ""}CP-{index + 1}</span>
                    </div>
                    <div className="font-mono text-white">
                      {dmsLat}, {dmsLng}
                    </div>
                    <div className="font-mono text-[#7FD5FF]">MGRS: {mgrs}</div>
                  </div>
                </Tooltip>
                {!readOnly && onWaypointDelete && (
                  <Popup>
                    <div className="text-xs p-1 space-y-1.5 min-w-[200px] text-gray-900 font-sans">
                      <div className="font-bold text-sm text-amber-700 flex items-center justify-between">
                        <span>{label ? `${label} ` : ""}CP-{index + 1}</span>
                        <Icon icon="mdi:map-marker" className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="font-mono text-[10px] bg-slate-100 p-1 rounded text-gray-700">
                        <div>{dmsLat}, {dmsLng}</div>
                        <div className="text-[#0369A1] font-semibold">MGRS: {mgrs}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onWaypointDelete(index);
                          showToast(`Deleted Checkpoint CP-${index + 1}`);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5" />
                        <span>Delete Waypoint</span>
                      </button>
                    </div>
                  </Popup>
                )}
              </Marker>
            );
          })}

          {/* Departure Marker - No Drag To Move */}
          {departurePoint ? (
            <Marker
              position={departurePoint}
              draggable={false}
              icon={createTacticalPinIcon("departure")}
              eventHandlers={{
                contextmenu: (e) => {
                  e.originalEvent.preventDefault();
                  e.originalEvent.stopPropagation();
                  setContextMenu({
                    type: "departure",
                    lat: departurePoint[0],
                    lng: departurePoint[1],
                    x: e.originalEvent.clientX,
                    y: e.originalEvent.clientY,
                  });
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} permanent>
                <div className="text-[11px] font-sans leading-tight pointer-events-none select-none">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <span>Departure Aerodrome</span>
                  </div>
                  <div className="font-mono text-white">
                    {decimalToDms(departurePoint[0], true)}, {decimalToDms(departurePoint[1], false)}
                  </div>
                  <div className="font-mono text-[#7FD5FF]">
                    MGRS: {formatMgrsSpaced(latLonToMgrs(departurePoint[0], departurePoint[1]))}
                  </div>
                </div>
              </Tooltip>
              {!readOnly && (
                <Popup>
                  <div className="text-xs p-1 space-y-1.5 min-w-[200px] text-gray-900 font-sans">
                    <div className="font-bold text-sm text-emerald-700 flex items-center justify-between">
                      <span>Departure Aerodrome</span>
                      <Icon icon="mdi:airplane-takeoff" className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="font-mono text-[10px] bg-slate-100 p-1 rounded text-gray-700">
                      <div>{decimalToDms(departurePoint[0], true)}, {decimalToDms(departurePoint[1], false)}</div>
                      <div className="text-[#0369A1] font-semibold">
                        MGRS: {formatMgrsSpaced(latLonToMgrs(departurePoint[0], departurePoint[1]))}
                      </div>
                    </div>
                    {onDepartureClear && (
                      <button
                        type="button"
                        onClick={() => {
                          onDepartureClear();
                          showToast("Cleared Departure Aerodrome");
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5" />
                        <span>Delete Departure Aerodrome</span>
                      </button>
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          ) : null}

          {/* Destination Marker - No Drag To Move */}
          {arrivalPoint ? (
            <Marker
              position={arrivalPoint}
              draggable={false}
              icon={createTacticalPinIcon("arrival")}
              eventHandlers={{
                contextmenu: (e) => {
                  e.originalEvent.preventDefault();
                  e.originalEvent.stopPropagation();
                  setContextMenu({
                    type: "arrival",
                    lat: arrivalPoint[0],
                    lng: arrivalPoint[1],
                    x: e.originalEvent.clientX,
                    y: e.originalEvent.clientY,
                  });
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} permanent>
                <div className="text-[11px] font-sans leading-tight pointer-events-none select-none">
                  <div className="flex items-center gap-1.5 font-bold text-red-400">
                    <span>Destination Aerodrome</span>
                  </div>
                  <div className="font-mono text-white">
                    {decimalToDms(arrivalPoint[0], true)}, {decimalToDms(arrivalPoint[1], false)}
                  </div>
                  <div className="font-mono text-[#7FD5FF]">
                    MGRS: {formatMgrsSpaced(latLonToMgrs(arrivalPoint[0], arrivalPoint[1]))}
                  </div>
                </div>
              </Tooltip>
              {!readOnly && (
                <Popup>
                  <div className="text-xs p-1 space-y-1.5 min-w-[200px] text-gray-900 font-sans">
                    <div className="font-bold text-sm text-red-700 flex items-center justify-between">
                      <span>Destination Aerodrome</span>
                      <Icon icon="mdi:airplane-landing" className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="font-mono text-[10px] bg-slate-100 p-1 rounded text-gray-700">
                      <div>{decimalToDms(arrivalPoint[0], true)}, {decimalToDms(arrivalPoint[1], false)}</div>
                      <div className="text-[#0369A1] font-semibold">
                        MGRS: {formatMgrsSpaced(latLonToMgrs(arrivalPoint[0], arrivalPoint[1]))}
                      </div>
                    </div>
                    {onArrivalClear && (
                      <button
                        type="button"
                        onClick={() => {
                          onArrivalClear();
                          showToast("Cleared Destination Aerodrome");
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5" />
                        <span>Delete Destination Aerodrome</span>
                      </button>
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          ) : null}

          {/* Geo-Sensing Live Location Marker & Accuracy Ring */}
          {liveGps && (
            <>
              <Circle
                center={[liveGps.lat, liveGps.lng]}
                radius={liveGps.accuracy}
                pathOptions={{
                  color: "#06B6D4",
                  fillColor: "#06B6D4",
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: "4 4",
                }}
              />
              <Marker position={[liveGps.lat, liveGps.lng]} icon={createLiveGpsIcon()}>
                <Tooltip direction="top" offset={[0, -14]} permanent>
                  <div className="text-[10px] font-sans font-bold text-cyan-300 bg-[#001825]/90 px-1.5 py-0.5 rounded border border-cyan-500/40 shadow">
                    Live GPS Position
                  </div>
                </Tooltip>
                {!readOnly && onCoordinateSelect && (
                  <Popup>
                    <div className="text-xs p-1 space-y-1.5 min-w-[220px] text-gray-900 font-sans">
                      <div className="font-bold text-sm text-cyan-700 flex items-center justify-between">
                        <span>Live GPS Fix</span>
                        <span className="text-[10px] text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded-full font-mono">
                          ±{Math.round(liveGps.accuracy)}m
                        </span>
                      </div>
                      <div className="font-mono text-[11px] bg-slate-100 p-1.5 rounded text-gray-700 space-y-0.5">
                        <div>
                          <strong>DMS:</strong> {decimalToDms(liveGps.lat, true)},{" "}
                          {decimalToDms(liveGps.lng, false)}
                        </div>
                        <div>
                          <strong>MGRS:</strong>{" "}
                          {formatMgrsSpaced(latLonToMgrs(liveGps.lat, liveGps.lng))}
                        </div>
                        <div>
                          <strong>Dec:</strong> {liveGps.lat.toFixed(6)}°, {liveGps.lng.toFixed(6)}°
                        </div>
                        {liveGps.altitude !== null && (
                          <div>
                            <strong>Alt:</strong> {Math.round(liveGps.altitude)} m MSL
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 pt-1 font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            onCoordinateSelect("departure", liveGps.lat, liveGps.lng);
                            showToast("Live GPS set as Departure");
                          }}
                          className="w-full text-left px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Icon icon="mdi:airplane-takeoff" className="w-3.5 h-3.5" />
                          <span>Set as Departure Point</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onCoordinateSelect("waypoint", liveGps.lat, liveGps.lng);
                            showToast("Live GPS added as Waypoint");
                          }}
                          className="w-full text-left px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Icon icon="mdi:map-marker-plus" className="w-3.5 h-3.5" />
                          <span>Add as Waypoint Checkpoint</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onCoordinateSelect("arrival", liveGps.lat, liveGps.lng);
                            showToast("Live GPS set as Destination");
                          }}
                          className="w-full text-left px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Icon icon="mdi:airplane-landing" className="w-3.5 h-3.5" />
                          <span>Set as Destination Point</span>
                        </button>
                      </div>
                    </div>
                  </Popup>
                )}
              </Marker>
            </>
          )}

          {/* Garmin inReach Flown Track (Historical Snail Trail) */}
          {telemetryTracks && telemetryTracks.length >= 2 && (
            <Polyline
              positions={telemetryTracks.map((t) => [t.latitude, t.longitude])}
              pathOptions={{
                color: "#00F0FF",
                weight: 3.5,
                dashArray: "6 6",
                opacity: 0.9,
              }}
            />
          )}

          {/* Garmin inReach Live Aircraft Position Markers */}
          {liveAircraftPositions &&
            liveAircraftPositions.map((ac, idx) => {
              const mgrsStr = formatMgrsSpaced(latLonToMgrs(ac.latitude, ac.longitude));
              const dmsLat = decimalToDms(ac.latitude, true);
              const dmsLng = decimalToDms(ac.longitude, false);
              const name = ac.call_sign || ac.asset_name || `Aircraft #${idx + 1}`;

              return (
                <Marker
                  key={`live-ac-${ac.asset_id ?? idx}`}
                  position={[ac.latitude, ac.longitude]}
                  icon={createTacticalAircraftIcon(ac.course, ac.is_sos)}
                >
                  <Tooltip direction="top" offset={[0, -18]} permanent>
                    <div className="text-[10px] font-sans font-bold text-cyan-200 bg-[#001825]/95 px-2 py-0.5 rounded border border-cyan-400 shadow flex items-center gap-1.5 select-none pointer-events-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>{name}</span>
                      {ac.altitude !== null && ac.altitude !== undefined && (
                        <span className="text-gray-300 font-mono font-normal">
                          • {Math.round(ac.altitude)}ft
                        </span>
                      )}
                      {ac.speed !== null && ac.speed !== undefined && (
                        <span className="text-gray-300 font-mono font-normal">
                          • {Math.round(ac.speed)}kts
                        </span>
                      )}
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="text-xs p-1.5 min-w-[220px] text-gray-900 font-sans space-y-2">
                      <div className="flex items-center justify-between border-b pb-1">
                        <strong className="text-cyan-800 text-sm font-bold flex items-center gap-1">
                          <span>🛰️ inReach:</span>
                          <span>{name}</span>
                        </strong>
                        {ac.battery_level !== undefined && ac.battery_level !== null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                            🔋 {ac.battery_level}%
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200">
                        <div>
                          <span className="text-gray-500 block">Altitude (MSL):</span>
                          <span className="font-bold text-gray-800">
                            {ac.altitude ? `${Math.round(ac.altitude)} FT` : "Surface"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Ground Speed:</span>
                          <span className="font-bold text-gray-800">
                            {ac.speed ? `${Math.round(ac.speed)} KTS` : "0 KTS"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Heading:</span>
                          <span className="font-bold text-gray-800">
                            {ac.course !== undefined && ac.course !== null ? `${Math.round(ac.course)}°` : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Fix Time:</span>
                          <span className="font-mono text-[10px] text-gray-800">
                            {ac.recorded_at ? new Date(ac.recorded_at).toLocaleTimeString() : "Live"}
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-[10px] bg-sky-50 text-sky-900 p-1 rounded border border-sky-200">
                        <div><strong>MGRS:</strong> {mgrsStr}</div>
                        <div><strong>DMS:</strong> {dmsLat}, {dmsLng}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>
      </div>

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
            {liveGps && (
              <span className="text-cyan-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                GPS FIX ACTIVE (±{Math.round(liveGps.accuracy)}m)
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-[#0A4D66]/40 bg-[#001825] px-4 py-2 text-[11px] text-gray-400 font-mono text-center flex items-center justify-center gap-3">
          <span>Move pointer across map for live MGRS, DMS, and UTM Zone telemetry</span>
          {liveGps && (
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
              GPS FIX ACTIVE (±{Math.round(liveGps.accuracy)}m)
            </span>
          )}
        </div>
      )}
    </div>
  );
};