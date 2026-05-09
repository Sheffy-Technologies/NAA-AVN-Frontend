import { useEffect, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import { circleMarker, type LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";

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
  readOnly?: boolean;
  className?: string;
  heightClassName?: string;
};

const cefoCenter: [number, number] = [10.311875, 9.825];
const defaultZoom = 6;

const formatCoordinate = (value: number) => value.toFixed(6);

const parseCoordinatePair = (coordinate: CoordinateValue): [number, number] | null => {
  const latitude = Number(coordinate.latitude);
  const longitude = Number(coordinate.longitude);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return [latitude, longitude];
};

const MapClickHandler = ({
  activeTarget,
  onCoordinateSelect,
}: {
  activeTarget: LocationTarget;
  onCoordinateSelect: NonNullable<OperationLocationPickerProps["onCoordinateSelect"]>;
}) => {
  useMapEvents({
    click: (event) => {
      onCoordinateSelect(activeTarget, event.latlng.lat, event.latlng.lng);
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
  readOnly = false,
  className,
  heightClassName = "h-105",
}: OperationLocationPickerProps) => {
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.GeoJsonObject | null>(null);

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
  const waypointPoints: [number, number][] = waypoints
    .map((waypoint) => {
      const lat = Number(waypoint.latitude);
      const lng = Number(waypoint.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }
      return [lat, lng] as [number, number];
    })
    .filter((point): point is [number, number] => point !== null);
  const routePoints = [departurePoint, ...waypointPoints, arrivalPoint].filter(
    (point): point is [number, number] => point !== null,
  );

  const handleFacilityClick = (event: LeafletMouseEvent) => {
    if (!onCoordinateSelect || readOnly) return;
    onCoordinateSelect(activeTarget, event.latlng.lat, event.latlng.lng);
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#0A4D66]/40 bg-[#001219] ${className ?? ""}`.trim()}
    >
      <div className="border-b border-[#0A4D66]/40 bg-[#001219] px-4 py-3 text-xs text-gray-300">
        {readOnly ? (
          <>
            Operation route view using the CEFO aerodrome map. Departure is
            <span className="mx-1 font-semibold uppercase text-[#22C55E]">
              green
            </span>
            , waypoints are
            <span className="mx-1 font-semibold uppercase text-[#F59E0B]">
              amber
            </span>
            and arrival is
            <span className="mx-1 font-semibold uppercase text-[#EF4444]">
              red
            </span>
            .
          </>
        ) : (
          <>
            Click anywhere on the map or an aerodrome point to set the
            <span className="mx-1 font-semibold uppercase text-[#7FD5FF]">
              {activeTarget}
            </span>
            location.
            {activeTarget === "waypoint" ? (
              <span className="ml-1 text-gray-400">
                Each click adds a checkpoint between departure and arrival.
              </span>
            ) : null}
          </>
        )}
      </div>

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

        {!readOnly && onCoordinateSelect ? (
          <MapClickHandler
            activeTarget={activeTarget}
            onCoordinateSelect={onCoordinateSelect}
          />
        ) : null}

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

              layer.bindPopup(
                `<div style="font-family: system-ui, sans-serif; min-width: 180px;">
                  <strong>${facility}</strong><br />
                  <span>${category}</span><br />
                  <span>${stateOrArea}</span><br />
                  <span style="display:block; margin-top:8px; color:#0A4D66;">Click to use as ${activeTarget}</span>
                </div>`,
              );
              layer.on("click", handleFacilityClick);
            }}
          />
        ) : null}

        {routePoints.length >= 2 ? (
          <Polyline positions={routePoints} pathOptions={{ color: "#F59E0B", weight: 3 }} />
        ) : null}

        {waypointPoints.map((point, index) => {
          const label = waypoints[index]?.name?.trim();
          return (
            <CircleMarker
              key={`waypoint-${index}-${point[0]}-${point[1]}`}
              center={point}
              radius={7}
              pathOptions={{ color: "#F59E0B", fillColor: "#F59E0B", fillOpacity: 0.9 }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent>
                {label ? `${label} ` : ""}CP-{index + 1}: {formatCoordinate(point[0])},{" "}
                {formatCoordinate(point[1])}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {departurePoint ? (
          <CircleMarker
            center={departurePoint}
            radius={8}
            pathOptions={{ color: "#22C55E", fillColor: "#22C55E", fillOpacity: 0.95 }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent>
              Departure: {formatCoordinate(departurePoint[0])}, {formatCoordinate(departurePoint[1])}
            </Tooltip>
          </CircleMarker>
        ) : null}

        {arrivalPoint ? (
          <CircleMarker
            center={arrivalPoint}
            radius={8}
            pathOptions={{ color: "#EF4444", fillColor: "#EF4444", fillOpacity: 0.95 }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent>
              Arrival: {formatCoordinate(arrivalPoint[0])}, {formatCoordinate(arrivalPoint[1])}
            </Tooltip>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  );
};